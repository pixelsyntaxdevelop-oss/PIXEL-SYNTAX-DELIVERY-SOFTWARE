/**
 * Canonical Employee Working Status Source of Truth
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
 *    If legacy Suspended records exist, map them to "On Hold" for operational display
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

export const CANONICAL_STATUS_LIST: CanonicalEmployeeStatus[] = [
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

/**
 * Resolves the canonical working status for any raw status string.
 */
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

/**
 * Returns Tailwind badge classes corresponding to canonical status
 */
export function getCanonicalStatusBadgeClass(rawStatus?: string | null): string {
  const canonical = resolveCanonicalStatus(rawStatus);
  switch (canonical) {
    case 'Assigned / Active':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
    case 'Available / Unassigned':
      return 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800';
    case 'On Leave':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    case 'Emergency Leave':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800';
    case 'On Hold':
      return 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
    case 'Absconding':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
    case 'Terminated':
      return 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-300 dark:border-red-800';
    case 'Exited':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700';
  }
}
