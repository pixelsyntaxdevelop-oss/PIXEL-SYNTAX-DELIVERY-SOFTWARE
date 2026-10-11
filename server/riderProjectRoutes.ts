import { Router, Request, Response } from 'express';
import { resolveAuthenticatedActor, logUniversalAudit } from './auditActorHelper';
import {
  resolveCanonicalStatus,
  resolveCanonicalEmployeeStatus,
  resolveEmployeeRecordStatus,
  hasActiveProjectAssignment,
  isLifecycleOverrideStatus,
  CANONICAL_STATUSES,
} from './canonicalStatus';
import { getSupabaseClient } from './supabaseDb';
import { searchAuthoritativeEmployees } from './globalEmployeeSearchService';
import {
  AUTHORITATIVE_COMPANY_ALLIED_PROJECTS,
  resolveAuthoritativeProject,
  loadPersistentProjectAssignments,
  savePersistentProjectAssignments,
} from './authoritativeProjects';
import { isEmployeeMatchingProject } from './projectMatch';

export interface EmployeeProjectAssignmentRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  project_id: string;
  project_name: string;
  project_code: string;
  external_rider_id?: string;
  external_id_type?: string; // e.g. 'Courier ID', 'NIM ID', 'Person Code'
  assignment_start_date: string;
  assignment_end_date?: string;
  status: 'ACTIVE' | 'ENDED';
  is_primary: boolean;
  location_state?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  ended_by?: string;
  ended_at?: string;
  end_reason?: string;
}

export function getProjectExternalIdConfig(project: any): { label: string; key: string; placeholder: string } {
  if (!project) return { label: 'External Rider ID', key: 'external_rider_id', placeholder: 'e.g. RID-10023' };

  // Operator-configured label takes precedence over automatic guesses
  if (project.external_id_label && typeof project.external_id_label === 'string' && project.external_id_label.trim()) {
    const trimmed = project.external_id_label.trim();
    return { label: trimmed, key: 'external_rider_id', placeholder: `e.g. ${trimmed} code` };
  }

  const pName = (project.name || '').toLowerCase();
  const pCode = (project.code || '').toLowerCase();
  const sGroup = (project.salary_group || '').toUpperCase();
  const importProfile = (project.import_profile || project.payroll_import_profile || '').toUpperCase();

  if (pName.includes('keeta') || pCode.includes('keeta') || sGroup === 'KEETA' || importProfile.includes('KEETA')) {
    return { label: 'Courier ID', key: 'courier_id', placeholder: 'e.g. K12345' };
  }
  if (pName.includes('noon') || pCode.includes('noon') || sGroup === 'NOON' || importProfile.includes('NOON')) {
    return { label: 'NIM ID', key: 'nim_id', placeholder: 'e.g. N88991' };
  }
  if (pName.includes('labour') || pCode.includes('labour') || sGroup === 'LABOUR' || importProfile.includes('LABOUR') || pName.includes('supply')) {
    return { label: 'Person Code', key: 'person_code', placeholder: 'e.g. PC-44021' };
  }
  if (pName.includes('careem') || pCode.includes('careem')) {
    return { label: 'Captain ID', key: 'captain_id', placeholder: 'e.g. C-90021' };
  }
  if (pName.includes('talabat') || pCode.includes('talabat')) {
    return { label: 'Rider ID', key: 'rider_id', placeholder: 'e.g. T-55412' };
  }
  if (pName.includes('deliveroo') || pCode.includes('deliveroo')) {
    return { label: 'Rider ID', key: 'rider_id', placeholder: 'e.g. D-88219' };
  }
  return { label: 'External Rider ID', key: 'external_rider_id', placeholder: 'e.g. EXT-10023' };
}

export interface OverlapCheckResult {
  allowed: boolean;
  status: 'Available' | 'Already Assigned' | 'Historical ID' | 'Conflict';
  reason?: string;
  conflictingAssignment?: any;
}

export function validateExternalRiderIdOverlap(
  db: any,
  tenantId: string,
  projectId: string,
  externalRiderId: string,
  candidateEmployeeId: string,
  startDate: string,
  endDate?: string | null,
  excludeAssignmentId?: string
): OverlapCheckResult {
  if (!externalRiderId || !externalRiderId.trim()) {
    return { allowed: true, status: 'Available' };
  }

  const cleanExtId = externalRiderId.trim().toLowerCase();
  const assignments = (db.employeeProjectAssignments || []).filter(
    (a: any) =>
      a.tenant_id === tenantId &&
      a.project_id === projectId &&
      a.external_rider_id &&
      a.external_rider_id.trim().toLowerCase() === cleanExtId &&
      a.id !== excludeAssignmentId
  );

  const newStart = startDate;
  const newEnd = endDate || '9999-12-31';

  let hasHistoricalUse = false;

  for (const existing of assignments) {
    if (existing.employee_id !== candidateEmployeeId) {
      if (existing.status === 'ACTIVE' && !existing.assignment_end_date) {
        return {
          allowed: false,
          status: 'Already Assigned',
          reason: `External ID '${externalRiderId}' is actively assigned to employee '${existing.employee_name}' (${existing.employee_code || existing.employee_id}) since ${existing.assignment_start_date}. Overlapping active ownership is blocked.`,
          conflictingAssignment: existing,
        };
      }

      const existingStart = existing.assignment_start_date || '1970-01-01';
      const existingEnd = existing.assignment_end_date || (existing.status === 'ACTIVE' ? '9999-12-31' : existingStart);

      if (newStart <= existingEnd && newEnd >= existingStart) {
        return {
          allowed: false,
          status: 'Conflict',
          reason: `External ID '${externalRiderId}' has an overlapping assignment period (${existingStart} to ${existing.assignment_end_date || 'Active'}) with employee '${existing.employee_name}' (${existing.employee_code}). Overlapping historical periods are blocked.`,
          conflictingAssignment: existing,
        };
      }
      hasHistoricalUse = true;
    } else {
      hasHistoricalUse = true;
    }
  }

  const existingMapping = (db.projectRiderMappings || []).find(
    (m: any) =>
      m.tenant_id === tenantId &&
      m.project_id === projectId &&
      m.external_rider_id &&
      m.external_rider_id.trim().toLowerCase() === cleanExtId &&
      m.employee_id !== candidateEmployeeId &&
      m.is_active !== false
  );

  if (existingMapping) {
    if (!endDate || endDate >= (new Date().toISOString().split('T')[0])) {
      return {
        allowed: false,
        status: 'Already Assigned',
        reason: `External ID '${externalRiderId}' is already actively mapped to employee '${existingMapping.employee_name}' (${existingMapping.employee_code}) in ProjectRiderMapping. Overlapping active ownership is blocked.`,
      };
    }
    hasHistoricalUse = true;
  }

  if (hasHistoricalUse) {
    return {
      allowed: true,
      status: 'Historical ID',
      reason: `Historical ID exists with non-overlapping period. Safe to assign.`,
    };
  }

  return { allowed: true, status: 'Available', reason: 'Available for assignment' };
}

export interface PayrollIdentityResolution {
  status: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS' | 'ERROR';
  employee: any | null;
  reason?: string;
  assignment?: any;
}

export function resolvePayrollEmployeeByIdentity(
  db: any,
  tenantId: string,
  projectId: string,
  externalRiderId: string,
  payrollMonth: string
): PayrollIdentityResolution {
  if (!externalRiderId || !externalRiderId.trim()) {
    return { status: 'UNMATCHED', employee: null, reason: 'Missing external rider ID.' };
  }

  const cleanExtId = externalRiderId.trim().toLowerCase();

  const parts = (payrollMonth || '').split('-');
  const year = parseInt(parts[0], 10) || new Date().getFullYear();
  const month = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const matchingAssignments = (db.employeeProjectAssignments || []).filter((a: any) => {
    if (a.tenant_id !== tenantId) return false;
    const pMatch = a.project_id === projectId ||
      (a.project_code && a.project_code.toLowerCase() === projectId.toLowerCase()) ||
      (a.project_name && a.project_name.toLowerCase().includes(projectId.toLowerCase())) ||
      (projectId.toLowerCase().includes('keeta') && (a.project_id?.toLowerCase().includes('keeta') || a.project_name?.toLowerCase().includes('keeta'))) ||
      (projectId.toLowerCase().includes('noon') && (a.project_id?.toLowerCase().includes('noon') || a.project_name?.toLowerCase().includes('noon')));
    if (!pMatch) return false;
    if (!a.external_rider_id || a.external_rider_id.trim().toLowerCase() !== cleanExtId) return false;

    const aStart = a.assignment_start_date || '1970-01-01';
    const aEnd = a.assignment_end_date || (a.status === 'ACTIVE' ? '9999-12-31' : aStart);

    return aStart <= periodEnd && aEnd >= periodStart;
  });

  const empIdsFromAssignments = Array.from(new Set(matchingAssignments.map((a: any) => a.employee_id)));

  if (empIdsFromAssignments.length > 1) {
    return {
      status: 'AMBIGUOUS',
      employee: null,
      reason: `AMBIGUOUS: External ID '${externalRiderId}' maps to multiple employees (${empIdsFromAssignments.length}) during ${payrollMonth}. Match is blocked as AMBIGUOUS.`
    };
  }

  if (empIdsFromAssignments.length === 1) {
    const empId = empIdsFromAssignments[0];
    const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);
    if (emp) {
      return { status: 'MATCHED', employee: emp, assignment: matchingAssignments[0] };
    }
  }

  const matchingMappings = (db.projectRiderMappings || []).filter((m: any) => {
    if (m.tenant_id !== tenantId) return false;
    const pMatch = m.project_id === projectId ||
      (m.project_name && m.project_name.toLowerCase().includes(projectId.toLowerCase())) ||
      (projectId.toLowerCase().includes('keeta') && (m.project_id?.toLowerCase().includes('keeta') || m.project_name?.toLowerCase().includes('keeta'))) ||
      (projectId.toLowerCase().includes('noon') && (m.project_id?.toLowerCase().includes('noon') || m.project_name?.toLowerCase().includes('noon')));
    if (!pMatch) return false;
    if (!m.external_rider_id || m.external_rider_id.trim().toLowerCase() !== cleanExtId) return false;
    return true;
  });

  const uniqueMappingEmpIds = Array.from(new Set(matchingMappings.map((m: any) => m.employee_id)));
  if (uniqueMappingEmpIds.length > 1) {
    return {
      status: 'AMBIGUOUS',
      employee: null,
      reason: `AMBIGUOUS: External ID '${externalRiderId}' maps to multiple records in ProjectRiderMapping.`
    };
  }

  if (uniqueMappingEmpIds.length === 1) {
    const empId = uniqueMappingEmpIds[0];
    const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);
    if (emp) {
      return { status: 'MATCHED', employee: emp };
    }
  }

  return {
    status: 'UNMATCHED',
    employee: null,
    reason: `UNMATCHED: External ID '${externalRiderId}' is not mapped to any employee for project in ${payrollMonth}.`
  };
}

export function ensureProjectsAndAssignmentsSeeded(db: any) {
  // Authoritative company_pixel_syntax projects initializer.
  // Never seed fake or demo projects. Loads authoritative projects and persistent assignments.
  if (!Array.isArray(db.projects) || db.projects.length === 0) {
    db.projects = [...AUTHORITATIVE_COMPANY_ALLIED_PROJECTS];
  }
  if (!Array.isArray(db.employeeProjectAssignments) || db.employeeProjectAssignments.length === 0) {
    const loaded = loadPersistentProjectAssignments();
    if (loaded && loaded.length > 0) {
      db.employeeProjectAssignments = loaded;
    } else {
      const initialAsgs: any[] = [];
      const now = new Date().toISOString();
      for (const emp of (db.masterEmployees || [])) {
        if (emp.project_id) {
          const proj = resolveAuthoritativeProject(emp.project_id, db.projects);
          if (proj) {
            initialAsgs.push({
              id: `epa_init_${emp.id}`,
              tenant_id: emp.tenant_id || 'company_pixel_syntax',
              employee_id: emp.id,
              employee_name: emp.full_name,
              employee_code: emp.employee_code,
              project_id: proj.id,
              project_name: proj.name,
              project_code: proj.code,
              external_rider_id: (emp as any).external_rider_id || null,
              external_id_type: proj.external_id_label || 'External Rider ID',
              assignment_start_date: '2025-01-01',
              status: 'ACTIVE',
              is_primary: true,
              notes: 'Initial authoritative deployment assignment',
              created_by: 'System Seed',
              created_at: now,
            });
          }
        }
      }
      db.employeeProjectAssignments = initialAsgs;
      if (initialAsgs.length > 0) {
        savePersistentProjectAssignments(initialAsgs);
      }
    }
  }
  if (!Array.isArray(db.projectRiderMappings)) db.projectRiderMappings = [];
}

export function createRiderProjectRouter(db: any) {
  const router = Router();

  // Helper to ensure required collections exist without seeding fake operational data
  const ensureSeeded = () => {
    ensureProjectsAndAssignmentsSeeded(db);
  };

  // ==============================================================================
  // 1. PROJECT SUMMARY & STATUS COUNTS (TOP CARDS)
  // ==============================================================================
  router.get('/summary', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);

    const emps = actor.isSuperAdmin
      ? db.masterEmployees || []
      : (db.masterEmployees || []).filter((e: any) => e.tenant_id === actor.tenantId);

    const assignments = actor.isSuperAdmin
      ? db.employeeProjectAssignments || []
      : (db.employeeProjectAssignments || []).filter((a: any) => a.tenant_id === actor.tenantId);

    const projectsList = actor.isSuperAdmin
      ? db.projects || []
      : (db.projects || []).filter((p: any) => p.tenant_id === actor.tenantId);

    // Active assignments by project
    const activeAssignments = assignments.filter((a: any) => a.status === 'ACTIVE');

    // Count unique employees per project
    const projectEmployeeSets: Record<string, Set<string>> = {};
    for (const a of activeAssignments) {
      if (!projectEmployeeSets[a.project_id]) {
        projectEmployeeSets[a.project_id] = new Set();
      }
      projectEmployeeSets[a.project_id].add(a.employee_id);
    }

    // Check multi-project employees
    const empActiveProjectsMap: Record<string, Set<string>> = {};
    for (const a of activeAssignments) {
      if (!empActiveProjectsMap[a.employee_id]) {
        empActiveProjectsMap[a.employee_id] = new Set();
      }
      empActiveProjectsMap[a.employee_id].add(a.project_id);
    }

    let multiProjectCount = 0;
    for (const empId in empActiveProjectsMap) {
      if (empActiveProjectsMap[empId].size > 1) {
        multiProjectCount++;
      }
    }

    // Projects list with active employee counts
    const projectCards = projectsList.map((p: any) => {
      const activeCount = emps.filter((e: any) =>
        isEmployeeMatchingProject(e, p, activeAssignments)
      ).length;
      return {
        id: p.id,
        name: p.name,
        code: p.code,
        client_name: p.client_name || p.name,
        status: p.status || 'ACTIVE',
        active_count: activeCount,
        branch_id: p.branch_id,
      };
    });

    // Count unassigned employees: employees with no active project assignments
    const assignedEmpIds = new Set(activeAssignments.map((a: any) => a.employee_id));
    const unassignedCount = emps.filter((e: any) => !assignedEmpIds.has(e.id)).length;

    // Canonical Status counts using single authoritative source
    const statusCounts = {
      activeAssigned: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Assigned / Active'
      ).length,
      availableUnassigned: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Available / Unassigned'
      ).length,
      onLeave: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'On Leave'
      ).length,
      emergencyLeave: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Emergency Leave'
      ).length,
      onHold: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'On Hold'
      ).length,
      absconding: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Absconding'
      ).length,
      terminated: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Terminated'
      ).length,
      exited: emps.filter(
        (e: any) => resolveEmployeeRecordStatus(e, activeAssignments) === 'Exited'
      ).length,
    };

    res.json({
      success: true,
      totalEmployees: emps.length,
      totalActiveAssignments: activeAssignments.length,
      multiProjectCount,
      unassignedCount,
      projects: projectCards,
      statusCounts,
    });
  });

  // ==============================================================================
  // 2. PAGINATED, SEARCHABLE EMPLOYEES WITH PROJECT ENRICHMENT
  // ==============================================================================
  router.get('/employees', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 15));
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    const projectId = (req.query.projectId as string) || 'ALL';
    const statusFilter = (req.query.status as string) || 'ALL';
    const branchFilter = (req.query.branchId as string) || 'ALL';
    const visaContractorFilter = ((req.query.visaContractor as string) || (req.query.contractor as string) || 'ALL').trim();
    const assignmentStatusFilter = ((req.query.assignmentStatus as string) || 'ALL').trim();
    const primaryAdditionalFilter = ((req.query.primaryAdditional as string) || 'ALL').trim();
    const hasMultiple = req.query.hasMultiple === 'true' || primaryAdditionalFilter === 'MULTIPLE';

    let emps = actor.isSuperAdmin
      ? db.masterEmployees || []
      : (db.masterEmployees || []).filter((e: any) => e.tenant_id === actor.tenantId);

    // Soft delete check
    emps = emps.filter((e: any) => !e.is_archived);

    const allAssignments = actor.isSuperAdmin
      ? db.employeeProjectAssignments || []
      : (db.employeeProjectAssignments || []).filter((a: any) => a.tenant_id === actor.tenantId);

    const allMappings = actor.isSuperAdmin
      ? db.projectRiderMappings || []
      : (db.projectRiderMappings || []).filter((m: any) => m.tenant_id === actor.tenantId);

    // Map active assignments by employee
    const activeAssignmentsByEmp: Record<string, EmployeeProjectAssignmentRecord[]> = {};
    const endedAssignmentsByEmp: Record<string, EmployeeProjectAssignmentRecord[]> = {};

    for (const a of allAssignments) {
      if (a.status === 'ACTIVE') {
        if (!activeAssignmentsByEmp[a.employee_id]) activeAssignmentsByEmp[a.employee_id] = [];
        activeAssignmentsByEmp[a.employee_id].push(a);
      } else {
        if (!endedAssignmentsByEmp[a.employee_id]) endedAssignmentsByEmp[a.employee_id] = [];
        endedAssignmentsByEmp[a.employee_id].push(a);
      }
    }

    // Filter by branch
    if (branchFilter && branchFilter !== 'ALL') {
      emps = emps.filter((e: any) => e.branch_id === branchFilter || e.branch === branchFilter);
    }

    // Filter by project
    if (projectId && projectId !== 'ALL') {
      if (projectId === 'UNASSIGNED') {
        emps = emps.filter((e: any) => {
          const actives = activeAssignmentsByEmp[e.id] || [];
          return actives.length === 0;
        });
      } else {
        emps = emps.filter((e: any) => {
          const actives = activeAssignmentsByEmp[e.id] || [];
          return actives.some((a) => a.project_id === projectId);
        });
      }
    }

    // Filter by Visa / Contractor
    if (visaContractorFilter && visaContractorFilter !== 'ALL') {
      const vf = visaContractorFilter.toLowerCase();
      emps = emps.filter((e: any) => {
        const vc = (e.visa_contractor_type || e.contractor || '').toLowerCase();
        const vn = (e.vendor_name || '').toLowerCase();
        return vc.includes(vf) || vn.includes(vf) || (vf === 'vendor' && Boolean(e.vendor_id || e.vendor_name));
      });
    }

    // Filter by Assignment Status (Active / Assigned vs Unassigned)
    if (assignmentStatusFilter && assignmentStatusFilter !== 'ALL') {
      const asf = assignmentStatusFilter.toUpperCase();
      if (asf === 'ACTIVE' || asf === 'ASSIGNED') {
        emps = emps.filter((e: any) => (activeAssignmentsByEmp[e.id] || []).length > 0);
      } else if (asf === 'UNASSIGNED' || asf === 'AVAILABLE') {
        emps = emps.filter((e: any) => (activeAssignmentsByEmp[e.id] || []).length === 0);
      }
    }

    // Filter by Primary / Additional
    if (primaryAdditionalFilter && primaryAdditionalFilter !== 'ALL') {
      const paf = primaryAdditionalFilter.toUpperCase();
      if (paf === 'PRIMARY') {
        emps = emps.filter((e: any) => {
          const actives = activeAssignmentsByEmp[e.id] || [];
          return actives.some((a) => a.is_primary);
        });
      } else if (paf === 'ADDITIONAL') {
        emps = emps.filter((e: any) => {
          const actives = activeAssignmentsByEmp[e.id] || [];
          return actives.some((a) => !a.is_primary);
        });
      } else if (paf === 'MULTIPLE') {
        emps = emps.filter((e: any) => {
          const actives = activeAssignmentsByEmp[e.id] || [];
          return actives.length > 1;
        });
      }
    }

    // Filter by canonical status
    if (statusFilter && statusFilter !== 'ALL') {
      const targetCanonical = resolveCanonicalStatus(statusFilter);
      emps = emps.filter((e: any) => {
        const curCanonical = resolveEmployeeRecordStatus(e, allAssignments);
        return curCanonical === targetCanonical;
      });
    }

    // Filter by multiple projects
    if (hasMultiple) {
      emps = emps.filter((e: any) => {
        const actives = activeAssignmentsByEmp[e.id] || [];
        return actives.length > 1;
      });
    }

    // Search filter across Employee Name, Code, EID, Passport, Mobile, External Rider ID
    if (search) {
      emps = emps.filter((e: any) => {
        const fullName = (e.full_name || '').toLowerCase();
        const code = (e.employee_code || '').toLowerCase();
        const eid = (e.emirates_id || e.emirates_id_number || '').toLowerCase();
        const passport = (e.passport_number || '').toLowerCase();
        const mobile = (e.mobile_number || e.personal_mobile || e.company_mobile || '').toLowerCase();

        if (
          fullName.includes(search) ||
          code.includes(search) ||
          eid.includes(search) ||
          passport.includes(search) ||
          mobile.includes(search)
        ) {
          return true;
        }

        // Check external IDs in active assignments
        const actives = activeAssignmentsByEmp[e.id] || [];
        if (actives.some((a) => (a.external_rider_id || '').toLowerCase().includes(search))) {
          return true;
        }

        // Check project mappings
        const empMappings = allMappings.filter((m: any) => m.employee_id === e.id);
        if (empMappings.some((m: any) => (m.external_rider_id || '').toLowerCase().includes(search))) {
          return true;
        }

        return false;
      });
    }

    const totalCount = emps.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedEmps = emps.slice(startIndex, startIndex + limit);

    // Enrich each employee
    const enrichedEmployees = paginatedEmps.map((emp: any) => {
      const actives = activeAssignmentsByEmp[emp.id] || [];
      const ended = endedAssignmentsByEmp[emp.id] || [];
      const primaryAssignment = actives.find((a) => a.is_primary) || actives[0] || null;

      // Extract all active external IDs for display
      const externalIds = actives
        .filter((a) => !!a.external_rider_id)
        .map((a) => ({
          project_id: a.project_id,
          project_name: a.project_name,
          external_rider_id: a.external_rider_id!,
          external_id_type: a.external_id_type || 'Rider ID',
          is_primary: a.is_primary,
          start_date: a.assignment_start_date,
        }));

      return {
        id: emp.id,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        visa_contractor_type: emp.visa_contractor_type || emp.contractor || 'Allied DXB',
        contractor: emp.contractor || emp.visa_contractor_type || 'Allied DXB',
        vendor_name: emp.vendor_name || '',
        vendor_id: emp.vendor_id || '',
        current_status: resolveEmployeeRecordStatus(emp, actives),
        raw_status: emp.current_status,
        branch_id: emp.branch_id,
        branch: emp.branch,
        mobile_number: emp.mobile_number || emp.personal_mobile,
        emirates_id: emp.emirates_id || emp.emirates_id_number,
        passport_number: emp.passport_number,
        designation: emp.designation,
        role_type: emp.role_type,
        current_bike_plate: emp.current_bike_plate,
        // Enriched Project Assignment properties
        active_assignments: actives,
        active_projects_count: actives.length,
        primary_project: primaryAssignment
          ? {
              id: primaryAssignment.id,
              project_id: primaryAssignment.project_id,
              project_name: primaryAssignment.project_name,
              project_code: primaryAssignment.project_code,
              external_rider_id: primaryAssignment.external_rider_id,
              external_id_type: primaryAssignment.external_id_type || 'Rider ID',
              start_date: primaryAssignment.assignment_start_date,
              is_primary: primaryAssignment.is_primary,
            }
          : null,
        latest_assignment_date: actives.length > 0 ? actives[0].assignment_start_date : null,
        ended_assignments_count: ended.length,
        external_ids: externalIds,
      };
    });

    res.json({
      success: true,
      employees: enrichedEmployees,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  });

  // ==============================================================================
  // 2B. LIVE VISA / CONTRACTOR OPTIONS MASTER
  // ==============================================================================
  router.get('/visa-contractors', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const emps = actor.isSuperAdmin
      ? db.masterEmployees || []
      : (db.masterEmployees || []).filter((e: any) => e.tenant_id === actor.tenantId);

    const normalizeContractorName = (value: any): string =>
      typeof value === 'string' ? value.trim().toLocaleUpperCase('en-US') : '';
    const set = new Set<string>([
      'ALLIED AUH',
      'ALLIED DXB',
      'OWN',
      'OWN VISA',
      'RAPID CREW',
      'VENDOR',
      'KHOKHAR BUILDING MAINTENANCE',
    ]);
    emps.forEach((e: any) => {
      const visaContractor = normalizeContractorName(e.visa_contractor_type);
      const contractor = normalizeContractorName(e.contractor);
      if (visaContractor) set.add(visaContractor);
      if (contractor) set.add(contractor);
    });
    if (Array.isArray(db.masterVisaContractorTypes)) {
      db.masterVisaContractorTypes.forEach((v: any) => {
        const name = normalizeContractorName(v.name);
        if (name) set.add(name);
      });
    }
    res.json({ success: true, visaContractors: Array.from(set).sort((a, b) => a.localeCompare(b)) });
  });

  // ==============================================================================
  // 2C. FAST SERVER-SIDE DEBOUNCED EMPLOYEE SEARCH FOR ASSIGNMENT
  // ==============================================================================
  router.get('/employee-search', async (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const q = ((req.query.q as string) || '').toLowerCase().trim();
    if (!q || q.length < 1) return res.json({ success: true, employees: [] });

    let emps: any[] = [];
    let allAssignments: any[] = [];

    const client = getSupabaseClient();
    if (client) {
      try {
        let empQuery = client
          .from('employees')
          .select('*')
          .eq('is_archived', false);
        if (!actor.isSuperAdmin) {
          empQuery = empQuery.eq('tenant_id', actor.tenantId);
        }
        const { data: sbEmps } = await empQuery;
        if (sbEmps && sbEmps.length > 0) {
          emps = sbEmps;
          // Sync into db.masterEmployees
          for (const emp of sbEmps) {
            const idx = (db.masterEmployees || []).findIndex((e: any) => e.id === emp.id);
            if (idx >= 0) {
              db.masterEmployees[idx] = { ...db.masterEmployees[idx], ...emp };
            } else {
              if (!db.masterEmployees) db.masterEmployees = [];
              db.masterEmployees.push(emp);
            }
          }
        }

        let asgQuery = client
          .from('employee_project_assignments')
          .select('*')
          .eq('status', 'ACTIVE');
        if (!actor.isSuperAdmin) {
          asgQuery = asgQuery.eq('tenant_id', actor.tenantId);
        }
        const { data: sbAsgs } = await asgQuery;
        if (sbAsgs && sbAsgs.length > 0) {
          allAssignments = sbAsgs;
          for (const asg of sbAsgs) {
            const idx = (db.employeeProjectAssignments || []).findIndex((a: any) => a.id === asg.id);
            if (idx >= 0) {
              db.employeeProjectAssignments[idx] = { ...db.employeeProjectAssignments[idx], ...asg };
            } else {
              if (!db.employeeProjectAssignments) db.employeeProjectAssignments = [];
              db.employeeProjectAssignments.push(asg);
            }
          }
        }
      } catch (err) {
        console.error('Failed to query Supabase in /employee-search:', err);
      }
    }

    if (allAssignments.length === 0) {
      allAssignments = actor.isSuperAdmin
        ? db.employeeProjectAssignments || []
        : (db.employeeProjectAssignments || []).filter((a: any) => a.tenant_id === actor.tenantId);
    }

    const matched = searchAuthoritativeEmployees(db, {
      query: q,
      tenantId: actor.tenantId,
      isSuperAdmin: actor.isSuperAdmin,
      limit: 30,
      includeArchived: false,
    });

    const results = matched.map((e: any) => {
      const activeAssignments = allAssignments.filter((a: any) => a.employee_id === e.id && a.status === 'ACTIVE');
      const primary = activeAssignments.find((a: any) => a.is_primary) || activeAssignments[0] || null;
      return {
        id: e.id,
        full_name: e.full_name || e.display_name,
        employee_code: e.employee_code,
        visa_contractor_type: e.visa_contractor_type || e.contractor || e.employment_type || 'Allied DXB',
        vendor_name: e.vendor_name || '',
        branch: e.branch || e.branch_name || 'Dubai Main',
        branch_id: e.branch_id || 'b_dxb',
        current_bike_plate: e.current_bike_plate || null,
        current_sim_number: e.current_sim_number || null,
        emirates_id: e.emirates_id || e.emirates_id_number || null,
        mobile_number: e.mobile_number || e.personal_mobile || e.company_mobile || null,
        current_status: resolveCanonicalStatus(e.current_status || (activeAssignments.length > 0 ? 'Assigned / Active' : 'Available / Unassigned')),
        current_primary_project: primary ? primary.project_name : (e.project_name || 'None'),
        active_assignments_count: activeAssignments.length,
        active_assignments: activeAssignments,
      };
    });

    res.json({ success: true, employees: results });
  });

  // ==============================================================================
  // 3. EMPLOYEE ASSIGNMENTS DETAIL & HISTORY (FOR TIMELINE / MODAL)
  // ==============================================================================
  router.get('/employees/:id/assignments', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const empId = req.params.id;

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === empId || e.employee_id === empId) && (actor.isSuperAdmin || e.tenant_id === actor.tenantId)
    );

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const assignments = (db.employeeProjectAssignments || []).filter(
      (a: any) => a.employee_id === emp.id && (actor.isSuperAdmin || a.tenant_id === actor.tenantId)
    );

    const activeAssignments = assignments
      .filter((a: any) => a.status === 'ACTIVE')
      .sort((a: any, b: any) => new Date(b.assignment_start_date).getTime() - new Date(a.assignment_start_date).getTime());

    const endedAssignments = assignments
      .filter((a: any) => a.status === 'ENDED')
      .sort(
        (a: any, b: any) =>
          new Date(b.assignment_end_date || b.created_at).getTime() -
          new Date(a.assignment_end_date || a.created_at).getTime()
      );

    const statusHistory = (db.employeeStatusHistory || [])
      .filter((h: any) => h.employee_id === emp.id)
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    res.json({
      success: true,
      employee: {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        current_status: emp.current_status,
        branch: emp.branch,
        mobile_number: emp.mobile_number,
        emirates_id: emp.emirates_id,
        passport_number: emp.passport_number,
      },
      activeAssignments,
      endedAssignments,
      statusHistory,
    });
  });

  // ==============================================================================
  // 4. ASSIGN PROJECT (SUPPORTS MULTIPLE ACTIVE PROJECTS, INLINE EXTERNAL ID)
  // ==============================================================================
  router.post('/assign', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const {
      employee_id,
      project_id,
      assignment_start_date,
      assignment_end_date,
      external_rider_id,
      external_id_type,
      location_state,
      is_primary,
      notes,
    } = req.body;

    if (!employee_id || !project_id) {
      return res.status(400).json({ error: 'Employee ID and Project ID are required.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id) && (actor.isSuperAdmin || e.tenant_id === actor.tenantId || e.tenant_id === 'company_pixel_syntax')
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found in Master Employees.' });

    const project = resolveAuthoritativeProject(project_id, db.projects) || (db.projects || []).find(
      (p: any) => p.id === project_id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId || p.tenant_id === 'company_pixel_syntax')
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    // Status eligibility check: Lifecycle overrides cannot receive a project assignment
    if (isLifecycleOverrideStatus(emp.current_status)) {
      return res.status(400).json({
        error: `Employee is not eligible for project assignment in lifecycle override status ("${emp.current_status}"). Lifecycle overrides must be resolved first.`
      });
    }

    // Inactive projects cannot receive new assignments
    if (project.status && (project.status === 'INACTIVE' || project.status === 'ARCHIVED' || project.status === 'Inactive / Archived' || project.status.toLowerCase().includes('inactive'))) {
      return res.status(400).json({
        error: `Project '${project.name}' is Inactive / Archived and cannot receive new assignments.`
      });
    }

    // Check if employee ALREADY has an ACTIVE assignment for this exact project
    const existingActiveAssignment = (db.employeeProjectAssignments || []).find(
      (a: any) =>
        a.employee_id === emp.id &&
        a.project_id === project.id &&
        a.status === 'ACTIVE' &&
        (actor.isSuperAdmin || a.tenant_id === actor.tenantId)
    );

    if (existingActiveAssignment) {
      return res.status(400).json({
        error: `Employee '${emp.full_name}' is already actively assigned to project '${project.name}'.`,
      });
    }

    const now = new Date().toISOString();
    const startDate = assignment_start_date || now.split('T')[0];

    // DETERMINISTIC MAPPING & OVERLAP SAFETY:
    // The same tenant + project + external_rider_id must never have overlapping assignment periods across multiple employees.
    if (external_rider_id && external_rider_id.trim()) {
      const overlapCheck = validateExternalRiderIdOverlap(
        db,
        emp.tenant_id || actor.tenantId,
        project.id,
        external_rider_id.trim(),
        emp.id,
        startDate,
        assignment_end_date
      );
      if (!overlapCheck.allowed) {
        return res.status(400).json({ error: overlapCheck.reason });
      }
    }

    // Dynamic external ID label
    const idConfig = getProjectExternalIdConfig(project);
    const resolvedIdType = external_id_type || idConfig.label;

    // Check existing active assignments for this employee
    const currentActiveAssignments = (db.employeeProjectAssignments || []).filter(
      (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
    );

    // Determine if this assignment should be primary
    // If user explicitly checked is_primary, or if this is the employee's first active project
    const shouldBePrimary = is_primary === true || currentActiveAssignments.length === 0;

    // If new assignment is primary, reset primary flag on all other active assignments
    if (shouldBePrimary) {
      currentActiveAssignments.forEach((a: any) => {
        a.is_primary = false;
      });
    }

    const assignmentRecord: EmployeeProjectAssignmentRecord = {
      id: `epa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: emp.tenant_id || actor.tenantId,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      project_id: project.id,
      project_name: project.name,
      project_code: project.code,
      external_rider_id: external_rider_id?.trim() || undefined,
      external_id_type: resolvedIdType,
      assignment_start_date: startDate,
      assignment_end_date: assignment_end_date || undefined,
      status: 'ACTIVE',
      is_primary: shouldBePrimary,
      location_state: location_state || 'Dubai',
      notes: notes || '',
      created_by: actor.userName,
      created_at: now,
    };

    db.employeeProjectAssignments.push(assignmentRecord);
    savePersistentProjectAssignments(db.employeeProjectAssignments);

    // Save/upsert External Rider ID to db.projectRiderMappings
    if (external_rider_id && external_rider_id.trim()) {
      const cleanExtId = external_rider_id.trim();
      const existingMapping = (db.projectRiderMappings || []).find(
        (m: any) =>
          m.tenant_id === actor.tenantId &&
          m.project_id === project.id &&
          m.external_rider_id.toLowerCase() === cleanExtId.toLowerCase()
      );

      if (existingMapping) {
        if (existingMapping.employee_id !== emp.id && existingMapping.is_active) {
          return res.status(400).json({
            error: `External ID '${cleanExtId}' is already actively mapped to another employee (${existingMapping.employee_name}). Overlapping active ownership is blocked.`
          });
        }
        existingMapping.employee_id = emp.id;
        existingMapping.employee_code = emp.employee_code;
        existingMapping.employee_name = emp.full_name;
        existingMapping.external_rider_id = cleanExtId;
        existingMapping.is_active = true;
        existingMapping.updated_at = now;
      } else {
        db.projectRiderMappings.push({
          id: `prm_${Date.now()}_${emp.id}`,
          tenant_id: actor.tenantId,
          project_id: project.id,
          project_name: project.name,
          external_rider_id: cleanExtId,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          is_active: true,
          created_at: now,
        });
      }
    }

    // Sync Employee Master project fields if primary
    if (shouldBePrimary) {
      emp.project_id = project.id;
      emp.project_name = project.name;
      emp.project_code = project.code;
      emp.current_project = project.name;
      emp.external_rider_id = external_rider_id?.trim() || null;
      emp.employee_code_on_project = external_rider_id?.trim() || null;
      emp.external_id_type = resolvedIdType;
    }

    // Update current_status to canonical Assigned / Active if not in a lifecycle override
    if (!isLifecycleOverrideStatus(emp.current_status)) {
      emp.current_status = 'Assigned / Active';
    }
    emp.updated_at = now;
    emp.updated_by = actor.userName;

    // Timeline event
    if (!db.employeeTimelineEvents) db.employeeTimelineEvents = [];
    db.employeeTimelineEvents.push({
      id: `ete_${Date.now()}`,
      tenant_id: emp.tenant_id,
      employee_id: emp.id,
      event_type: 'PROJECT_ASSIGNED',
      event_category: 'PROJECT',
      title: `Assigned to ${project.name}`,
      description: `Assigned to ${project.name} (${project.code})${shouldBePrimary ? ' as Primary Project' : ' as Additional Project'}. Start Date: ${startDate}.${external_rider_id ? ` External ID: ${external_rider_id}.` : ''}`,
      performed_by: actor.userName,
      performed_by_role: actor.userRole,
      created_at: now,
    });

    // Universal Audit Log
    logUniversalAudit(db, actor, {
      action: 'ASSIGN_PROJECT',
      actionType: 'CREATE',
      module: 'Rider / Project Management',
      entityType: 'PROJECT_ASSIGNMENT',
      entityId: assignmentRecord.id,
      details: `Assigned ${emp.full_name} (${emp.employee_code}) to project ${project.name} (${shouldBePrimary ? 'Primary' : 'Additional'})`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(200).json({
      success: true,
      message: `Successfully assigned ${emp.full_name} to ${project.name}.`,
      assignment: assignmentRecord,
      employee: emp,
    });
  });

  // ==============================================================================
  // 5. UNASSIGN / END PROJECT ASSIGNMENT (AUDITED, NEVER HARD-DELETED)
  // ==============================================================================
  router.post('/end-assignment', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { assignment_id, end_date, end_reason, notes } = req.body;

    if (!assignment_id) {
      return res.status(400).json({ error: 'Assignment ID is required.' });
    }
    if (!end_date) {
      return res.status(400).json({ error: 'End Date is required.' });
    }
    if (!end_reason) {
      return res.status(400).json({ error: 'Reason for ending assignment is required.' });
    }

    const assignment = (db.employeeProjectAssignments || []).find(
      (a: any) => a.id === assignment_id && (actor.isSuperAdmin || a.tenant_id === actor.tenantId)
    );
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment record not found.' });
    }
    if (assignment.status === 'ENDED') {
      return res.status(400).json({ error: 'This project assignment is already ended.' });
    }

    const now = new Date().toISOString();
    assignment.status = 'ENDED';
    assignment.assignment_end_date = end_date;
    assignment.ended_by = actor.userName;
    assignment.ended_at = now;
    assignment.end_reason = end_reason;
    if (notes) {
      assignment.notes = `${assignment.notes ? assignment.notes + ' | ' : ''}Ended: ${notes}`;
    }

    const emp = (db.masterEmployees || []).find((e: any) => e.id === assignment.employee_id);

    // Remaining active projects for this employee
    const remainingActive = (db.employeeProjectAssignments || []).filter(
      (a: any) => a.employee_id === assignment.employee_id && a.status === 'ACTIVE'
    );

    const { replacement_primary_assignment_id } = req.body;

    if (assignment.is_primary) {
      assignment.is_primary = false;
      if (remainingActive.length > 0) {
        if (replacement_primary_assignment_id === 'NONE') {
          // Explicitly configured to have no primary
          remainingActive.forEach((a: any) => { a.is_primary = false; });
          if (emp) {
            emp.project_id = '';
            emp.project_name = '';
            emp.project_code = '';
          }
        } else if (replacement_primary_assignment_id) {
          // Explicit replacement selected by operator
          const selected = remainingActive.find((a: any) => a.id === replacement_primary_assignment_id);
          if (selected) {
            remainingActive.forEach((a: any) => { a.is_primary = false; });
            selected.is_primary = true;
            if (emp) {
              emp.project_id = selected.project_id;
              emp.project_name = selected.project_name;
              emp.project_code = selected.project_code;
            }
          }
        } else if (remainingActive.length === 1) {
          // Exactly one project remains, automatically keep as primary
          remainingActive[0].is_primary = true;
          if (emp) {
            emp.project_id = remainingActive[0].project_id;
            emp.project_name = remainingActive[0].project_name;
            emp.project_code = remainingActive[0].project_code;
          }
        }
      } else {
        // No remaining active projects
        if (emp) {
          emp.project_id = '';
          emp.project_name = '';
          emp.project_code = '';
          emp.current_project = '';
          if (!isLifecycleOverrideStatus(emp.current_status)) {
            emp.current_status = 'Available / Unassigned';
          }
        }
      }
    } else if (remainingActive.length === 0 && emp) {
      emp.project_id = '';
      emp.project_name = '';
      emp.project_code = '';
      emp.current_project = '';
      if (!isLifecycleOverrideStatus(emp.current_status)) {
        emp.current_status = 'Available / Unassigned';
      }
    }

    if (emp) {
      emp.updated_at = now;
      emp.updated_by = actor.userName;
    }

    // Deactivate projectRiderMapping if no other active assignments exist for this project
    const otherActiveForSameProject = (db.employeeProjectAssignments || []).some(
      (a: any) =>
        a.employee_id === assignment.employee_id &&
        a.project_id === assignment.project_id &&
        a.status === 'ACTIVE'
    );
    if (!otherActiveForSameProject) {
      const mapping = (db.projectRiderMappings || []).find(
        (m: any) =>
          m.tenant_id === actor.tenantId &&
          m.employee_id === assignment.employee_id &&
          m.project_id === assignment.project_id
      );
      if (mapping) {
        mapping.is_active = false;
        mapping.updated_at = now;
      }
    }

    // Timeline event
    if (!db.employeeTimelineEvents) db.employeeTimelineEvents = [];
    db.employeeTimelineEvents.push({
      id: `ete_${Date.now()}`,
      tenant_id: assignment.tenant_id,
      employee_id: assignment.employee_id,
      event_type: 'PROJECT_UNASSIGNED',
      event_category: 'PROJECT',
      title: `Ended Assignment: ${assignment.project_name}`,
      description: `Ended assignment for ${assignment.project_name}. Reason: ${end_reason}. Effective: ${end_date}.`,
      performed_by: actor.userName,
      performed_by_role: actor.userRole,
      created_at: now,
    });

    // Audit log
    logUniversalAudit(db, actor, {
      action: 'END_PROJECT_ASSIGNMENT',
      actionType: 'UPDATE',
      module: 'Rider / Project Management',
      entityType: 'PROJECT_ASSIGNMENT',
      entityId: assignment.id,
      details: `Ended assignment of ${assignment.employee_name} on ${assignment.project_name}. Reason: ${end_reason}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    savePersistentProjectAssignments(db.employeeProjectAssignments);

    res.json({
      success: true,
      message: `Assignment on ${assignment.project_name} successfully ended.`,
      assignment,
      remainingActiveCount: remainingActive.length,
    });
  });

  // ==============================================================================
  // 6. MOVE PROJECT (END OLD ASSIGNMENT + CREATE NEW ASSIGNMENT TRANSACTIONALLY)
  // ==============================================================================
  router.post('/move', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const {
      employee_id,
      old_assignment_id,
      new_project_id,
      end_date,
      end_reason,
      start_date,
      external_rider_id,
      location_state,
      notes,
    } = req.body;

    if (!employee_id || !new_project_id) {
      return res.status(400).json({ error: 'Employee ID and new Project ID are required.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id) && (actor.isSuperAdmin || e.tenant_id === actor.tenantId || e.tenant_id === 'company_pixel_syntax')
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    // Status eligibility check: Only eligible employees can receive project assignment/move
    // Status eligibility check: Lifecycle overrides cannot be reassigned
    if (isLifecycleOverrideStatus(emp.current_status)) {
      return res.status(400).json({
        error: `Employee is not eligible for project reassignment in lifecycle override status ("${emp.current_status}"). Please update status first.`
      });
    }

    const newProj = resolveAuthoritativeProject(new_project_id, db.projects) || (db.projects || []).find(
      (p: any) => p.id === new_project_id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId || p.tenant_id === 'company_pixel_syntax')
    );
    if (!newProj) return res.status(404).json({ error: 'New project not found.' });

    // Inactive projects cannot receive new assignments
    if (newProj.status && (newProj.status === 'INACTIVE' || newProj.status === 'ARCHIVED' || newProj.status === 'Inactive / Archived' || newProj.status.toLowerCase().includes('inactive'))) {
      return res.status(400).json({
        error: `Destination project '${newProj.name}' is Inactive / Archived and cannot receive new assignments.`
      });
    }

    const now = new Date().toISOString();
    const effEndDate = end_date || now.split('T')[0];
    const effStartDate = start_date || now.split('T')[0];
    const reason = end_reason || 'Project Changed';

    // DETERMINISTIC MAPPING & OVERLAP SAFETY FOR NEW PROJECT:
    if (external_rider_id && external_rider_id.trim()) {
      const overlapCheck = validateExternalRiderIdOverlap(
        db,
        emp.tenant_id || actor.tenantId,
        newProj.id,
        external_rider_id.trim(),
        emp.id,
        effStartDate
      );
      if (!overlapCheck.allowed) {
        return res.status(400).json({ error: overlapCheck.reason });
      }
    }

    let wasPrimary = true;

    // 1. End old assignment if specified, or find the active primary assignment
    if (old_assignment_id) {
      const oldAssignment = (db.employeeProjectAssignments || []).find(
        (a: any) => a.id === old_assignment_id && a.status === 'ACTIVE'
      );
      if (oldAssignment) {
        wasPrimary = oldAssignment.is_primary;
        oldAssignment.status = 'ENDED';
        oldAssignment.assignment_end_date = effEndDate;
        oldAssignment.end_reason = reason;
        oldAssignment.ended_by = actor.userName;
        oldAssignment.ended_at = now;
        oldAssignment.is_primary = false;
        oldAssignment.notes = `${oldAssignment.notes || ''} | Moved to ${newProj.name} on ${effStartDate}`.trim();
      }
    }

    const idConfig = getProjectExternalIdConfig(newProj);
    const resolvedIdType = req.body.external_id_type || idConfig.label;

    // 2. Create new assignment
    const newAssignment: EmployeeProjectAssignmentRecord = {
      id: `epa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: emp.tenant_id || actor.tenantId,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      project_id: newProj.id,
      project_name: newProj.name,
      project_code: newProj.code,
      external_rider_id: external_rider_id?.trim() || undefined,
      external_id_type: resolvedIdType,
      assignment_start_date: effStartDate,
      status: 'ACTIVE',
      is_primary: wasPrimary,
      location_state: location_state || 'Dubai',
      notes: notes || `Moved from previous assignment. Reason: ${reason}`,
      created_by: actor.userName,
      created_at: now,
    };

    db.employeeProjectAssignments.push(newAssignment);

    // Save external rider ID mapping if supplied
    if (external_rider_id && external_rider_id.trim()) {
      const cleanExtId = external_rider_id.trim();
      const existingMapping = (db.projectRiderMappings || []).find(
        (m: any) =>
          m.tenant_id === actor.tenantId &&
          m.project_id === newProj.id &&
          m.external_rider_id.toLowerCase() === cleanExtId.toLowerCase()
      );

      if (existingMapping) {
        if (existingMapping.employee_id !== emp.id && existingMapping.is_active) {
          return res.status(400).json({
            error: `External ID '${cleanExtId}' is already actively mapped to another employee (${existingMapping.employee_name}) on project ${newProj.name}. Overlapping active ownership is blocked.`
          });
        }
        existingMapping.employee_id = emp.id;
        existingMapping.employee_code = emp.employee_code;
        existingMapping.employee_name = emp.full_name;
        existingMapping.external_rider_id = cleanExtId;
        existingMapping.is_active = true;
        existingMapping.updated_at = now;
      } else {
        db.projectRiderMappings.push({
          id: `prm_${Date.now()}_${emp.id}`,
          tenant_id: actor.tenantId,
          project_id: newProj.id,
          project_name: newProj.name,
          external_rider_id: cleanExtId,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          is_active: true,
          created_at: now,
        });
      }
    }

    // Sync master employee
    if (wasPrimary) {
      emp.project_id = newProj.id;
      emp.project_name = newProj.name;
      emp.project_code = newProj.code;
      emp.current_project = newProj.name;
      emp.external_rider_id = external_rider_id?.trim() || null;
      emp.employee_code_on_project = external_rider_id?.trim() || null;
      emp.external_id_type = resolvedIdType;
    }
    if (!isLifecycleOverrideStatus(emp.current_status)) {
      emp.current_status = 'Assigned / Active';
    }
    emp.updated_at = now;
    emp.updated_by = actor.userName;

    // Timeline event
    if (!db.employeeTimelineEvents) db.employeeTimelineEvents = [];
    db.employeeTimelineEvents.push({
      id: `ete_${Date.now()}`,
      tenant_id: emp.tenant_id,
      employee_id: emp.id,
      event_type: 'PROJECT_TRANSFERRED',
      event_category: 'PROJECT',
      title: `Moved to ${newProj.name}`,
      description: `Transferred to ${newProj.name}. Reason: ${reason}. Effective: ${effStartDate}.`,
      performed_by: actor.userName,
      performed_by_role: actor.userRole,
      created_at: now,
    });

    logUniversalAudit(db, actor, {
      action: 'MOVE_PROJECT',
      actionType: 'UPDATE',
      module: 'Rider / Project Management',
      entityType: 'PROJECT_ASSIGNMENT',
      entityId: newAssignment.id,
      details: `Moved ${emp.full_name} (${emp.employee_code}) to ${newProj.name}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    savePersistentProjectAssignments(db.employeeProjectAssignments);

    res.json({
      success: true,
      message: `Successfully transferred ${emp.full_name} to ${newProj.name}.`,
      assignment: newAssignment,
    });
  });

  // ==============================================================================
  // 7. SET PRIMARY PROJECT
  // ==============================================================================
  router.post('/set-primary', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { employee_id, assignment_id } = req.body;

    if (!employee_id || !assignment_id) {
      return res.status(400).json({ error: 'Employee ID and Assignment ID are required.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id) && (actor.isSuperAdmin || e.tenant_id === actor.tenantId)
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const activeAssignments = (db.employeeProjectAssignments || []).filter(
      (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
    );

    const targetAssignment = activeAssignments.find((a: any) => a.id === assignment_id);
    if (!targetAssignment) {
      return res.status(404).json({ error: 'Active assignment record not found.' });
    }

    // Set target as primary, reset others
    activeAssignments.forEach((a: any) => {
      a.is_primary = a.id === assignment_id;
    });

    // Update master employee
    const now = new Date().toISOString();
    emp.project_id = targetAssignment.project_id;
    emp.project_name = targetAssignment.project_name;
    emp.project_code = targetAssignment.project_code;
    emp.updated_at = now;
    emp.updated_by = actor.userName;

    logUniversalAudit(db, actor, {
      action: 'SET_PRIMARY_PROJECT',
      actionType: 'UPDATE',
      module: 'Rider / Project Management',
      entityType: 'PROJECT_ASSIGNMENT',
      entityId: targetAssignment.id,
      details: `Set primary project of ${emp.full_name} to ${targetAssignment.project_name}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `${targetAssignment.project_name} is now the primary project for ${emp.full_name}.`,
      primaryAssignment: targetAssignment,
    });
  });

  // ==============================================================================
  // 8. CHANGE EMPLOYEE STATUS (DIRECT AUDITED WORKFLOW)
  // ==============================================================================
  router.post('/change-status', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { employee_id, status, effective_date, reason, notes } = req.body;

    if (!employee_id || !status) {
      return res.status(400).json({ error: 'Employee ID and Status are required.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id) && (actor.isSuperAdmin || e.tenant_id === actor.tenantId)
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    const now = new Date().toISOString();
    const oldStatus = emp.current_status || 'Available / Unassigned';
    const effDate = effective_date || now.split('T')[0];
    const hasProject = hasActiveProjectAssignment(emp, db.employeeProjectAssignments);
    const canonicalStatus = resolveCanonicalEmployeeStatus(status, hasProject);

    emp.current_status = canonicalStatus;
    emp.status_reason = reason || '';
    emp.status_effective_date = effDate;
    emp.updated_at = now;
    emp.updated_by = actor.userName;

    // 1. TERMINATED: end all active project assignments, effective date = termination effective date, reason = 'Employee Terminated', preserve complete history
    // 2. EXITED: end all active project assignments, effective date = exit effective date, reason = 'Employee Exited', preserve complete history
    // 3. ABSCONDING: DO NOT automatically end project assignments. Absconding is an Employee Working Status. Keep existing project assignments intact unless an operator explicitly ends them.
    // 4. ON HOLD / ON LEAVE: Also do NOT automatically end project assignments.
    if (canonicalStatus === 'Terminated' || canonicalStatus === 'Exited') {
      const activeAssignments = (db.employeeProjectAssignments || []).filter(
        (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
      );
      const endReason = canonicalStatus === 'Terminated' ? 'Employee Terminated' : 'Employee Exited';
      for (const a of activeAssignments) {
        a.status = 'ENDED';
        a.assignment_end_date = effDate;
        a.ended_by = actor.userName;
        a.ended_at = now;
        a.end_reason = endReason;
        a.is_primary = false;
      }
      emp.project_id = '';
      emp.project_name = '';
      emp.project_code = '';
      emp.current_project = '';
    }

    // Record Status History
    if (!db.employeeStatusHistory) db.employeeStatusHistory = [];
    const historyEntry = {
      id: `esh_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: emp.tenant_id || actor.tenantId,
      employee_id: emp.id,
      status: canonicalStatus,
      raw_status: status,
      reason: reason || `Status changed from ${oldStatus} to ${canonicalStatus}`,
      effective_from: effDate,
      notes: notes || '',
      changed_by: actor.userName,
      created_at: now,
    };
    db.employeeStatusHistory.push(historyEntry);

    // Record Timeline
    if (!db.employeeTimelineEvents) db.employeeTimelineEvents = [];
    db.employeeTimelineEvents.push({
      id: `ete_${Date.now()}`,
      tenant_id: emp.tenant_id,
      employee_id: emp.id,
      event_type: 'STATUS_CHANGED',
      event_category: 'STATUS',
      title: `Status Changed to ${canonicalStatus}`,
      description: `Transitioned from ${oldStatus} to ${canonicalStatus}. Reason: ${reason || 'Operational update'}. Effective: ${effDate}.`,
      performed_by: actor.userName,
      performed_by_role: actor.userRole,
      created_at: now,
    });

    // Audit Log
    logUniversalAudit(db, actor, {
      action: 'CHANGE_STATUS',
      actionType: 'UPDATE',
      module: 'Rider / Project Management',
      entityType: 'EMPLOYEE',
      entityId: emp.id,
      details: `Changed status of ${emp.full_name} (${emp.employee_code}) from ${oldStatus} to ${status}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Status of ${emp.full_name} successfully updated to ${status}.`,
      employee: emp,
      historyEntry,
    });
  });

  // ==============================================================================
  // 9. BULK ASSIGN PROJECTS
  // ==============================================================================
  router.post('/bulk-assign', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { employee_ids, project_id, start_date, location_state, notes } = req.body;

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({ error: 'At least one employee must be selected.' });
    }
    if (!project_id) {
      return res.status(400).json({ error: 'Target project is required.' });
    }

    const project = (db.projects || []).find(
      (p: any) => p.id === project_id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId)
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const now = new Date().toISOString();
    const effDate = start_date || now.split('T')[0];
    const assignedResults: any[] = [];
    const skippedResults: any[] = [];

    for (const empId of employee_ids) {
      const emp = (db.masterEmployees || []).find((e: any) => e.id === empId);
      if (!emp) {
        skippedResults.push({ id: empId, reason: 'Employee not found' });
        continue;
      }

      // Status eligibility check: lifecycle overrides cannot be assigned
      if (isLifecycleOverrideStatus(emp.current_status)) {
        skippedResults.push({ id: empId, name: emp.full_name, reason: `Ineligible in lifecycle override status ${emp.current_status}` });
        continue;
      }

      // Check if already actively assigned
      const alreadyAssigned = (db.employeeProjectAssignments || []).some(
        (a: any) => a.employee_id === emp.id && a.project_id === project.id && a.status === 'ACTIVE'
      );
      if (alreadyAssigned) {
        skippedResults.push({ id: empId, name: emp.full_name, reason: 'Already assigned to this project' });
        continue;
      }

      const activeList = (db.employeeProjectAssignments || []).filter(
        (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
      );
      const isPrimary = activeList.length === 0;

      const record: EmployeeProjectAssignmentRecord = {
        id: `epa_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        tenant_id: emp.tenant_id || actor.tenantId,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        project_id: project.id,
        project_name: project.name,
        project_code: project.code,
        assignment_start_date: effDate,
        status: 'ACTIVE',
        is_primary: isPrimary,
        location_state: location_state || 'Dubai',
        notes: notes || 'Bulk assigned',
        created_by: actor.userName,
        created_at: now,
      };

      db.employeeProjectAssignments.push(record);

      if (isPrimary) {
        emp.project_id = project.id;
        emp.project_name = project.name;
        emp.project_code = project.code;
        emp.current_project = project.name;
      }
      if (!isLifecycleOverrideStatus(emp.current_status)) {
        emp.current_status = 'Assigned / Active';
      }
      emp.updated_at = now;

      assignedResults.push({ id: emp.id, name: emp.full_name, assignmentId: record.id });
    }

    logUniversalAudit(db, actor, {
      action: 'BULK_ASSIGN_PROJECT',
      actionType: 'CREATE',
      module: 'Rider / Project Management',
      entityType: 'PROJECT',
      entityId: project.id,
      details: `Bulk assigned ${assignedResults.length} employees to project ${project.name}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Assigned ${assignedResults.length} employees to ${project.name}.${skippedResults.length > 0 ? ` Skipped ${skippedResults.length}.` : ''}`,
      assignedCount: assignedResults.length,
      skippedCount: skippedResults.length,
      assigned: assignedResults,
      skipped: skippedResults,
    });
  });

  // ==============================================================================
  // 10. EXTERNAL ID LOOKUP (AUTO-FILL FROM EXISTING MAPPINGS)
  // ==============================================================================
  router.get('/external-id-lookup', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { employee_id, project_id } = req.query;

    if (!employee_id || !project_id) {
      return res.json({ found: false, external_rider_id: '' });
    }

    const mapping = (db.projectRiderMappings || []).find(
      (m: any) =>
        m.employee_id === employee_id &&
        m.project_id === project_id &&
        (actor.isSuperAdmin || m.tenant_id === actor.tenantId)
    );

    if (mapping && mapping.external_rider_id) {
      return res.json({
        found: true,
        external_rider_id: mapping.external_rider_id,
        is_active: mapping.is_active,
      });
    }

    // Also check past project assignments
    const pastAssign = (db.employeeProjectAssignments || []).find(
      (a: any) =>
        a.employee_id === employee_id &&
        a.project_id === project_id &&
        a.external_rider_id &&
        (actor.isSuperAdmin || a.tenant_id === actor.tenantId)
    );

    if (pastAssign && pastAssign.external_rider_id) {
      return res.json({
        found: true,
        external_rider_id: pastAssign.external_rider_id,
        is_active: pastAssign.status === 'ACTIVE',
      });
    }

    res.json({ found: false, external_rider_id: '' });
  });

  // ==============================================================================
  // 11. VALIDATE EXTERNAL RIDER ID (LIVE CONFLICT / OVERLAP DETECTION)
  // ==============================================================================
  router.get('/validate-external-id', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { project_id, external_rider_id, employee_id, start_date, end_date } = req.query as Record<string, string>;

    if (!project_id || !external_rider_id) {
      return res.json({ valid: true });
    }

    const check = validateExternalRiderIdOverlap(
      db,
      actor.tenantId,
      project_id,
      external_rider_id,
      employee_id || '',
      start_date || new Date().toISOString().split('T')[0],
      end_date || null
    );

    res.json({
      valid: check.allowed,
      status: check.status,
      message: check.reason,
      conflictingAssignment: check.conflictingAssignment,
    });
  });

  // ==============================================================================
  // 12. GET PROJECT EXTERNAL ID CONFIGURATION (DYNAMIC LABEL & FORMAT)
  // ==============================================================================
  router.get('/external-id-config/:projectId', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const project = (db.projects || []).find(
      (p: any) => p.id === req.params.projectId && (actor.isSuperAdmin || p.tenant_id === actor.tenantId)
    );

    const config = getProjectExternalIdConfig(project);
    res.json(config);
  });

  // ==============================================================================
  // 12B. UPDATE EXTERNAL PROJECT EMPLOYEE ID FOR AN ASSIGNMENT
  // ==============================================================================
  router.post('/update-external-id', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { employee_id, assignment_id, external_rider_id } = req.body;
    if (!employee_id) {
      return res.status(400).json({ error: 'Employee ID is required.' });
    }
    const cleanExtId = external_rider_id !== undefined && external_rider_id !== null ? String(external_rider_id).trim() : '';
    if (!cleanExtId) {
      return res.status(400).json({ error: 'External Project Employee ID cannot be empty.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id || e.employee_code === employee_id) &&
        (actor.isSuperAdmin || e.tenant_id === actor.tenantId || e.tenant_id === 'company_pixel_syntax')
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found.' });

    let assignment = (db.employeeProjectAssignments || []).find((a: any) => {
      if (assignment_id) return a.id === assignment_id;
      return a.employee_id === emp.id && a.status === 'ACTIVE';
    });

    const now = new Date().toISOString();
    if (assignment) {
      assignment.external_rider_id = cleanExtId;
      assignment.employee_code_on_project = cleanExtId;
      assignment.updated_at = now;
      savePersistentProjectAssignments(db.employeeProjectAssignments);
    }

    emp.external_rider_id = cleanExtId;
    emp.employee_code_on_project = cleanExtId;
    emp.updated_at = now;

    // Update active project rider mapping
    if (db.projectRiderMappings) {
      const existingMapping = db.projectRiderMappings.find(
        (m: any) => m.employee_id === emp.id && m.is_active
      );
      if (existingMapping) {
        existingMapping.external_rider_id = cleanExtId;
        existingMapping.updated_at = now;
      }
    }

    return res.json({
      success: true,
      message: 'External Project Employee ID updated successfully.',
      assignment,
      employee: emp,
    });
  });

  // ==============================================================================
  // 13. PROJECT MASTER ENDPOINTS (TENANT ISOLATED, FULL CRUD & STATUS TOGGLE)
  // ==============================================================================

  // GET /projects - List all projects with active riders count
  router.get('/projects', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { status, search } = req.query;

    const allAssignments = (db.employeeProjectAssignments || []).filter(
      (a: any) => actor.isSuperAdmin || a.tenant_id === actor.tenantId || a.tenant_id === 'company_pixel_syntax' || !a.tenant_id
    );

    let list = (db.projects || []).filter(
      (p: any) => actor.isSuperAdmin || p.tenant_id === actor.tenantId || p.tenant_id === 'company_pixel_syntax'
    );
    if (!list || list.length === 0) {
      list = (db.projects && db.projects.length > 0) ? db.projects : [...AUTHORITATIVE_COMPANY_ALLIED_PROJECTS];
    }

    // Filter by status if specified
    if (status && status !== 'ALL') {
      const s = String(status).toUpperCase();
      if (s === 'ACTIVE') {
        list = list.filter((p: any) => !p.status || p.status === 'ACTIVE' || p.status === 'Active');
      } else if (s === 'INACTIVE' || s === 'ARCHIVED') {
        list = list.filter((p: any) => p.status === 'INACTIVE' || p.status === 'ARCHIVED' || p.status === 'Inactive / Archived');
      }
    }

    // Filter by search query
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      list = list.filter((p: any) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.external_id_label && p.external_id_label.toLowerCase().includes(q))
      );
    }

    const tenantEmployees = (db.masterEmployees || []).filter(
      (e: any) => (actor.isSuperAdmin || e.tenant_id === actor.tenantId || e.tenant_id === 'company_pixel_syntax' || !e.tenant_id) && !e.is_archived
    );

    const enriched = list.map((p: any) => {
      const pIdentifier = p.name || p.id;
      const activeCount = tenantEmployees.filter((e: any) =>
        isEmployeeMatchingProject(e, p, allAssignments) ||
        isEmployeeMatchingProject(e, pIdentifier, allAssignments) ||
        (p.id ? isEmployeeMatchingProject(e, p.id, allAssignments) : false) ||
        (p.name ? isEmployeeMatchingProject(e, p.name, allAssignments) : false)
      ).length;
      const canonicalStatus = (p.status === 'INACTIVE' || p.status === 'ARCHIVED' || p.status === 'Inactive / Archived')
        ? 'Inactive / Archived'
        : 'Active';

      return {
        id: p.id,
        tenant_id: p.tenant_id,
        name: p.name,
        code: p.code,
        external_id_label: p.external_id_label || getProjectExternalIdConfig(p).label,
        status: canonicalStatus,
        active_count: activeCount,
        employee_count: activeCount,
        notes: p.notes || '',
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || p.created_at || new Date().toISOString(),
      };
    });

    res.json({ success: true, projects: enriched });
  });

  // GET /projects/:id - Single project details
  router.get('/projects/:id', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { id } = req.params;

    const project = (db.projects || []).find(
      (p: any) => p.id === id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId)
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const tenantEmployees = (db.masterEmployees || []).filter(
      (e: any) => (actor.isSuperAdmin || e.tenant_id === actor.tenantId) && !e.is_archived
    );
    const activeCount = tenantEmployees.filter((e: any) =>
      isEmployeeMatchingProject(e, project, db.employeeProjectAssignments)
    ).length;

    const canonicalStatus = (project.status === 'INACTIVE' || project.status === 'ARCHIVED' || project.status === 'Inactive / Archived')
      ? 'Inactive / Archived'
      : 'Active';

    res.json({
      success: true,
      project: {
        ...project,
        external_id_label: project.external_id_label || getProjectExternalIdConfig(project).label,
        status: canonicalStatus,
        active_count: activeCount,
      }
    });
  });

  // POST /projects - Create Project (Full validation, code uniqueness, operator label)
  router.post('/projects', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { name, code, external_id_label, status, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project Name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Project Code is required.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanName = name.trim();

    // Validate code uniqueness within tenant
    const existingCode = (db.projects || []).find(
      (p: any) => p.tenant_id === actor.tenantId && p.code.toUpperCase() === cleanCode
    );
    if (existingCode) {
      return res.status(400).json({
        error: `Project Code '${cleanCode}' already exists for this organization. Project codes must be unique.`
      });
    }

    // Validate name uniqueness within tenant
    const existingName = (db.projects || []).find(
      (p: any) => p.tenant_id === actor.tenantId && p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingName) {
      return res.status(400).json({
        error: `A project named '${cleanName}' already exists. Please use a distinct project name.`
      });
    }

    const resolvedStatus = (status === 'Inactive / Archived' || status === 'INACTIVE' || status === 'ARCHIVED')
      ? 'Inactive / Archived'
      : 'Active';

    const now = new Date().toISOString();
    const newProject = {
      id: `proj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      tenant_id: actor.tenantId,
      name: cleanName,
      code: cleanCode,
      client_name: cleanName,
      external_id_label: (external_id_label || '').trim() || 'External Rider ID',
      status: resolvedStatus,
      notes: (notes || '').trim(),
      created_at: now,
      created_by: actor.userName,
      updated_at: now,
      updated_by: actor.userName,
    };

    if (!db.projects) db.projects = [];
    db.projects.push(newProject);

    // Record audit log
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.push({
      id: `audit_${Date.now()}`,
      tenant_id: actor.tenantId,
      user_id: actor.userId,
      user_name: actor.userName,
      action: 'CREATE_PROJECT',
      module: 'PROJECT_MANAGEMENT',
      target_id: newProject.id,
      details: `Created project ${newProject.name} (${newProject.code}) with label "${newProject.external_id_label}" and status ${newProject.status}.`,
      timestamp: now,
    });

    res.status(201).json({ success: true, project: newProject });
  });

  // PUT /projects/:id - Edit Project
  router.put('/projects/:id', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { id } = req.params;
    const { name, code, external_id_label, status, notes } = req.body;

    const project = (db.projects || []).find(
      (p: any) => p.id === id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId)
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project Name is required.' });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Project Code is required.' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanName = name.trim();

    // Check code uniqueness if changed
    if (cleanCode !== project.code.toUpperCase()) {
      const existingCode = (db.projects || []).find(
        (p: any) => p.id !== project.id && p.tenant_id === actor.tenantId && p.code.toUpperCase() === cleanCode
      );
      if (existingCode) {
        return res.status(400).json({
          error: `Project Code '${cleanCode}' already exists. Project codes must be unique.`
        });
      }
    }

    // Check name uniqueness if changed
    if (cleanName.toLowerCase() !== project.name.trim().toLowerCase()) {
      const existingName = (db.projects || []).find(
        (p: any) => p.id !== project.id && p.tenant_id === actor.tenantId && p.name.trim().toLowerCase() === cleanName.toLowerCase()
      );
      if (existingName) {
        return res.status(400).json({
          error: `A project named '${cleanName}' already exists. Please choose a distinct name.`
        });
      }
    }

    const resolvedStatus = (status === 'Inactive / Archived' || status === 'INACTIVE' || status === 'ARCHIVED')
      ? 'Inactive / Archived'
      : 'Active';

    const now = new Date().toISOString();
    project.name = cleanName;
    project.code = cleanCode;
    project.client_name = cleanName;
    project.external_id_label = (external_id_label || '').trim() || 'External Rider ID';
    project.status = resolvedStatus;
    project.notes = (notes || '').trim();
    project.updated_at = now;
    project.updated_by = actor.userName;

    // Record audit log
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.push({
      id: `audit_${Date.now()}`,
      tenant_id: actor.tenantId,
      user_id: actor.userId,
      user_name: actor.userName,
      action: 'UPDATE_PROJECT',
      module: 'PROJECT_MANAGEMENT',
      target_id: project.id,
      details: `Updated project ${project.name} (${project.code}). Status: ${project.status}, Label: ${project.external_id_label}.`,
      timestamp: now,
    });

    res.json({ success: true, project });
  });

  // PATCH /projects/:id/status - Disable or Toggle Status (DO NOT HARD DELETE)
  router.patch('/projects/:id/status', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { id } = req.params;
    const { status } = req.body;

    const project = (db.projects || []).find(
      (p: any) => p.id === id && (actor.isSuperAdmin || p.tenant_id === actor.tenantId)
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    let newStatus = status;
    if (!newStatus) {
      // Toggle
      newStatus = (project.status === 'Active' || project.status === 'ACTIVE')
        ? 'Inactive / Archived'
        : 'Active';
    } else {
      newStatus = (newStatus === 'Inactive / Archived' || newStatus === 'INACTIVE' || newStatus === 'ARCHIVED')
        ? 'Inactive / Archived'
        : 'Active';
    }

    const now = new Date().toISOString();
    project.status = newStatus;
    project.updated_at = now;
    project.updated_by = actor.userName;

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.push({
      id: `audit_${Date.now()}`,
      tenant_id: actor.tenantId,
      user_id: actor.userId,
      user_name: actor.userName,
      action: 'CHANGE_PROJECT_STATUS',
      module: 'PROJECT_MANAGEMENT',
      target_id: project.id,
      details: `Changed project ${project.name} status to ${newStatus}.`,
      timestamp: now,
    });

    res.json({ success: true, project });
  });

  // ==============================================================================
  // 14. PROJECT ASSIGNMENT DIRECTORY (PAGINATED, SEARCH, FILTERED)
  // ==============================================================================
  router.get('/assignments', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const search = (req.query.search as string || '').trim().toLowerCase();
    const projectId = req.query.projectId as string || 'ALL';
    const visaContractor = req.query.visaContractor as string || 'ALL';
    const statusFilter = req.query.status as string || 'ALL';
    const primaryAdditional = req.query.primaryAdditional as string || 'ALL';

    const tenantAssignments = (db.employeeProjectAssignments || []).filter(
      (a: any) => actor.isSuperAdmin || a.tenant_id === actor.tenantId
    );

    // Enrich with master employee details
    const enriched = tenantAssignments.map((a: any) => {
      const emp = (db.masterEmployees || []).find((e: any) => e.id === a.employee_id);
      return {
        ...a,
        visa_contractor_type: emp?.visa_contractor_type || emp?.contractor || 'Allied DXB',
        vendor_name: emp?.vendor_name || '',
        branch: emp?.branch || 'Dubai Main',
        designation: emp?.designation || emp?.job_title || 'Delivery Bike Rider',
      };
    });

    let filtered = enriched;

    // Filter by Project
    if (projectId && projectId !== 'ALL') {
      filtered = filtered.filter((a: any) => a.project_id === projectId);
    }

    // Filter by Visa / Contractor
    if (visaContractor && visaContractor !== 'ALL') {
      filtered = filtered.filter((a: any) => {
        const v = (a.visa_contractor_type || '').toLowerCase();
        return v.includes(visaContractor.toLowerCase());
      });
    }

    // Filter by Status (ACTIVE / ENDED)
    if (statusFilter && statusFilter !== 'ALL') {
      filtered = filtered.filter((a: any) => a.status === statusFilter.toUpperCase());
    }

    // Filter by Primary / Additional
    if (primaryAdditional && primaryAdditional !== 'ALL') {
      if (primaryAdditional.toUpperCase() === 'PRIMARY') {
        filtered = filtered.filter((a: any) => a.is_primary === true);
      } else if (primaryAdditional.toUpperCase() === 'ADDITIONAL') {
        filtered = filtered.filter((a: any) => !a.is_primary);
      }
    }

    // Filter by Search (Employee Name, Code, External Rider ID)
    if (search) {
      filtered = filtered.filter((a: any) => {
        const name = (a.employee_name || '').toLowerCase();
        const code = (a.employee_code || '').toLowerCase();
        const extId = (a.external_rider_id || '').toLowerCase();
        const projName = (a.project_name || '').toLowerCase();
        return name.includes(search) || code.includes(search) || extId.includes(search) || projName.includes(search);
      });
    }

    // Sort newest start date first
    filtered.sort((a: any, b: any) => {
      const d1 = new Date(b.assignment_start_date || b.created_at || 0).getTime();
      const d2 = new Date(a.assignment_start_date || a.created_at || 0).getTime();
      return d1 - d2;
    });

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    res.json({
      success: true,
      assignments: paginated,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      }
    });
  });

  // Deterministic payroll identity resolution endpoint
  router.get('/payroll-resolve', (req: Request, res: Response) => {
    ensureSeeded();
    const actor = resolveAuthenticatedActor(req, db);
    const { projectId, externalRiderId, payrollMonth } = req.query;

    if (!projectId || !externalRiderId) {
      return res.status(400).json({ error: 'projectId and externalRiderId are required' });
    }

    const resolved = resolvePayrollEmployeeByIdentity(
      db,
      actor.tenantId,
      String(projectId),
      String(externalRiderId),
      payrollMonth ? String(payrollMonth) : undefined
    );

    const isMatched = resolved.status === 'MATCHED' && !!resolved.employee;

    res.json({
      success: true,
      resolved: isMatched,
      status: resolved.status,
      employee: resolved.employee || null,
      reason: resolved.reason,
      message: isMatched
        ? `Successfully resolved external ID '${externalRiderId}' on project to employee ${resolved.employee.full_name} (${resolved.employee.employee_code}).`
        : resolved.reason || `Unmatched: No active or historical assignment found for project '${projectId}' with external ID '${externalRiderId}'.`
    });
  });

  return router;
}
