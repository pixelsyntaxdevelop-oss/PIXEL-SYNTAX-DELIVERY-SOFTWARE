export interface SimRecord {
  id: string;
  tenant_id: string;
  mobile_number: string;
  normalized_mobile_number?: string;
  sim_serial_number?: string;
  iccid?: string;
  provider?: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | string;
  vendor: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | string;
  state: 'Dubai' | 'Abu Dhabi' | 'Al Ain' | 'Sharjah' | 'Ajman' | 'RAK' | 'Fujairah' | string;
  source: 'Company SIMs' | 'Direct DU Telecom' | 'Etisalat Corporate' | 'Virgin Mobile' | 'STC' | string;
  plan: string;
  monthly_package_amount: number;
  approved_amount: number;
  payable_amount?: number;
  monthly_cost?: number;
  status: 'Available' | 'Assigned' | 'Inactive' | 'Lost' | 'Replacement' | 'Recovery' | 'Active' | 'Suspended' | 'Cancelled' | string;
  assignment_status: 'Assigned' | 'Unassigned' | 'Lost';
  service_status: 'Active' | 'Inactive' | 'Suspended' | 'Cancelled';
  is_active: boolean;
  is_archived?: boolean;
  branch_id?: string;
  branch_name?: string;
  activation_date?: string;
  notes?: string;

  // Current Holder Details
  current_employee_id?: string;
  current_employee_name?: string;
  current_employee_code?: string;
  assigned_to_id?: string;
  assigned_to_name?: string;
  sim_number?: string;
  current_emirates_id?: string;
  current_project_id?: string;
  current_project_name?: string;
  current_project?: string;
  current_vehicle_id?: string;
  current_vehicle_plate?: string;
  assigned_date?: string;
  assign_note?: string;

  // Last Assignment / Custodianship History (Visible after return)
  last_assignment_id?: string;
  last_employee_id?: string;
  last_employee_name?: string;
  last_employee_code?: string;
  last_assigned_date?: string;
  last_returned_date?: string;
  last_return_reason?: string;
  previous_project?: string;
  last_assignment?: any;

  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by?: string;
}

export interface SimDashboardStats {
  totalSims: number;
  active: number;
  inactive: number;
  suspended?: number;
  cancelled?: number;
  assigned: number;
  available: number;
  unassigned: number;
  lost: number;
  replacement: number;
  recovery: number;
  totalMonthlyBillingAED: number;
  assignedSims?: number;
  availableSims?: number;
  inactiveSims?: number;
  totalMonthlySpend?: number;
  assignmentCounts?: Record<string, number>;
  serviceCounts?: Record<string, number>;
  statusCounts: Record<string, number>;
  stateCounts: Record<string, { total: number; assigned: number; available: number }>;
  sourceCounts: Record<string, number>;
  vendorCounts: Record<string, number>;
}

export interface SimAssignmentLog {
  id: string;
  tenant_id: string;
  sim_id: string;
  mobile_number?: string;
  action_type: 'ASSIGN' | 'RETURN' | 'TRANSFER';
  status?: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  emirates_id?: string;
  project_id?: string;
  project_name?: string;
  previous_project?: string;
  vehicle_id?: string;
  vehicle_plate?: string;
  assigned_date: string;
  assigned_time?: string;
  assigned_by?: string;
  return_date?: string;
  return_time?: string;
  returned_by?: string;
  assign_remark?: string;
  return_remark?: string;
  return_reason?: string;
  reason?: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export interface SimStatusHistoryLog {
  id: string;
  tenant_id: string;
  sim_id: string;
  mobile_number?: string;
  previous_status: string;
  new_status: string;
  reason?: string;
  created_at: string;
  created_by: string;
}

export interface SimEmployeeSearchCandidate {
  id: string;
  full_name: string;
  employee_code: string;
  emirates_id?: string;
  visa_contractor_type?: string;
  project_name?: string;
  primary_project?: string;
  current_bike_plate?: string;
  current_sim_id?: string;
  current_sim_number?: string;
  has_active_sim?: boolean;
  current_status?: string;
}

export interface CreateSimRow {
  mobile_number: string;
  provider: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | string;
  vendor?: string;
  iccid?: string;
  service_status: 'Active' | 'Inactive';
  notes?: string;
  state?: string;
  source?: string;
  monthly_package_amount?: number;
}

export interface BatchCreateResultItem {
  row: number;
  mobile_number?: string;
  success: boolean;
  error?: string;
  sim?: SimRecord;
}

export interface BulkSimImportItem {
  rowNumber: number;
  rawMobileNumber: string;
  mobile_number: string;
  account_name?: string;
  product_category?: string;
  product_type?: string;
  activation_date?: string;
  status?: string;
  party_id?: string;
  tag1?: string;
  tag2?: string;
  tag3?: string;
  tag4?: string;
  monthly_package_amount: number;
  provider?: string;
  vendor?: string;
  service_status: string;
  notes?: string;
  validationStatus: 'VALID' | 'DUPLICATE' | 'INVALID';
  validationMessage?: string;
  conflictDetails?: string;
}

export interface BulkSimImportPreviewResponse {
  success: boolean;
  totalRows: number;
  validRows: number;
  duplicateRows: number;
  invalidRows: number;
  items: BulkSimImportItem[];
}
