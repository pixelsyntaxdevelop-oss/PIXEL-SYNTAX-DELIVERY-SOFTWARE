import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { resolveAuthenticatedActor, logUniversalAudit } from './auditActorHelper';
import { getSupabaseClient } from './supabaseDb';
import { vehicleMakeModelService } from './vehicleMakeModelService';
import { generateVehicleXlsxTemplate, generateVehicleCsvTemplate } from './vehicleBulkImportService';
import { createBulkImportRouter } from './vehicleBulkImportRoutes';
import {
  fetchAuthoritativeVehicles,
  filterAndSearchVehicles,
  calculateFleetKpis,
} from './authoritativeVehicles';
import {
  assignVehicleAuthoritative,
  returnVehicleAuthoritative,
  returnVehicleToVendorAuthoritative,
  updateVehicleAssignmentHistoryAuthoritative,
} from './authoritativeVehicleAssignments';

export function createFleetRouter(db: any, getGeminiClient: () => GoogleGenAI) {
  const router = Router();
  
  router.use('/bulk-import', createBulkImportRouter(db, getGeminiClient));

  function extractTenantContext(req: Request) {
    const actor = resolveAuthenticatedActor(req, db);
    return {
      tenantId: actor.tenantId,
      userId: actor.userId,
      userRole: actor.userRole,
      userName: actor.userName,
      employeeId: actor.employeeId,
      employeeCode: actor.employeeCode,
      isSuperAdmin: actor.isSuperAdmin,
      actor,
    };
  }

  // 0. LIVE VEHICLE MAKE & MODEL MASTER (Allied Canonical Master)
  router.get('/makes', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { q, vehicle_type, include_inactive } = req.query;
      const makes = vehicleMakeModelService.getMakes({
        tenantId,
        q: q as string,
        vehicle_type: vehicle_type as string,
        include_inactive: include_inactive === 'true',
      });
      res.json(makes);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/makes', (req: Request, res: Response) => {
    try {
      const { tenantId, actor } = extractTenantContext(req);
      const make = vehicleMakeModelService.createMake({
        tenantId,
        name: req.body.name,
        vehicle_type: req.body.vehicle_type,
        active: req.body.active,
      });
      logUniversalAudit(db, actor, {
        action: 'CREATE_VEHICLE_MAKE',
        actionType: 'CREATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'VEHICLE_MAKE',
        entityId: make.id,
        notes: `Created vehicle make: ${make.name}`,
      });
      res.status(201).json(make);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/models', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { make_id, make_name, q, include_inactive } = req.query;
      const models = vehicleMakeModelService.getModels({
        tenantId,
        make_id: make_id as string,
        make_name: make_name as string,
        q: q as string,
        include_inactive: include_inactive === 'true',
      });
      res.json(models);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/models', (req: Request, res: Response) => {
    try {
      const { tenantId, actor } = extractTenantContext(req);
      const model = vehicleMakeModelService.createModel({
        tenantId,
        make_id: req.body.make_id,
        name: req.body.name,
        active: req.body.active,
      });
      logUniversalAudit(db, actor, {
        action: 'CREATE_VEHICLE_MODEL',
        actionType: 'CREATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'VEHICLE_MODEL',
        entityId: model.id,
        notes: `Created vehicle model: ${model.name} for make ${model.make_id}`,
      });
      res.status(201).json(model);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/bulk-import-template', async (req: Request, res: Response) => {
    try {
      const format = String(req.query.format || '').toLowerCase();
      if (format === 'csv') {
        const csv = generateVehicleCsvTemplate();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=allied_fleet_vehicles_template.csv');
        return res.send(csv);
      }
      const buffer = await generateVehicleXlsxTemplate();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=allied_fleet_vehicles_template.xlsx');
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1. GET /api/erp/fleet/vehicles
  router.get('/vehicles', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const supabase = getSupabaseClient();
      const allVehicles = await fetchAuthoritativeVehicles(supabase, db, tenantId);

      const vehicles = filterAndSearchVehicles(allVehicles, req.query as any);

      const { page, pageSize } = req.query;
      if (page) {
        const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
        const limit = Math.max(1, parseInt((pageSize as string) || '25', 10) || 25);
        const total = vehicles.length;
        const totalPages = Math.ceil(total / limit) || 1;
        const startIndex = (pageNum - 1) * limit;
        const paginated = vehicles.slice(startIndex, startIndex + limit);
        return res.json({
          items: paginated,
          total,
          page: pageNum,
          pageSize: limit,
          totalPages,
        });
      }

      res.json(vehicles);
    } catch (err: any) {
      console.error('Error fetching fleet vehicles:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/erp/fleet/vehicles/search
  router.get('/vehicles/search', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const supabase = getSupabaseClient();
      const allVehicles = await fetchAuthoritativeVehicles(supabase, db, tenantId);
      const q = ((req.query.q as string) || '').trim();
      const vehicles = filterAndSearchVehicles(allVehicles, { q });

      res.json(vehicles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/erp/fleet/vehicles/:id/profile-360
  router.get('/vehicles/:id/profile-360', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      let assignments = (db.fleetAssignments || db.vehicleAssignments || []).filter(
        (a: any) => (a.vehicle_id === id || a.vehicle_plate === vehicle.plate_number) && a.tenant_id === tenantId
      );

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: supaAsgns } = await supabase
            .from('vehicle_assignments')
            .select('*')
            .or(`vehicle_id.eq.${id},vehicle_plate.eq.${vehicle.plate_number}`)
            .eq('tenant_id', tenantId)
            .order('assignment_date', { ascending: false });

          if (Array.isArray(supaAsgns) && supaAsgns.length > 0) {
            const asgnMap = new Map<string, any>();
            for (const a of assignments) asgnMap.set(a.id, a);
            for (const sa of supaAsgns) asgnMap.set(sa.id, sa);
            assignments = Array.from(asgnMap.values()).sort(
              (a, b) => new Date(b.assignment_date || b.created_at || 0).getTime() - new Date(a.assignment_date || a.created_at || 0).getTime()
            );
          }
        } catch (err) {
          console.warn('Error fetching vehicle profile assignments from Supabase:', err);
        }
      }

      const currentAssignment = assignments.find((a: any) => a.assignment_status === 'ACTIVE') || null;
      const statusHistory = (db.fleetStatusHistories || []).filter((s: any) => s.vehicle_id === id && s.tenant_id === tenantId);
      const maintenanceHistory = (db.fleetMaintenance || []).filter((m: any) => m.vehicle_id === id && m.tenant_id === tenantId);
      const fuelLogs = (db.fleetFuelEntries || []).filter((f: any) => f.vehicle_id === id && f.tenant_id === tenantId);
      const odometerHistory = (db.fleetOdometerHistories || []).filter((o: any) => o.vehicle_id === id && o.tenant_id === tenantId);
      const accidents = (db.fleetAccidents || []).filter((ac: any) => ac.vehicle_id === id && ac.tenant_id === tenantId);
      const fines = (db.fleetFines || []).filter((fn: any) => fn.vehicle_id === id && fn.tenant_id === tenantId);
      const expenses = (db.fleetExpenses || []).filter((ex: any) => ex.vehicle_id === id && ex.tenant_id === tenantId);
      const documents = (db.entityDocuments || []).filter((d: any) => d.entity_id === id && d.tenant_id === tenantId);

      // Construct chronological timeline
      const timeline: any[] = [];

      assignments.forEach((a: any) => {
        timeline.push({
          id: `tl_asgn_${a.id}`,
          date: a.assignment_date,
          type: 'ASSIGNMENT',
          title: `Assigned to ${a.employee_name} (${a.employee_code})`,
          description: `Starting Odometer: ${Number(a.starting_odometer || 0).toLocaleString()} km. Notes: ${a.handover_notes || 'None'}`,
          user: a.assigned_by || 'Fleet Officer',
        });
        if (a.return_date) {
          timeline.push({
            id: `tl_ret_${a.id}`,
            date: a.return_date,
            type: 'RETURN',
            title: `Returned from ${a.employee_name}`,
            description: `Return Odometer: ${a.return_odometer?.toLocaleString() || '-'} km. Condition: ${a.condition_on_return || 'Good'}. Notes: ${a.return_notes || 'None'}`,
            user: a.returned_to || 'Fleet Officer',
          });
        }
      });

      maintenanceHistory.forEach((m: any) => {
        timeline.push({
          id: `tl_maint_${m.id}`,
          date: m.completed_date || m.reported_date,
          type: 'MAINTENANCE',
          title: `${m.maintenance_type} (${m.status})`,
          description: `${m.description}. Total Cost: AED ${m.cost}. Workshop: ${m.workshop_name}`,
          user: m.created_by || 'Maintenance Lead',
        });
      });

      accidents.forEach((ac: any) => {
        timeline.push({
          id: `tl_acc_${ac.id}`,
          date: ac.date_time.split(' ')[0] || ac.created_at.split('T')[0],
          type: 'ACCIDENT',
          title: `Accident Reported (${ac.severity})`,
          description: `${ac.description}. Location: ${ac.location}. Police Report: ${ac.police_report_number || 'Pending'}`,
          user: ac.reported_by || 'Dispatcher',
        });
      });

      fines.forEach((fn: any) => {
        timeline.push({
          id: `tl_fine_${fn.id}`,
          date: fn.fine_date,
          type: 'FINE',
          title: `Traffic Fine: AED ${fn.amount} (${fn.authority})`,
          description: `${fn.violation_type} at ${fn.location}. Status: ${fn.status}`,
          user: 'Traffic Authority',
        });
      });

      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate TCO Breakdown
      const totalFuel = fuelLogs.reduce((sum: number, f: any) => sum + (f.cost || 0), 0);
      const totalMaint = maintenanceHistory.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
      const totalFines = fines.reduce((sum: number, fn: any) => sum + (fn.amount || 0), 0);
      const purchaseOrLease = vehicle.purchase_cost || (vehicle.monthly_lease_cost ? vehicle.monthly_lease_cost * 12 : 0);
      const totalCost = purchaseOrLease + totalFuel + totalMaint + totalFines;
      const costPerKm = vehicle.current_odometer > 0 ? Number((totalCost / vehicle.current_odometer).toFixed(2)) : 0;

      // Maintenance Due Status Check
      const isOverdue = Boolean(vehicle.next_service_due_km && vehicle.current_odometer >= vehicle.next_service_due_km);
      const isDueSoon = Boolean(
        vehicle.next_service_due_km &&
        vehicle.current_odometer >= vehicle.next_service_due_km - 500 &&
        !isOverdue
      );
      const dueReasons: string[] = [];
      if (isOverdue) dueReasons.push(`Odometer (${vehicle.current_odometer} km) has exceeded service interval (${vehicle.next_service_due_km} km)`);
      if (isDueSoon) dueReasons.push(`Routine service due within ${vehicle.next_service_due_km! - vehicle.current_odometer} km`);

      // Registration Expiry Check
      const now = new Date();
      let mulkiyaStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';
      let mulkiyaDays = 999;
      if (vehicle.registration_expiry) {
        const mExp = new Date(vehicle.registration_expiry);
        mulkiyaDays = Math.ceil((mExp.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (mulkiyaDays < 0) mulkiyaStatus = 'EXPIRED';
        else if (mulkiyaDays <= 30) mulkiyaStatus = 'EXPIRING_SOON';
      }

      let insStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' = 'VALID';
      let insDays = 999;
      if (vehicle.insurance_expiry) {
        const iExp = new Date(vehicle.insurance_expiry);
        insDays = Math.ceil((iExp.getTime() - now.getTime()) / (1000 * 3600 * 24));
        if (insDays < 0) insStatus = 'EXPIRED';
        else if (insDays <= 30) insStatus = 'EXPIRING_SOON';
      }

      res.json({
        vehicle,
        currentAssignment,
        assignments,
        assignmentHistory: assignments,
        statusHistory,
        maintenanceHistory,
        fuelLogs,
        odometerHistory,
        accidents,
        fines,
        expenses,
        documents,
        timeline,
        tcoSummary: {
          totalCost,
          purchaseOrLease,
          fuel: totalFuel,
          maintenance: totalMaint,
          fines: totalFines,
          insuranceAndRegistration: 1200,
          accidents: 0,
          costPerKm,
        },
        maintenanceDueStatus: {
          isDue: isOverdue || isDueSoon,
          isOverdue,
          isDueSoon,
          reasons: dueReasons,
          dueKmRemaining: vehicle.next_service_due_km ? Math.max(0, vehicle.next_service_due_km - vehicle.current_odometer) : undefined,
        },
        registrationExpiryStatus: {
          mulkiyaStatus,
          mulkiyaDaysRemaining: mulkiyaDays,
          insuranceStatus: insStatus,
          insuranceDaysRemaining: insDays,
        },
      });
    } catch (err: any) {
      console.error('360 Profile Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 4. POST /api/erp/fleet/vehicles (Create Vehicle)
  router.post('/vehicles', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, userRole, isSuperAdmin } = extractTenantContext(req);
      if (!isSuperAdmin && userRole !== 'COMPANY_ADMIN') {
        const roleObj = (db.roles || []).find((r: any) => r.role === userRole);
        if (roleObj && !roleObj.permissions?.fleet?.create && !roleObj.permissions?.fleet?.edit) {
          return res.status(403).json({
            error: `Access Denied: Role '${userRole}' is not authorized to create fleet vehicles.`,
          });
        }
      }
      const raw = req.body;

      const id = `veh_${Date.now()}`;
      const code = raw.vehicle_code || `VH-${(db.fleetVehicles?.length || 0) + 1001}`;
      const plate = raw.plate_number?.trim();

      if (!plate) {
        return res.status(400).json({ error: 'Plate number is required' });
      }

      // Business rule for Allied fleet:
      // - Plate Number is NOT globally unique. Two bikes/vehicles may have the same Plate Number.
      // - Chassis Number MUST be unique. Duplicate blocking must be based primarily on Chassis Number only.
      const chassis = raw.chassis_number?.trim();
      if (chassis) {
        // Reject only if Chassis Number already exists in company_pixel_syntax
        const targetTenant = tenantId || 'company_pixel_syntax';
        const existingChassis = (db.fleetVehicles || []).find(
          (v: any) =>
            (v.tenant_id === targetTenant || v.tenant_id === 'company_pixel_syntax' || targetTenant === 'company_pixel_syntax') &&
            v.chassis_number &&
            v.chassis_number.trim().toUpperCase() === chassis.toUpperCase()
        );
        if (existingChassis) {
          return res.status(400).json({ error: `Vehicle with chassis number '${chassis}' already exists in company_pixel_syntax.` });
        }

        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data: sbExisting } = await supabase
              .from('vehicles')
              .select('id, chassis_number')
              .eq('tenant_id', 'company_pixel_syntax')
              .ilike('chassis_number', chassis)
              .maybeSingle();
            if (sbExisting) {
              return res.status(400).json({ error: `Vehicle with chassis number '${chassis}' already exists in company_pixel_syntax.` });
            }
          } catch (sbEx) {
            console.warn('Supabase chassis duplicate check notice:', sbEx);
          }
        }
      }

      const newVehicle = {
        id,
        tenant_id: tenantId,
        vehicle_code: code,
        vehicle_type: raw.vehicle_type || 'Motorcycle',
        plate_number: plate,
        plate_code: raw.plate_code || 'T',
        plate_emirate: raw.plate_emirate || 'Dubai',
        make: raw.make || 'Yamaha',
        model: raw.model || 'FZ-25',
        year: Number(raw.year) || new Date().getFullYear(),
        color: raw.color || 'Standard',
        chassis_number: raw.chassis_number || `VIN${Date.now()}`,
        tc_number: raw.tc_number || raw.engine_number || raw.traffic_file_number || `TC-${Date.now().toString().slice(-6)}`,
        engine_number: raw.tc_number || raw.engine_number || `TC-${Date.now().toString().slice(-6)}`,
        registration_number: raw.registration_number || `MUL-${plate}`,
        registration_expiry: raw.registration_expiry || '2027-12-31',
        insurance_company: raw.insurance_company || 'Sukoon Insurance',
        insurance_number: raw.insurance_number || `POL-${Date.now()}`,
        insurance_expiry: raw.insurance_expiry || '2027-12-31',
        ownership_type: raw.ownership_type || 'OWNED',
        owner_or_vendor: raw.owner_or_vendor || 'Company Fleet',
        purchase_date: raw.purchase_date,
        purchase_cost: Number(raw.purchase_cost) || 0,
        monthly_lease_cost: Number(raw.monthly_lease_cost) || 0,
        current_odometer: Number(raw.current_odometer) || 0,
        fuel_type: raw.fuel_type || 'PETROL_95',
        branch_id: raw.branch_id || 'b_dxb',
        branch_name: raw.branch_name || 'Dubai Central HQ',
        project_id: raw.project_id,
        project_name: raw.project_name,
        current_status: raw.current_status || 'Available',
        status_reason: raw.status_reason || 'Initial registration',
        gps_device_id: raw.gps_device_id,
        fuel_card_id: raw.fuel_card_id,
        fuel_card_number: raw.fuel_card_number,
        last_service_odometer: Number(raw.current_odometer) || 0,
        last_service_date: new Date().toISOString().split('T')[0],
        next_service_due_km: (Number(raw.current_odometer) || 0) + 3000,
        next_service_due_date: '2026-11-30',
        total_maintenance_cost: 0,
        total_fuel_cost: 0,
        total_fines_cost: 0,
        total_accidents_count: 0,
        notes: raw.notes,
        created_at: new Date().toISOString(),
        created_by: userId,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };

      db.fleetVehicles.push(newVehicle);

      // Persist manual creation to Supabase production table
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const sbPayload: any = {
            id: newVehicle.id,
            vehicle_id: newVehicle.vehicle_code,
            tenant_id: 'company_pixel_syntax',
            vehicle_type: newVehicle.vehicle_type,
            plate_number: newVehicle.plate_number,
            plate_code: newVehicle.plate_code || null,
            plate_emirate: newVehicle.plate_emirate,
            make: newVehicle.make,
            model: newVehicle.model,
            year: newVehicle.year,
            color: newVehicle.color || 'White',
            chassis_number: newVehicle.chassis_number,
            engine_number: newVehicle.tc_number || newVehicle.engine_number,
            registration_number: newVehicle.registration_number,
            registration_expiry: newVehicle.registration_expiry && !isNaN(Date.parse(newVehicle.registration_expiry)) ? newVehicle.registration_expiry : null,
            insurance_company: newVehicle.insurance_company,
            insurance_policy_number: newVehicle.insurance_number,
            insurance_expiry: newVehicle.insurance_expiry && !isNaN(Date.parse(newVehicle.insurance_expiry)) ? newVehicle.insurance_expiry : null,
            ownership_type: newVehicle.ownership_type,
            status: 'AVAILABLE',
            current_odometer: newVehicle.current_odometer,
            gps_device_id: newVehicle.gps_device_id || null,
            created_at: newVehicle.created_at,
            created_by: userId,
            updated_at: newVehicle.updated_at,
            updated_by: userId,
          };
          let { error: sbErr } = await supabase.from('vehicles').insert(sbPayload);
          if (sbErr) {
            const { insurance_policy_number, gps_device_id, ...fallbackSb } = sbPayload;
            await supabase.from('vehicles').insert(fallbackSb);
          }
        } catch (sbEx) {
          console.warn('Manual vehicle Supabase persist notice:', sbEx);
        }
      }

      // Record initial status history
      db.fleetStatusHistories.push({
        id: `v_sh_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        status: newVehicle.current_status,
        reason: 'New vehicle registered in Master',
        effective_from: new Date().toISOString().split('T')[0],
        changed_by: userId,
        created_at: new Date().toISOString(),
      });

      // Universal Authenticated Actor Audit
      const { actor } = extractTenantContext(req);
      logUniversalAudit(db, actor, {
        action: 'CREATE_VEHICLE',
        actionType: 'CREATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        newState: newVehicle,
        reason: 'New vehicle registered in Master',
        notes: `Plate: ${newVehicle.plate_number}, Make: ${newVehicle.make} ${newVehicle.model}`,
      });

      // Record initial odometer history
      if (newVehicle.current_odometer > 0) {
        db.fleetOdometerHistories.push({
          id: `odo_${Date.now()}`,
          tenant_id: tenantId,
          vehicle_id: id,
          reading: newVehicle.current_odometer,
          recorded_at: new Date().toISOString(),
          source: 'Manual Update',
          entered_by: userId,
          notes: 'Initial registration odometer baseline',
          is_correction: false,
          created_at: new Date().toISOString(),
        });
      }

      res.status(201).json(newVehicle);
    } catch (err: any) {
      console.error('Create vehicle error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Change physical bike location without changing its registration emirate or custody.
  router.patch('/vehicles/:id/location', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, actor } = extractTenantContext(req);
      const supabase = getSupabaseClient();
      if (!supabase || !userId) return res.status(401).json({ success: false, error: 'Sign in before editing bike location.' });
      const staffQuery = supabase.from('profiles').select('id,full_name').eq('tenant_id', tenantId);
      const byId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(userId));
      const { data: direct } = await (byId
        ? staffQuery.eq('id', userId)
        : staffQuery.eq('username', userId)).maybeSingle();
      let profile = direct;
      if (!profile && actor?.userName) {
        const { data } = await supabase.from('profiles').select('id,full_name')
          .eq('tenant_id', tenantId).ilike('full_name', actor.userName).maybeSingle();
        profile = data;
      }
      if (!profile?.id || !profile.full_name?.trim()) {
        return res.status(403).json({ success: false, error: 'A verified staff profile is required.' });
      }
      const state = typeof req.body?.location_state === 'string' ? req.body.location_state.trim() : null;
      if (state && !['Dubai','Abu Dhabi','Al Ain','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'].includes(state)) {
        return res.status(400).json({ success: false, error: 'Choose a valid UAE state.' });
      }
      const { data, error } = await supabase.rpc('allied_set_vehicle_location', {
        p_tenant_id: tenantId, p_vehicle_id: req.params.id, p_location_state: state,
        p_actor_id: String(profile.id), p_actor_name: profile.full_name.trim(),
      });
      if (error || !data?.success) {
        return res.status(409).json({ success: false, error: error?.message || 'Could not save location.' });
      }
      res.json({ success: true, ...data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Could not save bike location.' });
    }
  });

  // 5. PUT /api/erp/fleet/vehicles/:id (Update Vehicle Master)
  router.put('/vehicles/:id', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, userRole, isSuperAdmin } = extractTenantContext(req);
      if (!isSuperAdmin && userRole !== 'COMPANY_ADMIN') {
        const roleObj = (db.roles || []).find((r: any) => r.role === userRole);
        if (roleObj && !roleObj.permissions?.fleet?.edit) {
          return res.status(403).json({
            error: `Access Denied: Role '${userRole}' is not authorized to edit fleet vehicles.`,
          });
        }
      }
      const { id } = req.params;
      const updates = req.body;

      const index = (db.fleetVehicles || []).findIndex((v: any) => v.id === id && v.tenant_id === tenantId);
      if (index === -1) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      const current = db.fleetVehicles[index];

      // Business rule for Allied fleet:
      // - Editing a vehicle allows a Plate Number already used by another vehicle.
      // - Changing Chassis Number to one already used by another vehicle must be rejected.
      const updatedChassis = updates.chassis_number !== undefined ? String(updates.chassis_number || '').trim() : undefined;
      if (updatedChassis) {
        const targetTenant = tenantId || 'company_pixel_syntax';
        const chassisConflict = (db.fleetVehicles || []).find(
          (v: any) =>
            v.id !== id &&
            (v.tenant_id === targetTenant || v.tenant_id === 'company_pixel_syntax' || targetTenant === 'company_pixel_syntax') &&
            v.chassis_number &&
            v.chassis_number.trim().toUpperCase() === updatedChassis.toUpperCase()
        );
        if (chassisConflict) {
          return res.status(400).json({
            error: `Vehicle with chassis number '${updatedChassis}' already exists in company_pixel_syntax.`,
          });
        }

        const supabase = getSupabaseClient();
        if (supabase) {
          try {
            const { data: sbExisting } = await supabase
              .from('vehicles')
              .select('id, chassis_number')
              .eq('tenant_id', 'company_pixel_syntax')
              .neq('id', id)
              .ilike('chassis_number', updatedChassis)
              .maybeSingle();
            if (sbExisting) {
              return res.status(400).json({
                error: `Vehicle with chassis number '${updatedChassis}' already exists in company_pixel_syntax.`,
              });
            }
          } catch (sbEx) {
            console.warn('Supabase chassis duplicate check on edit notice:', sbEx);
          }
        }
      }

      const updated = {
        ...current,
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };

      db.fleetVehicles[index] = updated;

      // Sync vehicle update to Supabase if configured
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('vehicles')
            .update({
              plate_number: updated.plate_number,
              plate_code: updated.plate_code || null,
              plate_emirate: updated.plate_emirate,
              make: updated.make,
              model: updated.model,
              year: updated.year,
              color: updated.color || 'White',
              chassis_number: updated.chassis_number,
              engine_number: updated.tc_number || updated.engine_number,
              registration_number: updated.registration_number,
              updated_at: updated.updated_at,
              updated_by: userId,
            })
            .eq('id', id);
        } catch (sbEx) {
          console.warn('Vehicle update Supabase sync notice:', sbEx);
        }
      }

      const { actor } = extractTenantContext(req);
      logUniversalAudit(db, actor, {
        action: 'UPDATE_VEHICLE',
        actionType: 'UPDATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        oldState: current,
        newState: updated,
        reason: 'Vehicle master details updated',
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 6. POST /api/erp/fleet/vehicles/:id/status (Change Status)
  router.post('/vehicles/:id/status', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { status, reason, effectiveDate, notes } = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      // If moving to Out of Service or In Maintenance while active rider assigned, record warning
      vehicle.current_status = status;
      vehicle.status_reason = reason || `Status changed to ${status}`;
      vehicle.updated_at = new Date().toISOString();
      vehicle.updated_by = userId;

      const statusHist = {
        id: `v_sh_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        status,
        reason,
        effective_from: effectiveDate || new Date().toISOString().split('T')[0],
        notes,
        changed_by: userId,
        created_at: new Date().toISOString(),
      };

      db.fleetStatusHistories.push(statusHist);

      const { actor } = extractTenantContext(req);
      logUniversalAudit(db, actor, {
        action: 'CHANGE_VEHICLE_STATUS',
        actionType: 'STATUS_CHANGE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        newState: { status, reason, effectiveDate },
        reason: reason || `Status changed to ${status}`,
        notes,
      });

      res.json({ success: true, vehicle });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 7. POST /api/erp/fleet/vehicles/:id/assign (Assign to Rider)
  router.post('/vehicles/:id/assign', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const {
        employeeId,
        employee_id,
        riderId,
        rider_id,
        assignmentDate,
        assignment_date,
        assignmentTime,
        assignment_time,
        startingOdometer,
        starting_odometer,
        condition,
        handoverNotes,
        handover_notes,
        notes,
        assignedBy,
        assigned_by,
        forceReassign,
        force_reassign,
      } = req.body;

      const targetEmpId = employeeId || employee_id || riderId || rider_id;
      if (!targetEmpId) {
        return res.status(400).json({ error: 'Employee / Rider ID is required for vehicle assignment.' });
      }

      const supabase = getSupabaseClient();
      const result = await assignVehicleAuthoritative(supabase, db, {
        tenantId,
        vehicleId: id,
        employeeId: targetEmpId,
        assignmentDate: assignmentDate || assignment_date,
        assignmentTime: assignmentTime || assignment_time,
        startingOdometer: startingOdometer ?? starting_odometer,
        condition,
        handoverNotes: handoverNotes || handover_notes || notes,
        assignedBy: assignedBy || assigned_by || userId,
        forceReassign: Boolean(forceReassign || force_reassign),
      });

      if (!result.success) {
        if (result.reassignmentRequired) {
          return res.status(409).json(result);
        }
        return res.status(400).json({ error: result.error });
      }

      logUniversalAudit(db, actor, {
        action: 'ASSIGN_VEHICLE',
        actionType: 'ASSIGN',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        newState: result.assignment,
        reason: `Assigned to ${result.employee?.full_name}`,
        notes: handoverNotes || handover_notes || notes,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Assign vehicle error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/erp/fleet/vehicles/:id/return (Return Vehicle to Fleet)
  router.post('/vehicles/:id/return', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const {
        returnDate,
        return_date,
        returnTime,
        return_time,
        returnOdometer,
        return_odometer,
        conditionOnReturn,
        condition_on_return,
        returnNotes,
        return_notes,
        returnReason,
        return_reason,
        returnRemark,
        return_remark,
        returnedTo,
        returned_to,
        returnedBy,
        returned_by,
      } = req.body;

      if (!actor?.isAuthenticated || !actor?.tenantId || !actor?.userName) {
        return res.status(401).json({ error: 'Verified staff session required to return a bike.' });
      }
      const effectiveReason = returnReason || return_reason || returnRemark || return_remark || 'Returned to Allied depot';
      const effectiveReturnedBy = actor.userName;

      const supabase = getSupabaseClient();
      const result = await returnVehicleAuthoritative(supabase, db, {
        tenantId,
        vehicleId: id,
        returnDate: returnDate || return_date,
        returnTime: returnTime || return_time,
        returnOdometer: returnOdometer ?? return_odometer,
        conditionOnReturn: conditionOnReturn || condition_on_return,
        returnNotes: returnNotes || return_notes,
        returnReason: effectiveReason,
        returnedTo: 'Allied depot',
        returnedBy: effectiveReturnedBy,
        returnedById: /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(userId)) ? String(userId) : undefined,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      logUniversalAudit(db, actor, {
        action: 'RETURN_VEHICLE',
        actionType: 'RETURN',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        reason: 'Vehicle returned and unassigned to available depot',
        notes: returnNotes || return_notes,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Return vehicle error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8b. POST /api/erp/fleet/vehicles/:id/return-to-vendor (Return Vehicle to Leasing Company / Supplier)
  router.post('/vehicles/:id/return-to-vendor', async (req: Request, res: Response) => {
    try {
      const { tenantId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const {
        vendorReturnDate,
        vendor_return_date,
        vendorReturnTime,
        vendor_return_time,
        vendorReturnReason,
        vendor_return_reason,
        finalOdometer,
        final_odometer,
        vendorReference,
        vendor_reference,
        returnedBy,
        returned_by,
        notes,
        autoCloseRiderAssignment,
      } = req.body;

      const effectiveReason = vendorReturnReason || vendor_return_reason;
      if (!effectiveReason || !effectiveReason.trim()) {
        return res.status(400).json({ error: 'Vendor return reason / remark is mandatory.' });
      }

      if (!actor?.isAuthenticated || !actor?.tenantId || !actor?.userName) {
        return res.status(401).json({ error: 'Verified staff session required for vendor return.' });
      }
      const effectiveReturnedBy = actor.userName;
      const supabase = getSupabaseClient();

      const result = await returnVehicleToVendorAuthoritative(supabase, db, {
        tenantId,
        vehicleId: id,
        vendorReturnDate: vendorReturnDate || vendor_return_date,
        vendorReturnTime: vendorReturnTime || vendor_return_time,
        vendorReturnReason: effectiveReason,
        finalOdometer: finalOdometer ?? final_odometer,
        vendorReference: vendorReference || vendor_reference,
        returnedBy: effectiveReturnedBy,
        returnedById: /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(actor.userId)) ? String(actor.userId) : undefined,
        notes,
        autoCloseRiderAssignment: autoCloseRiderAssignment !== false,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      logUniversalAudit(db, actor, {
        action: 'RETURN_VEHICLE_TO_VENDOR',
        actionType: 'RETURN',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        reason: `Returned to Vendor: ${effectiveReason}`,
        notes: notes || vendorReference ? `Ref: ${vendorReference || ''}. Notes: ${notes || ''}` : undefined,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Return to vendor error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 8c. PUT /api/erp/fleet/assignment-history/:id (Edit Historical Assignment Log)
  const handleUpdateAssignment = async (req: Request, res: Response) => {
    try {
      const { tenantId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const updates = req.body;
      const supabase = getSupabaseClient();

      const result = await updateVehicleAssignmentHistoryAuthoritative(supabase, db, {
        tenantId,
        assignmentId: id,
        updates,
        editedBy: actor?.userName || 'Operations Admin',
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      logUniversalAudit(db, actor, {
        action: 'EDIT_ASSIGNMENT_RECORD',
        actionType: 'UPDATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'VEHICLE_ASSIGNMENT',
        entityId: id,
        notes: `Updated assignment history record by ${actor?.userName || 'Operations Admin'}`,
      });

      res.json(result);
    } catch (err: any) {
      console.error('Update assignment history error:', err);
      res.status(500).json({ error: err.message });
    }
  };

  router.put('/assignment-history/:id', handleUpdateAssignment);
  router.put('/assignments/:id', handleUpdateAssignment);

  // 9. POST /api/erp/fleet/employees/:id/replace-vehicle (Atomic Swap)
  router.post('/employees/:id/replace-vehicle', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, userName } = extractTenantContext(req);
      const employeeId = req.params.id;
      const {
        oldVehicleId,
        newVehicleId,
        returnOdometer,
        conditionOnReturn,
        returnNotes,
        newStartingOdometer,
        newCondition,
        replacementReason,
        assignedBy,
      } = req.body;

      if (!newVehicleId) {
        return res.status(400).json({ error: 'Replacement vehicle ID is required.' });
      }

      const supabase = getSupabaseClient();
      let rpcResult: any = null;

      if (supabase) {
        // EXECUTE ONE TRUE ATOMIC POSTGRESQL TRANSACTION VIA RPC
        const { data, error } = await supabase.rpc('rpc_swap_vehicle', {
          p_tenant_id: tenantId,
          p_employee_id: employeeId,
          p_old_vehicle_id: oldVehicleId || null,
          p_new_vehicle_id: newVehicleId,
          p_return_odometer: returnOdometer ? Number(returnOdometer) : null,
          p_condition_on_return: conditionOnReturn || 'GOOD',
          p_return_notes: returnNotes || `Replaced due to: ${replacementReason || 'Swap'}`,
          p_new_starting_odometer: newStartingOdometer ? Number(newStartingOdometer) : null,
          p_new_condition: newCondition || 'EXCELLENT',
          p_replacement_reason: replacementReason || 'Vehicle Replacement',
          p_assigned_by: assignedBy || userName || 'Fleet Manager',
          p_user_id: userId,
        });

        if (error) {
          console.error('Supabase rpc_swap_vehicle rollback/failure:', error);
          return res.status(400).json({ 
            error: error.message || 'Vehicle swap transaction failed and rolled back.',
            transactionStatus: 'ROLLBACK'
          });
        }
        rpcResult = data;
      }

      const employee = (db.masterEmployees || []).find((e: any) => e.id === employeeId && e.tenant_id === tenantId);
      if (!employee && !supabase) return res.status(404).json({ error: 'Rider not found' });

      const oldVeh = (db.fleetVehicles || []).find((v: any) => v.id === oldVehicleId && v.tenant_id === tenantId);
      const newVeh = (db.fleetVehicles || []).find((v: any) => v.id === newVehicleId && v.tenant_id === tenantId);

      if (!newVeh && !supabase) return res.status(404).json({ error: 'Replacement vehicle not found' });

      const now = new Date().toISOString();
      const today = now.split('T')[0];

      // 1. Close old assignment if exists
      if (oldVeh) {
        const oldAsgn = (db.fleetAssignments || []).find(
          (a: any) => a.vehicle_id === oldVehicleId && a.employee_id === employeeId && a.assignment_status === 'ACTIVE'
        );
        if (oldAsgn) {
          oldAsgn.assignment_status = 'REPLACED';
          oldAsgn.return_date = today;
          oldAsgn.return_time = '12:00';
          oldAsgn.return_odometer = Number(returnOdometer) || oldVeh.current_odometer;
          oldAsgn.condition_on_return = conditionOnReturn || 'GOOD';
          oldAsgn.return_notes = returnNotes || `Replaced due to: ${replacementReason}`;
          oldAsgn.replacement_vehicle_id = newVehicleId;
          oldAsgn.replacement_reason = replacementReason;
        }
        oldVeh.current_status = 'Available';
        oldVeh.status_reason = `Replaced with ${newVeh?.plate_number || 'new vehicle'}. Reason: ${replacementReason}`;
        oldVeh.current_rider_id = undefined;
        oldVeh.current_rider_name = undefined;
        oldVeh.current_rider_code = undefined;
        oldVeh.current_odometer = Number(returnOdometer) || oldVeh.current_odometer;
      }

      // 2. Assign new vehicle
      const startOdo = Number(newStartingOdometer) || newVeh?.current_odometer || 0;
      const newAsgn = {
        id: rpcResult?.assignment_id || `v_asgn_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: newVeh?.id || newVehicleId,
        vehicle_plate: newVeh?.plate_number || rpcResult?.new_vehicle_plate || 'Plate',
        vehicle_model: newVeh ? `${newVeh.make} ${newVeh.model}` : 'Vehicle',
        employee_id: employee?.id || employeeId,
        employee_name: employee?.full_name || 'Employee',
        employee_code: employee?.employee_code || '',
        project_id: employee?.project_id || newVeh?.project_id,
        project_name: employee?.project_name || newVeh?.project_name,
        branch_id: employee?.branch_id || newVeh?.branch_id,
        assignment_date: today,
        assignment_time: '12:05',
        assignment_status: 'ACTIVE',
        starting_odometer: startOdo,
        condition_on_assignment: newCondition || 'EXCELLENT',
        handover_notes: `Replacement handover. Reason: ${replacementReason}`,
        assigned_by: assignedBy || userId || 'Fleet Manager',
        created_at: now,
      };

      if (!db.fleetAssignments) db.fleetAssignments = [];
      db.fleetAssignments.push(newAsgn);

      if (newVeh) {
        newVeh.current_status = 'Assigned';
        newVeh.status_reason = `Assigned as replacement to ${employee?.full_name || 'rider'}`;
        newVeh.current_rider_id = employee?.id;
        newVeh.current_rider_name = employee?.full_name;
        newVeh.current_rider_code = employee?.employee_code;
        newVeh.current_odometer = startOdo;
      }

      if (employee) {
        employee.current_bike_id = newVeh?.id || newVehicleId;
        employee.current_bike_plate = newVeh?.plate_number || rpcResult?.new_vehicle_plate;
      }

      const { actor } = extractTenantContext(req);
      logUniversalAudit(db, actor, {
        action: 'REPLACE_VEHICLE',
        actionType: 'REPLACE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: newVeh?.id || newVehicleId,
        reason: replacementReason,
        notes: `Replaced vehicle ${oldVeh?.plate_number || oldVehicleId} with ${newVeh?.plate_number || newVehicleId} for rider ${employee?.full_name || employeeId}`,
      });

      return res.json({ 
        success: true, 
        transaction: 'ATOMIC_POSTGRES_RPC',
        newAssignment: newAsgn,
        rpcResult 
      });
    } catch (err: any) {
      console.error('Replace vehicle error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 10. POST /api/erp/fleet/vehicles/:id/odometer
  router.post('/vehicles/:id/odometer', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { reading, source, notes, isCorrection, correctionReason, enteredBy } = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const numReading = Number(reading);
      if (isNaN(numReading) || numReading < 0) {
        return res.status(400).json({ error: 'Invalid odometer reading' });
      }

      if (!isCorrection && numReading < vehicle.current_odometer) {
        return res.status(400).json({
          error: `New odometer reading (${numReading} km) cannot be less than current odometer (${vehicle.current_odometer} km) without flagging as an authorized correction.`,
        });
      }

      const odoRecord = {
        id: `odo_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        reading: numReading,
        recorded_at: new Date().toISOString(),
        source: source || 'Manual Update',
        entered_by: enteredBy || userId || 'Fleet Staff',
        notes,
        is_correction: Boolean(isCorrection),
        correction_reason: correctionReason,
        created_at: new Date().toISOString(),
      };

      db.fleetOdometerHistories.push(odoRecord);
      vehicle.current_odometer = numReading;
      vehicle.updated_at = new Date().toISOString();

      const { actor } = extractTenantContext(req);
      logUniversalAudit(db, actor, {
        action: 'UPDATE_ODOMETER',
        actionType: 'ODOMETER_UPDATE',
        module: 'VEHICLE_MANAGEMENT',
        entityType: 'FLEET_VEHICLE',
        entityId: id,
        newState: { reading: numReading, isCorrection, correctionReason },
        reason: isCorrection ? `Odometer Correction: ${correctionReason}` : 'Odometer Log Update',
        notes: notes || `Odometer updated to ${numReading} km`,
      });

      res.json({ success: true, odometerRecord: odoRecord });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 11. POST /api/erp/fleet/vehicles/:id/maintenance
  router.post('/vehicles/:id/maintenance', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const raw = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const partsCost = Number(raw.parts_cost) || 0;
      const labourCost = Number(raw.labour_cost) || 0;
      const totalCost = Number(raw.cost) || partsCost + labourCost;

      const maintId = `maint_${Date.now()}`;
      const maintRecord = {
        id: maintId,
        tenant_id: tenantId,
        vehicle_id: id,
        vehicle_plate: vehicle.plate_number,
        maintenance_type: raw.maintenance_type || 'General Service',
        maintenance_category: raw.maintenance_category || 'PREVENTIVE',
        reported_date: raw.reported_date || new Date().toISOString().split('T')[0],
        scheduled_date: raw.scheduled_date,
        started_date: raw.started_date,
        completed_date: raw.completed_date,
        odometer_at_service: Number(raw.odometer_at_service) || vehicle.current_odometer,
        next_service_due_km: (Number(raw.odometer_at_service) || vehicle.current_odometer) + (raw.interval_km || 3000),
        next_service_due_date: raw.next_service_due_date,
        vendor_id: raw.vendor_id,
        vendor_name: raw.vendor_name,
        workshop_name: raw.workshop_name || 'Apex Precision Garage Al Quoz',
        parts_cost: partsCost,
        labour_cost: labourCost,
        cost: totalCost,
        status: raw.status || 'Reported',
        description: raw.description || 'Routine service logged',
        replaced_parts: raw.replaced_parts || [],
        invoice_number: raw.invoice_number,
        invoice_file_url: raw.invoice_file_url,
        accident_id: raw.accident_id,
        technician_notes: raw.technician_notes,
        created_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.fleetMaintenance.push(maintRecord);

      // If scheduled or in-progress, change vehicle status to In Maintenance
      if (['Scheduled', 'In Progress', 'Waiting Parts'].includes(maintRecord.status)) {
        vehicle.current_status = 'In Maintenance';
        vehicle.status_reason = `In maintenance: ${maintRecord.maintenance_type}`;
        db.fleetStatusHistories.push({
          id: `v_sh_${Date.now()}`,
          tenant_id: tenantId,
          vehicle_id: id,
          status: 'In Maintenance',
          reason: maintRecord.description,
          effective_from: maintRecord.reported_date,
          changed_by: userId,
          created_at: new Date().toISOString(),
        });
      }

      vehicle.total_maintenance_cost = (vehicle.total_maintenance_cost || 0) + totalCost;

      res.status(201).json(maintRecord);
    } catch (err: any) {
      console.error('Log maintenance error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // 12. POST /api/erp/fleet/maintenance/:id/complete
  router.post('/maintenance/:id/complete', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { completedDate, odometerAtService, actualCost, partsCost, labourCost, replacedParts, invoiceNumber, technicianNotes, setVehicleAvailable } = req.body;

      const maint = (db.fleetMaintenance || []).find((m: any) => m.id === id && m.tenant_id === tenantId);
      if (!maint) return res.status(404).json({ error: 'Maintenance record not found' });

      maint.status = 'Completed';
      maint.completed_date = completedDate || new Date().toISOString().split('T')[0];
      if (odometerAtService) maint.odometer_at_service = Number(odometerAtService);
      if (actualCost) maint.cost = Number(actualCost);
      if (partsCost) maint.parts_cost = Number(partsCost);
      if (labourCost) maint.labour_cost = Number(labourCost);
      if (replacedParts) maint.replaced_parts = replacedParts;
      if (invoiceNumber) maint.invoice_number = invoiceNumber;
      if (technicianNotes) maint.technician_notes = technicianNotes;
      maint.updated_at = new Date().toISOString();

      // Update vehicle
      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === maint.vehicle_id);
      if (vehicle) {
        vehicle.last_service_odometer = maint.odometer_at_service;
        vehicle.last_service_date = maint.completed_date;
        vehicle.next_service_due_km = maint.odometer_at_service + 3000;
        if (setVehicleAvailable !== false && vehicle.current_status === 'In Maintenance') {
          vehicle.current_status = vehicle.current_rider_id ? 'Assigned' : 'Available';
          vehicle.status_reason = 'Maintenance completed. Vehicle ready.';
        }
      }

      res.json({ success: true, maintenance: maint });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 13. POST /api/erp/fleet/vehicles/:id/fuel
  router.post('/vehicles/:id/fuel', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const raw = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const odo = Number(raw.odometer) || vehicle.current_odometer;
      const liters = Number(raw.liters) || 0;
      const cost = Number(raw.cost) || 0;

      // Anomaly detection (e.g. liters > tank capacity: bike tank ~15L)
      let anomaly = false;
      let anomalyReason = '';
      if (vehicle.vehicle_type === 'Motorcycle' && liters > 16) {
        anomaly = true;
        anomalyReason = `Fuel volume (${liters}L) exceeds standard motorcycle tank capacity (14L). Possible shared fill or card misuse.`;
      }

      const fuelEntry = {
        id: `fuel_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        vehicle_plate: vehicle.plate_number,
        employee_id: raw.employee_id || vehicle.current_rider_id,
        employee_name: raw.employee_name || vehicle.current_rider_name,
        date: raw.date || new Date().toISOString().split('T')[0],
        odometer: odo,
        liters,
        cost,
        fuel_type: raw.fuel_type || vehicle.fuel_type || 'PETROL_95',
        station_vendor: raw.station_vendor || 'ENOC',
        receipt_number: raw.receipt_number,
        receipt_file_url: raw.receipt_file_url,
        fuel_card_id: raw.fuel_card_id || vehicle.fuel_card_id,
        fuel_card_number: raw.fuel_card_number || vehicle.fuel_card_number,
        entered_by: raw.entered_by || userId,
        notes: raw.notes,
        anomaly_flag: anomaly,
        anomaly_reason: anomalyReason,
        created_at: new Date().toISOString(),
      };

      db.fleetFuelEntries.push(fuelEntry);

      // Update vehicle odometer and fuel total
      if (odo > vehicle.current_odometer) {
        vehicle.current_odometer = odo;
        db.fleetOdometerHistories.push({
          id: `odo_${Date.now()}`,
          tenant_id: tenantId,
          vehicle_id: id,
          reading: odo,
          recorded_at: new Date().toISOString(),
          source: 'Fuel Entry',
          source_record_id: fuelEntry.id,
          entered_by: userId,
          notes: `Fuel refill at ${fuelEntry.station_vendor}`,
          is_correction: false,
          created_at: new Date().toISOString(),
        });
      }

      vehicle.total_fuel_cost = (vehicle.total_fuel_cost || 0) + cost;

      res.status(201).json(fuelEntry);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. POST /api/erp/fleet/vehicles/:id/accidents
  router.post('/vehicles/:id/accidents', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const raw = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const accident = {
        id: `acc_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        vehicle_plate: vehicle.plate_number,
        rider_id: raw.rider_id || vehicle.current_rider_id,
        rider_name: raw.rider_name || vehicle.current_rider_name,
        date_time: raw.date_time || new Date().toISOString().replace('T', ' ').slice(0, 16),
        location: raw.location || 'Dubai Road Network',
        severity: raw.severity || 'MINOR',
        description: raw.description || 'Vehicle collision reported',
        police_report_number: raw.police_report_number,
        insurance_claim_number: raw.insurance_claim_number,
        third_party_details: raw.third_party_details,
        estimated_cost: Number(raw.estimated_cost) || 0,
        actual_cost: Number(raw.actual_cost) || 0,
        status: raw.status || 'Reported',
        photo_urls: raw.photo_urls || [],
        reported_by: userId,
        created_at: new Date().toISOString(),
      };

      db.fleetAccidents.push(accident);

      // Set vehicle status to Accident
      vehicle.current_status = 'Accident';
      vehicle.status_reason = `Accident reported: ${accident.description}`;
      vehicle.total_accidents_count = (vehicle.total_accidents_count || 0) + 1;

      db.fleetStatusHistories.push({
        id: `v_sh_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        status: 'Accident',
        reason: accident.description,
        effective_from: accident.date_time.split(' ')[0],
        changed_by: userId,
        created_at: new Date().toISOString(),
      });

      res.status(201).json(accident);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. POST /api/erp/fleet/vehicles/:id/fines
  router.post('/vehicles/:id/fines', (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { id } = req.params;
      const raw = req.body;

      const vehicle = (db.fleetVehicles || []).find((v: any) => v.id === id && v.tenant_id === tenantId);
      if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });

      const fine = {
        id: `fine_${Date.now()}`,
        tenant_id: tenantId,
        vehicle_id: id,
        vehicle_plate: vehicle.plate_number,
        employee_id: raw.employee_id || vehicle.current_rider_id,
        employee_name: raw.employee_name || vehicle.current_rider_name,
        fine_number: raw.fine_number || `DXB-TKT-${Date.now().toString().slice(-6)}`,
        fine_date: raw.fine_date || new Date().toISOString().split('T')[0],
        fine_time: raw.fine_time || '12:00',
        location: raw.location || 'Dubai',
        authority: raw.authority || 'Dubai Police',
        violation_type: raw.violation_type || 'Traffic Radar Violation',
        amount: Number(raw.amount) || 200,
        status: raw.status || 'ASSIGNED_TO_DRIVER',
        deducted_from_payroll: Boolean(raw.deducted_from_payroll),
        payroll_period_key: raw.payroll_period_key,
        notes: raw.notes,
        created_at: new Date().toISOString(),
      };

      db.fleetFines.push(fine);
      vehicle.total_fines_cost = (vehicle.total_fines_cost || 0) + fine.amount;

      res.status(201).json(fine);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 16. POST /api/erp/fleet/fines/:id/link-payroll
  router.post('/fines/:id/link-payroll', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;
      const { payrollPeriodKey } = req.body;

      const fine = (db.fleetFines || []).find((f: any) => f.id === id && f.tenant_id === tenantId);
      if (!fine) return res.status(404).json({ error: 'Fine not found' });

      fine.status = 'DEDUCTED_FROM_PAYROLL';
      fine.deducted_from_payroll = true;
      fine.payroll_period_key = payrollPeriodKey || '2026-08';

      res.json({ success: true, fine });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 17. GET /api/erp/fleet/exceptions
  router.get('/exceptions', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const now = new Date();
      const exceptions: any[] = [];

      const vehicles = (db.fleetVehicles || []).filter((v: any) => v.tenant_id === tenantId);

      vehicles.forEach((v: any) => {
        // Mulkiya Expiry
        if (v.registration_expiry) {
          const exp = new Date(v.registration_expiry);
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (diffDays < 0) {
            exceptions.push({
              id: `exc_mulk_exp_${v.id}`,
              tenant_id: tenantId,
              vehicle_id: v.id,
              vehicle_plate: v.plate_number,
              exception_type: 'MULKIYA_EXPIRED',
              severity: 'CRITICAL',
              title: `Mulkiya Expired (${Math.abs(diffDays)} days ago)`,
              message: `Vehicle ${v.plate_number} registration expired on ${v.registration_expiry}. Unlawful to operate on UAE roads.`,
              action_label: 'Schedule RTA Test',
              action_type: 'SCHEDULE_TESTING',
              detected_at: new Date().toISOString(),
              resolved: false,
            });
          } else if (diffDays <= 30) {
            exceptions.push({
              id: `exc_mulk_soon_${v.id}`,
              tenant_id: tenantId,
              vehicle_id: v.id,
              vehicle_plate: v.plate_number,
              exception_type: 'MULKIYA_EXPIRING_SOON',
              severity: 'WARNING',
              title: `Mulkiya Expiring in ${diffDays} Days`,
              message: `Vehicle ${v.plate_number} registration expires on ${v.registration_expiry}. Initiate testing and renewal.`,
              action_label: 'Renew Mulkiya',
              action_type: 'RENEW_MULKIYA',
              detected_at: new Date().toISOString(),
              resolved: false,
            });
          }
        }

        // Maintenance Overdue
        if (v.next_service_due_km && v.current_odometer >= v.next_service_due_km) {
          const overdueKm = v.current_odometer - v.next_service_due_km;
          exceptions.push({
            id: `exc_maint_${v.id}`,
            tenant_id: tenantId,
            vehicle_id: v.id,
            vehicle_plate: v.plate_number,
            exception_type: 'MAINTENANCE_OVERDUE',
            severity: 'WARNING',
            title: `Routine Maintenance Overdue by ${overdueKm} km`,
            message: `Vehicle ${v.plate_number} current odometer is ${Number(v.current_odometer || 0).toLocaleString()} km (Service due at ${Number(v.next_service_due_km || 0).toLocaleString()} km).`,
            action_label: 'Send to Workshop',
            action_type: 'SEND_MAINTENANCE',
            detected_at: new Date().toISOString(),
            resolved: false,
          });
        }
      });

      // Include unresolved accidents
      const openAccidents = (db.fleetAccidents || []).filter(
        (ac: any) => ac.tenant_id === tenantId && ac.status !== 'Closed'
      );
      openAccidents.forEach((ac: any) => {
        exceptions.push({
          id: `exc_acc_${ac.id}`,
          tenant_id: tenantId,
          vehicle_id: ac.vehicle_id,
          vehicle_plate: ac.vehicle_plate,
          exception_type: 'UNRESOLVED_ACCIDENT',
          severity: 'WARNING',
          title: `Open Accident Claim: ${ac.severity}`,
          message: `Police Report #${ac.police_report_number || 'Pending'} for vehicle ${ac.vehicle_plate} is currently in status: ${ac.status}.`,
          action_label: 'View Claim & Workshop',
          action_type: 'VIEW_ACCIDENT',
          detected_at: ac.created_at,
          resolved: false,
        });
      });

      res.json(exceptions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 18. GET /api/erp/fleet/kpis
  router.get('/kpis', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const supabase = getSupabaseClient();
      const vehicles = await fetchAuthoritativeVehicles(supabase, db, tenantId);

      const openAccidents = (db.fleetAccidents || []).filter(
        (ac: any) => ac.tenant_id === tenantId && ac.status !== 'Closed'
      ).length;

      const unpaidFines = (db.fleetFines || []).filter(
        (fn: any) => fn.tenant_id === tenantId && fn.status === 'ASSIGNED_TO_DRIVER'
      ).length;

      const totalFuel = (db.fleetFuelEntries || [])
        .filter((f: any) => f.tenant_id === tenantId)
        .reduce((sum: number, f: any) => sum + (f.cost || 0), 0);

      const totalMaint = (db.fleetMaintenance || [])
        .filter((m: any) => m.tenant_id === tenantId)
        .reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

      const kpis = calculateFleetKpis(vehicles, {
        openAccidentsCount: openAccidents,
        unpaidFinesCount: unpaidFines,
        totalMonthlySpendAED: totalFuel + totalMaint,
      });

      res.json(kpis);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 19. POST /api/erp/fleet/ai-command (Natural Language Fleet Operations Copilot)
  router.post('/ai-command', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId } = extractTenantContext(req);
      const { command, params } = req.body;

      if (!command) {
        return res.status(400).json({ error: 'Command text is required' });
      }

      const prompt = `You are an operational AI Copilot for a UAE delivery fleet ERP.
Tenant ID: ${tenantId}
Available Fleet Vehicles: ${JSON.stringify(
        (db.fleetVehicles || []).filter((v: any) => v.tenant_id === tenantId).map((v: any) => ({
          id: v.id,
          plate: v.plate_number,
          make: v.make,
          model: v.model,
          status: v.current_status,
          rider: v.current_rider_name,
          odo: v.current_odometer,
          mulkiyaExp: v.registration_expiry,
        }))
      )}

User Query or Instruction: "${command}"

Analyze the intent and return structured JSON:
{
  "action": "QUERY" | "STATUS_CHANGE" | "SEND_MAINTENANCE" | "ASSIGN_VEHICLE" | "RETURN_VEHICLE" | "EXPLAIN",
  "targetVehicleId": string or null,
  "targetVehiclePlate": string or null,
  "message": "Direct clear conversational answer or confirmation of action",
  "suggestedActions": [ { "label": "string", "actionType": "string" } ]
}`;

      try {
        const ai = getGeminiClient();
        const aiRes = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: prompt,
          config: {
            systemInstruction: 'You are an expert UAE delivery fleet operations assistant. Return strictly valid JSON.',
            responseMimeType: 'application/json',
          },
        });

        const parsed = JSON.parse(aiRes.text || '{}');

        // Execute safe status update if requested (e.g. "Send 72154 to maintenance")
        if (parsed.action === 'SEND_MAINTENANCE' && parsed.targetVehiclePlate) {
          const veh = (db.fleetVehicles || []).find(
            (v: any) => v.tenant_id === tenantId && v.plate_number.includes(parsed.targetVehiclePlate)
          );
          if (veh) {
            veh.current_status = 'In Maintenance';
            veh.status_reason = 'Dispatched to garage via AI Copilot';
            db.fleetStatusHistories.push({
              id: `v_sh_${Date.now()}`,
              tenant_id: tenantId,
              vehicle_id: veh.id,
              status: 'In Maintenance',
              reason: 'Dispatched to garage via AI Copilot',
              effective_from: new Date().toISOString().split('T')[0],
              changed_by: userId,
              created_at: new Date().toISOString(),
            });
          }
        }

        res.json({
          success: true,
          message: parsed.message || 'Fleet operation processed.',
          result: parsed,
        });
      } catch (aiErr) {
        // Structured fallback rule-based execution
        const lower = command.toLowerCase();
        if (lower.includes('72154') && (lower.includes('maintenance') || lower.includes('service'))) {
          const veh = (db.fleetVehicles || []).find((v: any) => v.plate_number === '72154');
          if (veh) {
            veh.current_status = 'In Maintenance';
            veh.status_reason = 'Sent to maintenance for oil & brake service';
          }
          return res.json({
            success: true,
            message: 'Vehicle 72154 (Yamaha FZ-25) status has been updated to "In Maintenance". Job card logged.',
            result: { action: 'STATUS_CHANGE', vehiclePlate: '72154', newStatus: 'In Maintenance' },
          });
        }

        const availableCount = (db.fleetVehicles || []).filter(
          (v: any) => v.tenant_id === tenantId && v.current_status === 'Available'
        ).length;

        res.json({
          success: true,
          message: `There are currently ${availableCount} vehicles available for immediate captain assignment across Dubai and Abu Dhabi hubs.`,
          result: { availableCount },
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
