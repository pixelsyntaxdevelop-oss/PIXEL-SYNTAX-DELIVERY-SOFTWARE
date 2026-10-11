import { SystemUserAccount, SystemAuditLog } from '../types/erp';

export const ALL_ERP_MODULE_IDS = [
  // Command Center
  'operations_dashboard',
  'fleet_dashboard',

  // Human Resources
  'emp_mgmt',
  'employees_list',
  'recruitment',
  'att_mgmt',
  'attendance_daily',
  'attendance_monthly',
  'attendance_holidays',
  'doc_expiry_mgmt',
  'doc_expiry_listing',
  'doc_types',
  'passport_mgmt',
  'passport_list',
  'office_forms',
  'forms_create',
  'forms_list',
  'forms_templates_types',
  'forms_templates',

  // Delivery & Fleet
  'rider_project_mgmt',
  'captain_perf',
  'sim_card_mgmt',
  'sim_mgmt',
  'veh_mgmt',
  'vehicle_status',
  'traffic_fines_mgmt',
  'salik_mgmt',

  // Payroll & Loans
  'hr_payroll',
  'payroll_loan_mgmt',

  // Reports & Tools
  'operational_reports',
  'data_import_center',

  // System & SaaS
  'platform_admin',
  'multi_tenant_saas',
  'user_access_mgmt',
  'sys_configuration',
  'roles_permissions',
  'settings_audit',
];

export const DEFAULT_USER_ACCOUNTS: SystemUserAccount[] = [];

export const INITIAL_AUDIT_LOGS: SystemAuditLog[] = [];
