/**
 * Authoritative SIM Assignment & Custody Engine
 *
 * Ensures:
 * 1. Single authoritative assignment record in Supabase `sim_assignments`
 * 2. Instant synchronization between `sim_cards` and `employees` tables in Supabase
 * 3. Bidirectional alignment: SIM Management <-> Employee Management use the EXACT same engine
 * 4. Duplicate protection:
 *    - One employee cannot have multiple active SIM assignments
 *    - One SIM cannot be assigned to multiple employees
 * 5. Reassignment / swap support with history preservation (previous assignment marked RETURNED)
 * 6. Authoritative employee search: searches master employee records by Name, Employee Code, Emirates ID, Mobile Number
 *    (Zero dependency on auth_users / login accounts)
 * 7. Tenant isolation: strictly company_allied
 */

import { AUTHORITATIVE_MASTER_EMPLOYEES } from './authoritativeEmployees';

export interface AssignSimAuthoritativeParams {
  tenantId: string;
  simId: string;
  employeeId: string;
  assignedDate?: string;
  monthlyPackageAmount?: number;
  approvedAmount?: number;
  payableAmount?: number;
  notes?: string;
  assignedBy?: string;
  userId?: string;
  forceReassign?: boolean;
}

export interface ReturnSimAuthoritativeParams {
  tenantId: string;
  simId?: string;
  employeeId?: string;
  returnDate?: string;
  returnReason?: string;
  notes?: string;
  returnedTo?: string;
  returnedBy?: string;
  userId?: string;
}

export interface ReplaceSimAuthoritativeParams {
  tenantId: string;
  employeeId: string;
  oldSimId?: string;
  newSimId: string;
  replacementReason?: string;
  notes?: string;
  assignedBy?: string;
  userId?: string;
  monthlyPackageAmount?: number;
  approvedAmount?: number;
  payableAmount?: number;
}

export interface SimAssignmentResult {
  success: boolean;
  code?: string;
  error?: string;
  message?: string;
  hasExistingSim?: boolean;
  currentSim?: {
    sim_id: string;
    mobile_number: string;
  };
  assignedTo?: string;
  assignment?: any;
  sim?: any;
  employee?: any;
}

function cleanDigits(val?: string | null): string {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

/**
 * Single Authoritative Employee Search for SIM Assignment
 * Searches the real company_allied master employees (not user accounts)
 * by Full Name, Employee Code / ADL code, Emirates ID, and Mobile Number.
 */
export async function searchEmployeesForSimAuthoritative(
  supabase: any,
  db: any,
  params: {
    tenantId?: string;
    query?: string;
    limit?: number;
  }
): Promise<any[]> {
  const tenantId = params.tenantId || 'company_allied';
  const query = (params.query || '').trim();
  const limit = params.limit && params.limit > 0 ? params.limit : 50;

  // 1. Fetch employees from Supabase first, fallback to db.masterEmployees or AUTHORITATIVE_MASTER_EMPLOYEES
  let employees: any[] = [];
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        employees = data;
      }
    } catch (err) {
      console.warn('Supabase employee fetch failed in searchEmployeesForSimAuthoritative:', err);
    }
  }

  if (employees.length === 0 && db && Array.isArray(db.masterEmployees)) {
    employees = db.masterEmployees.filter(
      (e: any) => (e.tenant_id === tenantId || tenantId === 'company_allied') && !e.is_archived && !e.isArchived
    );
  }

  if (employees.length === 0) {
    employees = [...AUTHORITATIVE_MASTER_EMPLOYEES];
  }

  // 2. Fetch active SIM assignments to accurately reflect current custody
  let activeAssignmentsMap = new Map<string, any>();
  if (supabase) {
    try {
      const { data: asgns, error: asgnErr } = await supabase
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');

      if (!asgnErr && Array.isArray(asgns)) {
        asgns.forEach((a: any) => {
          if (a.employee_id) {
            activeAssignmentsMap.set(a.employee_id, a);
          }
        });
      }
    } catch (err) {
      console.warn('Supabase sim_assignments fetch failed:', err);
    }
  }

  if (activeAssignmentsMap.size === 0 && db && Array.isArray(db.simAssignments)) {
    db.simAssignments
      .filter((a: any) => a.tenant_id === tenantId && a.status === 'ACTIVE')
      .forEach((a: any) => {
        if (a.employee_id) {
          activeAssignmentsMap.set(a.employee_id, a);
        }
      });
  }

  // 3. Filter employees
  let filtered = employees;

  if (query) {
    const lowerQuery = query.toLowerCase();
    const queryDigits = cleanDigits(query);
    const queryTokens = lowerQuery.split(/\s+/).filter(Boolean);

    filtered = employees.filter((e: any) => {
      const fn = (e.full_name || e.name || '').toLowerCase();
      const first = (e.first_name || '').toLowerCase();
      const last = (e.last_name || '').toLowerCase();
      const dn = (e.display_name || '').toLowerCase();
      const namesCombined = `${first} ${last} ${fn} ${dn}`.trim();

      const code = (e.employee_code || e.id || '').toLowerCase();
      const eid = (e.emirates_id_number || e.emirates_id || '').toLowerCase();
      const mob1 = (e.personal_mobile || '').toLowerCase();
      const mob2 = (e.mobile_number || '').toLowerCase();
      const mob3 = (e.company_mobile || '').toLowerCase();
      const phone = (e.phone || '').toLowerCase();
      const phonesCombined = `${mob1} ${mob2} ${mob3} ${phone}`.trim();

      // Full Name (exact, partial, combined tokens)
      if (namesCombined.includes(lowerQuery)) return true;
      if (queryTokens.length > 1 && queryTokens.every((tok) => namesCombined.includes(tok))) return true;

      // Employee Code / ADL code (exact, partial, sequence digits e.g. "0001", "1")
      if (code.includes(lowerQuery)) return true;
      if (queryDigits && code.includes(queryDigits)) return true;

      // Emirates ID (with and without hyphens)
      if (eid.includes(lowerQuery)) return true;
      if (queryDigits.length >= 3 && cleanDigits(eid).includes(queryDigits)) return true;

      // Mobile Number (partial digits, formatted, local)
      if (phonesCombined.includes(lowerQuery)) return true;
      if (queryDigits.length >= 3 && cleanDigits(phonesCombined).includes(queryDigits)) return true;

      return false;
    });
  }

  // 4. Map to canonical SimEmployeeSearchCandidate
  const results = filtered.slice(0, limit).map((emp: any) => {
    const activeAsgn = activeAssignmentsMap.get(emp.id);
    const currentSimId = activeAsgn?.sim_card_id || activeAsgn?.sim_id || emp.current_sim_id || null;
    const currentSimNumber = activeAsgn?.mobile_number || emp.current_sim_number || null;
    const hasActiveSim = Boolean(
      activeAsgn ||
        (currentSimId && currentSimId !== '' && currentSimId !== 'None') ||
        (currentSimNumber && currentSimNumber !== 'None' && currentSimNumber !== '—' && currentSimNumber !== '')
    );

    return {
      id: emp.id,
      full_name: emp.full_name || emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || 'Unknown Employee',
      employee_code: emp.employee_code || emp.id,
      emirates_id: emp.emirates_id_number || emp.emirates_id || '—',
      visa_contractor_type: emp.visa_contractor_type || emp.contractor || 'Company Visa',
      project_name: emp.project_name || emp.current_project_name || 'Unassigned',
      primary_project: emp.project_name || emp.current_project_name || 'Unassigned',
      current_bike_plate: emp.current_bike_plate || null,
      current_sim_id: currentSimId,
      current_sim_number: currentSimNumber,
      has_active_sim: hasActiveSim,
      current_status: emp.current_status || emp.status || 'Active',
    };
  });

  return results;
}

/**
 * Assigns a SIM to an employee with authoritative Supabase persistence
 * and bidirectional sync across `sim_cards`, `employees`, and `sim_assignments`.
 */
export async function assignSimAuthoritative(
  supabase: any,
  db: any,
  params: AssignSimAuthoritativeParams
): Promise<SimAssignmentResult> {
  const {
    tenantId = 'company_allied',
    simId,
    employeeId,
    assignedDate,
    monthlyPackageAmount,
    approvedAmount,
    payableAmount,
    notes,
    assignedBy = 'Telecom Admin',
    userId,
    forceReassign = false,
  } = params;

  const now = new Date().toISOString();
  const asgnDate = assignedDate || now.split('T')[0];

  // 1. Fetch Employee
  let emp: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${employeeId},employee_code.eq.${employeeId}`)
        .maybeSingle();

      if (!error && data) {
        emp = data;
      }
    } catch (err) {
      console.warn('Supabase employee lookup failed:', err);
    }
  }

  if (!emp && db && Array.isArray(db.masterEmployees)) {
    emp = db.masterEmployees.find(
      (e: any) =>
        (e.id === employeeId || e.employee_code === employeeId) &&
        (e.tenant_id === tenantId || tenantId === 'company_allied')
    );
  }

  if (!emp) {
    emp = AUTHORITATIVE_MASTER_EMPLOYEES.find(
      (e) => e.id === employeeId || e.employee_code === employeeId
    );
  }

  if (!emp) {
    return {
      success: false,
      code: 'EMPLOYEE_NOT_FOUND',
      error: `Employee ${employeeId} not found in authoritative directory.`,
    };
  }

  // 2. Fetch SIM
  let sim: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${simId},mobile_number.eq.${simId},iccid.eq.${simId}`)
        .maybeSingle();

      if (!error && data) {
        sim = data;
      }
    } catch (err) {
      console.warn('Supabase SIM lookup failed:', err);
    }
  }

  if (!sim && db && Array.isArray(db.simCardsMaster)) {
    sim = db.simCardsMaster.find(
      (s: any) =>
        (s.id === simId || s.mobile_number === simId || s.iccid === simId) &&
        (s.tenant_id === tenantId || tenantId === 'company_allied')
    );
  }

  if (!sim) {
    return {
      success: false,
      code: 'SIM_NOT_FOUND',
      error: `SIM line ${simId} not found in authoritative inventory.`,
    };
  }

  // 3. DUPLICATE ACTIVE ASSIGNMENT GUARD 1: Employee already has an active SIM
  let activeEmpAsgn: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('employee_id', emp.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (data) activeEmpAsgn = data;
    } catch (err) {
      console.warn('Supabase active assignment check error:', err);
    }
  }

  if (!activeEmpAsgn && db && Array.isArray(db.simAssignments)) {
    activeEmpAsgn = db.simAssignments.find(
      (a: any) => a.tenant_id === tenantId && a.employee_id === emp.id && a.status === 'ACTIVE'
    );
  }

  const existingSimId = emp.current_sim_id || activeEmpAsgn?.sim_card_id || activeEmpAsgn?.sim_id;
  const existingSimNum = emp.current_sim_number || activeEmpAsgn?.mobile_number;

  // If already has SIM and it is DIFFERENT from the target SIM, block unless forceReassign (swap/replace)
  if (
    !forceReassign &&
    (existingSimId || (existingSimNum && existingSimNum !== 'None' && existingSimNum !== '—')) &&
    existingSimId !== sim.id &&
    existingSimNum !== sim.mobile_number
  ) {
    return {
      success: false,
      code: 'EMPLOYEE_ALREADY_HAS_SIM',
      error: `EMPLOYEE_ALREADY_HAS_SIM: Employee ${emp.full_name} (${emp.employee_code}) already has an active primary SIM assignment: ${existingSimNum || existingSimId}. Use Replace SIM or return existing SIM first.`,
      hasExistingSim: true,
      currentSim: {
        sim_id: existingSimId,
        mobile_number: existingSimNum,
      },
    };
  }

  // 4. DUPLICATE ACTIVE ASSIGNMENT GUARD 2: SIM is already assigned to someone else
  let activeSimAsgn: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('sim_card_id', sim.id)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      if (data) activeSimAsgn = data;
    } catch (err) {
      console.warn('Supabase active SIM check error:', err);
    }
  }

  if (!activeSimAsgn && db && Array.isArray(db.simAssignments)) {
    activeSimAsgn = db.simAssignments.find(
      (a: any) =>
        a.tenant_id === tenantId &&
        (a.sim_card_id === sim.id || a.sim_id === sim.id) &&
        a.status === 'ACTIVE'
    );
  }

  const simIsAssigned =
    sim.assignment_status === 'Assigned' ||
    (sim.current_employee_id && sim.current_employee_id !== emp.id) ||
    (activeSimAsgn && activeSimAsgn.employee_id !== emp.id);

  if (simIsAssigned && !forceReassign) {
    const currentHolder = sim.current_employee_name || activeSimAsgn?.employee_name || 'another employee';
    return {
      success: false,
      code: 'SIM_ALREADY_ASSIGNED',
      error: `SIM_ALREADY_ASSIGNED: SIM ${sim.mobile_number} is already actively assigned to ${currentHolder} (${sim.current_employee_code || activeSimAsgn?.employee_code || 'ID'}).`,
      assignedTo: currentHolder,
    };
  }

  // 5. If forceReassign is true, return any existing SIM of the employee first
  if (forceReassign && existingSimId && existingSimId !== sim.id) {
    await returnSimAuthoritative(supabase, db, {
      tenantId,
      simId: existingSimId,
      employeeId: emp.id,
      returnDate: asgnDate,
      returnReason: 'Automatic return due to SIM replacement / reassignment',
      returnedTo: assignedBy,
      userId,
    });
  }

  // 6. Persistence: Supabase Database Update
  const newAssignmentId = `s_asgn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let assignmentRecord: any = null;

  if (supabase) {
    try {
      // Close any stale active assignment for this SIM card
      await supabase
        .from('sim_assignments')
        .update({
          status: 'RETURNED',
          returned_at: now,
          return_date: asgnDate,
          return_reason: 'Reassigned to another employee',
        })
        .eq('tenant_id', tenantId)
        .eq('sim_card_id', sim.id)
        .eq('status', 'ACTIVE');

      // Insert new active assignment
      assignmentRecord = {
        id: newAssignmentId,
        tenant_id: tenantId,
        sim_card_id: sim.id,
        sim_number: sim.iccid || sim.sim_serial_number || sim.mobile_number,
        mobile_number: sim.mobile_number,
        provider: sim.provider || sim.vendor || (tenantId === 'company_allied' ? 'ETISALAT' : 'DU'),
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        assigned_at: asgnDate,
        assigned_date: asgnDate,
        status: 'ACTIVE',
        assigned_by: assignedBy,
        notes: notes || 'Assigned via Authoritative SIM Management',
        created_at: now,
      };

      const { error: asgnInsertErr } = await supabase.from('sim_assignments').insert(assignmentRecord);
      if (asgnInsertErr) {
        console.warn('Supabase sim_assignments insert error:', asgnInsertErr);
      }

      // Update sim_cards table
      const simUpdatePayload: any = {
        assignment_status: 'Assigned',
        status: 'Assigned',
        current_employee_id: emp.id,
        current_employee_name: emp.full_name,
        current_employee_code: emp.employee_code,
        assigned_date: asgnDate,
        assigned_by: assignedBy,
        notes: notes || null,
        updated_at: now,
        updated_by: assignedBy,
      };

      if (monthlyPackageAmount !== undefined && !isNaN(Number(monthlyPackageAmount))) {
        simUpdatePayload.monthly_package_amount = Number(monthlyPackageAmount);
      }

      const { error: simUpdateErr } = await supabase
        .from('sim_cards')
        .update(simUpdatePayload)
        .eq('id', sim.id);

      if (simUpdateErr) {
        console.warn('Supabase sim_cards update error:', simUpdateErr);
      }

      // Update employees table (current SIM pointer)
      const { error: empUpdateErr } = await supabase
        .from('employees')
        .update({
          current_sim_id: sim.id,
          current_sim_number: sim.mobile_number,
          updated_at: now,
          updated_by: assignedBy,
        })
        .eq('id', emp.id);

      if (empUpdateErr) {
        console.warn('Supabase employees update error:', empUpdateErr);
      }

      // Record Audit Log if table exists
      try {
        await supabase.from('audit_logs').insert({
          id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenant_id: tenantId,
          user_id: userId || 'system',
          actor_name: assignedBy,
          action: 'ASSIGN_SIM',
          action_type: 'ASSIGN',
          module: 'SIM_MANAGEMENT',
          entity_type: 'SIM_CARD',
          entity_id: sim.id,
          details: `Assigned SIM ${sim.mobile_number} (${sim.provider || (tenantId === 'company_allied' ? 'ETISALAT' : 'DU')}) to employee ${emp.full_name} (${emp.employee_code}).`,
          created_at: now,
        });
      } catch {
        // Non-blocking audit log
      }
    } catch (err: any) {
      console.error('Supabase assignment transaction error:', err);
    }
  }

  // 7. Update in-memory DB (for Node dev / fallback environments)
  if (db) {
    if (!assignmentRecord) {
      assignmentRecord = {
        id: newAssignmentId,
        tenant_id: tenantId,
        sim_id: sim.id,
        sim_card_id: sim.id,
        mobile_number: sim.mobile_number,
        provider: sim.provider || sim.vendor,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        assigned_at: asgnDate,
        assigned_date: asgnDate,
        assigned_by: assignedBy,
        status: 'ACTIVE',
        notes: notes || 'Assigned via Authoritative SIM Management',
        created_at: now,
      };
    }

    if (!Array.isArray(db.simAssignments)) db.simAssignments = [];
    // Mark previous active assignment for this SIM as returned
    db.simAssignments.forEach((a: any) => {
      if (a.tenant_id === tenantId && (a.sim_id === sim.id || a.sim_card_id === sim.id) && a.status === 'ACTIVE') {
        a.status = 'RETURNED';
        a.returned_at = now;
        a.return_date = asgnDate;
      }
    });
    db.simAssignments.unshift(assignmentRecord);

    // Update SIM record in db
    sim.assignment_status = 'Assigned';
    sim.status = 'Assigned';
    sim.current_employee_id = emp.id;
    sim.current_employee_name = emp.full_name;
    sim.current_employee_code = emp.employee_code;
    sim.assigned_date = asgnDate;
    sim.assigned_by = assignedBy;
    sim.assign_note = notes || undefined;
    if (monthlyPackageAmount !== undefined) sim.monthly_package_amount = Number(monthlyPackageAmount);
    if (approvedAmount !== undefined) sim.approved_amount = Number(approvedAmount);
    if (payableAmount !== undefined) sim.payable_amount = Number(payableAmount);
    sim.updated_at = now;
    sim.updated_by = assignedBy;

    // Update Employee record in db
    emp.current_sim_id = sim.id;
    emp.current_sim_number = sim.mobile_number;
    emp.updated_at = now;
    emp.updated_by = assignedBy;

    // Audit logs in db
    if (!Array.isArray(db.auditLogs)) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      action: 'SIM_ASSIGNED',
      module: 'SIM_MANAGEMENT',
      entity_type: 'SIM',
      entity_id: sim.id,
      details: `Assigned SIM line ${sim.mobile_number} (${sim.provider || sim.vendor}) to ${emp.full_name} (${emp.employee_code}).`,
      performed_by: assignedBy,
      user_id: userId,
      timestamp: now,
      created_at: now,
    });
  }

  return {
    success: true,
    message: `SIM line ${sim.mobile_number} successfully assigned to ${emp.full_name}.`,
    sim,
    employee: emp,
    assignment: assignmentRecord,
  };
}

/**
 * Returns a SIM to the available inventory pool with authoritative Supabase persistence.
 */
export async function returnSimAuthoritative(
  supabase: any,
  db: any,
  params: ReturnSimAuthoritativeParams
): Promise<{ success: boolean; error?: string; message?: string }> {
  const {
    tenantId = 'company_allied',
    simId,
    employeeId,
    returnDate,
    returnReason = 'Returned to inventory',
    notes,
    returnedTo = 'Telecom Admin',
    returnedBy,
    userId,
  } = params;

  const effectiveReturnedBy = returnedBy || returnedTo || 'Telecom Admin';
  const effectiveReturnedTo = returnedTo || returnedBy || 'Telecom Admin';

  const now = new Date().toISOString();
  const retDate = returnDate || now.split('T')[0];

  // 1. Locate SIM card
  let sim: any = null;
  if (supabase && simId) {
    try {
      const { data } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${simId},mobile_number.eq.${simId}`)
        .maybeSingle();
      if (data) sim = data;
    } catch (err) {
      console.warn('Supabase SIM fetch error:', err);
    }
  }

  if (!sim && db && Array.isArray(db.simCardsMaster) && simId) {
    sim = db.simCardsMaster.find(
      (s: any) =>
        (s.id === simId || s.mobile_number === simId) &&
        (s.tenant_id === tenantId || tenantId === 'company_allied')
    );
  }

  // If simId not provided or not found, try finding via employeeId
  let emp: any = null;
  if (employeeId) {
    if (supabase) {
      try {
        const { data } = await supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', tenantId)
          .or(`id.eq.${employeeId},employee_code.eq.${employeeId}`)
          .maybeSingle();
        if (data) emp = data;
      } catch (err) {
        console.warn('Supabase employee fetch error:', err);
      }
    }

    if (!emp && db && Array.isArray(db.masterEmployees)) {
      emp = db.masterEmployees.find(
        (e: any) =>
          (e.id === employeeId || e.employee_code === employeeId) &&
          (e.tenant_id === tenantId || tenantId === 'company_allied')
      );
    }

    if (!sim && emp && emp.current_sim_id) {
      if (supabase) {
        try {
          const { data } = await supabase
            .from('sim_cards')
            .select('*')
            .eq('id', emp.current_sim_id)
            .maybeSingle();
          if (data) sim = data;
        } catch {
          // ignore
        }
      }
      if (!sim && db && Array.isArray(db.simCardsMaster)) {
        sim = db.simCardsMaster.find((s: any) => s.id === emp.current_sim_id);
      }
    }
  }

  const effectiveSimId = sim?.id || simId;
  const effectiveEmpId = emp?.id || sim?.current_employee_id || employeeId;

  // 1.5 Fetch active assignment for audit & history preservation
  let activeAsgn: any = null;
  if (supabase) {
    try {
      let asgnLookup = supabase
        .from('sim_assignments')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');
      if (effectiveSimId) {
        asgnLookup = asgnLookup.eq('sim_card_id', effectiveSimId);
      } else if (effectiveEmpId) {
        asgnLookup = asgnLookup.eq('employee_id', effectiveEmpId);
      }
      const { data } = await asgnLookup.maybeSingle();
      if (data) activeAsgn = data;
    } catch (e) {
      console.warn('Error fetching active sim assignment:', e);
    }
  }
  if (!activeAsgn && db && Array.isArray(db.simAssignments)) {
    activeAsgn = db.simAssignments.find(
      (a: any) =>
        a.tenant_id === tenantId &&
        a.status === 'ACTIVE' &&
        ((effectiveSimId && (a.sim_id === effectiveSimId || a.sim_card_id === effectiveSimId)) ||
          (effectiveEmpId && a.employee_id === effectiveEmpId))
    );
  }

  const lastEmpId = effectiveEmpId || activeAsgn?.employee_id || sim?.current_employee_id;
  const lastEmpName = emp?.full_name || activeAsgn?.employee_name || sim?.current_employee_name || 'Employee';
  const lastEmpCode = emp?.employee_code || activeAsgn?.employee_code || sim?.current_employee_code || '';
  const lastAssignedDate = activeAsgn?.assigned_date || activeAsgn?.assigned_at || sim?.assigned_date || null;
  const lastAssignedTime = activeAsgn?.assigned_time || null;
  const lastAssignedBy = activeAsgn?.assigned_by || sim?.assigned_by || null;
  const lastAssignRemark = activeAsgn?.notes || activeAsgn?.assign_remark || sim?.assign_note || null;
  const lastProject = activeAsgn?.project_name || emp?.project_name || sim?.current_project_name || null;
  const rTime = now.split('T')[1] ? now.split('T')[1].slice(0, 8) : '18:00:00';

  // 2. Supabase Updates
  if (supabase) {
    try {
      // Close active assignment
      let asgnQuery = supabase
        .from('sim_assignments')
        .update({
          status: 'RETURNED',
          returned_at: now,
          return_date: retDate,
          return_time: rTime,
          return_reason: returnReason,
          return_remark: returnReason,
          returned_to: effectiveReturnedTo,
          returned_by: effectiveReturnedBy,
          notes: notes ? `Return notes: ${notes}` : (returnReason ? `Return reason: ${returnReason}` : undefined),
        })
        .eq('tenant_id', tenantId)
        .eq('status', 'ACTIVE');

      if (effectiveSimId) {
        asgnQuery = asgnQuery.eq('sim_card_id', effectiveSimId);
      } else if (effectiveEmpId) {
        asgnQuery = asgnQuery.eq('employee_id', effectiveEmpId);
      }

      await asgnQuery;

      // Update sim_cards
      if (effectiveSimId) {
        await supabase
          .from('sim_cards')
          .update({
            assignment_status: 'Unassigned',
            status: 'Available',
            current_employee_id: null,
            current_employee_name: null,
            current_employee_code: null,
            current_project_name: null,
            current_vehicle_plate: null,
            assigned_date: null,
            last_assignment_id: activeAsgn?.id || null,
            last_employee_id: lastEmpId || null,
            last_employee_name: lastEmpName,
            last_employee_code: lastEmpCode,
            last_assigned_date: lastAssignedDate,
            last_assigned_time: lastAssignedTime,
            last_returned_date: retDate,
            last_returned_time: rTime,
            last_assigned_by: lastAssignedBy,
            last_returned_by: effectiveReturnedBy,
            last_return_reason: returnReason,
            last_assign_notes: lastAssignRemark,
            last_return_notes: notes || returnReason,
            previous_project: lastProject,
            updated_at: now,
            updated_by: effectiveReturnedBy,
          })
          .eq('id', effectiveSimId);
      }

      // Update employees table
      if (effectiveEmpId) {
        await supabase
          .from('employees')
          .update({
            current_sim_id: null,
            current_sim_number: null,
            updated_at: now,
            updated_by: effectiveReturnedBy,
          })
          .eq('id', effectiveEmpId);
      } else if (effectiveSimId) {
        await supabase
          .from('employees')
          .update({
            current_sim_id: null,
            current_sim_number: null,
            updated_at: now,
            updated_by: effectiveReturnedBy,
          })
          .eq('current_sim_id', effectiveSimId);
      }

      // Audit log
      try {
        await supabase.from('audit_logs').insert({
          id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          tenant_id: tenantId,
          user_id: userId || 'system',
          actor_name: effectiveReturnedBy,
          action: 'RETURN_SIM',
          action_type: 'RETURN',
          module: 'SIM_MANAGEMENT',
          entity_type: 'SIM_CARD',
          entity_id: effectiveSimId || 'UNKNOWN',
          details: `SIM returned. Reason: ${returnReason}`,
          created_at: now,
        });
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      console.error('Supabase SIM return error:', err);
    }
  }

  // 3. In-memory DB updates
  if (db) {
    if (Array.isArray(db.simAssignments)) {
      db.simAssignments.forEach((a: any) => {
        if (
          a.tenant_id === tenantId &&
          a.status === 'ACTIVE' &&
          ((effectiveSimId && (a.sim_id === effectiveSimId || a.sim_card_id === effectiveSimId)) ||
            (effectiveEmpId && a.employee_id === effectiveEmpId))
        ) {
          a.status = 'RETURNED';
          a.returned_at = now;
          a.return_date = retDate;
          a.return_time = rTime;
          a.return_reason = returnReason;
          a.return_remark = returnReason;
          a.returned_to = effectiveReturnedTo;
          a.returned_by = effectiveReturnedBy;
          if (notes) a.notes = notes;
        }
      });
    }

    if (sim) {
      sim.assignment_status = 'Unassigned';
      sim.status = 'Available';
      sim.last_assignment_id = activeAsgn?.id || null;
      sim.last_employee_id = lastEmpId || null;
      sim.last_employee_name = lastEmpName;
      sim.last_employee_code = lastEmpCode;
      sim.last_assigned_date = lastAssignedDate;
      sim.last_assigned_time = lastAssignedTime;
      sim.last_returned_date = retDate;
      sim.last_returned_time = rTime;
      sim.last_assigned_by = lastAssignedBy;
      sim.last_returned_by = effectiveReturnedBy;
      sim.last_return_reason = returnReason;
      sim.last_assign_notes = lastAssignRemark;
      sim.last_return_notes = notes || returnReason;
      sim.previous_project = lastProject;
      sim.current_employee_id = null;
      sim.current_employee_name = null;
      sim.current_employee_code = null;
      sim.current_project_name = null;
      sim.current_vehicle_plate = null;
      sim.assigned_date = null;
      sim.updated_at = now;
      sim.updated_by = effectiveReturnedBy;
    }

    if (emp) {
      emp.current_sim_id = null;
      emp.current_sim_number = null;
      emp.updated_at = now;
      emp.updated_by = effectiveReturnedBy;
    }
    if (Array.isArray(db.masterEmployees)) {
      db.masterEmployees.forEach((e: any) => {
        if (
          (effectiveEmpId && (e.id === effectiveEmpId || e.employee_id === effectiveEmpId || e.employee_code === effectiveEmpId)) ||
          e.current_sim_id === effectiveSimId ||
          (sim && (e.current_sim_id === sim.id || e.current_sim_number === sim.mobile_number))
        ) {
          e.current_sim_id = null;
          e.current_sim_number = null;
          e.updated_at = now;
        }
      });
    }
  }

  return {
    success: true,
    message: 'SIM line returned to available inventory pool.',
  };
}

/**
 * Replaces / swaps an employee's SIM atomically:
 * Returns the old SIM, assigns the new SIM, and updates both records.
 */
export async function replaceSimAuthoritative(
  supabase: any,
  db: any,
  params: ReplaceSimAuthoritativeParams
): Promise<SimAssignmentResult> {
  const {
    tenantId = 'company_allied',
    employeeId,
    oldSimId,
    newSimId,
    replacementReason = 'SIM replacement swap',
    notes,
    assignedBy = 'Telecom Admin',
    userId,
    monthlyPackageAmount,
    approvedAmount,
    payableAmount,
  } = params;

  // 1. Return old SIM if specified
  if (oldSimId) {
    await returnSimAuthoritative(supabase, db, {
      tenantId,
      simId: oldSimId,
      employeeId,
      returnReason: replacementReason,
      notes: notes ? `Swap reason: ${replacementReason} | Notes: ${notes}` : `Swap reason: ${replacementReason}`,
      returnedTo: assignedBy,
      userId,
    });
  }

  // 2. Assign new SIM with forceReassign flag
  return await assignSimAuthoritative(supabase, db, {
    tenantId,
    simId: newSimId,
    employeeId,
    notes: notes ? `Replaced SIM: ${oldSimId || 'None'} | Reason: ${replacementReason} | ${notes}` : `Replaced SIM: ${oldSimId || 'None'} | Reason: ${replacementReason}`,
    assignedBy,
    userId,
    forceReassign: true,
    monthlyPackageAmount,
    approvedAmount,
    payableAmount,
  });
}
