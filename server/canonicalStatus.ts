/**
 * Canonical Employee Status Resolution for Server
 *
 * Canonical statuses:
 * - Assigned / Active
 * - Available / Unassigned
 * - On Leave
 * - On Hold
 * - Absconding
 * - Terminated
 * - Exited
 *
 * Rules:
 * 1. Do NOT create/use "Suspended" as a separate canonical status.
 *    If legacy Suspended records exist: map them to "On Hold" for operational display
 *    while preserving original historical audit value.
 * 2. Do NOT merge "Terminated" and "Exited" in database or history.
 * 3. Rider / Project Management, Employee Management, Employee 360, Attendance,
 *    and Payroll must resolve employee working status from this same authoritative source.
 */

export type CanonicalEmployeeStatus =
  | 'Assigned / Active'
  | 'Available / Unassigned'
  | 'On Leave'
  | 'Emergency Leave'
  | 'On Hold'
  | 'Absconding'
  | 'Terminated'
  | 'Exited';

export const CANONICAL_STATUSES: CanonicalEmployeeStatus[] = [
  'Assigned / Active',
  'Available / Unassigned',
  'On Leave',
  'Emergency Leave',
  'On Hold',
  'Absconding',
  'Terminated',
  'Exited',
];

export const LIFECYCLE_OVERRIDE_STATUSES: CanonicalEmployeeStatus[] = [
  'On Leave',
  'Emergency Leave',
  'On Hold',
  'Absconding',
  'Terminated',
  'Exited',
];

export function hasActiveProjectAssignment(emp: any, activeAssignments?: any[]): boolean {
  if (!emp) return false;

  // 1. Check active assignments list if provided
  if (Array.isArray(activeAssignments) && activeAssignments.length > 0) {
    const empId = emp.id || emp.employee_id;
    const empCode = emp.employee_code;
    const userAssignments = activeAssignments.filter(
      (a: any) =>
        (empId && a.employee_id === empId) || (empCode && a.employee_code === empCode)
    );
    if (userAssignments.length > 0) {
      return userAssignments.some((a: any) => String(a.status || '').toUpperCase() === 'ACTIVE');
    }
  }

  const unassignedValues = new Set([
    '',
    '-',
    '--',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'unassigned',
    'proj_unassigned',
    'no_project',
    '0',
    'false',
  ]);

  const rawPId = String(emp.project_id || '').trim().toLowerCase();
  const rawPName = String(emp.project_name || emp.current_project || emp.project || '').trim().toLowerCase();
  const rawPCode = String(emp.project_code || '').trim().toLowerCase();

  // If project_name is explicitly unassigned or none, then they are unassigned
  if (rawPName && unassignedValues.has(rawPName)) {
    return false;
  }

  // 2. Explicit valid project ID attached
  if (rawPId && !unassignedValues.has(rawPId)) {
    return true;
  }

  // 3. Project name indicates an active operational project
  if (rawPName && !unassignedValues.has(rawPName)) {
    return true;
  }

  // 4. Project code indicates an active project
  if (rawPCode && !unassignedValues.has(rawPCode)) {
    return true;
  }

  return false;
}

export function isLifecycleOverrideStatus(rawStatus?: string | null): boolean {
  if (!rawStatus) return false;
  const canonical = resolveCanonicalEmployeeStatus(rawStatus, false);
  return (
    canonical === 'On Leave' ||
    canonical === 'Emergency Leave' ||
    canonical === 'On Hold' ||
    canonical === 'Absconding' ||
    canonical === 'Terminated' ||
    canonical === 'Exited'
  );
}

export function resolveCanonicalEmployeeStatus(
  rawStatus?: string | null,
  hasActiveProject: boolean = false
): CanonicalEmployeeStatus {
  if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
    return hasActiveProject ? 'Assigned / Active' : 'Available / Unassigned';
  }
  const clean = String(rawStatus).trim();
  const lower = clean.toLowerCase();

  // 1. EXCLUSIVE LIFECYCLE OVERRIDES (Precedence over project assignment)
  // Emergency Leave (must be checked before generic leave)
  if (
    lower === 'emergency leave' ||
    lower === 'emergency_leave' ||
    lower.includes('emergency leave') ||
    lower.includes('emergency')
  ) {
    return 'Emergency Leave';
  }

  // On Leave
  if (
    lower.includes('leave') ||
    lower.includes('vacation') ||
    lower.includes('holiday')
  ) {
    return 'On Leave';
  }

  // On Hold (includes Suspended, On Hold, Pending, Waiting, Onboarding)
  if (
    lower === 'suspended' ||
    lower.includes('suspend') ||
    lower.includes('on hold') ||
    lower.includes('on-hold') ||
    lower.includes('pending') ||
    lower.includes('waiting') ||
    lower.includes('onboarding')
  ) {
    return 'On Hold';
  }

  // Absconding
  if (lower.includes('abscond')) {
    return 'Absconding';
  }

  // Terminated
  if (
    lower.includes('terminat') ||
    lower.includes('dismiss') ||
    lower.includes('fired')
  ) {
    return 'Terminated';
  }

  // Exited
  if (
    lower.includes('exit') ||
    lower.includes('resign') ||
    lower.includes('released') ||
    lower.includes('cancelled') ||
    lower === 'inactive' ||
    lower === 'in-active' ||
    lower.includes('inactive') ||
    lower === '1' ||
    lower === 'disabled' ||
    lower === 'closed'
  ) {
    return 'Exited';
  }

  // 2. NON-OVERRIDE STATUSES: Governed strictly by active project assignment
  if (hasActiveProject) {
    return 'Assigned / Active';
  }

  return 'Available / Unassigned';
}

export function resolveCanonicalStatus(
  rawStatus?: string | null,
  hasActiveProject?: boolean
): CanonicalEmployeeStatus {
  if (typeof hasActiveProject === 'boolean') {
    return resolveCanonicalEmployeeStatus(rawStatus, hasActiveProject);
  }
  const lower = String(rawStatus || '').trim().toLowerCase();
  const assumesProject = lower === 'assigned / active' || lower === 'assigned';
  return resolveCanonicalEmployeeStatus(rawStatus, assumesProject);
}

export function resolveEmployeeRecordStatus(emp: any, activeAssignments?: any[]): CanonicalEmployeeStatus {
  if (!emp) return 'Available / Unassigned';
  const hasProject = hasActiveProjectAssignment(emp, activeAssignments);
  const rawStatus = emp.current_status || emp.status || emp.working_status;
  return resolveCanonicalEmployeeStatus(rawStatus, hasProject);
}
