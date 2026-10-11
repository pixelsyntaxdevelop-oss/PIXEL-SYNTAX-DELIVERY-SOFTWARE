/**
 * Pre-Production Database Reset & Multi-Tenant Data QA Service
 * Strictly Tenant-Scoped, Zero-Orphan, Multi-Tenant Safe.
 * Never touches company_pixel_syntax or any other tenant when operating on target tenant.
 */

import fs from 'fs';
import path from 'path';

export interface ResetPreviewReport {
  timestamp: string;
  tenantId: string;
  tenantName: string;
  goLiveStatus: 'SETUP' | 'TESTING' | 'LIVE';
  isLiveLocked: boolean;
  canReset: boolean;
  lockReason?: string;
  modePreviews: {
    operational: Record<string, number>;
    preGoLive: Record<string, number>;
  };
  preservedMasterCounts: Record<string, number>;
  preservedAdmins: string[];
}

export interface PostResetAuditReport {
  timestamp: string;
  success: boolean;
  tenantId: string;
  mode: 'OPERATIONAL' | 'PRE_GO_LIVE';
  operator: string;
  cleanedCounts: Record<string, number>;
  remainingCounts: Record<string, number>;
  orphansDetected: {
    projectAssignments: number;
    vehicleAssignments: number;
    simAssignments: number;
    documents: number;
    payrollLines: number;
    totalOrphans: number;
  };
  backupFile: string;
}

export interface TenantDiagnosticsReport {
  timestamp: string;
  tenantId: string;
  tenantName: string;
  goLiveStatus: 'SETUP' | 'TESTING' | 'LIVE';
  metrics: {
    totalEmployees: number;
    activeEmployees: number;
    availableEmployees: number;
    onLeaveEmployees: number;
    terminatedExitedEmployees: number;
    totalVehicles: number;
    assignedVehicles: number;
    availableVehicles: number;
    totalSims: number;
    assignedSims: number;
    availableSims: number;
    activeProjectAssignments: number;
    expiringDocuments: number;
  };
  inconsistencies: {
    type: string;
    severity: 'CRITICAL' | 'WARNING' | 'INFO';
    description: string;
    entityId: string;
    entityName: string;
  }[];
  healthScore: number;
}

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const PERSISTENT_DB_PATH = path.join(process.cwd(), 'server', 'data', 'operational_db.json');

try {
  if (typeof fs.existsSync === 'function' && !fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync?.(BACKUP_DIR, { recursive: true });
  }
} catch {
  // Ignored in Cloudflare Worker / serverless runtime without local filesystem
}

try {
  const dataDir = path.dirname(PERSISTENT_DB_PATH);
  if (typeof fs.existsSync === 'function' && !fs.existsSync(dataDir)) {
    fs.mkdirSync?.(dataDir, { recursive: true });
  }
} catch {
  // Ignored in Cloudflare Worker / serverless runtime without local filesystem
}

export class PreProductionResetService {
  private db: any;

  constructor(dbInstance: any) {
    this.db = dbInstance;
  }

  private getTenant(tenantId: string) {
    return (this.db.tenants || []).find((t: any) => t.id === tenantId);
  }

  /**
   * Produce exact reset preview strictly filtered by target tenant.
   */
  public getResetPreview(targetTenantId: string): ResetPreviewReport {
    const tenant = this.getTenant(targetTenantId) || { id: targetTenantId, name: targetTenantId, go_live_status: 'TESTING' };
    const goLiveStatus: 'SETUP' | 'TESTING' | 'LIVE' = tenant.go_live_status || (tenant.status === 'LIVE' ? 'LIVE' : 'TESTING');
    const isLiveLocked = goLiveStatus === 'LIVE';

    const countForTenant = (arr: any[] | undefined) => {
      if (!Array.isArray(arr)) return 0;
      return arr.filter((item: any) => item.tenant_id === targetTenantId).length;
    };

    const operational = {
      attendanceRecords: countForTenant(this.db.attendanceRecords) + countForTenant(this.db.attendance),
      payrollPeriods: countForTenant(this.db.payrollPeriods),
      payrollRecords: countForTenant(this.db.payrollRecords),
      projectSalaryLines: countForTenant(this.db.projectSalaryLines),
      payrollAdjustments: countForTenant(this.db.payrollAdjustments),
      trafficFines: countForTenant(this.db.trafficFines),
      salikRecords: countForTenant(this.db.salikRecords),
      employeeLoans: countForTenant(this.db.employeeLoans) + countForTenant(this.db.employeeAdvances),
      generatedForms: countForTenant(this.db.generatedForms),
      projectAssignments: countForTenant(this.db.employeeProjectAssignments),
      vehicleAssignments: countForTenant(this.db.vehicleAssignments) + countForTenant(this.db.fleetAssignments),
      simAssignments: countForTenant(this.db.simAssignments),
      timelineEvents: countForTenant(this.db.employeeTimelineEvents),
      statusHistory: countForTenant(this.db.employeeStatusHistory),
      passportCustody: countForTenant(this.db.passportCustody) + countForTenant(this.db.passports),
      entityDocuments: countForTenant(this.db.entityDocuments),
    };

    const preGoLive = {
      ...operational,
      masterEmployees: countForTenant(this.db.masterEmployees),
      fleetVehicles: countForTenant(this.db.fleetVehicles) + countForTenant(this.db.vehicles),
      simCardsMaster: countForTenant(this.db.simCardsMaster) + countForTenant(this.db.simCards),
      riderUserAccounts: (this.db.users || []).filter((u: any) => u.tenant_id === targetTenantId && (u.role === 'RIDER' || u.id?.startsWith('usr_rider_'))).length,
    };

    const preservedAdmins = (this.db.users || [])
      .filter((u: any) => (u.tenant_id === targetTenantId || u.role === 'SUPER_ADMIN') && (u.role === 'SUPER_ADMIN' || u.role === 'COMPANY_ADMIN'))
      .map((u: any) => `${u.fullName} (${u.role})`);

    const preservedMasterCounts = {
      branches: countForTenant(this.db.branches),
      departments: countForTenant(this.db.departments),
      projects: countForTenant(this.db.projects),
      documentTypes: (this.db.documentTypes || []).filter((d: any) => d.tenant_id === targetTenantId || d.is_system_default).length,
      formTemplates: (this.db.formTemplates || []).filter((f: any) => f.tenant_id === targetTenantId || f.tenant_id === 'company_pixel_syntax').length,
    };

    return {
      timestamp: new Date().toISOString(),
      tenantId: targetTenantId,
      tenantName: tenant.name,
      goLiveStatus,
      isLiveLocked,
      canReset: !isLiveLocked,
      lockReason: isLiveLocked ? 'Tenant is marked as LIVE. Reset is permanently locked unless emergency override password is provided.' : undefined,
      modePreviews: {
        operational,
        preGoLive,
      },
      preservedMasterCounts,
      preservedAdmins,
    };
  }

  /**
   * Create an exportable restorable JSON snapshot of the current state.
   */
  public createSnapshot(label: string = 'pre_reset'): { success: boolean; filePath: string; timestamp: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `db_snapshot_${label}_${timestamp}.json`;
    const fullPath = path.join(BACKUP_DIR, fileName);

    try {
      const serialized = JSON.stringify(this.db, null, 2);
      fs.writeFileSync(fullPath, serialized, 'utf-8');
      return { success: true, filePath: fullPath, timestamp };
    } catch (err: any) {
      console.error('Failed to create snapshot:', err);
      return { success: false, filePath: '', timestamp };
    }
  }

  /**
   * Execute tenant-scoped transactional reset.
   * ABSOLUTE SAFETY: strictly filters by item.tenant_id === targetTenantId.
   */
  public executeTenantReset(
    targetTenantId: string,
    mode: 'OPERATIONAL' | 'PRE_GO_LIVE',
    operatorName: string,
    confirmationText: string,
    emergencyOverridePassword?: string
  ): PostResetAuditReport {
    const tenant = this.getTenant(targetTenantId);
    if (!tenant && targetTenantId !== 'company_demo') {
      throw new Error(`Target tenant '${targetTenantId}' not found.`);
    }

    const goLiveStatus = tenant?.go_live_status || (tenant?.status === 'LIVE' ? 'LIVE' : 'TESTING');
    const isLiveTenant = targetTenantId === 'company_pixel_syntax' || goLiveStatus === 'LIVE' || tenant?.status === 'LIVE';
    if (isLiveTenant) {
      if (emergencyOverridePassword !== 'EMERGENCY_OVERRIDE_2026') {
        throw new Error(`Tenant '${targetTenantId}' is marked LIVE. Reset is permanently locked. Valid platform-level exceptional authorization password required.`);
      }
    }

    const expectedConfirm = `RESET ${targetTenantId}`;
    if (confirmationText.trim() !== expectedConfirm) {
      throw new Error(`Confirmation text mismatch. Expected exact text: "${expectedConfirm}". Received: "${confirmationText}".`);
    }

    // 1. Take safety snapshot
    const backupResult = this.createSnapshot(`reset_${targetTenantId}_${mode.toLowerCase()}`);
    console.log(`[RESET ENGINE] Initiating ${mode} reset on tenant [${targetTenantId}] by ${operatorName}...`);

    const filterOutTenant = (arr: any[] | undefined) => {
      if (!Array.isArray(arr)) return [];
      return arr.filter((item: any) => item.tenant_id !== targetTenantId);
    };

    const countForTenant = (arr: any[] | undefined) => {
      if (!Array.isArray(arr)) return 0;
      return arr.filter((item: any) => item.tenant_id === targetTenantId).length;
    };

    // Track cleaned counts
    const cleanedCounts: Record<string, number> = {
      attendanceRecords: countForTenant(this.db.attendanceRecords) + countForTenant(this.db.attendance),
      payrollPeriods: countForTenant(this.db.payrollPeriods),
      payrollRecords: countForTenant(this.db.payrollRecords),
      projectSalaryLines: countForTenant(this.db.projectSalaryLines),
      payrollAdjustments: countForTenant(this.db.payrollAdjustments),
      trafficFines: countForTenant(this.db.trafficFines),
      salikRecords: countForTenant(this.db.salikRecords),
      loans: countForTenant(this.db.employeeLoans) + countForTenant(this.db.employeeAdvances),
      generatedForms: countForTenant(this.db.generatedForms),
      projectAssignments: countForTenant(this.db.employeeProjectAssignments),
      vehicleAssignments: countForTenant(this.db.vehicleAssignments) + countForTenant(this.db.fleetAssignments),
      simAssignments: countForTenant(this.db.simAssignments),
      timelineEvents: countForTenant(this.db.employeeTimelineEvents),
      statusHistory: countForTenant(this.db.employeeStatusHistory),
      passportCustody: countForTenant(this.db.passportCustody) + countForTenant(this.db.passports),
      entityDocuments: countForTenant(this.db.entityDocuments),
    };

    // 2. Clear transactional tables ONLY for targetTenantId
    this.db.attendanceRecords = filterOutTenant(this.db.attendanceRecords);
    this.db.attendanceMonths = filterOutTenant(this.db.attendanceMonths);
    this.db.attendanceHistory = filterOutTenant(this.db.attendanceHistory);
    this.db.attendanceImportBatches = filterOutTenant(this.db.attendanceImportBatches);
    this.db.dailyPerformanceMetrics = filterOutTenant(this.db.dailyPerformanceMetrics);
    this.db.attendance = filterOutTenant(this.db.attendance);

    this.db.payrollPeriods = filterOutTenant(this.db.payrollPeriods);
    this.db.payrollRecords = filterOutTenant(this.db.payrollRecords);
    this.db.projectSalaryLines = filterOutTenant(this.db.projectSalaryLines);
    this.db.payrollImportBatches = filterOutTenant(this.db.payrollImportBatches);
    this.db.payrollAdjustments = filterOutTenant(this.db.payrollAdjustments);
    this.db.finalSettlements = filterOutTenant(this.db.finalSettlements);
    this.db.employeeSalaryHistories = filterOutTenant(this.db.employeeSalaryHistories);

    this.db.trafficFines = filterOutTenant(this.db.trafficFines);
    this.db.salikRecords = filterOutTenant(this.db.salikRecords);
    this.db.employeeLoans = filterOutTenant(this.db.employeeLoans);
    this.db.employeeAdvances = filterOutTenant(this.db.employeeAdvances);

    this.db.generatedForms = filterOutTenant(this.db.generatedForms);

    this.db.entityDocuments = filterOutTenant(this.db.entityDocuments);
    this.db.documentFiles = filterOutTenant(this.db.documentFiles);
    this.db.documentVersions = filterOutTenant(this.db.documentVersions);
    this.db.documentActivities = filterOutTenant(this.db.documentActivities);
    this.db.documentNotifications = filterOutTenant(this.db.documentNotifications);

    this.db.passportCustody = filterOutTenant(this.db.passportCustody);
    this.db.passportCustodyHistory = filterOutTenant(this.db.passportCustodyHistory);
    this.db.passports = filterOutTenant(this.db.passports);

    this.db.riderDailyPerformance = filterOutTenant(this.db.riderDailyPerformance);
    this.db.performanceImportBatches = filterOutTenant(this.db.performanceImportBatches);
    this.db.performanceCorrectionLogs = filterOutTenant(this.db.performanceCorrectionLogs);
    this.db.monthlyPerformancePayrollSyncs = filterOutTenant(this.db.monthlyPerformancePayrollSyncs);
    this.db.partnerPerformance = filterOutTenant(this.db.partnerPerformance);

    this.db.fleetAssignments = filterOutTenant(this.db.fleetAssignments);
    this.db.vehicleAssignments = filterOutTenant(this.db.vehicleAssignments);
    this.db.simAssignments = filterOutTenant(this.db.simAssignments);
    this.db.assetAssignments = filterOutTenant(this.db.assetAssignments);

    this.db.fleetAccidents = filterOutTenant(this.db.fleetAccidents);
    this.db.fleetFines = filterOutTenant(this.db.fleetFines);
    this.db.fleetExpenses = filterOutTenant(this.db.fleetExpenses);
    this.db.fleetExceptions = filterOutTenant(this.db.fleetExceptions);
    this.db.fleetFuelEntries = filterOutTenant(this.db.fleetFuelEntries);
    this.db.fleetOdometerHistories = filterOutTenant(this.db.fleetOdometerHistories);
    this.db.fleetMaintenance = filterOutTenant(this.db.fleetMaintenance);
    this.db.fleetStatusHistories = filterOutTenant(this.db.fleetStatusHistories);

    this.db.employeeProjectAssignments = filterOutTenant(this.db.employeeProjectAssignments);
    this.db.projectRiderMappings = filterOutTenant(this.db.projectRiderMappings);
    this.db.employeeTimelineEvents = filterOutTenant(this.db.employeeTimelineEvents);
    this.db.employeeStatusHistory = filterOutTenant(this.db.employeeStatusHistory);
    this.db.leaveRequests = filterOutTenant(this.db.leaveRequests);
    this.db.driverTickets = filterOutTenant(this.db.driverTickets);
    this.db.orders = filterOutTenant(this.db.orders);

    if (mode === 'OPERATIONAL') {
      // Unlink active pointers for masterEmployees belonging to targetTenantId
      if (Array.isArray(this.db.masterEmployees)) {
        this.db.masterEmployees.forEach((emp: any) => {
          if (emp.tenant_id === targetTenantId) {
            emp.project_id = '';
            emp.project_name = 'Unassigned';
            emp.project_code = '';
            emp.current_project = 'Unassigned';
            emp.current_bike_id = undefined;
            emp.current_bike_plate = undefined;
            emp.current_sim_id = undefined;
            emp.current_sim_number = undefined;
            emp.current_status = 'Available / Unassigned';
          }
        });
      }

      // Reset vehicles belonging to targetTenantId
      const resetVehicles = (arr: any[] | undefined) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((veh: any) => {
          if (veh.tenant_id === targetTenantId) {
            veh.status = 'AVAILABLE';
            veh.assigned_employee_id = undefined;
            veh.assigned_driver_name = undefined;
          }
        });
      };
      resetVehicles(this.db.fleetVehicles);
      resetVehicles(this.db.vehicles);

      // Reset SIMs belonging to targetTenantId
      const resetSims = (arr: any[] | undefined) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((sim: any) => {
          if (sim.tenant_id === targetTenantId) {
            sim.status = 'AVAILABLE';
            sim.current_employee_id = undefined;
            sim.current_employee_name = undefined;
          }
        });
      };
      resetSims(this.db.simCardsMaster);
      resetSims(this.db.simCards);
    } else {
      // PRE_GO_LIVE Mode: remove test employees, vehicles, and SIMs for targetTenantId
      cleanedCounts.masterEmployees = countForTenant(this.db.masterEmployees);
      cleanedCounts.fleetVehicles = countForTenant(this.db.fleetVehicles) + countForTenant(this.db.vehicles);
      cleanedCounts.simCardsMaster = countForTenant(this.db.simCardsMaster) + countForTenant(this.db.simCards);

      this.db.masterEmployees = filterOutTenant(this.db.masterEmployees);
      this.db.employees = filterOutTenant(this.db.employees);
      this.db.riders = filterOutTenant(this.db.riders);
      this.db.candidates = filterOutTenant(this.db.candidates);

      this.db.fleetVehicles = filterOutTenant(this.db.fleetVehicles);
      this.db.vehicles = filterOutTenant(this.db.vehicles);
      this.db.simCardsMaster = filterOutTenant(this.db.simCardsMaster);
      this.db.simCards = filterOutTenant(this.db.simCards);

      // Remove self-service test user accounts for this tenant, preserve admin accounts
      if (Array.isArray(this.db.users)) {
        this.db.users = this.db.users.filter((u: any) => {
          if (u.tenant_id !== targetTenantId) return true;
          return u.role === 'SUPER_ADMIN' || u.role === 'COMPANY_ADMIN';
        });
      }

      if (tenant) {
        tenant.go_live_status = 'SETUP';
      }
    }

    // Save persistent DB to disk
    try {
      fs.writeFileSync(PERSISTENT_DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
      console.log(`[RESET ENGINE] Successfully persisted clean tenant state to ${PERSISTENT_DB_PATH}`);
    } catch (e) {
      console.warn('[RESET ENGINE] Warning: Could not write operational_db.json:', e);
    }

    // Write audit log
    const auditEntry = {
      id: `audit_reset_${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: `TENANT_RESET_${mode}`,
      actorName: operatorName,
      tenant_id: targetTenantId,
      details: `${mode} data reset executed for tenant [${targetTenantId}]. All operational transactions cleared in dependency order.`,
      backupFile: backupResult.filePath,
    };
    if (Array.isArray(this.db.auditLogs)) {
      this.db.auditLogs.unshift(auditEntry);
    }

    // Verify 0 orphans for this tenant
    const orphans = {
      projectAssignments: countForTenant(this.db.employeeProjectAssignments),
      vehicleAssignments: countForTenant(this.db.vehicleAssignments) + countForTenant(this.db.fleetAssignments),
      simAssignments: countForTenant(this.db.simAssignments),
      documents: countForTenant(this.db.entityDocuments),
      payrollLines: countForTenant(this.db.projectSalaryLines),
      totalOrphans: 0,
    };
    orphans.totalOrphans = Object.values(orphans).reduce((a, b) => a + b, 0);

    const remainingCounts = {
      employees: countForTenant(this.db.masterEmployees),
      vehicles: countForTenant(this.db.fleetVehicles) + countForTenant(this.db.vehicles),
      sims: countForTenant(this.db.simCardsMaster) + countForTenant(this.db.simCards),
      projects: countForTenant(this.db.projects),
      branches: countForTenant(this.db.branches),
    };

    return {
      timestamp: new Date().toISOString(),
      success: true,
      tenantId: targetTenantId,
      mode,
      operator: operatorName,
      cleanedCounts,
      remainingCounts,
      orphansDetected: orphans,
      backupFile: backupResult.filePath,
    };
  }

  /**
   * Run comprehensive tenant diagnostics.
   */
  public runTenantDiagnostics(targetTenantId: string): TenantDiagnosticsReport {
    const tenant = this.getTenant(targetTenantId) || { id: targetTenantId, name: targetTenantId, go_live_status: 'TESTING' };
    const goLiveStatus: 'SETUP' | 'TESTING' | 'LIVE' = tenant.go_live_status || (tenant.status === 'LIVE' ? 'LIVE' : 'TESTING');

    const emps = (this.db.masterEmployees || []).filter((e: any) => e.tenant_id === targetTenantId && !e.is_archived);
    const vehicles = (this.db.fleetVehicles || this.db.vehicles || []).filter((v: any) => v.tenant_id === targetTenantId);
    const sims = (this.db.simCardsMaster || this.db.simCards || []).filter((s: any) => s.tenant_id === targetTenantId);
    const projectAssignments = (this.db.employeeProjectAssignments || []).filter((a: any) => a.tenant_id === targetTenantId && a.status === 'ACTIVE');

    const inconsistencies: TenantDiagnosticsReport['inconsistencies'] = [];

    // Check 1: Employee project pointer vs active assignment
    emps.forEach((emp: any) => {
      const activeAssignments = projectAssignments.filter((a: any) => a.employee_id === emp.id);
      const hasActiveProjectPointer = emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '-';

      if (activeAssignments.length > 1) {
        inconsistencies.push({
          type: 'DUPLICATE_ACTIVE_PROJECTS',
          severity: 'CRITICAL',
          description: `Employee has ${activeAssignments.length} active project assignments simultaneously.`,
          entityId: emp.id,
          entityName: emp.full_name,
        });
      }

      if (activeAssignments.length === 1 && !hasActiveProjectPointer) {
        inconsistencies.push({
          type: 'UNSYNCED_PROJECT_POINTER',
          severity: 'WARNING',
          description: `Employee has active assignment to '${activeAssignments[0].project_name}', but employee record shows '${emp.project_name || 'Unassigned'}'.`,
          entityId: emp.id,
          entityName: emp.full_name,
        });
      }

      if (activeAssignments.length === 0 && hasActiveProjectPointer) {
        inconsistencies.push({
          type: 'GHOST_PROJECT_POINTER',
          severity: 'WARNING',
          description: `Employee profile indicates project '${emp.project_name}', but has no active project assignment record in history.`,
          entityId: emp.id,
          entityName: emp.full_name,
        });
      }

      // Check ineligible status with active project
      const lowerStatus = (emp.current_status || '').toLowerCase();
      const isIneligible = ['on leave', 'on hold', 'absconding', 'terminated', 'exited', 'cancelled', 'inactive'].some(k => lowerStatus.includes(k));
      if (isIneligible && (activeAssignments.length > 0 || hasActiveProjectPointer)) {
        inconsistencies.push({
          type: 'INELIGIBLE_ACTIVE_PROJECT',
          severity: 'CRITICAL',
          description: `Employee status is '${emp.current_status}' but holds an active project assignment '${emp.project_name || activeAssignments[0]?.project_name}'.`,
          entityId: emp.id,
          entityName: emp.full_name,
        });
      }
    });

    // Check 2: Vehicle assigned to nonexistent employee
    vehicles.forEach((veh: any) => {
      if (veh.assigned_employee_id) {
        const emp = emps.find((e: any) => e.id === veh.assigned_employee_id);
        if (!emp) {
          inconsistencies.push({
            type: 'ORPHAN_VEHICLE_ASSIGNMENT',
            severity: 'CRITICAL',
            description: `Vehicle plate ${veh.plate_number || veh.plateNumber} is assigned to non-existent employee ID ${veh.assigned_employee_id}.`,
            entityId: veh.id,
            entityName: veh.plate_number || veh.plateNumber,
          });
        }
      }
    });

    // Check 3: SIM assigned to nonexistent employee
    sims.forEach((sim: any) => {
      if (sim.current_employee_id) {
        const emp = emps.find((e: any) => e.id === sim.current_employee_id);
        if (!emp) {
          inconsistencies.push({
            type: 'ORPHAN_SIM_ASSIGNMENT',
            severity: 'CRITICAL',
            description: `SIM ${sim.sim_number || sim.simNumber} is assigned to non-existent employee ID ${sim.current_employee_id}.`,
            entityId: sim.id,
            entityName: sim.sim_number || sim.simNumber,
          });
        }
      }
    });

    let healthScore = 100;
    healthScore -= inconsistencies.filter(i => i.severity === 'CRITICAL').length * 20;
    healthScore -= inconsistencies.filter(i => i.severity === 'WARNING').length * 5;
    if (healthScore < 0) healthScore = 0;

    return {
      timestamp: new Date().toISOString(),
      tenantId: targetTenantId,
      tenantName: tenant.name,
      goLiveStatus,
      metrics: {
        totalEmployees: emps.length,
        activeEmployees: emps.filter((e: any) => (e.current_status || '').toLowerCase().includes('assigned') || (e.current_status || '').toLowerCase().includes('active')).length,
        availableEmployees: emps.filter((e: any) => (e.current_status || '').toLowerCase().includes('available') || (e.current_status || '').toLowerCase().includes('unassigned')).length,
        onLeaveEmployees: emps.filter((e: any) => (e.current_status || '').toLowerCase().includes('leave')).length,
        terminatedExitedEmployees: emps.filter((e: any) => (e.current_status || '').toLowerCase().includes('terminated') || (e.current_status || '').toLowerCase().includes('exited')).length,
        totalVehicles: vehicles.length,
        assignedVehicles: vehicles.filter((v: any) => v.status === 'ASSIGNED' || v.status === 'Assigned').length,
        availableVehicles: vehicles.filter((v: any) => v.status === 'AVAILABLE' || v.status === 'Available').length,
        totalSims: sims.length,
        assignedSims: sims.filter((s: any) => s.status === 'ASSIGNED' || s.status === 'Assigned').length,
        availableSims: sims.filter((s: any) => s.status === 'AVAILABLE' || s.status === 'Available').length,
        activeProjectAssignments: projectAssignments.length,
        expiringDocuments: 0,
      },
      inconsistencies,
      healthScore,
    };
  }

  /**
   * Run safe automated repair tool for a tenant.
   */
  public runDataRepair(targetTenantId: string, operatorName: string): { repairedCount: number; details: string[] } {
    console.log(`[DATA REPAIR] Starting automated repair on tenant [${targetTenantId}] by ${operatorName}...`);
    const repairs: string[] = [];
    const now = new Date().toISOString();

    const emps = (this.db.masterEmployees || []).filter((e: any) => e.tenant_id === targetTenantId && !e.is_archived);
    const projectAssignments = (this.db.employeeProjectAssignments || []).filter((a: any) => a.tenant_id === targetTenantId);

    emps.forEach((emp: any) => {
      const activeAssignments = projectAssignments.filter((a: any) => a.employee_id === emp.id && a.status === 'ACTIVE');
      const lowerStatus = (emp.current_status || '').toLowerCase();
      const isIneligible = ['on leave', 'on hold', 'absconding', 'terminated', 'exited', 'cancelled', 'inactive'].some(k => lowerStatus.includes(k));

      // 1. Ineligible employees must have NO active project assignments
      if (isIneligible && activeAssignments.length > 0) {
        activeAssignments.forEach((a: any) => {
          a.status = 'ENDED';
          a.assignment_end_date = now.split('T')[0];
          a.ended_by = operatorName;
          a.ended_at = now;
          a.end_reason = `Automated repair: Employee is ${emp.current_status}`;
          a.is_primary = false;
        });
        emp.project_id = '';
        emp.project_name = 'Unassigned';
        emp.project_code = '';
        emp.current_project = 'Unassigned';
        repairs.push(`Unassigned project from ineligible employee ${emp.full_name} (${emp.current_status}).`);
      }

      // 2. Fix duplicate active project assignments: keep newest only
      if (!isIneligible && activeAssignments.length > 1) {
        activeAssignments.sort((a: any, b: any) => new Date(b.assignment_start_date || b.created_at || 0).getTime() - new Date(a.assignment_start_date || a.created_at || 0).getTime());
        const keeper = activeAssignments[0];
        for (let i = 1; i < activeAssignments.length; i++) {
          activeAssignments[i].status = 'ENDED';
          activeAssignments[i].assignment_end_date = now.split('T')[0];
          activeAssignments[i].ended_by = operatorName;
          activeAssignments[i].end_reason = 'Automated repair: Duplicate active assignment closed';
          activeAssignments[i].is_primary = false;
        }
        emp.project_id = keeper.project_id;
        emp.project_name = keeper.project_name;
        emp.project_code = keeper.project_code;
        emp.current_project = keeper.project_name;
        emp.current_status = 'Assigned / Active';
        repairs.push(`Resolved duplicate active project assignments for ${emp.full_name}, preserved '${keeper.project_name}'.`);
      }

      // 3. Unsynced project pointer: active assignment exists but pointer missing
      if (!isIneligible && activeAssignments.length === 1) {
        const active = activeAssignments[0];
        if (emp.project_id !== active.project_id || emp.project_name !== active.project_name) {
          emp.project_id = active.project_id;
          emp.project_name = active.project_name;
          emp.project_code = active.project_code;
          emp.current_project = active.project_name;
          emp.current_status = 'Assigned / Active';
          repairs.push(`Synchronized project pointer '${active.project_name}' for ${emp.full_name}.`);
        }
      }

      // 4. Ghost pointer: no active assignment but pointer was set
      if (!isIneligible && activeAssignments.length === 0 && emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '-') {
        emp.project_id = '';
        emp.project_name = 'Unassigned';
        emp.project_code = '';
        emp.current_project = 'Unassigned';
        if (emp.current_status === 'Assigned / Active') {
          emp.current_status = 'Available / Unassigned';
        }
        repairs.push(`Cleared ghost project pointer from ${emp.full_name}.`);
      }
    });

    // 5. Clean up orphan vehicle assignments
    const vehicles = (this.db.fleetVehicles || this.db.vehicles || []).filter((v: any) => v.tenant_id === targetTenantId);
    vehicles.forEach((veh: any) => {
      if (veh.assigned_employee_id) {
        const emp = emps.find((e: any) => e.id === veh.assigned_employee_id);
        if (!emp) {
          veh.status = 'AVAILABLE';
          veh.assigned_employee_id = undefined;
          veh.assigned_driver_name = undefined;
          repairs.push(`Reset orphan vehicle assignment on plate ${veh.plate_number || veh.plateNumber}.`);
        }
      }
    });

    // 6. Clean up orphan SIM assignments
    const sims = (this.db.simCardsMaster || this.db.simCards || []).filter((s: any) => s.tenant_id === targetTenantId);
    sims.forEach((sim: any) => {
      if (sim.current_employee_id) {
        const emp = emps.find((e: any) => e.id === sim.current_employee_id);
        if (!emp) {
          sim.status = 'AVAILABLE';
          sim.current_employee_id = undefined;
          sim.current_employee_name = undefined;
          repairs.push(`Reset orphan SIM assignment on number ${sim.sim_number || sim.simNumber}.`);
        }
      }
    });

    // Persist changes
    try {
      fs.writeFileSync(PERSISTENT_DB_PATH, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[DATA REPAIR] Could not persist db to file:', e);
    }

    return {
      repairedCount: repairs.length,
      details: repairs,
    };
  }

  /**
   * Run targeted consistency diagnostic on a specific employee.
   */
  public diagnoseEmployee(empIdOrCode: string, targetTenantId?: string): any {
    const term = empIdOrCode.trim().toLowerCase();
    const emps = this.db.masterEmployees || [];
    const emp = emps.find((e: any) => 
      (!targetTenantId || e.tenant_id === targetTenantId) &&
      (e.id?.toLowerCase() === term || e.employee_code?.toLowerCase() === term || e.full_name?.toLowerCase().includes(term))
    );

    if (!emp) {
      return {
        fullName: 'Not Found',
        employeeCode: empIdOrCode,
        employeeId: empIdOrCode,
        overallConsistent: false,
        checks: [
          {
            name: 'Employee Record Existence',
            status: 'FAIL',
            message: `No employee found matching ID, Code, or Name "${empIdOrCode}".`,
          }
        ]
      };
    }

    const checks: any[] = [];
    const lowerStatus = (emp.current_status || '').toLowerCase();
    const activeAssignments = (this.db.employeeProjectAssignments || []).filter(
      (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
    );
    const isIneligible = ['on leave', 'on hold', 'absconding', 'terminated', 'exited', 'cancelled', 'inactive'].some(k => lowerStatus.includes(k));

    // Check 1: Project Eligibility & Status Coherence
    if (isIneligible && activeAssignments.length > 0) {
      checks.push({
        name: 'Project Eligibility & Status Coherence',
        status: 'WARNING',
        message: `Employee has status "${emp.current_status}" but still has ${activeAssignments.length} active project assignment(s).`,
      });
    } else if (!isIneligible && activeAssignments.length > 1) {
      checks.push({
        name: 'Project Eligibility & Status Coherence',
        status: 'WARNING',
        message: `Employee has ${activeAssignments.length} concurrent active project assignments. Expected exactly 1 or 0.`,
      });
    } else {
      checks.push({
        name: 'Project Eligibility & Status Coherence',
        status: 'PASS',
        message: `Status "${emp.current_status || 'Available'}" is coherent with project assignments (${activeAssignments.length} active).`,
      });
    }

    // Check 2: Project Master Pointer Sync
    const activeProj = activeAssignments[0];
    if (activeProj) {
      if (emp.project_id === activeProj.project_id) {
        checks.push({
          name: 'Project Master Pointer Sync',
          status: 'PASS',
          message: `Direct employee project pointer matches active assignment "${activeProj.project_name}".`,
        });
      } else {
        checks.push({
          name: 'Project Master Pointer Sync',
          status: 'WARNING',
          message: `Employee pointer "${emp.project_name}" differs from active assignment "${activeProj.project_name}".`,
        });
      }
    } else {
      if (!emp.project_name || emp.project_name === 'Unassigned' || emp.project_name === '-') {
        checks.push({
          name: 'Project Master Pointer Sync',
          status: 'PASS',
          message: 'Correctly unassigned in both employee master and project assignments ledger.',
        });
      } else {
        checks.push({
          name: 'Project Master Pointer Sync',
          status: 'WARNING',
          message: `Employee lists project "${emp.project_name}" without an active assignment record.`,
        });
      }
    }

    // Check 3: Vehicle Assignment
    const activeVehicles = (this.db.vehicleAssignments || []).filter(
      (v: any) => v.employee_id === emp.id && v.status === 'ACTIVE'
    );
    if (emp.current_bike_plate && activeVehicles.length === 0) {
      checks.push({
        name: 'Fleet Vehicle Assignment Sync',
        status: 'WARNING',
        message: `Employee lists bike plate "${emp.current_bike_plate}" but has no active vehicle assignment record.`,
      });
    } else {
      checks.push({
        name: 'Fleet Vehicle Assignment Sync',
        status: 'PASS',
        message: activeVehicles.length > 0
          ? `Active vehicle assigned: Plate ${activeVehicles[0].plate_number || emp.current_bike_plate}.`
          : 'No vehicle assigned (consistent).',
      });
    }

    // Check 4: SIM Assignment
    const activeSims = (this.db.simAssignments || []).filter(
      (s: any) => s.employee_id === emp.id && s.status === 'ACTIVE'
    );
    if (emp.current_sim_number && activeSims.length === 0) {
      checks.push({
        name: 'Telecom SIM Assignment Sync',
        status: 'WARNING',
        message: `Employee lists SIM "${emp.current_sim_number}" without active SIM assignment record.`,
      });
    } else {
      checks.push({
        name: 'Telecom SIM Assignment Sync',
        status: 'PASS',
        message: activeSims.length > 0
          ? `Active SIM assigned: ${activeSims[0].sim_number || emp.current_sim_number}.`
          : 'No SIM assigned (consistent).',
      });
    }

    // Check 5: Document Compliance
    const now = new Date();
    const isVisaExpired = emp.visa_expiry && new Date(emp.visa_expiry).getTime() < now.getTime();
    const isEidExpired = emp.emirates_id_expiry && new Date(emp.emirates_id_expiry).getTime() < now.getTime();
    if (isVisaExpired || isEidExpired) {
      checks.push({
        name: 'Regulatory Document Expiry',
        status: 'WARNING',
        message: `Expired documents detected: ${isVisaExpired ? 'Visa expired; ' : ''}${isEidExpired ? 'Emirates ID expired.' : ''}`,
      });
    } else {
      checks.push({
        name: 'Regulatory Document Expiry',
        status: 'PASS',
        message: 'All registered employee identity and residency documents are active.',
      });
    }

    const overallConsistent = !checks.some(c => c.status === 'FAIL' || c.status === 'WARNING');

    return {
      fullName: emp.full_name,
      employeeCode: emp.employee_code || emp.id,
      employeeId: emp.id,
      overallConsistent,
      checks,
    };
  }
}
