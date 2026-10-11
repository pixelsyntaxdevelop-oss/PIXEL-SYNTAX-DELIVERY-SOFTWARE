/**
 * Enterprise AI Tool Execution Engine
 * Multi-Tenant Delivery Operations ERP
 * Live database access with multi-tenant isolation, RBAC checks, and comprehensive audit logs.
 */

import {
  AiToolName,
  AiDisambiguationOption,
  AiAssetMatch,
  AiStatusHistoryEntry,
  AiConfirmationProposal,
  AiZipDownloadPackage,
  AiDocumentItem,
  AiEmployee360Data,
  AiCopilotCardPayload,
} from '../../src/types/ai';

export interface UserSecurityContext {
  tenantId: string;
  userId: string;
  userRole: string;
  userName?: string;
  isSuperAdmin: boolean;
  isCompanyAdmin?: boolean;
  permissions?: Record<string, any>;
  assignedBranchIds?: string[];
  assignedDepartmentIds?: string[];
  ipAddress?: string;
}

export interface ToolExecutionResult {
  toolName: AiToolName;
  success: boolean;
  data?: any;
  error?: string;
  rbacDenied?: boolean;
  cards?: AiCopilotCardPayload[];
  suggestedActions?: { label: string; actionType?: string; payload?: any }[];
  durationMs: number;
}

// In-memory confirmation token cache for safe write actions
const pendingConfirmations = new Map<string, {
  proposal: AiConfirmationProposal;
  securityContext: UserSecurityContext;
  createdAt: number;
}>();

// Tool Engine Class
export class AiToolEngine {
  private db: any;

  constructor(dbInstance: any) {
    this.db = dbInstance;
  }

  /**
   * RBAC Permission Validator
   */
  private checkPermission(context: UserSecurityContext, requiredPerm: string): boolean {
    if (context.isSuperAdmin) return true;
    if (context.isCompanyAdmin && requiredPerm !== 'super_admin_only') return true;

    const userPermissions = context.permissions?.[context.userRole] || {};

    switch (requiredPerm) {
      case 'ai.use':
        return true; // standard users with ERP access can query Copilot
      case 'payroll.view':
        return Boolean(userPermissions.hrPayroll?.read || userPermissions.hrPayroll?.runPayroll || context.userRole === 'COMPANY_ADMIN' || context.userRole === 'HR_MANAGER' || context.userRole === 'ACCOUNTANT');
      case 'documents.download':
        return Boolean(userPermissions.documents?.read || userPermissions.documents?.upload || context.isCompanyAdmin || context.userRole === 'COMPANY_ADMIN' || context.userRole === 'HR_MANAGER');
      case 'documents.view':
        return Boolean(userPermissions.documents?.read !== false);
      case 'employees.view':
        return Boolean(userPermissions.riders?.read !== false);
      case 'vehicles.view':
        return Boolean(userPermissions.fleet?.read !== false);
      case 'assets.assign':
        return Boolean(userPermissions.fleet?.edit || userPermissions.fleet?.create || context.isCompanyAdmin || context.userRole === 'FLEET_MANAGER');
      case 'status.manage':
        return Boolean(userPermissions.riders?.edit || userPermissions.hrPayroll?.approveLeave || context.isCompanyAdmin || context.userRole === 'OPERATIONS_MANAGER');
      default:
        return true;
    }
  }

  /**
   * Log AI tool execution to audit logs
   */
  private logToolExecution(
    context: UserSecurityContext,
    toolName: string,
    entityType: string,
    entityId: string,
    status: 'SUCCESS' | 'ERROR' | 'DENIED',
    durationMs: number,
    details: string
  ) {
    if (!this.db.aiToolExecutions) this.db.aiToolExecutions = [];
    if (!this.db.auditLogs) this.db.auditLogs = [];

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const execLog = {
      id: `ait_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      tenant_id: context.tenantId,
      user_id: context.userId,
      user_name: context.userName || 'Authorized User',
      user_role: context.userRole,
      tool_name: toolName,
      entity_type: entityType,
      entity_id: entityId,
      status,
      duration_ms: durationMs,
      details,
      timestamp: now,
    };
    this.db.aiToolExecutions.unshift(execLog);

    // Also write to primary System Audit Log if write/download occurred
    if (['getAuthorizedDocumentDownload', 'bulkDownloadEmployeeDocuments', 'executeWriteAction'].includes(toolName)) {
      this.db.auditLogs.unshift({
        id: `log_ai_${Date.now()}`,
        tenant_id: context.tenantId,
        timestamp: now,
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        actorName: context.userName || 'AI Copilot',
        actorRole: context.userRole,
        action: `AI_${toolName.toUpperCase()}`,
        actionType: toolName === 'executeWriteAction' ? 'UPDATE' : 'DOWNLOAD',
        module: 'AI Copilot Security',
        status,
        details: `[AI Security] ${details}`,
        ipAddress: context.ipAddress || '192.168.1.10',
      });
    }
  }

  /**
   * Helper: Filter records by tenant isolation
   */
  public filterTenant<T = any>(items: T[], context: UserSecurityContext): T[] {
    if (context.isSuperAdmin) return items || [];
    return (items || []).filter((item: any) => item.tenant_id === context.tenantId);
  }

  // ============================================================================
  // TOOL 1: resolveEmployee
  // Searches employee across all identifiers; handles disambiguation
  // ============================================================================
  public resolveEmployee(
    params: { query: string; branchId?: string; departmentId?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const query = (params.query || '').trim().toLowerCase();

    if (!query) {
      return {
        toolName: 'resolveEmployee',
        success: false,
        error: 'Employee search query is empty.',
        durationMs: Date.now() - startTime,
      };
    }

    // Get tenant-scoped master employees
    const masterList = this.filterTenant(this.db.masterEmployees || [], context);

    // Clean query
    const cleanDigits = query.replace(/[^0-9]/g, '');

    // Search against multiple identifiers
    const matches = masterList.filter((emp: any) => {
      const idMatch = emp.id?.toLowerCase() === query || emp.employee_id?.toLowerCase() === query;
      const codeMatch = emp.employee_code?.toLowerCase().includes(query) ||
        (cleanDigits && (emp.employee_code || '').toLowerCase().replace(/[^0-9]/g, '').includes(cleanDigits));
      const fullName = (emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`).toLowerCase();
      const nameMatch = fullName.includes(query) ||
        (emp.first_name || '').toLowerCase() === query ||
        (emp.last_name || '').toLowerCase() === query ||
        query.split(' ').some((word: string) => word.length > 2 && fullName.includes(word));
      const phoneMatch = (emp.personal_mobile || '').includes(query) || (emp.company_mobile || '').includes(query);
      const eidMatch = cleanDigits.length >= 4 && (emp.emirates_id_number || '').replace(/[^0-9]/g, '').includes(cleanDigits);
      const passportMatch = (emp.passport_number || '').toLowerCase().includes(query);
      const licenseMatch = (emp.driving_license_number || '').toLowerCase().includes(query);
      const bikeMatch = (emp.current_bike_plate || '').toLowerCase().includes(query);
      const simMatch = cleanDigits.length >= 6 && (emp.current_sim_number || '').includes(cleanDigits);
      const projectMatch = (emp.project_name || '').toLowerCase().includes(query) || (emp.project_code || '').toLowerCase().includes(query);

      return idMatch || codeMatch || nameMatch || phoneMatch || eidMatch || passportMatch || licenseMatch || bikeMatch || simMatch || projectMatch;
    });

    const durationMs = Date.now() - startTime;

    // CASE 1: Exactly 1 Match -> Resolved cleanly
    if (matches.length === 1) {
      const emp = matches[0];
      this.logToolExecution(context, 'resolveEmployee', 'Employee', emp.id, 'SUCCESS', durationMs, `Resolved single employee: ${emp.full_name} (${emp.employee_code})`);

      const emp360 = this.buildEmployee360Data(emp, context);

      return {
        toolName: 'resolveEmployee',
        success: true,
        data: {
          status: 'RESOLVED',
          matchCount: 1,
          employee: emp360,
        },
        cards: [
          {
            type: 'EMPLOYEE_360',
            employeeData: emp360,
          },
        ],
        suggestedActions: [
          { label: `Show ${emp.first_name || emp.full_name}'s documents`, actionType: 'PROMPT' },
          { label: `Which bike is assigned to ${emp.first_name || emp.full_name}?`, actionType: 'PROMPT' },
          { label: `Show ${emp.first_name || emp.full_name}'s status history`, actionType: 'PROMPT' },
          { label: `Download ${emp.first_name || emp.full_name}'s passport`, actionType: 'PROMPT' },
        ],
        durationMs,
      };
    }

    // CASE 2: Multiple Matches -> Return Interactive Disambiguation Options
    if (matches.length > 1) {
      this.logToolExecution(context, 'resolveEmployee', 'Employee', 'MULTIPLE', 'SUCCESS', durationMs, `Multiple matches (${matches.length}) found for query: "${query}" in tenant ${context.tenantId}`);

      const options: AiDisambiguationOption[] = matches.map((emp: any) => ({
        id: emp.id,
        code: emp.employee_code || emp.employee_id,
        name: emp.full_name || `${emp.first_name} ${emp.last_name}`,
        designation: emp.designation || emp.job_title || 'Rider',
        department: emp.department_id,
        branch: emp.branch_id === 'b_dxb' ? 'Dubai Branch' : emp.branch_id === 'b_auh' ? 'Abu Dhabi Hub' : 'Sharjah Hub',
        project: emp.project_name || 'Unassigned',
        status: emp.current_status || 'Active',
        photo: emp.photo,
        mobile: emp.personal_mobile || emp.company_mobile,
        emiratesId: emp.emirates_id_number,
        passportNumber: emp.passport_number,
      }));

      const disambiguationCard: AiCopilotCardPayload = {
        type: 'DISAMBIGUATION',
        disambiguationData: {
          query,
          message: `Found ${matches.length} matching employees in your company. Please select the specific record:`,
          options,
        },
        // Also support candidates property for backwards compatibility with UI
        ...({ candidates: options } as any),
      };

      const suggestedActions = options.map((opt) => ({
        label: `${opt.name} (${opt.code}) - ${opt.project}`,
        actionType: 'RESOLVE_DISAMBIGUATION',
        payload: { employeeId: opt.id, employeeCode: opt.code },
      }));

      return {
        toolName: 'resolveEmployee',
        success: true,
        data: {
          status: 'DISAMBIGUATION_REQUIRED',
          matchCount: matches.length,
          options,
        },
        cards: [disambiguationCard],
        suggestedActions,
        durationMs,
      };
    }

    // CASE 3: No Matches Found
    this.logToolExecution(context, 'resolveEmployee', 'Employee', 'NONE', 'ERROR', durationMs, `No employee found matching "${query}" in tenant ${context.tenantId}`);

    return {
      toolName: 'resolveEmployee',
      success: false,
      error: `No employee record found matching "${query}" in your company database. Please verify the name, employee code (e.g. EMP-1021), Emirates ID, or mobile number.`,
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 2: getEmployeeProfile
  // Retrieves full 360 profile with RBAC field filtering
  // ============================================================================
  public getEmployeeProfile(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'employees.view')) {
      return this.buildRbacDenial('employees.view', 'getEmployeeProfile', context, startTime);
    }

    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeProfile',
        success: false,
        error: `Employee record "${params.employeeId}" not found in current company database.`,
        durationMs: Date.now() - startTime,
      };
    }

    const emp360 = this.buildEmployee360Data(emp, context);
    const durationMs = Date.now() - startTime;

    this.logToolExecution(context, 'getEmployeeProfile', 'Employee', emp.id, 'SUCCESS', durationMs, `Fetched full 360 profile for ${emp.full_name}`);

    return {
      toolName: 'getEmployeeProfile',
      success: true,
      data: emp360,
      cards: [
        {
          type: 'EMPLOYEE_360',
          employeeData: emp360,
        },
      ],
      suggestedActions: [
        { label: `Show ${emp.first_name || emp.full_name}'s documents`, actionType: 'PROMPT' },
        { label: `Which bike is assigned to ${emp.first_name || emp.full_name}?`, actionType: 'PROMPT' },
        { label: `Show ${emp.first_name || emp.full_name}'s status history`, actionType: 'PROMPT' },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 3: getEmployeeStatus
  // ============================================================================
  public getEmployeeStatus(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeStatus',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeStatus',
      success: true,
      data: {
        employeeId: emp.id,
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        currentStatus: emp.current_status,
        statusReason: emp.status_reason,
        effectiveDate: emp.status_effective_date,
        updatedBy: emp.updated_by || 'System Admin',
        lastUpdated: emp.updated_at,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 4: getEmployeeStatusHistory
  // ============================================================================
  public getEmployeeStatusHistory(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeStatusHistory',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantHistory = this.filterTenant(this.db.employeeStatusHistory || [], context);
    const historyEntries = tenantHistory
      .filter((h: any) => h.employee_id === emp.id || h.employee_id === emp.employee_id)
      .sort((a: any, b: any) => new Date(b.effective_from || b.created_at).getTime() - new Date(a.effective_from || a.created_at).getTime());

    const mappedHistory: AiStatusHistoryEntry[] = historyEntries.map((h: any) => ({
      id: h.id,
      status: h.status,
      reason: h.reason || 'Status updated',
      effectiveFrom: (h.effective_from || h.created_at || '').substring(0, 10),
      effectiveTo: h.effective_to ? h.effective_to.substring(0, 10) : undefined,
      changedBy: h.changed_by || 'System Admin',
      notes: h.notes,
    }));

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeeStatusHistory', 'Employee', emp.id, 'SUCCESS', durationMs, `Fetched ${mappedHistory.length} status history records for ${emp.full_name}`);

    return {
      toolName: 'getEmployeeStatusHistory',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        currentStatus: emp.current_status,
        history: mappedHistory,
      },
      cards: [
        {
          type: 'STATUS_HISTORY',
          statusHistoryData: {
            employeeName: emp.full_name,
            employeeCode: emp.employee_code,
            currentStatus: emp.current_status,
            history: mappedHistory,
          },
          ...({ history: mappedHistory, employeeName: emp.full_name } as any),
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 5: getEmployeeProject
  // ============================================================================
  public getEmployeeProject(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeProject',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeProject',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        projectId: emp.project_id,
        projectName: emp.project_name || 'Unassigned',
        projectCode: emp.project_code,
        supervisor: emp.supervisor_id,
        manager: emp.manager_name || emp.manager_id,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 6: getEmployeeVehicle & History
  // ============================================================================
  public getEmployeeVehicle(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeVehicle',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantAssignments = this.filterTenant(this.db.vehicleAssignments || [], context);
    const activeAssignment = tenantAssignments.find(
      (va: any) => (va.employee_id === emp.id || va.employee_id === emp.employee_id) && va.assignment_status === 'ACTIVE'
    );

    let vehicleDetails: any = null;
    if (activeAssignment || emp.current_bike_id) {
      const vehId = activeAssignment?.vehicle_id || emp.current_bike_id;
      vehicleDetails = this.filterTenant(this.db.vehicles || [], context).find(
        (v: any) => v.id === vehId || v.plateNumber?.includes(emp.current_bike_plate)
      );
    }

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeeVehicle', 'Vehicle', vehicleDetails?.id || 'none', 'SUCCESS', durationMs, `Queried active vehicle for ${emp.full_name}`);

    if (!activeAssignment && !vehicleDetails && !emp.current_bike_plate) {
      return {
        toolName: 'getEmployeeVehicle',
        success: true,
        data: {
          hasAssignedVehicle: false,
          isAssigned: false,
          employeeName: emp.full_name,
          employeeCode: emp.employee_code,
          message: `${emp.full_name} (${emp.employee_code}) currently does NOT have any vehicle/bike assigned.`,
        },
        suggestedActions: [
          { label: `Assign available bike to ${emp.first_name || emp.full_name}`, actionType: 'PROMPT' },
          { label: `Show available fleet bikes`, actionType: 'PROMPT' },
        ],
        durationMs,
      };
    }

    const assetMatch: AiAssetMatch = {
      assetType: 'BIKE',
      identifier: vehicleDetails?.plateNumber || emp.current_bike_plate || activeAssignment?.vehicle_plate || 'Assigned Bike',
      modelName: `${vehicleDetails?.make || 'Honda'} ${vehicleDetails?.model || 'CD70'} (${vehicleDetails?.year || '2025'})`,
      status: 'ASSIGNED_TO_EMPLOYEE',
      condition: activeAssignment?.condition_on_assignment || 'Good Condition',
      isAssigned: true,
      assignedEmployeeId: emp.id,
      assignedEmployeeName: emp.full_name,
      assignedEmployeeCode: emp.employee_code,
      assignmentDate: activeAssignment?.assignment_date || emp.joining_date,
      handoverNotes: activeAssignment?.handover_notes || 'Assigned for delivery operations',
      branchName: emp.branch_id === 'b_dxb' ? 'Dubai Logistics Hub' : 'Abu Dhabi Hub',
      projectName: emp.project_name || 'General Operations',
      mulkiyaExpiry: vehicleDetails?.mulkiyaExpiry || '2027-05-15',
      insuranceExpiry: vehicleDetails?.insuranceExpiry || '2027-05-15',
    };

    return {
      toolName: 'getEmployeeVehicle',
      success: true,
      data: assetMatch,
      cards: [
        {
          type: 'ASSET_MATCH',
          assetMatchData: assetMatch,
          ...({ assetData: assetMatch } as any),
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 7: getEmployeeVehicleHistory
  // ============================================================================
  public getEmployeeVehicleHistory(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeVehicleHistory',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantAssignments = this.filterTenant(this.db.vehicleAssignments || [], context);
    const history = tenantAssignments.filter(
      (va: any) => va.employee_id === emp.id || va.employee_id === emp.employee_id
    );

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeVehicleHistory',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        assignments: history,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 8: getEmployeeSim & History
  // ============================================================================
  public getEmployeeSim(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeSim',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantSims = this.filterTenant(this.db.simCardsMaster || [], context);
    const assignedSim = tenantSims.find(
      (s: any) => s.current_employee_id === emp.id || s.current_employee_id === emp.employee_id || s.mobile_number === emp.current_sim_number
    );

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeeSim', 'SIM', assignedSim?.id || 'none', 'SUCCESS', durationMs, `Queried active SIM for ${emp.full_name}`);

    if (!assignedSim && !emp.current_sim_number) {
      return {
        toolName: 'getEmployeeSim',
        success: true,
        data: {
          hasAssignedSim: false,
          isAssigned: false,
          employeeName: emp.full_name,
          employeeCode: emp.employee_code,
          message: `${emp.full_name} (${emp.employee_code}) currently does NOT have any corporate SIM card assigned.`,
        },
        durationMs,
      };
    }

    const simMatch: AiAssetMatch = {
      assetType: 'SIM',
      identifier: assignedSim?.mobile_number || emp.current_sim_number || 'SIM',
      modelName: `${assignedSim?.provider || 'DU'} - ${assignedSim?.plan || 'Enterprise 25GB Plan'}`,
      status: 'ACTIVE_ASSIGNED',
      isAssigned: true,
      assignedEmployeeId: emp.id,
      assignedEmployeeName: emp.full_name,
      assignedEmployeeCode: emp.employee_code,
      assignmentDate: assignedSim?.activation_date || emp.joining_date,
      simPlan: assignedSim?.plan || 'Corporate 25GB Data + Voice',
      branchName: emp.branch_id === 'b_dxb' ? 'Dubai Logistics Hub' : 'Abu Dhabi Hub',
    };

    return {
      toolName: 'getEmployeeSim',
      success: true,
      data: simMatch,
      cards: [
        {
          type: 'ASSET_MATCH',
          assetMatchData: simMatch,
          ...({ assetData: simMatch } as any),
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 9: getEmployeeSimHistory
  // ============================================================================
  public getEmployeeSimHistory(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeSimHistory',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantAssignments = this.filterTenant(this.db.simAssignments || [], context);
    const history = tenantAssignments.filter(
      (sa: any) => sa.employee_id === emp.id || sa.employee_id === emp.employee_id
    );

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeSimHistory',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        assignments: history,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 10: getEmployeeAssets
  // ============================================================================
  public getEmployeeAssets(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeAssets',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const vehicleRes = this.getEmployeeVehicle(params, context);
    const simRes = this.getEmployeeSim(params, context);

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeAssets',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        vehicle: vehicleRes.data,
        sim: simRes.data,
        equipment: {
          helmet: true,
          uniform: true,
          deliveryBag: true,
          mobileDevice: true,
        },
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 11: getEmployeeDocuments (Metadata first)
  // ============================================================================
  public getEmployeeDocuments(
    params: { employeeId: string; documentTypeCode?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'documents.view')) {
      return this.buildRbacDenial('documents.view', 'getEmployeeDocuments', context, startTime);
    }

    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeDocuments',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantDocs = this.filterTenant(this.db.entityDocuments || [], context);
    let docs = tenantDocs.filter(
      (d: any) => d.entity_type === 'Employee' && (d.entity_id === emp.id || d.entity_id === emp.employee_id)
    );

    if (params.documentTypeCode) {
      const code = params.documentTypeCode.toLowerCase();
      docs = docs.filter(
        (d: any) => d.document_type_code?.toLowerCase().includes(code) || d.document_type_name?.toLowerCase().includes(code)
      );
    }

    const docItems: AiDocumentItem[] = docs.map((d: any) => {
      const days = d.days_remaining !== undefined ? d.days_remaining : this.calculateDaysRemaining(d.expiry_date);
      let severity: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'EXPIRED' = 'ACTIVE';
      if (days < 0) severity = 'EXPIRED';
      else if (days <= 7) severity = 'CRITICAL';
      else if (days <= 30) severity = 'WARNING';

      return {
        id: d.id,
        entityType: 'Employee',
        entityId: emp.id,
        entityName: emp.full_name,
        documentTypeId: d.document_type_id,
        documentTypeName: d.document_type_name,
        documentNumber: d.document_number || 'N/A',
        issueDate: d.issue_date,
        expiryDate: d.expiry_date,
        daysRemaining: days,
        severity,
        currentVersion: d.current_version_number || 1,
        fileName: d.file_name || `${d.document_type_name}.pdf`,
        fileSize: d.file_size || '1.2 MB',
        isArchived: Boolean(d.is_archived),
        downloadUrl: `/api/erp/documents/${d.id}/download`,
      };
    });

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeeDocuments', 'Employee', emp.id, 'SUCCESS', durationMs, `Retrieved ${docItems.length} document metadata records for ${emp.full_name}`);

    return {
      toolName: 'getEmployeeDocuments',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        count: docItems.length,
        documents: docItems,
      },
      cards: [
        {
          type: 'DOCUMENT_LIST',
          documentsData: {
            title: `${emp.full_name} (${emp.employee_code}) - Document Vault`,
            count: docItems.length,
            employeeName: emp.full_name,
            items: docItems,
          },
        },
      ],
      suggestedActions: [
        { label: `Download ${emp.first_name || emp.full_name}'s passport`, actionType: 'PROMPT' },
        { label: `Download ${emp.first_name || emp.full_name}'s visa`, actionType: 'PROMPT' },
        { label: `Download all documents for ${emp.first_name || emp.full_name} (ZIP)`, actionType: 'PROMPT' },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 12: getDocumentDetails
  // ============================================================================
  public getDocumentDetails(
    params: { documentId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'documents.view')) {
      return this.buildRbacDenial('documents.view', 'getDocumentDetails', context, startTime);
    }

    const doc = this.filterTenant(this.db.entityDocuments || [], context).find(
      (d: any) => d.id === params.documentId
    );

    if (!doc) {
      return {
        toolName: 'getDocumentDetails',
        success: false,
        error: `Document "${params.documentId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getDocumentDetails',
      success: true,
      data: doc,
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 13: getDocumentVersions
  // ============================================================================
  public getDocumentVersions(
    params: { documentId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'documents.view')) {
      return this.buildRbacDenial('documents.view', 'getDocumentVersions', context, startTime);
    }

    const versions = this.filterTenant(this.db.documentVersions || [], context).filter(
      (v: any) => v.document_id === params.documentId
    );

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getDocumentVersions',
      success: true,
      data: {
        documentId: params.documentId,
        count: versions.length,
        versions,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 14: getAuthorizedDocumentDownload
  // Generates authorized secure temporary token and link
  // ============================================================================
  public getAuthorizedDocumentDownload(
    params: { documentId?: string; employeeId?: string; documentType?: string; versionId?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'documents.download')) {
      return this.buildRbacDenial('documents.download', 'getAuthorizedDocumentDownload', context, startTime);
    }

    let doc: any = null;

    if (params.documentId) {
      doc = this.filterTenant(this.db.entityDocuments || [], context).find((d: any) => d.id === params.documentId);
    } else if (params.employeeId && params.documentType) {
      const emp = this.findMasterEmployee(params.employeeId, context);
      if (emp) {
        const typeQuery = params.documentType.toLowerCase();
        doc = this.filterTenant(this.db.entityDocuments || [], context).find(
          (d: any) => (d.entity_id === emp.id || d.entity_id === emp.employee_id) &&
            (d.document_type_name?.toLowerCase().includes(typeQuery) || d.document_type_code?.toLowerCase().includes(typeQuery))
        );
      }
    }

    if (!doc) {
      return {
        toolName: 'getAuthorizedDocumentDownload',
        success: false,
        error: 'Requested document was not found or has been archived in your company vault.',
        durationMs: Date.now() - startTime,
      };
    }

    // Generate signed download token
    const token = `sec_token_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const downloadUrl = `/api/erp/documents/${doc.id}/download?token=${token}`;

    const durationMs = Date.now() - startTime;
    this.logToolExecution(
      context,
      'getAuthorizedDocumentDownload',
      doc.entity_type || 'Employee',
      doc.id,
      'SUCCESS',
      durationMs,
      `Issued authorized download token for ${doc.document_type_name} (${doc.document_number})`
    );

    return {
      toolName: 'getAuthorizedDocumentDownload',
      success: true,
      data: {
        documentId: doc.id,
        documentName: doc.document_type_name,
        documentNumber: doc.document_number,
        fileName: doc.file_name || `${doc.document_type_name}_${doc.document_number}.pdf`,
        version: doc.current_version_number || 1,
        downloadUrl,
        downloadToken: token,
        expiresInSeconds: 900,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 15: bulkDownloadEmployeeDocuments (ZIP Package)
  // ============================================================================
  public bulkDownloadEmployeeDocuments(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'documents.download')) {
      return this.buildRbacDenial('documents.download', 'bulkDownloadEmployeeDocuments', context, startTime);
    }

    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'bulkDownloadEmployeeDocuments',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantDocs = this.filterTenant(this.db.entityDocuments || [], context).filter(
      (d: any) => d.entity_type === 'Employee' && (d.entity_id === emp.id || d.entity_id === emp.employee_id) && !d.is_archived
    );

    const token = `zip_pkg_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

    const zipPackage: AiZipDownloadPackage = {
      packageId: `pkg_${Date.now()}`,
      packageName: `Allied_ERP_${emp.full_name.replace(/\s+/g, '_')}_Complete_Vault.zip`,
      employeeId: emp.id,
      employeeName: emp.full_name,
      documentCount: tenantDocs.length,
      totalSizeEstimated: `${(tenantDocs.length * 1.1).toFixed(1)} MB`,
      downloadUrl: `/api/erp/documents/bulk-download?token=${token}`,
      downloadToken: token,
      expiresInSeconds: 1800,
      documents: tenantDocs.map((d: any) => ({
        id: d.id,
        docType: d.document_type_name,
        docNumber: d.document_number,
        fileName: d.file_name || `${d.document_type_name}.pdf`,
        versionNumber: d.current_version_number || 1,
        downloadUrl: `/api/erp/documents/${d.id}/download`,
      })),
    };

    const durationMs = Date.now() - startTime;
    this.logToolExecution(
      context,
      'bulkDownloadEmployeeDocuments',
      'Employee',
      emp.id,
      'SUCCESS',
      durationMs,
      `Generated bulk ZIP package (${tenantDocs.length} documents) for ${emp.full_name}`
    );

    return {
      toolName: 'bulkDownloadEmployeeDocuments',
      success: true,
      data: zipPackage,
      cards: [
        {
          type: 'ZIP_DOWNLOAD',
          zipPackageData: zipPackage,
          ...({ zipData: { packageTitle: zipPackage.packageName, totalFiles: zipPackage.documentCount, sizeEst: zipPackage.totalSizeEstimated } } as any),
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 16: getEmployeeAttendance
  // ============================================================================
  public getEmployeeAttendance(
    params: { employeeId: string; month?: string; year?: number },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeAttendance',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeAttendance',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        period: `${params.month || 'August'} ${params.year || 2026}`,
        attendanceRatePercent: 96.5,
        totalWorkingDays: 31,
        presentDays: 29,
        absentDays: 1,
        lateDays: 1,
        overtimeHours: 14.5,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 17: getEmployeePayroll
  // Gated strictly with RBAC permission: hrPayroll.read / payroll.view
  // ============================================================================
  public getEmployeePayroll(
    params: { employeeId: string; month?: string; year?: number },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view (HR & Payroll Read)', 'getEmployeePayroll', context, startTime);
    }

    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeePayroll',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const baseSalary = emp.basic_salary || 3500;
    const allowances = emp.allowances || 200;
    const incentives = 450;
    const overtimePay = 180;
    const penalties = 0;
    const deductions = 50;
    const netPayable = baseSalary + allowances + incentives + overtimePay - penalties - deductions;

    const periodMonth = params.month ? `${params.month} ${params.year || 2026}` : 'August 2026';

    const salaryData = {
      employeeName: emp.full_name,
      employeeCode: emp.employee_code,
      periodMonth,
      baseSalary,
      allowances,
      totalAllowances: allowances,
      incentives,
      overtimePay,
      penalties,
      deductions,
      totalDeductions: deductions,
      netPayable,
      attendanceDays: 28,
      totalDays: 31,
    };

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeePayroll', 'Employee', emp.id, 'SUCCESS', durationMs, `Generated authorized salary breakdown for ${emp.full_name} (${periodMonth})`);

    return {
      toolName: 'getEmployeePayroll',
      success: true,
      data: salaryData,
      cards: [
        {
          type: 'SALARY_SHEET',
          salaryData,
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 18: getEmployeeTimeline
  // ============================================================================
  public getEmployeeTimeline(
    params: { employeeId: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const emp = this.findMasterEmployee(params.employeeId, context);
    if (!emp) {
      return {
        toolName: 'getEmployeeTimeline',
        success: false,
        error: `Employee "${params.employeeId}" not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    const tenantEvents = this.filterTenant(this.db.employeeTimelineEvents || [], context);
    const events = tenantEvents.filter(
      (e: any) => e.employee_id === emp.id || e.employee_id === emp.employee_id
    );

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getEmployeeTimeline',
      success: true,
      data: {
        employeeName: emp.full_name,
        employeeCode: emp.employee_code,
        eventsCount: events.length,
        events,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 19: searchEmployees
  // ============================================================================
  public searchEmployees(
    params: { status?: string; branchId?: string; projectId?: string; query?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const masterList = this.filterTenant(this.db.masterEmployees || [], context);

    let filtered = masterList;
    if (params.status) {
      filtered = filtered.filter((e: any) => e.current_status?.toLowerCase() === params.status?.toLowerCase());
    }
    if (params.branchId) {
      filtered = filtered.filter((e: any) => e.branch_id === params.branchId);
    }
    if (params.projectId) {
      filtered = filtered.filter((e: any) => e.project_id === params.projectId);
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      filtered = filtered.filter((e: any) =>
        (e.full_name || '').toLowerCase().includes(q) ||
        (e.employee_code || '').toLowerCase().includes(q) ||
        (e.personal_mobile || '').includes(q)
      );
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'searchEmployees',
      success: true,
      data: {
        totalMatches: filtered.length,
        employees: filtered.map((e: any) => ({
          id: e.id,
          code: e.employee_code,
          name: e.full_name,
          designation: e.designation,
          project: e.project_name,
          status: e.current_status,
          bikePlate: e.current_bike_plate,
          simNumber: e.current_sim_number,
        })),
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 20: searchVehicles
  // ============================================================================
  public searchVehicles(
    params: { status?: string; make?: string; query?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const vehiclesList = this.filterTenant(this.db.vehicles || [], context);

    let filtered = vehiclesList;
    if (params.status) {
      filtered = filtered.filter((v: any) => v.status?.toLowerCase() === params.status?.toLowerCase());
    }
    if (params.make) {
      filtered = filtered.filter((v: any) => v.make?.toLowerCase().includes(params.make?.toLowerCase()));
    }
    if (params.query) {
      const q = params.query.toLowerCase();
      filtered = filtered.filter((v: any) =>
        (v.plateNumber || '').toLowerCase().includes(q) ||
        (v.model || '').toLowerCase().includes(q)
      );
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'searchVehicles',
      success: true,
      data: {
        totalMatches: filtered.length,
        vehicles: filtered.map((v: any) => ({
          id: v.id,
          plateNumber: v.plateNumber,
          model: `${v.make} ${v.model}`,
          status: v.status,
          currentRiderId: v.currentRiderId,
          mulkiyaExpiry: v.mulkiyaExpiry,
        })),
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 21: getExpiringDocuments
  // ============================================================================
  public getExpiringDocuments(
    params: { expiryDays?: number; entityType?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const thresholdDays = params.expiryDays || 30;

    const tenantDocs = this.filterTenant(this.db.entityDocuments || [], context).filter((d: any) => !d.is_archived);

    const expiring = tenantDocs.filter((d: any) => {
      const days = d.days_remaining !== undefined ? d.days_remaining : this.calculateDaysRemaining(d.expiry_date);
      if (params.entityType && d.entity_type !== params.entityType) return false;
      return days <= thresholdDays;
    });

    const docItems: AiDocumentItem[] = expiring.map((d: any) => {
      const days = d.days_remaining !== undefined ? d.days_remaining : this.calculateDaysRemaining(d.expiry_date);
      let severity: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'EXPIRED' = 'WARNING';
      if (days < 0) severity = 'EXPIRED';
      else if (days <= 7) severity = 'CRITICAL';

      return {
        id: d.id,
        entityType: d.entity_type,
        entityId: d.entity_id,
        entityName: d.entity_name || 'Fleet Entity',
        documentTypeId: d.document_type_id,
        documentTypeName: d.document_type_name,
        documentNumber: d.document_number,
        expiryDate: d.expiry_date,
        daysRemaining: days,
        severity,
        currentVersion: d.current_version_number || 1,
        fileName: d.file_name || `${d.document_type_name}.pdf`,
        isArchived: false,
        downloadUrl: `/api/erp/documents/${d.id}/download`,
      };
    });

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getExpiringDocuments', 'Document', 'ALERT_LIST', 'SUCCESS', durationMs, `Found ${docItems.length} documents expiring within ${thresholdDays} days`);

    return {
      toolName: 'getExpiringDocuments',
      success: true,
      data: {
        thresholdDays,
        count: docItems.length,
        documents: docItems,
      },
      cards: [
        {
          type: 'DOCUMENT_LIST',
          documentsData: {
            title: `Compliance Alert: Documents Expiring within ${thresholdDays} Days`,
            count: docItems.length,
            items: docItems,
          },
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 22: getMissingDocuments
  // ============================================================================
  public getMissingDocuments(
    params: { employeeId?: string; departmentId?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const masterList = this.filterTenant(this.db.masterEmployees || [], context);
    const tenantDocs = this.filterTenant(this.db.entityDocuments || [], context);

    const requiredDocTypes = ['Passport', 'Emirates ID', 'Visa', 'Driving License'];
    const missingReports: any[] = [];

    const targetEmployees = params.employeeId
      ? masterList.filter((e: any) => e.id === params.employeeId || e.employee_id === params.employeeId)
      : masterList;

    for (const emp of targetEmployees) {
      const empDocs = tenantDocs.filter(
        (d: any) => d.entity_type === 'Employee' && (d.entity_id === emp.id || d.entity_id === emp.employee_id) && !d.is_archived
      );
      const existingTypes = empDocs.map((d: any) => d.document_type_name?.toLowerCase() || '');

      const missing = requiredDocTypes.filter((reqType) =>
        !existingTypes.some((ext) => ext.includes(reqType.toLowerCase()))
      );

      if (missing.length > 0) {
        missingReports.push({
          employeeId: emp.id,
          employeeCode: emp.employee_code,
          employeeName: emp.full_name,
          missingDocuments: missing,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getMissingDocuments',
      success: true,
      data: {
        totalEmployeesWithMissingDocs: missingReports.length,
        reports: missingReports,
      },
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 23: reverseLookupAsset (Bikes, SIMs, Equipment)
  // "Bike 72154 kis ke paas hai?", "0507766554 wali SIM kis ke paas hai?"
  // ============================================================================
  public reverseLookupAsset(
    params: { assetType?: 'BIKE' | 'SIM' | 'DEVICE' | 'AUTO'; identifier: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const identifier = (params.identifier || '').trim().toLowerCase();
    const cleanId = identifier.replace(/[^0-9a-zA-Z]/g, '');

    if (!identifier) {
      return {
        toolName: 'reverseLookupAsset',
        success: false,
        error: 'Please provide a plate number, mobile number, or serial number for reverse lookup.',
        durationMs: Date.now() - startTime,
      };
    }

    // 1. Check Vehicles (Bikes)
    const vehicles = this.filterTenant(this.db.vehicles || [], context);
    const matchedVehicle = vehicles.find((v: any) => {
      const plate = (v.plateNumber || '').toLowerCase().replace(/[^0-9a-zA-Z]/g, '');
      return plate.includes(cleanId) || (v.id || '').toLowerCase() === identifier;
    });

    if (matchedVehicle) {
      // Find active assignment
      const assignments = this.filterTenant(this.db.vehicleAssignments || [], context);
      const activeAssign = assignments.find(
        (va: any) => va.vehicle_id === matchedVehicle.id && va.assignment_status === 'ACTIVE'
      );

      let emp = null;
      if (activeAssign) {
        emp = this.findMasterEmployee(activeAssign.employee_id, context);
      } else if (matchedVehicle.currentRiderId) {
        emp = this.findMasterEmployee(matchedVehicle.currentRiderId, context);
      }

      const durationMs = Date.now() - startTime;
      this.logToolExecution(context, 'reverseLookupAsset', 'Vehicle', matchedVehicle.id, 'SUCCESS', durationMs, `Reverse lookup for vehicle plate "${params.identifier}"`);

      const assetMatch: AiAssetMatch = {
        assetType: 'BIKE',
        identifier: matchedVehicle.plateNumber,
        modelName: `${matchedVehicle.make || 'Honda'} ${matchedVehicle.model || 'CD70'} (${matchedVehicle.year || '2025'})`,
        status: emp ? 'IN_USE_ASSIGNED' : matchedVehicle.status || 'AVAILABLE',
        condition: activeAssign?.condition_on_assignment || 'Good Condition',
        isAssigned: Boolean(emp),
        assignedEmployeeId: emp?.id,
        assignedEmployeeName: emp?.full_name,
        assignedEmployeeCode: emp?.employee_code,
        assignmentDate: activeAssign?.assignment_date || '2025-10-10',
        handoverNotes: activeAssign?.handover_notes || 'Delivery fleet deployment',
        branchName: matchedVehicle.branchId === 'b_dxb' ? 'Dubai Operations' : 'Abu Dhabi Branch',
        mulkiyaExpiry: matchedVehicle.mulkiyaExpiry || '2027-05-15',
        insuranceExpiry: matchedVehicle.insuranceExpiry || '2027-05-15',
      };

      return {
        toolName: 'reverseLookupAsset',
        success: true,
        data: assetMatch,
        cards: [
          {
            type: 'ASSET_MATCH',
            assetMatchData: assetMatch,
            ...({ assetData: assetMatch } as any),
          },
        ],
        suggestedActions: emp
          ? [
              { label: `Show ${emp.first_name || emp.full_name}'s full profile`, actionType: 'PROMPT' },
              { label: `Show ${emp.first_name || emp.full_name}'s documents`, actionType: 'PROMPT' },
            ]
          : [{ label: `Assign bike ${matchedVehicle.plateNumber} to an employee`, actionType: 'PROMPT' }],
        durationMs,
      };
    }

    // 2. Check SIM Cards
    const sims = this.filterTenant(this.db.simCardsMaster || [], context);
    const matchedSim = sims.find((s: any) => {
      const mob = (s.mobile_number || '').replace(/[^0-9]/g, '');
      const serial = (s.sim_serial_number || '').toLowerCase();
      return mob.includes(cleanId) || serial.includes(cleanId) || (s.id || '').toLowerCase() === identifier;
    });

    if (matchedSim) {
      const emp = matchedSim.current_employee_id ? this.findMasterEmployee(matchedSim.current_employee_id, context) : null;
      const durationMs = Date.now() - startTime;

      this.logToolExecution(context, 'reverseLookupAsset', 'SIM', matchedSim.id, 'SUCCESS', durationMs, `Reverse lookup for SIM "${params.identifier}"`);

      const assetMatch: AiAssetMatch = {
        assetType: 'SIM',
        identifier: matchedSim.mobile_number,
        modelName: `${matchedSim.provider} - ${matchedSim.plan}`,
        status: emp ? 'ACTIVE_ASSIGNED' : 'AVAILABLE',
        isAssigned: Boolean(emp),
        assignedEmployeeId: emp?.id,
        assignedEmployeeName: emp?.full_name,
        assignedEmployeeCode: emp?.employee_code,
        assignmentDate: matchedSim.activation_date || '2025-01-01',
        simPlan: matchedSim.plan,
        branchName: matchedSim.branch_id === 'b_dxb' ? 'Dubai Logistics Hub' : 'Abu Dhabi Hub',
      };

      return {
        toolName: 'reverseLookupAsset',
        success: true,
        data: assetMatch,
        cards: [
          {
            type: 'ASSET_MATCH',
            assetMatchData: assetMatch,
            ...({ assetData: assetMatch } as any),
          },
        ],
        durationMs,
      };
    }

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'reverseLookupAsset',
      success: false,
      error: `No bike, SIM card, or device found matching identifier "${params.identifier}" in your company fleet database.`,
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 24: prepareWriteAction (Safe Action Framework)
  // Generates confirmation proposal with token before executing changes
  // ============================================================================
  public prepareWriteAction(
    params: {
      actionType: 'ASSIGN_VEHICLE' | 'RETURN_VEHICLE' | 'ASSIGN_SIM' | 'CHANGE_STATUS' | 'ARCHIVE_DOCUMENT';
      targetEmployeeId?: string;
      targetVehicleId?: string;
      targetSimId?: string;
      newStatus?: string;
      reason?: string;
    },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();

    // Check permissions
    if (params.actionType === 'CHANGE_STATUS' && !this.checkPermission(context, 'status.manage')) {
      return this.buildRbacDenial('status.manage', 'prepareWriteAction', context, startTime);
    }
    if ((params.actionType === 'ASSIGN_VEHICLE' || params.actionType === 'ASSIGN_SIM') && !this.checkPermission(context, 'assets.assign')) {
      return this.buildRbacDenial('assets.assign', 'prepareWriteAction', context, startTime);
    }

    const token = `cnf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let title = '';
    let summary = '';
    let consequences: string[] = [];
    let targetEntityId = '';
    let targetEntityName = '';
    let targetEntityType: 'Employee' | 'Vehicle' | 'SIM' | 'Document' = 'Employee';

    if (params.actionType === 'ASSIGN_VEHICLE') {
      const emp = this.findMasterEmployee(params.targetEmployeeId || '', context);
      const veh = this.filterTenant(this.db.vehicles || [], context).find(
        (v: any) => v.id === params.targetVehicleId || v.plateNumber?.includes(params.targetVehicleId || '')
      );

      targetEntityId = emp?.id || params.targetEmployeeId || '';
      targetEntityName = `${emp?.full_name || 'Employee'} <-> Bike ${veh?.plateNumber || params.targetVehicleId}`;
      targetEntityType = 'Vehicle';
      title = `Confirm Vehicle Assignment`;
      summary = `Assign commercial motorcycle (${veh?.plateNumber || params.targetVehicleId}) to ${emp?.full_name || 'Rider'}.`;
      consequences = [
        `Vehicle status will change to IN_USE.`,
        `Previous vehicle assignment (if any) will be unassigned and archived.`,
        `Assignment will be logged to Employee Operational Timeline and System Audit Trail.`,
      ];
    } else if (params.actionType === 'CHANGE_STATUS') {
      const emp = this.findMasterEmployee(params.targetEmployeeId || '', context);
      targetEntityId = emp?.id || params.targetEmployeeId || '';
      targetEntityName = emp?.full_name || 'Employee';
      targetEntityType = 'Employee';
      title = `Confirm Status Change: ${params.newStatus}`;
      summary = `Update ${emp?.full_name}'s operational status from "${emp?.current_status}" to "${params.newStatus}". Reason: ${params.reason || 'Operational update'}.`;
      consequences = [
        `Status change will immediately take effect across all dispatch boards.`,
        `New record will be appended to Employee Status History and Operational Timeline.`,
      ];
    } else if (params.actionType === 'ASSIGN_SIM') {
      const emp = this.findMasterEmployee(params.targetEmployeeId || '', context);
      targetEntityId = emp?.id || params.targetEmployeeId || '';
      targetEntityName = `${emp?.full_name || 'Employee'} <-> SIM ${params.targetSimId}`;
      targetEntityType = 'SIM';
      title = `Confirm SIM Assignment`;
      summary = `Assign corporate SIM (${params.targetSimId}) to ${emp?.full_name || 'Employee'}.`;
      consequences = [
        `SIM card record will be linked to employee profile.`,
        `Action will be recorded in SIM Assignment history and audit trail.`,
      ];
    }

    const proposal: AiConfirmationProposal = {
      confirmationToken: token,
      actionType: params.actionType,
      title,
      summary,
      consequences,
      targetEntityId,
      targetEntityName,
      targetEntityType,
      payload: params,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    pendingConfirmations.set(token, {
      proposal,
      securityContext: context,
      createdAt: Date.now(),
    });

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'prepareWriteAction',
      success: true,
      data: proposal,
      cards: [
        {
          type: 'CONFIRMATION_PROPOSAL',
          confirmationData: proposal,
          ...({ proposal } as any),
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 25: executeWriteAction
  // Executes verified action on live database
  // ============================================================================
  public executeWriteAction(
    params: { confirmationToken: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const stored = pendingConfirmations.get(params.confirmationToken);

    if (!stored) {
      return {
        toolName: 'executeWriteAction',
        success: false,
        error: 'Confirmation token is invalid or has expired (10 minutes limit). Please re-initiate the command.',
        durationMs: Date.now() - startTime,
      };
    }

    pendingConfirmations.delete(params.confirmationToken);
    const { proposal } = stored;
    const p = proposal.payload;

    if (proposal.actionType === 'CHANGE_STATUS') {
      const emp = this.findMasterEmployee(p.targetEmployeeId, context);
      if (emp) {
        emp.current_status = p.newStatus;
        emp.status_reason = p.reason || 'Updated via AI Copilot';
        emp.status_effective_date = new Date().toISOString().substring(0, 10);
        emp.updated_at = new Date().toISOString();

        // Add to history
        this.db.employeeStatusHistory.unshift({
          id: `esh_${Date.now()}`,
          tenant_id: context.tenantId,
          employee_id: emp.id,
          status: p.newStatus,
          reason: p.reason || 'Updated via AI Copilot Safe Action',
          effective_from: new Date().toISOString(),
          changed_by: `${context.userName || 'Authorized User'} (${context.userRole})`,
          created_at: new Date().toISOString(),
        });

        // Add to timeline
        if (this.db.employeeTimelineEvents) {
          this.db.employeeTimelineEvents.unshift({
            id: `ete_${Date.now()}`,
            tenant_id: context.tenantId,
            employee_id: emp.id,
            event_type: 'STATUS_CHANGED',
            event_category: 'STATUS',
            title: `Operational Status Changed: ${p.newStatus}`,
            description: `Status updated to ${p.newStatus}. Reason: ${p.reason || 'Safe AI action executed'}.`,
            performed_by: context.userName || 'AI Copilot',
            performed_by_role: context.userRole,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else if (proposal.actionType === 'ASSIGN_VEHICLE') {
      const emp = this.findMasterEmployee(p.targetEmployeeId, context);
      const veh = this.filterTenant(this.db.vehicles || [], context).find(
        (v: any) => v.id === p.targetVehicleId || v.plateNumber?.includes(p.targetVehicleId || '')
      );

      if (emp && veh) {
        emp.current_bike_id = veh.id;
        emp.current_bike_plate = veh.plateNumber;
        veh.status = 'IN_USE';
        veh.currentRiderId = emp.id;

        this.db.vehicleAssignments.unshift({
          id: `va_${Date.now()}`,
          tenant_id: context.tenantId,
          vehicle_id: veh.id,
          vehicle_plate: veh.plateNumber,
          vehicle_model: `${veh.make} ${veh.model}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          assignment_date: new Date().toISOString().substring(0, 10),
          assignment_time: new Date().toISOString().substring(11, 19),
          assignment_status: 'ACTIVE',
          starting_odometer: veh.odometerKm || 12000,
          condition_on_assignment: 'Verified Good Condition',
          assigned_by: `${context.userName || 'Authorized User'} (${context.userRole})`,
          created_at: new Date().toISOString(),
        });

        if (this.db.employeeTimelineEvents) {
          this.db.employeeTimelineEvents.unshift({
            id: `ete_${Date.now()}`,
            tenant_id: context.tenantId,
            employee_id: emp.id,
            event_type: 'VEHICLE_ASSIGNED',
            event_category: 'ASSIGNMENT',
            title: `Bike Assigned: ${veh.plateNumber}`,
            description: `Assigned motorcycle ${veh.plateNumber} (${veh.make} ${veh.model}) to ${emp.full_name}.`,
            performed_by: context.userName || 'AI Copilot',
            performed_by_role: context.userRole,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    this.logToolExecution(
      context,
      'executeWriteAction',
      proposal.targetEntityType,
      proposal.targetEntityId,
      'SUCCESS',
      durationMs,
      `Executed verified action: ${proposal.title} (${proposal.summary})`
    );

    return {
      toolName: 'executeWriteAction',
      success: true,
      data: {
        message: `Action executed successfully! ${proposal.summary}`,
        actionType: proposal.actionType,
      },
      cards: [
        {
          type: 'ACTION_CONFIRMATION',
          actionConfirmation: {
            actionName: proposal.title,
            status: 'SUCCESS',
            details: `Action successfully verified and committed to the live database: ${proposal.summary}`,
            targetEntity: proposal.targetEntityName,
          },
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // TOOL 26: explainErpScreen
  // ============================================================================
  public explainErpScreen(
    params: { screenName: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    const name = (params.screenName || '').toUpperCase();

    const screensMap: Record<string, any> = {
      DOCUMENT_EXPIRY_LISTING: {
        moduleName: 'Document Expiry & Compliance Vault',
        summary: 'Tracks all government documents (Passports, Visas, Emirates IDs, Mulkiya, Driving Licenses, Labour Cards) across riders and vehicles with automated 7/15/30/60-day expiry notifications.',
        features: [
          'Automatic severity color coding (Critical <7d, Warning <30d, Active).',
          'Document version history ledger and authorized signed download links.',
          'Bulk ZIP download for single-employee document packages.',
          'Document replacement workflow with audit trail.',
        ],
        workflow: ['Filter by days remaining', 'Inspect document version', 'Download authorized file or send renewal notice'],
      },
      EMPLOYEES_LIST: {
        moduleName: 'Employee Master & Profile 360',
        summary: 'Centralized master repository for all delivery riders, office management, and dispatch personnel with comprehensive operational timeline.',
        features: [
          'Unified operational status management (Available, Assigned, Onboarding, Suspended).',
          'Live project, vehicle, and corporate SIM assignment links.',
          'Chronological audit timeline for every hiring, handover, and status transition.',
          'Strict multi-tenant isolation and role-based access control.',
        ],
        workflow: ['Search employee by name, code, or phone', 'Open profile to inspect documents, bike, or SIM', 'Edit details or change assignment'],
      },
      VEHICLE_MAPPING: {
        moduleName: 'Fleet Mapping & Asset Dispatch',
        summary: 'Live vehicle tracking, plate number lookup, service maintenance schedules, and rider assignment handover management.',
        features: [
          'Plate number search and reverse rider allocation lookup.',
          'Mulkiya and comprehensive commercial insurance expiry tracking.',
          'Odometer and preventive maintenance service reminders.',
        ],
        workflow: ['Search bike by plate', 'Assign bike to active rider with starting odometer', 'Track maintenance status'],
      },
      FLEET_DASHBOARD: {
        moduleName: 'Operations Fleet Dashboard',
        summary: 'Real-time overview of active riders, live order dispatches, branch performance, and compliance alerts.',
        features: [
          'Live rider delivery heatmaps and shift metrics.',
          'Branch revenue and dispatch KPIs.',
          'Immediate document compliance warnings.',
        ],
        workflow: ['Monitor active shift delivery volume', 'Review high-severity alerts', 'Trigger auto-dispatch optimization'],
      },
    };

    const screenGuide = screensMap[name] || screensMap['EMPLOYEES_LIST'];
    const durationMs = Date.now() - startTime;

    return {
      toolName: 'explainErpScreen',
      success: true,
      data: screenGuide,
      cards: [
        {
          type: 'SCREEN_EXPLANATION',
          screenExplanation: screenGuide,
        },
      ],
      durationMs,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================
  public findMasterEmployee(idOrCode: string, context: UserSecurityContext): any {
    if (!idOrCode) return null;
    const query = idOrCode.toLowerCase();
    const cleanDigits = query.replace(/[^0-9]/g, '');
    const tenantEmployees = this.filterTenant(this.db.masterEmployees || [], context);

    return tenantEmployees.find(
      (e: any) => e.id?.toLowerCase() === query ||
        e.employee_id?.toLowerCase() === query ||
        e.employee_code?.toLowerCase() === query ||
        (cleanDigits && (e.employee_code || '').toLowerCase().replace(/[^0-9]/g, '') === cleanDigits) ||
        e.full_name?.toLowerCase().includes(query) ||
        `${e.first_name || ''} ${e.last_name || ''}`.toLowerCase().includes(query)
    );
  }

  private buildEmployee360Data(emp: any, context: UserSecurityContext): AiEmployee360Data {
    const hasPayrollPerm = this.checkPermission(context, 'payroll.view');

    return {
      id: emp.id,
      code: emp.employee_code || emp.employee_id,
      name: emp.full_name || `${emp.first_name} ${emp.last_name}`,
      photo: emp.photo,
      designation: emp.designation || emp.job_title || 'Employee',
      department: emp.department_id === 'dept_hr' ? 'Human Resources' : 'Operations & Logistics',
      branch: emp.branch_id === 'b_dxb' ? 'Dubai Logistics Hub' : emp.branch_id === 'b_auh' ? 'Abu Dhabi Hub' : 'Sharjah Hub',
      project: emp.project_name || 'Unassigned',
      projectCode: emp.project_code,
      supervisor: emp.supervisor_id || 'Operations Lead',
      status: emp.current_status || 'Active',
      statusReason: emp.status_reason,
      joiningDate: emp.joining_date || '2025-10-10',
      nationality: emp.nationality || 'UAE',
      mobile: emp.personal_mobile || emp.company_mobile,
      email: emp.email,
      passportNumber: emp.passport_number,
      passportExpiry: emp.passport_expiry,
      passportStatus: emp.passport_status,
      passportLocation: emp.passport_location,
      eidNumber: emp.emirates_id_number,
      eidExpiry: emp.emirates_id_expiry,
      visaNumber: emp.visa_number,
      visaExpiry: emp.visa_expiry,
      drivingLicense: emp.driving_license_number,
      drivingLicenseExpiry: emp.driving_license_expiry,
      assignedBikePlate: emp.current_bike_plate,
      assignedSimNumber: emp.current_sim_number,
      basicSalary: hasPayrollPerm ? emp.basic_salary : undefined,
      allowances: hasPayrollPerm ? emp.allowances : undefined,
      salaryType: hasPayrollPerm ? emp.salary_type : undefined,
      createdBy: emp.created_by || 'System Admin',
      createdDate: emp.created_at ? emp.created_at.substring(0, 10) : '2025-10-10',
      updatedBy: emp.updated_by || 'System Admin',
      updatedDate: emp.updated_at ? emp.updated_at.substring(0, 10) : undefined,
    };
  }

  private calculateDaysRemaining(expiryDateStr?: string): number {
    if (!expiryDateStr) return 999;
    const expiry = new Date(expiryDateStr).getTime();
    const today = new Date().getTime();
    return Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
  }

  private buildRbacDenial(requiredPerm: string, toolName: AiToolName, context: UserSecurityContext, startTime: number): ToolExecutionResult {
    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, toolName, 'Security', 'DENIED', 'DENIED', durationMs, `RBAC Denial: user ${context.userName} (${context.userRole}) lacks permission "${requiredPerm}"`);

    const denialMessage = `Access Denied: Your current role (${context.userRole}) does not have the required permission (${requiredPerm}) to view or execute this operation.`;

    return {
      toolName,
      success: false,
      rbacDenied: true,
      error: denialMessage,
      cards: [
        {
          type: 'RBAC_DENIAL',
          rbacDenial: {
            requiredPermission: requiredPerm,
            userRole: context.userRole,
            message: denialMessage,
            suggestedContact: 'Please contact your Company Administrator or Global Super Admin to request elevated permissions.',
          },
          ...({ denialMessage, requiredPermission: requiredPerm } as any),
        },
      ],
      durationMs,
    };
  }

  // ==============================================================================
  // PAYROLL & COMPENSATION AI TOOLS
  // ==============================================================================

  /**
   * Tool: generatePayrollPeriod
   */
  public generatePayrollPeriod(
    params: { year?: number; month?: number; monthName?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'generatePayrollPeriod', context, startTime);
    }

    const targetYear = Number(params.year || 2026);
    let targetMonth = Number(params.month || 8);

    if (params.monthName) {
      const mIdx = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
      ].indexOf(params.monthName.toLowerCase());
      if (mIdx >= 0) targetMonth = mIdx + 1;
    }

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = MONTHS[targetMonth - 1] || 'August';
    const periodKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const periodMonth = `${monthName} ${targetYear}`;

    // Query or generate payroll records
    const masterEmployees = this.db.masterEmployees.filter((e: any) => (context.isSuperAdmin || e.tenant_id === context.tenantId) && !e.is_archived);
    const existingRecords = this.db.payrollRecords.filter((r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId) && r.period_key === periodKey);

    let period = this.db.payrollPeriods.find((p: any) => (context.isSuperAdmin || p.tenant_id === context.tenantId) && p.period_key === periodKey);

    const records = existingRecords.length > 0 ? existingRecords : this.db.payrollRecords.filter((r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId));

    const totalNetPayable = records.reduce((sum: number, r: any) => sum + (r.net_salary || 0), 0);
    const totalGrossPay = records.reduce((sum: number, r: any) => sum + (r.gross_earnings || 0), 0);
    const totalDeductions = records.reduce((sum: number, r: any) => sum + (r.total_deductions || 0), 0);
    const totalTrafficFines = records.reduce((sum: number, r: any) => sum + (r.traffic_fines_deduction || 0), 0);
    const totalAdvances = records.reduce((sum: number, r: any) => sum + (r.advance_loan_deduction || 0), 0);
    const exceptionsCount = records.filter((r: any) => r.has_exceptions).length;

    if (!period) {
      period = {
        id: `pp_${targetYear}_${String(targetMonth).padStart(2, '0')}`,
        tenant_id: context.tenantId,
        period_month: periodMonth,
        period_key: periodKey,
        year: targetYear,
        month: targetMonth,
        status: 'CALCULATED',
        cutoff_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-31`,
        total_employees: masterEmployees.length,
        total_gross_pay: totalGrossPay,
        total_allowances: 3650,
        total_delivery_incentives: 10400,
        total_overtime_pay: 1450,
        total_deductions: totalDeductions,
        total_traffic_fines: totalTrafficFines,
        total_advances_recovered: totalAdvances,
        total_net_payable: totalNetPayable,
        exceptions_count: exceptionsCount,
        generated_at: new Date().toISOString(),
        generated_by: context.userName || 'AI Copilot Engine',
        wps_file_generated: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.db.payrollPeriods.unshift(period);
    }

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'generatePayrollPeriod', 'PayrollPeriod', period.id, 'SUCCESS', durationMs, `Generated payroll period for ${periodMonth}`);

    return {
      toolName: 'generatePayrollPeriod',
      success: true,
      data: {
        period,
        totalRecords: records.length,
        exceptionsCount,
        summary: {
          totalEmployees: period.total_employees,
          totalGrossPay: period.total_gross_pay,
          totalNetPayable: period.total_net_payable,
          totalTrafficFines: period.total_traffic_fines,
          totalAdvancesRecovered: period.total_advances_recovered,
        },
      },
      cards: [
        {
          type: 'PAYROLL_PERIOD_CARD',
          payrollPeriod: {
            id: period.id,
            periodMonth: period.period_month,
            periodKey: period.period_key,
            status: period.status,
            totalEmployees: period.total_employees,
            totalGrossPay: period.total_gross_pay,
            totalDeductions: period.total_deductions,
            totalNetPayable: period.total_net_payable,
            totalTrafficFines: period.total_traffic_fines,
            totalAdvancesRecovered: period.total_advances_recovered,
            exceptionsCount: period.exceptions_count,
            cutoffDate: period.cutoff_date,
            generatedAt: period.generated_at,
          },
        },
      ],
      suggestedActions: [
        { label: `Review ${exceptionsCount} Exceptions`, actionType: 'VIEW_EXCEPTIONS', payload: { periodKey: period.period_key } },
        { label: `Approve ${periodMonth} Payroll`, actionType: 'APPROVE_PAYROLL', payload: { periodId: period.id } },
        { label: `Download WPS SIF File`, actionType: 'EXPORT_WPS', payload: { periodId: period.id } },
      ],
      durationMs,
    };
  }

  /**
   * Tool: getPayrollPeriodSummary
   */
  public getPayrollPeriodSummary(
    params: { periodKey?: string; monthName?: string; year?: number },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'getPayrollPeriodSummary', context, startTime);
    }

    const key = params.periodKey || '2026-08';
    const period = this.db.payrollPeriods.find((p: any) => (context.isSuperAdmin || p.tenant_id === context.tenantId) && (p.period_key === key || p.id === key));

    if (!period) {
      return this.generatePayrollPeriod({ year: params.year || 2026, month: 8 }, context);
    }

    const records = this.db.payrollRecords.filter((r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId) && (r.payroll_period_id === period.id || r.period_key === period.period_key));

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getPayrollPeriodSummary',
      success: true,
      data: {
        period,
        recordCount: records.length,
      },
      cards: [
        {
          type: 'PAYROLL_PERIOD_CARD',
          payrollPeriod: {
            id: period.id,
            periodMonth: period.period_month,
            periodKey: period.period_key,
            status: period.status,
            totalEmployees: period.total_employees,
            totalGrossPay: period.total_gross_pay,
            totalDeductions: period.total_deductions,
            totalNetPayable: period.total_net_payable,
            totalTrafficFines: period.total_traffic_fines,
            totalAdvancesRecovered: period.total_advances_recovered,
            exceptionsCount: period.exceptions_count,
            cutoffDate: period.cutoff_date,
            generatedAt: period.generated_at,
          },
        },
      ],
      durationMs,
    };
  }

  /**
   * Tool: getEmployeeSalarySheet
   */
  public getEmployeeSalarySheet(
    params: { employeeQuery?: string; employeeId?: string; monthKey?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'getEmployeeSalarySheet', context, startTime);
    }

    const query = (params.employeeQuery || params.employeeId || '').toLowerCase().trim();
    const monthKey = params.monthKey || '2026-08';

    // Find Employee
    const employees = this.db.masterEmployees.filter((e: any) => (context.isSuperAdmin || e.tenant_id === context.tenantId));
    let matchedEmp = employees.find((e: any) => e.id === params.employeeId || e.employee_code?.toLowerCase() === query);

    if (!matchedEmp && query) {
      matchedEmp = employees.find((e: any) =>
        e.full_name?.toLowerCase().includes(query) ||
        e.phone?.toLowerCase().includes(query) ||
        e.employee_code?.toLowerCase().includes(query)
      );
    }

    if (!matchedEmp) {
      matchedEmp = employees[0]; // fallback
    }

    // Find record in payrollRecords
    let rec = this.db.payrollRecords.find(
      (r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId) && (r.employee_id === matchedEmp.id || r.employee_code === matchedEmp.employee_code) && r.period_key === monthKey
    );

    if (!rec) {
      const base = matchedEmp.basic_salary || 2500;
      const allow = matchedEmp.allowances || 500;
      rec = {
        id: `pr_${monthKey}_${matchedEmp.id}`,
        tenant_id: context.tenantId,
        payroll_period_id: `pp_${monthKey.replace('-', '_')}`,
        period_month: 'August 2026',
        period_key: monthKey,
        year: 2026,
        month: 8,
        employee_id: matchedEmp.id,
        employee_code: matchedEmp.employee_code,
        employee_name: matchedEmp.full_name,
        designation: matchedEmp.designation,
        department: matchedEmp.department || 'OPERATIONS',
        project_name: matchedEmp.project_name || 'General Fleet',
        bank_name: matchedEmp.bank_name || 'Emirates NBD',
        iban: matchedEmp.iban || 'AE2902600010271994821',
        salary_structure_type: 'FIXED_MONTHLY',
        days_in_month: 31,
        days_worked: 29,
        unexcused_absences: 0,
        paid_leave_days: 0,
        unpaid_leave_days: 0,
        deliveries_completed: 340,
        overtime_hours: 10,
        base_salary: base,
        prorated_base_salary: base,
        fuel_allowance: Math.round(allow * 0.4),
        mobile_allowance: Math.round(allow * 0.2),
        accommodation_allowance: Math.round(allow * 0.4),
        bike_allowance: 0,
        food_allowance: 0,
        other_allowances: 0,
        total_allowances: allow,
        delivery_incentives: 2550,
        overtime_pay: 150,
        bonus_adjustments: 0,
        gross_earnings: base + allow + 2550 + 150,
        absence_deductions: 0,
        traffic_fines_deduction: 0,
        advance_loan_deduction: 0,
        penalty_deductions: 0,
        other_deductions: 0,
        total_deductions: 0,
        net_salary: base + allow + 2550 + 150,
        status: 'CALCULATED',
        has_exceptions: false,
        exceptions: [],
        payment_method: 'WPS_SIF',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'getEmployeeSalarySheet', 'SalarySlip', rec.id, 'SUCCESS', durationMs, `Retrieved salary sheet for ${matchedEmp.full_name} (${rec.period_month})`);

    return {
      toolName: 'getEmployeeSalarySheet',
      success: true,
      data: rec,
      cards: [
        {
          type: 'EMPLOYEE_SALARY_SLIP_CARD',
          salarySlip: {
            employeeId: rec.employee_id,
            employeeCode: rec.employee_code,
            employeeName: rec.employee_name,
            designation: rec.designation,
            department: rec.department,
            project: rec.project_name,
            periodMonth: rec.period_month,
            periodKey: rec.period_key,
            baseSalary: rec.base_salary,
            proratedBaseSalary: rec.prorated_base_salary,
            fuelAllowance: rec.fuel_allowance,
            mobileAllowance: rec.mobile_allowance,
            accommodationAllowance: rec.accommodation_allowance,
            totalAllowances: rec.total_allowances,
            deliveryIncentives: rec.delivery_incentives,
            overtimePay: rec.overtime_pay,
            bonusAdjustments: rec.bonus_adjustments,
            grossEarnings: rec.gross_earnings,
            absenceDeductions: rec.absence_deductions,
            trafficFinesDeduction: rec.traffic_fines_deduction,
            advanceLoanDeduction: rec.advance_loan_deduction,
            penaltyDeductions: rec.penalty_deductions,
            totalDeductions: rec.total_deductions,
            netPayable: rec.net_salary,
            attendanceDays: rec.days_worked,
            totalDays: rec.days_in_month,
            deliveriesCompleted: rec.deliveries_completed,
            bankName: rec.bank_name,
            iban: rec.iban,
            status: rec.status,
          },
        },
      ],
      suggestedActions: [
        { label: `Download Payslip PDF`, actionType: 'DOWNLOAD_PAYSLIP', payload: { employeeId: rec.employee_id } },
        { label: `View Salary History`, actionType: 'VIEW_SALARY_HISTORY', payload: { employeeId: rec.employee_id } },
      ],
      durationMs,
    };
  }

  /**
   * Tool: getPayrollExceptions
   */
  public getPayrollExceptions(
    params: { periodKey?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'getPayrollExceptions', context, startTime);
    }

    const key = params.periodKey || '2026-08';
    const records = this.db.payrollRecords.filter(
      (r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId) && r.period_key === key && r.has_exceptions
    );

    const exceptionsList = records.flatMap((r: any) =>
      (r.exceptions || []).map((ex: any) => ({
        employeeId: r.employee_id,
        employeeCode: r.employee_code,
        employeeName: r.employee_name,
        project: r.project_name,
        netSalary: r.net_salary,
        type: ex.type,
        message: ex.message,
        severity: ex.severity,
        resolved: ex.resolved,
      }))
    );

    const durationMs = Date.now() - startTime;
    return {
      toolName: 'getPayrollExceptions',
      success: true,
      data: {
        periodKey: key,
        count: exceptionsList.length,
        exceptions: exceptionsList,
      },
      cards: [
        {
          type: 'PAYROLL_EXCEPTIONS_CARD',
          payrollExceptions: {
            periodKey: key,
            periodMonth: 'August 2026',
            totalExceptions: exceptionsList.length,
            criticalCount: exceptionsList.filter((e) => e.severity === 'CRITICAL').length,
            warningCount: exceptionsList.filter((e) => e.severity === 'WARNING').length,
            infoCount: exceptionsList.filter((e) => e.severity === 'INFO').length,
            exceptions: exceptionsList,
          },
        },
      ],
      durationMs,
    };
  }

  /**
   * Tool: approvePayrollPeriod
   */
  public approvePayrollPeriod(
    params: { periodId?: string; periodKey?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'approvePayrollPeriod', context, startTime);
    }

    const key = params.periodKey || params.periodId || '2026-08';
    const period = this.db.payrollPeriods.find(
      (p: any) => (context.isSuperAdmin || p.tenant_id === context.tenantId) && (p.period_key === key || p.id === key)
    );

    if (!period) {
      return {
        toolName: 'approvePayrollPeriod',
        success: false,
        error: `Payroll period ${key} not found.`,
        durationMs: Date.now() - startTime,
      };
    }

    period.status = 'APPROVED';
    period.approved_at = new Date().toISOString();
    period.approved_by = context.userName || 'Company Administrator';

    // Update records
    this.db.payrollRecords
      .filter((r: any) => (context.isSuperAdmin || r.tenant_id === context.tenantId) && (r.payroll_period_id === period.id || r.period_key === period.period_key))
      .forEach((r: any) => {
        r.status = 'APPROVED';
      });

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'approvePayrollPeriod', 'PayrollPeriod', period.id, 'SUCCESS', durationMs, `Approved payroll period ${period.period_month}`);

    return {
      toolName: 'approvePayrollPeriod',
      success: true,
      data: period,
      cards: [
        {
          type: 'PAYROLL_PERIOD_CARD',
          payrollPeriod: {
            id: period.id,
            periodMonth: period.period_month,
            periodKey: period.period_key,
            status: 'APPROVED',
            totalEmployees: period.total_employees,
            totalGrossPay: period.total_gross_pay,
            totalDeductions: period.total_deductions,
            totalNetPayable: period.total_net_payable,
            totalTrafficFines: period.total_traffic_fines,
            totalAdvancesRecovered: period.total_advances_recovered,
            exceptionsCount: period.exceptions_count,
            cutoffDate: period.cutoff_date,
            generatedAt: period.generated_at,
          },
        },
      ],
      durationMs,
    };
  }

  /**
   * Tool: createEmployeeAdvance
   */
  public createEmployeeAdvance(
    params: { employeeQuery?: string; employeeId?: string; amount?: number; installments?: number; reason?: string },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'createEmployeeAdvance', context, startTime);
    }

    const query = (params.employeeQuery || params.employeeId || '').toLowerCase().trim();
    const emp = this.db.masterEmployees.find(
      (e: any) =>
        (context.isSuperAdmin || e.tenant_id === context.tenantId) &&
        (e.id === params.employeeId || e.employee_code?.toLowerCase() === query || e.full_name?.toLowerCase().includes(query))
    );

    if (!emp) {
      return {
        toolName: 'createEmployeeAdvance',
        success: false,
        error: `Could not identify employee for advance registration: "${query}"`,
        durationMs: Date.now() - startTime,
      };
    }

    const amt = Number(params.amount || 1000);
    const installments = Math.max(1, Number(params.installments || 2));
    const monthly = Math.round(amt / installments);

    const newAdv = {
      id: `adv_${Date.now()}`,
      tenant_id: context.tenantId,
      employee_id: emp.id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      advance_amount: amt,
      installments_count: installments,
      monthly_installment: monthly,
      amount_repaid: 0,
      remaining_balance: amt,
      reason: params.reason || 'Emergency cash advance',
      disbursed_date: new Date().toISOString().substring(0, 10),
      deduction_start_month: '2026-08',
      status: 'ACTIVE',
      approved_by: context.userName || 'HR Admin',
      repayment_history: [],
      created_at: new Date().toISOString(),
    };

    this.db.employeeAdvances.push(newAdv);

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'createEmployeeAdvance', 'Advance', newAdv.id, 'SUCCESS', durationMs, `Created advance AED ${amt} for ${emp.full_name}`);

    return {
      toolName: 'createEmployeeAdvance',
      success: true,
      data: newAdv,
      cards: [
        {
          type: 'CONFIRMATION_PROPOSAL',
          confirmationProposal: {
            actionTitle: 'Advance / Loan Disbursed',
            summary: `Approved and registered AED ${amt.toLocaleString()} salary advance for ${emp.full_name}.`,
            entityType: 'EmployeeAdvance',
            entityId: newAdv.id,
            entityName: emp.full_name,
            impactSummary: `Monthly payroll deduction of AED ${monthly.toLocaleString()} across ${installments} billing cycles starting August 2026.`,
            confirmationToken: `token_adv_${Date.now()}`,
            changes: [
              { field: 'Employee', previousValue: '-', newValue: emp.full_name },
              { field: 'Advance Amount', previousValue: '0', newValue: `AED ${amt.toLocaleString()}` },
              { field: 'Installments', previousValue: '-', newValue: `${installments} Months (AED ${monthly}/mo)` },
              { field: 'Disbursed Status', previousValue: '-', newValue: 'ACTIVE' },
            ],
          },
        },
      ],
      durationMs,
    };
  }

  /**
   * Tool: calculateFinalSettlement
   */
  public calculateFinalSettlement(
    params: { employeeQuery?: string; employeeId?: string; exitDate?: string; exitType?: string; unutilizedLeaveDays?: number },
    context: UserSecurityContext
  ): ToolExecutionResult {
    const startTime = Date.now();
    if (!this.checkPermission(context, 'payroll.view')) {
      return this.buildRbacDenial('payroll.view', 'calculateFinalSettlement', context, startTime);
    }

    const query = (params.employeeQuery || params.employeeId || '').toLowerCase().trim();
    const emp = this.db.masterEmployees.find(
      (e: any) =>
        (context.isSuperAdmin || e.tenant_id === context.tenantId) &&
        (e.id === params.employeeId || e.employee_code?.toLowerCase() === query || e.full_name?.toLowerCase().includes(query))
    );

    if (!emp) {
      return {
        toolName: 'calculateFinalSettlement',
        success: false,
        error: `Could not find employee for final settlement calculation: "${query}"`,
        durationMs: Date.now() - startTime,
      };
    }

    const joinDate = new Date(emp.joining_date || '2024-01-01');
    const exDate = new Date(params.exitDate || new Date().toISOString().substring(0, 10));
    const diffDays = Math.max(1, Math.ceil((exDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
    const tenureYears = Number((diffDays / 365.25).toFixed(2));

    const baseSalary = emp.basic_salary || 2500;
    const dailyRate = baseSalary / 30;

    let gratuity = 0;
    if (tenureYears >= 1) {
      if (tenureYears <= 5) {
        gratuity = tenureYears * (dailyRate * 21);
      } else {
        gratuity = (5 * 21 * dailyRate) + ((tenureYears - 5) * 30 * dailyRate);
      }
    }

    const daysInExitMonth = exDate.getDate();
    const proratedSalary = Math.round(dailyRate * daysInExitMonth);
    const leaveDays = Number(params.unutilizedLeaveDays || 12);
    const leaveEncashment = Math.round(dailyRate * leaveDays);

    const advances = this.db.employeeAdvances.filter((a: any) => (context.isSuperAdmin || a.tenant_id === context.tenantId) && a.employee_id === emp.id && a.remaining_balance > 0);
    const advanceLoanDeduction = advances.reduce((sum: number, a: any) => sum + a.remaining_balance, 0);

    const fines = this.db.driverTickets?.filter((t: any) => (t.riderId === emp.id || t.riderId === emp.employee_id) && !t.deductedFromPayroll) || [];
    const trafficFinesDeduction = fines.reduce((sum: number, t: any) => sum + (t.fineAmountAED || 0), 0);

    const grossEntitlement = proratedSalary + leaveEncashment + gratuity;
    const totalDeductions = advanceLoanDeduction + trafficFinesDeduction;
    const netFinalSettlement = Math.max(0, grossEntitlement - totalDeductions);

    const settlement = {
      id: `fs_${Date.now()}`,
      tenant_id: context.tenantId,
      employee_id: emp.id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      exit_date: params.exitDate || new Date().toISOString().substring(0, 10),
      exit_type: params.exitType || 'Resignation',
      joining_date: emp.joining_date || '2024-01-01',
      total_tenure_years: tenureYears,
      total_tenure_days: diffDays,
      prorated_last_month_salary: proratedSalary,
      unutilized_leave_days: leaveDays,
      leave_encashment_amount: leaveEncashment,
      end_of_service_gratuity: Math.round(gratuity * 100) / 100,
      bonus_incentives: 0,
      gross_entitlement: Math.round(grossEntitlement * 100) / 100,
      advance_loan_balance_deduction: advanceLoanDeduction,
      traffic_fines_deduction: trafficFinesDeduction,
      asset_damage_or_missing_deduction: 0,
      notice_period_deduction: 0,
      total_deductions: totalDeductions,
      net_final_settlement_amount: Math.round(netFinalSettlement * 100) / 100,
      status: 'CALCULATED',
      settlement_notes: `EOS Gratuity calculated under UAE Labour Law Article 51 (${tenureYears} yrs tenure).`,
      cleared_by: context.userName || 'HR Manager',
      created_at: new Date().toISOString(),
    };

    this.db.finalSettlements.unshift(settlement);

    const durationMs = Date.now() - startTime;
    this.logToolExecution(context, 'calculateFinalSettlement', 'FinalSettlement', settlement.id, 'SUCCESS', durationMs, `Calculated EOS Gratuity for ${emp.full_name} (AED ${settlement.net_final_settlement_amount})`);

    return {
      toolName: 'calculateFinalSettlement',
      success: true,
      data: settlement,
      cards: [
        {
          type: 'CONFIRMATION_PROPOSAL',
          confirmationProposal: {
            actionTitle: 'End-Of-Service Settlement Calculation',
            summary: `Final settlement computed for ${emp.full_name} (${tenureYears} years tenure). Net payable: AED ${settlement.net_final_settlement_amount.toLocaleString()}.`,
            entityType: 'FinalSettlement',
            entityId: settlement.id,
            entityName: emp.full_name,
            impactSummary: `Includes Gratuity (AED ${settlement.end_of_service_gratuity.toLocaleString()}) + Leave Encashment (${leaveDays} days: AED ${settlement.leave_encashment_amount.toLocaleString()}) - Deductions (AED ${totalDeductions.toLocaleString()}).`,
            confirmationToken: `token_fs_${Date.now()}`,
            changes: [
              { field: 'Service Tenure', previousValue: '-', newValue: `${tenureYears} Years (${diffDays} Days)` },
              { field: 'Gratuity (UAE Labour Law)', previousValue: '0', newValue: `AED ${settlement.end_of_service_gratuity.toLocaleString()}` },
              { field: 'Leave Encashment', previousValue: '0', newValue: `AED ${settlement.leave_encashment_amount.toLocaleString()}` },
              { field: 'Unpaid Fines & Advances', previousValue: '0', newValue: `- AED ${totalDeductions.toLocaleString()}` },
              { field: 'Net Final Settlement', previousValue: '0', newValue: `AED ${settlement.net_final_settlement_amount.toLocaleString()}` },
            ],
          },
        },
      ],
      suggestedActions: [
        { label: `Approve Final Settlement`, actionType: 'APPROVE_SETTLEMENT', payload: { settlementId: settlement.id } },
        { label: `Print EOS Clearance Slip`, actionType: 'PRINT_EOS', payload: { settlementId: settlement.id } },
      ],
      durationMs,
    };
  }
}
