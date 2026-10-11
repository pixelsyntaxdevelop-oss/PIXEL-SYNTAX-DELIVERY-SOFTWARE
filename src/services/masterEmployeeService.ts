/**
 * Master Employee & Asset Assignment Service
 * Complete 360-degree operational profile and asset assignment lifecycle
 * Enforces Multi-Tenant PostgreSQL/Supabase isolation
 */

import { apiClient } from './apiClient';
import {
  AUTHORITATIVE_BRANCHES,
  AUTHORITATIVE_CONTRACT_CATEGORIES,
  AUTHORITATIVE_VISA_CONTRACTOR_TYPES,
} from '../lib/branches';
import {
  DbEmployeeMaster,
  DbEmployeeStatusHistory,
  DbEmployeeProjectAssignment,
  DbVehicleAssignment,
  DbSimAssignment,
  DbAssetAssignment,
  DbEmployeeTimelineEvent,
  DbProject,
  DbVehicle,
  DbSimCardMaster,
  DbAsset,
  DbBranch,
  DbDepartment,
  DbShift,
  DbDesignation,
  DbContractCategory,
  DbTeamMaster,
  DbManagerLookup,
  DbVisaContractorType,
  DbVendorCompany,
  DbEmployeeVisaContractorHistory,
} from '../types/database';

export interface AuthoritativeAssignmentEmployeeCandidate {
  id: string;
  full_name: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  employee_code: string;
  emirates_id: string;
  emirates_id_number?: string;
  mobile_number: string;
  personal_mobile?: string;
  company_mobile?: string;
  phone?: string;
  current_status: string;
  status?: string;
  has_active_sim?: boolean;
  current_sim_id?: string | null;
  current_sim_number?: string | null;
  current_sim_provider?: string | null;
  current_sim_iccid?: string | null;
  current_sim_assigned_date?: string | null;
  current_sim_assigned_by?: string | null;
  current_bike_plate?: string | null;
  current_bike_id?: string | null;
  primary_project?: string;
  project_name?: string;
  current_project_name?: string;
  visa_contractor_type?: string;
  branch_name?: string;
  designation?: string;
}

export interface Employee360Profile {
  employee: DbEmployeeMaster;
  currentProject?: DbProject | null;
  currentVehicle?: DbVehicle | null;
  currentSim?: DbSimCardMaster | null;
  activeAssets: DbAssetAssignment[];
  statusHistory: DbEmployeeStatusHistory[];
  visaContractorHistory?: DbEmployeeVisaContractorHistory[];
  projectHistory: DbEmployeeProjectAssignment[];
  activeProjects?: DbEmployeeProjectAssignment[];
  endedProjects?: DbEmployeeProjectAssignment[];
  vehicleHistory: DbVehicleAssignment[];
  simHistory: DbSimAssignment[];
  assetHistory: DbAssetAssignment[];
  timeline: DbEmployeeTimelineEvent[];
  passportCustody?: {
    id?: string;
    serial_number?: string;
    employee_id?: string;
    employee_code?: string;
    employee_name?: string;
    passport_number?: string;
    status?: string;
    custody_status?: string;
    received_date?: string;
    receive_date?: string;
    release_date?: string;
    return_date?: string;
    return_reason?: string;
    safe_location?: string;
    current_location?: string;
    locker_number?: string;
    box_number?: string;
    handler_name?: string;
    current_handler?: string;
    handler_designation?: string;
    release_reason?: string;
    notes?: string;
    history?: any[];
    [key: string]: any;
  } | null;
  passportHistory?: any[];
  currentBuildingAssignment?: any;
  buildingHistory?: any[];
}

import {
  resolveEmployeeRecordStatus,
  resolveCanonicalStatus,
} from '../utils/canonicalStatus';

export interface EmployeeStatsResponse {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  statusCounts: {
    assignedActive: number;
    availableUnassigned: number;
    onLeave: number;
    emergencyLeave?: number;
    onHold: number;
    absconding: number;
    terminated: number;
    exited: number;
    [key: string]: any;
  };
  categoryCounts: Array<{
    category: string;
    total: number;
    active: number;
    inactive: number;
  }>;
  projectCounts?: Record<string, number>;
}

export interface PaginatedEmployeesResponse {
  records: DbEmployeeMaster[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts?: Record<string, number>;
  projectCounts?: Record<string, number>;
}

export interface MasterEmployeeFilters {
  branch?: string;
  status?: string;
  project?: string;
  contractor?: string;
  enabled?: string;
  search?: string;
  reason?: string;
  page?: number;
  pageSize?: number;
}

class MasterEmployeeService {
  /**
   * Fast server-side employee search across Name, Code, Emirates ID, Passport, Mobile
   */
  public async searchEmployees(query: string): Promise<DbEmployeeMaster[]> {
    if (!query || query.trim().length === 0) return [];
    const res = await this.getMasterEmployeesPaginated({ search: query.trim(), pageSize: 15 });
    return res.records || [];
  }

  /**
   * Get all master employee records with optional filters
   */
  public async getMasterEmployees(filters?: MasterEmployeeFilters): Promise<DbEmployeeMaster[]> {
    const params = new URLSearchParams();
    if (filters?.branch && filters.branch !== 'All Branches' && filters.branch !== 'ALL') params.append('branch', filters.branch);
    if (filters?.status && filters.status !== 'All Status' && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.project && filters.project !== 'All Projects' && filters.project !== 'ALL') params.append('project', filters.project);
    if (filters?.contractor && filters.contractor !== 'All Categories' && filters.contractor !== 'ALL') params.append('contractor', filters.contractor);
    if (filters?.enabled && filters.enabled !== 'ALL') params.append('enabled', filters.enabled);
    if (filters?.reason && filters.reason !== 'All Reasons') params.append('reason', filters.reason);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<DbEmployeeMaster[]>(`/api/erp/master-employees${query}`);
    return res.data || [];
  }

  /**
   * Get paginated master employee records with server-side pagination and filters
   */
  public async getMasterEmployeesPaginated(filters?: MasterEmployeeFilters): Promise<PaginatedEmployeesResponse> {
    const params = new URLSearchParams();
    params.append('paginated', 'true');
    params.append('page', String(filters?.page || 1));
    params.append('pageSize', String(filters?.pageSize || 25));

    if (filters?.branch && filters.branch !== 'All Branches' && filters.branch !== 'ALL') params.append('branch', filters.branch);
    if (filters?.status && filters.status !== 'All Status' && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters?.project && filters.project !== 'All Projects' && filters.project !== 'ALL') params.append('project', filters.project);
    if (filters?.contractor && filters.contractor !== 'All Categories' && filters.contractor !== 'ALL') params.append('contractor', filters.contractor);
    if (filters?.enabled && filters.enabled !== 'ALL') params.append('enabled', filters.enabled);
    if (filters?.search) params.append('search', filters.search);

    const res = await apiClient.get<PaginatedEmployeesResponse>(`/api/erp/master-employees?${params.toString()}`);
    if (res.data && res.data.records) {
      const records = res.data.records.map((emp) => ({
        ...emp,
        current_status: resolveEmployeeRecordStatus(emp),
      }));
      return {
        ...res.data,
        records,
      };
    }
    return {
      records: [],
      total: 0,
      page: filters?.page || 1,
      pageSize: filters?.pageSize || 25,
      totalPages: 1,
    };
  }

  /**
   * Get real live operational KPI counts and status/category summaries
   */
  public async getEmployeeStats(): Promise<EmployeeStatsResponse> {
    const res = await apiClient.get<any>('/api/erp/master-employees/stats');
    if (res.data) {
      const data = res.data;
      const sc = data.statusCounts || {};
      const assignedActive = sc['Assigned / Active'] ?? sc.assignedActive ?? data.assignedActive ?? 0;
      const availableUnassigned = sc['Available / Unassigned'] ?? sc.availableUnassigned ?? data.availableUnassigned ?? 0;
      const onLeave = sc['On Leave'] ?? sc.onLeave ?? data.onLeave ?? 0;
      const emergencyLeave = sc['Emergency Leave'] ?? sc.emergencyLeave ?? data.emergencyLeave ?? 0;
      const onHold = sc['On Hold'] ?? sc.onHold ?? data.onHold ?? 0;
      const absconding = sc['Absconding'] ?? sc.absconding ?? data.absconding ?? 0;
      const terminated = sc['Terminated'] ?? sc.terminated ?? data.terminated ?? 0;
      const exited = sc['Exited'] ?? sc.exited ?? data.exited ?? 0;

      const totalEmployees = assignedActive + availableUnassigned + onLeave + emergencyLeave + onHold + absconding + terminated + exited;

      return {
        totalEmployees: totalEmployees || data.totalEmployees || 0,
        activeEmployees: assignedActive,
        inactiveEmployees: onLeave + emergencyLeave + onHold + absconding + terminated + exited,
        statusCounts: {
          ...sc,
          assignedActive,
          availableUnassigned,
          onLeave,
          emergencyLeave,
          onHold,
          absconding,
          terminated,
          exited,
          'Assigned / Active': assignedActive,
          'Available / Unassigned': availableUnassigned,
          'On Leave': onLeave,
          'Emergency Leave': emergencyLeave,
          'On Hold': onHold,
          'Absconding': absconding,
          'Terminated': terminated,
          'Exited': exited,
        },
        categoryCounts: data.categoryCounts || [],
        projectCounts: data.projectCounts || {},
      };
    }
    return {
      totalEmployees: 0,
      activeEmployees: 0,
      inactiveEmployees: 0,
      statusCounts: {
        assignedActive: 0,
        availableUnassigned: 0,
        onLeave: 0,
        emergencyLeave: 0,
        onHold: 0,
        absconding: 0,
        terminated: 0,
        exited: 0,
        'Assigned / Active': 0,
        'Available / Unassigned': 0,
        'On Leave': 0,
        'Emergency Leave': 0,
        'On Hold': 0,
        'Absconding': 0,
        'Terminated': 0,
        'Exited': 0,
      },
      categoryCounts: [],
      projectCounts: {},
    };
  }

  /**
   * Validate uniqueness of Emirates ID & Employee Code
   */
  public async validateUnique(params: {
    emiratesId?: string;
    employeeCode?: string;
    excludeId?: string;
    excludeEmployeeId?: string;
  }): Promise<{
    emiratesIdValid: boolean;
    emiratesIdConflict: { id: string; fullName: string; employeeCode: string; emiratesId: string } | null;
    employeeCodeValid: boolean;
    employeeCodeConflict: { id: string; fullName: string; employeeCode: string } | null;
  }> {
    const q = new URLSearchParams();
    if (params.emiratesId) q.append('emiratesId', params.emiratesId);
    if (params.employeeCode) q.append('employeeCode', params.employeeCode);
    const exclude = params.excludeId || params.excludeEmployeeId;
    if (exclude) q.append('excludeId', exclude);

    const res = await apiClient.get<any>(`/api/erp/master-employees/validate-unique?${q.toString()}`);
    return res.data || {
      emiratesIdValid: true,
      emiratesIdConflict: null,
      employeeCodeValid: true,
      employeeCodeConflict: null,
    };
  }

  /**
   * Bulk Update Branch
   */
  public async bulkUpdateBranch(employeeIds: string[], branchId: string, branchName?: string): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const res = await apiClient.post<any>('/api/erp/master-employees/bulk-update-branch', {
      employeeIds,
      branchId,
      branchName,
    });
    if (res.data?.success) {
      return { success: true, updatedCount: res.data.updatedCount };
    }
    return { success: false, updatedCount: 0, error: res.error || 'Failed to bulk update branch' };
  }

  /**
   * Bulk Update Contract / Visa Category
   */
  public async bulkUpdateContractor(
    employeeIds: string[],
    contractorOrVisaType: string,
    vendorId?: string,
    vendorName?: string
  ): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const res = await apiClient.post<any>('/api/erp/master-employees/bulk-update-contractor', {
      employeeIds,
      visaContractorType: contractorOrVisaType,
      vendorId,
      vendorName,
    });
    if (res.data?.success) {
      return { success: true, updatedCount: res.data.updatedCount };
    }
    return { success: false, updatedCount: 0, error: res.error || 'Failed to bulk update category' };
  }

  /**
   * Bulk Update Project
   */
  public async bulkUpdateProject(employeeIds: string[], projectId: string): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const res = await apiClient.post<any>('/api/erp/master-employees/bulk-update-project', {
      employeeIds,
      projectId,
    });
    if (res.data?.success) {
      return { success: true, updatedCount: res.data.updatedCount };
    }
    return { success: false, updatedCount: 0, error: res.error || 'Failed to bulk update project' };
  }

  /**
   * Bulk Import Employees with Duplicate Validation
   */
  public async bulkImportEmployees(employees: any[]): Promise<{
    success: boolean;
    totalSubmitted: number;
    importedCount: number;
    skippedCount: number;
    imported: any[];
    skipped: any[];
    error?: string;
  }> {
    const sanitizedEmployees = (employees || []).map((emp) => {
      const clean = { ...emp };
      delete clean.branch_name;
      delete clean.branchName;
      delete clean.department_name;
      delete clean.departmentName;
      delete clean.manager_name;
      delete clean.shift_name;
      delete clean.team_name;
      delete clean.project_name;
      return clean;
    });

    const res = await apiClient.post<any>('/api/erp/master-employees/bulk-import', { employees: sanitizedEmployees });
    if (res.data?.success) {
      return res.data;
    }
    return {
      success: false,
      totalSubmitted: employees.length,
      importedCount: res.data?.importedCount || 0,
      skippedCount: res.data?.skippedCount || employees.length,
      imported: res.data?.imported || [],
      skipped: res.data?.skipped || [],
      error: res.data?.error || res.error || 'Bulk import failed',
    };
  }

  /**
   * Search master employees by query (Name, Employee ID, Unique ID, Phone, Passport, Bike Plate)
   */
  public async searchMasterEmployees(query: string): Promise<DbEmployeeMaster[]> {
    if (!query.trim()) return this.getMasterEmployees();
    const res = await apiClient.get<DbEmployeeMaster[]>(`/api/erp/master-employees/search?q=${encodeURIComponent(query)}`);
    return res.data || [];
  }

  /**
   * Authoritative Shared Company Allied Employee Search
   * Used for both SIM and Vehicle Assignment.
   * Searches authoritative company_pixel_syntax directory by partial name (e.g. 'System User', 'Ahmed', 'AHM'),
   * employee code (e.g. 'ADL0009', '0009'), Emirates ID, and mobile number.
   * Returns matching eligible employees while typing.
   */
  public async searchAuthoritativeEmployeesForAssignment(
    query: string = ''
  ): Promise<AuthoritativeAssignmentEmployeeCandidate[]> {
    const trimmed = (query || '').trim();
    try {
      const res = await apiClient.get<AuthoritativeAssignmentEmployeeCandidate[]>(
        `/api/erp/master-employees/search?q=${encodeURIComponent(trimmed)}&limit=50`
      );
      if (res.data && Array.isArray(res.data)) {
        return res.data;
      }
      return [];
    } catch (err) {
      console.error('Failed to search authoritative employees for assignment:', err);
      return [];
    }
  }

  /**
   * Get 360-degree operational profile with all relational records (timeline, bike, sim, assets, history)
   */
  public async getEmployee360Profile(id: string): Promise<Employee360Profile | null> {
    const res = await apiClient.get<Employee360Profile>(`/api/erp/master-employees/${id}`);
    if (!res.data || !res.data.employee) return null;
    const p = res.data;
    return {
      ...p,
      activeAssets: Array.isArray(p.activeAssets) ? p.activeAssets : [],
      statusHistory: Array.isArray(p.statusHistory) ? p.statusHistory : [],
      visaContractorHistory: Array.isArray(p.visaContractorHistory) ? p.visaContractorHistory : [],
      projectHistory: Array.isArray(p.projectHistory) ? p.projectHistory : [],
      activeProjects: Array.isArray(p.activeProjects) ? p.activeProjects : [],
      endedProjects: Array.isArray(p.endedProjects) ? p.endedProjects : [],
      vehicleHistory: Array.isArray(p.vehicleHistory) ? p.vehicleHistory : [],
      simHistory: Array.isArray(p.simHistory) ? p.simHistory : [],
      assetHistory: Array.isArray(p.assetHistory) ? p.assetHistory : [],
      timeline: Array.isArray(p.timeline) ? p.timeline : [],
    };
  }

  /**
   * Get single master employee by ID
   */
  public async getMasterEmployeeById(id: string): Promise<DbEmployeeMaster | null> {
    const profile = await this.getEmployee360Profile(id);
    return profile?.employee || null;
  }

  /**
   * Create new Master Employee record
   */
  public async createMasterEmployee(data: Partial<DbEmployeeMaster>): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const cleanPayload: Record<string, any> = { ...data };
    delete cleanPayload.branch_name;
    delete cleanPayload.branchName;
    delete cleanPayload.department_name;
    delete cleanPayload.departmentName;
    delete cleanPayload.manager_name;
    delete cleanPayload.shift_name;
    delete cleanPayload.team_name;
    delete cleanPayload.project_name;

    const res = await apiClient.post<DbEmployeeMaster>('/api/erp/master-employees', cleanPayload);
    if (res.data && !res.error) {
      return { success: true, employee: res.data };
    }
    return { success: false, error: res.error || 'Failed to create master employee' };
  }

  /**
   * Update Master Employee profile
   */
  public async updateMasterEmployee(id: string, updates: Partial<DbEmployeeMaster>): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const cleanUpdates: Record<string, any> = { ...updates };
    delete cleanUpdates.branch_name;
    delete cleanUpdates.branchName;
    delete cleanUpdates.department_name;
    delete cleanUpdates.departmentName;
    delete cleanUpdates.manager_name;
    delete cleanUpdates.shift_name;
    delete cleanUpdates.team_name;
    delete cleanUpdates.project_name;

    const res = await apiClient.put<DbEmployeeMaster>(`/api/erp/master-employees/${id}`, cleanUpdates);
    if (res.data && !res.error) {
      return { success: true, employee: res.data };
    }
    return { success: false, error: res.error || 'Failed to update employee profile' };
  }

  /**
   * Change employee operational status with audit tracking & status history
   */
  public async changeEmployeeStatus(
    id: string,
    status: string,
    reason?: string,
    effectiveDate?: string,
    notes?: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/status`,
      { status, reason, effectiveDate, notes }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to change employee status' };
  }

  /**
   * Assign Project to employee
   */
  public async assignProject(
    id: string,
    projectId: string,
    startDate?: string,
    employeeCodeOnProject?: string,
    notes?: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/assign-project`,
      { projectId, startDate, employeeCodeOnProject, notes }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to assign project' };
  }

  /**
   * Update External Project Employee ID for an existing assignment
   */
  public async updateProjectExternalId(
    id: string,
    assignmentId: string | undefined,
    externalRiderId: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; assignment?: any; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster; assignment?: any; message?: string }>(
      `/api/erp/master-employees/${id}/update-project-external-id`,
      { assignmentId, externalRiderId }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee, assignment: res.data.assignment };
    }
    return { success: false, error: res.error || 'Failed to update external project ID' };
  }

  /**
   * Unassign Project from employee
   */
  public async unassignProject(
    id: string,
    reason?: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; message?: string; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster; message?: string }>(
      `/api/erp/master-employees/${id}/unassign-project`,
      { reason }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee, message: res.data.message };
    }
    return { success: false, error: res.error || 'Failed to unassign project' };
  }

  /**
   * Assign Vehicle/Bike with odometer, handover verification, and double-assignment prevention
   */
  public async assignVehicle(
    id: string,
    vehicleId: string,
    options?: {
      assignmentDate?: string;
      assignmentTime?: string;
      startingOdometer?: number;
      condition?: string;
      notes?: string;
      forceReassign?: boolean;
    }
  ): Promise<{
    success: boolean;
    employee?: DbEmployeeMaster;
    error?: string;
    reassignmentRequired?: boolean;
    currentAssignee?: any;
    message?: string;
  }> {
    const res = await apiClient.post<{
      success: boolean;
      employee: DbEmployeeMaster;
      error?: string;
      reassignmentRequired?: boolean;
      currentAssignee?: any;
      message?: string;
    }>(
      `/api/erp/master-employees/${id}/assign-vehicle`,
      { vehicleId, ...options }
    );
    if (res.data?.success) {
      return {
        success: true,
        employee: res.data.employee,
        message: res.data.message,
      };
    }
    return {
      success: false,
      error: res.data?.error || res.error || 'Failed to assign vehicle',
      reassignmentRequired: Boolean(res.data?.reassignmentRequired),
      currentAssignee: res.data?.currentAssignee,
    };
  }

  /**
   * Return vehicle back to fleet depot
   */
  public async returnVehicle(
    id: string,
    options?: {
      vehicleId?: string;
      vehiclePlate?: string;
      employeeCode?: string;
      returnDate?: string;
      returnTime?: string;
      returnOdometer?: number;
      conditionOnReturn?: string;
      returnReason?: string;
      returnRemark?: string;
      returnNotes?: string;
      returnedTo?: string;
      returnedBy?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/return-vehicle`,
      options || {}
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to return vehicle' };
  }

  /**
   * Correct the recorded dates on an EXISTING vehicle history row only.
   * Never assigns, returns or transfers vehicle custody.
   */
  public async updateVehicleAssignmentDate(
    id: string,
    assignmentDate: string,
    assignmentId: string,
    returnDate?: string,
    correctionReason?: string
  ): Promise<{ success: boolean; assignment?: any; error?: string }> {
    const res = await apiClient.patch<{ success: boolean; assignment?: any; error?: string }>(
      `/api/erp/master-employees/${encodeURIComponent(id)}/vehicle-assignment-date`,
      { assignmentDate, assignmentId, ...(returnDate !== undefined ? { returnDate } : {}), correctionReason }
    );
    if (res.data?.success) {
      return { success: true, assignment: res.data.assignment };
    }
    return {
      success: false,
      error: res.data?.error || res.error || 'Failed to update vehicle assignment date',
    };
  }

  /**
   * Assign SIM Card to employee
   */
  public async assignSim(
    id: string,
    simCardId: string,
    notes?: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/assign-sim`,
      { simCardId, notes }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to assign SIM card' };
  }

  /**
   * Return SIM Card
   */
  public async returnSim(
    id: string,
    options?: {
      returnReason?: string;
      returnDate?: string;
      returnNotes?: string;
      returnedTo?: string;
      returnedBy?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/return-sim`,
      options || {}
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to return SIM card' };
  }

  /**
   * Assign Asset/Equipment (Phone, Helmet, Uniform, Delivery Box)
   */
  public async assignAsset(
    id: string,
    assetId: string,
    condition?: string,
    notes?: string
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/assign-asset`,
      { assetId, condition, notes }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to assign asset' };
  }

  /**
   * Return Asset
   */
  public async returnAsset(
    id: string,
    assetAssignmentId: string,
    options?: {
      conditionOnReturn?: string;
      returnNotes?: string;
      returnedTo?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/return-asset`,
      { assetAssignmentId, ...options }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to return asset' };
  }

  /**
   * Get Employee Operational Timeline events
   */
  public async getEmployeeTimeline(id: string): Promise<DbEmployeeTimelineEvent[]> {
    const res = await apiClient.get<DbEmployeeTimelineEvent[]>(`/api/erp/master-employees/${id}/timeline`);
    return res.data || [];
  }

  /**
   * Get Employee Status History
   */
  public async getEmployeeStatusHistory(id: string): Promise<DbEmployeeStatusHistory[]> {
    const res = await apiClient.get<DbEmployeeStatusHistory[]>(`/api/erp/master-employees/${id}/status-history`);
    return res.data || [];
  }

  /**
   * Transfer project atomically (closes previous project, creates new assignment, syncs status)
   */
  public async transferProject(
    id: string,
    newProjectId: string,
    options?: {
      effectiveDate?: string;
      transferReason?: string;
      employeeCodeOnProject?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/transfer-project`,
      { newProjectId, ...options }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to transfer project' };
  }

  /**
   * End project assignment safely preserving complete history
   */
  public async endProjectAssignment(
    assignmentId: string,
    options?: {
      endDate?: string;
      endReason?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.post<any>('/api/erp/rider-projects/end-assignment', {
      assignment_id: assignmentId,
      end_date: options?.endDate || new Date().toISOString().split('T')[0],
      end_reason: options?.endReason || 'Project completed',
      notes: options?.notes,
    });
    if (res.data?.success) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to end project assignment' };
  }

  /**
   * Replace vehicle atomically (1-step swap: return old bike + assign new bike)
   */
  public async replaceVehicle(
    id: string,
    newVehicleId: string,
    options?: {
      oldReturnOdometer?: number;
      newStartingOdometer?: number;
      swapReason?: string;
      conditionOnReturn?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/replace-vehicle`,
      { newVehicleId, ...options }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to replace vehicle' };
  }

  /**
   * Replace SIM card atomically (1-step swap: release old SIM + assign new SIM)
   */
  public async replaceSim(
    id: string,
    newSimCardId: string,
    options?: {
      swapReason?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/replace-sim`,
      { newSimCardId, ...options }
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to replace SIM card' };
  }

  /**
   * Start temporary leave workflow (updates status, records leave window, optional asset park)
   */
  public async startLeave(
    id: string,
    options: {
      leaveType: string;
      startDate: string;
      returnExpectedDate?: string;
      reason?: string;
      returnVehicleTemporary?: boolean;
      returnSimTemporary?: boolean;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/leave`,
      options
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to record leave' };
  }

  /**
   * Return from leave to active duty
   */
  public async returnFromLeave(
    id: string,
    options?: {
      returnDate?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster }>(
      `/api/erp/master-employees/${id}/return-from-leave`,
      options || {}
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee };
    }
    return { success: false, error: res.error || 'Failed to resume duty from leave' };
  }

  /**
   * Complete atomic rider exit checklist (Close project + return bike + return SIM + return assets + update status + final settlement summary)
   */
  public async exitEmployee(
    id: string,
    options: {
      exitType: string;
      exitDate: string;
      exitReason?: string;
      returnVehicleOdometer?: number;
      vehicleConditionOnReturn?: string;
      settlementNotes?: string;
      passportReturnedToRider?: boolean;
    }
  ): Promise<{ success: boolean; employee?: DbEmployeeMaster; clearanceSummary?: any; error?: string }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster; clearanceSummary: any }>(
      `/api/erp/master-employees/${id}/exit-employee`,
      options
    );
    if (res.data?.success) {
      return { success: true, employee: res.data.employee, clearanceSummary: res.data.clearanceSummary };
    }
    return { success: false, error: res.error || 'Failed to process employee exit' };
  }

  /**
   * Unified Global Search across all entities (Employees, Vehicles, SIMs, Projects)
   */
  public async globalSearch(query: string): Promise<{
    employees: Array<{ id: string; title: string; subtitle: string; status: string; badge: string; plate?: string; phone?: string }>;
    vehicles: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
    sims: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
    projects: Array<{ id: string; title: string; subtitle: string; status: string; badge: string }>;
  }> {
    if (!query.trim()) return { employees: [], vehicles: [], sims: [], projects: [] };
    const res = await apiClient.get<any>(`/api/erp/global-search?q=${encodeURIComponent(query)}`);
    return res.data || { employees: [], vehicles: [], sims: [], projects: [] };
  }

  /**
   * Soft delete / Archive employee
   */
  public async archiveEmployee(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/erp/master-employees/${id}`);
    return { success: !res.error, error: res.error };
  }

  /**
   * Get available projects list for assignment (authoritative company_pixel_syntax projects matching Project Management)
   */
  public async getProjects(): Promise<DbProject[]> {
    try {
      const res = await apiClient.get<DbProject[]>('/api/erp/projects');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch (e) {
      console.warn('GET /api/erp/projects fallback check', e);
    }

    try {
      const pmRes = await apiClient.get<{ success: boolean; projects: DbProject[] }>(
        '/api/erp/rider-projects/projects?status=Active'
      );
      if (pmRes.data?.projects && Array.isArray(pmRes.data.projects) && pmRes.data.projects.length > 0) {
        return pmRes.data.projects;
      }
    } catch (e) {
      console.warn('GET /api/erp/rider-projects/projects fallback check', e);
    }

    return [];
  }

  /**
   * Get available branches list (authoritative fallback to ALLIED DELIVERY SERVICES L.L.C and Allied Delivery Services LLL SPC)
   */
  public async getBranches(): Promise<DbBranch[]> {
    try {
      const res = await apiClient.get<DbBranch[]>('/api/erp/branches');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}
    return AUTHORITATIVE_BRANCHES;
  }

  /**
   * Get available departments list
   */
  public async getDepartments(): Promise<DbDepartment[]> {
    const res = await apiClient.get<DbDepartment[]>('/api/erp/departments');
    return Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Get available vehicles master list
   */
  public async getVehiclesMaster(): Promise<DbVehicle[]> {
    const res = await apiClient.get<DbVehicle[]>('/api/erp/vehicles/master');
    return Array.isArray(res.data) ? res.data : [];
  }

  public async getVehicles(): Promise<DbVehicle[]> {
    return this.getVehiclesMaster();
  }

  /**
   * Get available SIM cards master list
   */
  public async getSimsMaster(): Promise<DbSimCardMaster[]> {
    const res = await apiClient.get<DbSimCardMaster[]>('/api/erp/sims/master');
    return Array.isArray(res.data) ? res.data : [];
  }

  public async getSimCards(): Promise<DbSimCardMaster[]> {
    return this.getSimsMaster();
  }

  /**
   * Get available assets master list
   */
  public async getAssetsMaster(): Promise<DbAsset[]> {
    const res = await apiClient.get<DbAsset[]>('/api/erp/assets/master');
    return Array.isArray(res.data) ? res.data : [];
  }

  public async getAssets(): Promise<DbAsset[]> {
    return this.getAssetsMaster();
  }

  /**
   * Get Next Deterministic Sequential Employee Code (Generated at database level)
   */
  public async getNextEmployeeCode(): Promise<string> {
    try {
      const res = await apiClient.get<{ nextCode: string }>('/api/erp/master-employees/next-code');
      return res.data?.nextCode || 'EMP-00001';
    } catch {
      return 'EMP-00001';
    }
  }

  /**
   * Search / List live eligible Reporting Managers
   */
  public async getManagers(q?: string): Promise<DbManagerLookup[]> {
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : '';
      const res = await apiClient.get<DbManagerLookup[]>(`/api/erp/managers${params}`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Get Live Shift Master Definitions
   */
  public async getShifts(): Promise<DbShift[]> {
    try {
      const res = await apiClient.get<DbShift[]>('/api/erp/shifts');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Get Live Designation Master
   */
  public async getDesignations(): Promise<DbDesignation[]> {
    try {
      const res = await apiClient.get<DbDesignation[]>('/api/erp/designations');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Get Live Contract / Visa Categories
   * Authoritative: Own, Allied DXB, Allied AUH
   */
  public async getContractCategories(): Promise<DbContractCategory[]> {
    try {
      const res = await apiClient.get<DbContractCategory[]>('/api/erp/contract-categories');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}
    return AUTHORITATIVE_CONTRACT_CATEGORIES;
  }

  /**
   * Get Live Operational Teams Master
   */
  public async getTeams(): Promise<DbTeamMaster[]> {
    try {
      const res = await apiClient.get<DbTeamMaster[]>('/api/erp/teams');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Get Live Backend Visa / Contractor Types Master
   * Exactly: Own, Allied DXB, Allied AUH
   */
  public async getVisaContractorTypes(): Promise<DbVisaContractorType[]> {
    try {
      const res = await apiClient.get<DbVisaContractorType[]>('/api/erp/visa-contractor-types');
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {}
    return AUTHORITATIVE_VISA_CONTRACTOR_TYPES;
  }

  /**
   * Get Live Backend Vendor Companies
   */
  public async getVendors(search?: string): Promise<DbVendorCompany[]> {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await apiClient.get<DbVendorCompany[]>(`/api/erp/vendors${params}`);
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Add a new Vendor Company into live backend master
   */
  public async createVendor(data: {
    name: string;
    code?: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    trade_license?: string;
    city?: string;
  }): Promise<DbVendorCompany> {
    const res = await apiClient.post<DbVendorCompany>('/api/erp/vendors', data);
    return res.data;
  }

  /**
   * Update Employee Visa / Contractor Ownership
   */
  public async updateVisaContractor(
    employeeId: string,
    data: {
      visaContractorType: string;
      vendorId?: string;
      vendorName?: string;
      effectiveDate?: string;
      reason?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; employee: DbEmployeeMaster; historyEntry: DbEmployeeVisaContractorHistory }> {
    const res = await apiClient.post<{ success: boolean; employee: DbEmployeeMaster; historyEntry: DbEmployeeVisaContractorHistory }>(
      `/api/erp/master-employees/${employeeId}/visa-contractor`,
      data
    );
    return res.data;
  }

  /**
   * Query only assignable/available vehicles from backend
   */
  public async getAssignableVehicles(): Promise<DbVehicle[]> {
    try {
      const res = await apiClient.get<DbVehicle[]>('/api/erp/vehicles/master?available=true');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }

  /**
   * Query only assignable/unassigned SIM cards from backend
   */
  public async getAssignableSims(): Promise<DbSimCardMaster[]> {
    try {
      const res = await apiClient.get<DbSimCardMaster[]>('/api/erp/sims/master?available=true');
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }
}

export const masterEmployeeService = new MasterEmployeeService();
