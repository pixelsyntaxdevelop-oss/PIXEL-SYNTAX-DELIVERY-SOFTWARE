import { SystemUserAccount } from '../types/erp';

/**
 * Mapping of Canonical ERP Module IDs to their legacy / duplicate route aliases.
 * This guarantees backwards-compatibility for bookmarks, audit logs, and existing user RBAC permissions.
 */
export const CANONICAL_MODULE_ALIASES: Record<string, string[]> = {
  // Monitoring & Dashboards
  operations_dashboard: ['operations_dashboard', 'home_dashboard', 'dashboard'],
  rider_portal: ['rider_portal', 'my_salary', 'rider_self_service'],
  fleet_dashboard: ['fleet_dashboard', 'live_fleet_telemetry'],

  // HR & Workforce
  emp_mgmt: ['emp_mgmt', 'employees_list', 'office_shifts', 'rider_requirements', 'rider_info', 'teams', 'chats', 'device_mgmt'],
  employees_list: ['employees_list', 'emp_mgmt'],
  recruitment: ['recruitment', 'recruitment_process', 'candidates'],
  att_mgmt: ['att_mgmt', 'attendance_daily', 'attendance_monthly', 'attendance_holidays', 'attendance_visits', 'leave_mgmt', 'leave_requests', 'leave_project', 'leave_types'],
  attendance_daily: ['attendance_daily', 'daily_attendance'],
  attendance_monthly: ['attendance_monthly'],
  attendance_holidays: ['attendance_holidays'],
  attendance_visits: ['attendance_visits'],
  doc_expiry_mgmt: ['doc_expiry_mgmt', 'doc_expiry_listing', 'doc_types', 'document_expiry', 'documents_vault', 'compliance_vault', 'insurance_mgmt', 'insurance_employee'],
  doc_expiry_listing: ['doc_expiry_listing', 'doc_expiry_mgmt', 'document_expiry'],
  doc_types: ['doc_types', 'doc_expiry_mgmt'],
  office_forms: ['office_forms', 'forms_list', 'forms_create', 'forms_templates_types', 'forms_templates'],
  forms_list: ['forms_list', 'office_forms'],
  forms_create: ['forms_create', 'office_forms'],
  forms_templates: ['forms_templates', 'forms_templates_types', 'office_forms'],
  passport_mgmt: ['passport_mgmt', 'passport_list'],

  // Operations & Fleet
  riders_drivers: [
    'riders_drivers',
    'rider_project_mgmt',
    'riders_driver_mgmt',
    'drivers_assign_proj',
    'drivers_assign_multi',
    'project_user_codes',
    'delivery_store',
    'employee_status_mgmt',
    'rider_expected_earning',
    'project_shifts',
    'project_type',
    'project_zones',
    'riders_assignment_report',
  ],
  partner_performance: [
    'partner_performance',
    'rider_performance',
    'captain_perf',
    'careem_perf',
    'careem_dashboard',
    'talabat_perf',
    'talabat_dashboard',
  ],
  veh_mgmt: [
    'veh_mgmt',
    'vehicles_fleet',
    'vehicle_mapping',
    'vehicle_assignment_report',
    'vehicle_compliance',
    'vehicle_depreciation',
    'vehicle_status',
    'inventory_assets',
    'inventory_sec',
    'inventory_assign',
    'inventory_return',
    'inventory_list',
    'inventory_stock',
    'rider_inventory_sec',
  ],
  traffic_fines_mgmt: [
    'traffic_fines_mgmt',
    'traffic_fines',
    'fleet_fines',
    'fines_mgmt',
    'driver_tickets',
    'driver_tickets_list',
    'ticket_assignment',
  ],
  salik_mgmt: ['salik_mgmt', 'salik', 'fleet_salik', 'toll_mgmt'],
  sim_card_mgmt: [
    'sim_card_mgmt',
    'sim_management',
    'sim_mgmt',
    'sim_assign_report',
    'sim_billing',
    'sim_source',
  ],

  // Payroll & Advances
  hr_payroll: [
    'hr_payroll',
    'payroll',
    'payroll_employees',
    'payroll_allowances',
    'payroll_agency_fee',
    'payroll_aggregator_cod',
    'payroll_aggregator_salaries',
    'payroll_fuel_cards',
    'payroll_merchant_pos',
    'payroll_vehicles_reg',
  ],
  payroll_loan_mgmt: ['payroll_loan_mgmt', 'loan_mgmt', 'loan_management'],

  // Finance & P&L
  finance: [
    'finance',
    'finance_assets',
    'bank_reconciliation',
    'banking_accounts',
    'expense_management',
    'petty_cash',
    'voucher_drafting',
    'voucher_list',
    'parties_3pl',
    'parties_client',
    'parties_customer',
    'parties_investor',
    'parties_mgmt',
    'parties_vehicle_lease',
    'parties_vendors_buying',
    'parties_vendor_mgmt',
    'garage_mgmt',
    'parts_mgmt',
    'service_mgmt',
  ],

  // Tools & Reports
  operational_reports: ['operational_reports', 'finance_reports', 'reports_analytics', 'reports_analytics_engine'],
  data_import_center: ['data_import_center'],

  // System & Platform
  multi_tenant_saas: ['multi_tenant_saas'],
  sys_configuration: ['sys_configuration', 'settings_audit'],
  user_access_mgmt: ['user_access_mgmt', 'roles_permissions'],
};

/**
 * Resolves any legacy or duplicate route ID to its canonical working ERP module.
 */
export function resolveCanonicalModule(module: string): string {
  if (!module) return 'operations_dashboard';

  // 1. Check direct matches in aliases table
  for (const [canonicalId, aliases] of Object.entries(CANONICAL_MODULE_ALIASES)) {
    if (canonicalId === module || aliases.includes(module)) {
      // Retain specific sub-items if they are distinct operational sub-views
      if (
        [
          'attendance_daily',
          'attendance_monthly',
          'attendance_holidays',
          'attendance_visits',
          'doc_expiry_listing',
          'doc_types',
          'forms_list',
          'forms_create',
          'forms_templates',
          'recruitment',
          'payroll_loan_mgmt',
        ].includes(module)
      ) {
        return module;
      }
      return canonicalId;
    }
  }

  // 2. Wildcard prefix fallbacks
  if (module.startsWith('payroll_')) {
    return module === 'payroll_loan_mgmt' ? 'payroll_loan_mgmt' : 'hr_payroll';
  }
  if (module.startsWith('parties_') || module.startsWith('garage_') || module.startsWith('finance_')) {
    return 'finance';
  }
  if (module.startsWith('sim_')) {
    return 'sim_card_mgmt';
  }

  return module;
}

/**
 * Checks whether a user has permission to view a module or its canonical counterpart.
 */
export function isUserPermittedForModule(
  user: SystemUserAccount | undefined,
  moduleId: string
): boolean {
  if (!user) return true;
  const allowed = Array.isArray(user.allowedModules) ? user.allowedModules : ['ALL'];
  if (user.isOwner || user.role === 'SUPER_ADMIN' || user.role === 'COMPANY_ADMIN' || allowed.includes('ALL')) return true;
  if (allowed.includes(moduleId)) return true;

  // Check canonical aliases
  const canonical = resolveCanonicalModule(moduleId);
  if (allowed.includes(canonical)) return true;

  const aliases = CANONICAL_MODULE_ALIASES[canonical] || [];
  if (aliases.some((alias) => allowed.includes(alias))) {
    return true;
  }

  return false;
}
