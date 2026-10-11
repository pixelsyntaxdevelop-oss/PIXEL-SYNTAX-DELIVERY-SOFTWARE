import { Router, Request, Response } from 'express';
import {
  SalikRecord,
  SalikHistoryEntry,
  SalikFinancialStats,
  SalikBatchRow,
  SalikBatchValidationResult,
} from '../src/types/salik';

export const initialSalikRecords: SalikRecord[] = [
  {
    id: 'slk_01',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    transaction_id: 'SLK-DXB-2026-88019',
    transaction_date: '2026-08-12',
    transaction_time: '09:14:00',
    transaction_timestamp: '2026-08-12T09:14:00Z',
    toll_gate: 'Al Barsha',
    direction: 'Southbound',
    tag_number: '0010992451',
    plate_number: '72154',
    plate_code: 'T',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_72154',
    vehicle_code: 'VH-1001',
    vehicle_type: 'Motorcycle',
    amount: 4.0,
    assigned_employee_id: 'emp_01',
    assigned_employee_name: 'Muhammad Adnan',
    assigned_employee_code: 'EMP-1001',
    assigned_project_id: 'proj_talabat',
    assigned_project_name: 'Talabat Express Hub',
    allocation_source: 'AUTO_HISTORY',
    allocated_at: '2026-08-12T09:30:00Z',
    allocated_by: 'Ali Raza Khan (Fleet Dispatch)',
    charge_status: 'CHARGED',
    status: 'ALLOCATED',
    payroll_period: '2026-08',
    company_liability: 0,
    employee_liability: 4.0,
    notes: 'Morning express delivery crossing on Sheikh Zayed Road',
    source_type: 'TOLL_UPLOAD',
    reference: 'SLK-REF-991024',
    history: [
      {
        id: 'h_slk_01_1',
        timestamp: '2026-08-12T09:30:00Z',
        actor_name: 'Ali Raza Khan (Fleet Dispatch)',
        actor_id: 'user_emp_2',
        actor_role: 'Fleet Manager',
        event_type: 'IMPORTED',
        new_state: 'PENDING',
        notes: 'Imported toll crossing SLK-DXB-2026-88019 for plate 72154',
      },
      {
        id: 'h_slk_01_2',
        timestamp: '2026-08-12T09:30:05Z',
        actor_name: 'System Historical Resolver',
        event_type: 'AUTO_ASSIGNED',
        old_state: 'PENDING',
        new_state: 'ALLOCATED',
        reason: 'Vehicle 72154 was active under Muhammad Adnan (EMP-1001) at 2026-08-12 09:14:00',
      },
    ],
    created_by: 'Ali Raza Khan (Fleet Dispatch)',
    created_at: '2026-08-12T09:30:00Z',
    updated_by: 'Ali Raza Khan (Fleet Dispatch)',
    updated_at: '2026-08-12T09:30:05Z',
  },
  {
    id: 'slk_02',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    transaction_id: 'SLK-DXB-2026-88020',
    transaction_date: '2026-08-12',
    transaction_time: '16:45:00',
    transaction_timestamp: '2026-08-12T16:45:00Z',
    toll_gate: 'Al Safa',
    direction: 'Northbound',
    tag_number: '0010992451',
    plate_number: '72154',
    plate_code: 'T',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_72154',
    vehicle_code: 'VH-1001',
    vehicle_type: 'Motorcycle',
    amount: 4.0,
    assigned_employee_id: 'emp_01',
    assigned_employee_name: 'Muhammad Adnan',
    assigned_employee_code: 'EMP-1001',
    assigned_project_id: 'proj_talabat',
    assigned_project_name: 'Talabat Express Hub',
    allocation_source: 'AUTO_HISTORY',
    allocated_at: '2026-08-12T17:00:00Z',
    allocated_by: 'Ali Raza Khan (Fleet Dispatch)',
    charge_status: 'CHARGED',
    status: 'PAYROLL_LINKED',
    payroll_period: '2026-08',
    deducted_amount: 4.0,
    company_liability: 0,
    employee_liability: 4.0,
    notes: 'Afternoon return toll crossing',
    source_type: 'TOLL_UPLOAD',
    payroll_linked_by: 'Hassan Tariq (HR & Payroll)',
    payroll_linked_at: '2026-08-31T11:00:00Z',
    history: [
      {
        id: 'h_slk_02_1',
        timestamp: '2026-08-12T17:00:00Z',
        actor_name: 'Ali Raza Khan (Fleet Dispatch)',
        event_type: 'IMPORTED',
        new_state: 'ALLOCATED',
        notes: 'Imported and auto-assigned toll crossing',
      },
      {
        id: 'h_slk_02_2',
        timestamp: '2026-08-31T11:00:00Z',
        actor_name: 'Hassan Tariq (HR & Payroll)',
        event_type: 'PAYROLL_LINKED',
        old_state: 'ALLOCATED',
        new_state: 'PAYROLL_LINKED',
        reason: 'Linked to August 2026 payroll run',
      },
    ],
    created_by: 'Ali Raza Khan (Fleet Dispatch)',
    created_at: '2026-08-12T17:00:00Z',
    updated_by: 'Hassan Tariq (HR & Payroll)',
    updated_at: '2026-08-31T11:00:00Z',
  },
  {
    id: 'slk_03',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    transaction_id: 'SLK-DXB-2026-88025',
    transaction_date: '2026-08-14',
    transaction_time: '11:20:00',
    transaction_timestamp: '2026-08-14T11:20:00Z',
    toll_gate: 'Airport Tunnel',
    direction: 'Eastbound',
    tag_number: '0010992452',
    plate_number: '49102',
    plate_code: 'A',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_49102',
    vehicle_code: 'VH-1002',
    vehicle_type: 'Motorcycle',
    amount: 4.0,
    assigned_employee_id: 'emp_05',
    assigned_employee_name: 'Tariq Mansoor',
    assigned_employee_code: 'EMP-1005',
    assigned_project_id: 'proj_careem',
    assigned_project_name: 'Careem Food & Box',
    allocation_source: 'AUTO_HISTORY',
    allocated_at: '2026-08-14T12:00:00Z',
    allocated_by: 'Ali Raza Khan (Fleet Dispatch)',
    charge_status: 'CHARGED',
    status: 'ALLOCATED',
    payroll_period: '2026-08',
    company_liability: 0,
    employee_liability: 4.0,
    notes: 'Airport Tunnel toll crossing on Careem express order',
    source_type: 'TOLL_UPLOAD',
    history: [
      {
        id: 'h_slk_03_1',
        timestamp: '2026-08-14T12:00:00Z',
        actor_name: 'Ali Raza Khan (Fleet Dispatch)',
        event_type: 'IMPORTED',
        new_state: 'ALLOCATED',
        notes: 'Imported and auto-assigned to Tariq Mansoor',
      },
    ],
    created_by: 'Ali Raza Khan (Fleet Dispatch)',
    created_at: '2026-08-14T12:00:00Z',
    updated_by: 'Ali Raza Khan (Fleet Dispatch)',
    updated_at: '2026-08-14T12:00:00Z',
  },
  {
    id: 'slk_04',
    tenant_id: 'company_demo',
    branch_id: 'b_auh',
    branch_name: 'Abu Dhabi Operations Branch',
    transaction_id: 'SLK-DXB-2026-88031',
    transaction_date: '2026-08-18',
    transaction_time: '15:10:00',
    transaction_timestamp: '2026-08-18T15:10:00Z',
    toll_gate: 'Al Maktoum Bridge',
    direction: 'Northbound',
    tag_number: '0010992453',
    plate_number: '33912',
    plate_code: 'D',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_33912',
    vehicle_code: 'VH-1004',
    vehicle_type: 'Van',
    amount: 4.0,
    assigned_employee_id: 'emp_04',
    assigned_employee_name: 'Rashid Khan',
    assigned_employee_code: 'EMP-1004',
    assigned_project_id: 'proj_amazon',
    assigned_project_name: 'Amazon Last-Mile Vans',
    allocation_source: 'COMPANY',
    allocated_at: '2026-08-18T16:00:00Z',
    allocated_by: 'Sarah Al-Mahmoud (Operations VP)',
    charge_status: 'COMPANY_LIABILITY',
    status: 'COMPANY_LIABILITY',
    company_liability: 4.0,
    employee_liability: 0,
    notes: 'Amazon inter-depot trunk line transfer - approved company operational liability',
    source_type: 'TOLL_UPLOAD',
    history: [
      {
        id: 'h_slk_04_1',
        timestamp: '2026-08-18T15:30:00Z',
        actor_name: 'Ali Raza Khan (Fleet Dispatch)',
        event_type: 'IMPORTED',
        new_state: 'PENDING',
      },
      {
        id: 'h_slk_04_2',
        timestamp: '2026-08-18T16:00:00Z',
        actor_name: 'Sarah Al-Mahmoud (Operations VP)',
        event_type: 'LIABILITY_CHANGED',
        old_state: 'PENDING',
        new_state: 'COMPANY_LIABILITY',
        reason: 'Authorized company expense for warehouse logistics route',
      },
    ],
    created_by: 'Ali Raza Khan (Fleet Dispatch)',
    created_at: '2026-08-18T15:30:00Z',
    updated_by: 'Sarah Al-Mahmoud (Operations VP)',
    updated_at: '2026-08-18T16:00:00Z',
  },
  {
    id: 'slk_05',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    transaction_id: 'SLK-DXB-2026-88040',
    transaction_date: '2026-08-22',
    transaction_time: '20:15:00',
    transaction_timestamp: '2026-08-22T20:15:00Z',
    toll_gate: 'Al Barsha',
    direction: 'Southbound',
    tag_number: '0010992454',
    plate_number: '88210',
    plate_code: 'K',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_88210',
    vehicle_code: 'VH-1003',
    vehicle_type: 'Motorcycle',
    amount: 4.0,
    allocation_source: undefined,
    charge_status: 'UNCHARGED',
    status: 'PENDING',
    company_liability: 0,
    employee_liability: 0,
    notes: 'Pending driver verification - multiple shift handovers around 20:00',
    source_type: 'TOLL_UPLOAD',
    history: [
      {
        id: 'h_slk_05_1',
        timestamp: '2026-08-23T08:00:00Z',
        actor_name: 'Ali Raza Khan (Fleet Dispatch)',
        event_type: 'IMPORTED',
        new_state: 'PENDING',
        notes: 'Imported crossing; awaiting handover logs verification',
      },
    ],
    created_by: 'Ali Raza Khan (Fleet Dispatch)',
    created_at: '2026-08-23T08:00:00Z',
    updated_by: 'Ali Raza Khan (Fleet Dispatch)',
    updated_at: '2026-08-23T08:00:00Z',
  },
];

export function createSalikRouter(db: any) {
  const router = Router();

  // Initialize DB collection
  if (!db.salikRecords || db.salikRecords.length === 0) {
    db.salikRecords = [...initialSalikRecords];
  }

  // Ensure test bike 72159 exists with exact split historical assignment
  // Rider A (Muhammad Adnan, EMP-1001): Aug 1-15, 2026
  // Rider B (Tariq Mansoor, EMP-1005): Aug 16, 2026 onward
  ensureHistoricalSplitAssignmentFixtures(db);

  function ensureHistoricalSplitAssignmentFixtures(database: any) {
    if (!database.fleetVehicles) database.fleetVehicles = [];
    if (!database.fleetAssignments) database.fleetAssignments = [];

    // Check if veh_72159 exists
    const has72159 = database.fleetVehicles.some(
      (v: any) => v.plate_number === '72159' || v.id === 'veh_72159'
    );
    if (!has72159) {
      database.fleetVehicles.push({
        id: 'veh_72159',
        tenant_id: 'company_demo',
        vehicle_code: 'VH-1005',
        vehicle_type: 'Motorcycle',
        plate_number: '72159',
        plate_code: 'A',
        plate_emirate: 'Dubai',
        make: 'Bajaj',
        model: 'Pulsar 150',
        year: 2024,
        ownership_type: 'OWNED',
        owner_or_vendor: 'Pixel Syntax Delivery Software',
        branch_id: 'b_dxb',
        branch_name: 'Dubai Central HQ',
        project_id: 'proj_talabat',
        project_name: 'Talabat Express Hub',
        current_status: 'Assigned',
        current_rider_id: 'emp_05',
        current_rider_name: 'Tariq Mansoor',
        current_rider_code: 'EMP-1005',
        gps_device_id: 'TAG-DXB-72159',
        created_at: '2024-01-10T08:00:00Z',
      });
    }

    // Check if historical split assignments exist
    const hasSplitA = database.fleetAssignments.some(
      (a: any) => a.vehicle_plate === '72159' && a.employee_id === 'emp_01'
    );
    if (!hasSplitA) {
      database.fleetAssignments.push({
        id: 'asgn_72159_a',
        tenant_id: 'company_demo',
        vehicle_id: 'veh_72159',
        vehicle_plate: '72159',
        vehicle_model: 'Bajaj Pulsar 150',
        employee_id: 'emp_01',
        employee_name: 'Muhammad Adnan',
        employee_code: 'EMP-1001',
        project_id: 'proj_talabat',
        project_name: 'Talabat Express Hub',
        branch_id: 'b_dxb',
        assignment_date: '2026-08-01',
        assignment_time: '00:00:00',
        return_date: '2026-08-15',
        return_time: '23:59:59',
        assignment_status: 'RETURNED',
        handover_notes: 'Rider A shift period Aug 1 - Aug 15',
        created_at: '2026-08-01T00:00:00Z',
      });
    }

    const hasSplitB = database.fleetAssignments.some(
      (a: any) => a.vehicle_plate === '72159' && a.employee_id === 'emp_05'
    );
    if (!hasSplitB) {
      database.fleetAssignments.push({
        id: 'asgn_72159_b',
        tenant_id: 'company_demo',
        vehicle_id: 'veh_72159',
        vehicle_plate: '72159',
        vehicle_model: 'Bajaj Pulsar 150',
        employee_id: 'emp_05',
        employee_name: 'Tariq Mansoor',
        employee_code: 'EMP-1005',
        project_id: 'proj_careem',
        project_name: 'Careem Food & Box',
        branch_id: 'b_dxb',
        assignment_date: '2026-08-16',
        assignment_time: '00:00:00',
        assignment_status: 'ACTIVE',
        handover_notes: 'Rider B shift period Aug 16 onward',
        created_at: '2026-08-16T00:00:00Z',
      });
    }
  }

  // Tenant and authenticated actor extraction helper
  function extractTenantContext(req: Request) {
    const authHeader = req.headers.authorization;
    let tenantId = (req.headers['x-tenant-id'] as string) || (req as any).tenantId || 'company_demo';
    let userId = (req.headers['x-user-id'] as string) || 'user_emp_2';
    let userRole = (req.headers['x-user-role'] as string) || 'FLEET_MANAGER';
    let userName = 'Ali Raza Khan (Fleet Dispatch)';

    if (authHeader && authHeader.startsWith('Bearer mock-token-')) {
      const parts = authHeader.replace('Bearer mock-token-', '').split('-');
      if (parts[0]) userId = parts[0];
      const matchedUser = (db.users || []).find((u: any) => u.id === userId);
      if (matchedUser) {
        if (!req.headers['x-tenant-id']) {
          tenantId = matchedUser.tenantId || tenantId;
        }
        userRole = matchedUser.role || userRole;
        userName = matchedUser.fullName || matchedUser.username || userName;
      }
    }

    return { tenantId, userId, userRole, userName };
  }

  // Exact timestamp-based historical rider resolution
  function resolveHistoricalRider(
    plateNumber: string,
    transactionDate: string,
    transactionTime: string = '12:00:00',
    tenantId: string
  ) {
    const cleanPlate = (plateNumber || '').trim().toUpperCase();
    if (!cleanPlate) return null;

    const txDateTime = `${transactionDate}T${transactionTime.length === 5 ? transactionTime + ':00' : transactionTime}Z`;

    // 1. First find vehicle
    const vehicle = (db.fleetVehicles || []).find(
      (v: any) =>
        v.tenant_id === tenantId &&
        (v.plate_number?.toUpperCase() === cleanPlate ||
          v.id === cleanPlate ||
          v.vehicle_code?.toUpperCase() === cleanPlate)
    );

    const vehicleId = vehicle ? vehicle.id : null;

    // 2. Search vehicle assignments
    const allAssignments = db.fleetAssignments || [];
    const matchingAssignments = allAssignments.filter((a: any) => {
      if (a.tenant_id !== tenantId) return false;
      const plateMatches =
        a.vehicle_plate?.toUpperCase() === cleanPlate ||
        (vehicleId && a.vehicle_id === vehicleId);
      if (!plateMatches) return false;

      // Start timestamp
      const startDateTime = `${a.assignment_date}T${a.assignment_time ? (a.assignment_time.length === 5 ? a.assignment_time + ':00' : a.assignment_time) : '00:00:00'}Z`;
      if (startDateTime > txDateTime) return false;

      // End timestamp
      if (a.return_date) {
        const endDateTime = `${a.return_date}T${a.return_time ? (a.return_time.length === 5 ? a.return_time + ':00' : a.return_time) : '23:59:59'}Z`;
        if (txDateTime > endDateTime) return false;
      } else if (a.assignment_status === 'RETURNED') {
        // If marked returned without return_date, default to today
        return false;
      }

      return true;
    });

    if (matchingAssignments.length === 1) {
      const asgn = matchingAssignments[0];
      return {
        rider_id: asgn.employee_id,
        rider_name: asgn.employee_name,
        rider_code: asgn.employee_code,
        project_id: asgn.project_id,
        project_name: asgn.project_name,
        assignment_id: asgn.id,
        confidence: 'HISTORICAL_EXACT',
        vehicle,
      };
    }

    if (matchingAssignments.length > 1) {
      // Pick the most recent start
      matchingAssignments.sort((a: any, b: any) =>
        `${b.assignment_date}T${b.assignment_time || '00:00:00'}`.localeCompare(
          `${a.assignment_date}T${a.assignment_time || '00:00:00'}`
        )
      );
      const asgn = matchingAssignments[0];
      return {
        rider_id: asgn.employee_id,
        rider_name: asgn.employee_name,
        rider_code: asgn.employee_code,
        project_id: asgn.project_id,
        project_name: asgn.project_name,
        assignment_id: asgn.id,
        confidence: 'HISTORICAL_BEST_MATCH',
        vehicle,
      };
    }

    // If no assignment record was active at this exact timestamp, return vehicle only (NO fake rider!)
    return {
      rider_id: null,
      rider_name: null,
      rider_code: null,
      project_id: null,
      project_name: null,
      assignment_id: null,
      confidence: 'NO_ASSIGNMENT_AT_TIMESTAMP',
      vehicle,
    };
  }

  // 1. GET /api/erp/salik/meta
  router.get('/meta', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const tenantBranches = (db.branches || []).filter(
      (b: any) => b.tenant_id === tenantId
    );

    const tollGates = [
      'Al Barsha',
      'Al Safa',
      'Al Maktoum Bridge',
      'Al Mamzar North',
      'Al Mamzar South',
      'Airport Tunnel',
      'Jebel Ali',
      'Business Bay',
    ];

    const currentMonth = new Date().toISOString().slice(0, 7);

    res.json({
      branches: tenantBranches,
      tollGates,
      currentMonth,
      standardRate: 4.0,
    });
  });

  // 2. GET /api/erp/salik/stats (Real database aggregation)
  router.get('/stats', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const { from, to, tollGate, chargeFilter, search } = req.query;

    let records: SalikRecord[] = (db.salikRecords || []).filter(
      (s: SalikRecord) => s.tenant_id === tenantId
    );

    // Apply date range
    if (from && typeof from === 'string' && from.trim() !== '') {
      records = records.filter((r) => r.transaction_date >= from);
    }
    if (to && typeof to === 'string' && to.trim() !== '') {
      records = records.filter((r) => r.transaction_date <= to);
    }

    // Apply toll gate
    if (tollGate && typeof tollGate === 'string' && tollGate !== 'ALL') {
      records = records.filter((r) => r.toll_gate === tollGate);
    }

    // Aggregations
    let totalSalikAmount = 0;
    let chargedToEmployees = 0;
    let unchargedPending = 0;
    let companyLiability = 0;
    let outstandingBalance = 0;
    let totalCount = records.length;
    let chargedCount = 0;
    let unchargedCount = 0;
    let companyLiabilityCount = 0;

    for (const r of records) {
      const amt = Number(r.amount) || 0;
      totalSalikAmount += amt;

      if (r.charge_status === 'CHARGED') {
        chargedToEmployees += Number(r.employee_liability) || amt;
        chargedCount++;
        if (r.status !== 'PAYROLL_LINKED' && r.status !== 'PAID') {
          outstandingBalance += Number(r.employee_liability) || amt;
        }
      } else if (r.charge_status === 'COMPANY_LIABILITY') {
        companyLiability += Number(r.company_liability) || amt;
        companyLiabilityCount++;
      } else {
        unchargedPending += amt;
        unchargedCount++;
      }
    }

    // Safe 2 decimal rounding
    totalSalikAmount = Math.round(totalSalikAmount * 100) / 100;
    chargedToEmployees = Math.round(chargedToEmployees * 100) / 100;
    unchargedPending = Math.round(unchargedPending * 100) / 100;
    companyLiability = Math.round(companyLiability * 100) / 100;
    outstandingBalance = Math.round(outstandingBalance * 100) / 100;

    const stats: SalikFinancialStats = {
      totalSalikAmount,
      chargedToEmployees,
      unchargedPending,
      companyLiability,
      outstandingBalance,
      totalCount,
      chargedCount,
      unchargedCount,
      companyLiabilityCount,
    };

    res.json(stats);
  });

  // 3. GET /api/erp/salik (Server-side paginated & filtered list)
  router.get('/', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const {
      from,
      to,
      chargeFilter,
      tollGate,
      search,
      page = '1',
      pageSize = '25',
    } = req.query;

    let records: SalikRecord[] = (db.salikRecords || []).filter(
      (s: SalikRecord) => s.tenant_id === tenantId
    );

    // 1. Date Range Filter
    if (from && typeof from === 'string' && from.trim() !== '') {
      records = records.filter((r) => r.transaction_date >= from);
    }
    if (to && typeof to === 'string' && to.trim() !== '') {
      records = records.filter((r) => r.transaction_date <= to);
    }

    // 2. Charge Status Filter: 'ALL' | 'CHARGED' | 'UNCHARGED'
    if (chargeFilter && typeof chargeFilter === 'string') {
      const upperFilter = chargeFilter.toUpperCase();
      if (upperFilter === 'CHARGED') {
        records = records.filter(
          (r) =>
            r.charge_status === 'CHARGED' ||
            r.charge_status === 'COMPANY_LIABILITY' ||
            r.status === 'ALLOCATED' ||
            r.status === 'PAYROLL_LINKED' ||
            r.status === 'PAID'
        );
      } else if (upperFilter === 'UNCHARGED') {
        records = records.filter(
          (r) =>
            r.charge_status === 'UNCHARGED' ||
            r.status === 'PENDING'
        );
      }
    }

    // 3. Toll Gate Filter
    if (tollGate && typeof tollGate === 'string' && tollGate !== 'ALL') {
      records = records.filter((r) => r.toll_gate === tollGate);
    }

    // 4. Search Filter (Transaction ID, Plate Number, Plate Code, Gate, Tag, Employee Name/Code, Project, Reference)
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      records = records.filter((r) => {
        return (
          r.transaction_id?.toLowerCase().includes(q) ||
          r.plate_number?.toLowerCase().includes(q) ||
          r.plate_code?.toLowerCase().includes(q) ||
          r.toll_gate?.toLowerCase().includes(q) ||
          r.tag_number?.toLowerCase().includes(q) ||
          r.assigned_employee_name?.toLowerCase().includes(q) ||
          r.assigned_employee_code?.toLowerCase().includes(q) ||
          r.assigned_project_name?.toLowerCase().includes(q) ||
          r.reference?.toLowerCase().includes(q) ||
          r.notes?.toLowerCase().includes(q)
        );
      });
    }

    // Sort by transaction_timestamp descending
    records.sort((a, b) => {
      const timeA = a.transaction_timestamp || `${a.transaction_date}T${a.transaction_time || '00:00:00'}`;
      const timeB = b.transaction_timestamp || `${b.transaction_date}T${b.transaction_time || '00:00:00'}`;
      return timeB.localeCompare(timeA);
    });

    const total = records.length;
    const p = Math.max(1, parseInt(page as string, 10) || 1);
    const size = Math.max(1, parseInt(pageSize as string, 10) || 25);
    const totalPages = Math.max(1, Math.ceil(total / size));
    const offset = (p - 1) * size;
    const paginated = records.slice(offset, offset + size);

    res.json({
      records: paginated,
      total,
      page: p,
      pageSize: size,
      totalPages,
    });
  });

  // 4. GET /api/erp/salik/:id
  router.get('/:id', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const record = (db.salikRecords || []).find(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );
    if (!record) {
      return res.status(404).json({ error: 'Salik record not found' });
    }
    res.json(record);
  });

  // 5. GET /api/erp/salik/by-employee/:employeeId
  router.get('/by-employee/:employeeId', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const empId = req.params.employeeId;
    const records = (db.salikRecords || []).filter(
      (s: SalikRecord) =>
        s.tenant_id === tenantId &&
        s.assigned_employee_id === empId &&
        s.charge_status === 'CHARGED'
    );
    res.json(records);
  });

  // 6. GET /api/erp/salik/by-vehicle/:vehicleId
  router.get('/by-vehicle/:vehicleId', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const vehId = req.params.vehicleId;
    const records = (db.salikRecords || []).filter(
      (s: SalikRecord) =>
        s.tenant_id === tenantId &&
        (s.vehicle_id === vehId || s.plate_number === vehId)
    );
    res.json(records);
  });

  // 7. POST /api/erp/salik/validate-batch
  router.post('/validate-batch', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Rows array is required' });
    }

    const results: SalikBatchRow[] = [];
    let readyCount = 0;
    let failedCount = 0;

    const seenTxIds = new Set<string>();

    rows.forEach((row: any, idx: number) => {
      const txId = (row.transaction_id || '').trim();
      const plate = (row.plate_number || '').trim().toUpperCase();
      const plateCode = (row.plate_code || '').trim().toUpperCase();
      const txDate = (row.transaction_date || '').trim();
      const txTime = (row.transaction_time || '12:00:00').trim();
      const gate = (row.toll_gate || '').trim();
      const amount = Number(row.amount);

      let status: SalikBatchRow['status'] = 'READY';
      let message = 'Row validated successfully';

      // Duplicate check in existing database
      const existing = (db.salikRecords || []).find(
        (s: SalikRecord) =>
          s.tenant_id === tenantId &&
          (txId && s.transaction_id.toLowerCase() === txId.toLowerCase() ||
            (s.plate_number === plate &&
              s.transaction_date === txDate &&
              s.transaction_time?.slice(0, 5) === txTime.slice(0, 5) &&
              s.toll_gate.toLowerCase() === gate.toLowerCase()))
      );

      if (existing) {
        status = 'DUPLICATE_TRANSACTION';
        message = `Toll transaction already exists (ID: ${existing.transaction_id || txId})`;
      } else if (txId && seenTxIds.has(txId.toLowerCase())) {
        status = 'DUPLICATE_TRANSACTION';
        message = `Duplicate transaction ID in current batch: ${txId}`;
      } else if (!txDate || isNaN(Date.parse(txDate))) {
        status = 'INVALID_DATE';
        message = 'Invalid transaction date format (YYYY-MM-DD required)';
      } else if (isNaN(amount) || amount <= 0) {
        status = 'INVALID_AMOUNT';
        message = 'Amount must be greater than 0 AED';
      } else if (!plate) {
        status = 'PLATE_NOT_FOUND';
        message = 'Plate number is required';
      }

      if (txId) seenTxIds.add(txId.toLowerCase());

      // Vehicle resolution
      let resolvedVehicle: any = null;
      let resolvedRiderInfo: any = null;

      if (status === 'READY') {
        const resolution = resolveHistoricalRider(plate, txDate, txTime, tenantId);
        if (resolution && resolution.vehicle) {
          resolvedVehicle = resolution.vehicle;
          if (resolution.rider_id) {
            resolvedRiderInfo = {
              rider_id: resolution.rider_id,
              rider_name: resolution.rider_name,
              rider_code: resolution.rider_code,
              project_id: resolution.project_id,
              project_name: resolution.project_name,
              confidence: resolution.confidence,
            };
          }
        } else {
          status = 'VEHICLE_NOT_RESOLVED';
          message = `Plate ${plate} not found in fleet vehicle registry`;
        }
      }

      if (status === 'READY') {
        readyCount++;
      } else {
        failedCount++;
      }

      results.push({
        row_id: row.row_id || `row_${idx}_${Date.now()}`,
        transaction_id: txId || `SLK-TEMP-${Date.now()}-${idx}`,
        transaction_date: txDate,
        transaction_time: txTime,
        toll_gate: gate || 'Al Barsha',
        direction: row.direction || 'Southbound',
        tag_number: row.tag_number || '',
        plate_number: plate,
        plate_code: plateCode,
        amount: isNaN(amount) ? 4.0 : amount,
        status,
        status_message: message,
        vehicle_id: resolvedVehicle?.id,
        vehicle_code: resolvedVehicle?.vehicle_code,
        vehicle_type: resolvedVehicle?.vehicle_type,
        resolved_rider: resolvedRiderInfo,
      });
    });

    const validationResult: SalikBatchValidationResult = {
      total_rows: rows.length,
      ready_count: readyCount,
      failed_count: failedCount,
      results,
    };

    res.json(validationResult);
  });

  // 8. POST /api/erp/salik/batch (Batch Import with duplicate protection & auto-resolution)
  router.post('/batch', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Rows array is required' });
    }

    const createdRecords: SalikRecord[] = [];
    const failures: { row_index: number; reason: string; message: string }[] = [];

    rows.forEach((row: any, idx: number) => {
      const txId = (row.transaction_id || `SLK-${Date.now()}-${idx}`).trim();
      const plate = (row.plate_number || '').trim().toUpperCase();
      const plateCode = (row.plate_code || '').trim().toUpperCase();
      const txDate = (row.transaction_date || '').trim();
      const txTime = (row.transaction_time || '12:00:00').trim();
      const gate = (row.toll_gate || 'Al Barsha').trim();
      const amount = Number(row.amount) || 4.0;

      // Duplicate protection check
      const duplicate = (db.salikRecords || []).find(
        (s: SalikRecord) =>
          s.tenant_id === tenantId &&
          ((txId && s.transaction_id.toLowerCase() === txId.toLowerCase()) ||
            (s.plate_number === plate &&
              s.transaction_date === txDate &&
              s.transaction_time?.slice(0, 5) === txTime.slice(0, 5) &&
              s.toll_gate.toLowerCase() === gate.toLowerCase()))
      );

      if (duplicate) {
        failures.push({
          row_index: idx,
          reason: 'DUPLICATE_TRANSACTION',
          message: `Toll transaction already exists (ID: ${txId}, Plate: ${plate}, Date: ${txDate})`,
        });
        return;
      }

      // Historical rider resolution
      const resolution = resolveHistoricalRider(plate, txDate, txTime, tenantId);
      const vehicle = resolution?.vehicle;
      const riderId = resolution?.rider_id;
      const isAutoResolved = !!riderId;

      const recordId = `slk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const timestamp = `${txDate}T${txTime.length === 5 ? txTime + ':00' : txTime}Z`;

      const historyEntries: SalikHistoryEntry[] = [
        {
          id: `h_${recordId}_1`,
          timestamp: new Date().toISOString(),
          actor_name: userName,
          actor_id: userId,
          actor_role: userRole,
          event_type: 'IMPORTED',
          new_state: isAutoResolved ? 'ALLOCATED' : 'PENDING',
          notes: `Batch imported toll transaction of AED ${amount} (${gate})`,
        },
      ];

      if (isAutoResolved) {
        historyEntries.push({
          id: `h_${recordId}_2`,
          timestamp: new Date().toISOString(),
          actor_name: 'Historical Assignment Resolver',
          event_type: 'AUTO_ASSIGNED',
          old_state: 'PENDING',
          new_state: 'ALLOCATED',
          reason: `Auto-resolved custody to ${resolution.rider_name} (${resolution.rider_code}) at ${txDate} ${txTime}`,
        });
      }

      const newRecord: SalikRecord = {
        id: recordId,
        tenant_id: tenantId,
        branch_id: vehicle?.branch_id || 'b_dxb',
        branch_name: vehicle?.branch_name || 'Dubai Central HQ',
        transaction_id: txId,
        transaction_date: txDate,
        transaction_time: txTime,
        transaction_timestamp: timestamp,
        toll_gate: gate,
        direction: row.direction || 'Southbound',
        tag_number: row.tag_number || vehicle?.gps_device_id || '',
        plate_number: plate,
        plate_code: plateCode || vehicle?.plate_code || '',
        plate_emirate: vehicle?.plate_emirate || 'Dubai',
        vehicle_id: vehicle?.id,
        vehicle_code: vehicle?.vehicle_code,
        vehicle_type: vehicle?.vehicle_type || 'Motorcycle',
        amount: Math.round(amount * 100) / 100,

        assigned_employee_id: resolution?.rider_id || undefined,
        assigned_employee_name: resolution?.rider_name || undefined,
        assigned_employee_code: resolution?.rider_code || undefined,
        assigned_project_id: resolution?.project_id || undefined,
        assigned_project_name: resolution?.project_name || undefined,
        allocation_source: isAutoResolved ? 'AUTO_HISTORY' : undefined,
        allocated_at: isAutoResolved ? new Date().toISOString() : undefined,
        allocated_by: isAutoResolved ? `${userName} (Historical Auto-Resolver)` : undefined,

        charge_status: isAutoResolved ? 'CHARGED' : 'UNCHARGED',
        status: isAutoResolved ? 'ALLOCATED' : 'PENDING',
        company_liability: 0,
        employee_liability: isAutoResolved ? amount : 0,
        notes: row.notes || 'Imported toll crossing',
        source_type: 'TOLL_UPLOAD',
        reference: row.reference || '',
        history: historyEntries,

        created_by: userName,
        created_at: new Date().toISOString(),
        updated_by: userName,
        updated_at: new Date().toISOString(),
      };

      db.salikRecords.unshift(newRecord);
      createdRecords.push(newRecord);
    });

    res.json({
      success: true,
      created_count: createdRecords.length,
      failed_count: failures.length,
      created_records: createdRecords,
      failures,
      message: `Salik batch import complete: ${createdRecords.length} records created, ${failures.length} rows rejected.`,
    });
  });

  // 9. POST /api/erp/salik/recheck-auto-assign (Recheck & Auto-Assign Pending Salik)
  router.post('/recheck-auto-assign', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);

    const pendingRecords = (db.salikRecords || []).filter(
      (s: SalikRecord) =>
        s.tenant_id === tenantId &&
        (s.status === 'PENDING' || s.charge_status === 'UNCHARGED' || !s.assigned_employee_id)
    );

    let autoAssignedCount = 0;
    let remainedPendingCount = 0;
    const resolvedList: SalikRecord[] = [];

    for (const record of pendingRecords) {
      const resolution = resolveHistoricalRider(
        record.plate_number,
        record.transaction_date,
        record.transaction_time,
        tenantId
      );

      if (resolution && resolution.rider_id) {
        record.assigned_employee_id = resolution.rider_id;
        record.assigned_employee_name = resolution.rider_name;
        record.assigned_employee_code = resolution.rider_code;
        record.assigned_project_id = resolution.project_id;
        record.assigned_project_name = resolution.project_name;
        record.vehicle_id = resolution.vehicle?.id || record.vehicle_id;
        record.vehicle_code = resolution.vehicle?.vehicle_code || record.vehicle_code;
        record.allocation_source = 'AUTO_HISTORY';
        record.allocated_at = new Date().toISOString();
        record.allocated_by = `${userName} (Historical Rechecker)`;
        record.charge_status = 'CHARGED';
        record.status = 'ALLOCATED';
        record.employee_liability = record.amount;
        record.company_liability = 0;
        record.updated_at = new Date().toISOString();
        record.updated_by = userName;

        record.history.push({
          id: `h_recheck_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          timestamp: new Date().toISOString(),
          actor_name: userName,
          actor_id: userId,
          actor_role: userRole,
          event_type: 'AUTO_ASSIGNED',
          old_state: 'PENDING',
          new_state: 'ALLOCATED',
          reason: `Recheck identified vehicle custody active under ${resolution.rider_name} (${resolution.rider_code}) at ${record.transaction_date} ${record.transaction_time}`,
        });

        autoAssignedCount++;
        resolvedList.push(record);
      } else {
        remainedPendingCount++;
      }
    }

    res.json({
      success: true,
      total_checked: pendingRecords.length,
      auto_assigned_count: autoAssignedCount,
      remained_pending_count: remainedPendingCount,
      resolved_records: resolvedList,
      message: `Recheck complete: ${autoAssignedCount} pending Salik tolls assigned to historical riders, ${remainedPendingCount} remained unassigned pending custody review.`,
    });
  });

  // 10. POST /api/erp/salik/:id/assign (Manual Assign)
  router.post('/:id/assign', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const record = (db.salikRecords || []).find(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );

    if (!record) {
      return res.status(404).json({ error: 'Salik record not found' });
    }

    const { employee_id, project_id, liability_type = 'EMPLOYEE', reason, notes } = req.body;

    const employee = (db.masterEmployees || []).find(
      (e: any) => (e.id === employee_id || e.employee_id === employee_id) && e.tenant_id === tenantId
    );

    if (!employee && liability_type === 'EMPLOYEE') {
      return res.status(400).json({ error: `Employee ${employee_id} not found in tenant master.` });
    }

    const prevEmployee = record.assigned_employee_name || 'Unassigned';

    if (liability_type === 'COMPANY') {
      record.charge_status = 'COMPANY_LIABILITY';
      record.status = 'COMPANY_LIABILITY';
      record.company_liability = record.amount;
      record.employee_liability = 0;
      record.allocation_source = 'COMPANY';
    } else {
      record.assigned_employee_id = employee?.id || employee?.employee_id;
      record.assigned_employee_name = employee?.full_name;
      record.assigned_employee_code = employee?.employee_code;
      record.assigned_project_id = project_id || employee?.project_id;
      record.assigned_project_name = employee?.project_name || 'Fleet Delivery';
      record.charge_status = 'CHARGED';
      record.status = 'ALLOCATED';
      record.company_liability = 0;
      record.employee_liability = record.amount;
      record.allocation_source = 'MANUAL';
    }

    record.allocated_at = new Date().toISOString();
    record.allocated_by = userName;
    record.updated_at = new Date().toISOString();
    record.updated_by = userName;
    if (notes) record.notes = `${record.notes || ''} | Manual Assign: ${notes}`;

    record.history.push({
      id: `h_assign_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_name: userName,
      actor_id: userId,
      actor_role: userRole,
      event_type: 'MANUALLY_ASSIGNED',
      old_state: prevEmployee,
      new_state: liability_type === 'COMPANY' ? 'Company Liability' : employee?.full_name,
      reason: reason || 'Manual responsibility assignment by fleet supervisor',
      notes,
    });

    res.json({
      success: true,
      message: `Salik ${record.transaction_id} assigned successfully.`,
      record,
    });
  });

  // 11. POST /api/erp/salik/bulk-assign (Bulk Assign)
  router.post('/bulk-assign', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const { record_ids, employee_id, project_id, liability_type = 'EMPLOYEE', reason, auto_resolve = false } = req.body;

    if (!Array.isArray(record_ids) || record_ids.length === 0) {
      return res.status(400).json({ error: 'record_ids array is required' });
    }

    const employee = employee_id
      ? (db.masterEmployees || []).find(
          (e: any) => (e.id === employee_id || e.employee_id === employee_id) && e.tenant_id === tenantId
        )
      : null;

    if (!employee && !auto_resolve && liability_type === 'EMPLOYEE') {
      return res.status(400).json({ error: 'Valid employee_id is required when liability is EMPLOYEE' });
    }

    const updatedRecords: SalikRecord[] = [];

    for (const id of record_ids) {
      const record = (db.salikRecords || []).find(
        (s: SalikRecord) => s.id === id && s.tenant_id === tenantId
      );
      if (!record) continue;

      const prevHolder = record.assigned_employee_name || 'Unassigned';

      if (auto_resolve) {
        const resolution = resolveHistoricalRider(
          record.plate_number,
          record.transaction_date,
          record.transaction_time,
          tenantId
        );
        if (resolution && resolution.rider_id) {
          record.assigned_employee_id = resolution.rider_id;
          record.assigned_employee_name = resolution.rider_name;
          record.assigned_employee_code = resolution.rider_code;
          record.assigned_project_id = resolution.project_id;
          record.assigned_project_name = resolution.project_name;
          record.allocation_source = 'AUTO_HISTORY';
          record.charge_status = 'CHARGED';
          record.status = 'ALLOCATED';
          record.employee_liability = record.amount;
          record.company_liability = 0;
        }
      } else if (liability_type === 'COMPANY') {
        record.charge_status = 'COMPANY_LIABILITY';
        record.status = 'COMPANY_LIABILITY';
        record.company_liability = record.amount;
        record.employee_liability = 0;
        record.allocation_source = 'COMPANY';
      } else if (employee) {
        record.assigned_employee_id = employee.id || employee.employee_id;
        record.assigned_employee_name = employee.full_name;
        record.assigned_employee_code = employee.employee_code;
        record.assigned_project_id = project_id || employee.project_id;
        record.assigned_project_name = employee.project_name || 'Fleet Delivery';
        record.charge_status = 'CHARGED';
        record.status = 'ALLOCATED';
        record.employee_liability = record.amount;
        record.company_liability = 0;
        record.allocation_source = 'MANUAL';
      }

      record.allocated_at = new Date().toISOString();
      record.allocated_by = userName;
      record.updated_at = new Date().toISOString();
      record.updated_by = userName;

      record.history.push({
        id: `h_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        timestamp: new Date().toISOString(),
        actor_name: userName,
        actor_id: userId,
        actor_role: userRole,
        event_type: 'BULK_ASSIGNED',
        old_state: prevHolder,
        new_state: record.assigned_employee_name || record.charge_status,
        reason: reason || 'Bulk assignment',
      });

      updatedRecords.push(record);
    }

    res.json({
      success: true,
      updated_count: updatedRecords.length,
      records: updatedRecords,
      message: `Bulk assigned ${updatedRecords.length} Salik records.`,
    });
  });

  // 12. POST /api/erp/salik/:id/link-payroll (Link Salik to Payroll with double-deduction block)
  router.post('/:id/link-payroll', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const record = (db.salikRecords || []).find(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );

    if (!record) {
      return res.status(404).json({ error: 'Salik record not found' });
    }

    // Double deduction block
    if (record.status === 'PAYROLL_LINKED' || (record.deducted_amount && record.deducted_amount >= record.amount)) {
      return res.status(400).json({
        error: `Double deduction blocked: Salik ${record.transaction_id} is already linked/deducted in payroll period ${record.payroll_period}.`,
      });
    }

    // Company liability block
    if (record.charge_status === 'COMPANY_LIABILITY' || record.company_liability > 0) {
      return res.status(400).json({
        error: `Cannot deduct company liability Salik from employee payroll.`,
      });
    }

    const { payroll_period, amount, notes } = req.body;
    const periodKey = payroll_period || new Date().toISOString().slice(0, 7);
    const deductAmt = amount ? Number(amount) : record.amount;

    record.payroll_period = periodKey;
    record.deducted_amount = deductAmt;
    record.status = 'PAYROLL_LINKED';
    record.charge_status = 'CHARGED';
    record.payroll_linked_by = userName;
    record.payroll_linked_at = new Date().toISOString();
    record.updated_at = new Date().toISOString();
    record.updated_by = userName;
    if (notes) record.notes = `${record.notes || ''} | Payroll Note: ${notes}`;

    record.history.push({
      id: `h_pay_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_name: userName,
      actor_id: userId,
      actor_role: userRole,
      event_type: 'PAYROLL_LINKED',
      old_state: 'UNLINKED',
      new_state: `DEDUCTED_IN_${periodKey}`,
      reason: `Linked AED ${deductAmt} for payroll period ${periodKey}`,
      notes,
    });

    res.json({
      success: true,
      message: `Salik ${record.transaction_id} linked to payroll period ${periodKey}.`,
      record,
    });
  });

  // 13. POST /api/erp/salik/:id/set-company-liability
  router.post('/:id/set-company-liability', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const record = (db.salikRecords || []).find(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );

    if (!record) {
      return res.status(404).json({ error: 'Salik record not found' });
    }

    const { reason, notes } = req.body;

    const oldState = record.charge_status;
    record.charge_status = 'COMPANY_LIABILITY';
    record.status = 'COMPANY_LIABILITY';
    record.company_liability = record.amount;
    record.employee_liability = 0;
    record.payroll_period = undefined;
    record.deducted_amount = undefined;
    record.updated_at = new Date().toISOString();
    record.updated_by = userName;

    record.history.push({
      id: `h_comp_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_name: userName,
      actor_id: userId,
      actor_role: userRole,
      event_type: 'LIABILITY_CHANGED',
      old_state: oldState,
      new_state: 'COMPANY_LIABILITY',
      reason: reason || 'Designated as company fleet liability',
      notes,
    });

    res.json({
      success: true,
      message: `Salik ${record.transaction_id} marked as company liability.`,
      record,
    });
  });

  // 14. POST /api/erp/salik/prepaid (Add Pre-Paid Salik)
  router.post('/prepaid', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const {
      vehicle_id,
      plate_number,
      plate_code,
      transaction_date,
      amount,
      reference,
      reason,
      notes,
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    const txDate = transaction_date || new Date().toISOString().slice(0, 10);
    const cleanPlate = (plate_number || '').trim().toUpperCase();

    // Find vehicle
    const vehicle = (db.fleetVehicles || []).find(
      (v: any) =>
        v.tenant_id === tenantId &&
        (v.id === vehicle_id || v.plate_number?.toUpperCase() === cleanPlate)
    );

    const resolution = cleanPlate
      ? resolveHistoricalRider(cleanPlate, txDate, '12:00:00', tenantId)
      : null;

    const recordId = `slk_pre_${Date.now()}`;
    const txId = reference ? `SLK-PRE-${reference}` : `SLK-PRE-${Date.now().toString().slice(-6)}`;

    const newRecord: SalikRecord = {
      id: recordId,
      tenant_id: tenantId,
      branch_id: vehicle?.branch_id || 'b_dxb',
      branch_name: vehicle?.branch_name || 'Dubai Central HQ',
      transaction_id: txId,
      transaction_date: txDate,
      transaction_time: '12:00:00',
      transaction_timestamp: `${txDate}T12:00:00Z`,
      toll_gate: 'Pre-Paid Salik Recharge',
      direction: 'Manual Adjustment',
      tag_number: vehicle?.gps_device_id || '',
      plate_number: cleanPlate || vehicle?.plate_number || 'PREPAID',
      plate_code: plate_code || vehicle?.plate_code || '',
      plate_emirate: vehicle?.plate_emirate || 'Dubai',
      vehicle_id: vehicle?.id,
      vehicle_code: vehicle?.vehicle_code,
      vehicle_type: vehicle?.vehicle_type || 'Motorcycle',
      amount: Number(amount),

      assigned_employee_id: resolution?.rider_id || undefined,
      assigned_employee_name: resolution?.rider_name || undefined,
      assigned_employee_code: resolution?.rider_code || undefined,
      assigned_project_id: resolution?.project_id || undefined,
      assigned_project_name: resolution?.project_name || undefined,
      allocation_source: 'PREPAID',
      allocated_at: new Date().toISOString(),
      allocated_by: userName,

      charge_status: resolution?.rider_id ? 'CHARGED' : 'UNCHARGED',
      status: resolution?.rider_id ? 'ALLOCATED' : 'PENDING',
      company_liability: 0,
      employee_liability: resolution?.rider_id ? Number(amount) : 0,
      notes: notes || reason || 'Manual pre-paid Salik credit/top-up',
      source_type: 'MANUAL_PREPAID',
      reference: reference || '',

      history: [
        {
          id: `h_${recordId}_1`,
          timestamp: new Date().toISOString(),
          actor_name: userName,
          actor_id: userId,
          actor_role: userRole,
          event_type: 'PREPAID_CREATED',
          new_state: 'ALLOCATED',
          reason: reason || 'Added pre-paid Salik balance',
          notes,
        },
      ],

      created_by: userName,
      created_at: new Date().toISOString(),
      updated_by: userName,
      updated_at: new Date().toISOString(),
    };

    db.salikRecords.unshift(newRecord);

    res.json({
      success: true,
      message: `Pre-paid Salik record of AED ${amount} created successfully.`,
      record: newRecord,
    });
  });

  // 15. POST /api/erp/salik/:id/dispute
  router.post('/:id/dispute', (req: Request, res: Response) => {
    const { tenantId, userId, userName, userRole } = extractTenantContext(req);
    const record = (db.salikRecords || []).find(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );

    if (!record) {
      return res.status(404).json({ error: 'Salik record not found' });
    }

    const { reason, notes } = req.body;
    record.status = 'DISPUTED';
    record.charge_status = 'DISPUTED';
    record.updated_at = new Date().toISOString();
    record.updated_by = userName;

    record.history.push({
      id: `h_disp_${Date.now()}`,
      timestamp: new Date().toISOString(),
      actor_name: userName,
      actor_id: userId,
      actor_role: userRole,
      event_type: 'DISPUTED',
      new_state: 'DISPUTED',
      reason: reason || 'Salik toll dispute filed by driver/operator',
      notes,
    });

    res.json({
      success: true,
      message: `Salik ${record.transaction_id} marked as disputed.`,
      record,
    });
  });

  // 16. DELETE /api/erp/salik/:id
  router.delete('/:id', (req: Request, res: Response) => {
    const { tenantId, userName } = extractTenantContext(req);
    const idx = (db.salikRecords || []).findIndex(
      (s: SalikRecord) => s.id === req.params.id && s.tenant_id === tenantId
    );

    if (idx === -1) {
      return res.status(404).json({ error: 'Salik record not found' });
    }

    const target = db.salikRecords[idx];
    if (target.status === 'PAYROLL_LINKED' || target.status === 'PAID') {
      return res.status(400).json({
        error: 'Cannot delete Salik records that have already been linked or deducted from payroll.',
      });
    }

    db.salikRecords.splice(idx, 1);
    res.json({
      success: true,
      message: `Salik record ${target.transaction_id} removed by ${userName}.`,
    });
  });

  // 17. GET /api/erp/salik/export
  router.get('/export', (req: Request, res: Response) => {
    const { tenantId } = extractTenantContext(req);
    const { from, to, chargeFilter, tollGate, search } = req.query;

    let records: SalikRecord[] = (db.salikRecords || []).filter(
      (s: SalikRecord) => s.tenant_id === tenantId
    );

    if (from && typeof from === 'string' && from.trim() !== '') {
      records = records.filter((r) => r.transaction_date >= from);
    }
    if (to && typeof to === 'string' && to.trim() !== '') {
      records = records.filter((r) => r.transaction_date <= to);
    }
    if (chargeFilter && typeof chargeFilter === 'string') {
      const upper = chargeFilter.toUpperCase();
      if (upper === 'CHARGED') {
        records = records.filter(
          (r) =>
            r.charge_status === 'CHARGED' ||
            r.charge_status === 'COMPANY_LIABILITY' ||
            r.status === 'ALLOCATED' ||
            r.status === 'PAYROLL_LINKED'
        );
      } else if (upper === 'UNCHARGED') {
        records = records.filter(
          (r) => r.charge_status === 'UNCHARGED' || r.status === 'PENDING'
        );
      }
    }
    if (tollGate && typeof tollGate === 'string' && tollGate !== 'ALL') {
      records = records.filter((r) => r.toll_gate === tollGate);
    }
    if (search && typeof search === 'string' && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      records = records.filter(
        (r) =>
          r.transaction_id?.toLowerCase().includes(q) ||
          r.plate_number?.toLowerCase().includes(q) ||
          r.assigned_employee_name?.toLowerCase().includes(q) ||
          r.toll_gate?.toLowerCase().includes(q)
      );
    }

    // CSV format
    const headers = [
      'Transaction ID',
      'Trip Date',
      'Trip Time',
      'Toll Gate',
      'Direction',
      'Tag Number',
      'Plate Number',
      'Plate Code',
      'Amount (AED)',
      'Assigned Employee',
      'Employee Code',
      'Project',
      'Charge Status',
      'Payroll Month',
      'Status',
      'Notes',
    ];

    const rows = records.map((r) => [
      `"${r.transaction_id}"`,
      `"${r.transaction_date}"`,
      `"${r.transaction_time || ''}"`,
      `"${r.toll_gate}"`,
      `"${r.direction || ''}"`,
      `"${r.tag_number || ''}"`,
      `"${r.plate_number}"`,
      `"${r.plate_code || ''}"`,
      r.amount.toFixed(2),
      `"${r.assigned_employee_name || ''}"`,
      `"${r.assigned_employee_code || ''}"`,
      `"${r.assigned_project_name || ''}"`,
      `"${r.charge_status}"`,
      `"${r.payroll_period || ''}"`,
      `"${r.status}"`,
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="salik_export_${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csvContent);
  });

  return router;
}
