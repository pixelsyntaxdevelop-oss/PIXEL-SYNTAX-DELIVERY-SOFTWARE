/**
 * Authoritative Employee / Project Relationship Matcher
 * Single source of truth ensuring that project button counts and filtered employee results ALWAYS agree.
 */
export function isEmployeeMatchingProject(
  e: any,
  projectIdentifier: string | { id?: string; name?: string; code?: string } | null | undefined,
  assignments: any[] = []
): boolean {
  if (!e || !projectIdentifier) return false;

  const pId = typeof projectIdentifier === 'string' ? projectIdentifier : (projectIdentifier.id || '');
  const pName = typeof projectIdentifier === 'string' ? projectIdentifier : (projectIdentifier.name || '');
  const pCode = typeof projectIdentifier === 'string' ? '' : (projectIdentifier.code || '');

  // Treat 'ALL' or 'All Projects' as matching everything
  if (
    (typeof projectIdentifier === 'string' && (projectIdentifier === 'ALL' || projectIdentifier === 'All Projects')) ||
    (pId === 'ALL' || pName === 'ALL' || pName === 'All Projects')
  ) {
    return true;
  }

  const targetStrings = [pName, pId, pCode].filter(Boolean);
  if (targetStrings.length === 0) return false;

  // 1. Direct match on employee record fields
  const empDirectFields = [
    e.project_id,
    e.project_name,
    e.project,
    e.current_project,
  ].filter(Boolean);

  // Exact comparison
  for (const target of targetStrings) {
    for (const empVal of empDirectFields) {
      if (empVal === target) return true;
    }
  }

  // Normalized / partial comparison (e.g. "Noon Minutes" matching "Noon Minutes Commission", "Labour" matching "Labour Supply Technical Services")
  for (const target of targetStrings) {
    const normTarget = String(target).trim().toLowerCase();
    if (!normTarget || normTarget === 'all' || normTarget === 'all projects') continue;

    for (const empVal of empDirectFields) {
      const normEmp = String(empVal).trim().toLowerCase();
      if (!normEmp) continue;
      if (normEmp === normTarget) return true;
      if (normTarget.length >= 3 && (normEmp.includes(normTarget) || normTarget.includes(normEmp))) {
        return true;
      }
    }
  }

  // 2. Match via employee project assignments (active assignments)
  if (Array.isArray(assignments) && assignments.length > 0) {
    const empId = e.id || e.employee_id;
    const empCode = e.employee_code;

    const userAssignments = assignments.filter((a: any) => {
      const matchesEmp = (empId && a.employee_id === empId) || (empCode && a.employee_code === empCode);
      if (!matchesEmp) return false;
      const statusUpper = String(a.status || 'ACTIVE').toUpperCase();
      return statusUpper === 'ACTIVE';
    });

    for (const asg of userAssignments) {
      const asgFields = [asg.project_id, asg.project_name, asg.project_code].filter(Boolean);
      for (const target of targetStrings) {
        for (const asgVal of asgFields) {
          if (asgVal === target) return true;
        }
      }
      for (const target of targetStrings) {
        const normTarget = String(target).trim().toLowerCase();
        if (!normTarget) continue;
        for (const asgVal of asgFields) {
          const normAsg = String(asgVal).trim().toLowerCase();
          if (normAsg === normTarget) return true;
          if (normTarget.length >= 3 && (normAsg.includes(normTarget) || normTarget.includes(normAsg))) {
            return true;
          }
        }
      }
    }
  }

  return false;
}
