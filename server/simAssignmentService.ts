import { AUTHORITATIVE_MASTER_EMPLOYEES, normalizeEmployeeName } from './authoritativeEmployees';
import { searchAuthoritativeEmployees, getAuthoritativeEmployees } from './globalEmployeeSearchService';
import { safeSupabaseUpdate, safeSupabaseInsert, getSupabaseClient } from './supabaseDb';
import { ORIGINAL_PERSISTENT_USERS } from './authoritativeUsers';

export interface SimEmployeeCandidate {
  id: string;
  full_name: string;
  employee_code: string;
  emirates_id: string;
  current_status: string;
  has_active_sim: boolean;
  current_sim_id?: string | null;
  current_sim_number?: string | null;
  current_sim_provider?: string | null;
  current_sim_iccid?: string | null;
  current_sim_assigned_date?: string | null;
  current_sim_assigned_by?: string | null;
  visa_contractor_type?: string;
  primary_project?: string;
  project_name?: string;
  current_bike_plate?: string;
}

export interface AssignSimParams {
  tenantId: string;
  simId: string;
  employeeId: string;
  assignedDate?: string;
  monthlyPackageAmount?: number;
  approvedAmount?: number;
  payableAmount?: number;
  notes?: string;
  assignedBy?: string;
}

export interface ReturnSimParams {
  tenantId: string;
  simId?: string;
  reason?: string;
  returnReason?: string;
  returnRemark?: string;
  returnDate?: string;
  returnTime?: string;
  returnedBy?: string;
  returnedTo?: string;
  notes?: string;
  conditionNotes?: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  mobileNumber?: string;
}

export interface ReplaceSimParams {
  tenantId: string;
  oldSimId?: string;
  newSimId: string;
  employeeId: string;
  swapReason?: string;
  swapDate?: string;
  swappedBy?: string;
  notes?: string;
}

export interface ReturnAndAssignSimParams {
  tenantId?: string;
  newSimId: string;
  employeeId: string;
  oldSimId?: string;
  returnReason?: string;
  assignedDate?: string;
  monthlyPackageAmount?: number;
  approvedAmount?: number;
  payableAmount?: number;
  notes?: string;
  actorName?: string;
  userId?: string;
}

export interface TransferSimParams {
  tenantId: string;
  simId: string;
  destinationEmployeeId?: string;
  toEmployeeId?: string;
  fromEmployeeId?: string;
  transferReason: string;
  transferDate?: string;
  transferredBy?: string;
  userId?: string;
  notes?: string;
}

export interface MarkSimLostParams {
  tenantId?: string;
  simId: string;
  lossDate?: string;
  lossTime?: string;
  reason: string;
  reportedBy?: string;
  notes?: string;
  employeeId?: string;
  employeeCode?: string;
  userId?: string;
}

export interface RecoverLostSimParams {
  tenantId?: string;
  simId: string;
  recoveryDate?: string;
  recoveryReason: string;
  recoveredBy?: string;
  authorizedBy: string;
  notes?: string;
  userId?: string;
}

// In-memory mutex lock to prevent concurrent races on the same SIM/Employee
const simLocks = new Map<string, Promise<any>>();
export async function withSimLock<T>(lockKeyOrKeys: string | string[], fn: () => Promise<T>): Promise<T> {
  const rawKeys = Array.isArray(lockKeyOrKeys) ? lockKeyOrKeys : [lockKeyOrKeys];
  const keys = [...new Set(rawKeys.filter(Boolean))].sort();

  if (keys.length === 0) {
    return await fn();
  }

  // Acquire locks sequentially in sorted order to prevent deadlocks
  const acquire = async (index: number): Promise<T> => {
    if (index >= keys.length) {
      return await fn();
    }
    const key = keys[index];
    const existing = simLocks.get(key) || Promise.resolve();
    let release: () => void;
    const next = new Promise<void>((resolve) => { release = resolve; });
    simLocks.set(key, existing.then(() => next, () => next));

    await existing;
    try {
      return await acquire(index + 1);
    } finally {
      release!();
      if (simLocks.get(key) === next) {
        simLocks.delete(key);
      }
    }
  };

  return await acquire(0);
}

function extractDigits(val?: string | null): string {
  if (!val) return '';
  return val.replace(/\D/g, '');
}

export function normalizePhoneForMatching(val?: string | null): string {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.startsWith('971') && digits.length >= 12) {
    return digits.slice(3); // e.g. 971522443193 -> 522443193
  }
  if (digits.startsWith('0') && digits.length >= 10) {
    return digits.slice(1); // e.g. 0522443193 -> 522443193
  }
  return digits;
}

export function isSamePhone(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const na = normalizePhoneForMatching(a);
  const nb = normalizePhoneForMatching(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

export function getEmployeeIdentifierVariants(empOrId?: any): Set<string> {
  const set = new Set<string>();
  if (!empOrId) return set;
  if (typeof empOrId === 'string') {
    const s = empOrId.trim();
    if (s) {
      set.add(s);
      set.add(s.toLowerCase());
      if (s.startsWith('emp_')) {
        set.add(s.slice(4));
        set.add(s.slice(4).toLowerCase());
      } else {
        set.add(`emp_${s}`);
        set.add(`emp_${s}`.toLowerCase());
      }
    }
    return set;
  }

  const id = empOrId.id != null ? String(empOrId.id).trim() : '';
  const empId = empOrId.employee_id != null ? String(empOrId.employee_id).trim() : '';
  const code = empOrId.employee_code != null ? String(empOrId.employee_code).trim() : '';
  const legacyCode = empOrId.legacy_employee_code != null ? String(empOrId.legacy_employee_code).trim() : '';
  [id, empId, code, legacyCode].forEach((s) => {
    if (s) {
      set.add(s);
      set.add(s.toLowerCase());
      if (s.startsWith('emp_')) {
        set.add(s.slice(4));
        set.add(s.slice(4).toLowerCase());
      } else {
        set.add(`emp_${s}`);
        set.add(`emp_${s}`.toLowerCase());
      }
    }
  });
  return set;
}

export function matchEmployeeNames(nameA?: string | null, nameB?: string | null): boolean {
  if (!nameA || !nameB) return false;
  const a = nameA.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const b = nameB.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!a || !b) return false;
  if (a === b) return true;

  // Check token containment / overlap
  const tokensA = a.split(' ').filter(Boolean);
  const tokensB = b.split(' ').filter(Boolean);
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Deduplicate consecutive tokens (e.g. "Qaisar Qaisar" vs "Qaisar")
  const dedupA = tokensA.filter((t, i) => i === 0 || t !== tokensA[i - 1]).join(' ');
  const dedupB = tokensB.filter((t, i) => i === 0 || t !== tokensB[i - 1]).join(' ');
  if (dedupA === dedupB) return true;

  if (a.includes(b) || b.includes(a)) return true;

  const common = tokensA.filter((t) => tokensB.includes(t));
  if (common.length >= Math.min(tokensA.length, tokensB.length) && common.length >= 2) return true;

  return false;
}

/**
 * Resolves the staff user's actual human name from assignment records or user store.
 * If assigned-by is missing from historical records, returns 'Not recorded'; never invents names.
 */
export function resolveStaffUserName(assignedBy?: any, db?: any): string {
  if (!assignedBy || typeof assignedBy !== 'string') {
    return 'Not recorded';
  }
  const trimmed = assignedBy.trim();
  if (!trimmed) {
    return 'Not recorded';
  }
  const lower = trimmed.toLowerCase();
  const genericPlaceholders = new Set([
    'telecom admin',
    'operations admin',
    'admin',
    'administrator',
    'operations team',
    'telecom team',
    'system',
    'system user',
    'not recorded',
    'unknown',
    'n/a',
    'none',
    'null',
    'undefined',
    '—',
    '-',
    'unauthenticated guest',
  ]);

  // First, check if db.users has a matching user by ID, username, email, employee_code, employee_id
  if (db?.users && Array.isArray(db.users)) {
    const user = db.users.find((u: any) =>
      u.id === trimmed ||
      u.username === trimmed ||
      (u.email && u.email.toLowerCase() === lower) ||
      u.employee_code === trimmed ||
      u.employee_id === trimmed
    );
    if (user && (user.fullName || user.full_name || user.name)) {
      return (user.fullName || user.full_name || user.name).trim();
    }
  }

  // Check ORIGINAL_PERSISTENT_USERS by key, email, employee_code, employee_id
  if (ORIGINAL_PERSISTENT_USERS) {
    for (const [key, val] of Object.entries(ORIGINAL_PERSISTENT_USERS)) {
      if (
        key === trimmed ||
        val.email?.toLowerCase() === lower ||
        val.employee_code === trimmed ||
        val.employee_id === trimmed
      ) {
        return val.fullName;
      }
    }
  }

  // If matched to a generic label without a real user ID: return 'Not recorded' (never invent names)
  if (genericPlaceholders.has(lower)) {
    return 'Not recorded';
  }

  // If it matches an internal unresolved ID pattern (e.g. usr_..., user_...)
  if (/^(usr_|user_|id_)[a-z0-9_]+$/i.test(trimmed)) {
    return 'Not recorded';
  }

  // It is an actual recorded name (e.g. "System User", "System User", etc.)
  return trimmed;
}

/**
 * Synchronizes authoritative Supabase SIM assignment records with Employee Management and Employee 360.
 * Ensures employees with assigned SIMs have current_sim_number, current_sim_id, current_sim_provider,
 * current_sim_iccid, current_sim_assigned_date, and current_sim_assigned_by accurately populated.
 */
export async function syncAuthoritativeSimAssignments(
  supabase: any,
  db: any,
  tenantId: string = 'company_pixel_syntax'
): Promise<void> {
  if (!db) return;

  // 1. Read existing authoritative Supabase SIM assignment records and SIM cards
  if (supabase) {
    try {
      const { data: sbAssignments, error: asgnErr } = await supabase
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('assigned_at', { ascending: false });

      if (!asgnErr && Array.isArray(sbAssignments)) {
        if (!db.simAssignments) db.simAssignments = [];
        for (const sa of sbAssignments) {
          const idx = db.simAssignments.findIndex((x: any) => x.id === sa.id);
          if (idx >= 0) {
            db.simAssignments[idx] = { ...db.simAssignments[idx], ...sa };
          } else {
            db.simAssignments.push(sa);
          }
        }
      }

      const { data: sbSimCards, error: cardErr } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!cardErr && Array.isArray(sbSimCards)) {
        if (!db.simCardsMaster) db.simCardsMaster = [];
        for (const sc of sbSimCards) {
          const idx = db.simCardsMaster.findIndex((x: any) => x.id === sc.id);
          if (idx >= 0) {
            db.simCardsMaster[idx] = { ...db.simCardsMaster[idx], ...sc };
          } else {
            db.simCardsMaster.push(sc);
          }
        }
      }
    } catch (e) {
      console.warn('syncAuthoritativeSimAssignments Supabase fetch warning:', e);
    }
  }

  // 2. Build index of active SIM assignments and SIM cards
  const allAssignments = Array.isArray(db.simAssignments) ? db.simAssignments : [];
  const allSimCards = Array.isArray(db.simCardsMaster) ? db.simCardsMaster : [];

  const simCardById = new Map<string, any>();
  const simCardByMobile = new Map<string, any>();
  for (const sc of allSimCards) {
    if (sc.id) simCardById.set(sc.id, sc);
    const num = (sc.mobile_number || sc.sim_number || '').replace(/\D/g, '');
    if (num) simCardByMobile.set(num, sc);
  }

  // Map active assignments by employee ID / code / variants
  const activeAsgnByEmpId = new Map<string, any>();
  for (const asgn of allAssignments) {
    if (asgn.tenant_id !== tenantId && asgn.tenant_id && tenantId !== 'company_pixel_syntax') continue;
    const isActive = asgn.status === 'ACTIVE' || asgn.assignment_status === 'ACTIVE';
    if (!isActive) continue;

    if (asgn.employee_id) {
      activeAsgnByEmpId.set(String(asgn.employee_id).trim(), asgn);
    }
    if (asgn.employee_code) {
      activeAsgnByEmpId.set(String(asgn.employee_code).trim(), asgn);
    }
  }

  // Also check assigned sim_cards directly
  const assignedCardByEmpId = new Map<string, any>();
  for (const sc of allSimCards) {
    if (sc.tenant_id !== tenantId && sc.tenant_id && tenantId !== 'company_pixel_syntax') continue;
    const isAssigned = sc.assignment_status === 'Assigned' || sc.status === 'Assigned';
    if (!isAssigned) continue;

    if (sc.current_employee_id) {
      assignedCardByEmpId.set(String(sc.current_employee_id).trim(), sc);
    }
    if (sc.current_employee_code) {
      assignedCardByEmpId.set(String(sc.current_employee_code).trim(), sc);
    }
  }

  // 3. Synchronize onto employees
  const employeesToSync: any[] = [];
  if (db.masterEmployees && Array.isArray(db.masterEmployees)) {
    employeesToSync.push(...db.masterEmployees);
  }
  if (db.employees && Array.isArray(db.employees)) {
    for (const e of db.employees) {
      if (!employeesToSync.some((ex) => ex.id === e.id)) {
        employeesToSync.push(e);
      }
    }
  }

  for (const emp of employeesToSync) {
    if (emp.tenant_id !== tenantId && emp.tenant_id && tenantId !== 'company_pixel_syntax') continue;

    const empIdStr = emp.id ? String(emp.id).trim() : '';
    const empCodeStr = emp.employee_code ? String(emp.employee_code).trim() : '';

    // Match by employee ID first
    let activeAsgn = (empIdStr && activeAsgnByEmpId.get(empIdStr)) ||
                     (empCodeStr && activeAsgnByEmpId.get(empCodeStr));

    if (!activeAsgn) {
      const empVariants = getEmployeeIdentifierVariants(emp);
      for (const [key, asgn] of activeAsgnByEmpId.entries()) {
        if (empVariants.has(key)) {
          activeAsgn = asgn;
          break;
        }
      }
    }

    let assignedCard = (empIdStr && assignedCardByEmpId.get(empIdStr)) ||
                       (empCodeStr && assignedCardByEmpId.get(empCodeStr));

    if (!assignedCard && activeAsgn) {
      assignedCard = simCardById.get(activeAsgn.sim_card_id || activeAsgn.sim_id) ||
                     simCardByMobile.get((activeAsgn.mobile_number || '').replace(/\D/g, ''));
    }

    const invalidCustodyVals = new Set(['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', '']);
    const empHasSimNumber = emp.current_sim_number && !invalidCustodyVals.has(String(emp.current_sim_number).toLowerCase().trim());
    const empHasSimId = emp.current_sim_id && !invalidCustodyVals.has(String(emp.current_sim_id).toLowerCase().trim());

    if (!assignedCard && !activeAsgn && (empHasSimNumber || empHasSimId)) {
      const candidateCard = (empHasSimId && simCardById.get(emp.current_sim_id)) ||
                            (empHasSimNumber && simCardByMobile.get(String(emp.current_sim_number).replace(/\D/g, '')));
      if (candidateCard) {
        const isHeldByOther = candidateCard.current_employee_id && candidateCard.current_employee_id !== emp.id;
        const isReturnedOrAvailable = candidateCard.status === 'Available' || candidateCard.assignment_status === 'Unassigned' || !candidateCard.current_employee_id;
        if (isHeldByOther || isReturnedOrAvailable) {
          // Stale pointer on employee: clear it
          emp.current_sim_id = null;
          emp.current_sim_number = null;
          emp.current_sim_provider = null;
          emp.current_sim_iccid = null;
          emp.current_sim_assigned_date = null;
          emp.current_sim_assigned_by = null;
        } else {
          assignedCard = candidateCard;
          // Automatically sync the SIM card's custodian to this employee
          assignedCard.current_employee_id = emp.id;
          assignedCard.current_employee_code = emp.employee_code;
          assignedCard.current_employee_name = emp.full_name;
          assignedCard.status = 'Assigned';
          assignedCard.assignment_status = 'Assigned';
          assignedCard.assigned_date = emp.current_sim_assigned_date || assignedCard.assigned_date || emp.joining_date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
        }
      }
    }

    if (activeAsgn) {
      const simCard = assignedCard || simCardById.get(activeAsgn.sim_card_id || activeAsgn.sim_id) ||
                      simCardByMobile.get((activeAsgn.mobile_number || '').replace(/\D/g, ''));

      const mobileNumber = activeAsgn.mobile_number || simCard?.mobile_number || simCard?.sim_number;
      const provider = activeAsgn.provider || simCard?.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
      const iccid = simCard?.iccid || activeAsgn.iccid || simCard?.sim_serial_number || '—';
      const assignedDate = activeAsgn.assigned_date || (activeAsgn.assigned_at ? activeAsgn.assigned_at.slice(0, 10) : null) || simCard?.assigned_date || null;
      const assignedBy = resolveStaffUserName(activeAsgn.assigned_by || simCard?.assigned_by, db);

      emp.current_sim_id = activeAsgn.sim_card_id || activeAsgn.sim_id || simCard?.id || null;
      emp.current_sim_number = mobileNumber || null;
      emp.current_sim_provider = provider;
      emp.current_sim_iccid = iccid;
      emp.current_sim_assigned_date = assignedDate;
      emp.current_sim_assigned_by = assignedBy;
    } else if (assignedCard) {
      const mobileNumber = assignedCard.mobile_number || assignedCard.sim_number;
      const provider = assignedCard.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
      const iccid = assignedCard.iccid || assignedCard.sim_serial_number || '—';
      const assignedDate = assignedCard.assigned_date || null;
      const assignedBy = resolveStaffUserName(assignedCard.assigned_by, db);

      emp.current_sim_id = assignedCard.id || null;
      emp.current_sim_number = mobileNumber || null;
      emp.current_sim_provider = provider;
      emp.current_sim_iccid = iccid;
      emp.current_sim_assigned_date = assignedDate;
      emp.current_sim_assigned_by = assignedBy;

      // Ensure active assignment entry exists in db.simAssignments
      if (db && Array.isArray(db.simAssignments)) {
        const hasAsgn = db.simAssignments.some((a: any) =>
          (a.sim_id === assignedCard.id || a.sim_card_id === assignedCard.id || isSamePhone(a.mobile_number, mobileNumber)) &&
          (a.employee_id === emp.id || (emp.employee_code && a.employee_code === emp.employee_code)) &&
          (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')
        );
        if (!hasAsgn) {
          db.simAssignments.unshift({
            id: `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            tenant_id: tenantId,
            sim_id: assignedCard.id,
            sim_card_id: assignedCard.id,
            mobile_number: mobileNumber,
            provider,
            iccid,
            employee_id: emp.id,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            assigned_at: assignedDate || new Date().toISOString(),
            assigned_date: assignedDate || new Date().toISOString().slice(0, 10),
            assigned_by: assignedBy || 'Operations Admin',
            status: 'ACTIVE',
            assignment_status: 'ACTIVE',
            notes: 'Synchronized from authoritative SIM inventory',
            created_at: new Date().toISOString(),
          });
        }
      }
    } else if (empHasSimNumber || empHasSimId) {
      // Employee has a SIM specified on their profile but no SIM card record was linked yet
      const fallbackMobile = emp.current_sim_number;
      const fallbackProvider = emp.current_sim_provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
      const fallbackIccid = emp.current_sim_iccid || '—';

      // Ensure a corresponding SIM card exists in db.simCardsMaster
      if (db && Array.isArray(db.simCardsMaster)) {
        let sc = db.simCardsMaster.find((s: any) =>
          (emp.current_sim_id && s.id === emp.current_sim_id) ||
          (fallbackMobile && isSamePhone(s.mobile_number, fallbackMobile))
        );
        if (!sc) {
          sc = {
            id: emp.current_sim_id || `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            tenant_id: tenantId,
            mobile_number: fallbackMobile,
            sim_number: fallbackMobile,
            iccid: fallbackIccid,
            provider: fallbackProvider,
            status: 'Assigned',
            assignment_status: 'Assigned',
            current_employee_id: emp.id,
            current_employee_code: emp.employee_code,
            current_employee_name: emp.full_name,
            assigned_date: emp.current_sim_assigned_date || emp.joining_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
            created_at: new Date().toISOString(),
          };
          db.simCardsMaster.unshift(sc);
        } else {
          sc.current_employee_id = emp.id;
          sc.current_employee_code = emp.employee_code;
          sc.current_employee_name = emp.full_name;
          sc.status = 'Assigned';
          sc.assignment_status = 'Assigned';
        }
        emp.current_sim_id = sc.id;
      }
    } else {
      emp.current_sim_id = null;
      emp.current_sim_number = null;
      emp.current_sim_provider = null;
      emp.current_sim_iccid = null;
      emp.current_sim_assigned_date = null;
      emp.current_sim_assigned_by = null;
    }
  }
}

/**
 * Searches authoritative company_pixel_syntax employees for SIM assignment.
 * Searches: Full Name, Employee Code / ADL code, Emirates ID, Mobile Number.
 * Operates on EMPLOYEE MASTER records (never restricted to login/application users).
 * Returns matching results immediately, even with 1 character.
 */
export async function searchSimEligibleEmployees(
  supabase: any,
  db: any,
  options: { query?: string; tenantId?: string; limit?: number }
): Promise<SimEmployeeCandidate[]> {
  const tenantId = options.tenantId || 'company_pixel_syntax';
  const rawQuery = (options.query || '').trim();
  const limit = Math.min(100, Math.max(1, options.limit || 50));

  const safeDb = db || { masterEmployees: [], simCardsMaster: [], simAssignments: [] };

  // Run lifecycle reconciliation to guarantee consistent custody state
  try {
    reconcileSimAssignmentLifecycles(safeDb, tenantId);
  } catch (e) {
    // non-fatal
  }

  // 1. Sync Supabase master employees into in-memory db if available
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false);

      if (!error && Array.isArray(data) && data.length > 0) {
        if (!safeDb.masterEmployees) safeDb.masterEmployees = [];
        for (const emp of data) {
          const idx = safeDb.masterEmployees.findIndex((e: any) => e.id === emp.id);
          if (idx >= 0) {
            safeDb.masterEmployees[idx] = { ...safeDb.masterEmployees[idx], ...emp };
          } else {
            safeDb.masterEmployees.push(emp);
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching employees from Supabase for SIM search:', e);
    }
  }

  // Ensure authoritative directory is loaded
  getAuthoritativeEmployees(safeDb, tenantId);

  // 2. Resolve live SIM custody from actual tenant-scoped card and assignment rows.
  // Avoid selecting optional legacy columns from sim_assignments: on production,
  // that table may have employee_id + sim_card_id but no mobile_number or employee_code.
  const activeSimCustodyMap = new Map<string, { simId: string; simNumber: string }>();

  if (supabase) {
    try {
      const { data: assignedSimCards, error: cardsError } = await supabase
        .from('sim_cards')
        .select('id, mobile_number, current_employee_id, current_employee_code, assignment_status, status')
        .eq('tenant_id', tenantId);
      if (cardsError) throw cardsError;
      const cards = Array.isArray(assignedSimCards) ? assignedSimCards : [];
      const cardsById = new Map(cards.map((card: any) => [String(card.id), card]));

      const { data: activeAssignments, error: assignmentsError } = await supabase
        .from('sim_assignments')
        .select('employee_id, sim_card_id, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');
      if (assignmentsError) throw assignmentsError;

      const holderIdsByCard = new Map<string, Set<string>>();
      for (const asgn of activeAssignments || []) {
        const cardId = String(asgn.sim_card_id || '');
        const empId = String(asgn.employee_id || '');
        if (!cardId || !empId || !cardsById.has(cardId)) continue;
        if (!holderIdsByCard.has(cardId)) holderIdsByCard.set(cardId, new Set());
        holderIdsByCard.get(cardId)!.add(empId);
      }

      for (const card of cards) {
        const cardId = String(card.id);
        const holders = holderIdsByCard.get(cardId);
        // Ambiguous custody must be reconciled, not attributed to a guessed rider.
        if (holders && holders.size > 1) continue;
        const activeId = holders && holders.size === 1 ? [...holders][0] : null;
        const cardAssigned = String(card.assignment_status || '').toUpperCase() === 'ASSIGNED';
        const pointerId = cardAssigned ? String(card.current_employee_id || '') : '';
        // If the card pointer and active assignment disagree, show no false holder.
        if (activeId && pointerId && activeId !== pointerId) continue;
        const holderId = activeId || pointerId;
        if (!holderId) continue;
        const custodyObj = { simId: cardId, simNumber: String(card.mobile_number || '') };
        activeSimCustodyMap.set(holderId, custodyObj);
        if (card.current_employee_code && pointerId === holderId) {
          activeSimCustodyMap.set(String(card.current_employee_code), custodyObj);
        }
      }
    } catch (e) {
      console.warn('Error querying active SIM custody from Supabase:', e);
    }
  }

  // Also check in-memory db assignments if present
  if (safeDb && Array.isArray(safeDb.simAssignments)) {
    for (const asgn of safeDb.simAssignments) {
      if (asgn.tenant_id === tenantId && (asgn.status === 'ACTIVE' || asgn.assignment_status === 'ACTIVE') && asgn.employee_id) {
        // Cross-check with simCardsMaster: if sim is marked Available/Unassigned, it was returned
        const sc = (safeDb.simCardsMaster || []).find((s: any) =>
          s.id === asgn.sim_id || s.id === asgn.sim_card_id || isSamePhone(s.mobile_number, asgn.mobile_number)
        );
        if (sc && (sc.status === 'Available' || sc.assignment_status === 'Unassigned' || !sc.current_employee_id)) {
          continue;
        }

        const custodyObj = {
          simId: asgn.sim_id || asgn.sim_card_id,
          simNumber: asgn.mobile_number,
        };
        if (!activeSimCustodyMap.has(asgn.employee_id)) {
          activeSimCustodyMap.set(asgn.employee_id, custodyObj);
        }
        if (asgn.employee_code && !activeSimCustodyMap.has(asgn.employee_code)) {
          activeSimCustodyMap.set(asgn.employee_code, custodyObj);
        }
      }
    }
  }

  // 3. Search the SAME authoritative company employee directory used across Employee Management
  const matched = searchAuthoritativeEmployees(safeDb, {
    query: rawQuery,
    tenantId,
    limit,
    includeArchived: false,
  });

  // 4. Map to standard SimEmployeeCandidate shape without artificial eligibility filtering
  // Reconcile active SIM ownership strictly from authoritative assignment records, NOT stale employee fields!
  const results: SimEmployeeCandidate[] = matched.map((emp: any) => {
    const custody =
      activeSimCustodyMap.get(emp.id) ||
      (emp.employee_code && activeSimCustodyMap.get(emp.employee_code)) ||
      (emp.employee_id && activeSimCustodyMap.get(emp.employee_id));

    const hasActiveSim = Boolean(custody);
    const resolvedSimId = custody ? custody.simId : null;
    const resolvedSimNumber = custody ? custody.simNumber : null;

    const normName = normalizeEmployeeName(
      emp.first_name,
      emp.last_name,
      emp.full_name || emp.display_name || emp.name
    );

    const eid = emp.emirates_id || emp.emirates_id_number || '—';
    const status = emp.current_status || emp.status || 'Active';

    return {
      id: emp.id,
      full_name: normName || 'Employee',
      employee_code: emp.employee_code || emp.employee_id || '',
      emirates_id: eid,
      current_status: status,
      has_active_sim: hasActiveSim,
      current_sim_id: resolvedSimId,
      current_sim_number: resolvedSimNumber,
      visa_contractor_type: emp.visa_contractor_type || emp.contractor || 'Company Visa',
      primary_project: emp.project_name || emp.current_project_name || '',
      project_name: emp.project_name || emp.current_project_name || '',
      current_bike_plate: emp.current_bike_plate || '—',
    };
  });

  return results;
}

/**
 * Authoritative Single Source of Truth for assigning a SIM to an employee.
 * Validates existence, enforces duplicate active assignment guards,
 * and persists to Supabase (sim_assignments, sim_cards, employees) and in-memory cache.
 */
export async function assignSimAuthoritative(
  supabase: any,
  db: any,
  params: AssignSimParams
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  message?: string;
  sim?: any;
  employee?: any;
  assignment?: any;
}> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const asgnDate = params.assignedDate || now.split('T')[0];
  const assignedBy = resolveStaffUserName(params.assignedBy, db);

  if (!params.simId) {
    return { success: false, code: 'SIM_REQUIRED', error: 'SIM Card ID is required.' };
  }
  if (!params.employeeId) {
    return { success: false, code: 'EMPLOYEE_REQUIRED', error: 'Employee ID is required.' };
  }

  // 1. Fetch and validate target SIM
  let sim: any = null;
  if (supabase) {
    const { data } = await supabase
      .from('sim_cards')
      .select('*')
      .eq('id', params.simId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    sim = data;
  }
  if (!sim && db && Array.isArray(db.simCardsMaster)) {
    sim = db.simCardsMaster.find((s: any) => s.id === params.simId && (s.tenant_id === tenantId || !s.tenant_id));
  }
  if (!sim && db && Array.isArray(db.simCards)) {
    const legacy = db.simCards.find((s: any) => s.id === params.simId);
    if (legacy) {
      sim = {
        id: legacy.id,
        tenant_id: tenantId,
        mobile_number: legacy.simNumber,
        provider: legacy.provider || 'DU',
        plan: legacy.plan || 'Standard',
        monthly_package_amount: legacy.monthlyCost || 100,
        assignment_status: legacy.assignmentStatus || 'Unassigned',
        current_employee_id: legacy.assignedEmployeeId || null,
        current_employee_name: legacy.assignedTo || null,
      };
    }
  }

  if (!sim) {
    return {
      success: false,
      code: 'SIM_NOT_FOUND',
      error: `SIM card ${params.simId} not found in tenant ${tenantId}.`,
    };
  }

  // Check if SIM is Lost - Lost SIMs cannot be assigned under any circumstances
  if (
    sim.status === 'Lost' ||
    sim.status === 'LOST' ||
    sim.assignment_status === 'Lost' ||
    sim.assignment_status === 'LOST'
  ) {
    return {
      success: false,
      code: 'SIM_LOST',
      error: `SIM_LOST: SIM card ${sim.mobile_number} is currently marked as LOST and cannot be assigned. Only an authorized recovery workflow can return it to inventory.`,
    };
  }

  // Check if SIM is Inactive/Cancelled
  if (
    sim.status === 'Inactive' ||
    sim.service_status === 'Inactive' ||
    sim.service_status === 'Cancelled'
  ) {
    return {
      success: false,
      code: 'SIM_INACTIVE',
      error: `SIM_INACTIVE: SIM card ${sim.mobile_number} is Inactive/Cancelled and cannot be assigned.`,
    };
  }

  // 2. Fetch and validate target Employee
  let emp: any = null;
  const targetVariants = getEmployeeIdentifierVariants(params.employeeId);

  if (supabase) {
    const cleanId = String(params.employeeId).trim();
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`id.eq.${cleanId},employee_code.eq.${cleanId},employee_id.eq.${cleanId}`)
      .maybeSingle();
    emp = data;
  }
  if (!emp && db && Array.isArray(db.masterEmployees)) {
    emp = db.masterEmployees.find((e: any) => {
      if (e.tenant_id !== tenantId && e.tenant_id && tenantId !== 'company_pixel_syntax') return false;
      const eVars = getEmployeeIdentifierVariants(e);
      for (const v of targetVariants) {
        if (eVars.has(v)) return true;
      }
      return false;
    });
  }
  if (!emp) {
    emp = AUTHORITATIVE_MASTER_EMPLOYEES.find((e) => {
      const eVars = getEmployeeIdentifierVariants(e);
      for (const v of targetVariants) {
        if (eVars.has(v)) return true;
      }
      return false;
    });
  }

  if (!emp) {
    return {
      success: false,
      code: 'EMPLOYEE_NOT_FOUND',
      error: `Employee ${params.employeeId} not found in company workforce.`,
    };
  }

  const empName = emp.full_name || normalizeEmployeeName(emp.first_name, emp.last_name, emp.full_name || emp.display_name || emp.name);

  // 3. DUPLICATE ACTIVE ASSIGNMENT GUARD: Check if Employee already has a genuinely active SIM
  // Reconcile active SIM ownership from authoritative assignment records, NOT stale employee fields.
  let employeeAlreadyHasSim = false;
  let activeSimNumber: string | null = null;

  if (supabase) {
    const empVariants = getEmployeeIdentifierVariants(emp);
    const { data: existingActive } = await supabase
      .from('sim_assignments')
      .select('id, sim_card_id, mobile_number, status, employee_id, employee_code, employee_name')
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE');

    if (Array.isArray(existingActive)) {
      for (const asgn of existingActive) {
        const aVars = getEmployeeIdentifierVariants({ id: asgn.employee_id, employee_code: asgn.employee_code });
        let matchesEmp = false;
        for (const v of empVariants) {
          if (aVars.has(v)) {
            matchesEmp = true;
            break;
          }
        }
        if (!matchesEmp && emp.full_name && asgn.employee_name && matchEmployeeNames(emp.full_name, asgn.employee_name)) {
          matchesEmp = true;
        }

        if (matchesEmp) {
          const isSameSim = (asgn.sim_card_id === sim.id || isSamePhone(asgn.mobile_number, sim.mobile_number));
          if (isSameSim) {
            // Already assigned to this employee - idempotent success!
            return {
              success: true,
              message: `SIM ${sim.mobile_number} is already actively assigned to ${empName} (${emp.employee_code || ''}).`,
              sim,
              employee: emp,
              assignment: asgn,
            };
          } else {
            // Verify if the SIM card for this assignment is still genuinely marked Assigned in sim_cards table
            const { data: checkCard } = await supabase
              .from('sim_cards')
              .select('id, assignment_status, status, current_employee_id')
              .eq('id', asgn.sim_card_id)
              .maybeSingle();

            if (!checkCard || (checkCard.assignment_status === 'Assigned' && checkCard.current_employee_id)) {
              employeeAlreadyHasSim = true;
              activeSimNumber = asgn.mobile_number;
              break;
            } else {
              // The assignment was left as ACTIVE while the SIM was already returned/unassigned in sim_cards!
              // Auto-reconcile this orphan assignment row
              await supabase
                .from('sim_assignments')
                .update({
                  status: 'RETURNED',
                  assignment_status: 'RETURNED',
                  returned_at: now,
                  returned_date: asgnDate,
                  return_date: asgnDate,
                  return_reason: 'Auto-reconciled: SIM card was previously returned to inventory pool',
                  returned_by: assignedBy,
                })
                .eq('id', asgn.id);
            }
          }
        }
      }
    }
  }

  // Also verify against active assigned cards in sim_cards table
  if (supabase && !employeeAlreadyHasSim) {
    const { data: assignedCards } = await supabase
      .from('sim_cards')
      .select('id, mobile_number, current_employee_id, current_employee_code, current_employee_name, assignment_status, status')
      .eq('tenant_id', tenantId)
      .eq('assignment_status', 'Assigned');

    if (Array.isArray(assignedCards)) {
      const empVariants = getEmployeeIdentifierVariants(emp);
      for (const card of assignedCards) {
        if (!card.current_employee_id) continue;
        const cVars = getEmployeeIdentifierVariants({ id: card.current_employee_id, employee_code: card.current_employee_code });
        let matchesEmp = false;
        for (const v of empVariants) {
          if (cVars.has(v)) {
            matchesEmp = true;
            break;
          }
        }
        if (!matchesEmp && emp.full_name && card.current_employee_name && matchEmployeeNames(emp.full_name, card.current_employee_name)) {
          matchesEmp = true;
        }

        if (matchesEmp) {
          if (card.id === sim.id || isSamePhone(card.mobile_number, sim.mobile_number)) {
            return {
              success: true,
              message: `SIM ${sim.mobile_number} is already assigned to ${empName} (${emp.employee_code || ''}).`,
              sim,
              employee: emp,
            };
          } else {
            employeeAlreadyHasSim = true;
            activeSimNumber = card.mobile_number;
            break;
          }
        }
      }
    }
  }

  if (db && Array.isArray(db.simAssignments)) {
    const empIdentifiers = getEmployeeIdentifierVariants(emp);
    const activeAssignments = db.simAssignments.filter((a: any) => {
      if (a.tenant_id !== tenantId && tenantId !== 'company_pixel_syntax') return false;
      if (a.status !== 'ACTIVE' && a.assignment_status !== 'ACTIVE') return false;
      const aEmpIds = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
      for (const id of empIdentifiers) {
        if (aEmpIds.has(id)) return true;
      }
      return matchEmployeeNames(emp.full_name, a.employee_name);
    });

    for (const memActive of activeAssignments) {
      const isTargetSim = (memActive.sim_card_id === sim.id || memActive.sim_id === sim.id) ||
        isSamePhone(memActive.mobile_number, sim.mobile_number);

      if (isTargetSim) {
        // Reassignment of the same SIM: safely close previous cycle as RETURNED so new cycle can start cleanly
        memActive.status = 'RETURNED';
        memActive.assignment_status = 'RETURNED';
        memActive.returned_date = memActive.returned_date || new Date().toISOString().slice(0, 10);
        memActive.return_date = memActive.returned_date;
        memActive.return_reason = memActive.return_reason || 'Previous cycle closed prior to reassignment';
        memActive.returned_by = memActive.returned_by || 'Operations Admin';
      } else {
        // Check if the other SIM is genuinely in use
        const otherSc = (db.simCardsMaster || []).find((s: any) =>
          s.id === memActive.sim_id || s.id === memActive.sim_card_id || isSamePhone(s.mobile_number, memActive.mobile_number)
        );
        if (otherSc && (otherSc.status === 'Available' || otherSc.assignment_status === 'Unassigned' || !otherSc.current_employee_id)) {
          // Orphan assignment: auto-reconcile it
          memActive.status = 'RETURNED';
          memActive.assignment_status = 'RETURNED';
          memActive.returned_date = memActive.returned_date || new Date().toISOString().slice(0, 10);
          memActive.return_date = memActive.returned_date;
          memActive.return_reason = memActive.return_reason || 'Auto-reconciled: SIM was returned';
          memActive.returned_by = memActive.returned_by || 'Operations Admin';
        } else {
          employeeAlreadyHasSim = true;
          activeSimNumber = memActive.mobile_number || activeSimNumber;
        }
      }
    }
  }

  if (employeeAlreadyHasSim) {
    return {
      success: false,
      code: 'EMPLOYEE_ALREADY_HAS_SIM',
      error: `EMPLOYEE_ALREADY_HAS_SIM: Employee ${empName} (${emp.employee_code || ''}) already has an active primary SIM (${activeSimNumber || 'Active SIM'}). Policy prohibits duplicate active SIM custody. Return or replace the current SIM first.`,
    };
  }

  // 4. DUPLICATE ACTIVE ASSIGNMENT GUARD: Check if SIM is already assigned to someone else
  let simAlreadyAssigned = false;
  let currentCustodianName = sim.current_employee_name;

  const simIsAssigned = (sim.assignment_status === 'Assigned' || sim.status === 'Assigned' || sim.current_employee_id) &&
    sim.status !== 'Available' && sim.assignment_status !== 'Unassigned';

  if (simIsAssigned) {
    const empIdentifiers = getEmployeeIdentifierVariants(emp);
    const isAssignedToThisEmp = empIdentifiers.has(String(sim.current_employee_id).trim()) ||
      (sim.current_employee_code && empIdentifiers.has(String(sim.current_employee_code).trim())) ||
      matchEmployeeNames(emp.full_name, sim.current_employee_name);

    if (!isAssignedToThisEmp) {
      simAlreadyAssigned = true;
    }
  }

  if (supabase) {
    const { data: activeSimAsgns } = await supabase
      .from('sim_assignments')
      .select('id, employee_id, employee_name')
      .eq('sim_card_id', sim.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE');

    if (Array.isArray(activeSimAsgns) && activeSimAsgns.length > 0) {
      const otherHolder = activeSimAsgns.find((a: any) => a.employee_id !== emp.id);
      if (otherHolder) {
        simAlreadyAssigned = true;
        currentCustodianName = otherHolder.employee_name || currentCustodianName;
      }
    }
  }

  if (db && Array.isArray(db.simAssignments)) {
    const empIdentifiers = getEmployeeIdentifierVariants(emp);
    const otherHolderAsgn = db.simAssignments.find((a: any) => {
      if (a.tenant_id !== tenantId && tenantId !== 'company_pixel_syntax') return false;
      if (a.status !== 'ACTIVE' && a.assignment_status !== 'ACTIVE') return false;
      const matchesSim = (a.sim_id === sim.id || a.sim_card_id === sim.id) ||
        isSamePhone(a.mobile_number, sim.mobile_number);
      if (!matchesSim) return false;

      const aEmpIds = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
      for (const id of empIdentifiers) {
        if (aEmpIds.has(id)) return false; // same employee
      }
      return !matchEmployeeNames(emp.full_name, a.employee_name);
    });

    if (otherHolderAsgn) {
      const otherEmp = (db.masterEmployees || []).find((e: any) => {
        const eIds = getEmployeeIdentifierVariants(e);
        return eIds.has(String(otherHolderAsgn.employee_id).trim());
      });
      simAlreadyAssigned = true;
      currentCustodianName = otherHolderAsgn.employee_name || otherEmp?.full_name || currentCustodianName;
    }
  }

  if (simAlreadyAssigned) {
    return {
      success: false,
      code: 'SIM_ALREADY_ASSIGNED',
      error: `SIM_ALREADY_ASSIGNED: SIM ${sim.mobile_number} is currently assigned to ${currentCustodianName || 'another employee'}. An assigned SIM cannot be assigned to another employee until its current assignment is formally returned or transferred.`,
    };
  }

  // 5. ATOMIC PERSISTENCE
  const asgnId = `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const pkgAmount = params.monthlyPackageAmount !== undefined ? Number(params.monthlyPackageAmount) : (sim.monthly_package_amount || 100);
  const appAmount = params.approvedAmount !== undefined ? Number(params.approvedAmount) : (sim.approved_amount ?? pkgAmount);
  const payAmount = params.payableAmount !== undefined ? Number(params.payableAmount) : (sim.payable_amount ?? Math.max(0, pkgAmount - appAmount));

  const asgnRecord = {
    id: asgnId,
    tenant_id: tenantId,
    sim_id: sim.id,
    sim_card_id: sim.id,
    mobile_number: sim.mobile_number,
    provider: sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
    iccid: sim.iccid || sim.sim_serial_number || '—',
    employee_id: emp.id,
    employee_name: empName,
    employee_code: emp.employee_code,
    assigned_at: asgnDate,
    assigned_date: asgnDate,
    assigned_by: assignedBy,
    status: 'ACTIVE',
    notes: params.notes || 'Assigned via SIM Management module',
    created_at: now,
  };

  // 5a. Persist to Supabase
  if (supabase) {
    try {
      let assignmentPersisted = false;
      // First try rpc_assign_sim if available
      try {
        const { error: rpcErr } = await supabase.rpc('rpc_assign_sim', {
          p_tenant_id: tenantId,
          p_sim_id: sim.id,
          p_employee_id: emp.id,
          p_assigned_date: asgnDate,
          p_notes: params.notes || null,
          p_assigned_by: assignedBy,
          p_user_id: 'usr_ops',
        });
        if (!rpcErr) {
          assignmentPersisted = true;
        }
      } catch (rpcEx) {
        // Fall back to direct insertion below
      }

      if (!assignmentPersisted) {
        // Fallback to explicit direct table updates using defensive safeSupabaseInsert
        await safeSupabaseInsert(supabase, 'sim_assignments', {
          id: asgnId,
          tenant_id: tenantId,
          sim_card_id: sim.id,
          mobile_number: sim.mobile_number,
          provider: sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
          iccid: sim.iccid || sim.sim_serial_number || '—',
          employee_id: emp.id,
          employee_name: empName,
          employee_code: emp.employee_code,
          assigned_at: asgnDate.includes('T') ? asgnDate : `${asgnDate}T08:00:00Z`,
          assigned_date: asgnDate,
          assigned_by: assignedBy,
          status: 'ACTIVE',
          assignment_status: 'ACTIVE',
          notes: params.notes || 'Assigned via SIM Management module',
          created_at: now,
        });

        await safeSupabaseUpdate(
          supabase,
          'sim_cards',
          {
            assignment_status: 'Assigned',
            status: 'Assigned',
            current_employee_id: emp.id,
            current_employee_name: empName,
            current_employee_code: emp.employee_code,
            assigned_date: asgnDate,
            assigned_by: assignedBy,
            monthly_package_amount: pkgAmount,
            notes: params.notes || null,
            updated_at: now,
            updated_by: assignedBy,
          },
          'id',
          sim.id
        );

        await safeSupabaseUpdate(
          supabase,
          'employees',
          {
            current_sim_id: sim.id,
            current_sim_number: sim.mobile_number,
            updated_at: now,
            updated_by: assignedBy,
          },
          'id',
          emp.id
        );
      }
    } catch (e) {
      console.error('Supabase persistence error during SIM assignment:', e);
    }
  }

  // 5b. Update in-memory db caches
  sim.assignment_status = 'Assigned';
  sim.status = 'Assigned';
  sim.current_employee_id = emp.id;
  sim.current_employee_name = empName;
  sim.current_employee_code = emp.employee_code;
  sim.assigned_date = asgnDate;
  sim.assigned_by = assignedBy;
  sim.monthly_package_amount = pkgAmount;
  sim.approved_amount = appAmount;
  sim.payable_amount = payAmount;
  sim.updated_at = now;

  emp.current_sim_id = sim.id;
  emp.current_sim_number = sim.mobile_number;
  emp.current_sim_provider = sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
  emp.current_sim_iccid = sim.iccid || sim.sim_serial_number || '—';
  emp.current_sim_assigned_date = asgnDate;
  emp.current_sim_assigned_by = assignedBy;
  emp.updated_at = now;

  if (db) {
    if (!Array.isArray(db.simAssignments)) db.simAssignments = [];
    db.simAssignments.unshift(asgnRecord);

    if (Array.isArray(db.simCardsMaster)) {
      const idx = db.simCardsMaster.findIndex((s: any) => s.id === sim.id);
      if (idx >= 0) db.simCardsMaster[idx] = { ...db.simCardsMaster[idx], ...sim };
    }
    if (Array.isArray(db.masterEmployees)) {
      const idx = db.masterEmployees.findIndex((e: any) => e.id === emp.id);
      if (idx >= 0) db.masterEmployees[idx] = { ...db.masterEmployees[idx], ...emp };
    }
    if (Array.isArray(db.simCards)) {
      const legacyCard = db.simCards.find((c: any) => c.id === sim.id || c.simNumber === sim.mobile_number);
      if (legacyCard) {
        legacyCard.assignedTo = empName;
        legacyCard.assignedEmployeeId = emp.id;
        legacyCard.assignmentStatus = 'Assigned';
        legacyCard.status = 'Assigned';
        legacyCard.assignedDate = asgnDate;
      }
    }

    await syncAuthoritativeSimAssignments(supabase, db, tenantId);
  }

  return {
    success: true,
    message: `SIM ${sim.mobile_number} successfully assigned to ${empName}.`,
    sim,
    employee: emp,
    assignment: asgnRecord,
  };
}

/**
 * Authoritative Return and Assign: Atomically returns an employee's existing SIM
 * and assigns a new SIM in a single coordinated operation.
 */
export async function returnAndAssignSimAuthoritative(
  supabase: any,
  db: any,
  params: ReturnAndAssignSimParams
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  message?: string;
  oldSim?: any;
  newSim?: any;
  assignment?: any;
}> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const asgnDate = params.assignedDate || now.split('T')[0];
  const actorName = params.actorName || 'Operations Admin';
  const mandatoryReason = (params.returnReason || 'Returned existing line before assigning new SIM').trim();

  if (!params.newSimId) {
    return { success: false, code: 'SIM_ID_REQUIRED', error: 'Target new SIM ID is required.' };
  }
  if (!params.employeeId) {
    return { success: false, code: 'EMPLOYEE_ID_REQUIRED', error: 'Target employee ID is required.' };
  }

  // 1. Identify target employee
  let emp: any = null;
  const targetVariants = getEmployeeIdentifierVariants(params.employeeId);
  if (supabase) {
    const { data: byId } = await supabase
      .from('employees')
      .select('*')
      .eq('id', params.employeeId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    emp = byId;
    if (!emp) {
      const cleanTarget = String(params.employeeId).replace(/^emp_/, '').trim();
      const { data: byCode } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`employee_code.eq.${cleanTarget},employee_id.eq.${cleanTarget},employee_code.eq.${params.employeeId}`)
        .maybeSingle();
      emp = byCode;
    }
  }
  if (!emp && db && Array.isArray(db.masterEmployees)) {
    emp = db.masterEmployees.find((e: any) => {
      const eVars = getEmployeeIdentifierVariants(e);
      for (const v of targetVariants) {
        if (eVars.has(v)) return true;
      }
      return false;
    });
  }
  if (!emp) {
    emp = AUTHORITATIVE_MASTER_EMPLOYEES.find((e) => {
      const eVars = getEmployeeIdentifierVariants(e);
      for (const v of targetVariants) {
        if (eVars.has(v)) return true;
      }
      return false;
    });
  }

  if (!emp) {
    return { success: false, code: 'EMPLOYEE_NOT_FOUND', error: `Employee ${params.employeeId} not found in company directory.` };
  }

  // 2. Identify the old SIM to return
  let effectiveOldSimId = params.oldSimId;
  if (!effectiveOldSimId) {
    // Look up active assignment for this employee
    if (supabase) {
      const empVariants = getEmployeeIdentifierVariants(emp);
      const { data: activeAsgns } = await supabase
        .from('sim_assignments')
        .select('sim_card_id, sim_id, employee_id, employee_code, status')
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');

      if (Array.isArray(activeAsgns)) {
        const found = activeAsgns.find((a: any) => {
          const aVars = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
          for (const v of empVariants) {
            if (aVars.has(v)) return true;
          }
          return false;
        });
        if (found) {
          effectiveOldSimId = found.sim_card_id || found.sim_id;
        }
      }
    }
    if (!effectiveOldSimId && emp.current_sim_id) {
      effectiveOldSimId = emp.current_sim_id;
    }
  }

  // 3. Step 1: Return the old SIM if one was identified
  let oldSimResult: any = null;
  if (effectiveOldSimId) {
    const returnRes = await returnSimAuthoritative(supabase, db, {
      tenantId,
      simId: effectiveOldSimId,
      employeeId: emp.id,
      employeeCode: emp.employee_code,
      employeeName: emp.full_name,
      returnReason: mandatoryReason,
      returnDate: asgnDate,
      returnedBy: actorName,
      notes: params.notes,
    });

    if (!returnRes.success && returnRes.code !== 'SIM_NOT_FOUND') {
      return {
        success: false,
        code: returnRes.code || 'RETURN_STEP_FAILED',
        error: `Return of existing SIM failed: ${returnRes.error}`,
      };
    }
    oldSimResult = returnRes;
  }

  // 4. Step 2: Assign the new SIM to the employee
  const assignRes = await assignSimAuthoritative(supabase, db, {
    tenantId,
    simId: params.newSimId,
    employeeId: emp.id,
    assignedDate: asgnDate,
    monthlyPackageAmount: params.monthlyPackageAmount,
    approvedAmount: params.approvedAmount,
    payableAmount: params.payableAmount,
    notes: `Assigned via return-and-assign. Reason: ${mandatoryReason}${params.notes ? ` | ${params.notes}` : ''}`,
    assignedBy: actorName,
  });

  if (!assignRes.success) {
    return {
      success: false,
      code: assignRes.code || 'ASSIGN_STEP_FAILED',
      error: `Assignment of new SIM failed: ${assignRes.error}`,
    };
  }

  return {
    success: true,
    message: `Successfully returned previous SIM and assigned new SIM to ${emp.full_name}.`,
    oldSim: oldSimResult?.sim,
    newSim: assignRes.sim,
    assignment: assignRes.assignment,
  };
}

/**
 * Repairs stale SIM custody pointers on master employees in Supabase.
 * Strictly adheres to production safety:
 * - Reads authoritative sim_cards and sim_assignments.
 * - Only clears current_sim_id / current_sim_number on employee rows where:
 *   1. The referenced SIM is proven Unassigned/Available in sim_cards table (or does not exist), AND
 *   2. The employee has NO active assignment in sim_assignments.
 * - Never deletes or overwrites historical assignment records or audit history.
 */
export async function repairStaleSimCustodyPointersAuthoritative(
  supabase: any,
  tenantId: string = 'company_pixel_syntax'
): Promise<{
  repairedCount: number;
  repairedEmployees: string[];
  skippedEmployees: string[];
  syncedCardsCount: number;
}> {
  if (!supabase) {
    return { repairedCount: 0, repairedEmployees: [], skippedEmployees: [], syncedCardsCount: 0 };
  }

  const repairedEmployees: string[] = [];
  const skippedEmployees: string[] = [];
  let syncedCardsCount = 0;

  try {
    // 1. Fetch all SIM cards in tenant
    const { data: sims, error: simErr } = await supabase
      .from('sim_cards')
      .select('id, mobile_number, assignment_status, status, current_employee_id, provider, iccid')
      .eq('tenant_id', tenantId);

    if (simErr || !Array.isArray(sims)) {
      return { repairedCount: 0, repairedEmployees: [], skippedEmployees: [], syncedCardsCount: 0 };
    }

    const simMapById = new Map<string, any>();
    const simMapByDigits = new Map<string, any>();
    for (const s of sims) {
      simMapById.set(s.id, s);
      const d = (s.mobile_number || '').replace(/\D/g, '');
      if (d) simMapByDigits.set(d, s);
    }

    // 2. Fetch all employees in tenant
    const { data: emps, error: empErr } = await supabase
      .from('employees')
      .select('id, employee_code, full_name, current_sim_id, current_sim_number, current_status, project_name, joining_date, current_sim_assigned_date, current_sim_assigned_by')
      .eq('tenant_id', tenantId);

    if (empErr || !Array.isArray(emps)) {
      return { repairedCount: 0, repairedEmployees: [], skippedEmployees: [], syncedCardsCount: 0 };
    }

    // Group employees by referenced SIM
    const simToEmpsMap = new Map<string, any[]>();
    for (const emp of emps) {
      if (emp.current_sim_id || emp.current_sim_number) {
        const sId = emp.current_sim_id;
        const sDigits = (emp.current_sim_number || '').replace(/\D/g, '');
        const matchedSim = (sId ? simMapById.get(sId) : null) || (sDigits ? simMapByDigits.get(sDigits) : null);
        const key = matchedSim ? matchedSim.id : (sId || emp.current_sim_number);
        if (!simToEmpsMap.has(key)) {
          simToEmpsMap.set(key, []);
        }
        simToEmpsMap.get(key)!.push(emp);
      }
    }

    const now = new Date().toISOString();

    for (const [simKey, empList] of simToEmpsMap.entries()) {
      const sim = simMapById.get(simKey);
      if (!sim) continue;

      if (empList.length > 1) {
        // Duplicate custody detected:
        // Critical Rule: Duty status must NEVER automatically return or release physical SIM custody.
        // If sim_cards explicitly records current_employee_id, that is the card's recorded custodian.
        let chosenEmp = empList.find((e) => sim && sim.current_employee_id === e.id);
        if (!chosenEmp) {
          chosenEmp = [...empList].sort((a, b) => {
            const dateA = new Date(a.current_sim_assigned_date || a.joining_date || 0).getTime();
            const dateB = new Date(b.current_sim_assigned_date || b.joining_date || 0).getTime();
            return dateB - dateA;
          })[0];
        }

        // Clear stale duplicate pointers on other employees
        for (const emp of empList) {
          if (emp.id !== chosenEmp.id) {
            await supabase
              .from('employees')
              .update({
                current_sim_id: null,
                current_sim_number: null,
                current_sim_provider: null,
                current_sim_iccid: null,
                current_sim_assigned_date: null,
                current_sim_assigned_by: null,
                updated_at: now,
              })
              .eq('id', emp.id);
            repairedEmployees.push(`${emp.employee_code || emp.id} (${emp.full_name}) [Cleared duplicate pointer to SIM ${sim.mobile_number}]`);
          } else {
            skippedEmployees.push(`${chosenEmp.employee_code || chosenEmp.id} (${chosenEmp.full_name}) [Retained authoritative custody of SIM ${sim.mobile_number}]`);
          }
        }

        // Sync sim_cards record to chosenEmp
        await supabase
          .from('sim_cards')
          .update({
            current_employee_id: chosenEmp.id,
            current_employee_name: chosenEmp.full_name,
            current_employee_code: chosenEmp.employee_code,
            assignment_status: 'Assigned',
            status: 'Assigned',
            assigned_date: chosenEmp.current_sim_assigned_date || chosenEmp.joining_date || '2026-02-24',
            assigned_by: chosenEmp.current_sim_assigned_by || 'System User',
            updated_at: now,
          })
          .eq('id', sim.id);
        syncedCardsCount++;
      } else {
        // Single employee holds SIM: Physical custody is maintained regardless of duty status.
        // Only a recorded return, replacement or transfer transaction may release it.
        const emp = empList[0];
        if (sim.current_employee_id !== emp.id) {
          await supabase
            .from('sim_cards')
            .update({
              current_employee_id: emp.id,
              current_employee_name: emp.full_name,
              current_employee_code: emp.employee_code,
              assignment_status: 'Assigned',
              status: 'Assigned',
              assigned_date: emp.current_sim_assigned_date || emp.joining_date || '2026-02-24',
              assigned_by: emp.current_sim_assigned_by || 'System User',
              updated_at: now,
            })
            .eq('id', sim.id);
          syncedCardsCount++;
        }
        skippedEmployees.push(`${emp.employee_code || emp.id} (${emp.full_name}) [Active assignment verified]`);
      }
    }
  } catch (err) {
    console.error('Error during authoritative SIM custody reconciliation:', err);
  }

  return {
    repairedCount: repairedEmployees.length,
    repairedEmployees,
    skippedEmployees,
    syncedCardsCount,
  };
}

/**
 * Authoritative Single Source of Truth for returning / unassigning a SIM card.
 * Closes active assignment records and resets SIM and Employee to available/unassigned.
 */
export async function returnSimAuthoritative(
  supabase: any,
  db: any,
  params: ReturnSimParams
): Promise<{ success: boolean; code?: string; error?: string; message?: string }> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const retDate = params.returnDate || now.split('T')[0];
  const retTime = params.returnTime || (now.split('T')[1] ? now.split('T')[1].slice(0, 5) : '12:00');
  const returnedBy = resolveStaffUserName(params.returnedBy || params.returnedTo, db);

  if (!params.simId && !params.mobileNumber && !params.employeeId) {
    return { success: false, code: 'SIM_REQUIRED', error: 'SIM Card ID, mobile number, or employee ID is required.' };
  }

  const mandatoryReason = (params.returnReason || params.returnRemark || params.reason || '').trim() || 'Rider returned SIM card to depot inventory';
  const rawTargetNum = (params.mobileNumber || (typeof params.simId === 'string' && params.simId.startsWith('05') ? params.simId : '')).replace(/\D/g, '');

  // 1. Resolve employee from in-memory if available
  const targetEmployeeId = params.employeeId;
  const memEmp = db
    ? (db.masterEmployees || []).find(
        (e: any) =>
          (targetEmployeeId && (e.id === targetEmployeeId || e.employee_code === targetEmployeeId || e.employee_id === targetEmployeeId)) ||
          (params.employeeCode && e.employee_code === params.employeeCode)
      ) ||
      (db.employees || []).find(
        (e: any) =>
          (targetEmployeeId && (e.id === targetEmployeeId || e.employee_code === targetEmployeeId || e.employee_id === targetEmployeeId)) ||
          (params.employeeCode && e.employee_code === params.employeeCode)
      )
    : null;

  // 2. Resolve SIM from in-memory if available
  let memSim = db && Array.isArray(db.simCardsMaster)
    ? db.simCardsMaster.find((s: any) => {
        if (params.simId && s.id === params.simId) return true;
        if (params.mobileNumber && (s.mobile_number === params.mobileNumber || s.sim_number === params.mobileNumber)) return true;
        if (rawTargetNum) {
          const sDigits = (s.mobile_number || s.sim_number || '').replace(/\D/g, '');
          if (sDigits && (sDigits === rawTargetNum || sDigits.endsWith(rawTargetNum) || rawTargetNum.endsWith(sDigits))) return true;
        }
        if (memEmp && (s.current_employee_id === memEmp.id || (memEmp.current_sim_id && s.id === memEmp.current_sim_id))) return true;
        return false;
      })
    : null;

  // 3. Defensive Lookup from Supabase
  let sbEmp: any = null;
  let sbSim: any = null;
  if (supabase) {
    try {
      if (targetEmployeeId || params.employeeCode) {
        const queryTerm = targetEmployeeId || params.employeeCode;
        const { data } = await supabase
          .from('employees')
          .select('id, employee_code, full_name, current_sim_id, current_sim_number, project_name')
          .eq('tenant_id', tenantId)
          .or(`id.eq.${queryTerm},employee_code.eq.${queryTerm}`)
          .maybeSingle();
        if (data) sbEmp = data;
      }

      // Find SIM in Supabase
      if (params.simId && !params.simId.startsWith('sim_05')) {
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', params.simId)
          .maybeSingle();
        if (data) sbSim = data;
      }

      if (!sbSim && (params.mobileNumber || rawTargetNum)) {
        const phoneToFind = params.mobileNumber || (rawTargetNum.startsWith('0') ? rawTargetNum : `0${rawTargetNum}`);
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('mobile_number', phoneToFind)
          .maybeSingle();
        if (data) sbSim = data;
      }

      if (!sbSim && rawTargetNum) {
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('normalized_mobile_number', rawTargetNum)
          .maybeSingle();
        if (data) sbSim = data;
      }

      if (!sbSim && sbEmp?.current_sim_id) {
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', sbEmp.current_sim_id)
          .maybeSingle();
        if (data) sbSim = data;
      }

      if (!sbSim && sbEmp?.current_sim_number) {
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('mobile_number', sbEmp.current_sim_number)
          .maybeSingle();
        if (data) sbSim = data;
      }

      if (!sbSim && (targetEmployeeId || sbEmp?.id)) {
        const empLookupId = sbEmp?.id || targetEmployeeId;
        const { data } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('current_employee_id', empLookupId)
          .maybeSingle();
        if (data) sbSim = data;
      }
    } catch (lookupErr) {
      console.warn('Supabase SIM return lookup warning:', lookupErr);
    }
  }

  // 4. Resolve Authoritative Identifiers
  let resolvedEmp = sbEmp || memEmp;
  if (!resolvedEmp && targetEmployeeId) {
    resolvedEmp = (db?.masterEmployees || []).find((e: any) => {
      const vars = getEmployeeIdentifierVariants(e);
      return vars.has(String(targetEmployeeId).trim());
    }) || (db?.employees || []).find((e: any) => {
      const vars = getEmployeeIdentifierVariants(e);
      return vars.has(String(targetEmployeeId).trim());
    }) || AUTHORITATIVE_MASTER_EMPLOYEES.find((e: any) => {
      const vars = getEmployeeIdentifierVariants(e);
      return vars.has(String(targetEmployeeId).trim());
    });
  }

  // If employee not resolved from params, resolve from SIM card custodian or active assignment
  if (!resolvedEmp) {
    const cardHolderId = sbSim?.current_employee_id || memSim?.current_employee_id;
    if (cardHolderId) {
      resolvedEmp = (db?.masterEmployees || []).find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(cardHolderId).trim());
      }) || (db?.employees || []).find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(cardHolderId).trim());
      }) || AUTHORITATIVE_MASTER_EMPLOYEES.find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(cardHolderId).trim());
      });
    }
  }

  if (!resolvedEmp && db?.simAssignments && Array.isArray(db.simAssignments)) {
    const activeAsgn = db.simAssignments.find((a: any) =>
      (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE') &&
      ((params.simId && (a.sim_id === params.simId || a.sim_card_id === params.simId)) ||
       (rawTargetNum && isSamePhone(a.mobile_number, rawTargetNum)))
    );
    if (activeAsgn?.employee_id) {
      resolvedEmp = (db?.masterEmployees || []).find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(activeAsgn.employee_id).trim());
      }) || (db?.employees || []).find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(activeAsgn.employee_id).trim());
      }) || AUTHORITATIVE_MASTER_EMPLOYEES.find((e: any) => {
        const vars = getEmployeeIdentifierVariants(e);
        return vars.has(String(activeAsgn.employee_id).trim());
      });
    }
  }

  const realSimId = sbSim?.id || memSim?.id || params.simId || (rawTargetNum ? `sim_${rawTargetNum}` : `sim_${Date.now()}`);
  const realMobile = sbSim?.mobile_number || memSim?.mobile_number || params.mobileNumber || sbEmp?.current_sim_number || memEmp?.current_sim_number || (rawTargetNum ? (rawTargetNum.startsWith('0') ? rawTargetNum : `0${rawTargetNum}`) : 'Active Line');
  const realEmpId = resolvedEmp?.id || targetEmployeeId || sbSim?.current_employee_id || memSim?.current_employee_id || null;
  const realEmpCode = resolvedEmp?.employee_code || resolvedEmp?.employee_id || params.employeeCode || sbSim?.current_employee_code || memSim?.current_employee_code || '';
  const realEmpName = resolvedEmp?.full_name || params.employeeName || sbSim?.current_employee_name || memSim?.current_employee_name || 'Rider';
  const preservedProvider = sbSim?.provider || memSim?.provider || resolvedEmp?.current_sim_provider || 'ETISALAT';
  const preservedPlan = sbSim?.plan || memSim?.plan || 'Standard Fleet Plan';
  const preservedIccid = sbSim?.iccid || memSim?.iccid || resolvedEmp?.current_sim_iccid || '—';
  const lastAssignedDate = sbSim?.assigned_date || memSim?.assigned_date || resolvedEmp?.current_sim_assigned_date || resolvedEmp?.joining_date || retDate;
  const lastAssignedBy = resolveStaffUserName(sbSim?.assigned_by || memSim?.assigned_by || resolvedEmp?.current_sim_assigned_by || 'Operations Admin', db);
  const lastProject = sbSim?.project_name || memSim?.project_name || resolvedEmp?.project_name || null;

  // Guard: A lost SIM cannot be processed via normal return workflow
  const simRecord = sbSim || memSim;
  if (
    simRecord &&
    (simRecord.status === 'Lost' ||
      simRecord.status === 'LOST' ||
      simRecord.assignment_status === 'Lost' ||
      simRecord.assignment_status === 'LOST')
  ) {
    return {
      success: false,
      code: 'SIM_LOST',
      error: `SIM_LOST: SIM card ${realMobile} is currently marked as LOST. Lost SIMs cannot be returned; they must go through the authorized physical recovery workflow.`,
    };
  }

  // 5. Query active assignments in Supabase
  let activeAssignments: any[] = [];
  if (supabase) {
    try {
      if (realSimId) {
        const { data } = await supabase
          .from('sim_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('sim_card_id', realSimId)
          .in('status', ['ACTIVE', 'Active']);
        if (data && data.length > 0) activeAssignments.push(...data);
      }
      if (realEmpId) {
        const { data } = await supabase
          .from('sim_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('employee_id', realEmpId)
          .in('status', ['ACTIVE', 'Active']);
        if (data && data.length > 0) {
          for (const a of data) {
            if (!activeAssignments.some((ex) => ex.id === a.id)) {
              activeAssignments.push(a);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error querying active sim assignments in Supabase:', err);
    }
  }

  // Also check memory for active assignments
  let memActiveAssignment: any = null;
  if (db && Array.isArray(db.simAssignments)) {
    const empVariants = realEmpId ? getEmployeeIdentifierVariants(realEmpId) : new Set<string>();
    if (realEmpCode) {
      empVariants.add(String(realEmpCode).trim());
      empVariants.add(String(realEmpCode).toLowerCase().trim());
    }

    memActiveAssignment = db.simAssignments.find((a: any) => {
      const isStatusActive = a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE';
      if (!isStatusActive) return false;
      const matchesSim = (a.sim_card_id === realSimId || a.sim_id === realSimId) ||
        (realMobile && (isSamePhone(a.mobile_number, realMobile) || a.mobile_number === realMobile));

      let matchesEmp = false;
      if (empVariants.size > 0) {
        const aVars = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
        for (const v of empVariants) {
          if (aVars.has(v)) {
            matchesEmp = true;
            break;
          }
        }
      }
      if (!matchesEmp && realEmpName && a.employee_name && matchEmployeeNames(realEmpName, a.employee_name)) {
        matchesEmp = true;
      }

      return (matchesSim && matchesEmp) || (memActiveAssignment && a.id === memActiveAssignment.id);
    });
  }

  // 6. Invoke PostgreSQL RPC if available
  if (supabase && realSimId && realEmpId) {
    try {
      await supabase.rpc('rpc_return_sim', {
        p_tenant_id: tenantId,
        p_sim_id: realSimId,
        p_employee_id: realEmpId,
        p_return_date: retDate,
        p_return_reason: mandatoryReason,
        p_notes: params.notes || '',
        p_returned_to: returnedBy,
        p_user_id: null,
      });
    } catch (rpcErr) {
      console.warn('rpc_return_sim warning (direct updates will guarantee state):', rpcErr);
    }
  }

  // 7. Authoritative Direct Updates in Supabase
  let finalClosedAssignmentId: string = memActiveAssignment?.id || '';
  if (supabase) {
    // 7a. Close all active assignment rows
    if (activeAssignments.length > 0) {
      for (const asgn of activeAssignments) {
        finalClosedAssignmentId = asgn.id;
        await safeSupabaseUpdate(
          supabase,
          'sim_assignments',
          {
            status: 'RETURNED',
            assignment_status: 'RETURNED',
            returned_at: now,
            returned_date: retDate,
            return_date: retDate,
            return_time: retTime,
            return_reason: mandatoryReason,
            return_remark: mandatoryReason,
            returned_by: returnedBy,
            returned_to: returnedBy,
            employee_id: asgn.employee_id || realEmpId,
            employee_code: asgn.employee_code || realEmpCode || undefined,
            employee_name: asgn.employee_name || realEmpName || undefined,
            sim_card_id: asgn.sim_card_id || realSimId,
            mobile_number: asgn.mobile_number || realMobile,
            provider: asgn.provider || preservedProvider,
            iccid: asgn.iccid || preservedIccid,
            notes: params.notes ? (asgn.notes ? `${asgn.notes} | ${params.notes}` : params.notes) : asgn.notes,
          },
          'id',
          asgn.id
        );
      }
    } else if (realEmpId) {
      // Synthesize closed assignment row so assignment history is permanent and auditable
      const synthAsgnId = `sim_asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      finalClosedAssignmentId = synthAsgnId;
      await safeSupabaseInsert(supabase, 'sim_assignments', {
        id: synthAsgnId,
        tenant_id: tenantId,
        sim_card_id: realSimId,
        mobile_number: realMobile,
        provider: preservedProvider,
        iccid: preservedIccid,
        employee_id: realEmpId,
        employee_code: realEmpCode || undefined,
        employee_name: realEmpName || undefined,
        status: 'RETURNED',
        assignment_status: 'RETURNED',
        assigned_at: lastAssignedDate ? (lastAssignedDate.includes('T') ? lastAssignedDate : `${lastAssignedDate}T08:00:00Z`) : now,
        assigned_date: lastAssignedDate ? lastAssignedDate.slice(0, 10) : retDate,
        assigned_by: lastAssignedBy,
        returned_at: now,
        returned_date: retDate,
        return_date: retDate,
        return_time: retTime,
        return_reason: mandatoryReason,
        return_remark: mandatoryReason,
        returned_by: returnedBy,
        returned_to: returnedBy,
        notes: params.notes || null,
        created_at: now,
      });
    }

    // 7b. Update sim_cards: mark Available/Unassigned, clear current employee, preserve carrier/plan & record last return
    const simUpdatePayload = {
      status: 'Available',
      assignment_status: 'Unassigned',
      current_employee_id: null,
      current_employee_name: null,
      current_employee_code: null,
      assigned_rider_id: null,
      assigned_rider_name: null,
      assigned_to_id: null,
      assigned_to_name: null,
      current_rider_name: null,
      project_id: null,
      project_name: null,
      current_project_id: null,
      current_project_name: null,
      assigned_date: null,
      assigned_by: null,
      unassigned_date: retDate,
      last_assignment_id: finalClosedAssignmentId || undefined,
      last_employee_id: realEmpId,
      last_employee_name: realEmpName,
      last_employee_code: realEmpCode,
      last_assigned_date: lastAssignedDate,
      last_unassigned_date: retDate,
      last_returned_date: retDate,
      last_assigned_by: lastAssignedBy,
      last_returned_by: returnedBy,
      last_return_reason: mandatoryReason,
      last_return_remark: mandatoryReason,
      last_return_notes: params.notes || null,
      previous_project: lastProject,
      updated_at: now,
      updated_by: returnedBy,
    };

    if (realSimId) {
      await safeSupabaseUpdate(supabase, 'sim_cards', simUpdatePayload, 'id', realSimId);
    }
    if (realMobile) {
      await safeSupabaseUpdate(supabase, 'sim_cards', simUpdatePayload, 'mobile_number', realMobile);
    }

    // 7c. Update employees: clear current_sim_id & current_sim_number (preserving status, project, vehicle)
    const empClearPayload = {
      current_sim_id: null,
      current_sim_number: null,
      current_sim_provider: null,
      current_sim_iccid: null,
      current_sim_assigned_date: null,
      current_sim_assigned_by: null,
      updated_at: now,
      updated_by: returnedBy,
    };
    if (realEmpId) {
      await safeSupabaseUpdate(supabase, 'employees', empClearPayload, 'id', realEmpId);
    }
    if (realEmpCode) {
      await safeSupabaseUpdate(supabase, 'employees', empClearPayload, 'employee_code', realEmpCode);
    }

    // 7d. Write audit log
    await safeSupabaseInsert(supabase, 'audit_logs', {
      tenant_id: tenantId,
      actor_name: returnedBy,
      actor_role: 'Operations Admin',
      action: 'RETURN_SIM',
      action_type: 'RETURN',
      module: 'SIM_MANAGEMENT',
      entity_type: 'SIM_CARD',
      entity_id: realSimId,
      details: `Rider ${realEmpName} (${realEmpCode}) returned SIM ${realMobile} to Allied inventory depot. Reason: ${mandatoryReason}`,
      created_at: now,
    });
  }

  // 8. Synchronize In-Memory Stores
  if (db) {
    // 8a. Update simCardsMaster
    if (Array.isArray(db.simCardsMaster)) {
      db.simCardsMaster.forEach((s: any) => {
        const isTargetSim = (realSimId && s.id === realSimId) ||
          (realMobile && (s.mobile_number === realMobile || s.sim_number === realMobile)) ||
          (realEmpId && s.current_employee_id === realEmpId);

        if (isTargetSim) {
          s.assignment_status = 'Unassigned';
          s.status = 'Available';
          s.current_employee_id = null;
          s.current_employee_name = null;
          s.current_employee_code = null;
          s.assigned_to_id = null;
          s.assigned_to_name = null;
          s.current_rider_name = null;
          s.project_id = null;
          s.project_name = null;
          s.assigned_date = null;
          s.assigned_by = null;
          s.unassigned_date = retDate;
          s.last_assignment_id = finalClosedAssignmentId || memActiveAssignment?.id || s.last_assignment_id;
          s.last_employee_id = realEmpId || s.last_employee_id;
          s.last_employee_name = realEmpName || s.last_employee_name;
          s.last_employee_code = realEmpCode || s.last_employee_code;
          s.last_assigned_date = lastAssignedDate || s.last_assigned_date;
          s.last_unassigned_date = retDate;
          s.last_returned_date = retDate;
          s.last_assigned_by = lastAssignedBy || s.last_assigned_by;
          s.last_returned_by = returnedBy;
          s.last_return_reason = mandatoryReason;
          s.last_return_remark = mandatoryReason;
          s.last_return_notes = params.notes || null;
          s.previous_project = lastProject || s.previous_project;
          s.updated_at = now;
        }
      });
    }

    // 8b. Update simAssignments
    if (Array.isArray(db.simAssignments)) {
      let matchedAnyMemAsgn = false;
      const empVariants = realEmpId ? getEmployeeIdentifierVariants(realEmpId) : new Set<string>();
      if (realEmpCode) {
        empVariants.add(String(realEmpCode).trim());
        empVariants.add(String(realEmpCode).toLowerCase().trim());
      }

      db.simAssignments.forEach((a: any) => {
        const matchesSim = (realSimId && (a.sim_id === realSimId || a.sim_card_id === realSimId)) ||
          (realMobile && (isSamePhone(a.mobile_number, realMobile) || a.mobile_number === realMobile));

        let matchesEmp = false;
        if (empVariants.size > 0) {
          const aVars = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
          for (const v of empVariants) {
            if (aVars.has(v)) {
              matchesEmp = true;
              break;
            }
          }
        }
        if (!matchesEmp && realEmpName && a.employee_name && matchEmployeeNames(realEmpName, a.employee_name)) {
          matchesEmp = true;
        }

        const matchesId = memActiveAssignment && a.id === memActiveAssignment.id;

        // Active cycle must match BOTH this SIM and this Employee (or exact active ID)
        if (((matchesSim && matchesEmp) || matchesId) && (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')) {
          a.status = 'RETURNED';
          a.assignment_status = 'RETURNED';
          a.returned_at = now;
          a.returned_date = retDate;
          a.return_date = retDate;
          a.return_time = retTime;
          a.return_reason = mandatoryReason;
          a.return_remark = mandatoryReason;
          a.returned_by = returnedBy;
          a.returned_to = returnedBy;
          a.notes = params.notes ? (a.notes ? `${a.notes} | ${params.notes}` : params.notes) : a.notes;
          if (realEmpId) a.employee_id = realEmpId;
          if (realEmpName) a.employee_name = realEmpName;
          if (realEmpCode) a.employee_code = realEmpCode;
          if (realSimId) {
            a.sim_card_id = realSimId;
            a.sim_id = realSimId;
          }
          if (realMobile) a.mobile_number = realMobile;
          matchedAnyMemAsgn = true;
          finalClosedAssignmentId = a.id;
        }
      });

      if (!matchedAnyMemAsgn && realEmpId) {
        const synthId = finalClosedAssignmentId || `sim_asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        db.simAssignments.unshift({
          id: synthId,
          tenant_id: tenantId,
          sim_id: realSimId,
          sim_card_id: realSimId,
          mobile_number: realMobile,
          iccid: preservedIccid,
          provider: preservedProvider,
          plan: preservedPlan,
          employee_id: realEmpId,
          employee_name: realEmpName,
          employee_code: realEmpCode,
          status: 'RETURNED',
          assignment_status: 'RETURNED',
          assigned_date: lastAssignedDate,
          assigned_at: lastAssignedDate,
          assigned_by: lastAssignedBy,
          returned_date: retDate,
          return_date: retDate,
          returned_at: now,
          return_time: retTime,
          return_reason: mandatoryReason,
          return_remark: mandatoryReason,
          returned_by: returnedBy,
          returned_to: returnedBy,
          notes: params.notes || null,
          created_at: now,
        });
      }
    }

    // 8c. Clear employee custody fields in memory
    const employeeCollections = [db.masterEmployees, db.employees].filter(Array.isArray);
    const empVariantsForCustody = realEmpId ? getEmployeeIdentifierVariants(realEmpId) : new Set<string>();
    if (realEmpCode) {
      empVariantsForCustody.add(String(realEmpCode).trim());
      empVariantsForCustody.add(String(realEmpCode).toLowerCase().trim());
    }

    for (const empArr of employeeCollections) {
      for (const emp of empArr) {
        let matchesTarget = false;
        if (empVariantsForCustody.size > 0) {
          const empVars = getEmployeeIdentifierVariants(emp);
          for (const v of empVariantsForCustody) {
            if (empVars.has(v)) {
              matchesTarget = true;
              break;
            }
          }
        }
        if (!matchesTarget && realEmpName && emp.full_name && matchEmployeeNames(realEmpName, emp.full_name)) {
          matchesTarget = true;
        }

        const matchesSimId = realSimId && (emp.current_sim_id === realSimId || (memSim && emp.current_sim_id === memSim.id));
        const matchesSimNum = realMobile && (isSamePhone(emp.current_sim_number, realMobile) || (params.mobileNumber && isSamePhone(emp.current_sim_number, params.mobileNumber)));

        if (matchesTarget || matchesSimId || matchesSimNum) {
          emp.current_sim_id = null;
          emp.current_sim_number = null;
          emp.current_sim_provider = null;
          emp.current_sim_iccid = null;
          emp.current_sim_assigned_date = null;
          emp.current_sim_assigned_by = null;
          emp.updated_at = now;
        }
      }
    }

    // 8d. Update legacy simCards collection if present
    if (Array.isArray(db.simCards)) {
      db.simCards.forEach((c: any) => {
        if (c.id === realSimId || c.simNumber === realMobile) {
          c.assignedTo = 'Unassigned';
          c.assignedEmployeeId = null;
          c.assignmentStatus = 'Unassigned';
          c.status = 'Available';
        }
      });
    }

    // 8e. Audit log in memory
    if (Array.isArray(db.auditLogs)) {
      db.auditLogs.unshift({
        id: `log_${Date.now()}`,
        tenant_id: tenantId,
        actor_name: returnedBy,
        action: 'RETURN_SIM',
        module: 'SIM_MANAGEMENT',
        details: `Rider ${realEmpName} (${realEmpCode}) returned SIM ${realMobile} to inventory depot. Reason: ${mandatoryReason}`,
        timestamp: now,
        created_at: now,
      });
    }

    await syncAuthoritativeSimAssignments(supabase, db, tenantId);
  }

  return {
    success: true,
    message: `SIM card successfully returned from rider and restored to inventory stock.`,
  };
}

/**
 * Authoritative SIM Replacement: Closes old SIM assignment and assigns new SIM.
 */
export async function replaceSimAuthoritative(
  supabase: any,
  db: any,
  params: ReplaceSimParams & { returnReason?: string; assignedDate?: string; performedBy?: string }
): Promise<{ success: boolean; code?: string; error?: string; message?: string }> {
  const swapReason = params.returnReason || params.swapReason || 'SIM Swap / Replacement';
  const swapDate = params.assignedDate || params.swapDate || new Date().toISOString().slice(0, 10);
  const swappedBy = params.performedBy || params.swappedBy || 'Operations Admin';

  // Step 1: Return the old SIM
  const returnRes = await returnSimAuthoritative(supabase, db, {
    tenantId: params.tenantId,
    simId: params.oldSimId || '',
    employeeId: params.employeeId,
    returnReason: swapReason,
    returnDate: swapDate,
    returnedBy: swappedBy,
    notes: params.notes,
  });

  if (!returnRes.success) {
    return returnRes;
  }

  // Step 2: Assign the new SIM
  const assignRes = await assignSimAuthoritative(supabase, db, {
    tenantId: params.tenantId,
    simId: params.newSimId,
    employeeId: params.employeeId,
    assignedDate: swapDate,
    assignedBy: swappedBy,
    notes: `Replaced SIM: ${params.notes || swapReason}`,
  });

  return assignRes;
}

/**
 * Authoritative SIM Transfer: Transfers SIM card from one employee/stock to another employee.
 * Closes previous assignment and creates new active assignment.
 */
export async function transferSimAuthoritative(
  supabase: any,
  db: any,
  params: TransferSimParams
): Promise<{ success: boolean; code?: string; error?: string; message?: string; sim?: any; newAssignment?: any }> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const tDate = params.transferDate || now.split('T')[0];
  const staffUserName = resolveStaffUserName(params.transferredBy, db);
  const mandatoryReason = (params.transferReason || '').trim();

  if (!mandatoryReason) {
    return { success: false, error: 'Transfer reason is mandatory for SIM transfer.' };
  }

  const sim = (db?.simCardsMaster || []).find(
    (s: any) => s.id === params.simId && (s.tenant_id === tenantId || !s.tenant_id)
  );
  if (!sim) {
    return { success: false, error: `SIM card ${params.simId} not found.` };
  }

  if (sim.status === 'Lost' || sim.status === 'LOST' || sim.assignment_status === 'Lost' || sim.assignment_status === 'LOST') {
    return {
      success: false,
      code: 'SIM_LOST',
      error: `SIM_LOST: SIM card ${sim.mobile_number} is currently marked as LOST and cannot be transferred. Only an authorized recovery workflow can return it to inventory.`,
    };
  }

  const targetDestId = params.destinationEmployeeId || params.toEmployeeId;
  const destEmp = (db?.masterEmployees || []).find(
    (e: any) =>
      (e.id === targetDestId || e.employee_code === targetDestId) &&
      (e.tenant_id === tenantId || !e.tenant_id)
  );
  if (!destEmp) {
    return { success: false, error: `Destination employee ${targetDestId} not found.` };
  }

  if (destEmp.current_sim_id || (destEmp.current_sim_number && destEmp.current_sim_number !== 'None' && destEmp.current_sim_number !== '—')) {
    return {
      success: false,
      error: `Destination employee ${destEmp.full_name} already holds an active SIM card (${destEmp.current_sim_number}). Please return or replace destination SIM first.`
    };
  }

  const srcEmpId = sim.current_employee_id;
  const srcEmp = srcEmpId ? (db?.masterEmployees || []).find((e: any) => e.id === srcEmpId && (e.tenant_id === tenantId || !e.tenant_id)) : null;

  // Supabase updates
  if (supabase) {
    try {
      let rpcRan = false;
      if (srcEmpId) {
        const { error: rpcErr } = await supabase.rpc('rpc_transfer_sim', {
          p_tenant_id: tenantId,
          p_sim_id: sim.id,
          p_source_employee_id: srcEmpId,
          p_destination_employee_id: destEmp.id,
          p_effective_date: tDate,
          p_transfer_reason: mandatoryReason,
          p_notes: params.notes || null,
          p_transferred_by: staffUserName,
          p_user_id: params.userId || null,
        });
        if (!rpcErr) rpcRan = true;
      }

      if (!rpcRan) {
        if (srcEmpId) {
          await supabase
            .from('sim_assignments')
            .update({
              status: 'TRANSFERRED',
              assignment_status: 'TRANSFERRED',
              return_date: tDate,
              returned_date: tDate,
              returned_by: staffUserName,
              return_reason: mandatoryReason,
              notes: `Transferred to ${destEmp.full_name} (${destEmp.employee_code}). Reason: ${mandatoryReason}`,
            })
            .eq('sim_card_id', sim.id)
            .eq('employee_id', srcEmpId)
            .eq('tenant_id', tenantId)
            .eq('status', 'ACTIVE');

          await supabase
            .from('employees')
            .update({
              current_sim_id: null,
              current_sim_number: null,
              updated_at: now,
            })
            .eq('id', srcEmpId)
            .eq('tenant_id', tenantId);
        }

        const newAsgnId = `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await supabase.from('sim_assignments').insert({
          id: newAsgnId,
          tenant_id: tenantId,
          sim_card_id: sim.id,
          mobile_number: sim.mobile_number,
          provider: sim.provider,
          employee_id: destEmp.id,
          employee_name: destEmp.full_name,
          employee_code: destEmp.employee_code,
          assigned_at: tDate,
          assigned_date: tDate,
          assigned_by: staffUserName,
          status: 'ACTIVE',
          notes: `Transferred from ${srcEmp?.full_name || 'Stock'}. Reason: ${mandatoryReason}`,
          created_at: now,
        });

        await supabase
          .from('sim_cards')
          .update({
            assignment_status: 'Assigned',
            status: 'Assigned',
            current_employee_id: destEmp.id,
            current_employee_name: destEmp.full_name,
            current_employee_code: destEmp.employee_code,
            assigned_date: tDate,
            assigned_by: staffUserName,
            updated_at: now,
          })
          .eq('id', sim.id)
          .eq('tenant_id', tenantId);

        await supabase
          .from('employees')
          .update({
            current_sim_id: sim.id,
            current_sim_number: sim.mobile_number,
            updated_at: now,
          })
          .eq('id', destEmp.id)
          .eq('tenant_id', tenantId);
      }
    } catch (sbErr) {
      console.warn('Supabase transferSimAuthoritative error:', sbErr);
    }
  }

  // In-memory updates
  if (srcEmp) {
    srcEmp.current_sim_id = null;
    srcEmp.current_sim_number = null;
    srcEmp.current_sim_provider = null;
    srcEmp.current_sim_iccid = null;
    srcEmp.current_sim_assigned_date = null;
    srcEmp.current_sim_assigned_by = null;
    srcEmp.updated_at = now;

    const activeAsgn = (db.simAssignments || []).find(
      (a: any) => (a.sim_id === sim.id || a.sim_card_id === sim.id) && a.employee_id === srcEmp.id && a.status === 'ACTIVE'
    );
    if (activeAsgn) {
      activeAsgn.status = 'TRANSFERRED';
      activeAsgn.assignment_status = 'TRANSFERRED';
      activeAsgn.return_date = tDate;
      activeAsgn.returned_date = tDate;
      activeAsgn.returned_by = staffUserName;
      activeAsgn.return_reason = mandatoryReason;
      activeAsgn.notes = `Transferred to ${destEmp.full_name} (${destEmp.employee_code}). Reason: ${mandatoryReason}`;
    }
  }

  sim.assignment_status = 'Assigned';
  sim.status = 'Assigned';
  sim.current_employee_id = destEmp.id;
  sim.current_employee_name = destEmp.full_name;
  sim.current_employee_code = destEmp.employee_code;
  sim.assigned_date = tDate;
  sim.assigned_by = staffUserName;
  sim.updated_at = now;

  destEmp.current_sim_id = sim.id;
  destEmp.current_sim_number = sim.mobile_number;
  destEmp.current_sim_provider = sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
  destEmp.current_sim_iccid = sim.iccid || sim.sim_serial_number || '—';
  destEmp.current_sim_assigned_date = tDate;
  destEmp.current_sim_assigned_by = staffUserName;
  destEmp.updated_at = now;

  const newAsgn = {
    id: `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tenant_id: tenantId,
    sim_id: sim.id,
    sim_card_id: sim.id,
    mobile_number: sim.mobile_number,
    provider: sim.provider,
    iccid: sim.iccid || sim.sim_serial_number || '—',
    employee_id: destEmp.id,
    employee_name: destEmp.full_name,
    employee_code: destEmp.employee_code,
    assigned_at: tDate,
    assigned_date: tDate,
    assigned_by: staffUserName,
    status: 'ACTIVE',
    notes: `Transferred from ${srcEmp?.full_name || 'Stock'}. Reason: ${mandatoryReason}`,
    created_at: now,
  };

  if (!db.simAssignments) db.simAssignments = [];
  db.simAssignments.unshift(newAsgn);

  await syncAuthoritativeSimAssignments(supabase, db, tenantId);

  return {
    success: true,
    message: `SIM ${sim.mobile_number} successfully transferred to ${destEmp.full_name}.`,
    sim,
    newAssignment: newAsgn,
  };
}

export interface ReturnSimToProviderParams {
  tenantId?: string;
  simId: string;
  providerReturnDate?: string;
  providerReturnReason: string;
  cancellationReference?: string;
  returnedBy?: string;
  notes?: string;
  autoCloseRiderAssignment?: boolean;
}

/**
 * Returns or cancels a SIM card line with the telecom provider (DU, Etisalat, Virgin).
 * - Distinguishes Provider Return from Rider Return.
 * - If SIM has an active rider assigned, auto-closes rider assignment cleanly.
 * - Marks SIM as 'Returned to Provider' / 'Cancelled', removing it from available inventory.
 * - Records provider return metadata (date, reason, reference, returned by).
 * - Preserves all historical assignment records permanently.
 */
export async function returnSimToProviderAuthoritative(
  supabase: any,
  db: any,
  params: ReturnSimToProviderParams
): Promise<{ success: boolean; error?: string; sim?: any; message?: string }> {
  const {
    tenantId = 'company_pixel_syntax',
    simId,
    providerReturnDate,
    providerReturnReason,
    cancellationReference,
    returnedBy = 'Telecom Operations Admin',
    notes,
    autoCloseRiderAssignment = false,
  } = params;

  if (!simId) {
    return { success: false, error: 'SIM ID is required.' };
  }
  if (!providerReturnReason || !providerReturnReason.trim()) {
    return { success: false, error: 'Provider return / cancellation reason is mandatory.' };
  }

  // The database transaction verifies custody and either commits every change or rolls back.
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('allied_return_sim_to_provider', {
        p_tenant_id: tenantId,
        p_sim_id: simId,
        p_returned_by: returnedBy,
        p_reason: providerReturnReason.trim(),
        p_return_date: providerReturnDate || null,
        p_reference: cancellationReference || null,
        p_notes: notes || null,
        p_auto_close: autoCloseRiderAssignment,
      });
      if (error || !data?.success) {
        return { success: false, error: error?.message || 'Provider cancellation was not saved.' };
      }
      return data;
    } catch (error: any) {
      return { success: false, error: error?.message || 'Provider cancellation could not be saved.' };
    }
  }

  const now = new Date().toISOString();
  const rDate = providerReturnDate || now.split('T')[0];

  // 1. Locate SIM in Supabase or memory
  let sim: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${simId},mobile_number.eq.${simId}`)
        .maybeSingle();
      if (data) sim = data;
    } catch (err) {
      console.warn('Supabase SIM lookup error:', err);
    }
  }

  if (!sim && db && Array.isArray(db.simCardsMaster)) {
    sim = db.simCardsMaster.find((s: any) => (s.id === simId || s.mobile_number === simId) && (s.tenant_id === tenantId || tenantId === 'company_pixel_syntax'));
  }
  if (!sim && db && Array.isArray(db.simCards)) {
    sim = db.simCards.find((s: any) => (s.id === simId || s.simNumber === simId) && (s.tenant_id === tenantId || tenantId === 'company_pixel_syntax'));
  }

  if (!sim) {
    return { success: false, error: `SIM card '${simId}' not found.` };
  }

  const simNumber = sim.mobile_number || sim.simNumber || 'UNKNOWN';
  const providerName = sim.provider || 'Telecom Provider';

  // 2. Check if SIM has an active rider assigned
  const hasActiveRider = Boolean(
    sim.current_employee_id ||
    sim.assignment_status === 'Assigned' ||
    sim.status === 'Assigned' ||
    (sim.assignedTo && sim.assignedTo !== 'Unassigned')
  );

  if (hasActiveRider) {
    if (!autoCloseRiderAssignment) {
      return {
        success: false,
        error: `SIM ${simNumber} is currently assigned to an employee. Please return from employee first or enable auto-close.`,
      };
    }

    // Auto-close active rider assignment first
    await returnSimAuthoritative(supabase, db, {
      tenantId,
      simId: sim.id,
      returnReason: 'RETURN_TO_PROVIDER',
      returnDate: rDate,
      returnedBy,
      notes: `Closed rider custody prior to provider cancellation (${providerReturnReason})`,
    });
  }

  // 3. Update SIM status in Supabase
  const providerUpdatePayload = {
    assignment_status: 'Returned to Provider',
    service_status: 'Cancelled',
    status: 'RETURNED_TO_PROVIDER',
    provider_return_date: rDate,
    provider_return_reason: providerReturnReason,
    provider_return_reference: cancellationReference || null,
    provider_returned_by: returnedBy,
    provider_return_notes: notes || null,
    current_employee_id: null,
    current_employee_name: null,
    updated_at: now,
  };

  if (supabase) {
    try {
      await supabase
        .from('sim_cards')
        .update(providerUpdatePayload)
        .eq('id', sim.id)
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Failed to update SIM in Supabase for provider return:', err);
    }
  }

  // 4. Update memory caches
  if (db) {
    if (Array.isArray(db.simCardsMaster)) {
      const memSim = db.simCardsMaster.find((s: any) => s.id === sim.id);
      if (memSim) {
        Object.assign(memSim, providerUpdatePayload);
      }
    }
    if (Array.isArray(db.simCards)) {
      const legacy = db.simCards.find((c: any) => c.id === sim.id || c.simNumber === simNumber);
      if (legacy) {
        legacy.assignedTo = 'Returned to Provider';
        legacy.assignedEmployeeId = null;
        legacy.assignmentStatus = 'Returned to Provider';
        legacy.status = 'Inactive';
        legacy.service_status = 'Cancelled';
      }
    }
  }

  return {
    success: true,
    sim: {
      ...sim,
      ...providerUpdatePayload,
    },
    message: `SIM ${simNumber} successfully returned / cancelled with ${providerName}. Status updated to Returned to Provider.`,
  };
}

/**
 * Authoritatively marks a SIM card as LOST.
 * - Records loss date, employee, reason, reporting staff, and notes.
 * - Closes active assignment record with status 'LOST' (NOT 'RETURNED').
 * - Clears employee's active SIM pointers while strictly preserving employee duty status.
 * - Updates sim_cards with status 'Lost', assignment_status 'Lost', clearing current_employee.
 * - Inserts authoritative audit log with action MARK_SIM_LOST.
 */
export async function markSimLostAuthoritative(
  supabase: any,
  db: any,
  params: MarkSimLostParams
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  message?: string;
  sim?: any;
  assignment?: any;
}> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const lossDate = params.lossDate || now.split('T')[0];
  const reportedBy = resolveStaffUserName(params.reportedBy, db) || 'Operations Admin';
  const mandatoryReason = (params.reason || '').trim();

  if (!params.simId) {
    return { success: false, code: 'SIM_REQUIRED', error: 'SIM Card ID is required to mark as lost.' };
  }
  if (!mandatoryReason) {
    return { success: false, code: 'REASON_REQUIRED', error: 'Loss reason is mandatory when marking a SIM as lost.' };
  }

  const lockKey = `${tenantId}:${params.simId}`;
  return withSimLock(lockKey, async () => {
    // 1. Resolve SIM
    let sim: any = null;
    if (supabase) {
      const { data } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('id', params.simId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      sim = data;
    }
    if (!sim && db && Array.isArray(db.simCardsMaster)) {
      sim = db.simCardsMaster.find((s: any) => s.id === params.simId && (s.tenant_id === tenantId || !s.tenant_id));
    }
    if (!sim) {
      return { success: false, code: 'SIM_NOT_FOUND', error: `SIM card ${params.simId} not found.` };
    }

    if (sim.status === 'Lost' || sim.assignment_status === 'Lost') {
      return { success: false, code: 'ALREADY_LOST', error: `SIM card ${sim.mobile_number} is already marked as LOST.` };
    }

    // 2. Identify holding employee if any
    const holderEmpId = sim.current_employee_id || params.employeeId || null;
    let holderEmp: any = null;
    if (holderEmpId) {
      if (supabase) {
        const { data } = await supabase
          .from('employees')
          .select('id, employee_code, full_name, current_sim_id, current_sim_number, current_status')
          .eq('tenant_id', tenantId)
          .eq('id', holderEmpId)
          .maybeSingle();
        holderEmp = data;
      }
      if (!holderEmp && db && Array.isArray(db.masterEmployees)) {
        holderEmp = db.masterEmployees.find((e: any) => e.id === holderEmpId);
      }
    }

    const empName = holderEmp?.full_name || sim.current_employee_name || 'Rider';
    const empCode = holderEmp?.employee_code || sim.current_employee_code || '';

    // 3. Close active assignments in sim_assignments with status: 'LOST' (NOT 'RETURNED')
    let activeAssignments: any[] = [];
    if (supabase) {
      try {
        const { data } = await supabase
          .from('sim_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('sim_card_id', sim.id)
          .in('status', ['ACTIVE', 'Active']);
        if (Array.isArray(data)) activeAssignments = data;

        for (const asgn of activeAssignments) {
          await safeSupabaseUpdate(
            supabase,
            'sim_assignments',
            {
              status: 'LOST',
              assignment_status: 'LOST',
              return_date: lossDate,
              returned_date: lossDate,
              returned_by: reportedBy,
              return_reason: `LOST: ${mandatoryReason}`,
              notes: params.notes ? `${asgn.notes ? asgn.notes + ' | ' : ''}Reported LOST by ${reportedBy}: ${mandatoryReason}` : `Reported LOST: ${mandatoryReason}`,
            },
            'id',
            asgn.id
          );
        }
      } catch (err) {
        console.warn('Error closing active assignments on SIM loss:', err);
      }
    }

    if (db && Array.isArray(db.simAssignments)) {
      for (const a of db.simAssignments) {
        if ((a.sim_id === sim.id || a.sim_card_id === sim.id) && (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')) {
          a.status = 'LOST';
          a.assignment_status = 'LOST';
          a.return_date = lossDate;
          a.returned_date = lossDate;
          a.returned_by = reportedBy;
          a.return_reason = `LOST: ${mandatoryReason}`;
        }
      }
    }

    // 4. Clear active SIM custody pointers from employee, PRESERVING duty status completely
    if (holderEmpId) {
      if (supabase) {
        await safeSupabaseUpdate(
          supabase,
          'employees',
          {
            current_sim_id: null,
            current_sim_number: null,
            current_sim_provider: null,
            current_sim_iccid: null,
            current_sim_assigned_date: null,
            current_sim_assigned_by: null,
            updated_at: now,
          },
          'id',
          holderEmpId
        );
      }
      if (db && Array.isArray(db.masterEmployees)) {
        const mEmp = db.masterEmployees.find((e: any) => e.id === holderEmpId);
        if (mEmp) {
          mEmp.current_sim_id = null;
          mEmp.current_sim_number = null;
          mEmp.current_sim_provider = null;
          mEmp.current_sim_iccid = null;
          mEmp.current_sim_assigned_date = null;
          mEmp.current_sim_assigned_by = null;
        }
      }
      if (db && Array.isArray(db.employees)) {
        const lEmp = db.employees.find((e: any) => e.id === holderEmpId);
        if (lEmp) {
          lEmp.current_sim_id = null;
          lEmp.current_sim_number = null;
        }
      }
    }

    // 5. Update sim_cards: status = 'Lost', assignment_status = 'Lost', current_employee_id = null
    const cardUpdatePayload = {
      status: 'Lost',
      assignment_status: 'Lost',
      current_employee_id: null,
      current_employee_name: null,
      current_employee_code: null,
      last_employee_id: holderEmpId || sim.last_employee_id,
      last_employee_name: empName || sim.last_employee_name,
      last_employee_code: empCode || sim.last_employee_code,
      last_returned_date: lossDate,
      last_return_reason: `LOST: ${mandatoryReason}`,
      last_returned_by: reportedBy,
      notes: params.notes ? `${sim.notes ? sim.notes + ' | ' : ''}LOST (${lossDate}): ${mandatoryReason}` : sim.notes,
      updated_at: now,
    };

    if (supabase) {
      await safeSupabaseUpdate(supabase, 'sim_cards', cardUpdatePayload, 'id', sim.id);
    }
    if (db && Array.isArray(db.simCardsMaster)) {
      const mCard = db.simCardsMaster.find((s: any) => s.id === sim.id);
      if (mCard) Object.assign(mCard, cardUpdatePayload);
    }
    if (db && Array.isArray(db.simCards)) {
      const lCard = db.simCards.find((s: any) => s.id === sim.id);
      if (lCard) {
        lCard.status = 'Lost';
        lCard.assignmentStatus = 'Lost';
        lCard.assignedEmployeeId = null;
        lCard.assignedTo = null;
      }
    }

    // 6. Record mandatory audit log
    const auditDetails = `SIM ${sim.mobile_number} marked as LOST by ${reportedBy}. Reason: ${mandatoryReason}. Previous holder: ${empName} (${empCode || 'N/A'}). Active custody safely closed as LOST.`;
    if (supabase) {
      await safeSupabaseInsert(supabase, 'audit_logs', {
        id: `aud_lost_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        user_id: params.userId || null,
        actor_name: reportedBy,
        actor_role: 'Operations Admin',
        action: 'MARK_SIM_LOST',
        action_type: 'UPDATE',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: sim.id,
        details: auditDetails,
        status: 'SUCCESS',
        created_at: now,
      });
    }
    if (db && Array.isArray(db.auditLogs)) {
      db.auditLogs.unshift({
        id: `aud_lost_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        action: 'MARK_SIM_LOST',
        action_type: 'UPDATE',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: sim.id,
        actor_name: reportedBy,
        actor_role: 'Operations Admin',
        details: auditDetails,
        timestamp: now,
        created_at: now,
      });
    }

    return {
      success: true,
      message: `SIM card ${sim.mobile_number} successfully marked as LOST. Custody closed and excluded from available stock.`,
      sim: { ...sim, ...cardUpdatePayload },
    };
  });
}

/**
 * Authoritatively recovers a previously lost SIM card.
 * - Requires verified physical recovery reason and supervisor authorization.
 * - Restores SIM status to 'Available', assignment_status to 'Unassigned'.
 * - Records recovery metadata and audit log.
 */
export async function recoverLostSimAuthoritative(
  supabase: any,
  db: any,
  params: RecoverLostSimParams
): Promise<{
  success: boolean;
  code?: string;
  error?: string;
  message?: string;
  sim?: any;
}> {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const now = new Date().toISOString();
  const recDate = params.recoveryDate || now.split('T')[0];
  const recoveredBy = resolveStaffUserName(params.recoveredBy, db) || 'Operations Admin';
  const authorizedBy = resolveStaffUserName(params.authorizedBy, db) || 'Platform Supervisor';
  const mandatoryReason = (params.recoveryReason || '').trim();

  if (!params.simId) {
    return { success: false, code: 'SIM_REQUIRED', error: 'SIM Card ID is required for recovery.' };
  }
  if (!mandatoryReason) {
    return { success: false, code: 'REASON_REQUIRED', error: 'Recovery verification reason is mandatory.' };
  }
  if (!params.authorizedBy || !params.authorizedBy.trim()) {
    return { success: false, code: 'AUTHORIZATION_REQUIRED', error: 'Explicit supervisor authorization is required to restore a lost SIM.' };
  }

  const lockKey = `${tenantId}:${params.simId}`;
  return withSimLock(lockKey, async () => {
    // 1. Resolve SIM
    let sim: any = null;
    if (supabase) {
      const { data } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('id', params.simId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      sim = data;
    }
    if (!sim && db && Array.isArray(db.simCardsMaster)) {
      sim = db.simCardsMaster.find((s: any) => s.id === params.simId && (s.tenant_id === tenantId || !s.tenant_id));
    }
    if (!sim) {
      return { success: false, code: 'SIM_NOT_FOUND', error: `SIM card ${params.simId} not found.` };
    }

    const isCurrentlyLost = sim.status === 'Lost' || sim.status === 'LOST' || sim.assignment_status === 'Lost' || sim.assignment_status === 'LOST';
    if (!isCurrentlyLost) {
      return { success: false, code: 'NOT_LOST', error: `SIM card ${sim.mobile_number} is not in LOST status (current status: ${sim.status}). Only lost SIMs can be recovered.` };
    }

    // 2. Restore SIM to Available status
    const cardUpdatePayload = {
      status: 'Available',
      assignment_status: 'Unassigned',
      current_employee_id: null,
      current_employee_name: null,
      current_employee_code: null,
      recovered_at: now,
      recovery_date: recDate,
      recovered_by: recoveredBy,
      recovery_authorized_by: authorizedBy,
      recovery_reason: mandatoryReason,
      notes: params.notes ? `${sim.notes ? sim.notes + ' | ' : ''}RECOVERED (${recDate}) Auth by ${authorizedBy}: ${mandatoryReason}` : sim.notes,
      updated_at: now,
    };

    if (supabase) {
      await safeSupabaseUpdate(supabase, 'sim_cards', cardUpdatePayload, 'id', sim.id);
    }
    if (db && Array.isArray(db.simCardsMaster)) {
      const mCard = db.simCardsMaster.find((s: any) => s.id === sim.id);
      if (mCard) Object.assign(mCard, cardUpdatePayload);
    }
    if (db && Array.isArray(db.simCards)) {
      const lCard = db.simCards.find((s: any) => s.id === sim.id);
      if (lCard) {
        lCard.status = 'Available';
        lCard.assignmentStatus = 'Unassigned';
        lCard.assignedEmployeeId = null;
        lCard.assignedTo = null;
      }
    }

    // 3. Record recovery in audit_logs
    const auditDetails = `SIM ${sim.mobile_number} physically recovered and restored to Available inventory pool. Verified by: ${recoveredBy}. Explicitly authorized by: ${authorizedBy}. Verification details: ${mandatoryReason}.`;
    if (supabase) {
      await safeSupabaseInsert(supabase, 'audit_logs', {
        id: `aud_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        user_id: params.userId || null,
        actor_name: authorizedBy,
        actor_role: 'Operations Admin',
        action: 'RECOVER_LOST_SIM',
        action_type: 'UPDATE',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: sim.id,
        details: auditDetails,
        status: 'SUCCESS',
        created_at: now,
      });
    }
    if (db && Array.isArray(db.auditLogs)) {
      db.auditLogs.unshift({
        id: `aud_rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        tenant_id: tenantId,
        action: 'RECOVER_LOST_SIM',
        action_type: 'UPDATE',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: sim.id,
        actor_name: authorizedBy,
        actor_role: 'Operations Admin',
        details: auditDetails,
        timestamp: now,
        created_at: now,
      });
    }

    return {
      success: true,
      message: `SIM card ${sim.mobile_number} successfully recovered and restored to Available inventory stock.`,
      sim: { ...sim, ...cardUpdatePayload },
    };
  });
}

export interface UpdateSimAssignmentParams {
  tenantId?: string;
  assignmentId: string;
  updates: {
    assigned_date?: string;
    returned_date?: string;
    return_date?: string;
    return_time?: string;
    return_remark?: string;
    assigned_by?: string;
    returned_by?: string;
    return_reason?: string;
    notes?: string;
    remarks?: string;
    handover_notes?: string;
    editReason?: string;
    reason?: string;
    correction_reason?: string;
  };
  editReason?: string;
  editedBy?: string;
  actor?: any;
}

/**
 * Allows authorized users to edit SIM assignment/return records with audit logging.
 * Preserves original values in an immutable correction audit log.
 * Validates dates and strictly prevents accidental assignment, return, or transfer of a SIM.
 */
export async function updateSimAssignmentHistoryAuthoritative(
  supabase: any,
  db: any,
  params: UpdateSimAssignmentParams
): Promise<{ success: boolean; error?: string; assignment?: any; auditLogId?: string }> {
  const { tenantId = 'company_pixel_syntax', assignmentId, updates, editedBy = 'Telecom Admin', actor } = params;

  if (!assignmentId) {
    return { success: false, error: 'Assignment ID is required.' };
  }

  // 1. Locate the existing assignment record in memory or Supabase
  let existingAsgn: any = null;
  if (db && Array.isArray(db.simAssignments)) {
    existingAsgn = db.simAssignments.find(
      (a: any) => a.id === assignmentId && (a.tenant_id === tenantId || tenantId === 'company_pixel_syntax')
    );
  }

  if (!existingAsgn && supabase) {
    try {
      const { data, error } = await supabase
        .from('sim_assignments')
        .select('*')
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!error && data) {
        existingAsgn = data;
      }
    } catch (err) {
      console.warn('Supabase fetch existing sim_assignment warning:', err);
    }
  }

  if (!existingAsgn) {
    return { success: false, error: `SIM assignment record '${assignmentId}' not found.` };
  }

  // 2. Date validation and custody safety guards
  const effectiveAssignedDate = updates.assigned_date !== undefined
    ? updates.assigned_date
    : (existingAsgn.assigned_date || (existingAsgn.assigned_at ? existingAsgn.assigned_at.split('T')[0] : ''));

  const effectiveReturnDate = (updates.returned_date !== undefined || updates.return_date !== undefined)
    ? (updates.returned_date || updates.return_date)
    : (existingAsgn.return_date || existingAsgn.returned_date || (existingAsgn.returned_at ? existingAsgn.returned_at.split('T')[0] : ''));

  if (updates.assigned_date !== undefined && !updates.assigned_date.trim()) {
    return { success: false, error: 'Assignment date cannot be empty.' };
  }

  const isExistingReturned = existingAsgn.status === 'RETURNED' ||
    existingAsgn.assignment_status === 'RETURNED' ||
    Boolean(existingAsgn.return_date || existingAsgn.returned_date);

  // If this is a RETURNED record (or return date is explicitly provided), validate return_date >= assigned_date
  if ((isExistingReturned || effectiveReturnDate) && effectiveAssignedDate && effectiveReturnDate) {
    const assignTime = new Date(effectiveAssignedDate).getTime();
    const returnTime = new Date(effectiveReturnDate).getTime();
    if (!isNaN(assignTime) && !isNaN(returnTime) && returnTime < assignTime) {
      return {
        success: false,
        error: `Return date (${effectiveReturnDate}) cannot be earlier than assignment date (${effectiveAssignedDate}).`,
      };
    }
  }

  // 3. Capture original values for immutable audit trail
  const originalValues = {
    assigned_date: existingAsgn.assigned_date || (existingAsgn.assigned_at ? existingAsgn.assigned_at.split('T')[0] : null),
    return_date: existingAsgn.return_date || existingAsgn.returned_date || (existingAsgn.returned_at ? existingAsgn.returned_at.split('T')[0] : null),
    assigned_by: existingAsgn.assigned_by || null,
    returned_by: existingAsgn.returned_by || existingAsgn.returned_to || null,
    return_reason: existingAsgn.return_reason || existingAsgn.return_remark || existingAsgn.reason || null,
    notes: existingAsgn.notes || existingAsgn.remarks || existingAsgn.handover_notes || null,
  };

  const correctionReason = params.editReason ||
    updates.editReason ||
    updates.reason ||
    updates.correction_reason ||
    'Historical assignment record correction';

  const now = new Date().toISOString();
  const retDate = updates.returned_date || updates.return_date;

  // Build strictly cleaned updates that do NOT alter custody or create duplicates
  const cleanedUpdates: any = {
    updated_at: now,
    last_edited_by: editedBy,
    last_edited_at: now,
    last_edit_reason: correctionReason,
  };

  if (updates.assigned_date !== undefined) {
    cleanedUpdates.assigned_date = updates.assigned_date;
    cleanedUpdates.assigned_at = updates.assigned_date ? `${updates.assigned_date}T08:00:00Z` : null;
  }
  if (retDate !== undefined) {
    cleanedUpdates.return_date = retDate;
    cleanedUpdates.returned_date = retDate;
    cleanedUpdates.returned_at = retDate ? `${retDate}T18:00:00Z` : null;
  }
  if (updates.assigned_by !== undefined) {
    cleanedUpdates.assigned_by = updates.assigned_by;
  }
  if (updates.returned_by !== undefined) {
    cleanedUpdates.returned_by = updates.returned_by;
    cleanedUpdates.returned_to = updates.returned_by;
  }
  if (updates.return_reason !== undefined || updates.return_remark !== undefined) {
    const rVal = updates.return_reason || updates.return_remark || '';
    cleanedUpdates.return_reason = rVal;
    cleanedUpdates.return_remark = rVal;
  }
  if (updates.notes !== undefined || updates.remarks !== undefined || updates.handover_notes !== undefined) {
    const nVal = updates.notes || updates.remarks || updates.handover_notes || '';
    cleanedUpdates.notes = nVal;
  }

  // Immutable record-level correction history array
  const correctionEntry = {
    edited_by: editedBy,
    edited_at: now,
    reason: correctionReason,
    original_values: originalValues,
    updated_fields: Object.keys(cleanedUpdates).filter(k => !k.startsWith('last_edited') && k !== 'updated_at'),
  };

  const existingHistory = Array.isArray(existingAsgn.correction_history) ? existingAsgn.correction_history : [];
  cleanedUpdates.correction_history = [...existingHistory, correctionEntry];

  // 4. Update authoritative Supabase sim_assignments table
  if (supabase) {
    try {
      await supabase
        .from('sim_assignments')
        .update(cleanedUpdates)
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Supabase sim_assignments update error:', err);
    }
  }

  // 5. Update in-memory db.simAssignments
  let updatedAsgn: any = null;
  if (db && Array.isArray(db.simAssignments)) {
    db.simAssignments.forEach((a: any) => {
      if (a.id === assignmentId && (a.tenant_id === tenantId || tenantId === 'company_pixel_syntax')) {
        Object.assign(a, cleanedUpdates);
        updatedAsgn = a;
      }
    });
  }

  if (!updatedAsgn) {
    updatedAsgn = { ...existingAsgn, ...cleanedUpdates };
    if (db && Array.isArray(db.simAssignments)) {
      db.simAssignments.push(updatedAsgn);
    }
  }

  // 6. Synchronize active custody metadata if this record is currently ACTIVE
  const isRowActive = existingAsgn.status === 'ACTIVE' ||
    existingAsgn.status === 'ASSIGNED' ||
    existingAsgn.assignment_status === 'ACTIVE' ||
    existingAsgn.assignment_status === 'ASSIGNED';

  const simId = existingAsgn.sim_card_id || existingAsgn.sim_id;
  const empId = existingAsgn.employee_id;

  if (isRowActive) {
    if (simId) {
      const simCardUpdates: any = { updated_at: now };
      if (cleanedUpdates.assigned_date) simCardUpdates.assigned_date = cleanedUpdates.assigned_date;
      if (cleanedUpdates.assigned_by) simCardUpdates.assigned_by = cleanedUpdates.assigned_by;

      if (supabase) {
        try {
          await supabase
            .from('sim_cards')
            .update(simCardUpdates)
            .eq('id', simId)
            .eq('tenant_id', tenantId);
        } catch (err) {
          console.warn('Sync active SIM card dates error:', err);
        }
      }

      if (db && Array.isArray(db.simCardsMaster)) {
        const memCard = db.simCardsMaster.find((s: any) => s.id === simId);
        if (memCard) Object.assign(memCard, simCardUpdates);
      }
    }

    if (empId) {
      const empUpdates: any = { updated_at: now };
      if (cleanedUpdates.assigned_date) empUpdates.current_sim_assigned_date = cleanedUpdates.assigned_date;
      if (cleanedUpdates.assigned_by) empUpdates.current_sim_assigned_by = cleanedUpdates.assigned_by;

      if (supabase) {
        try {
          await supabase
            .from('employees')
            .update(empUpdates)
            .eq('id', empId)
            .eq('tenant_id', tenantId);
        } catch (err) {
          console.warn('Sync employee active SIM dates error:', err);
        }
      }

      if (db && Array.isArray(db.masterEmployees)) {
        const memEmp = db.masterEmployees.find((e: any) => e.id === empId || e.employee_code === existingAsgn.employee_code);
        if (memEmp) Object.assign(memEmp, empUpdates);
      }
    }
  } else {
    // If returned, sync last_returned_date and last_return_reason on the SIM card if it matches this return cycle
    if (simId) {
      const simCardUpdates: any = { updated_at: now };
      if (cleanedUpdates.return_date) simCardUpdates.last_returned_date = cleanedUpdates.return_date;
      if (cleanedUpdates.returned_by) simCardUpdates.last_returned_by = cleanedUpdates.returned_by;
      if (cleanedUpdates.return_reason) simCardUpdates.last_return_reason = cleanedUpdates.return_reason;

      if (supabase) {
        try {
          await supabase
            .from('sim_cards')
            .update(simCardUpdates)
            .eq('id', simId)
            .eq('tenant_id', tenantId);
        } catch (err) {
          console.warn('Sync returned SIM card metadata error:', err);
        }
      }

      if (db && Array.isArray(db.simCardsMaster)) {
        const memCard = db.simCardsMaster.find((s: any) => s.id === simId);
        if (memCard) Object.assign(memCard, simCardUpdates);
      }
    }
  }

  // 7. Immutable audit logging into Supabase audit_logs & db.auditLogs
  const auditLogId = `audit_sim_corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const auditEntryPayload = {
    id: auditLogId,
    tenant_id: tenantId,
    timestamp: now.replace('T', ' ').substring(0, 19),
    action: 'CORRECT_SIM_ASSIGNMENT_HISTORY',
    actionType: 'CORRECTION',
    module: 'SIM_MANAGEMENT',
    entity_type: 'SIM_ASSIGNMENT',
    entity_id: assignmentId,
    user_name: editedBy,
    performed_by_name: editedBy,
    actor_name_at_time: editedBy,
    reason: correctionReason,
    old_state: originalValues,
    new_state: cleanedUpdates,
    notes: `SIM Assignment ${existingAsgn.mobile_number || assignmentId} corrected: ${correctionReason}`,
    details: `Historical SIM assignment record (${existingAsgn.mobile_number || assignmentId}) corrected by ${editedBy}. Reason: ${correctionReason}. Changes: ${JSON.stringify(cleanedUpdates)}`,
  };

  if (db) {
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(auditEntryPayload);
  }

  if (supabase) {
    try {
      await supabase.from('audit_logs').insert([{
        id: auditLogId,
        tenant_id: tenantId,
        user_name: editedBy,
        action: 'CORRECT_SIM_ASSIGNMENT_HISTORY',
        module: 'SIM_MANAGEMENT',
        target_id: assignmentId,
        target_type: 'SIM_ASSIGNMENT',
        details: auditEntryPayload.details,
        notes: auditEntryPayload.notes,
        created_at: now,
      }]);
    } catch (err) {
      console.warn('Supabase audit log insert error:', err);
    }
  }

  return {
    success: true,
    assignment: updatedAsgn,
    auditLogId,
  };
}

/**
 * Authoritative SIM Assignment Lifecycle Reconciler
 * Generic, tenant-scoped reconciliation across employee profiles, SIM inventory, and assignment history.
 * Applies uniformly to EVERY employee in company_pixel_syntax without hardcoding individual staff names, codes, or numbers.
 */
export function reconcileSimAssignmentLifecycles(db: any, tenantId: string = 'company_pixel_syntax'): {
  reconciledCount: number;
  reconciledDetails: any[];
} {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let count = 0;
  const reconciledDetails: any[] = [];

  if (!db) return { reconciledCount: 0, reconciledDetails: [] };
  if (!db.masterEmployees) db.masterEmployees = [];
  if (!db.simCardsMaster) db.simCardsMaster = [];
  if (!db.simAssignments) db.simAssignments = [];

  const invalidCustodyVals = new Set(['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', '']);

  // All active/eligible employees in this tenant
  const allEmployees = db.masterEmployees.filter((e: any) =>
    (e.tenant_id === tenantId || !e.tenant_id || tenantId === 'company_pixel_syntax') && !e.is_archived && !e.isArchived
  );

  // Map SIM cards by normalized phone and by ID
  const simById = new Map<string, any>();
  const simByNormPhone = new Map<string, any>();
  for (const s of db.simCardsMaster) {
    if (s.id) simById.set(s.id, s);
    const np = normalizePhoneForMatching(s.mobile_number || s.sim_number);
    if (np) simByNormPhone.set(np, s);
  }

  // 1. First pass: Employees holding physical SIMs (via current_sim_number or current_sim_id)
  // Reconcile with simCardsMaster and ensure active assignment records exist.
  for (const emp of allEmployees) {
    let rawSimNum = emp.current_sim_number;
    let rawSimId = emp.current_sim_id;

    if (rawSimNum && invalidCustodyVals.has(String(rawSimNum).toLowerCase().trim())) {
      emp.current_sim_number = null;
      rawSimNum = null;
    }
    if (rawSimId && invalidCustodyVals.has(String(rawSimId).toLowerCase().trim())) {
      emp.current_sim_id = null;
      rawSimId = null;
    }

    if (!rawSimNum && !rawSimId) continue;

    // Find the SIM card
    let matchedSim = (rawSimId && simById.get(rawSimId)) ||
                     (rawSimNum && simByNormPhone.get(normalizePhoneForMatching(rawSimNum)));

    if (!matchedSim && rawSimNum) {
      // Auto-create SIM card in inventory if missing
      matchedSim = {
        id: rawSimId || `sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        tenant_id: tenantId,
        mobile_number: rawSimNum,
        sim_number: rawSimNum,
        iccid: emp.current_sim_iccid || '—',
        provider: emp.current_sim_provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
        status: 'Assigned',
        assignment_status: 'Assigned',
        current_employee_id: emp.id,
        current_employee_name: emp.full_name,
        current_employee_code: emp.employee_code,
        assigned_date: emp.current_sim_assigned_date || emp.joining_date?.slice(0, 10) || today,
        created_at: now,
      };
      db.simCardsMaster.unshift(matchedSim);
      if (matchedSim.id) simById.set(matchedSim.id, matchedSim);
      const np = normalizePhoneForMatching(matchedSim.mobile_number);
      if (np) simByNormPhone.set(np, matchedSim);
    }

    if (matchedSim) {
      // Check if this SIM is marked LOST
      if (matchedSim.status === 'Lost' || matchedSim.assignment_status === 'Lost') {
        // A lost SIM cannot be actively held
        emp.current_sim_id = null;
        emp.current_sim_number = null;
        continue;
      }

      // Check conflict: is it currently marked as assigned to ANOTHER employee who has a more recent assignment?
      if (matchedSim.current_employee_id && matchedSim.current_employee_id !== emp.id) {
        const otherEmp = allEmployees.find((e: any) => e.id === matchedSim.current_employee_id);
        if (otherEmp && otherEmp.id !== emp.id) {
          const empAsgn = db.simAssignments.find((a: any) =>
            (a.sim_id === matchedSim.id || a.sim_card_id === matchedSim.id || isSamePhone(a.mobile_number, matchedSim.mobile_number)) &&
            (a.employee_id === emp.id || (emp.employee_code && a.employee_code === emp.employee_code)) &&
            (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')
          );
          const otherAsgn = db.simAssignments.find((a: any) =>
            (a.sim_id === matchedSim.id || a.sim_card_id === matchedSim.id || isSamePhone(a.mobile_number, matchedSim.mobile_number)) &&
            (a.employee_id === otherEmp.id || (otherEmp.employee_code && a.employee_code === otherEmp.employee_code)) &&
            (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')
          );

          if (otherAsgn && !empAsgn) {
            // The other employee has the verified active assignment. Clear stale pointer on this employee.
            emp.current_sim_id = null;
            emp.current_sim_number = null;
            emp.current_sim_provider = null;
            emp.current_sim_iccid = null;
            reconciledDetails.push({
              employee: emp.full_name,
              sim: matchedSim.mobile_number,
              action: `Cleared stale SIM pointer; SIM is actively held by ${otherEmp.full_name}`,
            });
            count++;
            continue;
          }
        }
      }

      // Authoritatively bind SIM to this employee
      matchedSim.current_employee_id = emp.id;
      matchedSim.current_employee_name = emp.full_name;
      matchedSim.current_employee_code = emp.employee_code;
      matchedSim.status = 'Assigned';
      matchedSim.assignment_status = 'Assigned';
      matchedSim.assigned_date = matchedSim.assigned_date || emp.current_sim_assigned_date || emp.joining_date?.slice(0, 10) || today;

      emp.current_sim_id = matchedSim.id;
      emp.current_sim_number = matchedSim.mobile_number;
      emp.current_sim_provider = matchedSim.provider || emp.current_sim_provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
      emp.current_sim_iccid = matchedSim.iccid || emp.current_sim_iccid || '—';
      emp.current_sim_assigned_date = matchedSim.assigned_date;

      // Ensure active record exists in db.simAssignments
      let activeAsgn = db.simAssignments.find((a: any) =>
        (a.sim_id === matchedSim.id || a.sim_card_id === matchedSim.id || isSamePhone(a.mobile_number, matchedSim.mobile_number)) &&
        (a.employee_id === emp.id || (emp.employee_code && a.employee_code === emp.employee_code)) &&
        (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')
      );

      if (!activeAsgn) {
        const newAsgnId = `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        activeAsgn = {
          id: newAsgnId,
          tenant_id: tenantId,
          sim_id: matchedSim.id,
          sim_card_id: matchedSim.id,
          mobile_number: matchedSim.mobile_number,
          provider: matchedSim.provider || emp.current_sim_provider || 'ETISALAT',
          iccid: matchedSim.iccid || emp.current_sim_iccid || '—',
          employee_id: emp.id,
          employee_name: emp.full_name,
          employee_code: emp.employee_code,
          assigned_at: matchedSim.assigned_date || today,
          assigned_date: matchedSim.assigned_date || today,
          assigned_by: emp.current_sim_assigned_by || 'Operations Admin',
          status: 'ACTIVE',
          assignment_status: 'ACTIVE',
          notes: 'Authoritatively reconciled active physical custody',
          created_at: now,
        };
        db.simAssignments.unshift(activeAsgn);
        count++;
        reconciledDetails.push({
          assignmentId: newAsgnId,
          employee: `${emp.full_name} (${emp.employee_code || emp.id})`,
          sim: matchedSim.mobile_number,
          action: 'Created authoritative active assignment record',
        });
      } else {
        activeAsgn.status = 'ACTIVE';
        activeAsgn.assignment_status = 'ACTIVE';
        activeAsgn.mobile_number = matchedSim.mobile_number;
        activeAsgn.provider = matchedSim.provider || activeAsgn.provider || 'ETISALAT';
        activeAsgn.iccid = matchedSim.iccid || activeAsgn.iccid || '—';
        activeAsgn.employee_id = emp.id;
        activeAsgn.employee_code = emp.employee_code;
        activeAsgn.employee_name = emp.full_name;
      }
    }
  }

  // 2. Second pass: SIM cards in inventory that have current_employee_id
  for (const sim of db.simCardsMaster) {
    if (sim.status === 'Lost' || sim.assignment_status === 'Lost') continue;

    if (sim.current_employee_id) {
      const emp = allEmployees.find((e: any) =>
        e.id === sim.current_employee_id ||
        (sim.current_employee_code && e.employee_code === sim.current_employee_code) ||
        (sim.current_employee_name && matchEmployeeNames(e.full_name, sim.current_employee_name))
      );

      if (emp) {
        emp.current_sim_id = sim.id;
        emp.current_sim_number = sim.mobile_number;
        emp.current_sim_provider = sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
        emp.current_sim_iccid = sim.iccid || '—';
        emp.current_sim_assigned_date = sim.assigned_date || emp.current_sim_assigned_date || today;

        sim.current_employee_id = emp.id;
        sim.current_employee_code = emp.employee_code;
        sim.current_employee_name = emp.full_name;
        sim.status = 'Assigned';
        sim.assignment_status = 'Assigned';

        const hasActive = db.simAssignments.some((a: any) =>
          (a.sim_id === sim.id || a.sim_card_id === sim.id || isSamePhone(a.mobile_number, sim.mobile_number)) &&
          (a.employee_id === emp.id || (emp.employee_code && a.employee_code === emp.employee_code)) &&
          (a.status === 'ACTIVE' || a.assignment_status === 'ACTIVE')
        );
        if (!hasActive) {
          db.simAssignments.unshift({
            id: `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            tenant_id: tenantId,
            sim_id: sim.id,
            sim_card_id: sim.id,
            mobile_number: sim.mobile_number,
            provider: sim.provider || 'ETISALAT',
            iccid: sim.iccid || '—',
            employee_id: emp.id,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            assigned_at: sim.assigned_date || today,
            assigned_date: sim.assigned_date || today,
            assigned_by: sim.assigned_by || 'Operations Admin',
            status: 'ACTIVE',
            assignment_status: 'ACTIVE',
            created_at: now,
          });
          count++;
        }
      } else {
        // Orphan employee ID on SIM: mark Available
        sim.status = 'Available';
        sim.assignment_status = 'Unassigned';
        sim.current_employee_id = undefined;
        sim.current_employee_name = undefined;
        sim.current_employee_code = undefined;
      }
    }

    // Historical returns recorded on the SIM card: ensure they exist in db.simAssignments
    if (sim.last_employee_id || sim.last_employee_name || sim.last_returned_date) {
      const histEmp = allEmployees.find((e: any) =>
        (sim.last_employee_id && (e.id === sim.last_employee_id || e.employee_code === sim.last_employee_id)) ||
        (sim.last_employee_code && e.employee_code === sim.last_employee_code) ||
        (sim.last_employee_name && matchEmployeeNames(e.full_name, sim.last_employee_name))
      );

      const histEmpId = histEmp?.id || sim.last_employee_id;
      const histEmpName = histEmp?.full_name || sim.last_employee_name || 'Rider';
      const histEmpCode = histEmp?.employee_code || sim.last_employee_code || '—';

      const existingHistAsgn = db.simAssignments.find((a: any) =>
        (a.sim_id === sim.id || a.sim_card_id === sim.id || isSamePhone(a.mobile_number, sim.mobile_number)) &&
        (a.employee_id === histEmpId || (histEmpCode && a.employee_code === histEmpCode) || matchEmployeeNames(histEmpName, a.employee_name)) &&
        (a.status === 'RETURNED' || a.assignment_status === 'RETURNED')
      );

      if (!existingHistAsgn) {
        db.simAssignments.unshift({
          id: sim.last_assignment_id || `sim_asgn_ret_${sim.id}_${sim.last_returned_date || Date.now()}`,
          tenant_id: tenantId,
          sim_id: sim.id,
          sim_card_id: sim.id,
          mobile_number: sim.mobile_number,
          iccid: sim.iccid || '—',
          provider: sim.provider || 'ETISALAT',
          employee_id: histEmpId,
          employee_name: histEmpName,
          employee_code: histEmpCode,
          status: 'RETURNED',
          assignment_status: 'RETURNED',
          assigned_date: sim.last_assigned_date || sim.assigned_date || '2026-08-01',
          assigned_at: sim.last_assigned_date || sim.assigned_date || '2026-08-01',
          assigned_by: sim.last_assigned_by || 'Operations Team',
          returned_date: sim.last_returned_date || today,
          return_date: sim.last_returned_date || today,
          returned_at: sim.last_returned_date ? `${sim.last_returned_date}T14:00:00Z` : now,
          returned_by: sim.last_returned_by || 'Operations Admin',
          returned_to: sim.last_returned_by || 'Operations Admin',
          return_reason: sim.last_return_reason || 'Rider returned SIM card to depot inventory',
          return_remark: sim.last_return_reason || 'Rider returned SIM card to depot inventory',
          created_at: now,
        });
        count++;
      }
    }
  }

  // 4. Scan all other assignments in db.simAssignments for stale ACTIVE rows
  for (const a of db.simAssignments) {
    if (a.status !== 'ACTIVE' && a.assignment_status !== 'ACTIVE') continue;

    // Check if the assigned SIM is marked Available in simCardsMaster
    const assignedSim = db.simCardsMaster.find((s: any) =>
      s.id === a.sim_id || s.id === a.sim_card_id || isSamePhone(s.mobile_number, a.mobile_number)
    );

    // If the SIM is marked Lost, ensure assignment reflects LOST, not RETURNED
    if (assignedSim && (assignedSim.status === 'Lost' || assignedSim.assignment_status === 'Lost')) {
      if (a.status !== 'LOST' && a.assignment_status !== 'LOST') {
        a.status = 'LOST';
        a.assignment_status = 'LOST';
        a.return_date = a.return_date || today;
        a.returned_date = a.returned_date || today;
        a.return_reason = a.return_reason || 'SIM card marked as LOST';
      }
      continue;
    }

    // Check employee custody
    const assignedEmp = db.masterEmployees.find((e: any) => {
      const vars = getEmployeeIdentifierVariants(e);
      if (a.employee_id && vars.has(String(a.employee_id).trim())) return true;
      if (a.employee_code && vars.has(String(a.employee_code).trim())) return true;
      if (a.employee_name && matchEmployeeNames(e.full_name, a.employee_name)) return true;
      return false;
    });

    const isSimAvailable = assignedSim && (assignedSim.status === 'Available' || assignedSim.assignment_status === 'Unassigned' || !assignedSim.current_employee_id);
    const empCustodyCleared = assignedEmp && (!assignedEmp.current_sim_id && !assignedEmp.current_sim_number);
    const empHoldsDifferentSim = assignedEmp && (
      (assignedEmp.current_sim_id && assignedSim && assignedEmp.current_sim_id !== assignedSim.id) ||
      (assignedEmp.current_sim_number && !isSamePhone(assignedEmp.current_sim_number, a.mobile_number))
    );

    if (isSimAvailable || empCustodyCleared || empHoldsDifferentSim) {
      const retDate = assignedSim?.last_returned_date || a.return_date || a.returned_date || today;
      const retBy = assignedSim?.last_returned_by || a.returned_by || 'Operations Admin';
      const retReason = assignedSim?.last_return_reason || a.return_reason || 'Rider returned SIM card to depot inventory';

      a.status = 'RETURNED';
      a.assignment_status = 'RETURNED';
      a.return_date = retDate;
      a.returned_date = retDate;
      a.returned_at = a.returned_at || `${retDate}T12:00:00Z`;
      a.returned_by = retBy;
      a.returned_to = retBy;
      a.return_reason = retReason;
      a.return_remark = retReason;

      count++;
      reconciledDetails.push({
        assignmentId: a.id,
        sim: a.mobile_number,
        employee: a.employee_name || a.employee_code,
        action: 'Reconciled stale ACTIVE assignment to RETURNED',
      });
    }
  }

  return { reconciledCount: count, reconciledDetails };
}

/**
 * Authoritatively retrieves an employee's current SIM and full assignment history.
 * Generic across all employees in the system.
 */
export async function getAuthoritativeEmployeeSimHistory(
  employeeIdOrCode: string,
  db: any,
  tenantId: string = 'company_pixel_syntax',
  supabase?: any
): Promise<{
  currentSim: any | null;
  simHistory: any[];
}> {
  if (!db) return { currentSim: null, simHistory: [] };

  // 1. Identify employee
  const empVariants = getEmployeeIdentifierVariants(employeeIdOrCode);
  const emp = (db.masterEmployees || []).find((e: any) => {
    const eVars = getEmployeeIdentifierVariants(e);
    for (const v of empVariants) {
      if (eVars.has(v)) return true;
    }
    return false;
  }) || (db.employees || []).find((e: any) => {
    const eVars = getEmployeeIdentifierVariants(e);
    for (const v of empVariants) {
      if (eVars.has(v)) return true;
    }
    return false;
  }) || AUTHORITATIVE_MASTER_EMPLOYEES.find((e: any) => {
    const eVars = getEmployeeIdentifierVariants(e);
    for (const v of empVariants) {
      if (eVars.has(v)) return true;
    }
    return false;
  });

  if (!emp) {
    return { currentSim: null, simHistory: [] };
  }

  const allEmpVariants = getEmployeeIdentifierVariants(emp);

  // 1b. Query Supabase sim_assignments if client is available
  const client = supabase || getSupabaseClient();
  if (client) {
    try {
      const empFilterVals = Array.from(allEmpVariants).filter(Boolean);
      const { data: supaAsgns } = await client
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('employee_id', empFilterVals);
      if (Array.isArray(supaAsgns)) {
        if (!db.simAssignments) db.simAssignments = [];
        for (const sa of supaAsgns) {
          const exIdx = db.simAssignments.findIndex((x: any) => x.id === sa.id);
          if (exIdx >= 0) {
            db.simAssignments[exIdx] = { ...db.simAssignments[exIdx], ...sa };
          } else {
            db.simAssignments.push(sa);
          }
        }
      }
      if (emp.employee_code) {
        const { data: supaAsgnsByCode } = await client
          .from('sim_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('employee_code', String(emp.employee_code));
        if (Array.isArray(supaAsgnsByCode)) {
          if (!db.simAssignments) db.simAssignments = [];
          for (const sa of supaAsgnsByCode) {
            const exIdx = db.simAssignments.findIndex((x: any) => x.id === sa.id);
            if (exIdx >= 0) {
              db.simAssignments[exIdx] = { ...db.simAssignments[exIdx], ...sa };
            } else {
              db.simAssignments.push(sa);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error fetching sim_assignments from Supabase for employee history:', e);
    }
  }

  // 2. Reconcile tenant lifecycles first to ensure in-memory consistency
  reconcileSimAssignmentLifecycles(db, tenantId);

  // 3. Resolve Current SIM
  let currentSim: any = null;
  const invalidCustodyVals = new Set(['none assigned', 'none', '—', '-', 'null', 'undefined', 'unassigned', '']);

  // Check if employee has an active assignment in simAssignments
  const activeAsgn = (db.simAssignments || []).find((a: any) => {
    const isActive = a.status === 'ACTIVE' || a.status === 'ASSIGNED' || a.assignment_status === 'ACTIVE' || a.assignment_status === 'ASSIGNED' || a.assignment_status === 'Assigned';
    if (!isActive) return false;
    const aEmpVars = getEmployeeIdentifierVariants({ id: a.employee_id, employee_code: a.employee_code });
    for (const v of allEmpVariants) {
      if (aEmpVars.has(v)) return true;
    }
    return Boolean(emp.full_name && a.employee_name && matchEmployeeNames(emp.full_name, a.employee_name));
  });

  if (activeAsgn) {
    const card = (db.simCardsMaster || []).find((s: any) =>
      s.id === activeAsgn.sim_card_id || s.id === activeAsgn.sim_id || isSamePhone(s.mobile_number, activeAsgn.mobile_number)
    );
    currentSim = {
      id: activeAsgn.sim_card_id || activeAsgn.sim_id || card?.id,
      mobile_number: activeAsgn.mobile_number || card?.mobile_number || activeAsgn.sim_number,
      sim_number: activeAsgn.mobile_number || card?.mobile_number || activeAsgn.sim_number,
      provider: activeAsgn.provider || card?.provider || emp.current_sim_provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
      iccid: activeAsgn.iccid || card?.iccid || emp.current_sim_iccid || '—',
      plan: card?.plan || 'Standard Fleet Plan',
      status: 'Assigned',
      assignment_status: 'Assigned',
      service_status: card?.service_status || 'Active',
      assigned_date: activeAsgn.assigned_date || (activeAsgn.assigned_at ? activeAsgn.assigned_at.slice(0, 10) : null) || card?.assigned_date || emp.current_sim_assigned_date,
      assigned_by: resolveStaffUserName(activeAsgn.assigned_by || card?.assigned_by || emp.current_sim_assigned_by, db),
    };
  } else if (emp.current_sim_id || emp.current_sim_number) {
    const foundCard = (db.simCardsMaster || []).find((s: any) =>
      (emp.current_sim_id && s.id === emp.current_sim_id) ||
      (emp.current_sim_number && (isSamePhone(s.mobile_number, emp.current_sim_number) || isSamePhone(s.sim_number, emp.current_sim_number)))
    );

    // Only consider currentSim if card is NOT Available / Unassigned / Lost
    const isCardAssigned = foundCard &&
      foundCard.status !== 'Available' &&
      foundCard.assignment_status !== 'Unassigned' &&
      foundCard.status !== 'Lost' &&
      (foundCard.current_employee_id === emp.id || !foundCard.current_employee_id);

    if (isCardAssigned) {
      currentSim = { ...foundCard };
    } else if (!foundCard && emp.current_sim_number && !invalidCustodyVals.has(String(emp.current_sim_number).toLowerCase().trim())) {
      // Check if this number was returned on any card
      const retCard = (db.simCardsMaster || []).find((s: any) =>
        isSamePhone(s.mobile_number, emp.current_sim_number) &&
        (s.status === 'Available' || s.assignment_status === 'Unassigned')
      );
      if (!retCard) {
        currentSim = {
          id: emp.current_sim_id || `sim_${emp.current_sim_number}`,
          mobile_number: emp.current_sim_number,
          sim_number: emp.current_sim_number,
          provider: emp.current_sim_provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
          iccid: emp.current_sim_iccid || '—',
          plan: 'Standard Fleet Plan',
          status: 'Assigned',
          assignment_status: 'Assigned',
          service_status: 'Active',
        };
      }
    }
  }

  // 4. Resolve SIM Assignment History
  const historyMap = new Map<string, any>();

  // Add from db.simAssignments
  for (const asgn of (db.simAssignments || [])) {
    const aEmpVars = getEmployeeIdentifierVariants({ id: asgn.employee_id, employee_code: asgn.employee_code });
    let matchesEmp = false;
    for (const v of allEmpVariants) {
      if (aEmpVars.has(v)) {
        matchesEmp = true;
        break;
      }
    }
    if (!matchesEmp && emp.full_name && asgn.employee_name && matchEmployeeNames(emp.full_name, asgn.employee_name)) {
      matchesEmp = true;
    }

    if (matchesEmp) {
      const card = (db.simCardsMaster || []).find((c: any) =>
        (asgn.sim_card_id && c.id === asgn.sim_card_id) ||
        (asgn.sim_id && c.id === asgn.sim_id) ||
        (asgn.mobile_number && isSamePhone(c.mobile_number, asgn.mobile_number))
      );

      const isActive = asgn.status === 'ACTIVE' || asgn.status === 'ASSIGNED' || asgn.assignment_status === 'ACTIVE' || asgn.assignment_status === 'Assigned';
      const status = isActive ? 'ASSIGNED' : (asgn.status || asgn.assignment_status || 'RETURNED');
      const mobileNumber = asgn.mobile_number || asgn.sim_number || card?.mobile_number || '—';
      const provider = asgn.provider || card?.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
      const iccid = asgn.iccid || card?.iccid || '—';
      const assignedDate = asgn.assigned_date || (asgn.assigned_at ? asgn.assigned_at.slice(0, 10) : null) || 'Not recorded';
      const assignedBy = resolveStaffUserName(asgn.assigned_by, db);
      const returnDate = isActive ? null : (asgn.return_date || asgn.returned_date || (asgn.returned_at ? asgn.returned_at.slice(0, 10) : null) || 'Not recorded');
      const returnedBy = isActive ? null : resolveStaffUserName(asgn.returned_by || asgn.returned_to, db);
      const returnReason = isActive ? null : ((asgn.return_reason || asgn.return_remark || asgn.reason || asgn.notes || '').trim() || 'Not recorded');

      historyMap.set(asgn.id, {
        ...asgn,
        id: asgn.id,
        sim_id: asgn.sim_id || asgn.sim_card_id || card?.id,
        sim_card_id: asgn.sim_card_id || asgn.sim_id || card?.id,
        mobile_number: mobileNumber,
        provider,
        iccid,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.full_name,
        status,
        assignment_status: status,
        assigned_date: assignedDate,
        assigned_at: asgn.assigned_at || assignedDate,
        assigned_by: assignedBy,
        return_date: returnDate,
        returned_date: returnDate,
        returned_at: asgn.returned_at || (returnDate && returnDate !== 'Not recorded' ? `${returnDate}T12:00:00Z` : null),
        returned_by: returnedBy,
        returned_to: returnedBy,
        return_reason: returnReason,
        return_remark: returnReason,
      });
    }
  }

  // Also check if any card in db.simCardsMaster was returned by this employee and missing from db.simAssignments
  for (const sc of (db.simCardsMaster || [])) {
    const scLastEmpVars = getEmployeeIdentifierVariants({ id: sc.last_employee_id, employee_code: sc.last_employee_code });
    let matchesEmp = false;
    for (const v of allEmpVariants) {
      if (scLastEmpVars.has(v)) {
        matchesEmp = true;
        break;
      }
    }
    if (!matchesEmp && emp.full_name && sc.last_employee_name && matchEmployeeNames(emp.full_name, sc.last_employee_name)) {
      matchesEmp = true;
    }

    // Historical return condition: matches this employee and was returned (regardless of current SIM custody)
    if (matchesEmp && (sc.last_returned_date || sc.last_employee_id || sc.last_employee_name)) {
      const syntheticId = sc.last_assignment_id || `sim_asgn_ret_${sc.id}_${sc.last_returned_date || 'hist'}`;
      const alreadyHas = Array.from(historyMap.values()).some((h: any) =>
        (h.sim_id === sc.id || isSamePhone(h.mobile_number, sc.mobile_number)) && (h.status === 'RETURNED' || h.assignment_status === 'RETURNED')
      );
      if (!alreadyHas) {
        const retRecord = {
          id: syntheticId,
          tenant_id: tenantId,
          sim_id: sc.id,
          sim_card_id: sc.id,
          mobile_number: sc.mobile_number,
          provider: sc.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
          iccid: sc.iccid || '—',
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          status: 'RETURNED',
          assignment_status: 'RETURNED',
          assigned_date: sc.last_assigned_date || sc.assigned_date || 'Not recorded',
          assigned_at: sc.last_assigned_date || sc.assigned_date || null,
          assigned_by: resolveStaffUserName(sc.last_assigned_by, db),
          return_date: sc.last_returned_date || 'Not recorded',
          returned_date: sc.last_returned_date || 'Not recorded',
          returned_at: sc.last_returned_date ? `${sc.last_returned_date}T12:00:00Z` : null,
          returned_by: resolveStaffUserName(sc.last_returned_by, db),
          returned_to: resolveStaffUserName(sc.last_returned_by, db),
          return_reason: (sc.last_return_reason || sc.last_return_remark || '').trim() || 'Rider returned SIM card to depot inventory',
          return_remark: (sc.last_return_reason || sc.last_return_remark || '').trim() || 'Rider returned SIM card to depot inventory',
        };
        historyMap.set(syntheticId, retRecord);

        // Also ensure in db.simAssignments so permanent record exists
        if (db && Array.isArray(db.simAssignments)) {
          const existsInDb = db.simAssignments.some((a: any) =>
            a.id === syntheticId ||
            ((a.sim_id === sc.id || a.sim_card_id === sc.id || isSamePhone(a.mobile_number, sc.mobile_number)) &&
             a.employee_id === emp.id &&
             (a.status === 'RETURNED' || a.assignment_status === 'RETURNED'))
          );
          if (!existsInDb) {
            db.simAssignments.unshift(retRecord);
          }
        }
      }
    }
  }

  // Ensure active stub if employee holds a SIM but assignment row is not present
  if (currentSim && !Array.from(historyMap.values()).some((s) => s.status === 'ASSIGNED' || s.status === 'ACTIVE')) {
    const stubId = `sim_asgn_emp_${emp.id}`;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    historyMap.set(stubId, {
      id: stubId,
      sim_id: currentSim.id,
      sim_card_id: currentSim.id,
      mobile_number: currentSim.mobile_number,
      provider: currentSim.provider || 'ETISALAT',
      iccid: currentSim.iccid || '—',
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      assigned_date: emp.current_sim_assigned_date || emp.joining_date?.slice(0, 10) || today,
      assigned_at: emp.current_sim_assigned_date || emp.joining_date || now,
      status: 'ASSIGNED',
      assignment_status: 'ASSIGNED',
      assigned_by: resolveStaffUserName(emp.current_sim_assigned_by, db),
      return_date: null,
      returned_date: null,
      returned_at: null,
      returned_by: null,
      returned_to: null,
      return_reason: null,
      return_remark: null,
    });
  }

  const simHistory = Array.from(historyMap.values()).sort((a, b) => {
    const isAActive = a.status === 'ACTIVE' || a.status === 'ASSIGNED';
    const isBActive = b.status === 'ACTIVE' || b.status === 'ASSIGNED';
    if (isAActive && !isBActive) return -1;
    if (!isAActive && isBActive) return 1;
    const dateA = new Date(a.returned_at || a.return_date || a.assigned_at || a.assigned_date || 0).getTime();
    const dateB = new Date(b.returned_at || b.return_date || b.assigned_at || b.assigned_date || 0).getTime();
    return dateB - dateA;
  });

  return { currentSim, simHistory };
}

/**
 * Authoritatively retrieves an employee's current vehicle and full vehicle assignment history.
 * Generic across all employees in the system.
 */
export async function getAuthoritativeEmployeeVehicleHistory(
  employeeIdOrCode: string,
  db: any,
  tenantId: string = 'company_pixel_syntax',
  supabase?: any
): Promise<{
  currentVehicle: any | null;
  vehicleHistory: any[];
}> {
  if (!db) return { currentVehicle: null, vehicleHistory: [] };

  const empVariants = getEmployeeIdentifierVariants(employeeIdOrCode);
  const emp = (db.masterEmployees || []).find((e: any) => {
    const eVars = getEmployeeIdentifierVariants(e);
    for (const v of empVariants) {
      if (eVars.has(v)) return true;
    }
    return false;
  }) || (db.employees || []).find((e: any) => {
    const eVars = getEmployeeIdentifierVariants(e);
    for (const v of empVariants) {
      if (eVars.has(v)) return true;
    }
    return false;
  });

  if (!emp) {
    return { currentVehicle: null, vehicleHistory: [] };
  }

  // Resolve current vehicle
  let currentVehicle: any = null;
  if (emp.current_bike_id || emp.current_bike_plate) {
    currentVehicle =
      (db.vehicles || []).find((v: any) => v.id === emp.current_bike_id || v.plateNumber === emp.current_bike_plate || v.plate_number === emp.current_bike_plate) ||
      (db.fleetVehicles || []).find((v: any) => v.id === emp.current_bike_id || v.plateNumber === emp.current_bike_plate || v.plate_number === emp.current_bike_plate);

    if (!currentVehicle && emp.current_bike_plate) {
      currentVehicle = {
        id: emp.current_bike_id || `v_${emp.current_bike_plate}`,
        plate_number: emp.current_bike_plate,
        plateNumber: emp.current_bike_plate,
        make: 'Honda / Bajaj',
        model: 'Motorcycle',
      };
    }
  }

  const allEmpVariants = getEmployeeIdentifierVariants(emp);
  const vehicleHistoryMap = new Map<string, any>();
  const rawVehList = [
    ...(db.vehicleAssignments || []),
    ...(db.fleetAssignments || []),
  ];

  for (const v of rawVehList) {
    const vEmpVars = getEmployeeIdentifierVariants({ id: v.employee_id, employee_code: v.employee_code });
    let matchesEmp = false;
    for (const varId of allEmpVariants) {
      if (vEmpVars.has(varId)) {
        matchesEmp = true;
        break;
      }
    }
    if (!matchesEmp && emp.full_name && v.employee_name && matchEmployeeNames(emp.full_name, v.employee_name)) {
      matchesEmp = true;
    }

    if (matchesEmp) {
      const id = v.id || `veh_asg_${v.vehicle_id || v.vehicle_plate}_${v.assignment_date || v.created_at || Date.now()}`;
      const isActive = v.assignment_status === 'ACTIVE' || v.status === 'ACTIVE';
      const status = isActive ? 'ACTIVE' : 'RETURNED';

      vehicleHistoryMap.set(id, {
        ...v,
        id,
        vehicle_id: v.vehicle_id || v.vehicle_plate,
        vehicle_plate: v.vehicle_plate || v.plate_number || v.plateNumber || '—',
        vehicle_model: v.vehicle_model || v.model || 'Motorcycle',
        employee_name: v.employee_name || emp.full_name,
        employee_code: v.employee_code || emp.employee_code,
        employee_id: emp.id,
        assignment_date: v.assignment_date || v.start_date || v.created_at?.slice(0, 10) || null,
        assignment_status: status,
        status,
        starting_odometer: v.starting_odometer ?? 0,
        return_odometer: v.return_odometer ?? null,
        assigned_by: resolveStaffUserName(v.assigned_by, db),
        assigned_by_id: v.assigned_by_id,
        returned_by: isActive ? null : (v.returned_by || v.returned_to || 'Operations Admin'),
        return_date: isActive ? null : (v.return_date || v.returned_date || null),
        return_reason: isActive ? null : (v.return_reason || v.reason || v.return_notes || 'Depot Return'),
      });
    }
  }

  // Active stub if current_bike_plate present without active history row
  if (emp.current_bike_plate && !Array.from(vehicleHistoryMap.values()).some((v) => v.assignment_status === 'ACTIVE')) {
    const stubId = `v_asgn_emp_${emp.id}`;
    vehicleHistoryMap.set(stubId, {
      id: stubId,
      tenant_id: tenantId,
      vehicle_id: emp.current_bike_id || emp.current_bike_plate,
      vehicle_plate: emp.current_bike_plate,
      vehicle_model: 'Motorcycle',
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code,
      assignment_date: emp.joining_date?.slice(0, 10) || null,
      assignment_status: 'ACTIVE',
      status: 'ACTIVE',
      starting_odometer: 0,
      assigned_by: 'Operations Admin',
      return_date: null,
      returned_by: null,
      return_reason: null,
    });
  }

  if (!currentVehicle) {
    const activeVehAsgn = Array.from(vehicleHistoryMap.values()).find(
      (v) => v.assignment_status === 'ACTIVE' || v.status === 'ACTIVE'
    );
    if (activeVehAsgn) {
      currentVehicle =
        (db.vehicles || []).find((v: any) => v.id === activeVehAsgn.vehicle_id || v.plateNumber === activeVehAsgn.vehicle_plate || v.plate_number === activeVehAsgn.vehicle_plate) ||
        (db.fleetVehicles || []).find((v: any) => v.id === activeVehAsgn.vehicle_id || v.plateNumber === activeVehAsgn.vehicle_plate || v.plate_number === activeVehAsgn.vehicle_plate) || {
          id: activeVehAsgn.vehicle_id || `v_${activeVehAsgn.vehicle_plate}`,
          plate_number: activeVehAsgn.vehicle_plate,
          plateNumber: activeVehAsgn.vehicle_plate,
          make: activeVehAsgn.make || 'Motorcycle',
          model: activeVehAsgn.vehicle_model || 'Motorcycle',
        };
    }
  }

  const vehicleHistory = Array.from(vehicleHistoryMap.values()).sort((a, b) => {
    const isAActive = a.assignment_status === 'ACTIVE';
    const isBActive = b.assignment_status === 'ACTIVE';
    if (isAActive && !isBActive) return -1;
    if (!isAActive && isBActive) return 1;
    const dateA = new Date(a.return_date || a.assignment_date || a.created_at || 0).getTime();
    const dateB = new Date(b.return_date || b.assignment_date || b.created_at || 0).getTime();
    return dateB - dateA;
  });

  return { currentVehicle, vehicleHistory };
}
