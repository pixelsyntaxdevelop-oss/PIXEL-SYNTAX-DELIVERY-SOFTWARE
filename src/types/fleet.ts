/**
 * Fleet & Vehicle Operations Engine TypeScript Interfaces
 * Multi-Tenant Delivery Operations ERP
 */

export type VehicleCategory = 'Motorcycle' | 'Bike' | 'Car' | 'Van' | 'Truck' | 'Other' | (string & {});

export type VehicleOperationalStatus =
  | 'Available'
  | 'Assigned'
  | 'In Maintenance'
  | 'Out of Service'
  | 'Accident'
  | 'Repair'
  | 'Reserved'
  | 'Inactive'
  | 'Sold'
  | 'Returned to Vendor'
  | 'Lost'
  | 'Other';

export type OwnershipType = 'OWNED' | 'LEASED' | 'RENTED' | 'VENDOR_SUPPLIED';

export type FuelType = 'PETROL_95' | 'PETROL_98' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';

export interface DbVehicleMasterEnhanced {
  id: string;
  tenant_id: string;
  vehicle_code: string; // e.g. "VH-1001"
  vehicle_type: VehicleCategory;
  plate_number: string; // e.g. "72154", "DXB-T-72154"
  plate_code?: string; // e.g. "T", "A", "K"
  plate_emirate: 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ajman' | 'Ras Al Khaimah' | 'Fujairah' | 'Umm Al Quwain' | string;
  /** Operational reporting state, edited by staff; independent of plate_emirate. */
  location_state?: string | null;
  make: string; // e.g. "Yamaha", "Honda", "Bajaj", "Toyota", "Nissan"
  model: string; // e.g. "FZ-25", "YBR 125", "Pulsar 150", "HiAce", "Yaris"
  year: number;
  color?: string;
  chassis_number: string; // VIN
  tc_number?: string; // Traffic Code / TC Number
  traffic_file_number?: string;
  engine_number?: string;
  registration_number?: string; // Mulkiya Number
  registration_expiry: string; // Mulkiya Expiry Date (YYYY-MM-DD)
  insurance_company: string;
  insurance_number: string;
  insurance_expiry: string; // Insurance Expiry Date (YYYY-MM-DD)
  ownership_type: OwnershipType;
  owner_or_vendor?: string;
  vendor?: string;
  leasing_company?: string;
  purchase_date?: string;
  purchase_cost?: number;
  monthly_lease_cost?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  current_odometer: number;
  odometerKm?: number;
  fuel_type: FuelType;
  branch_id: string;
  branch_name?: string;
  project_id?: string;
  project_name?: string;
  current_status: VehicleOperationalStatus;
  status?: string;
  status_reason?: string;
  current_employee_id?: string;
  current_rider_id?: string;
  current_rider_name?: string;
  current_rider_code?: string;
  current_sim_id?: string;
  current_sim_number?: string;
  gps_device_id?: string;
  fuel_card_id?: string;
  fuel_card_number?: string;
  last_service_odometer?: number;
  last_service_date?: string;
  next_service_due_km?: number;
  next_service_due_date?: string;
  total_maintenance_cost?: number;
  total_fuel_cost?: number;
  total_fines_cost?: number;
  total_accidents_count?: number;
  notes?: string;
  last_assignment_id?: string;
  last_employee_id?: string;
  last_employee_name?: string;
  last_employee_code?: string;
  last_assigned_date?: string;
  last_assigned_time?: string;
  last_returned_date?: string;
  last_returned_time?: string;
  last_assigned_by?: string;
  last_returned_by?: string;
  last_return_reason?: string;
  last_assign_notes?: string;
  last_return_notes?: string;
  previous_project?: string;
  last_rider_name?: string;
  last_rider_code?: string;
  last_assignment_employee_name?: string;
  last_assignment_employee_code?: string;
  last_assignment_return_date?: string;
  last_assignment?: any;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
}

export interface DbVehicleStatusHistory {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  status: VehicleOperationalStatus;
  reason?: string;
  effective_from: string;
  effective_to?: string;
  notes?: string;
  changed_by: string;
  created_at: string;
}

export interface DbVehicleAssignmentRecord {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  vehicle_model?: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  project_id?: string;
  project_name?: string;
  previous_project?: string;
  branch_id?: string;
  assignment_date: string;
  assignment_time: string;
  return_date?: string;
  return_time?: string;
  assignment_status: 'ACTIVE' | 'RETURNED' | 'REPLACED';
  starting_odometer: number;
  return_odometer?: number;
  condition_on_assignment: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | string;
  condition_on_return?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | string;
  handover_notes?: string;
  assign_remark?: string;
  return_notes?: string;
  return_remark?: string;
  return_reason?: string;
  replacement_vehicle_id?: string;
  replacement_reason?: string;
  assigned_by: string;
  returned_by?: string;
  returned_to?: string;
  created_at: string;
}

export type OdometerSource =
  | 'Assignment'
  | 'Return'
  | 'Maintenance'
  | 'Fuel Entry'
  | 'Manual Update'
  | 'Inspection'
  | 'Fine Entry'
  | 'Accident';

export interface DbVehicleOdometerHistory {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  reading: number;
  recorded_at: string;
  source: OdometerSource;
  source_record_id?: string;
  entered_by: string;
  notes?: string;
  is_correction: boolean;
  correction_reason?: string;
  created_at: string;
}

export type MaintenanceCategory = 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION' | 'ACCIDENT_REPAIR' | 'ROUTINE_INSPECTION' | (string & {});

export type MaintenanceStatus =
  | 'Reported'
  | 'Scheduled'
  | 'In Progress'
  | 'Waiting Parts'
  | 'Completed'
  | 'Cancelled';

export interface DbVehicleMaintenance {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  maintenance_type:
    | 'Oil Change'
    | 'General Service'
    | 'Tyres Replacement'
    | 'Brake Pad / Disc'
    | 'Battery Replacement'
    | 'Chain & Sprocket'
    | 'Engine Overhaul'
    | 'Electrical Repair'
    | 'Body & Fairing'
    | 'Accident Repair'
    | 'AC Repair'
    | 'Periodic Inspection'
    | 'Other'
    | (string & {});
  maintenance_category: MaintenanceCategory;
  reported_date: string;
  scheduled_date?: string;
  started_date?: string;
  completed_date?: string;
  odometer_at_service: number;
  next_service_due_km?: number;
  next_service_due_date?: string;
  vendor_id?: string;
  vendor_name?: string;
  workshop_name: string;
  parts_cost: number;
  labour_cost: number;
  cost: number; // Total Cost
  status: MaintenanceStatus;
  description: string;
  replaced_parts?: string[];
  invoice_number?: string;
  invoice_file_url?: string;
  accident_id?: string;
  technician_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DbMaintenanceRule {
  id: string;
  tenant_id: string;
  name: string;
  service_type: string;
  interval_km: number;
  interval_days: number;
  warning_threshold_km: number; // e.g. 500 km
  warning_threshold_days: number; // e.g. 10 days
  description?: string;
  is_active: boolean;
}

export interface DbFuelEntry {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  employee_id?: string;
  employee_name?: string;
  date: string;
  odometer: number;
  liters: number;
  cost: number;
  fuel_type: FuelType;
  station_vendor: 'ADNOC' | 'ENOC' | 'EMARAT' | 'EPPCO' | 'OTHER' | string;
  receipt_number?: string;
  receipt_file_url?: string;
  fuel_card_id?: string;
  fuel_card_number?: string;
  entered_by: string;
  notes?: string;
  anomaly_flag?: boolean;
  anomaly_reason?: string;
  created_at: string;
}

export interface DbFuelCard {
  id: string;
  tenant_id: string;
  card_number: string;
  provider: 'ADNOC' | 'ENOC' | 'EMARAT' | 'OTHER';
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
  monthly_limit: number;
  assigned_vehicle_id?: string;
  assigned_vehicle_plate?: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  current_month_spend: number;
  expiry_date: string;
  created_at: string;
}

export interface DbVehicleAccident {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  rider_id?: string;
  rider_name?: string;
  date_time: string;
  location: string;
  severity: 'MINOR' | 'MODERATE' | 'SEVERE' | 'MAJOR' | 'TOTAL_LOSS';
  description: string;
  police_report_number?: string;
  insurance_claim_number?: string;
  third_party_details?: string;
  estimated_cost: number;
  actual_cost?: number;
  maintenance_job_id?: string;
  status: 'Reported' | 'Under Review' | 'Insurance Claim' | 'In Repair' | 'Closed';
  photo_urls?: string[];
  reported_by: string;
  created_at: string;
}

export interface DbVehicleFine {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  employee_id?: string;
  employee_name?: string;
  fine_number: string;
  fine_date: string;
  fine_time?: string;
  location: string;
  authority: 'Dubai Police' | 'Abu Dhabi Police' | 'Sharjah Police' | 'RTA' | 'Ajman Police' | 'RAK Police' | 'Other' | (string & {});
  violation_type: string;
  amount: number;
  status: 'PENDING_REVIEW' | 'ASSIGNED_TO_DRIVER' | 'PAID_BY_COMPANY' | 'DEDUCTED_FROM_PAYROLL' | 'DISPUTED';
  deducted_from_payroll: boolean;
  payroll_period_key?: string;
  notes?: string;
  created_at: string;
}

export interface DbVehicleExpense {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  expense_type: 'FUEL' | 'MAINTENANCE' | 'REPAIR' | 'INSURANCE' | 'MULKIYA_RENEWAL' | 'LEASE' | 'FINE' | 'DEPRECIATION' | 'OTHER';
  amount: number;
  date: string;
  description: string;
  vendor_name?: string;
  reference_id?: string;
  receipt_url?: string;
  created_at: string;
}

export interface DbFleetVendor {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  service_types: string[]; // Mechanical, Tyres, Electrical, Body Shop, RTA Inspection, etc.
  rating: number; // 1-5
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export interface DbFleetException {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  vehicle_plate: string;
  exception_type:
    | 'ASSIGNED_TO_INACTIVE_RIDER'
    | 'DOUBLE_ASSIGNED_VEHICLE'
    | 'MAINTENANCE_WITH_ACTIVE_RIDER'
    | 'MULKIYA_EXPIRED'
    | 'MULKIYA_EXPIRING_SOON'
    | 'INSURANCE_EXPIRED'
    | 'INSURANCE_EXPIRING_SOON'
    | 'MAINTENANCE_OVERDUE'
    | 'MAINTENANCE_DUE_SOON'
    | 'ODOMETER_ANOMALY'
    | 'UNRESOLVED_ACCIDENT'
    | 'HIGH_FINES_ACCUMULATION'
    | 'INACTIVE_VEHICLE_ASSIGNED';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  action_label: string;
  action_type: string;
  detected_at: string;
  resolved: boolean;
  resolved_at?: string;
}

export interface Vehicle360Data {
  vehicle: DbVehicleMasterEnhanced;
  currentAssignment?: DbVehicleAssignmentRecord | null;
  assignmentHistory: DbVehicleAssignmentRecord[];
  assignments?: DbVehicleAssignmentRecord[];
  statusHistory: DbVehicleStatusHistory[];
  maintenanceHistory: DbVehicleMaintenance[];
  fuelLogs: DbFuelEntry[];
  odometerHistory: DbVehicleOdometerHistory[];
  accidents: DbVehicleAccident[];
  fines: DbVehicleFine[];
  expenses: DbVehicleExpense[];
  documents: any[]; // DMS documents
  timeline: {
    id: string;
    date: string;
    type: string;
    title: string;
    description: string;
    user: string;
    metadata?: any;
  }[];
  tcoSummary: {
    totalCost: number;
    purchaseOrLease: number;
    fuel: number;
    maintenance: number;
    fines: number;
    insuranceAndRegistration: number;
    accidents: number;
    costPerKm: number;
  };
  maintenanceDueStatus: {
    isDue: boolean;
    isOverdue: boolean;
    isDueSoon: boolean;
    reasons: string[];
    dueKmRemaining?: number;
    dueDaysRemaining?: number;
  };
  registrationExpiryStatus: {
    mulkiyaStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
    mulkiyaDaysRemaining: number;
    insuranceStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
    insuranceDaysRemaining: number;
  };
}

export interface FleetSummaryKpis {
  totalVehicles: number;
  availableVehicles: number;
  assignedVehicles: number;
  inMaintenanceVehicles: number;
  returnedToVendorVehicles?: number;
  outOfServiceVehicles: number;
  accidentVehicles?: number;
  inactiveVehicles?: number;
  utilizationRate: number; // percentage
  mulkiyaExpiringCount: number;
  insuranceExpiringCount: number;
  maintenanceDueCount: number;
  openAccidentsCount: number;
  unpaidFinesCount: number;
  totalMonthlySpendAED: number;
  vendorBreakdown?: Record<string, number>;
  stateBreakdown?: Record<string, number>;
  vendorBreakdownDetailed?: Record<string, { total: number; assigned: number; available: number; maintenance: number }>;
  stateBreakdownDetailed?: Record<string, { total: number; assigned: number; available: number; maintenance: number }>;
}

export interface PaginatedVehiclesResult {
  items: DbVehicleMasterEnhanced[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface VehicleFilters {
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
  search?: string;
  page?: number;
  pageSize?: number;
}

export type VehicleType = VehicleCategory;
export type VehicleKPIStats = FleetSummaryKpis;
export type FleetExceptionRecord = DbFleetException;
