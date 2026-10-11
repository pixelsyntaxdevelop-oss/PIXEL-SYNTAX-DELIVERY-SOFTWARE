import { normalizeEmployeeName, normalizeEmployeeRecord, AUTHORITATIVE_MASTER_EMPLOYEES } from './authoritativeEmployees';

export interface AuthoritativeEmployeeSearchResult {
  id: string;
  employee_code: string;
  full_name: string;
  display_name: string;
  name: string;
  first_name: string;
  last_name: string;
  emirates_id: string;
  emirates_id_number: string;
  mobile_number: string;
  phone: string;
  personal_mobile: string;
  company_mobile: string;
  designation: string;
  role: string;
  status: string;
  current_status: string;
  project_id: string;
  project_name: string;
  current_project_id: string;
  current_project_name: string;
  branch_id: string;
  branch_name: string;
  branch: string;
  email: string;
  passport_number: string;
  visa_contractor_type: string;
  contractor: string;
  vendor_name: string;
  vendor_id?: string;
  current_bike_plate?: string | null;
  current_sim_number?: string | null;
  external_rider_id?: string;
  rider_id?: string;
  platform_rider_id?: string;
  is_archived: boolean;
  tenant_id: string;
  [key: string]: any;
}

export interface AuthoritativeSearchOptions {
  query?: string;
  tenantId: string;
  isSuperAdmin?: boolean;
  limit?: number;
  includeArchived?: boolean;
  includeSeedEmployees?: boolean;
  branchId?: string;
  projectId?: string;
  status?: string;
  contractor?: string;
}

/**
 * Extracts and cleans digits from a string (for phone numbers, Emirates IDs, etc.)
 */
export function extractDigits(value?: string | null): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

/**
 * Returns the authoritative employee collection for a given tenant,
 * guaranteeing all records are properly normalized and fallback-populated if empty.
 */
export function getAuthoritativeEmployees(
  db: any,
  tenantId: string = 'company_pixel_syntax',
  includeArchived: boolean = false,
  includeSeedEmployees: boolean = true
): any[] {
  const targetTenant = tenantId || 'company_pixel_syntax';
  const safeDb = db || {};

  if (!safeDb.masterEmployees || !Array.isArray(safeDb.masterEmployees)) {
    safeDb.masterEmployees = includeSeedEmployees ? [...AUTHORITATIVE_MASTER_EMPLOYEES] : [];
  }

  // Ensure company_pixel_syntax has all 13 authoritative employees if missing
  if (includeSeedEmployees && (targetTenant === 'company_pixel_syntax' || targetTenant === 'tenant_allied' || targetTenant.includes('allied'))) {
    for (const authEmp of AUTHORITATIVE_MASTER_EMPLOYEES) {
      if (!safeDb.masterEmployees.some((e: any) => e.id === authEmp.id || (authEmp.employee_code && e.employee_code === authEmp.employee_code))) {
        safeDb.masterEmployees.push(authEmp);
      }
    }
  }

  let list = safeDb.masterEmployees.filter((e: any) => {
    // Tenant-scoped: company_pixel_syntax must ONLY return company_pixel_syntax
    if (targetTenant === 'company_pixel_syntax' || targetTenant === 'tenant_allied' || targetTenant.includes('allied')) {
      return e.tenant_id === 'company_pixel_syntax' || !e.tenant_id;
    }
    return e.tenant_id === targetTenant;
  });

  if (!includeArchived) {
    list = list.filter((e: any) => !e.is_archived);
  }

  // Normalize all employee records
  return list.map((e: any) => normalizeEmployeeRecord(e));
}

/**
 * Single Authoritative Global Employee Search Function
 * Used across:
 * - Employee Management
 * - Office Forms / Create Employee Forms
 * - Attendance
 * - Project Assignment
 * - Bike Assignment
 * - SIM Assignment
 * - Passport / Documents
 * - Payroll employee selectors
 * - Any other employee picker
 */
export function searchAuthoritativeEmployees(
  db: any,
  options: AuthoritativeSearchOptions
): AuthoritativeEmployeeSearchResult[] {
  const tenantId = options.tenantId || 'company_pixel_syntax';
  const rawQuery = (options.query || '').trim();
  const limit = options.limit && options.limit > 0 ? options.limit : 50;

  const allEmps = getAuthoritativeEmployees(db, tenantId, options.includeArchived, options.includeSeedEmployees);

  let filtered = allEmps;

  // Optional Branch filter
  if (options.branchId && options.branchId !== 'ALL' && options.branchId !== 'All Branches') {
    filtered = filtered.filter(
      (e: any) => e.branch_id === options.branchId || e.branch_name === options.branchId || e.branch === options.branchId
    );
  }

  // Optional Project filter
  if (options.projectId && options.projectId !== 'ALL' && options.projectId !== 'All Projects') {
    filtered = filtered.filter(
      (e: any) => e.project_id === options.projectId || e.project_name === options.projectId || e.project === options.projectId
    );
  }

  // Optional Status filter
  if (options.status && options.status !== 'ALL' && options.status !== 'All Status') {
    const targetStatus = options.status.toLowerCase();
    filtered = filtered.filter((e: any) => {
      const cur = (e.current_status || e.status || '').toLowerCase();
      return cur === targetStatus;
    });
  }

  // Search logic
  if (rawQuery) {
    const lowerQuery = rawQuery.toLowerCase();
    const queryDigits = extractDigits(rawQuery);
    const queryWords = lowerQuery.split(/\s+/).filter(Boolean);

    filtered = filtered.filter((e: any) => {
      const firstName = (e.first_name || '').toLowerCase();
      const lastName = (e.last_name || '').toLowerCase();
      const fullName = (e.full_name || '').toLowerCase();
      const displayName = (e.display_name || '').toLowerCase();
      const name = (e.name || '').toLowerCase();
      const arabicName = (e.arabic_name || '').toLowerCase();
      const empCode = (e.employee_code || '').toLowerCase();
      const idStr = (e.id || '').toLowerCase();
      const empIdStr = (e.employee_id || '').toLowerCase();

      // 1. Employee Name (display name, full name, first name, last name)
      const nameCombined = `${firstName} ${lastName} ${fullName} ${displayName} ${name} ${arabicName}`;
      if (fullName.includes(lowerQuery) || displayName.includes(lowerQuery) || nameCombined.includes(lowerQuery)) {
        return true;
      }
      // Check if all search words match within employee's name components
      if (queryWords.length > 1 && queryWords.every((w) => nameCombined.includes(w))) {
        return true;
      }

      // 2. Employee Code (exact + case-insensitive + partial match)
      if (
        empCode.includes(lowerQuery) ||
        idStr.includes(lowerQuery) ||
        empIdStr.includes(lowerQuery)
      ) {
        return true;
      }
      // Numeric-only match for ADL sequence (e.g. typing "1" or "0001" or "10" matches "ADL0001" or "ADL0010")
      if (queryDigits && empCode.includes(queryDigits)) {
        return true;
      }

      // 3. Emirates ID (with and without hyphen formatting)
      const eidRaw = (e.emirates_id || e.emirates_id_number || '').toLowerCase();
      if (eidRaw.includes(lowerQuery)) {
        return true;
      }
      if (queryDigits.length >= 2) {
        const eidDigits = extractDigits(eidRaw);
        if (eidDigits.includes(queryDigits)) {
          return true;
        }
      }

      // 4. Mobile number (partial and full match, with UAE prefix normalization)
      const mobile1 = (e.mobile_number || '').toLowerCase();
      const mobile2 = (e.personal_mobile || '').toLowerCase();
      const mobile3 = (e.company_mobile || '').toLowerCase();
      const phone = (e.phone || '').toLowerCase();
      const allPhones = `${mobile1} ${mobile2} ${mobile3} ${phone}`;

      if (allPhones.includes(lowerQuery)) {
        return true;
      }
      if (queryDigits.length >= 2) {
        const phoneDigits = extractDigits(allPhones);
        if (phoneDigits.includes(queryDigits)) {
          return true;
        }
        const stripPrefix = (d: string) => {
          let s = d;
          if (s.startsWith('971')) s = s.slice(3);
          else if (s.startsWith('0')) s = s.slice(1);
          return s;
        };
        const cleanQueryPhone = stripPrefix(queryDigits);
        const cleanStoredPhone = stripPrefix(phoneDigits);
        if (cleanQueryPhone && cleanStoredPhone && (cleanStoredPhone.includes(cleanQueryPhone) || cleanQueryPhone.includes(cleanStoredPhone))) {
          return true;
        }
      }

      // 5. Passport, Project name, or Rider ID matches
      const passport = (e.passport_number || '').toLowerCase();
      if (passport && passport.includes(lowerQuery)) {
        return true;
      }
      const project = (e.project_name || e.current_project_name || '').toLowerCase();
      if (project && project.includes(lowerQuery)) {
        return true;
      }
      const riderId = (e.external_rider_id || e.rider_id || e.platform_rider_id || '').toLowerCase();
      if (riderId && riderId.includes(lowerQuery)) {
        return true;
      }

      return false;
    });

    // Deterministic ranking for best search relevance
    filtered.sort((a: any, b: any) => {
      const codeA = (a.employee_code || '').toLowerCase();
      const codeB = (b.employee_code || '').toLowerCase();
      const nameA = (a.full_name || '').toLowerCase();
      const nameB = (b.full_name || '').toLowerCase();

      // Exact code match top priority
      const exactCodeA = codeA === lowerQuery;
      const exactCodeB = codeB === lowerQuery;
      if (exactCodeA && !exactCodeB) return -1;
      if (!exactCodeA && exactCodeB) return 1;

      // Code starts with query
      const codeStartsA = codeA.startsWith(lowerQuery);
      const codeStartsB = codeB.startsWith(lowerQuery);
      if (codeStartsA && !codeStartsB) return -1;
      if (!codeStartsA && codeStartsB) return 1;

      // Name starts with query
      const nameStartsA = nameA.startsWith(lowerQuery);
      const nameStartsB = nameB.startsWith(lowerQuery);
      if (nameStartsA && !nameStartsB) return -1;
      if (!nameStartsA && nameStartsB) return 1;

      // Fallback deterministic order by employee_code
      return (a.employee_code || '').localeCompare(b.employee_code || '');
    });
  } else {
    // Default deterministic order by employee_code
    filtered.sort((a: any, b: any) => (a.employee_code || '').localeCompare(b.employee_code || ''));
  }

  // Consistent result shape across all modules
  return filtered.slice(0, limit).map((emp: any) => formatAuthoritativeEmployeeResponse(emp));
}

/**
 * Formats an employee record into the consistent, standardized authoritative shape
 */
export function formatAuthoritativeEmployeeResponse(emp: any): AuthoritativeEmployeeSearchResult {
  const normName = normalizeEmployeeName(
    emp.first_name,
    emp.last_name,
    emp.full_name || emp.display_name || emp.name
  );

  const eid = emp.emirates_id || emp.emirates_id_number || '';
  const mobile = emp.mobile_number || emp.personal_mobile || emp.company_mobile || emp.phone || '';
  const status = emp.current_status || emp.status || 'Active';
  const role = emp.designation || emp.role || 'Courier / Rider';
  const projId = emp.project_id || emp.current_project_id || '';
  const projName = emp.project_name || emp.current_project_name || '';
  const branchName = emp.branch_name || emp.branch || 'Dubai Head Office';
  const branchId = emp.branch_id || 'b_dxb';

  return {
    ...emp,
    id: emp.id,
    employee_code: emp.employee_code || '',
    full_name: normName,
    display_name: normName,
    name: normName,
    first_name: emp.first_name || '',
    last_name: emp.last_name || '',
    emirates_id: eid,
    emirates_id_number: eid,
    mobile_number: mobile,
    phone: mobile,
    personal_mobile: emp.personal_mobile || mobile,
    company_mobile: emp.company_mobile || '',
    designation: role,
    role,
    status,
    current_status: status,
    project_id: projId,
    project_name: projName,
    current_project_id: projId,
    current_project_name: projName,
    branch_id: branchId,
    branch_name: branchName,
    branch: branchName,
    email: emp.email || '',
    passport_number: emp.passport_number || '',
    visa_contractor_type: emp.visa_contractor_type || emp.contractor || 'Allied DXB',
    contractor: emp.contractor || emp.visa_contractor_type || 'Allied DXB',
    vendor_name: emp.vendor_name || '',
    vendor_id: emp.vendor_id,
    current_bike_plate: emp.current_bike_plate || null,
    current_bike_id: emp.current_bike_id || null,
    current_sim_number: (emp.current_sim_number && !['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(String(emp.current_sim_number).toLowerCase().trim())) ? String(emp.current_sim_number).trim() : null,
    current_sim_id: (emp.current_sim_id && !['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(String(emp.current_sim_id).toLowerCase().trim())) ? String(emp.current_sim_id).trim() : null,
    has_active_sim: Boolean(
      (emp.current_sim_number && !['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(String(emp.current_sim_number).toLowerCase().trim())) ||
      (emp.current_sim_id && !['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', ''].includes(String(emp.current_sim_id).toLowerCase().trim()))
    ),
    external_rider_id: emp.external_rider_id || emp.rider_id || '',
    rider_id: emp.rider_id || emp.external_rider_id || '',
    is_archived: !!emp.is_archived,
    tenant_id: emp.tenant_id || 'company_pixel_syntax',
  };
}
