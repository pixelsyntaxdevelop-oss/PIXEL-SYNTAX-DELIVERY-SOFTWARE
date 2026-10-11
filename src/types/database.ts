/**
 * PostgreSQL & Supabase Database Type Definitions
 * Multi-Tenant SaaS Delivery Operations ERP
 */

export interface DbPlan {
  id: string;
  name: string;
  tier: string;
  max_users: number;
  max_riders: number;
  max_vehicles: number;
  max_branches: number;
  max_storage_gb: number;
  ai_requests_monthly: number;
  monthly_price: number;
  features: string[];
  created_at: string;
}

export interface DbTenant {
  id: string; // e.g. 'company_pixel_syntax', 'company_swift'
  code: string;
  name: string;
  trade_license_number?: string;
  tax_registration_number?: string;
  domain?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
  plan_id: string;
  subscription_start: string;
  subscription_expiry: string;
  company_admin_email: string;
  company_admin_name: string;
  country: string;
  city: string;
  currency: string;
  logo_url?: string;
  primary_color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbTenantSettings {
  id: string;
  tenant_id: string;
  enabled_modules: string[];
  limits: {
    maxUsers: number;
    maxRiders: number;
    maxVehicles: number;
    maxBranches: number;
    maxStorageGB: number;
    aiRequestsMonthly: number;
    smsMonthly?: number;
    whatsappMonthly?: number;
  };
  usage: {
    activeUsers: number;
    activeRiders: number;
    activeVehicles: number;
    usedBranches: number;
    usedStorageGB: number;
    aiRequestsUsed: number;
    smsUsed?: number;
    whatsappUsed?: number;
  };
  custom_branding?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DbBranch {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  city: string;
  country: string;
  is_headquarters: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbDepartment {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  branch_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbProfile {
  id: string;
  auth_user_id?: string;
  tenant_id: string;
  username: string;
  email: string;
  full_name: string;
  phone?: string;
  designation?: string;
  avatar_url?: string;
  is_owner: boolean;
  is_super_admin: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  primary_branch_id?: string;
  primary_department_id?: string;
  allowed_modules: string[];
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export interface DbRole {
  id: string;
  tenant_id?: string;
  role_key: string;
  display_name: string;
  description?: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPermission {
  id: string;
  module: string;
  action:
    | 'view'
    | 'create'
    | 'edit'
    | 'delete'
    | 'archive'
    | 'restore'
    | 'download'
    | 'upload'
    | 'export'
    | 'print'
    | 'approve'
    | 'reject'
    | 'assign'
    | 'manage'
    | 'use_ai';
  description?: string;
  created_at: string;
}

export interface DbRolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  tenant_id?: string;
  created_at: string;
}

export interface DbUserRole {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  created_at: string;
}

export interface DbUserBranchAccess {
  id: string;
  user_id: string;
  branch_id: string;
  tenant_id: string;
  has_full_access: boolean;
  created_at: string;
}

export interface DbUserDepartmentAccess {
  id: string;
  user_id: string;
  department_id: string;
  tenant_id: string;
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  tenant_id: string;
  user_id?: string;
  actor_name: string;
  actor_role: string;
  action: string;
  action_type: 'ASSIGN' | 'UNASSIGN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'STATUS_CHANGE' | 'EXPORT' | 'APPROVE' | 'REJECT';
  module: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  details: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED';
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface DbEmployee {
  id: string;
  tenant_id: string;
  employee_code: string;
  full_name: string;
  department: string;
  designation?: string;
  email?: string;
  phone?: string;
  joining_date: string;
  salary_base: number;
  allowances: number;
  tax_deduction: number;
  attendance_rate: number;
  leave_balance_days: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED';
  contract_end_date?: string;
  branch_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbVehicle {
  id: string;
  tenant_id: string;
  plate_number: string;
  plateNumber?: string;
  model: string;
  make: string;
  year: number;
  type: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  branch_id?: string;
  current_rider_id?: string;
  odometer_km: number;
  current_odometer?: number;
  odometerKm?: number;
  fuel_level_percent: number;
  mulkiya_number?: string;
  mulkiya_expiry?: string;
  insurance_company?: string;
  insurance_policy_number?: string;
  insurance_expiry?: string;
  last_service_date?: string;
  next_service_km?: number;
  tire_condition_percent?: number;
  oil_condition_percent?: number;
  fuel_cost_this_month?: number;
  maintenance_cost_this_month?: number;
  accident_count?: number;
  gps_device_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbRider {
  id: string;
  tenant_id: string;
  code: string;
  full_name: string;
  email?: string;
  phone: string;
  role_type: 'RIDER' | 'DRIVER';
  branch_id?: string;
  status: 'ONLINE' | 'DELIVERING' | 'OFFLINE' | 'ON_LEAVE' | 'SUSPENDED';
  avatar_url?: string;
  deliveries_completed: number;
  rating: number;
  on_time_rate: number;
  cancellation_rate: number;
  passport_number?: string;
  passport_expiry?: string;
  visa_number?: string;
  visa_expiry?: string;
  emirates_id?: string;
  emirates_id_expiry?: string;
  license_number?: string;
  license_expiry?: string;
  contract_type?: string;
  joining_date?: string;
  base_salary: number;
  incentives_month: number;
  penalties_month: number;
  assigned_vehicle_id?: string;
  equipment_assigned?: Record<string, boolean>;
  current_location?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbCandidate {
  id: string;
  tenant_id: string;
  candidate_id: string;
  full_name: string;
  unique_id: string;
  cnic_passport: string;
  mobile: string;
  created_date: string;
  interview: 'Pass' | 'Fail' | 'Pending';
  status: 'Active' | 'Inactive' | 'Closed';
  license_package_type: string;
  total_package: number;
  advance: number;
  balance: number;
  per_month_deduction: number;
  current_stage: string;
  current_stage_code: 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'STAGE_5' | 'STAGE_6';
  stage_status: 'Not Started' | 'Open' | 'Completed' | 'Skipped';
  stage1_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage2_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage3_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage4_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage5_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage6_status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  visa_process: {
    current: string;
    completed: string;
    elapsed: string;
    next: string;
  };
  dl_process: {
    current: string;
    completed: string;
    elapsed: string;
    next: string;
  };
  stage_data?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbDocument {
  id: string;
  tenant_id: string;
  entity_type: 'RIDER' | 'VEHICLE' | 'EMPLOYEE' | 'CANDIDATE' | 'COMPANY';
  entity_id: string;
  entity_name: string;
  document_type: string;
  document_number?: string;
  expiry_date: string;
  file_url?: string;
  status: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  created_at: string;
  updated_at: string;
}

export interface DbAttendanceRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  check_in?: string;
  check_out?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'OFFICIAL_VISIT';
  location?: string;
  shift_name?: string;
  overtime_hours: number;
  created_at: string;
}

export interface DbSimCard {
  id: string;
  tenant_id: string;
  sim_number: string;
  phone_number: string;
  provider: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC';
  plan_name: string;
  monthly_bill_aed: number;
  data_usage_gb: number;
  data_limit_gb: number;
  assigned_rider_id?: string;
  assigned_rider_name?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'AVAILABLE';
  created_at: string;
  updated_at: string;
}

// ==============================================================================
// STEP 2: MASTER EMPLOYEE & ASSET ASSIGNMENT SCHEMAS
// ==============================================================================

export interface DbProject {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  client_name: string;
  project_type?: string;
  external_id_label?: string;
  notes?: string;
  active_count?: number;
  branch_id?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED' | string;
  rate_per_order: number;
  created_at: string;
  updated_at: string;
}

export type EmployeeMasterStatus =
  | 'Active'
  | 'Inactive'
  | 'Available / Unassigned'
  | 'Assigned / Active'
  | 'On Hold'
  | 'Under Process / Visa Pending'
  | 'Onboarding'
  | 'Waiting for Visa'
  | 'Waiting for License'
  | 'Ready to Deploy'
  | 'Assigned'
  | 'Unassigned'
  | 'On Leave'
  | 'Suspended'
  | 'Absconding'
  | 'Terminated'
  | 'Resigned'
  | 'Exited / Resigned'
  | 'Cancelled'
  | 'Vacation'
  | 'Medical Leave'
  | 'Other'
  | (string & {});

export interface DbShift {
  id: string;
  tenant_id?: string;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  grace_minutes?: number;
  break_minutes?: number;
  is_active?: boolean;
}

export interface DbDesignation {
  id: string;
  name: string;
  code?: string;
  department?: string;
  category?: string;
  is_rider?: boolean;
}

export interface DbContractCategory {
  id: string;
  name: string;
  description?: string;
}

export interface DbTeamMaster {
  id: string;
  name: string;
  leader?: string;
  branchId?: string;
}

export interface DbManagerLookup {
  id: string;
  name: string;
  designation: string;
  email?: string;
}

export interface DbEmployeeMaster {
  state?: string | null;
  id: string; // Internal unique ID (UUID or 'emp_xxx')
  employee_id?: string;
  employee_code: string;
  code_overridden?: boolean;
  code_override_reason?: string;
  tenant_id: string;
  branch_id?: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  full_name: string;
  username?: string;
  photo?: string;
  nationality: string;
  date_of_birth?: string;
  gender: 'Male' | 'Female' | 'Other';
  personal_mobile?: string;
  company_mobile?: string;
  email?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  passport_number?: string;
  passport_expiry?: string;
  passport_status: 'With Company' | 'With Rider' | 'In Office';
  passport_handler?: string;
  passport_location?: string;
  passport_receive_date?: string;
  emirates_id_number?: string;
  emirates_id_expiry?: string;
  visa_number?: string;
  visa_expiry?: string;
  driving_license_number?: string;
  driving_license_expiry?: string;
  joining_date: string;
  employment_type: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE';
  job_title?: string;
  designation: string;
  contractor_id?: string;
  contractor: 'Own' | 'Allied DXB' | 'Allied AUH' | 'Rapid Crew' | 'ALLIED DXB' | 'ALLIED AUH' | 'RAPID CREW' | string;
  visa_contractor_type?: string;
  vendor_id?: string;
  vendor_name?: string;
  project_id?: string;
  project_name?: string;
  project_code?: string;
  supervisor_id?: string;
  team_leader_id?: string;
  team_id?: string;
  team_name?: string;
  shift_id?: string;
  shift_name?: string;
  manager_id?: string;
  manager_name?: string;
  current_status: EmployeeMasterStatus;
  status_reason?: string;
  status_effective_date?: string;
  salary_type: 'MONTHLY' | 'HOURLY' | 'COMMISSION_ONLY' | 'HYBRID';
  basic_salary: number;
  allowances: number;
  leave_opening_balance?: number;
  notes?: string;
  current_bike_id?: string;
  current_bike_plate?: string;
  current_sim_id?: string;
  current_sim_number?: string;
  current_sim_provider?: string;
  current_sim_iccid?: string;
  current_sim_assigned_date?: string;
  current_sim_assigned_by?: string;
  is_office_staff?: boolean;
  has_software_access?: boolean;
  photo_document_id?: string;
  is_archived: boolean;
  archived_at?: string;
  archived_by?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  // Compatibility & Legacy Aliases
  status?: string;
  emirates_id?: string;
  current_project_name?: string;
  current_project?: string;
  employee_code_on_project?: string;
  contact_number?: string;
  mobile_number?: string;
  phone_number?: string;
  passport_custody_status?: string;
  name?: string;
  branch?: string;
  assigned_date?: string;
}

export type DbMasterEmployee = DbEmployeeMaster;


export interface DbEmployeeStatusHistory {
  id: string;
  tenant_id: string;
  employee_id: string;
  status: EmployeeMasterStatus;
  reason?: string;
  effective_from: string;
  effective_to?: string;
  notes?: string;
  changed_by: string;
  created_at: string;
}

export interface DbVisaContractorType {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'INTERNAL' | 'CONTRACTOR' | 'OUTSOURCED';
  requires_vendor_company: boolean;
  is_active: boolean;
}

export interface DbVendorCompany {
  id: string;
  tenant_id: string;
  name: string;
  code?: string;
  trade_license?: string;
  city?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at?: string;
}

export interface DbEmployeeVisaContractorHistory {
  id: string;
  tenant_id: string;
  employee_id: string;
  previous_type?: string | null;
  new_type: string;
  previous_vendor_id?: string | null;
  new_vendor_id?: string | null;
  previous_vendor_name?: string | null;
  new_vendor_name?: string | null;
  effective_date: string;
  reason: string;
  notes?: string;
  changed_by: string;
  created_at: string;
}

export interface DbEmployeeProjectAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  project_id: string;
  project_name?: string;
  project_code?: string;
  branch_id?: string;
  assignment_start_date: string;
  assignment_end_date?: string;
  status: 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED' | 'CANCELLED';
  employee_code_on_project?: string;
  external_rider_id?: string;
  external_id_type?: string;
  notes?: string;
  assigned_by: string;
  created_at: string;
}

export interface DbVehicleMaster {
  id: string;
  vehicle_id?: string;
  tenant_id: string;
  vehicle_type: 'Bike' | 'Car' | 'Van' | 'Truck' | 'Other';
  plate_number: string;
  plate_code?: string;
  plate_emirate?: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  chassis_number?: string;
  engine_number?: string;
  registration_number?: string;
  registration_expiry?: string;
  insurance_number?: string;
  insurance_expiry?: string;
  ownership_type: 'OWNED' | 'LEASED' | 'RENTED';
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  current_odometer: number;
  current_employee_id?: string;
  current_employee_name?: string;
  branch_id?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface DbVehicleAssignment {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_model?: string;
  employee_id: string;
  employee_name?: string;
  assignment_date: string;
  assignment_time: string;
  return_date?: string;
  return_time?: string;
  assignment_status: 'ACTIVE' | 'RETURNED' | 'REPLACED';
  starting_odometer: number;
  return_odometer?: number;
  condition_on_assignment?: string;
  condition_on_return?: string;
  handover_notes?: string;
  return_notes?: string;
  assigned_by: string;
  returned_to?: string;
  created_at: string;
}

export interface DbSimCardMaster {
  id: string;
  tenant_id: string;
  mobile_number: string;
  sim_number?: string;
  sim_serial_number: string;
  iccid?: string;
  provider: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | 'OTHER';
  plan: string;
  monthly_cost: number;
  monthly_package_amount?: number;
  approved_amount?: number;
  payable_amount?: number;
  status: 'AVAILABLE' | 'ASSIGNED' | 'SUSPENDED' | 'TERMINATED' | string;
  assignment_status?: string;
  branch_id?: string;
  activation_date?: string;
  expiry_date?: string;
  current_employee_id?: string;
  current_employee_name?: string;
  current_employee_code?: string;
  current_project_name?: string;
  current_vehicle_plate?: string;
  notes?: string;
  service_status?: string;
  is_active?: boolean;
  assigned_date?: string;
  assigned_by?: string;
  vendor?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
}

export interface DbSimAssignment {
  id: string;
  tenant_id: string;
  sim_card_id: string;
  sim_number: string;
  mobile_number: string;
  provider: string;
  iccid?: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  assigned_at: string;
  assigned_date?: string;
  returned_at?: string;
  returned_date?: string;
  status: 'ACTIVE' | 'RETURNED' | 'REPLACED' | 'TRANSFERRED';
  assigned_by: string;
  returned_by?: string;
  returned_to?: string;
  return_reason?: string;
  return_remark?: string;
  notes?: string;
  created_at: string;
}

export interface DbAsset {
  id: string;
  tenant_id: string;
  asset_type: 'Phone' | 'Helmet' | 'Uniform' | 'Delivery Box' | 'Power Bank' | 'Bag' | 'Other';
  asset_name: string;
  serial_number?: string;
  barcode?: string;
  brand?: string;
  model?: string;
  status: 'AVAILABLE' | 'ASSIGNED' | 'MAINTENANCE' | 'RETIRED';
  condition: 'NEW' | 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
  branch_id?: string;
  cost: number;
  purchase_date?: string;
  current_employee_id?: string;
  notes?: string;
  created_at: string;
  created_by?: string;
}

export interface DbAssetAssignment {
  id: string;
  tenant_id: string;
  asset_id: string;
  asset_name: string;
  asset_type: string;
  employee_id: string;
  employee_name?: string;
  assigned_at: string;
  returned_at?: string;
  status: 'ACTIVE' | 'RETURNED' | 'DAMAGED';
  condition_on_assignment: string;
  condition_on_return?: string;
  assigned_by: string;
  returned_to?: string;
  notes?: string;
  created_at: string;
}

export interface DbEmployeeTimelineEvent {
  id: string;
  tenant_id: string;
  employee_id: string;
  event_type: string;
  event_category: 'STATUS' | 'PROJECT' | 'BIKE' | 'SIM' | 'ASSET' | 'DOCUMENT' | 'SALARY' | 'SYSTEM';
  title: string;
  description: string;
  performed_by: string;
  performed_by_role?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// ==============================================================================
// STEP 3: ENTERPRISE DOCUMENT MANAGEMENT SYSTEM SCHEMA & TYPES
// ==============================================================================

export type DocumentEntityType =
  | 'Employee'
  | 'Rider'
  | 'Driver'
  | 'Vehicle'
  | 'Company'
  | 'Branch'
  | 'Vendor'
  | 'Customer'
  | 'Asset'
  | 'Project';

export type DocumentStatus =
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRES_TODAY'
  | 'EXPIRED'
  | 'NO_EXPIRY'
  | 'ARCHIVED'
  | 'ACTIVE'
  | (string & {});

export interface DbDocumentType {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  category: 'EMPLOYEE' | 'VEHICLE' | 'COMPANY' | 'VENDOR' | 'ASSET' | 'PROJECT' | 'OTHER';
  is_system_default: boolean;
  requires_expiry: boolean;
  requires_document_number?: boolean;
  is_active?: boolean;
  default_alert_days: number[];
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface DbDocumentVersion {
  id: string;
  tenant_id: string;
  document_id: string;
  version_number: number;
  previous_version_id?: string;
  document_number: string;
  issue_date?: string;
  expiry_date?: string;
  file_id: string;
  file_name: string;
  file_size: string;
  mime_type: string;
  storage_path: string;
  replacement_reason?: string;
  is_current: boolean;
  uploaded_by: string;
  uploaded_at: string;
}

export interface DbDocumentFile {
  id: string;
  tenant_id: string;
  document_id: string;
  version_id?: string;
  file_name: string;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  file_size_formatted: string;
  storage_path: string;
  storage_provider: 'SUPABASE' | 'R2' | 'LOCAL_SECURE';
  checksum: string;
  uploaded_by: string;
  uploaded_at: string;
  data_url?: string; // Authorized temporary access / secure buffer stream
}

export interface DbEntityDocument {
  id: string;
  tenant_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  entity_name: string;
  document_type_id: string;
  document_type_name: string;
  document_number: string;
  issue_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  issuing_country?: string;
  status: DocumentStatus;
  days_remaining?: number;
  description?: string;
  notes?: string;
  branch_id?: string;
  branch_name?: string;
  branch?: string;
  state?: string;
  employeeStatus?: string;
  entityDetails?: any;
  project_id?: string;
  project_name?: string;
  current_version_id?: string;
  current_version_number: number;
  current_file_id?: string;
  current_file_name?: string;
  created_by: string;
  created_at: string;
  updated_by?: string;
  updated_at: string;
  archived_at?: string;
  archived_by?: string;
  is_archived: boolean;
  versions?: DbDocumentVersion[];
  files?: DbDocumentFile[];
}

export interface DbDocumentActivity {
  id: string;
  tenant_id: string;
  document_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  action: 'UPLOAD' | 'VIEW' | 'DOWNLOAD' | 'EDIT' | 'REPLACE' | 'VERSION_VIEW' | 'ARCHIVE' | 'BULK_DOWNLOAD';
  performed_by: string;
  performed_by_role: string;
  details: string;
  version_number?: number;
  ip_address?: string;
  timestamp: string;
}

export interface DbRequiredDocumentRule {
  id: string;
  tenant_id: string;
  target_type: 'EMPLOYEE_ROLE' | 'VEHICLE_TYPE';
  target_key: string; // e.g. 'RIDER', 'OFFICE_STAFF', 'MOTORCYCLE', 'VAN'
  target_label: string;
  required_document_type_ids: string[];
  required_document_type_names: string[];
  description: string;
}

export interface DbDocumentExpiryAlert {
  id: string;
  tenant_id: string;
  document_id: string;
  entity_id: string;
  entity_name: string;
  entity_type: DocumentEntityType;
  document_type: string;
  document_number: string;
  expiry_date: string;
  days_remaining: number;
  severity: 'CRITICAL' | 'WARNING' | 'NOTICE' | 'EXPIRED';
  channel_ready: {
    inApp: boolean;
    email: boolean;
    whatsapp: boolean;
    sms: boolean;
  };
  notified_at?: string;
}

export interface DocumentCompletenessReport {
  entityType: DocumentEntityType;
  entityId: string;
  entityName: string;
  targetRoleOrType: string;
  totalRequired: number;
  totalUploaded: number;
  completionPercentage: number;
  completenessPercentage?: number;
  mandatoryPresent?: number;
  mandatoryTotal?: number;
  isComplete: boolean;
  uploadedDocuments: {
    documentTypeId: string;
    documentTypeName: string;
    documentNumber: string;
    expiryDate?: string;
    daysRemaining?: number;
    status: DocumentStatus;
  }[];
  missingDocumentTypes: string[];
}

export interface DocumentExpiryDashboardSummary {
  totalDocuments: number;
  expired: number;
  expiresToday: number;
  expiring7Days: number;
  expiring15Days: number;
  expiring30Days: number;
  expiring60Days: number;
  expiring90Days: number;
  valid: number;
  noExpiry: number;
  byEntityType: {
    employee: number;
    vehicle: number;
    company: number;
    vendor: number;
  };
}

// ============================================================================
// STEP 5: ENTERPRISE AUTOMATED PAYROLL ENGINE & SALARY ARCHITECTURE
// ============================================================================

export type PayrollPeriodStatus =
  | 'DRAFT'
  | 'CALCULATING'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PAID'
  | 'LOCKED';

export type SalaryStructureType =
  | 'FIXED_MONTHLY'
  | 'DAILY_RATE'
  | 'HOURLY_RATE'
  | 'PER_DELIVERY'
  | 'HYBRID_FIXED_DELIVERY';

export type PayrollExceptionType =
  | 'NEGATIVE_NET_SALARY'
  | 'MISSING_BANK_OR_IBAN'
  | 'MISSING_ATTENDANCE'
  | 'ZERO_DELIVERIES'
  | 'HIGH_TRAFFIC_FINES'
  | 'JOINED_MID_MONTH'
  | 'EXITED_MID_MONTH'
  | 'NO_SALARY_STRUCTURE'
  | 'ADVANCE_EXCEEDS_NET';

export interface DbPayrollPeriod {
  id: string;
  tenant_id: string;
  period_month: string; // e.g. "August 2026"
  period_key: string; // e.g. "2026-08"
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
  total_advances_recovered: number;
  total_net_payable: number;
  exceptions_count: number;
  generated_at?: string;
  generated_by?: string;
  approved_at?: string;
  approved_by?: string;
  paid_at?: string;
  paid_by?: string;
  wps_file_generated: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbSalaryStructure {
  id: string;
  tenant_id: string;
  name: string;
  structure_type: SalaryStructureType;
  base_amount: number;
  daily_rate?: number;
  hourly_rate?: number;
  per_delivery_rate?: number;
  tier_threshold_1?: number;
  tier_rate_1?: number;
  tier_threshold_2?: number;
  tier_rate_2?: number;
  fuel_allowance: number;
  mobile_allowance: number;
  accommodation_allowance: number;
  bike_allowance: number;
  food_allowance: number;
  other_allowances: number;
  target_project_id?: string;
  target_project_name?: string;
  target_role?: string;
  is_default: boolean;
  created_at: string;
}

export interface DbEmployeeSalaryHistory {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  salary_structure_id?: string;
  structure_type: SalaryStructureType;
  base_salary: number;
  per_delivery_rate?: number;
  fuel_allowance: number;
  mobile_allowance: number;
  accommodation_allowance: number;
  bike_allowance: number;
  food_allowance: number;
  other_allowances: number;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  change_reason: string;
  changed_by: string;
  created_at: string;
}

export interface PayrollRecordException {
  type: PayrollExceptionType;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  resolved?: boolean;
}

export interface DbPayrollRecord {
  id: string;
  tenant_id: string;
  payroll_period_id: string;
  period_month: string;
  period_key: string;
  year: number;
  month: number;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation: string;
  department: string;
  project_id?: string;
  project_name?: string;
  branch_id?: string;
  branch_name?: string;
  bank_name?: string;
  iban?: string;
  account_number?: string;
  salary_structure_type: SalaryStructureType;
  days_in_month: number;
  days_worked: number;
  unexcused_absences: number;
  paid_leave_days: number;
  unpaid_leave_days: number;
  deliveries_completed: number;
  overtime_hours: number;
  base_salary: number;
  prorated_base_salary: number;
  fuel_allowance: number;
  mobile_allowance: number;
  accommodation_allowance: number;
  bike_allowance: number;
  food_allowance: number;
  other_allowances: number;
  total_allowances: number;
  delivery_incentives: number;
  overtime_pay: number;
  bonus_adjustments: number;
  gross_earnings: number;
  absence_deductions: number;
  traffic_fines_deduction: number;
  fine_ticket_ids?: string[];
  advance_loan_deduction: number;
  advance_ids?: string[];
  penalty_deductions: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  status: 'DRAFT' | 'CALCULATED' | 'EXCEPTION_FLAGGED' | 'REVIEWED' | 'APPROVED' | 'PAID';
  has_exceptions: boolean;
  exceptions: PayrollRecordException[];
  payment_method?: 'WPS_SIF' | 'BANK_TRANSFER' | 'CASH' | 'CHEQUE';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbPayrollAdjustment {
  id: string;
  tenant_id: string;
  payroll_period_id?: string;
  employee_id: string;
  employee_name: string;
  type: 'BONUS' | 'FINE' | 'REIMBURSEMENT' | 'OVERTIME_ADJUSTMENT' | 'CORRECTION';
  amount: number;
  reason: string;
  effective_month: string; // e.g. "2026-08"
  applied_in_payroll: boolean;
  applied_at?: string;
  created_by: string;
  created_at: string;
}

export interface DbEmployeeAdvance {
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
  status: 'ACTIVE' | 'PAID_OFF' | 'CANCELLED';
  approved_by: string;
  repayment_history: {
    date: string;
    amount: number;
    payroll_period_id?: string;
    recorded_by: string;
  }[];
  created_at: string;
}

export interface DbFinalSettlement {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  exit_date: string;
  exit_type: 'Resignation' | 'Terminated' | 'Cancelled' | 'Absconding';
  joining_date: string;
  total_tenure_years: number;
  total_tenure_days: number;
  prorated_last_month_salary: number;
  unutilized_leave_days: number;
  leave_encashment_amount: number;
  end_of_service_gratuity: number;
  bonus_incentives: number;
  gross_entitlement: number;
  advance_loan_balance_deduction: number;
  traffic_fines_deduction: number;
  asset_damage_or_missing_deduction: number;
  notice_period_deduction: number;
  total_deductions: number;
  net_final_settlement_amount: number;
  status: 'DRAFT' | 'APPROVED' | 'DISBURSED';
  settlement_notes: string;
  cleared_by: string;
  approved_by?: string;
  disbursed_date?: string;
  created_at: string;
}

export * from './attendance';
export * from './performance';
export * from './fleet';


