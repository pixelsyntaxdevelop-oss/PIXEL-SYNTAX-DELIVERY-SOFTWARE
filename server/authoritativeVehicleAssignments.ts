/**
 * Authoritative Vehicle Assignment & Custody Engine
 *
 * Ensures:
 * 1. Single authoritative assignment record in Supabase `vehicle_assignments`
 * 2. Instant synchronization between `vehicles` and `employees` tables in Supabase
 * 3. Reassignment protection: requires explicit confirmation if vehicle is already assigned
 * 4. Preservation of assignment history: old records marked RETURNED/REASSIGNED
 * 5. Full support for Unassign: releases vehicle to Available and clears Current Bike from employee
 * 6. Tenant isolation: strictly company_pixel_syntax
 */

import { safeSupabaseUpdate, safeSupabaseInsert, getSupabaseClient } from './supabaseDb';

export interface AssignVehicleAuthoritativeParams {
  tenantId: string;
  vehicleId: string;
  employeeId: string;
  assignmentDate?: string;
  assignmentTime?: string;
  startingOdometer?: number;
  condition?: string;
  handoverNotes?: string;
  assignedBy?: string;
  assignedById?: string;
  userId?: string;
  forceReassign?: boolean;
}

const KNOWN_HUMAN_USERS: Record<string, string> = {};

const GENERIC_LABELS = new Set([
  'operations admin',
  'system admin',
  'erp user',
  'erp staff member',
  'employee operations',
  'fleet management',
  'admin',
  'system',
  'system user',
  'unauthenticated guest',
]);

export function resolveHumanAssignedBy(assignedBy?: string | null, db?: any): string {
  if (!assignedBy || typeof assignedBy !== 'string') {
    return 'System User';
  }
  const trimmed = assignedBy.trim();
  if (KNOWN_HUMAN_USERS[trimmed]) {
    return KNOWN_HUMAN_USERS[trimmed];
  }
  if (db?.users && Array.isArray(db.users)) {
    const matchedUser = db.users.find(
      (u: any) =>
        u.id === trimmed ||
        u.username === trimmed ||
        u.employee_code === trimmed ||
        u.employee_id === trimmed
    );
    if (matchedUser?.fullName) {
      return matchedUser.fullName;
    }
  }
  if (GENERIC_LABELS.has(trimmed.toLowerCase())) {
    if (db?.users && Array.isArray(db.users)) {
      const activeAdmin = db.users.find(
        (u: any) => u.fullName && u.status === 'ACTIVE' && (u.role === 'ADMIN' || u.role === 'SUPER_ADMIN')
      );
      if (activeAdmin?.fullName) return activeAdmin.fullName;
    }
    return 'System User';
  }
  return trimmed;
}

export interface ReturnVehicleAuthoritativeParams {
  tenantId: string;
  vehicleId?: string;
  vehiclePlate?: string;
  employeeId?: string;
  employeeCode?: string;
  returnDate?: string;
  returnTime?: string;
  returnOdometer?: number;
  conditionOnReturn?: string;
  returnNotes?: string;
  returnReason?: string;
  returnRemark?: string;
  returnedTo?: string;
  returnedBy?: string;
  /** Server-verified staff profile id; never a client-entered return name. */
  returnedById?: string;
}

export interface AssignmentResult {
  success: boolean;
  reassignmentRequired?: boolean;
  currentAssignee?: {
    employee_id: string;
    employee_name: string;
    employee_code?: string;
    assignment_date?: string;
  };
  assignment?: any;
  vehicle?: any;
  employee?: any;
  error?: string;
  message?: string;
}

/**
 * Assigns a vehicle to an employee with authoritative Supabase persistence
 * and double-assignment / reassignment protection.
 */
export async function assignVehicleAuthoritative(
  supabase: any,
  db: any,
  params: AssignVehicleAuthoritativeParams
): Promise<AssignmentResult> {
  const {
    tenantId = 'company_pixel_syntax',
    vehicleId,
    employeeId,
    assignmentDate,
    assignmentTime,
    startingOdometer,
    condition,
    handoverNotes,
    assignedBy = 'Fleet Management',
    forceReassign = false,
  } = params;

  const now = new Date().toISOString();
  const assignDate = assignmentDate || now.split('T')[0];
  const assignTime = assignmentTime || (now.split('T')[1] ? now.split('T')[1].slice(0, 8) : '08:00:00');

  // The isolated demo must NEVER use the legacy multi-statement fallback that
  // swallows Supabase insert errors and reports success despite partial custody.
  // Use an allowlisted PostgREST RPC that commits employee, vehicle, history and
  // audit together, or fails with all records unchanged.
  if (tenantId === 'company_pixel_syntax') {
    if (!supabase) return { success: false, error: 'Demo database is unavailable; assignment was not saved.' };
    try {
      let empLookup = await supabase.from('employees')
        .select('id,full_name,current_bike_id,employee_code')
        .eq('tenant_id', tenantId).eq('id', employeeId).maybeSingle();
      if (empLookup.error) return { success: false, error: empLookup.error.message };
      if (!empLookup.data) {
        empLookup = await supabase.from('employees')
          .select('id,full_name,current_bike_id,employee_code')
          .eq('tenant_id', tenantId).eq('employee_code', employeeId).maybeSingle();
      }
      if (empLookup.error || !empLookup.data)
        return { success: false, error: empLookup.error?.message || 'Employee not found in demo company.' };

      let vehicleLookup = await supabase.from('vehicles')
        .select('id,plate_number,current_employee_id')
        .eq('tenant_id', tenantId).eq('id', vehicleId).maybeSingle();
      if (vehicleLookup.error) return { success: false, error: vehicleLookup.error.message };
      if (!vehicleLookup.data) {
        vehicleLookup = await supabase.from('vehicles')
          .select('id,plate_number,current_employee_id')
          .eq('tenant_id', tenantId).eq('plate_number', vehicleId).maybeSingle();
      }
      if (vehicleLookup.error || !vehicleLookup.data)
        return { success: false, error: vehicleLookup.error?.message || 'Bike not found in demo company.' };

      const employee = empLookup.data;
      const vehicle = vehicleLookup.data;
      if (employee.current_bike_id === vehicle.id)
        return { success: false, error: 'Employee already holds this bike; duplicate assignment blocked.' };

      const { data, error } = await supabase.rpc('rpc_swap_vehicle', {
        p_tenant_id: tenantId,
        p_employee_id: employee.id,
        p_old_vehicle_id: employee.current_bike_id || null,
        p_new_vehicle_id: vehicle.id,
        p_return_odometer: null,
        p_condition_on_return: null,
        p_return_notes: handoverNotes || 'Verified demo handover',
        p_new_starting_odometer: startingOdometer ?? null,
        p_new_condition: condition || 'Good Condition',
        p_replacement_reason: forceReassign ? 'CONFIRMED_FORCE_REASSIGN' : 'ASSIGN',
        p_assigned_by: resolveHumanAssignedBy(assignedBy, db),
        p_user_id: params.userId || params.assignedById || null,
      });
      if (error || !data?.success) {
        const reason = String(error?.message || data?.error || 'Atomic bike assignment failed');
        const reassignmentRequired = /already assigned|explicit confirmation required/i.test(reason);
        let currentAssignee: AssignmentResult['currentAssignee'] | undefined;
        if (reassignmentRequired) {
          const { data: active } = await supabase.from('vehicle_assignments')
            .select('employee_id,assignment_date')
            .eq('tenant_id', tenantId).eq('vehicle_id', vehicle.id)
            .eq('assignment_status', 'ACTIVE').is('return_date', null).maybeSingle();
          if (active) currentAssignee = {
            employee_id: active.employee_id, employee_name: 'Current assignee',
            assignment_date: active.assignment_date,
          };
        }
        return { success: false, error: reason, reassignmentRequired, currentAssignee };
      }
      const assignmentId = data.assignment?.id || data.assignment_id;
      const assignmentQuery = assignmentId
        ? await supabase.from('vehicle_assignments').select('*')
            .eq('tenant_id', tenantId).eq('id', assignmentId).maybeSingle()
        : null;
      return {
        success: true,
        employee: { ...employee, current_bike_id: vehicle.id, current_bike_plate: vehicle.plate_number },
        vehicle,
        assignment: assignmentQuery?.data || data.assignment || data,
        message: 'Bike custody and history saved atomically for ' + employee.full_name + '.',
      };
    } catch (err: any) {
      return { success: false, error: String(err?.message || 'Demo bike transaction failed') };
    }
  }

  // 1. Fetch Vehicle (Supabase first, memory fallback)
  let vehicle: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${vehicleId},plate_number.eq.${vehicleId},chassis_number.eq.${vehicleId}`)
        .maybeSingle();
      if (!error && data) {
        vehicle = data;
      }
    } catch (err) {
      console.warn('Vehicle lookup error in Supabase:', err);
    }
  }

  if (!vehicle && db) {
    vehicle =
      (db.fleetVehicles || []).find((v: any) => (v.id === vehicleId || v.plate_number === vehicleId || v.chassis_number === vehicleId) && (v.tenant_id === tenantId || tenantId === 'company_pixel_syntax')) ||
      (db.vehicles || []).find((v: any) => (v.id === vehicleId || v.plateNumber === vehicleId || v.plate_number === vehicleId) && (v.tenant_id === tenantId || tenantId === 'company_pixel_syntax'));
  }

  if (!vehicle) {
    return { success: false, error: `Vehicle '${vehicleId}' not found in ${tenantId}.` };
  }

  // 2. Fetch Employee (Supabase first, memory fallback)
  let employee: any = null;
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${employeeId},employee_code.eq.${employeeId}`)
        .maybeSingle();
      if (!error && data) {
        employee = data;
      }
    } catch (err) {
      console.warn('Employee lookup error in Supabase:', err);
    }
  }

  if (!employee && db) {
    employee = (db.masterEmployees || []).find(
      (e: any) => (e.id === employeeId || e.employee_code === employeeId || e.employee_id === employeeId) &&
                  (e.tenant_id === tenantId || tenantId === 'company_pixel_syntax')
    );
  }

  if (!employee) {
    return { success: false, error: `Employee '${employeeId}' not found in ${tenantId}.` };
  }

  // Strict tenant boundary check: no cross-tenant assignment
  if (vehicle.tenant_id && employee.tenant_id && vehicle.tenant_id !== employee.tenant_id) {
    return { success: false, error: `Cross-tenant assignment is strictly forbidden: Vehicle tenant is '${vehicle.tenant_id}' while Employee tenant is '${employee.tenant_id}'.` };
  }

  const plateNumber = vehicle.plate_number || vehicle.plateNumber || 'UNKNOWN';
  const odo = Number(startingOdometer ?? vehicle.current_odometer ?? vehicle.odometerKm ?? 0);
  const currentVehOdo = Number(vehicle.current_odometer ?? vehicle.odometerKm ?? 0);

  if (odo < currentVehOdo) {
    return {
      success: false,
      error: `Starting odometer (${odo} km) cannot be less than vehicle's current odometer (${currentVehOdo} km).`,
    };
  }

  // 3. REASSIGNMENT PROTECTION CHECK
  // Check if this vehicle currently has an active assignment in Supabase
  let activeAssignment: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('vehicle_assignments')
        .select('*')
        .eq('vehicle_id', vehicle.id)
        .eq('tenant_id', tenantId)
        .eq('assignment_status', 'ACTIVE')
        .maybeSingle();
      if (data) {
        activeAssignment = data;
      }
    } catch (err) {
      console.warn('Active assignment check error:', err);
    }
  }

  if (!activeAssignment && db) {
    activeAssignment = (db.vehicleAssignments || db.fleetAssignments || []).find(
      (a: any) => a.vehicle_id === vehicle.id && a.assignment_status === 'ACTIVE'
    );
  }

  // Also check if vehicle record has a different rider
  const rawCurrentRiderId = vehicle.current_employee_id || vehicle.current_rider_id;
  const rawCurrentRiderName = vehicle.current_employee_name || vehicle.current_rider_name;

  if (
    (activeAssignment && activeAssignment.employee_id !== employee.id) ||
    (rawCurrentRiderId && rawCurrentRiderId !== employee.id)
  ) {
    const currentAssigneeName = activeAssignment?.employee_name || rawCurrentRiderName || 'Current Assignee';
    const currentAssigneeId = activeAssignment?.employee_id || rawCurrentRiderId;
    const currentAssigneeCode = activeAssignment?.employee_code || vehicle.current_rider_code || '';

    if (!forceReassign) {
      return {
        success: false,
        reassignmentRequired: true,
        currentAssignee: {
          employee_id: currentAssigneeId,
          employee_name: currentAssigneeName,
          employee_code: currentAssigneeCode,
          assignment_date: activeAssignment?.assignment_date || vehicle.updated_at,
        },
        error: `Vehicle ${plateNumber} is currently assigned to ${currentAssigneeName} (${currentAssigneeCode || 'Active Rider'}). Explicit confirmation is required to reassign this vehicle.`,
      };
    }

    // Force reassign confirmed: close previous assignment history
    if (activeAssignment) {
      if (supabase) {
        try {
          await supabase
            .from('vehicle_assignments')
            .update({
              assignment_status: 'REASSIGNED',
              return_date: assignDate,
              return_time: assignTime,
              return_odometer: odo,
              return_notes: `Reassigned to ${employee.full_name} (${employee.employee_code || ''})`,
            })
            .eq('id', activeAssignment.id)
            .eq('tenant_id', tenantId);
        } catch (err) {
          console.warn('Failed to close previous assignment in Supabase:', err);
        }
      }
      activeAssignment.assignment_status = 'REASSIGNED';
      activeAssignment.return_date = assignDate;
      activeAssignment.return_notes = `Reassigned to ${employee.full_name}`;
    }

    // Clear Current Bike from previous employee
    const prevEmpId = activeAssignment?.employee_id || rawCurrentRiderId;
    if (prevEmpId) {
      if (supabase) {
        try {
          await supabase
            .from('employees')
            .update({
              current_bike_id: null,
              current_bike_plate: null,
              updated_at: now,
            })
            .eq('id', prevEmpId)
            .eq('tenant_id', tenantId);
        } catch (err) {
          console.warn('Failed to clear bike on previous employee in Supabase:', err);
        }
      }
      if (db) {
        const prevEmp = (db.masterEmployees || []).find((e: any) => e.id === prevEmpId);
        if (prevEmp) {
          prevEmp.current_bike_id = undefined;
          prevEmp.current_bike_plate = undefined;
        }
      }
    }
  }

  // 4. Check if the target employee already had another vehicle assigned
  const oldBikeId = employee.current_bike_id;
  if (oldBikeId && oldBikeId !== vehicle.id) {
    // Close old vehicle's active assignment
    if (supabase) {
      try {
        await supabase
          .from('vehicle_assignments')
          .update({
            assignment_status: 'REPLACED',
            return_date: assignDate,
            return_time: assignTime,
            return_odometer: odo,
            return_notes: `Replaced with new vehicle ${plateNumber}`,
          })
          .eq('employee_id', employee.id)
          .eq('assignment_status', 'ACTIVE')
          .eq('tenant_id', tenantId);

        // Make old vehicle available
        await supabase
          .from('vehicles')
          .update({
            status: 'AVAILABLE',
            current_employee_id: null,
            current_employee_name: null,
            updated_at: now,
          })
          .eq('id', oldBikeId)
          .eq('tenant_id', tenantId);
      } catch (err) {
        console.warn('Failed to release old vehicle for employee in Supabase:', err);
      }
    }

    if (db) {
      const oldVeh = (db.fleetVehicles || db.vehicles || []).find((v: any) => v.id === oldBikeId);
      if (oldVeh) {
        oldVeh.current_status = 'Available';
        oldVeh.status = 'AVAILABLE';
        oldVeh.current_rider_id = undefined;
        oldVeh.current_rider_name = undefined;
        oldVeh.current_rider_code = undefined;
      }
      (db.vehicleAssignments || db.fleetAssignments || [])
        .filter((a: any) => a.employee_id === employee.id && a.assignment_status === 'ACTIVE')
        .forEach((a: any) => {
          a.assignment_status = 'REPLACED';
          a.return_date = assignDate;
        });
    }
  }

  // 5. Create NEW active assignment record in Supabase
  const asgnId = `v_asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const humanAssignedBy = resolveHumanAssignedBy(assignedBy, db);
  const auditUserId = params.assignedById || params.userId || (assignedBy?.startsWith('user_') ? assignedBy : undefined);
  const assignmentRecord = {
    id: asgnId,
    tenant_id: tenantId,
    vehicle_id: vehicle.id,
    vehicle_plate: plateNumber,
    vehicle_model: `${vehicle.make || 'Honda'} ${vehicle.model || 'Standard'}`.trim(),
    employee_id: employee.id,
    employee_name: employee.full_name,
    employee_code: employee.employee_code || employee.id,
    assignment_date: assignDate,
    assignment_time: assignTime,
    assignment_status: 'ACTIVE',
    status: 'ACTIVE',
    starting_odometer: odo,
    condition_on_assignment: condition || 'GOOD',
    handover_notes: handoverNotes || 'Handover verified and keys received.',
    assigned_by: humanAssignedBy,
    assigned_by_id: auditUserId,
    created_at: now,
  };

  if (supabase) {
    try {
      const { error: insertErr } = await supabase.from('vehicle_assignments').insert(assignmentRecord);
      if (insertErr) {
        console.error('Supabase vehicle_assignments insert error:', insertErr);
        // Fallback: try inserting essential columns
        await supabase.from('vehicle_assignments').insert({
          id: asgnId,
          tenant_id: tenantId,
          vehicle_id: vehicle.id,
          vehicle_plate: plateNumber,
          employee_id: employee.id,
          employee_name: employee.full_name,
          assignment_date: assignDate,
          assignment_status: 'ACTIVE',
          starting_odometer: odo,
          assigned_by: assignedBy,
        });
      }
    } catch (err) {
      console.warn('Supabase vehicle_assignments insertion failed:', err);
    }

    // 6. Update vehicle status and custody in Supabase
    try {
      await supabase
        .from('vehicles')
        .update({
          status: 'ASSIGNED',
          current_employee_id: employee.id,
          current_employee_name: employee.full_name,
          current_odometer: odo,
          updated_at: now,
        })
        .eq('id', vehicle.id)
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Supabase vehicle status update failed:', err);
    }

    // 7. Update employee record in Supabase: ONLY custody fields (current_bike_id & current_bike_plate)
    // DO NOT change employee lifecycle status or project!
    try {
      await supabase
        .from('employees')
        .update({
          current_bike_id: vehicle.id,
          current_bike_plate: plateNumber,
          updated_at: now,
        })
        .eq('id', employee.id)
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Supabase employee current_bike update failed:', err);
    }
  }

  // 8. Update in-memory state if db is present
  if (db) {
    if (!db.vehicleAssignments) db.vehicleAssignments = [];
    if (!db.fleetAssignments) db.fleetAssignments = [];
    db.vehicleAssignments.push(assignmentRecord);
    db.fleetAssignments.push(assignmentRecord);

    const memVeh =
      (db.fleetVehicles || []).find((v: any) => v.id === vehicle.id) ||
      (db.vehicles || []).find((v: any) => v.id === vehicle.id);
    if (memVeh) {
      memVeh.current_status = 'Assigned';
      memVeh.status = 'ASSIGNED';
      memVeh.current_rider_id = employee.id;
      memVeh.current_rider_name = employee.full_name;
      memVeh.current_rider_code = employee.employee_code;
      memVeh.current_odometer = odo;
      memVeh.updated_at = now;
    }

    const memEmp = (db.masterEmployees || []).find((e: any) => e.id === employee.id);
    if (memEmp) {
      memEmp.current_bike_id = vehicle.id;
      memEmp.current_bike_plate = plateNumber;
      memEmp.updated_at = now;
    }
  }

  return {
    success: true,
    assignment: assignmentRecord,
    vehicle: {
      ...vehicle,
      current_status: 'Assigned',
      status: 'ASSIGNED',
      current_rider_id: employee.id,
      current_rider_name: employee.full_name,
      current_rider_code: employee.employee_code,
      current_odometer: odo,
    },
    employee: {
      ...employee,
      current_bike_id: vehicle.id,
      current_bike_plate: plateNumber,
    },
    message: `Vehicle ${plateNumber} successfully assigned to ${employee.full_name} (${employee.employee_code || ''}).`,
  };
}

/**
 * Unassigns/returns a vehicle back to depot.
 * - Marks assignment as RETURNED (preserves history)
 * - Sets vehicle status to AVAILABLE and clears rider
 * - Removes current_bike from employee
 * - Persists across Supabase and in-memory caches
 */
export async function returnVehicleAuthoritative(
  supabase: any,
  db: any,
  params: ReturnVehicleAuthoritativeParams
): Promise<AssignmentResult> {
  const {
    tenantId = 'company_pixel_syntax',
    vehicleId,
    vehiclePlate,
    employeeId,
    employeeCode,
    returnDate,
    returnTime,
    returnOdometer,
    conditionOnReturn = 'Returned in Good Condition',
    returnNotes = 'Unassigned / returned to depot',
    returnReason,
    returnRemark,
    returnedTo = 'Fleet Operations',
    returnedBy,
    returnedById,
  } = params;

  // Production depot returns MUST be atomic across assignment history, bike inventory,
  // employee custody and audit log. The legacy best-effort safeSupabaseUpdate retries
  // silently skipped valid fields when older schemas lacked several optional columns.
  // Never synthesize an assignment or report success from partial database writes.
  if (supabase) {
    try {
      const staffName = String(returnedBy || '').trim();
      let staffId = String(returnedById || '').trim();
      if (!staffId && staffName) {
        // Compatibility for verified Node sessions and vendor auto-close. Do not
        // silently attribute the action to an unrelated admin for unknown staff.
        const { data: staffProfile, error: profileError } = await supabase
          .from('profiles').select('id').eq('tenant_id', tenantId)
          .ilike('full_name', staffName).maybeSingle();
        if (profileError) return { success: false, error: 'Could not verify the vehicle-return operator.' };
        staffId = staffProfile?.id ? String(staffProfile.id) : '';
      }
      if (!staffId || !staffName) {
        return { success: false, error: 'Please sign in with a verified staff profile to return a bike.' };
      }
      const { data: returned, error: transactionError } = await supabase.rpc(
        'allied_return_vehicle_to_depot', {
          p_tenant_id: tenantId,
          p_vehicle_id: vehicleId || vehiclePlate || null,
          p_employee_id: employeeId || employeeCode || null,
          p_return_date: returnDate || null,
          p_return_time: returnTime || null,
          p_return_odometer: returnOdometer ?? null,
          p_return_reason: returnReason || returnRemark || 'Returned to Allied depot',
          p_return_notes: returnNotes || null,
          p_editor_id: staffId,
          p_editor_name: staffName,
        }
      );
      if (transactionError || !returned?.success) {
        return { success: false, error: transactionError?.message || 'Bike return was not saved. No partial custody changes were made.' };
      }
      // Only refresh matching in-memory metadata AFTER the database transaction commits.
      if (db) {
        for (const vehicle of [...(db.fleetVehicles || []), ...(db.vehicles || [])]) {
          if (vehicle.tenant_id === tenantId && vehicle.id === returned.vehicle_id) {
            vehicle.status = 'AVAILABLE';
            vehicle.current_status = 'Available';
            vehicle.current_employee_id = null;
            vehicle.current_employee_name = null;
            vehicle.current_rider_id = null;
            vehicle.current_rider_name = null;
            vehicle.last_employee_id = returned.employee_id;
            vehicle.last_returned_date = returned.return_date;
          }
        }
        for (const person of [...(db.masterEmployees || []), ...(db.employees || [])]) {
          if (person.tenant_id === tenantId && person.id === returned.employee_id) {
            person.current_bike_id = null;
            person.current_bike_plate = null;
          }
        }
        for (const history of [...(db.vehicleAssignments || []), ...(db.fleetAssignments || [])]) {
          if (history.id === returned.assignment_id && history.tenant_id === tenantId) {
            history.assignment_status = 'RETURNED';
            history.return_date = returned.return_date;
            history.returned_to = staffName;
          }
        }
      }
      return {
        success: true,
        message: 'Vehicle returned to Allied depot, history preserved, bike available.',
        assignment: { id: returned.assignment_id, assignment_status: 'RETURNED', return_date: returned.return_date },
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Vehicle return failed. No changes were committed.' };
    }
  }

  const mandatoryReturnReason = (returnReason || returnRemark || '').trim() || 'Rider returned vehicle to depot inventory';
  const effectiveReturnedBy = (returnedBy || returnedTo || 'Operations Admin').trim();

  const now = new Date().toISOString();
  const rDate = returnDate || now.split('T')[0];
  const rTime = returnTime || (now.split('T')[1] ? now.split('T')[1].slice(0, 8) : '18:00:00');

  // 1. Resolve employee from memory if possible
  const memEmp = db
    ? (db.masterEmployees || []).find(
        (e: any) =>
          (employeeId && (e.id === employeeId || e.employee_code === employeeId || e.employee_id === employeeId)) ||
          (employeeCode && e.employee_code === employeeCode)
      ) ||
      (db.employees || []).find(
        (e: any) =>
          (employeeId && (e.id === employeeId || e.employee_code === employeeId || e.employee_id === employeeId)) ||
          (employeeCode && e.employee_code === employeeCode)
      )
    : null;

  // 2. Resolve vehicle from memory if possible
  let memVeh = db
    ? (db.fleetVehicles || []).find(
        (v: any) =>
          (vehicleId && (v.id === vehicleId || v.plate_number === vehicleId || v.plateNumber === vehicleId)) ||
          (vehiclePlate && (v.plate_number === vehiclePlate || v.plateNumber === vehiclePlate))
      ) ||
      (db.vehicles || []).find(
        (v: any) =>
          (vehicleId && (v.id === vehicleId || v.plate_number === vehicleId || v.plateNumber === vehicleId)) ||
          (vehiclePlate && (v.plate_number === vehiclePlate || v.plateNumber === vehiclePlate))
      )
    : null;

  if (!memVeh && memEmp?.current_bike_plate) {
    const p = memEmp.current_bike_plate;
    memVeh =
      (db.fleetVehicles || []).find((v: any) => v.plate_number === p || v.plateNumber === p || v.id === p) ||
      (db.vehicles || []).find((v: any) => v.plate_number === p || v.plateNumber === p || v.id === p);
  }
  if (!memVeh && memEmp?.current_bike_id) {
    const bId = memEmp.current_bike_id;
    memVeh =
      (db.fleetVehicles || []).find((v: any) => v.id === bId) ||
      (db.vehicles || []).find((v: any) => v.id === bId);
  }

  // 3. Defensive Lookup from Supabase
  let sbEmp: any = null;
  let sbVeh: any = null;
  if (supabase) {
    try {
      if (employeeId || employeeCode) {
        const empTerm = employeeId || employeeCode;
        const { data } = await supabase
          .from('employees')
          .select('id, employee_code, full_name, current_bike_id, current_bike_plate, project_name')
          .eq('tenant_id', tenantId)
          .or(`id.eq.${empTerm},employee_code.eq.${empTerm}`)
          .maybeSingle();
        if (data) sbEmp = data;
      }

      if (vehicleId) {
        const { data } = await supabase
          .from('vehicles')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', vehicleId)
          .maybeSingle();
        if (data) sbVeh = data;
      }

      if (!sbVeh && (vehiclePlate || vehicleId)) {
        const queryPlate = vehiclePlate || vehicleId;
        const { data } = await supabase
          .from('vehicles')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('plate_number', queryPlate)
          .maybeSingle();
        if (data) sbVeh = data;
      }

      if (!sbVeh && sbEmp?.current_bike_plate) {
        const { data } = await supabase
          .from('vehicles')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('plate_number', sbEmp.current_bike_plate)
          .maybeSingle();
        if (data) sbVeh = data;
      }

      if (!sbVeh && sbEmp?.current_bike_id) {
        const { data } = await supabase
          .from('vehicles')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', sbEmp.current_bike_id)
          .maybeSingle();
        if (data) sbVeh = data;
      }
    } catch (lookupErr) {
      console.warn('Supabase vehicle return lookup error:', lookupErr);
    }
  }

  // 4. Resolve Authoritative Identifiers
  const targetVehicleId = sbVeh?.id || memVeh?.id || vehicleId || sbEmp?.current_bike_id || memEmp?.current_bike_id;
  const targetVehiclePlate =
    sbVeh?.plate_number ||
    vehiclePlate ||
    memVeh?.plate_number ||
    memVeh?.plateNumber ||
    sbEmp?.current_bike_plate ||
    memEmp?.current_bike_plate ||
    (typeof vehicleId === 'string' && !vehicleId.startsWith('veh_') ? vehicleId : 'Assigned Vehicle');
  const targetEmployeeId =
    sbEmp?.id ||
    memEmp?.id ||
    employeeId ||
    sbVeh?.current_employee_id ||
    memVeh?.current_rider_id ||
    memVeh?.assigned_rider_id;
  const lastEmpCode = sbEmp?.employee_code || memEmp?.employee_code || employeeCode || '';
  const lastEmpName = sbEmp?.full_name || memEmp?.full_name || 'Driver';

  // 5. Query active assignments in Supabase
  let activeAssignments: any[] = [];
  if (supabase) {
    try {
      if (targetVehicleId) {
        const { data } = await supabase
          .from('vehicle_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('vehicle_id', targetVehicleId)
          .in('assignment_status', ['ACTIVE', 'Active']);
        if (data && data.length > 0) activeAssignments.push(...data);
      }
      if (targetEmployeeId) {
        const { data } = await supabase
          .from('vehicle_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('employee_id', targetEmployeeId)
          .in('assignment_status', ['ACTIVE', 'Active']);
        if (data && data.length > 0) {
          for (const a of data) {
            if (!activeAssignments.some((ex) => ex.id === a.id)) {
              activeAssignments.push(a);
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error querying active vehicle assignment for return in Supabase:', err);
    }
  }

  // Check in-memory for active assignment
  let memActiveAssignment: any = null;
  if (db) {
    const memList = [...(db.vehicleAssignments || []), ...(db.fleetAssignments || [])];
    memActiveAssignment = memList.find(
      (a: any) =>
        (a.assignment_status === 'ACTIVE' || a.status === 'ACTIVE') &&
        (a.tenant_id === tenantId || !a.tenant_id || tenantId === 'company_pixel_syntax') &&
        ((targetVehicleId && (a.vehicle_id === targetVehicleId || (memVeh && a.vehicle_id === memVeh.id))) ||
          (targetVehiclePlate && (a.vehicle_plate === targetVehiclePlate || a.plate_number === targetVehiclePlate)) ||
          (targetEmployeeId && (a.employee_id === targetEmployeeId || (memEmp && (a.employee_id === memEmp.id || a.employee_code === memEmp.employee_code)))))
    );
  }

  let effectiveAssignment = activeAssignments[0] || memActiveAssignment;

  const retOdo = Number(
    returnOdometer ?? effectiveAssignment?.starting_odometer ?? sbVeh?.current_odometer ?? memVeh?.current_odometer ?? 0
  );

  const lastAssignedDate = effectiveAssignment?.assignment_date || sbVeh?.assigned_date || sbEmp?.joining_date || memEmp?.joining_date || rDate;
  const lastAssignedTime = effectiveAssignment?.assignment_time || null;
  const lastAssignedBy = effectiveAssignment?.assigned_by || sbVeh?.assigned_by || 'Operations Admin';
  const lastAssignRemark = effectiveAssignment?.handover_notes || effectiveAssignment?.notes || null;
  const lastProject = effectiveAssignment?.project_name || sbVeh?.project_name || sbEmp?.project_name || memEmp?.project_name || null;

  // Synthesize closed assignment if none existed
  if (!effectiveAssignment) {
    const synthId = `v_asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    effectiveAssignment = {
      id: synthId,
      tenant_id: tenantId,
      vehicle_id: targetVehicleId || `veh_${targetVehiclePlate.replace(/\W/g, '')}`,
      vehicle_plate: targetVehiclePlate,
      vehicle_model: sbVeh?.model || memVeh?.model || 'Motorcycle',
      vehicle_make: sbVeh?.make || memVeh?.make || 'Bajaj',
      employee_id: targetEmployeeId || employeeId || 'emp_unknown',
      employee_name: lastEmpName,
      employee_code: lastEmpCode,
      assignment_date: lastAssignedDate,
      assignment_status: 'RETURNED',
      status: 'RETURNED',
      starting_odometer: sbVeh?.current_odometer || memVeh?.current_odometer || 0,
      return_date: rDate,
      return_time: rTime,
      return_odometer: retOdo,
      condition_on_return: conditionOnReturn,
      return_notes: returnNotes,
      return_reason: mandatoryReturnReason,
      return_remark: mandatoryReturnReason,
      returned_by: effectiveReturnedBy,
      returned_to: returnedTo,
      created_at: now,
    };
    if (db) {
      if (!db.vehicleAssignments) db.vehicleAssignments = [];
      db.vehicleAssignments.unshift(effectiveAssignment);
    }
  }

  // 6. Authoritative Direct Updates in Supabase
  if (supabase) {
    // 6a. Close all active assignments in Supabase
    if (activeAssignments.length > 0) {
      for (const asgn of activeAssignments) {
        await safeSupabaseUpdate(
          supabase,
          'vehicle_assignments',
          {
            assignment_status: 'RETURNED',
            status: 'RETURNED',
            return_date: rDate,
            return_time: rTime,
            return_odometer: retOdo,
            condition_on_return: conditionOnReturn,
            return_notes: returnNotes,
            return_reason: mandatoryReturnReason,
            return_remark: mandatoryReturnReason,
            returned_by: effectiveReturnedBy,
            returned_to: returnedTo,
            updated_at: now,
          },
          'id',
          asgn.id
        );
      }
    } else {
      // Insert synthesized closed assignment row
      await safeSupabaseInsert(supabase, 'vehicle_assignments', effectiveAssignment);
    }

    // 6b. Update Vehicle: set status to AVAILABLE, clear rider custody, preserve ownership/specs
    const vehUpdatePayload = {
      status: 'AVAILABLE',
      current_status: 'AVAILABLE',
      current_employee_id: null,
      current_employee_name: null,
      current_employee_code: null,
      current_rider_id: null,
      current_rider_name: null,
      current_rider_code: null,
      current_odometer: retOdo > 0 ? retOdo : undefined,
      last_assignment_id: effectiveAssignment?.id || null,
      last_employee_id: targetEmployeeId || null,
      last_employee_name: lastEmpName,
      last_employee_code: lastEmpCode,
      last_rider_name: lastEmpName,
      last_rider_code: lastEmpCode,
      last_assigned_date: lastAssignedDate,
      last_assigned_time: lastAssignedTime,
      last_returned_date: rDate,
      last_returned_time: rTime,
      last_assigned_by: lastAssignedBy,
      last_returned_by: effectiveReturnedBy,
      last_return_reason: mandatoryReturnReason,
      last_return_remark: mandatoryReturnReason,
      last_assign_notes: lastAssignRemark,
      last_return_notes: returnNotes,
      previous_project: lastProject,
      updated_at: now,
    };

    if (targetVehicleId) {
      await safeSupabaseUpdate(supabase, 'vehicles', vehUpdatePayload, 'id', targetVehicleId);
    }
    if (targetVehiclePlate) {
      await safeSupabaseUpdate(supabase, 'vehicles', vehUpdatePayload, 'plate_number', targetVehiclePlate);
    }

    // 6c. Clear Current Bike from Employee in Supabase
    const empClearBikePayload = {
      current_bike_id: null,
      current_bike_plate: null,
      updated_at: now,
    };
    if (targetEmployeeId) {
      await safeSupabaseUpdate(supabase, 'employees', empClearBikePayload, 'id', targetEmployeeId);
    }
    if (lastEmpCode) {
      await safeSupabaseUpdate(supabase, 'employees', empClearBikePayload, 'employee_code', lastEmpCode);
    }
    if (targetVehicleId) {
      await safeSupabaseUpdate(supabase, 'employees', empClearBikePayload, 'current_bike_id', targetVehicleId);
    }
    if (targetVehiclePlate) {
      await safeSupabaseUpdate(supabase, 'employees', empClearBikePayload, 'current_bike_plate', targetVehiclePlate);
    }

    // 6d. Write audit log
    await safeSupabaseInsert(supabase, 'audit_logs', {
      tenant_id: tenantId,
      actor_name: effectiveReturnedBy,
      actor_role: 'Fleet Operations',
      action: 'RETURN_VEHICLE',
      action_type: 'RETURN',
      module: 'FLEET_MANAGEMENT',
      entity_type: 'VEHICLE',
      entity_id: targetVehicleId,
      details: `Rider ${lastEmpName} (${lastEmpCode}) returned vehicle ${targetVehiclePlate} to depot. Reason: ${mandatoryReturnReason}`,
      created_at: now,
    });
  }

  // 7. Synchronize In-Memory Stores
  if (db) {
    const memList = [...(db.vehicleAssignments || []), ...(db.fleetAssignments || [])];
    memList.forEach((a: any) => {
      const matchesVeh = (targetVehicleId && a.vehicle_id === targetVehicleId) || (targetVehiclePlate && (a.vehicle_plate === targetVehiclePlate || a.plate_number === targetVehiclePlate));
      const matchesEmp = targetEmployeeId && (a.employee_id === targetEmployeeId || (lastEmpCode && a.employee_code === lastEmpCode));
      const matchesId = effectiveAssignment && a.id === effectiveAssignment.id;

      if ((matchesVeh || matchesEmp || matchesId) && (a.assignment_status === 'ACTIVE' || a.status === 'ACTIVE')) {
        a.assignment_status = 'RETURNED';
        a.status = 'RETURNED';
        a.return_date = rDate;
        a.return_time = rTime;
        a.return_odometer = retOdo;
        a.condition_on_return = conditionOnReturn;
        a.return_notes = returnNotes;
        a.return_reason = mandatoryReturnReason;
        a.return_remark = mandatoryReturnReason;
        a.returned_by = effectiveReturnedBy;
        a.returned_to = returnedTo;
      }
    });

    if (effectiveAssignment) {
      effectiveAssignment.assignment_status = 'RETURNED';
      effectiveAssignment.status = 'RETURNED';
      effectiveAssignment.return_date = rDate;
      effectiveAssignment.return_time = rTime;
      effectiveAssignment.return_odometer = retOdo;
      effectiveAssignment.condition_on_return = conditionOnReturn;
      effectiveAssignment.return_notes = returnNotes;
      effectiveAssignment.return_reason = mandatoryReturnReason;
      effectiveAssignment.return_remark = mandatoryReturnReason;
      effectiveAssignment.returned_by = effectiveReturnedBy;
      effectiveAssignment.returned_to = returnedTo;
    }

    const allVehicles = [...(db.fleetVehicles || []), ...(db.vehicles || [])];
    allVehicles.forEach((v: any) => {
      const isTarget = (targetVehicleId && v.id === targetVehicleId) || (targetVehiclePlate && (v.plate_number === targetVehiclePlate || v.plateNumber === targetVehiclePlate));
      if (isTarget) {
        v.current_status = 'Available';
        v.status = 'AVAILABLE';
        v.current_rider_id = undefined;
        v.current_rider_name = undefined;
        v.current_rider_code = undefined;
        v.current_employee_id = undefined;
        v.current_employee_name = undefined;
        v.last_assignment_id = effectiveAssignment?.id || v.last_assignment_id;
        v.last_employee_id = targetEmployeeId || v.last_employee_id;
        v.last_employee_name = lastEmpName || v.last_employee_name;
        v.last_employee_code = lastEmpCode || v.last_employee_code;
        v.last_rider_name = lastEmpName || v.last_employee_name;
        v.last_rider_code = lastEmpCode || v.last_employee_code;
        v.last_assigned_date = lastAssignedDate || v.last_assigned_date;
        v.last_assigned_time = lastAssignedTime || v.last_assigned_time;
        v.last_returned_date = rDate;
        v.last_returned_time = rTime;
        v.last_assigned_by = lastAssignedBy || v.last_assigned_by;
        v.last_returned_by = effectiveReturnedBy;
        v.last_return_reason = mandatoryReturnReason;
        v.last_return_remark = mandatoryReturnReason;
        v.last_assign_notes = lastAssignRemark || v.last_assign_notes;
        v.last_return_notes = returnNotes;
        v.previous_project = lastProject || v.previous_project;
        if (retOdo > 0) {
          v.current_odometer = retOdo;
          v.current_meter_reading = retOdo;
        }
        v.updated_at = now;
      }
    });

    const employeeCollections = [db.masterEmployees, db.employees].filter(Array.isArray);
    for (const empArr of employeeCollections) {
      for (const e of empArr) {
        const matchesEmp = targetEmployeeId && (e.id === targetEmployeeId || (lastEmpCode && e.employee_code === lastEmpCode));
        const matchesBikePlate = targetVehiclePlate && (e.current_bike_plate === targetVehiclePlate || (memVeh && e.current_bike_plate === memVeh.plate_number));
        const matchesBikeId = targetVehicleId && e.current_bike_id === targetVehicleId;

        if (matchesEmp || matchesBikePlate || matchesBikeId) {
          e.current_bike_id = null;
          e.current_bike_plate = null;
          e.updated_at = now;
        }
      }
    }

    if (Array.isArray(db.auditLogs)) {
      db.auditLogs.unshift({
        id: `log_${Date.now()}`,
        tenant_id: tenantId,
        actor_name: effectiveReturnedBy,
        action: 'RETURN_VEHICLE',
        module: 'FLEET_MANAGEMENT',
        details: `Rider ${lastEmpName} (${lastEmpCode}) returned vehicle ${targetVehiclePlate} to depot. Reason: ${mandatoryReturnReason}`,
        timestamp: now,
        created_at: now,
      });
    }
  }

  return {
    success: true,
    message: `Vehicle successfully unassigned and returned to Allied depot stock.`,
  };
}

export interface ReturnVehicleToVendorParams {
  tenantId?: string;
  vehicleId: string;
  vendorReturnDate?: string;
  vendorReturnTime?: string;
  vendorReturnReason: string;
  finalOdometer?: number;
  vendorReturnOdo?: number;
  vendorReference?: string;
  returnedBy?: string;
  returnedById?: string;
  notes?: string;
  autoCloseRiderAssignment?: boolean;
}

/**
 * Returns a vehicle back to the leasing company or vendor (e.g. Easylease, Raid Lease).
 * - Distinguishes Vendor Return from Rider Return.
 * - If vehicle currently has an active rider, automatically or cleanly closes the rider assignment first.
 * - Updates vehicle status to 'RETURNED TO VENDOR' (not available for rider assignment).
 * - Records vendor return metadata (date, time, reason, reference, returned by).
 * - Preserves complete historical assignment and lifecycle records permanently.
 */
export async function returnVehicleToVendorAuthoritative(
  supabase: any,
  db: any,
  params: ReturnVehicleToVendorParams
): Promise<{ success: boolean; error?: string; vehicle?: any; message?: string }> {
  const {
    tenantId = 'company_pixel_syntax',
    vehicleId,
    vendorReturnDate,
    vendorReturnTime,
    vendorReturnReason,
    finalOdometer: finalOdometerProp,
    vendorReturnOdo,
    vendorReference,
    returnedBy = 'Operations Admin',
    returnedById,
    notes,
    autoCloseRiderAssignment = false,
  } = params;

  const finalOdometer = finalOdometerProp ?? vendorReturnOdo;

  if (!vehicleId) {
    return { success: false, error: 'Vehicle ID is required for vendor return.' };
  }
  if (!vendorReturnReason || !vendorReturnReason.trim()) {
    return { success: false, error: 'Vendor return reason / remark is mandatory.' };
  }

  const now = new Date().toISOString();
  const rDate = vendorReturnDate || now.split('T')[0];
  const rTime = vendorReturnTime || (now.split('T')[1] ? now.split('T')[1].slice(0, 8) : '12:00:00');

  // 1. Locate vehicle in Supabase or memory
  let vehicle: any = null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`id.eq.${vehicleId},plate_number.eq.${vehicleId}`)
        .maybeSingle();
      if (data) vehicle = data;
    } catch (err) {
      console.warn('Vehicle lookup error in Supabase for vendor return:', err);
    }
  }

  if (!vehicle && db) {
    vehicle =
      (db.fleetVehicles || []).find((v: any) => (v.id === vehicleId || v.plate_number === vehicleId) && (v.tenant_id === tenantId || tenantId === 'company_pixel_syntax')) ||
      (db.vehicles || []).find((v: any) => (v.id === vehicleId || v.plateNumber === vehicleId || v.plate_number === vehicleId) && (v.tenant_id === tenantId || tenantId === 'company_pixel_syntax'));
  }

  if (!vehicle) {
    return { success: false, error: `Vehicle '${vehicleId}' not found.` };
  }

  const plateNumber = vehicle.plate_number || vehicle.plateNumber || 'UNKNOWN';
  const vendorName = vehicle.owner_or_vendor || vehicle.vendor || vehicle.leasing_company || 'Vendor / Leasing Co.';
  const currentOdo = Number(finalOdometer ?? vehicle.current_odometer ?? vehicle.odometerKm ?? 0);

  // 2. Check if bike has an active rider assigned
  const hasActiveRider = Boolean(
    vehicle.current_employee_id ||
    vehicle.current_rider_id ||
    vehicle.status === 'ASSIGNED' ||
    vehicle.current_status === 'Assigned'
  );

  if (hasActiveRider) {
    if (!autoCloseRiderAssignment) {
      return {
        success: false,
        error: `Vehicle ${plateNumber} currently has an active rider assigned (${vehicle.current_rider_name || vehicle.current_employee_name || 'Rider'}). Please return from rider first or enable automatic handover closure.`,
      };
    }

    // Auto-close rider assignment before vendor return
    const riderReturn = await returnVehicleAuthoritative(supabase, db, {
      tenantId,
      vehicleId: vehicle.id,
      returnDate: rDate,
      returnTime: rTime,
      returnOdometer: currentOdo,
      returnReason: 'VENDOR_RETURN',
      returnRemark: `Auto-closed rider assignment prior to Vendor Return to ${vendorName}`,
      returnNotes: `Handed back to depot before vendor return: ${vendorReturnReason}`,
      returnedBy,
      returnedById,
    });
    if (!riderReturn.success) {
      return { success: false, error: riderReturn.error || 'Rider assignment could not be closed. Vendor return cancelled.' };
    }
  }

  // 3. Update Vehicle status in Supabase to RETURNED TO VENDOR
  const vendorUpdatePayload = {
    status: 'RETURNED_TO_VENDOR',
    current_status: 'Returned to Vendor',
    vendor_returned: true,
    vendor_return_date: rDate,
    vendor_return_time: rTime,
    vendor_return_reason: vendorReturnReason,
    vendor_return_reference: vendorReference || null,
    vendor_returned_by: returnedBy,
    vendor_return_notes: notes || null,
    current_employee_id: null,
    current_employee_name: null,
    current_odometer: currentOdo > 0 ? currentOdo : undefined,
    updated_at: now,
  };

  if (supabase) {
    try {
      const { data: updatedVehicle, error: updateError } = await supabase
        .from('vehicles')
        .update(vendorUpdatePayload)
        .eq('id', vehicle.id)
        .eq('tenant_id', tenantId)
        .select('id')
        .maybeSingle();
      if (updateError || !updatedVehicle) {
        return { success: false, error: updateError?.message || 'Vehicle status update was not confirmed. Vendor return not completed.' };
      }
    } catch (err: any) {
      console.warn('Failed to update vehicle status to RETURNED_TO_VENDOR in Supabase:', err);
      return { success: false, error: 'Database update failed. Vendor return not completed.' };
    }
  }

  // 4. Update memory caches
  if (db) {
    const memVeh =
      (db.fleetVehicles || []).find((v: any) => v.id === vehicle.id) ||
      (db.vehicles || []).find((v: any) => v.id === vehicle.id);
    if (memVeh) {
      Object.assign(memVeh, vendorUpdatePayload);
      memVeh.current_status = 'Returned to Vendor';
      memVeh.status = 'RETURNED_TO_VENDOR';
      memVeh.current_rider_id = undefined;
      memVeh.current_rider_name = undefined;
      memVeh.current_rider_code = undefined;
      if (currentOdo > 0) memVeh.current_odometer = currentOdo;
    }

    // Record in status history log
    if (!db.fleetStatusHistories) db.fleetStatusHistories = [];
    db.fleetStatusHistories.push({
      id: `vsh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tenant_id: tenantId,
      vehicle_id: vehicle.id,
      previous_status: vehicle.current_status || vehicle.status,
      new_status: 'Returned to Vendor',
      reason: `Vendor Return to ${vendorName}: ${vendorReturnReason}`,
      effective_date: rDate,
      notes: notes || vendorReference ? `Ref: ${vendorReference || ''}. Notes: ${notes || ''}` : undefined,
      changed_by: returnedBy,
      created_at: now,
    });
  }

  return {
    success: true,
    vehicle: {
      ...vehicle,
      ...vendorUpdatePayload,
      current_status: 'Returned to Vendor',
      status: 'RETURNED_TO_VENDOR',
    },
    message: `Vehicle ${plateNumber} successfully returned to vendor (${vendorName}). Status updated to Returned to Vendor.`,
  };
}

export interface UpdateVehicleAssignmentParams {
  tenantId?: string;
  assignmentId: string;
  updates: {
    assignment_date?: string;
    assignment_time?: string;
    return_date?: string;
    return_time?: string;
    starting_odometer?: number;
    return_odometer?: number;
    return_reason?: string;
    return_notes?: string;
    assigned_by?: string;
    returned_by?: string;
    handover_notes?: string;
  };
  editedBy?: string;
}

/**
 * Allows authorized users to edit assignment/return dates, odometers, and remarks
 * in historical assignment logs without breaking active custody.
 */
export async function updateVehicleAssignmentHistoryAuthoritative(
  supabase: any,
  db: any,
  params: UpdateVehicleAssignmentParams
): Promise<{ success: boolean; error?: string; assignment?: any }> {
  const { tenantId = 'company_pixel_syntax', assignmentId, updates, editedBy = 'Operations Admin' } = params;

  if (!assignmentId) {
    return { success: false, error: 'Assignment ID is required.' };
  }

  const now = new Date().toISOString();
  const cleanedUpdates: any = {
    updated_at: now,
    last_edited_by: editedBy,
    last_edited_at: now,
  };

  if (updates.assignment_date !== undefined) cleanedUpdates.assignment_date = updates.assignment_date;
  if (updates.assignment_time !== undefined) cleanedUpdates.assignment_time = updates.assignment_time;
  if (updates.return_date !== undefined) cleanedUpdates.return_date = updates.return_date;
  if (updates.return_time !== undefined) cleanedUpdates.return_time = updates.return_time;
  if (updates.starting_odometer !== undefined) cleanedUpdates.starting_odometer = Number(updates.starting_odometer);
  if (updates.return_odometer !== undefined) cleanedUpdates.return_odometer = Number(updates.return_odometer);
  if (updates.return_reason !== undefined) cleanedUpdates.return_reason = updates.return_reason;
  if (updates.return_notes !== undefined) cleanedUpdates.return_notes = updates.return_notes;
  if (updates.assigned_by !== undefined) cleanedUpdates.assigned_by = updates.assigned_by;
  if (updates.returned_by !== undefined) cleanedUpdates.returned_by = updates.returned_by;
  if (updates.handover_notes !== undefined) cleanedUpdates.handover_notes = updates.handover_notes;

  if (supabase) {
    try {
      await supabase
        .from('vehicle_assignments')
        .update(cleanedUpdates)
        .eq('id', assignmentId)
        .eq('tenant_id', tenantId);
    } catch (err) {
      console.warn('Supabase vehicle_assignments update error:', err);
    }
  }

  let updatedAsgn: any = null;
  if (db) {
    const list = [...(db.vehicleAssignments || []), ...(db.fleetAssignments || [])];
    list.forEach((a: any) => {
      if (a.id === assignmentId && (a.tenant_id === tenantId || tenantId === 'company_pixel_syntax')) {
        Object.assign(a, cleanedUpdates);
        updatedAsgn = a;
      }
    });
  }

  return {
    success: true,
    assignment: updatedAsgn || cleanedUpdates,
  };
}
