/**
 * Authoritative Vehicle & Fleet Data Loader and Normalizer
 * Directly interfaces with the Supabase `vehicles` table for `company_allied`.
 * Ensures live Vehicle Management reflects all persisted vehicles and supports
 * full search across Plate Number, Chassis Number, TC Number, Registration Number, and Status.
 */

import { DbVehicleMasterEnhanced, FleetSummaryKpis, VehicleOperationalStatus } from '../src/types/fleet';

export function cleanChassisNumber(raw: any): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toUpperCase();
  if (
    !str ||
    str === 'N/A' ||
    str === 'NA' ||
    str === 'NULL' ||
    str === 'NONE' ||
    str === '-' ||
    str === '--' ||
    str === 'TBD' ||
    str === 'UNKNOWN' ||
    str.length < 5
  ) {
    return null;
  }
  return str;
}

/**
 * Normalizes any Supabase raw vehicle record into the standard DbVehicleMasterEnhanced format.
 */
export function normalizeVehicleFromSupabase(v: any, activeAssignment?: any, lastAssignment?: any): DbVehicleMasterEnhanced {
  // Normalize Operational Status
  let uiStatus: VehicleOperationalStatus = 'Available';
  const rawStatus = String(v.status || v.current_status || '').toUpperCase().trim();
  const rawRiderId = activeAssignment?.employee_id || v.current_rider_id || v.current_employee_id || null;
  const rawRiderName = activeAssignment?.employee_name || v.current_rider_name || v.current_employee_name || null;
  const rawRiderCode = activeAssignment?.employee_code || v.current_rider_code || v.current_employee_code || null;

  // An existing RETURNED handover is authoritative over stale "ASSIGNED"
  // status / rider metadata when no later active handover exists. Never
  // auto-release a different rider or a newer vehicle update.
  const returnedToDepot = !activeAssignment
    && String(lastAssignment?.assignment_status || '').toUpperCase() === 'RETURNED'
    && Boolean(lastAssignment?.return_date)
    && (!v.current_employee_id || String(v.current_employee_id) === String(lastAssignment?.employee_id))
    // Verify the old rider no longer has this bike in their live employee record.
    // updated_at may change later when staff edit a bike's location; that is NOT a new handover.
    && v._last_return_holder_released === true;
  if (activeAssignment) {
    uiStatus = 'Assigned';
  } else if (v.vendor_returned === true ||
    ['RETURNED_TO_VENDOR', 'RETURNED TO VENDOR'].includes(rawStatus)) {
    uiStatus = 'Returned to Vendor';
  } else if (
    rawStatus === 'MAINTENANCE' ||
    rawStatus === 'IN_MAINTENANCE' ||
    rawStatus === 'IN MAINTENANCE' ||
    rawStatus === 'REPAIR' ||
    rawStatus === 'IN GARAGE'
  ) {
    uiStatus = 'In Maintenance';
  } else if (
    rawStatus === 'OUT_OF_SERVICE' ||
    rawStatus === 'OUT OF SERVICE' ||
    rawStatus === 'DECOMMISSIONED' ||
    rawStatus === 'SOLD'
  ) {
    uiStatus = 'Out of Service';
  } else if (rawStatus === 'ACCIDENT') {
    uiStatus = 'Accident';
  } else if (rawStatus === 'INACTIVE') {
    uiStatus = 'Inactive';
  } else if (rawStatus === 'RESERVED') {
    uiStatus = 'Reserved';
  } else if (returnedToDepot || ['AVAILABLE', 'RETURNED'].includes(rawStatus)) {
    // Employee-to-depot RETURNED and vendor RETURNED_TO_VENDOR are distinct.
    uiStatus = 'Available';
  } else if (rawStatus === 'ASSIGNED' || rawRiderId || rawRiderName) {
    // No verified return: preserve custody instead of making an at-risk bike available.
    uiStatus = 'Assigned';
  } else {
    uiStatus = 'Available';
  }

  // If status is not assigned, clear ghost rider references
  const finalRiderId = uiStatus === 'Assigned' ? rawRiderId : null;
  const finalRiderName = uiStatus === 'Assigned' ? rawRiderName : null;
  const finalRiderCode = uiStatus === 'Assigned' ? rawRiderCode : null;

  // Branch mapping
  let branchName = v.branch_name || '';
  const branchId = v.branch_id || v.branchId || 'b_dxb';
  if (!branchName) {
    if (branchId === 'b_dxb') branchName = 'Dubai Central Operations';
    else if (branchId === 'b_auh') branchName = 'Abu Dhabi Operations Branch';
    else if (branchId === 'b_shj') branchName = 'Sharjah & Northern Emirates Hub';
    else branchName = 'Dubai Central Operations';
  }

  const plateNumber = String(v.plate_number || v.plateNumber || '').trim();
  const plateCode = v.plate_code || v.plateCode || 'T';
  const plateEmirate = v.plate_emirate || v.plateEmirate || 'Dubai';
  const chassis = v.chassis_number || v.vin || '';
  const tcNumber = v.tc_number || v.traffic_code || v.engine_number || '';
  const regNumber = v.registration_number || v.mulkiya_number || v.mulkiyaNumber || '';

  return {
    id: String(v.id || `veh_${plateNumber}_${Date.now()}`),
    tenant_id: v.tenant_id || 'company_allied',
    vehicle_code: v.vehicle_code || v.vehicle_id || `VH-${plateNumber || '1001'}`,
    vehicle_type: v.vehicle_type || v.type || 'Motorcycle',
    plate_number: plateNumber,
    plate_code: plateCode,
    plate_emirate: plateEmirate,
    location_state: v.location_state || null,
    make: v.make || 'Honda',
    model: v.model || 'Standard',
    year: Number(v.year || v.model_year) || 2024,
    color: v.color || 'White',
    chassis_number: chassis,
    tc_number: tcNumber,
    traffic_file_number: v.traffic_file_number || tcNumber,
    engine_number: v.engine_number || tcNumber,
    registration_number: regNumber,
    registration_expiry: v.registration_expiry || v.mulkiya_expiry || v.mulkiyaExpiry || '',
    insurance_company: v.insurance_company || v.insuranceCompany || v.owner_or_vendor || 'Allied Delivery Services L.L.C',
    insurance_number: v.insurance_policy_number || v.insurance_number || v.insurancePolicyNumber || '',
    insurance_expiry: v.insurance_expiry || v.insuranceExpiry || '',
    ownership_type: v.ownership_type || v.ownershipType || 'OWNED',
    owner_or_vendor: v.owner_or_vendor || v.insurance_company || v.vendor_name || 'Allied Delivery Services L.L.C',
    current_odometer: Number(v.current_odometer || v.odometer_km || v.odometerKm) || 0,
    fuel_type: v.fuel_type || 'PETROL_95',
    branch_id: branchId,
    branch_name: branchName,
    project_id: v.project_id || v.projectId || null,
    project_name: v.project_name || v.projectName || null,
    current_status: uiStatus,
    status_reason: v.status_reason || null,
    current_rider_id: finalRiderId,
    current_rider_name: finalRiderName,
    current_rider_code: finalRiderCode,
    last_assignment_id: lastAssignment?.id || v.last_assignment_id || null,
    last_employee_id: lastAssignment?.employee_id || v.last_employee_id || null,
    last_employee_name: lastAssignment?.employee_name || v.last_employee_name || null,
    last_rider_name: lastAssignment?.employee_name || v.last_rider_name || v.last_employee_name || null,
    last_employee_code: lastAssignment?.employee_code || v.last_employee_code || null,
    last_rider_code: lastAssignment?.employee_code || v.last_rider_code || v.last_employee_code || null,
    last_assigned_date: lastAssignment?.assignment_date || v.last_assigned_date || null,
    last_assigned_time: lastAssignment?.assignment_time || v.last_assigned_time || null,
    last_returned_date: lastAssignment?.return_date || v.last_returned_date || null,
    last_returned_time: lastAssignment?.return_time || v.last_returned_time || null,
    last_assigned_by: lastAssignment?.assigned_by || v.last_assigned_by || null,
    last_returned_by: lastAssignment?.returned_by || lastAssignment?.returned_to || v.last_returned_by || null,
    last_return_reason: lastAssignment?.return_reason || lastAssignment?.reason || v.last_return_reason || null,
    last_assign_notes: lastAssignment?.handover_notes || lastAssignment?.notes || v.last_assign_notes || null,
    last_return_notes: lastAssignment?.return_notes || v.last_return_notes || null,
    previous_project: lastAssignment?.project_name || v.previous_project || null,
    gps_device_id: v.gps_device_id || v.gpsDeviceId || null,
    fuel_card_number: v.fuel_card_number || null,
    last_service_date: v.last_service_date || null,
    next_service_due_km: v.next_service_due_km || null,
    notes: v.notes || null,
    created_at: v.created_at || new Date().toISOString(),
    updated_at: v.updated_at || new Date().toISOString(),
  };
}

/**
 * Filter and Search vehicles across all operational dimensions:
 * Mandatory search fields:
 * - Plate Number
 * - Chassis Number
 * - TC Number
 * - Registration Number
 * Plus make, model, rider, code, vendor.
 */
const getVehicleReportingState = (vehicle: DbVehicleMasterEnhanced): string =>
  String(vehicle.location_state || '').trim() || 'Not set';

export function filterAndSearchVehicles(
  vehicles: DbVehicleMasterEnhanced[],
  filters: {
    branch?: string;
    project?: string;
    status?: string;
    type?: string;
    ownership?: string;
    vendor?: string;
    state?: string;
    emirate?: string;
    maintenanceDue?: string;
    expiryAlert?: string;
    q?: string;
  }
): DbVehicleMasterEnhanced[] {
  let result = vehicles;

  // 1. Branch Filter
  if (filters.branch && filters.branch !== 'All Branches' && filters.branch !== 'All' && filters.branch !== 'ALL') {
    result = result.filter(
      (v) => v.branch_id === filters.branch || v.branch_name === filters.branch
    );
  }

  // 2. Project Filter
  if (filters.project && filters.project !== 'All Projects' && filters.project !== 'All' && filters.project !== 'ALL') {
    result = result.filter(
      (v) => v.project_id === filters.project || v.project_name === filters.project
    );
  }

  // 3. Status Filter (Active, Maintenance, Available, etc.)
  if (filters.status && filters.status !== 'All Statuses' && filters.status !== 'All' && filters.status !== 'ALL') {
    const s = filters.status.toLowerCase().trim();
    if (s === 'available') {
      // Available is depot stock only: never include assigned or vendor-returned bikes.
      result = result.filter((v) => v.current_status === 'Available' && !v.current_rider_id);
    } else if (s === 'active') {
      result = result.filter((v) =>
        ['available', 'assigned', 'active'].includes((v.current_status || '').toLowerCase())
      );
    } else if (s === 'in maintenance' || s === 'in garage' || s === 'in garage / maintenance' || s === 'maintenance') {
      result = result.filter((v) =>
        ['in maintenance', 'in garage', 'in garage / maintenance', 'repair'].includes(
          (v.current_status || '').toLowerCase()
        )
      );
    } else if (s === 'assigned') {
      result = result.filter((v) => (v.current_status || '').toLowerCase() === 'assigned' || Boolean(v.current_rider_id));
    } else if (s === 'returned to vendor' || s === 'returned') {
      result = result.filter((v) =>
        ['returned to vendor', 'returned'].includes((v.current_status || '').toLowerCase())
      );
    } else if (s === 'out of service') {
      result = result.filter((v) =>
        ['out of service', 'decommissioned', 'sold'].includes((v.current_status || '').toLowerCase())
      );
    } else {
      result = result.filter((v) => (v.current_status || '').toLowerCase() === s);
    }
  }

  // 4. Vendor Filter
  if (filters.vendor && filters.vendor !== 'All' && filters.vendor !== 'ALL') {
    const targetVendor = filters.vendor.toLowerCase().trim();
    result = result.filter((v) => (v.owner_or_vendor || '').toLowerCase() === targetVendor);
  }

  // 5. Reporting State is the saved operational location, never the plate emirate.
  const targetState = (filters.state || filters.emirate || '').toLowerCase().trim();
  if (targetState && targetState !== 'all') {
    result = result.filter((v) => getVehicleReportingState(v).toLowerCase() === targetState);
  }

  // 6. Type Filter
  if (filters.type && filters.type !== 'All Types' && filters.type !== 'All' && filters.type !== 'ALL') {
    result = result.filter(
      (v) => (v.vehicle_type || '').toLowerCase() === filters.type!.toLowerCase()
    );
  }

  // 7. Ownership Filter
  if (filters.ownership && filters.ownership !== 'All Ownership' && filters.ownership !== 'All' && filters.ownership !== 'ALL') {
    result = result.filter(
      (v) => (v.ownership_type || '').toLowerCase() === filters.ownership!.toLowerCase()
    );
  }

  // 8. Maintenance Due Filter
  if (filters.maintenanceDue && filters.maintenanceDue === 'Due Soon') {
    result = result.filter((v) => v.next_service_due_km && v.current_odometer >= v.next_service_due_km - 500);
  } else if (filters.maintenanceDue && filters.maintenanceDue === 'Overdue') {
    result = result.filter((v) => v.next_service_due_km && v.current_odometer >= v.next_service_due_km);
  }

  // 9. Expiry Alert Filter
  if (filters.expiryAlert && (filters.expiryAlert === 'Mulkiya Expiring' || filters.expiryAlert === 'Expiring Soon')) {
    const now = new Date();
    result = result.filter((v) => {
      if (!v.registration_expiry) return false;
      const exp = new Date(v.registration_expiry);
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
      return diffDays <= 30;
    });
  }

  // 10. Multi-field Search:
  // Strictly support search by:
  // * Plate Number
  // * Chassis Number
  // * TC Number
  // * Registration Number
  // Plus Make, Model, Code, Rider, and Vendor.
  if (filters.q && typeof filters.q === 'string' && filters.q.trim()) {
    const term = filters.q.toLowerCase().trim();
    result = result.filter((v) => {
      const plate = (v.plate_number || '').toLowerCase();
      const chassis = (v.chassis_number || '').toLowerCase();
      const tc = (v.tc_number || v.engine_number || '').toLowerCase();
      const reg = (v.registration_number || '').toLowerCase();
      const make = (v.make || '').toLowerCase();
      const model = (v.model || '').toLowerCase();
      const code = (v.vehicle_code || '').toLowerCase();
      const rider = (v.current_rider_name || '').toLowerCase();
      const riderCode = (v.current_rider_code || '').toLowerCase();
      const vendor = (v.owner_or_vendor || '').toLowerCase();

      return (
        plate.includes(term) ||
        chassis.includes(term) ||
        tc.includes(term) ||
        reg.includes(term) ||
        make.includes(term) ||
        model.includes(term) ||
        code.includes(term) ||
        rider.includes(term) ||
        riderCode.includes(term) ||
        vendor.includes(term)
      );
    });
  }

  return result;
}

/**
 * Calculates real-time Fleet KPIs reflecting all authoritative vehicles
 */
export function calculateFleetKpis(vehicles: DbVehicleMasterEnhanced[], otherData?: any): FleetSummaryKpis {
  const total = vehicles.length;
  const available = vehicles.filter((v) => v.current_status === 'Available').length;
  const assigned = vehicles.filter((v) => v.current_status === 'Assigned' || Boolean(v.current_rider_id)).length;
  const inMaintenance = vehicles.filter((v) =>
    ['In Maintenance', 'In Garage', 'In Garage / Maintenance', 'Repair'].includes(v.current_status)
  ).length;
  const returnedToVendor = vehicles.filter((v) =>
    ['Returned to Vendor', 'Returned'].includes(v.current_status)
  ).length;
  const outOfService = vehicles.filter((v) =>
    ['Out of Service', 'Decommissioned', 'Sold'].includes(v.current_status)
  ).length;
  const accident = vehicles.filter((v) => v.current_status === 'Accident').length;
  const inactive = vehicles.filter((v) => v.current_status === 'Inactive').length;
  const utilization = total > 0 ? Math.round((assigned / total) * 100) : 0;

  const vendorBreakdown: Record<string, number> = {};
  const stateBreakdown: Record<string, number> = {};
  const vendorBreakdownDetailed: Record<string, { total: number; assigned: number; available: number; maintenance: number }> = {};
  const stateBreakdownDetailed: Record<string, { total: number; assigned: number; available: number; maintenance: number }> = {};

  const now = new Date();
  let mulkiyaExpiring = 0;
  let insuranceExpiring = 0;
  let maintDue = 0;

  vehicles.forEach((v) => {
    const vendor = v.owner_or_vendor || 'Other';
    vendorBreakdown[vendor] = (vendorBreakdown[vendor] || 0) + 1;
    if (!vendorBreakdownDetailed[vendor]) vendorBreakdownDetailed[vendor] = { total: 0, assigned: 0, available: 0, maintenance: 0 };
    vendorBreakdownDetailed[vendor].total++;
    if (v.current_status === 'Assigned') vendorBreakdownDetailed[vendor].assigned++;
    else if (v.current_status === 'Available') vendorBreakdownDetailed[vendor].available++;
    else if (v.current_status === 'In Maintenance') vendorBreakdownDetailed[vendor].maintenance++;

    const reportingState = getVehicleReportingState(v);
    stateBreakdown[reportingState] = (stateBreakdown[reportingState] || 0) + 1;
    if (!stateBreakdownDetailed[reportingState]) stateBreakdownDetailed[reportingState] = { total: 0, assigned: 0, available: 0, maintenance: 0 };
    stateBreakdownDetailed[reportingState].total++;
    if (v.current_status === 'Assigned') stateBreakdownDetailed[reportingState].assigned++;
    else if (v.current_status === 'Available') stateBreakdownDetailed[reportingState].available++;
    else if (v.current_status === 'In Maintenance') stateBreakdownDetailed[reportingState].maintenance++;

    if (v.registration_expiry) {
      const exp = new Date(v.registration_expiry);
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (diffDays <= 30) mulkiyaExpiring++;
    }
    if (v.insurance_expiry) {
      const exp = new Date(v.insurance_expiry);
      const diffDays = (exp.getTime() - now.getTime()) / (1000 * 3600 * 24);
      if (diffDays <= 30) insuranceExpiring++;
    }
    if (v.next_service_due_km && v.current_odometer >= v.next_service_due_km - 500) {
      maintDue++;
    }
  });

  return {
    totalVehicles: total,
    availableVehicles: available,
    assignedVehicles: assigned,
    inMaintenanceVehicles: inMaintenance,
    returnedToVendorVehicles: returnedToVendor,
    outOfServiceVehicles: outOfService,
    accidentVehicles: accident,
    inactiveVehicles: inactive,
    utilizationRate: utilization,
    mulkiyaExpiringCount: mulkiyaExpiring,
    insuranceExpiringCount: insuranceExpiring,
    maintenanceDueCount: maintDue,
    openAccidentsCount: otherData?.openAccidentsCount || 0,
    unpaidFinesCount: otherData?.unpaidFinesCount || 0,
    totalMonthlySpendAED: otherData?.totalMonthlySpendAED || 0,
    vendorBreakdown,
    stateBreakdown,
    vendorBreakdownDetailed,
    stateBreakdownDetailed,
  };
}

/**
 * Authoritative Supabase Vehicle Loader.
 * Fetches all persisted company_allied vehicles directly from Supabase `vehicles` table.
 * Never falls back to empty when Supabase has records.
 */
export async function fetchAuthoritativeVehicles(
  supabase: any,
  db?: any,
  tenantId: string = 'company_allied'
): Promise<DbVehicleMasterEnhanced[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!error && Array.isArray(data) && data.length > 0) {
        // Query all assignments from vehicle_assignments to preserve active and last history
        let allAssignments: any[] = [];
        try {
          const { data: asgns, error: assignmentReadError } = await supabase
            .from('vehicle_assignments')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          if (assignmentReadError) throw new Error('Cannot verify vehicle custody history: ' + assignmentReadError.message);
          if (Array.isArray(asgns)) allAssignments = asgns;
        } catch (err) {
          // Stale vehicle.status cannot be trusted if history is unavailable.
          // Do not show bikes as available when their actual custody is unknown.
          throw err;
        }

        const activeMap = new Map<string, any>();
        const lastAsgnMap = new Map<string, any>();

        for (const a of allAssignments) {
          const vKeyId = a.vehicle_id;
          // Never match two bikes by their shared number plate.
          if (!vKeyId) continue;
          if (a.assignment_status === 'ACTIVE') {
            if (!activeMap.has(vKeyId)) activeMap.set(vKeyId, a);
          } else {
            if (!lastAsgnMap.has(vKeyId)) lastAsgnMap.set(vKeyId, a);
          }
        }

        // Resolve current riders from the authoritative employee registry, not
        // stale or empty display names stored on vehicle assignment rows.
        const assignedEmployeeIds = [...new Set(data.flatMap((v: any) => {
          const assignment = activeMap.get(v.id);
          const last = lastAsgnMap.get(v.id);
          return [assignment?.employee_id,v.current_employee_id,last?.employee_id]
            .filter(Boolean).map(String);
        }))];
        const employeeById = new Map<string, any>();
        if (assignedEmployeeIds.length > 0) {
          const { data: employees, error: employeeError } = await supabase
            .from('employees')
            .select('id,employee_code,full_name,first_name,last_name,current_bike_id,current_bike_plate')
            .eq('tenant_id', tenantId)
            .in('id', assignedEmployeeIds);
          if (employeeError) {
            console.warn('Could not resolve current vehicle rider names:', employeeError.message);
          } else {
            for (const employee of employees || []) employeeById.set(String(employee.id), employee);
          }
        }

        const normalized = data.map((v) => {
          const activeAsgn = activeMap.get(v.id);
          const lastAsgn = lastAsgnMap.get(v.id);
          const employeeId = activeAsgn?.employee_id || v.current_employee_id;
          const employee = employeeId ? employeeById.get(String(employeeId)) : null;
          const resolvedName = employee?.full_name || [employee?.first_name, employee?.last_name].filter(Boolean).join(' ');
          const resolvedAssignment = activeAsgn && employee
            ? { ...activeAsgn, employee_name: resolvedName || activeAsgn.employee_name, employee_code: employee.employee_code || activeAsgn.employee_code }
            : activeAsgn;
          const lastHolder = lastAsgn?.employee_id ? employeeById.get(String(lastAsgn.employee_id)) : null;
          const stillHoldsThisBike = Boolean(lastHolder && (
            String(lastHolder.current_bike_id || '') === String(v.id) ||
            (!lastHolder.current_bike_id && String(lastHolder.current_bike_plate || '') === String(v.plate_number))
          ));
          const resolvedVehicle = {
            ...v,
            _last_return_holder_released: Boolean(lastHolder) && !stillHoldsThisBike,
            ...(employee ? { current_employee_name: resolvedName || v.current_employee_name,
              current_employee_code: employee.employee_code || v.current_employee_code } : {}),
          };
          return normalizeVehicleFromSupabase(resolvedVehicle, resolvedAssignment, lastAsgn);
        });

        // Sync to in-memory db so synchronous fallbacks also contain the 85+ vehicles
        if (db) {
          db.fleetVehicles = normalized;
          db.vehicles = normalized.map((v) => ({
            id: v.id,
            tenant_id: v.tenant_id,
            plateNumber: v.plate_number,
            model: v.model,
            make: v.make,
            year: v.year,
            type: v.vehicle_type,
            status: v.current_status === 'Available' ? 'AVAILABLE' : v.current_status.toUpperCase(),
            branchId: v.branch_id,
            odometerKm: v.current_odometer,
            fuelLevelPercent: 100,
            mulkiyaNumber: v.registration_number,
            mulkiyaExpiry: v.registration_expiry,
            insuranceCompany: v.insurance_company,
            insurancePolicyNumber: v.insurance_number,
            insuranceExpiry: v.insurance_expiry,
            chassisNumber: v.chassis_number,
            tcNumber: v.tc_number,
            registrationNumber: v.registration_number,
          }));
        }

        return normalized;
      }
    } catch (err) {
      console.warn('Could not fetch authoritative vehicle custody:', err);
      if (!db) throw err;
    }
  }

  // In-memory fallback if Supabase is unavailable
  if (db && Array.isArray(db.fleetVehicles) && db.fleetVehicles.length > 0) {
    const assignments = [...(db.fleetAssignments || []), ...(db.vehicleAssignments || [])];
    return db.fleetVehicles
      .filter((v: any) => v.tenant_id === tenantId || tenantId === 'company_allied')
      .map((v: any) => {
        if (!v.last_employee_name && !v.last_rider_name) {
          const vehAsgns = assignments.filter(
            (a: any) => (a.vehicle_id === v.id || a.vehicle_plate === v.plate_number) && a.assignment_status !== 'ACTIVE'
          ).sort((a: any, b: any) => new Date(b.return_date || b.created_at || 0).getTime() - new Date(a.return_date || a.created_at || 0).getTime());
          const lastAsgn = vehAsgns[0];
          if (lastAsgn) {
            return {
              ...v,
              last_assignment_id: v.last_assignment_id || lastAsgn.id,
              last_employee_id: v.last_employee_id || lastAsgn.employee_id,
              last_employee_name: v.last_employee_name || lastAsgn.employee_name,
              last_employee_code: v.last_employee_code || lastAsgn.employee_code,
              last_assigned_date: v.last_assigned_date || lastAsgn.assignment_date,
              last_assigned_time: v.last_assigned_time || lastAsgn.assignment_time,
              last_returned_date: v.last_returned_date || lastAsgn.return_date,
              last_returned_time: v.last_returned_time || lastAsgn.return_time,
              last_assigned_by: v.last_assigned_by || lastAsgn.assigned_by,
              last_returned_by: v.last_returned_by || lastAsgn.returned_by || lastAsgn.returned_to,
              last_return_reason: v.last_return_reason || lastAsgn.return_reason || lastAsgn.reason,
              last_assign_notes: v.last_assign_notes || lastAsgn.handover_notes || lastAsgn.notes,
              last_return_notes: v.last_return_notes || lastAsgn.return_notes || lastAsgn.notes,
              previous_project: v.previous_project || lastAsgn.project_name,
            };
          }
        }
        return v;
      });
  }

  return [];
}
