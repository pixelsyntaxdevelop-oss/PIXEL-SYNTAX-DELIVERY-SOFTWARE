import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export interface FineHistoryEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_id?: string;
  actor_role?: string;
  event_type:
    | 'CREATED'
    | 'AUTO_RESOLVED'
    | 'ALLOCATED'
    | 'RESPONSIBILITY_CORRECTED'
    | 'PAYROLL_LINKED'
    | 'PAYMENT_RECORDED'
    | 'SETTLED'
    | 'DISPUTED'
    | 'DISPUTE_RESOLVED'
    | 'EDITED';
  old_state?: string;
  new_state?: string;
  reason?: string;
  notes?: string;
}

export interface TrafficFineRecord {
  id: string;
  tenant_id: string;
  branch_id?: string;
  branch_name?: string;
  fine_type: string; // 'Vendor Wise', 'Police Authority', 'RTA', 'Municipality'
  vendor: string; // 'Dubai Police', 'Abu Dhabi Police', 'Sharjah Police', 'RTA', 'Ajman Police', etc.
  invoice_number?: string;
  month: string; // '2026-08'
  plate_number: string;
  plate_code?: string;
  plate_emirate?: string;
  vehicle_id?: string;
  vehicle_code?: string;
  vehicle_type?: string;
  transaction_date: string; // '2026-08-18'
  transaction_time?: string; // '14:30:00'
  violation_timestamp?: string; // ISO string
  fine_amount: number;
  admin_fee: number;
  service_fee: number;
  total_amount: number; // fine_amount + admin_fee + service_fee (decimal safe)
  reference_number: string;
  violation_type: string;
  location?: string;
  notes?: string;

  // Allocation
  allocation_status: 'ALLOCATED' | 'UNALLOCATED';
  rider_id?: string;
  rider_name?: string;
  rider_code?: string;
  project_id?: string;
  project_name?: string;
  allocation_source?: 'HISTORICAL_ASSIGNMENT' | 'MANUAL' | 'SUGGESTED' | 'COMPANY';
  allocated_at?: string;
  allocated_by?: string;

  // Liability
  liability_type: 'EMPLOYEE' | 'COMPANY' | 'SPLIT';
  company_liability: number;
  employee_liability: number;
  company_paid: number;
  employee_paid: number;
  outstanding_balance: number;
  settlement_status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'DISPUTED';

  // Payroll Deduction
  deducted_from_payroll: boolean;
  payroll_period_key?: string; // '2026-08'
  deducted_amount?: number;
  payroll_linked_by?: string;
  payroll_linked_at?: string;

  // Responsibility correction history
  original_rider_id?: string;
  original_rider_name?: string;
  original_rider_code?: string;
  correction_reason?: string;
  corrected_by?: string;
  corrected_at?: string;

  // Status & Dispute
  status: 'PENDING' | 'ASSIGNED_TO_DRIVER' | 'UNALLOCATED' | 'DEDUCTED_FROM_PAYROLL' | 'PAID' | 'DISPUTED';
  dispute_reason?: string;
  dispute_status?: 'OPEN' | 'RESOLVED' | 'REJECTED';
  dispute_filed_by?: string;
  dispute_filed_at?: string;

  // Timeline
  history: FineHistoryEntry[];

  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export const initialTrafficFines: TrafficFineRecord[] = [
  {
    id: 'fine_tf_01',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    fine_type: 'Vendor Wise',
    vendor: 'Dubai Police',
    invoice_number: 'INV-2026-8801',
    month: '2026-08',
    plate_number: '72154',
    plate_code: 'T',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_72154',
    vehicle_code: 'VH-1001',
    vehicle_type: 'Motorcycle',
    transaction_date: '2026-08-12',
    transaction_time: '14:22:00',
    violation_timestamp: '2026-08-12T14:22:00Z',
    fine_amount: 300,
    admin_fee: 20,
    service_fee: 10,
    total_amount: 330,
    reference_number: 'DXB-TKT-2026-99014',
    violation_type: 'Exceeding maximum speed limit by 15 km/h',
    location: 'Al Khail Road Southbound, Dubai',
    notes: 'Camera radar fine recorded on Talabat delivery route',
    allocation_status: 'ALLOCATED',
    rider_id: 'emp_01',
    rider_name: 'Muhammad Adnan',
    rider_code: 'EMP-1001',
    project_id: 'proj_talabat',
    project_name: 'Talabat Express Hub',
    allocation_source: 'HISTORICAL_ASSIGNMENT',
    allocated_at: '2026-08-12T15:00:00Z',
    allocated_by: 'Ali Raza Khan (Fleet Dispatch)',
    liability_type: 'EMPLOYEE',
    company_liability: 0,
    employee_liability: 330,
    company_paid: 0,
    employee_paid: 0,
    outstanding_balance: 330,
    settlement_status: 'UNPAID',
    deducted_from_payroll: false,
    payroll_period_key: '2026-08',
    status: 'ASSIGNED_TO_DRIVER',
    history: [
      {
        id: 'hist_01_1',
        timestamp: '2026-08-12T15:00:00Z',
        actor_name: 'Ali Raza Khan',
        event_type: 'CREATED',
        new_state: 'CREATED',
        notes: 'Fine ingested from Dubai Police vendor upload with reference DXB-TKT-2026-99014',
      },
      {
        id: 'hist_01_2',
        timestamp: '2026-08-12T15:00:05Z',
        actor_name: 'System Auto-Resolver',
        event_type: 'AUTO_RESOLVED',
        new_state: 'ALLOCATED',
        reason: 'Vehicle 72154 assigned to Muhammad Adnan (EMP-1001) at 2026-08-12 14:22:00',
      },
    ],
    created_at: '2026-08-12T15:00:00Z',
    created_by: 'Ali Raza Khan',
    updated_at: '2026-08-12T15:00:00Z',
    updated_by: 'Ali Raza Khan',
  },
  {
    id: 'fine_tf_02',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    fine_type: 'RTA',
    vendor: 'RTA',
    invoice_number: 'INV-2026-7721',
    month: '2026-07',
    plate_number: '72154',
    plate_code: 'T',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_72154',
    vehicle_code: 'VH-1001',
    vehicle_type: 'Motorcycle',
    transaction_date: '2026-07-28',
    transaction_time: '12:10:00',
    violation_timestamp: '2026-07-28T12:10:00Z',
    fine_amount: 150,
    admin_fee: 20,
    service_fee: 10,
    total_amount: 180,
    reference_number: 'RTA-PRK-2026-33910',
    violation_type: 'Parking in non-designated delivery bay',
    location: 'Business Bay Zone 318B, Dubai',
    notes: 'Delivery drop parking ticket',
    allocation_status: 'ALLOCATED',
    rider_id: 'emp_01',
    rider_name: 'Muhammad Adnan',
    rider_code: 'EMP-1001',
    project_id: 'proj_talabat',
    project_name: 'Talabat Express Hub',
    allocation_source: 'HISTORICAL_ASSIGNMENT',
    allocated_at: '2026-07-28T13:00:00Z',
    allocated_by: 'Ali Raza Khan',
    liability_type: 'EMPLOYEE',
    company_liability: 0,
    employee_liability: 180,
    company_paid: 0,
    employee_paid: 180,
    outstanding_balance: 0,
    settlement_status: 'PAID',
    deducted_from_payroll: true,
    payroll_period_key: '2026-07',
    deducted_amount: 180,
    payroll_linked_by: 'Hassan Tariq (HR & Payroll)',
    payroll_linked_at: '2026-07-31T10:00:00Z',
    status: 'DEDUCTED_FROM_PAYROLL',
    history: [
      {
        id: 'hist_02_1',
        timestamp: '2026-07-28T13:00:00Z',
        actor_name: 'Ali Raza Khan',
        event_type: 'CREATED',
        new_state: 'CREATED',
        notes: 'Ingested fine RTA-PRK-2026-33910',
      },
      {
        id: 'hist_02_2',
        timestamp: '2026-07-31T10:00:00Z',
        actor_name: 'Hassan Tariq',
        event_type: 'PAYROLL_LINKED',
        old_state: 'ASSIGNED_TO_DRIVER',
        new_state: 'DEDUCTED_FROM_PAYROLL',
        reason: 'Processed and reconciled in July 2026 payroll run',
      },
    ],
    created_at: '2026-07-28T13:00:00Z',
    created_by: 'Ali Raza Khan',
    updated_at: '2026-07-31T10:00:00Z',
    updated_by: 'Hassan Tariq',
  },
  {
    id: 'fine_tf_03',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    fine_type: 'Vendor Wise',
    vendor: 'Dubai Police',
    invoice_number: 'INV-2026-8801',
    month: '2026-08',
    plate_number: '49102',
    plate_code: 'A',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_49102',
    vehicle_code: 'VH-1002',
    vehicle_type: 'Motorcycle',
    transaction_date: '2026-08-05',
    transaction_time: '17:40:00',
    violation_timestamp: '2026-08-05T17:40:00Z',
    fine_amount: 400,
    admin_fee: 20,
    service_fee: 10,
    total_amount: 430,
    reference_number: 'DXB-TKT-2026-77810',
    violation_type: 'Sudden lane swerving / failing to use indicators',
    location: 'Jumeirah Beach Road, Dubai',
    notes: 'Assigned to August payroll deduction',
    allocation_status: 'ALLOCATED',
    rider_id: 'emp_05',
    rider_name: 'Tariq Mansoor',
    rider_code: 'EMP-1005',
    project_id: 'proj_careem',
    project_name: 'Careem Food & Box',
    allocation_source: 'HISTORICAL_ASSIGNMENT',
    allocated_at: '2026-08-06T11:00:00Z',
    allocated_by: 'Ali Raza Khan',
    liability_type: 'EMPLOYEE',
    company_liability: 0,
    employee_liability: 430,
    company_paid: 0,
    employee_paid: 0,
    outstanding_balance: 430,
    settlement_status: 'UNPAID',
    deducted_from_payroll: false,
    payroll_period_key: '2026-08',
    status: 'ASSIGNED_TO_DRIVER',
    history: [
      {
        id: 'hist_03_1',
        timestamp: '2026-08-06T11:00:00Z',
        actor_name: 'Ali Raza Khan',
        event_type: 'CREATED',
        new_state: 'ASSIGNED_TO_DRIVER',
        notes: 'Created fine DXB-TKT-2026-77810 and resolved to Tariq Mansoor',
      },
    ],
    created_at: '2026-08-06T11:00:00Z',
    created_by: 'Ali Raza Khan',
    updated_at: '2026-08-06T11:00:00Z',
    updated_by: 'Ali Raza Khan',
  },
  {
    id: 'fine_tf_04',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    fine_type: 'Police Authority',
    vendor: 'Dubai Police',
    invoice_number: 'INV-2026-8805',
    month: '2026-08',
    plate_number: '88210',
    plate_code: 'K',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_88210',
    vehicle_code: 'VH-1003',
    vehicle_type: 'Motorcycle',
    transaction_date: '2026-08-14',
    transaction_time: '11:15:00',
    violation_timestamp: '2026-08-14T11:15:00Z',
    fine_amount: 500,
    admin_fee: 20,
    service_fee: 10,
    total_amount: 530,
    reference_number: 'DXB-TKT-2026-66201',
    violation_type: 'Expired technical passing inspection / tail reflector defective',
    location: 'Ras Al Khor Road, Dubai',
    notes: 'Technical inspection lapsed while awaiting garage booking - Company responsibility',
    allocation_status: 'ALLOCATED',
    allocation_source: 'COMPANY',
    allocated_at: '2026-08-15T09:30:00Z',
    allocated_by: 'Sarah Al-Mahmoud (Operations VP)',
    liability_type: 'COMPANY',
    company_liability: 530,
    employee_liability: 0,
    company_paid: 530,
    employee_paid: 0,
    outstanding_balance: 0,
    settlement_status: 'PAID',
    deducted_from_payroll: false,
    status: 'PAID',
    history: [
      {
        id: 'hist_04_1',
        timestamp: '2026-08-15T09:30:00Z',
        actor_name: 'Sarah Al-Mahmoud',
        event_type: 'CREATED',
        new_state: 'CREATED',
      },
      {
        id: 'hist_04_2',
        timestamp: '2026-08-15T09:40:00Z',
        actor_name: 'Sarah Al-Mahmoud',
        event_type: 'SETTLED',
        old_state: 'PENDING',
        new_state: 'PAID',
        reason: 'Company technical defect liability - paid direct via company corporate card',
      },
    ],
    created_at: '2026-08-15T09:30:00Z',
    created_by: 'Sarah Al-Mahmoud',
    updated_at: '2026-08-15T09:40:00Z',
    updated_by: 'Sarah Al-Mahmoud',
  },
  {
    id: 'fine_tf_05',
    tenant_id: 'company_demo',
    branch_id: 'b_dxb',
    branch_name: 'Dubai Head Office & Logistics Center',
    fine_type: 'Vendor Wise',
    vendor: 'Dubai Police',
    invoice_number: 'INV-2026-8809',
    month: '2026-08',
    plate_number: '33912',
    plate_code: 'D',
    plate_emirate: 'Dubai',
    vehicle_id: 'veh_33912',
    vehicle_code: 'VH-1004',
    vehicle_type: 'Motorcycle',
    transaction_date: '2026-08-20',
    transaction_time: '19:05:00',
    violation_timestamp: '2026-08-20T19:05:00Z',
    fine_amount: 600,
    admin_fee: 20,
    service_fee: 10,
    total_amount: 630,
    reference_number: 'DXB-TKT-2026-88402',
    violation_type: 'Exceeding maximum speed limit by 25 km/h',
    location: 'Sheikh Zayed Road, Trade Centre Tunnel',
    notes: 'Pending assignment verification - multiple shift handovers around 19:00',
    allocation_status: 'UNALLOCATED',
    liability_type: 'EMPLOYEE',
    company_liability: 0,
    employee_liability: 630,
    company_paid: 0,
    employee_paid: 0,
    outstanding_balance: 630,
    settlement_status: 'UNPAID',
    deducted_from_payroll: false,
    status: 'UNALLOCATED',
    history: [
      {
        id: 'hist_05_1',
        timestamp: '2026-08-21T08:00:00Z',
        actor_name: 'Ali Raza Khan',
        event_type: 'CREATED',
        new_state: 'UNALLOCATED',
        notes: 'Vehicle fine exists but responsible employee has not been confirmed',
      },
    ],
    created_at: '2026-08-21T08:00:00Z',
    created_by: 'Ali Raza Khan',
    updated_at: '2026-08-21T08:00:00Z',
    updated_by: 'Ali Raza Khan',
  },
];

export function createTrafficFineRouter(db: any, getGeminiClient?: () => GoogleGenAI) {
  const router = Router();

  // Initialize unified data
  if (!db.trafficFines || db.trafficFines.length === 0) {
    db.trafficFines = [...initialTrafficFines];
  }

  // Ensure test bike 66190 has historical split assignments:
  // Rider A (Zubair Shah, EMP-1008) until Aug 15
  // Rider B (Bilal Ahmed, EMP-1010) from Aug 16
  ensureHistoricalAssignmentFixtures(db);

  function ensureHistoricalAssignmentFixtures(database: any) {
    if (!database.fleetAssignments) database.fleetAssignments = [];
    const hasSplit = database.fleetAssignments.some(
      (a: any) => a.vehicle_plate === '66190' && a.employee_name === 'Zubair Shah'
    );
    if (!hasSplit) {
      database.fleetAssignments.push(
        {
          id: 'v_asgn_split_1',
          tenant_id: 'company_demo',
          vehicle_id: 'veh_66190',
          vehicle_plate: '66190',
          vehicle_model: 'Bajaj Pulsar 150',
          employee_id: 'emp_08',
          employee_name: 'Zubair Shah',
          employee_code: 'EMP-1008',
          project_id: 'proj_talabat',
          project_name: 'Talabat Express Hub',
          branch_id: 'b_dxb',
          assignment_date: '2026-08-01',
          assignment_time: '08:00',
          return_date: '2026-08-15',
          return_time: '23:59',
          assignment_status: 'RETURNED',
          created_at: '2026-08-01T08:00:00Z',
        },
        {
          id: 'v_asgn_split_2',
          tenant_id: 'company_demo',
          vehicle_id: 'veh_66190',
          vehicle_plate: '66190',
          vehicle_model: 'Bajaj Pulsar 150',
          employee_id: 'emp_10',
          employee_name: 'Bilal Ahmed',
          employee_code: 'EMP-1010',
          project_id: 'proj_deliveroo',
          project_name: 'Deliveroo Editions',
          branch_id: 'b_dxb',
          assignment_date: '2026-08-16',
          assignment_time: '00:01',
          return_date: '2026-09-30',
          return_time: '23:59',
          assignment_status: 'ACTIVE',
          created_at: '2026-08-16T00:01:00Z',
        }
      );
    }
  }

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

  // Synchronize fine with fleetFines so Vehicle 360 displays the exact same record
  function syncWithFleetFines(fine: TrafficFineRecord) {
    if (!db.fleetFines) db.fleetFines = [];
    const idx = db.fleetFines.findIndex((f: any) => f.id === fine.id || f.fine_number === fine.reference_number);
    const syncItem = {
      id: fine.id,
      tenant_id: fine.tenant_id,
      vehicle_id: fine.vehicle_id || '',
      vehicle_plate: fine.plate_number,
      employee_id: fine.rider_id || '',
      employee_name: fine.rider_name || 'Unassigned Rider',
      fine_number: fine.reference_number,
      fine_date: fine.transaction_date,
      fine_time: fine.transaction_time || '12:00',
      location: fine.location || 'UAE Roads',
      authority: fine.vendor,
      violation_type: fine.violation_type,
      amount: fine.total_amount,
      status: fine.status,
      deducted_from_payroll: fine.deducted_from_payroll,
      payroll_period_key: fine.payroll_period_key || fine.month,
      notes: fine.notes || '',
      created_at: fine.created_at,
    };

    if (idx >= 0) {
      db.fleetFines[idx] = syncItem;
    } else {
      db.fleetFines.push(syncItem);
    }
  }

  // Resolve rider assigned to vehicle at exact transaction timestamp
  function resolveRiderForVehicle(
    tenantId: string,
    plateNumber: string,
    txDate: string,
    txTime?: string,
    vehicleId?: string
  ) {
    const cleanPlate = (plateNumber || '').toLowerCase().trim();
    if (!cleanPlate && !vehicleId) return null;

    const txDay = (txDate || '').substring(0, 10);
    const txTimeString = txTime ? (txTime.length === 5 ? `${txTime}:00` : txTime) : '12:00:00';
    const violationTs = `${txDay}T${txTimeString}`;

    // 1. Check historical vehicle & fleet assignments
    const allAssignments = [
      ...(db.fleetAssignments || []),
      ...(db.vehicleAssignments || []),
    ].filter((a: any) => {
      if (a.tenant_id !== tenantId) return false;
      if (vehicleId && a.vehicle_id === vehicleId) return true;
      const p = (a.vehicle_plate || a.plate_number || a.plateNumber || '').toLowerCase().trim();
      return p && p === cleanPlate;
    });

    // Check historical assignment matching timestamp
    for (const asgn of allAssignments) {
      const sDate = (asgn.assignment_date || asgn.start_date || '2000-01-01').substring(0, 10);
      const sTime = asgn.assignment_time ? (asgn.assignment_time.length === 5 ? `${asgn.assignment_time}:00` : asgn.assignment_time) : '00:00:00';
      const startTs = `${sDate}T${sTime}`;

      let endTs = '2099-12-31T23:59:59';
      if (asgn.return_date || asgn.end_date) {
        const eDate = (asgn.return_date || asgn.end_date).substring(0, 10);
        const eTime = asgn.return_time ? (asgn.return_time.length === 5 ? `${asgn.return_time}:00` : asgn.return_time) : '23:59:59';
        endTs = `${eDate}T${eTime}`;
      } else if (asgn.assignment_status === 'RETURNED') {
        endTs = `${sDate}T23:59:59`;
      }

      if (violationTs >= startTs && violationTs <= endTs) {
        const empId = asgn.employee_id || asgn.rider_id;
        const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);
        return {
          rider_id: empId,
          rider_name: asgn.employee_name || asgn.rider_name || emp?.full_name,
          rider_code: asgn.employee_code || asgn.rider_code || emp?.employee_code,
          project_id: asgn.project_id || emp?.project_id,
          project_name: asgn.project_name || emp?.project_name,
          assignment_id: asgn.id,
          confidence: 'HISTORICAL_EXACT',
        };
      }
    }

    // 2. DO NOT use current vehicle holder as fallback!
    // As per strict payroll liability architecture:
    // Liability resolution must use Violation Date/Time strictly against historical assignments.
    // If no assignment covered the violation timestamp, the fine remains UNALLOCATED.
    // Current bike holder must NEVER be charged for a violation that occurred when they did not hold the vehicle.
    return null;
  }

  // Decimal safe calculation
  function calculateNetTotal(fineAmount: number, adminFee: number, serviceFee: number): number {
    const sum = Number(fineAmount || 0) + Number(adminFee || 0) + Number(serviceFee || 0);
    return Math.round(sum * 100) / 100;
  }

  // 1. GET /api/erp/fines/meta (Master metadata for branch, vendor, fine types)
  router.get('/meta', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const branches = (db.branches || []).filter((b: any) => b.tenant_id === tenantId);
      const fleetVendors = (db.fleetVendors || []).filter((v: any) => v.tenant_id === tenantId);

      const standardVendors = [
        'Dubai Police',
        'Abu Dhabi Police',
        'Sharjah Police',
        'Ajman Police',
        'RTA',
        'Dubai Municipality',
        'Sharjah Municipality',
        'Integrated Transport Centre (ITC)',
        ...fleetVendors.map((fv: any) => fv.name),
      ];
      const uniqueVendors = Array.from(new Set(standardVendors));

      const fineTypes = [
        'Vendor Wise',
        'Police Authority',
        'RTA',
        'Municipality',
        'General Fleet Violation',
      ];

      return res.json({
        branches,
        vendors: uniqueVendors,
        fineTypes,
        currentMonth: new Date().toISOString().substring(0, 7),
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/erp/fines/vehicles/search (Plate & Vehicle searchable autocomplete)
  router.get('/vehicles/search', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const q = ((req.query.q as string) || '').toLowerCase().trim();
      const vendor = ((req.query.vendor as string) || '').toLowerCase().trim();

      const vehicles = (db.fleetVehicles || db.vehicles || []).filter((v: any) => {
        if (v.tenant_id !== tenantId) return false;
        if (!q) return true;
        const pNum = (v.plate_number || v.plateNumber || '').toLowerCase();
        const pCode = (v.plate_code || v.plateCode || '').toLowerCase();
        const vCode = (v.vehicle_code || v.vehicleCode || '').toLowerCase();
        const make = (v.make || '').toLowerCase();
        const model = (v.model || '').toLowerCase();
        return pNum.includes(q) || pCode.includes(q) || vCode.includes(q) || make.includes(q) || model.includes(q);
      });

      // Prioritize vendor vehicles if specified
      if (vendor && vendor !== 'all') {
        vehicles.sort((a: any, b: any) => {
          const aV = (a.vendor_name || a.owner_or_vendor || '').toLowerCase().includes(vendor) ? -1 : 1;
          const bV = (b.vendor_name || b.owner_or_vendor || '').toLowerCase().includes(vendor) ? -1 : 1;
          return aV - bV;
        });
      }

      const results = vehicles.slice(0, 15).map((v: any) => ({
        id: v.id,
        plate_number: v.plate_number || v.plateNumber,
        plate_code: v.plate_code || v.plateCode || '',
        plate_emirate: v.plate_emirate || v.plateEmirate || 'Dubai',
        vehicle_code: v.vehicle_code || v.vehicleCode || '',
        vehicle_type: v.vehicle_type || v.vehicleType || 'Motorcycle',
        make: v.make || '',
        model: v.model || '',
        vendor_name: v.vendor_name || v.owner_or_vendor || '',
        current_rider_name: v.current_rider_name || '',
      }));

      return res.json(results);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/erp/fines/stats & GET /api/erp/fines/summary (Financial Summary Cards)
  const handleSummary = (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { month, branch } = req.query;

      let fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === tenantId);

      if (month && month !== 'ALL') {
        fines = fines.filter((f: any) => f.month === month || f.transaction_date?.startsWith(month as string));
      }
      if (branch && branch !== 'ALL') {
        fines = fines.filter((f: any) => f.branch_id === branch || f.branch_name === branch);
      }

      const totalCount = fines.length;
      const allocatedCount = fines.filter((f: any) => f.allocation_status === 'ALLOCATED').length;
      const unallocatedCount = fines.filter((f: any) => f.allocation_status === 'UNALLOCATED').length;

      const totalFineAmount = fines.reduce((sum: number, f: any) => sum + (Number(f.total_amount) || 0), 0);
      const allocatedAmount = fines
        .filter((f: any) => f.allocation_status === 'ALLOCATED')
        .reduce((sum: number, f: any) => sum + (Number(f.total_amount) || 0), 0);
      const unallocatedAmount = fines
        .filter((f: any) => f.allocation_status === 'UNALLOCATED')
        .reduce((sum: number, f: any) => sum + (Number(f.total_amount) || 0), 0);

      const companyLiability = fines.reduce((sum: number, f: any) => sum + (Number(f.company_liability) || 0), 0);
      const employeeLiability = fines.reduce((sum: number, f: any) => sum + (Number(f.employee_liability) || 0), 0);

      const companyPaid = fines.reduce((sum: number, f: any) => sum + (Number(f.company_paid) || 0), 0);
      const employeePaid = fines.reduce((sum: number, f: any) => sum + (Number(f.employee_paid) || 0), 0);

      const settledAmount = companyPaid + employeePaid;
      const unsettledAmount = Math.max(0, totalFineAmount - settledAmount);
      const outstandingBalance = fines.reduce((sum: number, f: any) => sum + (Number(f.outstanding_balance) || 0), 0);

      return res.json({
        totalFineAmount: Math.round(totalFineAmount * 100) / 100,
        allocatedAmount: Math.round(allocatedAmount * 100) / 100,
        unallocatedAmount: Math.round(unallocatedAmount * 100) / 100,
        companyLiability: Math.round(companyLiability * 100) / 100,
        employeeLiability: Math.round(employeeLiability * 100) / 100,
        outstandingBalance: Math.round(outstandingBalance * 100) / 100,
        companyPaid: Math.round(companyPaid * 100) / 100,
        employeePaid: Math.round(employeePaid * 100) / 100,
        settledAmount: Math.round(settledAmount * 100) / 100,
        unsettledAmount: Math.round(unsettledAmount * 100) / 100,
        totalCount,
        allocatedCount,
        unallocatedCount,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.get('/stats', handleSummary);
  router.get('/summary', handleSummary);
  router.get('/dashboard', handleSummary);

  // 4. GET /api/erp/fines (Server-side paginated & filtered list)
  router.get('/', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const {
        month,
        branch,
        fineType,
        allocationStatus,
        employee,
        search,
        status,
        page = '1',
        pageSize = '25',
      } = req.query;

      let fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === tenantId);

      // Filter: For Month
      if (month && month !== 'ALL') {
        fines = fines.filter((f: any) => f.month === month || f.transaction_date?.startsWith(month as string));
      }

      // Filter: Branch
      if (branch && branch !== 'ALL') {
        fines = fines.filter((f: any) => f.branch_id === branch || f.branch_name?.toLowerCase().includes((branch as string).toLowerCase()));
      }

      // Filter: Fine Type
      if (fineType && fineType !== 'ALL') {
        fines = fines.filter((f: any) => f.fine_type?.toLowerCase() === (fineType as string).toLowerCase() || f.vendor?.toLowerCase().includes((fineType as string).toLowerCase()));
      }

      // Quick Allocation Filter: ALL | ALLOCATED | UNALLOCATED
      if (allocationStatus && allocationStatus !== 'ALL') {
        if (allocationStatus === 'ALLOCATED') {
          fines = fines.filter((f: any) => f.allocation_status === 'ALLOCATED');
        } else if (allocationStatus === 'UNALLOCATED') {
          fines = fines.filter((f: any) => f.allocation_status === 'UNALLOCATED');
        }
      }

      // Filter: Status (optional)
      if (status && status !== 'ALL') {
        fines = fines.filter((f: any) => f.status === status);
      }

      // Filter: Employee
      if (employee && employee !== 'ALL') {
        const empQuery = (employee as string).toLowerCase();
        fines = fines.filter(
          (f: any) =>
            f.rider_id === employee ||
            f.rider_code?.toLowerCase().includes(empQuery) ||
            f.rider_name?.toLowerCase().includes(empQuery)
        );
      }

      // Filter: Search (Plate Number, Plate Code, Reference Number, Invoice Number, Vendor, Employee, Employee Code)
      if (search) {
        const q = (search as string).toLowerCase().trim();
        fines = fines.filter((f: any) => {
          return (
            f.plate_number?.toLowerCase().includes(q) ||
            f.plate_code?.toLowerCase().includes(q) ||
            f.reference_number?.toLowerCase().includes(q) ||
            f.invoice_number?.toLowerCase().includes(q) ||
            f.vendor?.toLowerCase().includes(q) ||
            f.rider_name?.toLowerCase().includes(q) ||
            f.rider_code?.toLowerCase().includes(q) ||
            f.violation_type?.toLowerCase().includes(q)
          );
        });
      }

      // Chronological sort
      fines.sort((a: any, b: any) => {
        const tA = new Date(`${a.transaction_date}T${a.transaction_time || '12:00:00'}`).getTime();
        const tB = new Date(`${b.transaction_date}T${b.transaction_time || '12:00:00'}`).getTime();
        return tB - tA;
      });

      const total = fines.length;
      const p = Math.max(1, parseInt(page as string, 10) || 1);
      const pSize = Math.max(1, parseInt(pageSize as string, 10) || 25);
      const totalPages = Math.ceil(total / pSize);
      const startIndex = (p - 1) * pSize;
      const paginatedRecords = fines.slice(startIndex, startIndex + pSize);

      return res.json({
        records: paginatedRecords,
        data: paginatedRecords,
        total,
        page: p,
        pageSize: pSize,
        totalPages,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /api/erp/fines/validate-batch (Row-by-row batch validation with DUPLICATE & HISTORICAL checks)
  router.post('/validate-batch', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { rows = [], header = {} } = req.body;

      const results = [];
      const seenRefsInBatch = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pNum = (row.plate_number || row.plateNumber || '').trim();
        const refNum = (row.reference_number || row.referenceNumber || '').trim();
        const txDate = row.transaction_date || row.transactionDate;
        const txTime = row.transaction_time || row.transactionTime || '12:00';
        const fineAmt = Number(row.fine_amount ?? row.fineAmount ?? 0);
        const adminFee = Number(row.admin_fee ?? row.adminFee ?? 20);
        const serviceFee = Number(row.service_fee ?? row.serviceFee ?? 10);
        const totalAmt = calculateNetTotal(fineAmt, adminFee, serviceFee);

        let status = 'READY';
        let message = 'Row validated successfully';
        let resolvedRider = null;
        let vehicle = null;

        // Check Plate
        if (!pNum) {
          status = 'INVALID_PLATE';
          message = 'Plate number is missing';
        } else {
          // Look up vehicle in tenant's fleet
          const cleanPlate = pNum.toLowerCase();
          const matchedVeh = (db.fleetVehicles || db.vehicles || []).find((v: any) => {
            if (v.tenant_id !== tenantId) return false;
            const p = (v.plate_number || v.plateNumber || '').toLowerCase();
            return p === cleanPlate;
          });

          if (!matchedVeh) {
            status = 'VEHICLE_NOT_FOUND';
            message = `Vehicle with plate ${pNum} not found in tenant fleet`;
          } else {
            vehicle = {
              id: matchedVeh.id,
              plate_number: matchedVeh.plate_number || matchedVeh.plateNumber,
              plate_code: matchedVeh.plate_code || matchedVeh.plateCode || '',
              emirate: matchedVeh.plate_emirate || 'Dubai',
              vehicle_code: matchedVeh.vehicle_code || '',
            };
          }
        }

        // Check Date
        if (status === 'READY' && (!txDate || isNaN(new Date(txDate).getTime()))) {
          status = 'MISSING_DATE';
          message = 'Transaction date is missing or invalid';
        }

        // Check Amount
        if (status === 'READY' && (isNaN(fineAmt) || fineAmt <= 0)) {
          status = 'INVALID_AMOUNT';
          message = 'Fine amount must be greater than 0';
        }

        // Check Reference
        if (status === 'READY' && !refNum) {
          status = 'MISSING_REFERENCE';
          message = 'Reference number is mandatory';
        }

        // DUPLICATE CHECK: In same batch
        if (status === 'READY' && refNum) {
          const lowerRef = refNum.toLowerCase();
          if (seenRefsInBatch.has(lowerRef)) {
            status = 'DUPLICATE_FINE';
            message = `Duplicate fine reference ${refNum} in this batch`;
          } else {
            seenRefsInBatch.add(lowerRef);
          }
        }

        // DUPLICATE CHECK: Against existing DB records
        if (status === 'READY' && refNum) {
          const lowerRef = refNum.toLowerCase();
          const existingFine = (db.trafficFines || []).find((f: any) => {
            if (f.tenant_id !== tenantId) return false;
            if (f.reference_number?.toLowerCase() === lowerRef) return true;
            if (
              header.invoice_number &&
              f.invoice_number?.toLowerCase() === header.invoice_number.toLowerCase() &&
              f.plate_number?.toLowerCase() === pNum.toLowerCase() &&
              f.transaction_date === txDate
            ) {
              return true;
            }
            return false;
          });

          if (existingFine) {
            status = 'DUPLICATE_FINE';
            message = `Fine already exists (Ref: ${existingFine.reference_number}, Plate: ${existingFine.plate_number}, Date: ${existingFine.transaction_date})`;
          }
        }

        // Auto-resolve historical rider if valid
        if (status === 'READY' && pNum && txDate) {
          resolvedRider = resolveRiderForVehicle(tenantId, pNum, txDate, txTime, vehicle?.id);
        }

        results.push({
          row_index: i,
          status,
          message,
          plate_number: pNum,
          reference_number: refNum,
          total_amount: totalAmt,
          fine_amount: fineAmt,
          admin_fee: adminFee,
          service_fee: serviceFee,
          resolved_rider: resolvedRider,
          vehicle,
        });
      }

      return res.json({
        total_rows: rows.length,
        ready_count: results.filter((r) => r.status === 'READY').length,
        failed_count: results.filter((r) => r.status !== 'READY').length,
        results,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 6. POST /api/erp/fines/batch (Submit Multi-Row Bulk Fines with Row Validation & Duplicate Block)
  router.post('/batch', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { rows = [], header = {} } = req.body;

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No fine rows submitted for batch ingestion.' });
      }

      const createdFines: TrafficFineRecord[] = [];
      const failedRows: any[] = [];
      const seenBatchRefs = new Set<string>();

      const now = new Date().toISOString();
      const batchMonth = header.month || new Date().toISOString().substring(0, 7);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const pNum = (row.plate_number || row.plateNumber || '').trim();
        const pCode = (row.plate_code || row.plateCode || '').trim();
        const refNum = (row.reference_number || row.referenceNumber || '').trim();
        const invNum = (row.invoice_number || row.invoiceNumber || header.invoice_number || '').trim();
        const txDate = row.transaction_date || row.transactionDate;
        const txTime = row.transaction_time || row.transactionTime || '12:00:00';
        const fineAmt = Number(row.fine_amount ?? row.fineAmount ?? 0);
        const adminFee = Number(row.admin_fee ?? row.adminFee ?? 20);
        const serviceFee = Number(row.service_fee ?? row.serviceFee ?? 10);
        const totalAmt = calculateNetTotal(fineAmt, adminFee, serviceFee);

        // Validation
        if (!pNum) {
          failedRows.push({ row_index: i, reason: 'INVALID_PLATE', message: 'Vehicle plate number is mandatory' });
          continue;
        }
        if (!txDate) {
          failedRows.push({ row_index: i, reason: 'MISSING_DATE', message: 'Transaction date is missing' });
          continue;
        }
        if (isNaN(fineAmt) || fineAmt <= 0) {
          failedRows.push({ row_index: i, reason: 'INVALID_AMOUNT', message: 'Fine amount must be positive' });
          continue;
        }
        if (!refNum) {
          failedRows.push({ row_index: i, reason: 'MISSING_REFERENCE', message: 'Reference number is mandatory' });
          continue;
        }

        // Duplicate check in batch
        const lowerRef = refNum.toLowerCase();
        if (seenBatchRefs.has(lowerRef)) {
          failedRows.push({ row_index: i, reason: 'DUPLICATE_FINE', message: `Duplicate reference ${refNum} within this submission` });
          continue;
        }
        seenBatchRefs.add(lowerRef);

        // Duplicate check in DB
        const existingFine = (db.trafficFines || []).find((f: any) => {
          if (f.tenant_id !== tenantId) return false;
          if (f.reference_number?.toLowerCase() === lowerRef) return true;
          if (invNum && f.invoice_number?.toLowerCase() === invNum.toLowerCase() && f.plate_number?.toLowerCase() === pNum.toLowerCase() && f.transaction_date === txDate) return true;
          return false;
        });

        if (existingFine) {
          failedRows.push({
            row_index: i,
            reason: 'DUPLICATE_FINE',
            message: `Fine already exists (Ref: ${existingFine.reference_number}, Plate: ${existingFine.plate_number}, Date: ${existingFine.transaction_date})`,
          });
          continue;
        }

        // Lookup Vehicle
        const matchedVeh = (db.fleetVehicles || db.vehicles || []).find((v: any) => {
          if (v.tenant_id !== tenantId) return false;
          const p = (v.plate_number || v.plateNumber || '').toLowerCase();
          return p === pNum.toLowerCase();
        });

        // Auto-resolve rider using historical assignment at violation timestamp
        const resolvedRider = resolveRiderForVehicle(tenantId, pNum, txDate, txTime, matchedVeh?.id);
        const isAllocated = !!resolvedRider;

        const fineId = `fine_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const fineRecord: TrafficFineRecord = {
          id: fineId,
          tenant_id: tenantId,
          branch_id: header.branch_id || matchedVeh?.branch_id || 'b_dxb',
          branch_name: header.branch_name || matchedVeh?.branch_name || 'Dubai Central Logistics Hub',
          fine_type: header.traffic_fine_type || header.fine_type || 'Vendor Wise',
          vendor: header.vendor || 'Dubai Police',
          invoice_number: invNum || `INV-${Date.now().toString().slice(-6)}`,
          month: header.month || txDate.substring(0, 7) || batchMonth,
          plate_number: pNum,
          plate_code: pCode || matchedVeh?.plate_code || '',
          plate_emirate: matchedVeh?.plate_emirate || 'Dubai',
          vehicle_id: matchedVeh?.id || undefined,
          vehicle_code: matchedVeh?.vehicle_code || undefined,
          vehicle_type: matchedVeh?.vehicle_type || 'Motorcycle',
          transaction_date: txDate,
          transaction_time: txTime,
          violation_timestamp: `${txDate}T${txTime}Z`,
          fine_amount: fineAmt,
          admin_fee: adminFee,
          service_fee: serviceFee,
          total_amount: totalAmt,
          reference_number: refNum,
          violation_type: row.violation_type || 'Traffic Radar Violation',
          location: row.location || 'UAE Roadway',
          notes: row.notes || 'Batch entry fine ingestion',

          allocation_status: isAllocated ? 'ALLOCATED' : 'UNALLOCATED',
          rider_id: resolvedRider?.rider_id,
          rider_name: resolvedRider?.rider_name,
          rider_code: resolvedRider?.rider_code,
          project_id: resolvedRider?.project_id,
          project_name: resolvedRider?.project_name,
          allocation_source: isAllocated ? 'HISTORICAL_ASSIGNMENT' : undefined,
          allocated_at: isAllocated ? now : undefined,
          allocated_by: isAllocated ? `${userName} (Historical Auto-Resolver)` : undefined,

          liability_type: isAllocated ? 'EMPLOYEE' : 'COMPANY',
          company_liability: isAllocated ? 0 : totalAmt,
          employee_liability: isAllocated ? totalAmt : 0,
          company_paid: 0,
          employee_paid: 0,
          outstanding_balance: totalAmt,
          settlement_status: 'UNPAID',

          deducted_from_payroll: false,
          payroll_period_key: header.month || txDate.substring(0, 7),
          status: isAllocated ? 'ASSIGNED_TO_DRIVER' : 'UNALLOCATED',

          history: [
            {
              id: `h_${Date.now()}_1`,
              timestamp: now,
              actor_name: userName,
              actor_id: userId,
              actor_role: 'Fleet Ingestion Officer',
              event_type: 'CREATED',
              new_state: isAllocated ? 'ASSIGNED_TO_DRIVER' : 'UNALLOCATED',
              notes: `Batch logged fine of AED ${totalAmt} (Ref: ${refNum})`,
            },
            ...(isAllocated
              ? [
                  {
                    id: `h_${Date.now()}_2`,
                    timestamp: now,
                    actor_name: 'Historical Assignment Resolver',
                    event_type: 'AUTO_RESOLVED' as const,
                    new_state: 'ALLOCATED',
                    reason: `Resolved historical custody to ${resolvedRider.rider_name} (${resolvedRider.rider_code}) active at violation time ${txDate} ${txTime}`,
                  },
                ]
              : []),
          ],

          created_at: now,
          created_by: userName,
          updated_at: now,
          updated_by: userName,
        };

        db.trafficFines.unshift(fineRecord);
        syncWithFleetFines(fineRecord);
        createdFines.push(fineRecord);
      }

      // Record batch audit log
      if (db.auditLogs && createdFines.length > 0) {
        db.auditLogs.unshift({
          id: `log_batch_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Fleet Compliance',
          action: 'BATCH_INGEST_FINES',
          actionType: 'CREATE',
          status: 'SUCCESS',
          module: 'Traffic Fines',
          details: `Batch ingested ${createdFines.length} traffic fines. Failed rows: ${failedRows.length}.`,
          ipAddress: req.ip || '127.0.0.1',
        });
      }

      return res.status(201).json({
        success: true,
        created_count: createdFines.length,
        failed_count: failedRows.length,
        created_fines: createdFines,
        failures: failedRows,
        message: `Batch submission complete: ${createdFines.length} fines created, ${failedRows.length} rows rejected.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 7. POST /api/erp/fines (Single Fine Creation with DUPLICATE PROTECTION & HISTORICAL RESOLUTION)
  router.post('/', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const {
        vendor,
        invoice_number,
        invoiceNumber,
        month,
        plate_number,
        plateNumber,
        plate_code,
        plateCode,
        plate_emirate,
        transaction_date,
        transactionDate,
        transaction_time,
        transactionTime,
        fine_amount,
        fineAmount,
        admin_fee,
        adminFee,
        service_fee,
        serviceFee,
        reference_number,
        referenceNumber,
        violation_type,
        location,
        notes,
        rider_id,
        riderId,
        liability_type,
        company_liability,
        employee_liability,
      } = req.body;

      const pNum = (plate_number || plateNumber || '').trim();
      const refNum = (reference_number || referenceNumber || '').trim();
      const invNum = (invoice_number || invoiceNumber || '').trim();
      const txDate = transaction_date || transactionDate || new Date().toISOString().split('T')[0];
      const txTime = transaction_time || transactionTime || '12:00:00';

      if (!pNum) {
        return res.status(400).json({ error: 'Vehicle Plate Number is mandatory for traffic fine registration.' });
      }
      if (!refNum && !invNum) {
        return res.status(400).json({ error: 'Reference Number or Invoice Number is required.' });
      }

      // DUPLICATE PROTECTION
      const existingFine = (db.trafficFines || []).find((f: any) => {
        if (f.tenant_id !== tenantId) return false;
        if (refNum && f.reference_number?.toLowerCase() === refNum.toLowerCase()) return true;
        if (
          invNum &&
          f.invoice_number?.toLowerCase() === invNum.toLowerCase() &&
          f.plate_number?.toLowerCase() === pNum.toLowerCase() &&
          f.transaction_date === txDate
        ) {
          return true;
        }
        return false;
      });

      if (existingFine) {
        return res.status(400).json({
          error: `Fine already exists. A fine with reference ${existingFine.reference_number} on plate ${existingFine.plate_number} dated ${existingFine.transaction_date} is already recorded in the system.`,
          existingFine,
        });
      }

      // Lookup Vehicle
      const matchedVeh = (db.fleetVehicles || db.vehicles || []).find((v: any) => {
        if (v.tenant_id !== tenantId) return false;
        const p = (v.plate_number || v.plateNumber || '').toLowerCase();
        return p === pNum.toLowerCase();
      });

      // Historical resolution if no rider explicitly given
      let targetRider = null;
      let targetRiderId = rider_id || riderId;

      if (targetRiderId) {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === targetRiderId && e.tenant_id === tenantId);
        if (emp) {
          targetRider = {
            rider_id: emp.id,
            rider_name: emp.full_name,
            rider_code: emp.employee_code,
            project_id: emp.project_id,
            project_name: emp.project_name,
            confidence: 'MANUAL_SPECIFIED',
          };
        }
      } else {
        targetRider = resolveRiderForVehicle(tenantId, pNum, txDate, txTime, matchedVeh?.id);
      }

      const fAmt = Number(fine_amount ?? fineAmount ?? 0);
      const aFee = Number(admin_fee ?? adminFee ?? 20);
      const sFee = Number(service_fee ?? serviceFee ?? 10);
      const totAmt = calculateNetTotal(fAmt, aFee, sFee);
      const now = new Date().toISOString();
      const fineMonth = month || txDate.substring(0, 7);

      const isAllocated = !!targetRider;
      const lType = liability_type || (isAllocated ? 'EMPLOYEE' : 'COMPANY');
      const compLiab = company_liability !== undefined ? Number(company_liability) : (lType === 'COMPANY' ? totAmt : 0);
      const empLiab = employee_liability !== undefined ? Number(employee_liability) : (lType === 'EMPLOYEE' ? totAmt : 0);

      const newFine: TrafficFineRecord = {
        id: `fine_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenant_id: tenantId,
        branch_id: matchedVeh?.branch_id || 'b_dxb',
        branch_name: matchedVeh?.branch_name || 'Dubai Central HQ',
        fine_type: req.body.fine_type || 'Vendor Wise',
        vendor: vendor || 'Dubai Police',
        invoice_number: invNum || `INV-${Date.now().toString().slice(-6)}`,
        month: fineMonth,
        plate_number: pNum,
        plate_code: plate_code || plateCode || matchedVeh?.plate_code || '',
        plate_emirate: plate_emirate || matchedVeh?.plate_emirate || 'Dubai',
        vehicle_id: matchedVeh?.id,
        vehicle_code: matchedVeh?.vehicle_code,
        vehicle_type: matchedVeh?.vehicle_type || 'Motorcycle',
        transaction_date: txDate,
        transaction_time: txTime,
        violation_timestamp: `${txDate}T${txTime}Z`,
        fine_amount: fAmt,
        admin_fee: aFee,
        service_fee: sFee,
        total_amount: totAmt,
        reference_number: refNum || `REF-${Date.now().toString().slice(-6)}`,
        violation_type: violation_type || 'Traffic Violation',
        location: location || 'UAE Roadway',
        notes: notes || 'Logged into traffic fine management system',

        allocation_status: isAllocated ? 'ALLOCATED' : 'UNALLOCATED',
        rider_id: targetRider?.rider_id,
        rider_name: targetRider?.rider_name,
        rider_code: targetRider?.rider_code,
        project_id: targetRider?.project_id,
        project_name: targetRider?.project_name,
        allocation_source: isAllocated ? 'HISTORICAL_ASSIGNMENT' : undefined,
        allocated_at: isAllocated ? now : undefined,
        allocated_by: isAllocated ? userName : undefined,

        liability_type: lType,
        company_liability: compLiab,
        employee_liability: empLiab,
        company_paid: 0,
        employee_paid: 0,
        outstanding_balance: totAmt,
        settlement_status: 'UNPAID',

        deducted_from_payroll: false,
        payroll_period_key: fineMonth,
        status: isAllocated ? 'ASSIGNED_TO_DRIVER' : 'UNALLOCATED',

        history: [
          {
            id: `h_${Date.now()}_1`,
            timestamp: now,
            actor_name: userName,
            actor_id: userId,
            actor_role: 'Fleet Officer',
            event_type: 'CREATED',
            new_state: isAllocated ? 'ASSIGNED_TO_DRIVER' : 'UNALLOCATED',
            notes: `Logged fine of AED ${totAmt} on ${pNum} (${vendor || 'Dubai Police'})`,
          },
          ...(isAllocated
            ? [
                {
                  id: `h_${Date.now()}_2`,
                  timestamp: now,
                  actor_name: 'Historical Vehicle Resolver',
                  event_type: 'AUTO_RESOLVED' as const,
                  new_state: 'ALLOCATED',
                  reason: `Resolved historical custody to ${targetRider.rider_name} (${targetRider.rider_code}) at ${txDate} ${txTime}`,
                },
              ]
            : []),
        ],

        created_at: now,
        created_by: userName,
        updated_at: now,
        updated_by: userName,
      };

      db.trafficFines.unshift(newFine);
      syncWithFleetFines(newFine);

      // Audit Log
      if (db.auditLogs) {
        db.auditLogs.unshift({
          id: `log_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Fleet Compliance',
          action: 'CREATE_TRAFFIC_FINE',
          actionType: 'CREATE',
          status: 'SUCCESS',
          module: 'Traffic Fines',
          details: `Created fine AED ${totAmt} (Ref: ${newFine.reference_number}) on plate ${pNum}`,
          targetEntityId: newFine.id,
          ipAddress: req.ip || '127.0.0.1',
        });
      }

      return res.status(201).json({
        success: true,
        message: `Traffic fine of AED ${totAmt} registered successfully (Ref: ${newFine.reference_number}). Assigned to: ${targetRider?.rider_name || 'Unallocated'}.`,
        fine: newFine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/erp/fines/:id/allocate (Manual Allocation of Unallocated Fine)
  router.post('/:id/allocate', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { employee_id, employeeId, reason, liability_type, notes } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      const targetEmpId = employee_id || employeeId;
      if (!targetEmpId) {
        return res.status(400).json({ error: 'Responsible employee selection is mandatory for allocation.' });
      }

      const emp = (db.masterEmployees || []).find((e: any) => (e.id === targetEmpId || e.employee_code === targetEmpId) && e.tenant_id === tenantId);
      if (!emp) {
        return res.status(404).json({ error: `Employee ${targetEmpId} not found in tenant master.` });
      }

      const now = new Date().toISOString();
      const lType = liability_type || 'EMPLOYEE';
      const reasonStr = (reason || 'Manual staff allocation after trip & schedule verification').trim();

      fine.rider_id = emp.id;
      fine.rider_name = emp.full_name;
      fine.rider_code = emp.employee_code;
      if (emp.project_id) fine.project_id = emp.project_id;
      if (emp.project_name) fine.project_name = emp.project_name;

      fine.allocation_status = 'ALLOCATED';
      fine.allocation_source = 'MANUAL';
      fine.allocated_at = now;
      fine.allocated_by = userName;

      fine.liability_type = lType;
      fine.company_liability = lType === 'COMPANY' ? fine.total_amount : 0;
      fine.employee_liability = lType === 'EMPLOYEE' ? fine.total_amount : 0;
      fine.status = 'ASSIGNED_TO_DRIVER';
      fine.updated_at = now;
      fine.updated_by = userName;

      if (notes) fine.notes = `${fine.notes ? fine.notes + ' | ' : ''}Allocation Note: ${notes}`;

      fine.history.unshift({
        id: `h_alloc_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'Fleet Compliance',
        event_type: 'ALLOCATED',
        old_state: 'UNALLOCATED',
        new_state: 'ALLOCATED',
        reason: reasonStr,
        notes: `Assigned fine responsibility to ${emp.full_name} (${emp.employee_code})`,
      });

      syncWithFleetFines(fine);

      return res.json({
        success: true,
        message: `Fine ${fine.reference_number} allocated to ${emp.full_name} (${emp.employee_code}) successfully.`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 9. POST /api/erp/fines/:id/correct-responsibility (Authorized Responsibility Correction)
  const handleCorrection = (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { new_rider_id, newRiderId, rider_id, riderId, reason, correction_reason, notes } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      const targetRiderId = new_rider_id || newRiderId || rider_id || riderId;
      if (!targetRiderId) {
        return res.status(400).json({ error: 'New target employee ID is required for responsibility correction.' });
      }

      const corrReason = (reason || correction_reason || '').trim();
      if (!corrReason) {
        return res.status(400).json({ error: 'Mandatory: Please provide a clear operational reason for correcting fine responsibility.' });
      }

      const newEmp = (db.masterEmployees || []).find((e: any) => (e.id === targetRiderId || e.employee_code === targetRiderId) && e.tenant_id === tenantId);
      if (!newEmp) {
        return res.status(404).json({ error: `Employee ${targetRiderId} not found.` });
      }

      const now = new Date().toISOString();
      const prevRiderId = fine.rider_id;
      const prevRiderName = fine.rider_name || 'Unassigned';
      const prevRiderCode = fine.rider_code || '';

      // Preserve original allocation history if not already set
      if (!fine.original_rider_id && prevRiderId) {
        fine.original_rider_id = prevRiderId;
        fine.original_rider_name = prevRiderName;
        fine.original_rider_code = prevRiderCode;
      }

      fine.rider_id = newEmp.id;
      fine.rider_name = newEmp.full_name;
      fine.rider_code = newEmp.employee_code;
      if (newEmp.project_id) fine.project_id = newEmp.project_id;
      if (newEmp.project_name) fine.project_name = newEmp.project_name;

      fine.allocation_status = 'ALLOCATED';
      fine.status = 'ASSIGNED_TO_DRIVER';
      fine.correction_reason = corrReason;
      fine.corrected_by = userName;
      fine.corrected_at = now;
      fine.updated_at = now;
      fine.updated_by = userName;

      if (notes) fine.notes = `${fine.notes ? fine.notes + ' | ' : ''}Correction Note: ${notes}`;

      fine.history.unshift({
        id: `h_corr_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'Fleet Manager',
        event_type: 'RESPONSIBILITY_CORRECTED',
        old_state: prevRiderName,
        new_state: newEmp.full_name,
        reason: corrReason,
        notes: `Reassigned fine from ${prevRiderName} (${prevRiderCode}) to ${newEmp.full_name} (${newEmp.employee_code})`,
      });

      syncWithFleetFines(fine);

      // Audit Log
      if (db.auditLogs) {
        db.auditLogs.unshift({
          id: `log_corr_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Compliance / Fleet',
          action: 'CORRECT_FINE_RESPONSIBILITY',
          actionType: 'UPDATE',
          status: 'SUCCESS',
          module: 'Traffic Fines',
          details: `Reassigned fine ${fine.reference_number} from ${prevRiderName} to ${newEmp.full_name}. Reason: ${corrReason}`,
          targetEntityId: fine.id,
          ipAddress: req.ip || '127.0.0.1',
        });
      }

      return res.json({
        success: true,
        message: `Fine ${fine.reference_number} successfully reassigned from ${prevRiderName} to ${newEmp.full_name} (${newEmp.employee_code}).`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/correct-responsibility', handleCorrection);
  router.post('/:id/correct', handleCorrection);
  router.put('/:id', handleCorrection);

  // 10. POST /api/erp/fines/:id/liability (Split or change liability)
  router.post('/:id/liability', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { liability_type, company_liability, employee_liability, reason } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      const lType = liability_type || 'EMPLOYEE';
      let cLiab = Number(company_liability || 0);
      let eLiab = Number(employee_liability || 0);

      if (lType === 'COMPANY') {
        cLiab = fine.total_amount;
        eLiab = 0;
      } else if (lType === 'EMPLOYEE') {
        eLiab = fine.total_amount;
        cLiab = 0;
      }

      const sum = Math.round((cLiab + eLiab) * 100) / 100;
      if (Math.abs(sum - fine.total_amount) > 0.5) {
        return res.status(400).json({
          error: `Company liability (AED ${cLiab}) + Employee liability (AED ${eLiab}) must equal total fine amount (AED ${fine.total_amount}).`,
        });
      }

      const now = new Date().toISOString();
      const oldState = `${fine.liability_type} (Comp: AED ${fine.company_liability}, Emp: AED ${fine.employee_liability})`;
      const newState = `${lType} (Comp: AED ${cLiab}, Emp: AED ${eLiab})`;

      fine.liability_type = lType;
      fine.company_liability = cLiab;
      fine.employee_liability = eLiab;
      fine.updated_at = now;
      fine.updated_by = userName;

      fine.history.unshift({
        id: `h_liab_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'Finance & Compliance',
        event_type: 'EDITED',
        old_state: oldState,
        new_state: newState,
        reason: reason || 'Liability assignment updated',
      });

      syncWithFleetFines(fine);

      return res.json({
        success: true,
        message: `Liability updated for fine ${fine.reference_number}: Company AED ${cLiab}, Employee AED ${eLiab}.`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 11. POST /api/erp/fines/:id/link-payroll (Link fine to monthly payroll deduction with double deduction block)
  router.post('/:id/link-payroll', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { payroll_period, payrollPeriod, notes } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      // PREVENT DOUBLE DEDUCTION
      if (fine.deducted_from_payroll || fine.status === 'DEDUCTED_FROM_PAYROLL') {
        return res.status(400).json({
          error: `Double deduction blocked! Fine ${fine.reference_number} has already been deducted from payroll for period ${fine.payroll_period_key}.`,
        });
      }

      if (fine.employee_liability <= 0) {
        return res.status(400).json({
          error: `Cannot link to employee payroll: This fine is marked as 100% Company Liability (AED ${fine.company_liability}).`,
        });
      }

      if (!fine.rider_id) {
        return res.status(400).json({
          error: `Cannot link unallocated fine to payroll. Please allocate to an employee first.`,
        });
      }

      const pPeriod = payroll_period || payrollPeriod || fine.month || new Date().toISOString().substring(0, 7);
      const now = new Date().toISOString();

      fine.deducted_from_payroll = true;
      fine.payroll_period_key = pPeriod;
      fine.deducted_amount = fine.employee_liability;
      fine.employee_paid = (fine.employee_paid || 0) + fine.employee_liability;
      fine.outstanding_balance = Math.max(0, fine.total_amount - fine.company_paid - fine.employee_paid);
      fine.status = fine.outstanding_balance === 0 ? 'DEDUCTED_FROM_PAYROLL' : 'ASSIGNED_TO_DRIVER';
      fine.payroll_linked_by = userName;
      fine.payroll_linked_at = now;
      fine.updated_at = now;
      fine.updated_by = userName;

      if (notes) fine.notes = `${fine.notes ? fine.notes + ' | ' : ''}Payroll Note: ${notes}`;

      fine.history.unshift({
        id: `h_pay_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'HR & Payroll Officer',
        event_type: 'PAYROLL_LINKED',
        old_state: 'UNLINKED',
        new_state: `DEDUCTED_IN_${pPeriod}`,
        reason: `Scheduled payroll deduction of AED ${fine.employee_liability} for period ${pPeriod}`,
      });

      syncWithFleetFines(fine);

      // Audit Log
      if (db.auditLogs) {
        db.auditLogs.unshift({
          id: `log_pay_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Payroll',
          action: 'LINK_FINE_TO_PAYROLL',
          actionType: 'UPDATE',
          status: 'SUCCESS',
          module: 'Traffic Fines',
          details: `Linked fine ${fine.reference_number} (AED ${fine.employee_liability}) to payroll period ${pPeriod} for ${fine.rider_name}`,
          targetEntityId: fine.id,
          ipAddress: req.ip || '127.0.0.1',
        });
      }

      return res.json({
        success: true,
        message: `Traffic fine ${fine.reference_number} (AED ${fine.employee_liability}) successfully scheduled for payroll deduction in ${pPeriod}.`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 12. POST /api/erp/fines/:id/settle (Direct Company or Rider Settlement)
  router.post('/:id/settle', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { settlement_type = 'COMPANY', amount, payment_method = 'Corporate Bank Transfer', notes } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      const settleAmt = amount ? Number(amount) : (settlement_type === 'COMPANY' ? fine.company_liability : fine.total_amount);
      const now = new Date().toISOString();

      if (settlement_type === 'COMPANY') {
        fine.company_paid = (fine.company_paid || 0) + settleAmt;
      } else {
        fine.employee_paid = (fine.employee_paid || 0) + settleAmt;
      }

      fine.outstanding_balance = Math.max(0, fine.total_amount - fine.company_paid - fine.employee_paid);
      fine.settlement_status = fine.outstanding_balance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
      if (fine.outstanding_balance <= 0) {
        fine.status = 'PAID';
      }
      fine.updated_at = now;
      fine.updated_by = userName;

      fine.history.unshift({
        id: `h_settle_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'Finance Cashier',
        event_type: 'SETTLED',
        old_state: 'UNSETTLED',
        new_state: fine.settlement_status,
        reason: `Settled AED ${settleAmt} via ${payment_method}. Remaining balance: AED ${fine.outstanding_balance}`,
        notes: notes || '',
      });

      syncWithFleetFines(fine);

      return res.json({
        success: true,
        message: `Settled AED ${settleAmt} for fine ${fine.reference_number}.`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 13. POST /api/erp/fines/:id/dispute
  router.post('/:id/dispute', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { dispute_reason, disputeReason, notes } = req.body;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      const reason = (dispute_reason || disputeReason || 'Rider disputed traffic camera radar occurrence').trim();
      const now = new Date().toISOString();

      fine.status = 'DISPUTED';
      fine.dispute_reason = reason;
      fine.dispute_status = 'OPEN';
      fine.dispute_filed_by = userName;
      fine.dispute_filed_at = now;
      fine.updated_at = now;
      fine.updated_by = userName;

      fine.history.unshift({
        id: `h_disp_${Date.now()}`,
        timestamp: now,
        actor_name: userName,
        actor_id: userId,
        actor_role: 'Compliance & Legal',
        event_type: 'DISPUTED',
        old_state: 'ASSIGNED_TO_DRIVER',
        new_state: 'DISPUTED',
        reason,
        notes: notes || '',
      });

      syncWithFleetFines(fine);

      return res.json({
        success: true,
        message: `Traffic fine ${fine.reference_number} marked as DISPUTED.`,
        fine,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 14. POST /api/erp/fines/bulk-allocate (Bulk allocate resolvable historical riders)
  router.post('/bulk-allocate', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { fine_ids = [] } = req.body;

      if (!Array.isArray(fine_ids) || fine_ids.length === 0) {
        return res.status(400).json({ error: 'No fine IDs provided for bulk allocation.' });
      }

      let allocatedCount = 0;
      let failedCount = 0;
      const now = new Date().toISOString();

      for (const fId of fine_ids) {
        const fine = (db.trafficFines || []).find((f: any) => (f.id === fId || f.reference_number === fId) && f.tenant_id === tenantId);
        if (!fine) {
          failedCount++;
          continue;
        }

        const resolved = resolveRiderForVehicle(
          tenantId,
          fine.plate_number,
          fine.transaction_date,
          fine.transaction_time,
          fine.vehicle_id
        );

        if (resolved) {
          fine.rider_id = resolved.rider_id;
          fine.rider_name = resolved.rider_name;
          fine.rider_code = resolved.rider_code;
          fine.project_id = resolved.project_id;
          fine.project_name = resolved.project_name;
          fine.allocation_status = 'ALLOCATED';
          fine.allocation_source = 'HISTORICAL_ASSIGNMENT';
          fine.allocated_at = now;
          fine.allocated_by = userName;
          fine.status = 'ASSIGNED_TO_DRIVER';
          fine.liability_type = 'EMPLOYEE';
          fine.employee_liability = fine.total_amount;
          fine.company_liability = 0;
          fine.updated_at = now;
          fine.updated_by = userName;

          fine.history.unshift({
            id: `h_bulk_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            timestamp: now,
            actor_name: userName,
            actor_id: userId,
            actor_role: 'Fleet Manager',
            event_type: 'ALLOCATED',
            old_state: 'UNALLOCATED',
            new_state: 'ALLOCATED',
            reason: `Bulk confirmed historical assignment to ${resolved.rider_name} (${resolved.rider_code})`,
          });

          syncWithFleetFines(fine);
          allocatedCount++;
        } else {
          failedCount++;
        }
      }

      return res.json({
        success: true,
        allocated_count: allocatedCount,
        failed_count: failedCount,
        message: `Bulk allocation completed: ${allocatedCount} fines allocated, ${failedCount} could not be resolved from assignment history.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 15. GET /api/erp/fines/:id/history (Fine audit and responsibility timeline)
  router.get('/:id/history', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;

      const fine = (db.trafficFines || []).find((f: any) => (f.id === id || f.reference_number === id) && f.tenant_id === tenantId);
      if (!fine) {
        return res.status(404).json({ error: `Traffic fine ${id} not found.` });
      }

      return res.json({
        fine_id: fine.id,
        reference_number: fine.reference_number,
        history: fine.history || [],
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
