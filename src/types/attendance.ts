/**
 * Attendance & Daily Operations Engine - Type Definitions
 * Multi-Tenant Delivery Operations ERP
 */

export type AttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LEAVE'
  | 'SICK_LEAVE'
  | 'HALF_DAY'
  | 'WEEKLY_OFF'
  | 'HOLIDAY'
  | 'LATE'
  | 'NO_SHOW'
  | 'SUSPENDED'
  | 'OFFICIAL_VISIT'
  | 'NOT_MARKED';

export type AttendanceSource =
  | 'MANUAL'
  | 'EXCEL_IMPORT'
  | 'API'
  | 'PROJECT_IMPORT'
  | 'MOBILE_APP'
  | 'BIOMETRIC'
  | 'AI_ASSISTED'
  | 'SYSTEM_DEFAULT';

export type AttendanceMonthStatus = 'OPEN' | 'REVIEWED' | 'FINALIZED';

export type HolidayType = 'COMPANY' | 'PROJECT' | 'BRANCH' | 'PUBLIC_NATIONAL';

export interface DbAttendanceRecord {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  designation?: string;
  project_id?: string;
  project_name?: string;
  branch_id?: string;
  branch_name?: string;
  attendance_date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  shift_id?: string;
  shift_name?: string;
  check_in?: string;
  check_out?: string;
  worked_minutes?: number;
  late_minutes?: number;
  early_leave_minutes?: number;
  overtime_minutes?: number;
  overtime_hours?: number;
  orders_count?: number;
  deliveries_count?: number;
  login_hours?: number;
  source: AttendanceSource;
  note?: string;
  exception_reason?: string;
  is_manual_override?: boolean;
  changed_by?: string;
  changed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAttendanceMonth {
  id: string;
  tenant_id: string;
  month_key: string; // e.g. "2026-08"
  year: number;
  month: number;
  status: AttendanceMonthStatus;
  total_employees: number;
  total_present_days: number;
  total_absent_days: number;
  total_leave_days: number;
  total_weekly_off_days: number;
  total_holidays: number;
  total_overtime_hours: number;
  total_payable_days: number;
  is_payroll_locked: boolean;
  finalized_at?: string;
  finalized_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DbAttendanceHistory {
  id: string;
  tenant_id: string;
  attendance_record_id: string;
  employee_id: string;
  employee_name: string;
  attendance_date: string;
  old_status: AttendanceStatus;
  new_status: AttendanceStatus;
  reason: string;
  changed_by: string;
  changed_at: string;
}

export interface DbHolidayCalendar {
  id: string;
  tenant_id: string;
  name: string;
  year: number;
  is_active: boolean;
  created_at: string;
}

export interface DbHolidayDate {
  id: string;
  tenant_id: string;
  calendar_id?: string;
  name: string;
  holiday_date: string; // YYYY-MM-DD
  holiday_type: HolidayType;
  project_id?: string;
  project_name?: string;
  branch_id?: string;
  branch_name?: string;
  is_paid: boolean;
  description?: string;
  created_at: string;
}

export interface DbShiftDefinition {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  start_time: string; // e.g. "08:00"
  end_time: string;   // e.g. "17:00"
  grace_minutes: number;
  break_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface DbDailyPerformanceMetric {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  project_id?: string;
  metric_date: string;
  orders: number;
  deliveries: number;
  login_hours: number;
  online_hours: number;
  acceptance_rate: number;
  completion_rate: number;
  platform?: string;
  created_at: string;
}

export interface TenantAttendanceSettings {
  tenant_id: string;
  default_assumption: 'PRESENT_BY_DEFAULT' | 'NOT_MARKED';
  tracking_mode: 'DAILY_STATUS' | 'TIME_TRACKING';
  default_weekly_off_days: string[]; // ['Sunday', 'Friday']
  auto_sync_approved_leaves: boolean;
  auto_sync_holidays: boolean;
  auto_sync_weekly_off: boolean;
  default_shift_id?: string;
  grace_period_minutes: number;
}

export interface OperationsExceptionItem {
  id: string;
  category:
    | 'UNASSIGNED_PROJECT'
    | 'MISSING_BIKE'
    | 'MISSING_SIM'
    | 'PRESENT_WITHOUT_PROJECT'
    | 'EXPIRED_DOCUMENT'
    | 'MISSING_MANDATORY_DOC'
    | 'DUPLICATE_ASSET'
    | 'HIGH_ABSENCE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  project?: string;
  issue: string;
  impact: string;
  recommendedAction: string;
  actionType: 'ASSIGN_PROJECT' | 'ASSIGN_BIKE' | 'ASSIGN_SIM' | 'RENEW_DOCUMENT' | 'REVIEW_ATTENDANCE';
}

export interface AttendanceImportPreviewRow {
  rowIndex: number;
  employeeIdentifier: string;
  matchedEmployeeId?: string;
  matchedEmployeeName?: string;
  matchedEmployeeCode?: string;
  matchedProject?: string;
  date: string;
  rawStatus: string;
  normalizedStatus: AttendanceStatus;
  orders?: number;
  deliveries?: number;
  loginHours?: number;
  overtimeHours?: number;
  existingRecordId?: string;
  isDuplicate: boolean;
  hasConflict: boolean;
  errorMessage?: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
}

export interface AttendanceImportBatch {
  id: string;
  tenant_id: string;
  file_name: string;
  total_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  error_rows: number;
  imported_by: string;
  import_mode: 'SKIP' | 'UPDATE' | 'REVIEW';
  status: 'PREVIEW' | 'COMPLETED' | 'FAILED';
  created_at: string;
}
