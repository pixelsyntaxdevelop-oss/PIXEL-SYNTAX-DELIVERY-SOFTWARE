export interface AuthoritativeEmployeeRecord {
  id: string;
  tenant_id: string;
  employee_code: string;
  legacy_employee_code?: string;
  first_name: string;
  last_name: string;
  full_name: string;
  display_name?: string;
  name?: string;
  designation: string;
  emirates_id_number: string;
  emirates_id: string;
  personal_mobile: string;
  mobile_number: string;
  email: string;
  current_status: 'Active' | 'Inactive' | 'On Leave' | 'Suspended';
  branch_name: string;
  branch_id?: string;
  project_name: string;
  project_id?: string;
  is_archived?: boolean;
}

/**
 * Authoritative Employee Name Normalizer
 * For all company_pixel_syntax employees:
 * - Build display name from authoritative employee fields: first_name + last_name
 * - Trim extra spaces
 * - Collapse repeated spaces
 * - Remove accidental duplicate spacing / duplicate tokens
 * - Do NOT invent names
 * - Do NOT change Emirates ID or employee identity
 * - If only one name field exists, preserve it cleanly
 * - Store/derive one normalized display_name/full_name consistently
 */
export function normalizeEmployeeName(
  firstName?: string | null,
  lastName?: string | null,
  fallbackFullName?: string | null
): string {
  const cleanFirst = (firstName || '').trim().replace(/\s+/g, ' ');
  const cleanLast = (lastName || '').trim().replace(/\s+/g, ' ');

  let rawName = '';
  if (cleanFirst && cleanLast) {
    rawName = `${cleanFirst} ${cleanLast}`;
  } else if (cleanFirst) {
    rawName = cleanFirst;
  } else if (cleanLast) {
    rawName = cleanLast;
  } else if (fallbackFullName) {
    rawName = fallbackFullName.trim().replace(/\s+/g, ' ');
  }

  if (!rawName) return '';

  // If explicit fallbackFullName was provided, keep it intact to avoid stripping valid multi-token names
  if (fallbackFullName && fallbackFullName.trim() === rawName) {
    return rawName.replace(/\s+/g, ' ').trim();
  }

  // Remove accidental duplicate adjacent tokens (e.g. "Adeel Akhtar Akhtar Ali" -> "Adeel Akhtar Ali")
  const tokens = rawName.split(' ');
  const dedupedTokens: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i];
    const prev = dedupedTokens[dedupedTokens.length - 1];
    if (prev && current.toLowerCase() === prev.toLowerCase()) {
      continue;
    }
    dedupedTokens.push(current);
  }

  return dedupedTokens.join(' ');
}

/**
 * Normalizes an employee record in-place and returns it with consistent fields
 */
export function normalizeEmployeeRecord<T extends Record<string, any>>(emp: T): T {
  if (!emp) return emp;
  const target = emp as any;

  const normalized = normalizeEmployeeName(
    target.first_name,
    target.last_name,
    target.full_name || target.display_name || target.name
  );

  if (normalized) {
    target.full_name = normalized;
    target.display_name = normalized;
    target.name = normalized;
  }

  // Ensure consistent Emirates ID fields
  const eid = target.emirates_id || target.emirates_id_number || '';
  if (eid) {
    target.emirates_id = eid;
    target.emirates_id_number = eid;
  }

  // Ensure consistent Mobile fields
  const mob = target.mobile_number || target.personal_mobile || target.company_mobile || target.phone || '';
  if (mob) {
    target.mobile_number = mob;
    if (!target.personal_mobile) target.personal_mobile = mob;
    if (!target.phone) target.phone = mob;
  }

  // Authoritative branch normalization for company_pixel_syntax
  if (target.tenant_id === 'company_pixel_syntax' || !target.tenant_id) {
    const rawBranch = (target.branch_name || target.branch || '').trim();
    const norm = rawBranch.toLowerCase();
    if (
      norm.includes('spc') ||
      norm.includes('auh') ||
      norm.includes('abu dhabi') ||
      target.branch_id === 'b_auh' ||
      target.branch_id === 'b_allied_spc'
    ) {
      target.branch_name = 'Pixel Syntax Delivery Software';
      target.branch = 'Pixel Syntax Delivery Software';
      target.branch_id = 'b_auh';
    } else {
      target.branch_name = 'Pixel Syntax Delivery Software';
      target.branch = 'Pixel Syntax Delivery Software';
      target.branch_id = 'b_dxb';
    }
  }

  return emp;
}

export const AUTHORITATIVE_MASTER_EMPLOYEES: AuthoritativeEmployeeRecord[] = [];

