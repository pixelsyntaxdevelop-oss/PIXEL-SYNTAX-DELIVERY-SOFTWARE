// Enterprise Payroll / Salary Management Types
// Strict single-engine architecture with configurable project calculation methods

export type PayrollPeriodStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'NEEDS_REVIEW'
  | 'READY'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'PAID'
  | 'LOCKED';

export type ProjectSalaryCalculationMethod =
  | 'HOURLY'
  | 'FIXED_MONTHLY'
  | 'PER_DELIVERY'
  | 'MANUAL_IMPORT'
  | 'HYBRID';

export type SalaryGroup =
  | 'LABOUR'
  | 'KEETA'
  | 'NOON'
  | 'DELIVEROO'
  | 'TALABAT'
  | 'FIXED'
  | 'GENERAL'
  | string;

export type PayrollSourceType =
  | 'LABOUR_HOURLY_TEMPLATE'
  | 'KEETA_TIMESHEET'
  | 'NOON_MINUTES_TIMESHEET'
  | 'DELIVERY_PROJECT_TIMESHEET'
  | 'FIXED_MONTHLY'
  | 'CUSTOM_IMPORT';

export interface ProjectImportProfile {
  id: string;
  tenant_id: string;
  profile_name: string;
  project_id: string;
  project_name: string;
  salary_group: string; // LABOUR, KEETA, NOON, FIXED, etc.
  source_type: PayrollSourceType;
  status: 'ACTIVE' | 'WAITING_FOR_SOURCE_FORMAT' | 'SOURCE_FORMAT_RECEIVED';
  status_note?: string;
  accepted_file_types: string[];
  header_row: number;
  source_sheets?: string[];
  column_mapping: Record<string, string>;
  payout_mappings?: Record<string, any>;
  required_columns: string[];
  employee_resolver_priority: ('EMPLOYEE_CODE' | 'EMIRATES_ID' | 'PROJECT_RIDER_ID')[];
  calculation_rules: {
    method: 'HOURLY' | 'CLIENT_SPECIFIED_UNCONFIGURED' | 'FIXED' | 'PER_DELIVERY';
    formula_description?: string;
  };
  validation_rules: {
    max_hours_warning?: number;
    allow_unresolved_employees?: boolean;
    recalculate_totals?: boolean;
    trust_source_total_with_review?: boolean;
  };
  duplicate_key_fields: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectRiderMapping {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  external_rider_id: string; // e.g. "KEE-1001", "NOON-8801"
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface TrafficFineDeductionDetail {
  fine_id: string;
  ticket_number: string;
  plate_number: string;
  violation_timestamp: string;
  posting_date: string;
  total_liability: number;
  previously_deducted: number;
  current_deduction: number;
  remaining_balance: number;
  allocation_source: string;
}

export interface SalikDeductionDetail {
  salik_id: string;
  transaction_id: string;
  toll_gate: string;
  plate_number: string;
  crossing_timestamp: string;
  amount: number;
}

export interface LoanDeductionDetail {
  loan_id: string;
  reason: string;
  installment_amount: number;
  remaining_balance_after: number;
}

export interface AdvanceDeductionDetail {
  advance_id: string;
  reason: string;
  installment_amount: number;
  remaining_balance_after: number;
}

export interface ProjectSalaryLine {
  id: string;
  employee_id: string;
  payroll_period_id: string;
  project_id: string;
  project_name: string;
  salary_group_id?: string;
  salary_group?: string;
  source_batch_id?: string;
  source_row_reference?: string;
  work_from?: string;
  work_to?: string;
  source_metrics_json?: any;
  gross_project_earning?: number;
  allowances?: number;
  incentives?: number;
  project_penalties?: number;
  manual_adjustment?: number;
  net_project_earning?: number;
  source_total?: number;
  calculation_audit?: string;
  from_date?: string;
  to_date?: string;
  days_eligible?: number;
  calculation_method: ProjectSalaryCalculationMethod;
  working_hours?: number;
  hourly_rate?: number;
  units_completed?: number; // e.g. deliveries or tasks
  rate_per_unit?: number;
  gross_earnings: number;
  allowance: number;
  incentive: number;
  deduction: number;
  net_project_amount: number;
  notes?: string;
  total_orders?: number;
  rider_earning?: number;
  penalty?: number;
  cod?: number;
  vendor_share?: number;
  source_fine?: number;
  source_loan?: number;
  source_rider_salary?: number;
  supporting_details?: any;
}

export interface PayrollException {
  id?: string;
  type:
    | 'NEGATIVE_NET_SALARY'
    | 'NEGATIVE_NET_REVIEW_REQUIRED'
    | 'UNRESOLVED_RIDER'
    | 'SOURCE_RECONCILIATION_MISMATCH'
    | 'DUPLICATE_WORKBOOK'
    | 'SOURCE_PERIOD_MISALIGNMENT'
    | 'HOURLY_RATE_MISMATCH'
    | 'EXCEL_TOTAL_MISMATCH'
    | 'DUPLICATE_IMPORT'
    | 'MISSING_EMPLOYEE'
    | 'MISSING_BANK_OR_IBAN'
    | 'HIGH_HOURS'
    | 'HIGH_TRAFFIC_FINES'
    | 'DUPLICATE_DEDUCTION_ATTEMPT'
    | 'LARGE_SALARY_CHANGE'
    | 'JOINED_MID_MONTH'
    | 'NO_PROJECT_ASSIGNMENT';
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  resolved?: boolean;
}

export interface PartnerWorkbookBatch {
  batch_id: string;
  tenant_id: string;
  original_file_name: string;
  file_hash: string;
  uploaded_by: string;
  uploaded_at: string;
  source_profile: string;
  source_period_start: string;
  source_period_end: string;
  payroll_month: string;
  sheets_detected: string[];
  total_riders_found: number;
  resolved_riders_count: number;
  unresolved_riders_count: number;
  reconciliation: {
    status: 'PASS' | 'WARNING' | 'FAIL';
    total_summary_gross: number;
    total_summary_mg: number;
    total_summary_additional: number;
    total_summary_deductions: number;
    total_summary_final: number;
    total_rider_deductions_sheet: number;
    total_additional_earnings_sheet: number;
    total_vendor_deductions_sheet: number;
    checks: Array<{ rule: string; expected: number; actual: number; status: 'MATCH' | 'DISCREPANCY'; difference: number }>;
  };
  preview_rows: any[];
  status: 'PARSED' | 'VALIDATED' | 'COMMITTED' | 'REJECTED';
}

export interface EnterprisePayrollRecord {
  id: string;
  tenant_id: string;
  payroll_period_id: string;
  period_key: string; // '2026-08'
  period_month: string; // 'August 2026'
  year: number;
  month: number;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  emirates_id?: string;
  designation: string;
  department: string;
  branch_id: string;
  branch_name: string;
  bank_name?: string;
  iban?: string;
  project_id?: string;
  project_name?: string;
  project_code?: string;
  status: 'DRAFT' | 'NEEDS_REVIEW' | 'READY' | 'APPROVED' | 'PUBLISHED' | 'PAID';
  has_exceptions: boolean;
  exceptions: PayrollException[];
  projects_worked: string[];
  project_earnings_lines: ProjectSalaryLine[];
  base_salary: number;
  prorated_base_salary: number;
  working_hours: number;
  deliveries_completed: number;
  overtime_hours: number;
  overtime_pay: number;
  total_allowances: number;
  delivery_incentives: number;
  bonus_adjustments: number;
  other_earnings: number;
  gross_earnings: number;
  absence_deductions: number;
  traffic_fines_deduction: number;
  fine_ticket_ids: string[];
  traffic_fines_breakdown?: TrafficFineDeductionDetail[];
  salik_deduction: number;
  salik_ids: string[];
  salik_breakdown?: SalikDeductionDetail[];
  loan_deduction: number;
  loan_ids: string[];
  loan_breakdown?: LoanDeductionDetail[];
  advance_deduction: number;
  advance_ids: string[];
  advance_breakdown?: AdvanceDeductionDetail[];
  manual_deductions: number;
  penalty_deductions: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  expected_import_net?: number;
  excel_mismatch?: boolean;
  payment_method: 'WPS_SIF' | 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
  payment_reference?: string;
  payment_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface EnterprisePayrollPeriod {
  id: string;
  tenant_id: string;
  period_key: string;
  period_month: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  cutoff_date: string;
  total_employees: number;
  total_gross_pay: number;
  total_allowances: number;
  total_delivery_incentives: number;
  total_overtime_pay: number;
  total_deductions: number;
  total_traffic_fines: number;
  total_salik: number;
  total_loans_recovered: number;
  total_advances_recovered: number;
  total_net_payable: number;
  exceptions_count: number;
  ready_count: number;
  reconciled: boolean;
  generated_at?: string;
  generated_by?: string;
  approved_at?: string;
  approved_by?: string;
  published_at?: string;
  published_by?: string;
  paid_at?: string;
  paid_by?: string;
  locked_at?: string;
  locked_by?: string;
  wps_file_generated?: boolean;
  reopened_history?: {
    date: string;
    user: string;
    reason: string;
    old_net: number;
    new_net: number;
  }[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollAdjustment {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  type:
    | 'ALLOWANCE'
    | 'BONUS'
    | 'INCENTIVE'
    | 'ADVANCE'
    | 'LOAN_DEDUCTION'
    | 'MANUAL_DEDUCTION'
    | 'OTHER_DEDUCTION'
    | 'OTHER_EARNING'
    | 'CORRECTION';
  amount: number;
  reason: string;
  effective_month: string;
  reference?: string;
  project_id?: string;
  project_name?: string;
  source_transaction_id?: string;
  created_by: string;
  created_at: string;
  status: 'ACTIVE' | 'APPLIED' | 'CANCELLED';
}

export interface EmployeeLoan {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  original_amount: number;
  start_date: string;
  start_month: string;
  monthly_installment: number;
  amount_paid: number;
  remaining_balance: number;
  reason: string;
  status: 'ACTIVE' | 'PAID_OFF' | 'SUSPENDED';
  approved_by: string;
  repayment_history: {
    date: string;
    amount: number;
    payroll_period_id: string;
    recorded_by: string;
  }[];
  created_at: string;
}

export interface EmployeeAdvance {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  advance_amount: number;
  installments_count: number;
  monthly_installment: number;
  amount_repaid: number;
  remaining_balance: number;
  reason: string;
  disbursed_date: string;
  deduction_start_month: string;
  status: 'ACTIVE' | 'PAID_OFF' | 'SUSPENDED';
  approved_by: string;
  repayment_history: {
    date: string;
    amount: number;
    payroll_period_id: string;
    recorded_by: string;
  }[];
  created_at: string;
}

export interface PayrollImportBatch {
  id: string;
  tenant_id: string;
  batch_id: string;
  file_name: string;
  month: string;
  project_id?: string;
  project_name?: string;
  salary_group: string;
  total_rows: number;
  valid_rows: number;
  warning_rows: number;
  error_rows: number;
  imported_by: string;
  imported_at: string;
  status: 'VALIDATED' | 'COMMITTED' | 'REJECTED';
  preview_data?: any[];
}

export interface ProjectSalaryConfig {
  id: string;
  tenant_id: string;
  project_id: string;
  project_name: string;
  salary_group: SalaryGroup;
  calculation_method: ProjectSalaryCalculationMethod;
  default_rate: number;
  rate_type: 'HOURLY' | 'PER_DELIVERY' | 'FIXED' | 'CUSTOM';
  allowance_rules?: string;
  incentive_rules?: string;
  overtime_rules?: string;
  required_fields: string[];
}
