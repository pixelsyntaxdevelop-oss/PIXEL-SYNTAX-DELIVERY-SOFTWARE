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
  fine_type: string; // 'Vendor Wise' | 'Police Authority' | 'RTA' | 'Municipality' | 'General'
  vendor: string;
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
  violation_timestamp?: string;
  fine_amount: number;
  admin_fee: number;
  service_fee: number;
  total_amount: number; // fine + admin + service
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

export interface FineFinancialStats {
  totalFineAmount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  companyLiability: number;
  employeeLiability: number;
  outstandingBalance: number;
  companyPaid: number;
  employeePaid: number;
  settledAmount: number;
  unsettledAmount: number;
  totalCount: number;
  allocatedCount: number;
  unallocatedCount: number;
}

export interface FineBatchRow {
  row_id: string;
  plate_number: string;
  plate_code: string;
  transaction_date: string;
  transaction_time: string;
  fine_amount: number | string;
  admin_fee: number | string;
  service_fee: number | string;
  total_amount: number;
  reference_number: string;
  violation_type?: string;
  location?: string;
  notes?: string;
  status: 'READY' | 'INVALID_PLATE' | 'DUPLICATE_FINE' | 'MISSING_DATE' | 'INVALID_AMOUNT' | 'MISSING_REFERENCE' | 'VEHICLE_NOT_FOUND';
  status_message?: string;
  resolved_rider?: {
    rider_id: string;
    rider_name: string;
    rider_code: string;
    project_id?: string;
    project_name?: string;
    confidence: string;
  } | null;
  vehicle?: {
    id: string;
    plate_number: string;
    plate_code: string;
    emirate: string;
    vehicle_code: string;
  } | null;
}

export interface FineFilterState {
  month: string;
  branch: string;
  fineType: string;
  allocationStatus: 'ALL' | 'ALLOCATED' | 'UNALLOCATED';
  employee: string;
  search: string;
  page: number;
  pageSize: number;
}
