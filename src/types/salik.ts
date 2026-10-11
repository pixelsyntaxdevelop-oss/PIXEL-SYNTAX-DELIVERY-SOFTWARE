export interface SalikHistoryEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_id?: string;
  actor_role?: string;
  event_type:
    | 'IMPORTED'
    | 'VEHICLE_RESOLVED'
    | 'AUTO_ASSIGNED'
    | 'MANUALLY_ASSIGNED'
    | 'BULK_ASSIGNED'
    | 'LIABILITY_CHANGED'
    | 'PAYROLL_LINKED'
    | 'PAYROLL_DEDUCTED'
    | 'DISPUTED'
    | 'CORRECTED'
    | 'PREPAID_CREATED';
  old_state?: string;
  new_state?: string;
  reason?: string;
  notes?: string;
}

export interface SalikRecord {
  id: string;
  tenant_id: string;
  branch_id?: string;
  branch_name?: string;
  transaction_id: string; // e.g. 'SLK-DXB-2026-88019'
  transaction_date: string; // 'YYYY-MM-DD'
  transaction_time: string; // 'HH:MM:SS'
  transaction_timestamp: string; // ISO string
  toll_gate: string; // 'Al Barsha', 'Al Safa', 'Airport Tunnel', etc.
  direction: string; // 'Northbound', 'Southbound', 'Eastbound', 'Westbound'
  tag_number?: string;
  plate_number: string;
  plate_code?: string;
  plate_emirate?: string;
  vehicle_id?: string;
  vehicle_code?: string;
  vehicle_type?: string;
  amount: number; // typically 4.00 or 8.00 AED
  
  // Assignment & Rider
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  assigned_employee_code?: string;
  assigned_project_id?: string;
  assigned_project_name?: string;
  allocation_source?: 'AUTO_HISTORY' | 'MANUAL' | 'COMPANY' | 'PREPAID';
  allocated_at?: string;
  allocated_by?: string;

  // Charge status & Liability
  charge_status: 'UNCHARGED' | 'CHARGED' | 'COMPANY_LIABILITY' | 'DISPUTED';
  status: 'PENDING' | 'ALLOCATED' | 'PAYROLL_LINKED' | 'PAID' | 'COMPANY_LIABILITY' | 'DISPUTED';
  payroll_period?: string; // e.g. '2026-08'
  deducted_amount?: number;
  company_liability: number;
  employee_liability: number;
  notes?: string;

  // Origin & classification
  source_type: 'TOLL_UPLOAD' | 'MANUAL_PREPAID';
  reference?: string;

  // Payroll Tracking
  payroll_linked_by?: string;
  payroll_linked_at?: string;

  // Audit Timeline
  history: SalikHistoryEntry[];

  created_by: string;
  created_at: string;
  updated_by: string;
  updated_at: string;
}

export interface SalikFinancialStats {
  totalSalikAmount: number;
  chargedToEmployees: number;
  unchargedPending: number;
  companyLiability: number;
  outstandingBalance: number;
  totalCount: number;
  chargedCount: number;
  unchargedCount: number;
  companyLiabilityCount: number;
}

export interface SalikFilterState {
  from: string; // 'YYYY-MM-DD'
  to: string; // 'YYYY-MM-DD'
  search: string;
  chargeFilter: 'ALL' | 'CHARGED' | 'UNCHARGED';
  tollGate?: string;
  page: number;
  pageSize: number;
}

export interface SalikBatchRow {
  row_id: string;
  transaction_id: string;
  transaction_date: string;
  transaction_time: string;
  toll_gate: string;
  direction: string;
  tag_number: string;
  plate_number: string;
  plate_code: string;
  amount: number;
  status:
    | 'READY'
    | 'DUPLICATE_TRANSACTION'
    | 'INVALID_DATE'
    | 'INVALID_AMOUNT'
    | 'PLATE_NOT_FOUND'
    | 'VEHICLE_NOT_RESOLVED'
    | 'INVALID_TAG';
  status_message: string;
  vehicle_id?: string;
  vehicle_code?: string;
  vehicle_type?: string;
  resolved_rider?: {
    rider_id: string;
    rider_name: string;
    rider_code: string;
    project_id?: string;
    project_name?: string;
    confidence: string;
  };
}

export interface SalikBatchValidationResult {
  total_rows: number;
  ready_count: number;
  failed_count: number;
  results: SalikBatchRow[];
}
