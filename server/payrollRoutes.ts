import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { parseAlliedPartnerWorkbook } from './alliedPartnerPayoutParser';
import {
  generateNoonExcelTemplate,
  parseAndValidateNoonWorkbook,
  commitNoonPayrollBatch,
} from './noonPayrollService';
import {
  generateKeetaExcelTemplate,
  parseAndValidateKeetaWorkbook,
  commitKeetaPayrollBatch,
} from './keetaPayrollService';
import {
  EnterprisePayrollPeriod,
  EnterprisePayrollRecord,
  ProjectSalaryLine,
  PayrollAdjustment,
  EmployeeLoan,
  EmployeeAdvance,
  PayrollImportBatch,
  ProjectSalaryConfig,
  PayrollPeriodStatus,
  ProjectSalaryCalculationMethod,
  ProjectImportProfile,
  ProjectRiderMapping,
  TrafficFineDeductionDetail,
  SalikDeductionDetail,
  LoanDeductionDetail,
  AdvanceDeductionDetail,
  PayrollSourceType,
} from '../src/types/payroll';

// Decimal-safe currency helpers (using integer fils: 1 AED = 100 fils)
export function toFils(amount: number | string | undefined | null): number {
  if (amount === undefined || amount === null || amount === '') return 0;
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function fromFils(fils: number): number {
  return Number((fils / 100).toFixed(2));
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function createPayrollRouter(db: any) {
  const router = Router();

  // Helper to extract session tenant & user (Authenticated actor tracking)
  function getContext(req: Request) {
    const authHeader = req.headers.authorization;
    let userId = (req.headers['x-user-id'] as string) || 'user_admin';
    let userName = (req.headers['x-user-name'] as string) || 'Hassan Tariq (Accounts & HR)';
    let userRole = (req.headers['x-user-role'] as string) || 'COMPANY_ADMIN';
    let tenantId = (req.headers['x-tenant-id'] as string) || 'company_pixel_syntax';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = (db.users || []).find((u: any) => u.id === token || u.token === token);
      if (user) {
        userId = user.id;
        userName = user.fullName || user.name || userName;
        userRole = user.role || userRole;
        tenantId = user.tenantId || tenantId;
      }
    }

    const isSuperAdmin = userRole === 'SUPER_ADMIN';
    return { userId, userName, userRole, tenantId, isSuperAdmin };
  }

  // Ensure DB collections exist
  if (!db.payrollPeriods) db.payrollPeriods = [];
  if (!db.payrollRecords) db.payrollRecords = [];
  if (!db.projectSalaryLines) db.projectSalaryLines = [];
  if (!db.payrollAdjustments) db.payrollAdjustments = [];
  if (!db.employeeLoans) db.employeeLoans = [];
  if (!db.employeeAdvances) db.employeeAdvances = [];
  if (!db.payrollImportBatches) db.payrollImportBatches = [];
  if (!db.projectSalaryConfigs) db.projectSalaryConfigs = [];
  if (!db.projectImportProfiles) db.projectImportProfiles = [];
  if (!db.projectRiderMappings) db.projectRiderMappings = [];

  // Seed default Project Import Profiles (Strict Architecture: Keeta & Noon in WAITING_FOR_SOURCE_FORMAT)
  if (db.projectImportProfiles.length === 0) {
    db.projectImportProfiles = [
      {
        id: 'prof_labour',
        tenant_id: 'company_pixel_syntax',
        profile_name: 'Labour Hourly Timesheet',
        project_id: 'proj_labour_1',
        project_name: 'Labour Supply Technical Services',
        salary_group: 'LABOUR',
        source_type: 'LABOUR_HOURLY_TEMPLATE',
        status: 'ACTIVE',
        status_note: 'Labour Hourly calculation (Working Hours × Hourly Rate) applies exclusively to Labour projects.',
        accepted_file_types: ['.csv', '.xlsx', '.xls'],
        header_row: 1,
        column_mapping: {
          employee_code: 'Employee Code',
          emirates_id: 'Emirates ID',
          working_hours: 'Working Hours',
          hourly_rate: 'Hourly Rate',
          expected_total: 'Gross Amount',
        },
        required_columns: ['Employee Code', 'Working Hours', 'Hourly Rate'],
        employee_resolver_priority: ['EMPLOYEE_CODE', 'EMIRATES_ID', 'PROJECT_RIDER_ID'],
        calculation_rules: {
          method: 'HOURLY',
          formula_description: 'Working Hours × Hourly Rate',
        },
        validation_rules: {
          max_hours_warning: 320,
          recalculate_totals: true,
          allow_unresolved_employees: false,
        },
        duplicate_key_fields: ['employee_id', 'work_from', 'work_to'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'prof_keeta',
        tenant_id: 'company_pixel_syntax',
        profile_name: 'Keeta Payroll Import Profile',
        project_id: 'proj_keeta_1',
        project_name: 'Keeta Express Delivery',
        salary_group: 'KEETA',
        source_type: 'KEETA_EXCEL_PAYROLL',
        status: 'SOURCE_FORMAT_RECEIVED',
        status_note: 'Verified official KEETA Payroll Excel format (.xlsx) with exact 14 columns: Courier ID, Courier Name, Valid Days, Hours Avg, Incentive, Reward, Food Charge, Penalty, Tip, Rider Salary, Incentive Adjustment, Bike Fine, Maintenance / Others, Net Payable Salary.',
        accepted_file_types: ['.xlsx', '.xls'],
        header_row: 1,
        column_mapping: {
          courier_id: 'Courier ID',
          courier_name: 'Courier Name',
          valid_days: 'Valid Days',
          hours_avg: 'Hours Avg',
          incentive: 'Incentive',
          reward: 'Reward',
          food_charge: 'Food Charge',
          penalty: 'Penalty',
          tip: 'Tip',
          rider_salary: 'Rider Salary',
          incentive_adjustment: 'Incentive Adjustment',
          bike_fine: 'Bike Fine',
          maintenance_others: 'Maintenance / Others',
          net_payable_salary: 'Net Payable Salary',
        },
        required_columns: ['Courier ID'],
        employee_resolver_priority: ['PROJECT_RIDER_ID', 'EMPLOYEE_CODE'],
        calculation_rules: {
          method: 'KEETA_SOURCE_PRESERVED',
          formula_description: 'Source Rider Salary preserved separately. Valid Days & Hours Avg reported. Incentive, Reward and Tip remain itemized/informational. Source deductions are Food Charge + Penalty + Bike Fine + Maintenance/Others. Signed Incentive Adjustment (+/-) is applied exactly once.',
        },
        validation_rules: {
          trust_source_total_with_review: true,
          allow_unresolved_employees: false,
        },
        duplicate_key_fields: ['employee_id', 'work_from', 'work_to'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-09-04T00:00:00Z',
      },
      {
        id: 'prof_noon',
        tenant_id: 'company_pixel_syntax',
        profile_name: 'Noon Minutes Timesheet Import',
        project_id: 'proj_noon_1',
        project_name: 'Noon Minutes Logistics',
        salary_group: 'NOON',
        source_type: 'NOON_MINUTES_TIMESHEET',
        status: 'SOURCE_FORMAT_RECEIVED',
        status_note: 'Verified official Noon Payroll Excel format (.xlsx) with exact 11 columns: DA Name, NIM ID, Total Order, Rider Earning, Deduction, Penalty, COD, Vendor Share, Fine, Loan, Rider Salary.',
        accepted_file_types: ['.xlsx', '.xls'],
        header_row: 1,
        column_mapping: {
          da_name: 'DA Name',
          external_rider_id: 'NIM ID',
          total_orders: 'Total Order',
          rider_earning: 'Rider Earning',
          deduction: 'Deduction',
          penalty: 'Penalty',
          cod: 'COD',
          vendor_share: 'Vendor Share',
          fine: 'Fine',
          loan: 'Loan',
          rider_salary: 'Rider Salary',
        },
        required_columns: ['NIM ID'],
        employee_resolver_priority: ['PROJECT_RIDER_ID', 'EMPLOYEE_CODE', 'EMIRATES_ID'],
        calculation_rules: {
          method: 'NOON_SOURCE_PRESERVED',
          formula_description: 'Rider Salary is the authoritative provider/source salary. Deduction, Penalty, COD, Vendor Share, Fine and Loan remain separately traceable source fields and are not automatically subtracted again.',
        },
        validation_rules: {
          trust_source_total_with_review: true,
          allow_unresolved_employees: false,
        },
        duplicate_key_fields: ['external_rider_id', 'payroll_month'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-09-03T00:00:00Z',
      },
      {
        id: 'prof_fixed',
        tenant_id: 'company_pixel_syntax',
        profile_name: 'Fixed Monthly Staff',
        project_id: 'proj_fixed_1',
        project_name: 'Corporate Head Office & Fleet Ops',
        salary_group: 'FIXED',
        source_type: 'FIXED_MONTHLY',
        status: 'ACTIVE',
        status_note: 'Prorated monthly base salary calculated by calendar days worked.',
        accepted_file_types: ['.csv', '.xlsx'],
        header_row: 1,
        column_mapping: { employee_code: 'Employee Code' },
        required_columns: ['Employee Code'],
        employee_resolver_priority: ['EMPLOYEE_CODE', 'EMIRATES_ID'],
        calculation_rules: {
          method: 'FIXED',
          formula_description: 'Base Salary / DaysInMonth * DaysWorked',
        },
        validation_rules: { recalculate_totals: true },
        duplicate_key_fields: ['employee_id'],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
      {
        id: 'prof_allied_partner_v1',
        tenant_id: 'company_pixel_syntax',
        profile_name: 'Allied Delivery Partner Payout (V1)',
        project_id: 'proj_allied_partner',
        project_name: 'Allied Delivery Services Partner Payout',
        salary_group: 'ALLIED_DELIVERY_PARTNER_PAYOUT_V1',
        source_type: 'DELIVERY_PROJECT_TIMESHEET',
        status: 'SOURCE_FORMAT_RECEIVED',
        status_note: 'Source format received and verified. Delivery partner multi-sheet payout workbook with 9 sheets (Summary, Daily Earnings, Attendance, Additional DA Earnings, Rider & Vendor Deductions, Invoicing). Validated against client workbook.',
        accepted_file_types: ['.xlsx', '.xls', '.csv'],
        header_row: 1,
        source_sheets: [
          'Payment flow',
          'Final Invoice Values (Use for I...)',
          'Non-Taxable(No invoice needed)',
          'Summary',
          'Daily earnings Working file',
          'Attendance',
          'Additional DA Earnings',
          'Rider Deduction',
          'Vendor Deduction',
        ],
        column_mapping: {
          external_rider_id: 'DA ID',
          rider_name: 'Name of Employee / Driver',
          payout_mapping: 'Payout Mapping',
          orders: 'Total order as per rider app',
          actual_earnings: 'Actual earning as per rider app (Rider)',
          guaranteed_pay: 'MG',
          additional_earnings: 'Total Additional Earnings',
          total_deductions: 'Total deduction',
          final_rider_earning: 'Final Rider earning',
        },
        required_columns: ['DA ID', 'Payout Mapping', 'Final Rider earning'],
        employee_resolver_priority: ['PROJECT_RIDER_ID', 'EMPLOYEE_CODE', 'EMIRATES_ID'],
        calculation_rules: {
          method: 'PER_DELIVERY',
          formula_description: 'Partner multi-sheet payout with guaranteed pay (MG), order pay, tip additions, and itemized rider deductions.',
        },
        validation_rules: {
          recalculate_totals: true,
          trust_source_total_with_review: true,
          allow_unresolved_employees: false,
          max_hours_warning: 320,
        },
        duplicate_key_fields: ['external_rider_id', 'source_period_start', 'source_period_end'],
        created_at: '2026-08-25T00:00:00Z',
        updated_at: '2026-08-25T00:00:00Z',
      },
    ];
  }

  // Project rider mappings are operational data. Never auto-seed them.
  // Real external IDs are created through Rider / Project Management or explicit mapping workflows.

  // Project salary configurations are tenant configuration, not demo defaults.
  // Keep the collection empty until real configuration is created/restored.

  // ---------------------------------------------------------------------------
  // RESOLVER HELPERS: Strict Architectural Matching Rules
  // ---------------------------------------------------------------------------

  // 1. Generic Import Row Employee Resolver
  // Priority: 1. Employee Code, 2. Emirates ID, 3. Project External Rider ID
  // Policy: REJECT name-only matching if duplicate/ambiguous
  function resolveEmployeeFromRow(tenantId: string, row: any, projectId?: string, salaryGroup?: string) {
    const empCode = (
      row.employee_code ||
      row.emp_code ||
      row.code ||
      row['Employee Code'] ||
      row['Employee ID'] ||
      ''
    ).toString().trim();

    const rawEmiratesId = (
      row.emirates_id ||
      row.eid ||
      row['Emirates ID'] ||
      row['EmiratesId'] ||
      ''
    ).toString().trim();
    const cleanEmiratesId = rawEmiratesId.replace(/[-\s]/g, '');

    const externalRiderId = (
      row.rider_id ||
      row.project_rider_id ||
      row.external_rider_id ||
      row['Rider ID'] ||
      row['Keeta Rider ID'] ||
      row['Noon Rider ID'] ||
      row['Project Rider ID'] ||
      ''
    ).toString().trim();

    const rawName = (
      row.employee_name ||
      row.name ||
      row['Employee Name'] ||
      ''
    ).toString().trim();

    const masterEmployees = (db.masterEmployees || []).filter(
      (e: any) => e.tenant_id === tenantId && !e.is_archived
    );

    // Priority 1: Match by Employee Code
    if (empCode) {
      const match = masterEmployees.find(
        (e: any) =>
          e.employee_code?.toLowerCase() === empCode.toLowerCase() ||
          e.id?.toLowerCase() === empCode.toLowerCase()
      );
      if (match) {
        return { success: true, employee: match, matchedBy: 'EMPLOYEE_CODE', identifier: empCode };
      }
    }

    // Priority 2: Match by Emirates ID
    if (cleanEmiratesId) {
      const match = masterEmployees.find((e: any) => {
        const eEid = (e.emirates_id || e.emirates_id_number || '').replace(/[-\s]/g, '');
        return eEid && eEid === cleanEmiratesId;
      });
      if (match) {
        return { success: true, employee: match, matchedBy: 'EMIRATES_ID', identifier: rawEmiratesId };
      }
    }

    // Priority 3: Match by Project External Rider ID
    if (externalRiderId) {
      const mapping = (db.projectRiderMappings || []).find(
        (m: any) =>
          m.tenant_id === tenantId &&
          m.external_rider_id?.toLowerCase() === externalRiderId.toLowerCase() &&
          (!projectId || m.project_id === projectId || !salaryGroup || m.project_name?.toUpperCase().includes(salaryGroup.toUpperCase()))
      );
      if (mapping) {
        const match = masterEmployees.find((e: any) => e.id === mapping.employee_id);
        if (match) {
          return {
            success: true,
            employee: match,
            matchedBy: 'PROJECT_RIDER_ID',
            identifier: externalRiderId,
            mapping,
          };
        }
      }
    }

    // Strict check: Block Name-only matching if duplicate/ambiguous
    if (rawName) {
      const nameMatches = masterEmployees.filter((e: any) =>
        e.full_name?.toLowerCase().includes(rawName.toLowerCase()) ||
        rawName.toLowerCase().includes(e.full_name?.toLowerCase())
      );
      if (nameMatches.length > 0) {
        return {
          success: false,
          ambiguous: true,
          possibleMatches: nameMatches.map((e: any) => ({
            id: e.id,
            code: e.employee_code,
            name: e.full_name,
          })),
          message: `Ambiguous match: Name "${rawName}" matched ${nameMatches.length} employee(s) by name alone. Name-only matching is blocked by architectural policy. Provide Employee Code, Emirates ID, or Project Rider ID.`,
        };
      }
    }

    return {
      success: false,
      ambiguous: false,
      message: `Employee not found with provided identifiers (Code: "${empCode || 'N/A'}", Emirates ID: "${rawEmiratesId || 'N/A'}", Rider ID: "${externalRiderId || 'N/A'}").`,
    };
  }

  // 2. Traffic Fine Exact Historical Timestamp Liability Resolver
  // CRITICAL REQUIREMENT: DO NOT use current vehicle holder!
  // Resolve which employee held that vehicle at the exact violation timestamp.
  function resolveEmployeeForFineTimestamp(
    tenantId: string,
    plateNumber: string,
    vehicleId: string | undefined,
    violationTimestamp: string
  ) {
    const cleanPlate = (plateNumber || '').toLowerCase().trim();
    if (!cleanPlate && !vehicleId) return null;

    let vTs = (violationTimestamp || '').trim();
    if (vTs.length === 10) {
      vTs = `${vTs}T12:00:00`;
    }

    const allAssignments = [
      ...(db.fleetAssignments || []),
      ...(db.vehicleAssignments || []),
    ].filter((a: any) => {
      if (a.tenant_id !== tenantId) return false;
      if (vehicleId && a.vehicle_id === vehicleId) return true;
      const p = (a.vehicle_plate || a.plate_number || a.plateNumber || '').toLowerCase().trim();
      return p && p === cleanPlate;
    });

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

      // Check if violation timestamp falls into assignment interval
      const vTime = new Date(vTs).getTime();
      const startTime = new Date(startTs).getTime();
      const endTime = new Date(endTs).getTime();

      if (!isNaN(vTime) && !isNaN(startTime) && !isNaN(endTime)) {
        if (vTime >= startTime && vTime <= endTime) {
          const empId = asgn.employee_id || asgn.rider_id;
          const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);
          return {
            employee_id: empId,
            employee_name: asgn.employee_name || asgn.rider_name || emp?.full_name,
            employee_code: asgn.employee_code || asgn.rider_code || emp?.employee_code,
            assignment_id: asgn.id,
            assignment_start: startTs,
            assignment_end: endTs,
            resolved_by_timestamp: true,
          };
        }
      }
    }

    // DO NOT FALL BACK TO CURRENT VEHICLE HOLDER!
    // Historical resolution failed -> return null so current bike holder is NEVER charged for prior rider's violation!
    return null;
  }

  // Loans and advances are operational financial records. Never auto-seed them.

  // ---------------------------------------------------------------------------
  // 1. GET ALL PAYROLL PERIODS
  // ---------------------------------------------------------------------------
  router.get('/periods', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const periods = (db.payrollPeriods || [])
      .filter((p: any) => isSuperAdmin || p.tenant_id === tenantId)
      .sort((a: any, b: any) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    res.json(periods);
  });

  // ---------------------------------------------------------------------------
  // 2. GET SINGLE PAYROLL PERIOD SUMMARY & PAGINATED RECORDS
  // ---------------------------------------------------------------------------
  router.get('/periods/:id', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const { id } = req.params;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt((req.query.pageSize as string) || '25', 10)));
    const search = ((req.query.search as string) || '').toLowerCase().trim();
    const branchFilter = (req.query.branch as string) || 'ALL';
    const projectFilter = (req.query.project as string) || 'ALL';
    const statusFilter = (req.query.status as string) || 'ALL';
    const hasExceptionsOnly = req.query.exceptionsOnly === 'true';

    const period = (db.payrollPeriods || []).find(
      (p: any) => (isSuperAdmin || p.tenant_id === tenantId) && (p.id === id || p.period_key === id)
    );

    if (!period) {
      return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Payroll period not found' });
    }

    let records = (db.payrollRecords || []).filter(
      (r: any) =>
        (isSuperAdmin || r.tenant_id === tenantId) &&
        (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );

    // Filter
    if (search) {
      records = records.filter(
        (r: any) =>
          r.employee_name?.toLowerCase().includes(search) ||
          r.employee_code?.toLowerCase().includes(search) ||
          r.emirates_id?.toLowerCase().includes(search) ||
          r.department?.toLowerCase().includes(search)
      );
    }
    if (branchFilter !== 'ALL') {
      records = records.filter((r: any) => r.branch_id === branchFilter || r.branch_name === branchFilter);
    }
    if (projectFilter !== 'ALL') {
      records = records.filter(
        (r: any) =>
          r.project_id === projectFilter ||
          r.project_name === projectFilter ||
          (r.projects_worked && r.projects_worked.includes(projectFilter))
      );
    }
    if (statusFilter !== 'ALL') {
      records = records.filter((r: any) => r.status === statusFilter);
    }
    if (hasExceptionsOnly) {
      records = records.filter((r: any) => r.has_exceptions);
    }

    const totalRecords = records.length;
    const totalPages = Math.ceil(totalRecords / pageSize) || 1;
    const paginatedRecords = records.slice((page - 1) * pageSize, page * pageSize);

    // Compute live reconciliation
    const allPeriodRecords = (db.payrollRecords || []).filter(
      (r: any) =>
        (isSuperAdmin || r.tenant_id === tenantId) &&
        (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );

    const sumNetFils = allPeriodRecords.reduce((sum: number, r: any) => sum + toFils(r.net_salary), 0);
    const periodNetFils = toFils(period.total_net_payable);
    const isReconciled = sumNetFils === periodNetFils;

    const allPeriodExceptions = allPeriodRecords.flatMap((r: any) =>
      (r.exceptions || []).map((ex: any) => ({
        ...ex,
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        employee_code: r.employee_code,
        net_salary: r.net_salary,
        gross_earnings: r.gross_earnings,
      }))
    );

    res.json({
      success: true,
      period: {
        ...period,
        reconciled: isReconciled,
        sum_employee_net: fromFils(sumNetFils),
      },
      records: paginatedRecords,
      exceptions: allPeriodExceptions,
      pagination: {
        page,
        pageSize,
        totalRecords,
        totalPages,
      },
      summary: {
        totalEmployees: allPeriodRecords.length,
        totalGrossPay: period.total_gross_pay,
        totalNetPayable: period.total_net_payable,
        totalDeductions: period.total_deductions,
        totalTrafficFines: period.total_traffic_fines,
        totalSalik: period.total_salik,
        totalLoansRecovered: period.total_loans_recovered,
        totalAdvancesRecovered: period.total_advances_recovered,
        exceptionsCount: period.exceptions_count,
        readyCount: period.ready_count || allPeriodRecords.filter((r: any) => !r.has_exceptions).length,
        reconciled: isReconciled,
      },
    });
  });

  // ---------------------------------------------------------------------------
  // 3. GENERATE / RECALCULATE PAYROLL PERIOD
  // ---------------------------------------------------------------------------
  const handleGeneratePeriod = (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { year, month, forceRecalculate } = req.body;

    let targetYear = parseInt(year, 10);
    let targetMonth = parseInt(month, 10);

    if (typeof month === 'string' && month.includes('-')) {
      const parts = month.split('-');
      targetYear = parseInt(parts[0], 10);
      targetMonth = parseInt(parts[1], 10);
    } else {
      if (isNaN(targetYear)) targetYear = 2026;
      if (isNaN(targetMonth)) targetMonth = 8;
    }

    const monthName = MONTH_NAMES[targetMonth - 1] || 'August';
    const periodMonth = `${monthName} ${targetYear}`;
    const periodKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
    const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
    const periodId = `pp_${targetYear}_${String(targetMonth).padStart(2, '0')}`;

    // Month lock check
    const existingPeriod = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && p.period_key === periodKey
    );
    if (existingPeriod && (existingPeriod.status === 'LOCKED' || existingPeriod.status === 'PAID') && !forceRecalculate) {
      return res.status(400).json({
        success: false,
        code: 'PERIOD_LOCKED',
        message: `${periodMonth} payroll is ${existingPeriod.status}. Reopen with authorization before recalculating.`,
      });
    }

    const masterEmployees = (db.masterEmployees || []).filter(
      (e: any) => e.tenant_id === tenantId && !e.is_archived
    );

    const records: EnterprisePayrollRecord[] = [];
    let periodGrossFils = 0;
    let periodAllowancesFils = 0;
    let periodIncentivesFils = 0;
    let periodOvertimeFils = 0;
    let periodDeductionsFils = 0;
    let periodTrafficFinesFils = 0;
    let periodSalikFils = 0;
    let periodLoansFils = 0;
    let periodAdvancesFils = 0;
    let periodNetFils = 0;
    let exceptionsCount = 0;

    for (const emp of masterEmployees) {
      const empExceptions: any[] = [];
      const projectsWorkedSet = new Set<string>();

      // A. Active salary structure or fallback
      const salHist = (db.employeeSalaryHistories || [])
        .filter((h: any) => h.tenant_id === tenantId && h.employee_id === emp.id && h.is_active)
        .sort((a: any, b: any) => new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime())[0];

      const baseSalary = salHist ? salHist.base_salary : (emp.basic_salary || 2500);
      const fuelAllow = salHist ? salHist.fuel_allowance : (emp.allowances ? emp.allowances * 0.4 : 250);
      const mobileAllow = salHist ? salHist.mobile_allowance : (emp.allowances ? emp.allowances * 0.2 : 100);
      const accomAllow = salHist ? salHist.accommodation_allowance : (emp.allowances ? emp.allowances * 0.4 : 400);
      const otherAllow = salHist ? (salHist.other_allowances || 0) : 0;
      const totalAllowances = fuelAllow + mobileAllow + accomAllow + otherAllow;

      // B. Attendance / days worked
      let daysWorked = daysInMonth - 2;
      let unexcusedAbsences = 0;
      let overtimeHours = 0;
      let joinedMidMonth = false;

      if (emp.joining_date) {
        const joinDate = new Date(emp.joining_date);
        if (joinDate.getFullYear() === targetYear && joinDate.getMonth() + 1 === targetMonth) {
          const joinDay = joinDate.getDate();
          if (joinDay > 1) {
            daysWorked = Math.max(1, daysInMonth - joinDay + 1);
            joinedMidMonth = true;
            empExceptions.push({
              type: 'JOINED_MID_MONTH',
              message: `Joined mid-month on ${emp.joining_date}. Salary prorated for ${daysWorked} days.`,
              severity: 'INFO',
              resolved: true,
            });
          }
        }
      }

      // C. Project Earnings Lines (Multi-Project & Labour Hourly & Per-Delivery)
      // Check for imported project salary lines in db.projectSalaryLines
      const importedLines = (db.projectSalaryLines || []).filter(
        (l: any) =>
          (l.employee_id === emp.id || l.employee_code === emp.employee_code) &&
          (l.payroll_period_id === periodId || l.payroll_month === periodKey)
      );

      const projectEarningsLines: ProjectSalaryLine[] = [];
      let totalProjectGrossFils = 0;
      let totalProjectDeductionsFils = 0;
      let totalDeliveries = 0;
      let totalWorkingHours = 0;

      if (importedLines.length > 0) {
        // Multi-project lines imported for this employee
        for (const line of importedLines) {
          projectsWorkedSet.add(line.project_name);

          let lineGrossFils = 0;
          let lineDedFils = 0;
          let lineNetFils = 0;
          let lineAllowFils = 0;
          let lineIncentFils = 0;
          let lineAdjustmentEarningFils = 0;
          let isKeetaLine = false;
          let isNoonLine = false;

          if (line.calculation_method === 'HOURLY') {
            // LABOUR only: Working Hours × Hourly Rate, recalculated server-side.
            const hrs = Number(line.working_hours || 0);
            const rateFils = toFils(line.hourly_rate || 0);
            lineGrossFils = Math.round(hrs * rateFils);
            lineAllowFils = toFils(line.allowance || 0);
            lineIncentFils = toFils(line.incentive || 0);
            lineDedFils = toFils(line.deduction || 0);
            lineNetFils = lineGrossFils + lineAllowFils + lineIncentFils - lineDedFils;
            totalWorkingHours += hrs;

            if (hrs > 320) {
              empExceptions.push({
                type: 'HIGH_HOURS',
                message: `Reported working hours (${hrs} hrs) for ${line.project_name} exceeds reasonable limit (320 hrs).`,
                severity: 'WARNING',
              });
            }
          } else if (
            line.salary_group === 'KEETA' ||
            line.project_id === 'proj_keeta_1' ||
            line.calculation_method === 'KEETA_PAYROLL_IMPORT'
          ) {
            isKeetaLine = true;

            // Authoritative Keeta rule:
            // source_deductions = food_charge + penalty + bike_fine + maintenance_others
            // final_calculated_net = source_rider_salary + incentive_adjustment - source_deductions
            // Incentive, Reward and Tip are informational and MUST NOT be added again.
            lineGrossFils = toFils(
              line.source_rider_salary ?? line.gross_earnings ?? line.base_amount ?? 0
            );

            const signedAdjustmentFils = toFils(line.incentive_adjustment ?? 0);
            const sourceDeductionsAmount =
              line.manual_deduction ??
              line.source_deductions ??
              line.total_deductions ??
              ((line.food_charge || line.food_charge_deduction || 0) +
                (line.penalty || line.penalty_deduction || 0) +
                (line.source_bike_fine || line.bike_fine_deduction || 0) +
                (line.maintenance_other || line.maintenance_others_deduction || 0));

            lineDedFils = toFils(sourceDeductionsAmount);
            lineAdjustmentEarningFils = signedAdjustmentFils > 0 ? signedAdjustmentFils : 0;
            if (signedAdjustmentFils < 0) {
              lineDedFils += Math.abs(signedAdjustmentFils);
            }

            lineNetFils = lineGrossFils + signedAdjustmentFils - toFils(sourceDeductionsAmount);

            if (lineNetFils < 0) {
              empExceptions.push({
                type: 'NEGATIVE_NET_REVIEW_REQUIRED',
                message: `Employee has negative net payable for Keeta (AED ${fromFils(lineNetFils)}). Flagged: NEGATIVE_NET_REVIEW_REQUIRED.`,
                severity: 'WARNING',
              });
            }
          } else if (
            line.salary_group === 'NOON' ||
            line.project_id === 'proj_noon_1' ||
            line.calculation_method === 'CLIENT_IMPORT'
          ) {
            isNoonLine = true;

            // Authoritative Noon rule:
            // Rider Salary is the provider/source salary. Preserve it as the payable source value.
            // Fine/Loan/Deduction/Penalty/COD/Vendor Share remain traceable source fields and are
            // NOT automatically subtracted again here.
            lineGrossFils = toFils(
              line.source_rider_salary ?? line.rider_earning ?? line.gross_earnings ?? line.gross_project_earning ?? 0
            );
            lineNetFils = lineGrossFils;
            totalDeliveries += Number(
              line.total_orders ?? line.units_completed ?? line.deliveries ?? 0
            );
          } else if (line.calculation_method === 'PER_DELIVERY') {
            if (line.gross_earnings !== undefined || line.gross_project_earning !== undefined) {
              lineGrossFils = toFils(line.gross_earnings ?? line.gross_project_earning ?? 0);
              totalDeliveries += Number(line.units_completed || line.deliveries || 0);
            } else {
              const units = Number(line.units_completed || line.deliveries || 0);
              const configuredRate = Number(line.rate_per_unit || 0);
              const rateFils = toFils(configuredRate);
              lineGrossFils = Math.round(units * rateFils);
              totalDeliveries += units;
            }
            lineAllowFils = toFils(line.allowance || 0);
            lineIncentFils = toFils(line.incentive || 0);
            lineDedFils = toFils(line.deduction || 0);
            lineNetFils = lineGrossFils + lineAllowFils + lineIncentFils - lineDedFils;
          } else if (line.calculation_method === 'FIXED_MONTHLY') {
            lineGrossFils = toFils(line.gross_earnings || baseSalary || 0);
            lineAllowFils = toFils(line.allowance || 0);
            lineIncentFils = toFils(line.incentive || 0);
            lineDedFils = toFils(line.deduction || 0);
            lineNetFils = lineGrossFils + lineAllowFils + lineIncentFils - lineDedFils;
          } else {
            lineGrossFils = toFils(line.gross_earnings || 0);
            lineAllowFils = toFils(line.allowance || 0);
            lineIncentFils = toFils(line.incentive || 0);
            lineDedFils = toFils(line.deduction || 0);
            lineNetFils = lineGrossFils + lineAllowFils + lineIncentFils - lineDedFils;
          }

          // Compare expected vs calculated if provided in Excel.
          if (line.expected_total !== undefined && line.expected_total !== null) {
            const expFils = toFils(line.expected_total);
            if (Math.abs(expFils - lineGrossFils) > 10) {
              empExceptions.push({
                type: 'EXCEL_TOTAL_MISMATCH',
                message: `Excel expected total (AED ${fromFils(expFils)}) differs from server recalculated gross (AED ${fromFils(lineGrossFils)}) for ${line.project_name}.`,
                severity: 'WARNING',
              });
            }
          }

          projectEarningsLines.push({
            id: line.id || `psl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            employee_id: emp.id,
            payroll_period_id: periodId,
            project_id:
              line.project_id ||
              (isNoonLine ? 'proj_noon_1' : isKeetaLine ? 'proj_keeta_1' : ''),
            project_name:
              line.project_name ||
              (isNoonLine
                ? 'Noon Minutes Logistics'
                : isKeetaLine
                ? 'Keeta Express Delivery'
                : 'Unassigned'),
            salary_group: line.salary_group || (isNoonLine ? 'NOON' : isKeetaLine ? 'KEETA' : 'GENERAL'),
            from_date: line.from_date || `${periodKey}-01`,
            to_date: line.to_date || `${periodKey}-${daysInMonth}`,
            days_eligible: line.days_eligible || daysWorked,
            calculation_method:
              line.calculation_method ||
              (isNoonLine ? 'CLIENT_IMPORT' : isKeetaLine ? 'KEETA_PAYROLL_IMPORT' : 'HOURLY'),
            working_hours: line.working_hours,
            hourly_rate: line.hourly_rate,
            units_completed: line.units_completed || line.total_orders || line.deliveries,
            rate_per_unit: line.rate_per_unit,
            gross_earnings: fromFils(lineGrossFils),
            // Positive Keeta Incentive Adjustment is represented once as an earning adjustment.
            allowance: fromFils(lineAllowFils + lineAdjustmentEarningFils),
            incentive: fromFils(lineIncentFils),
            deduction: fromFils(lineDedFils),
            net_project_amount: fromFils(lineNetFils),
            notes: line.notes,
            // Preserve provider/source fields without double deduction.
            total_orders: line.total_orders ?? line.units_completed,
            rider_earning: line.rider_earning,
            penalty: line.penalty,
            cod: line.cod,
            vendor_share: line.vendor_share,
            source_fine: line.source_fine,
            source_loan: line.source_loan,
            source_rider_salary: line.source_rider_salary,
            supporting_details: line.supporting_details,
          });

          totalProjectGrossFils +=
            lineGrossFils + lineAllowFils + lineIncentFils + lineAdjustmentEarningFils;
          totalProjectDeductionsFils += lineDedFils;
        }
      } else {
        // Fallback to employee master project assignment
        const pName = emp.project_name || 'Unassigned';
        projectsWorkedSet.add(pName);

        // Check project salary config & import profile
        const projCfg = (db.projectSalaryConfigs || []).find(
          (c: any) => c.project_id === emp.project_id || c.project_name === pName
        );
        const importProfile = (db.projectImportProfiles || []).find(
          (p: any) => p.project_id === emp.project_id || p.salary_group === projCfg?.salary_group
        );

        let defaultGrossFils = 0;

        // 1. LABOUR HOURLY FORMULA IS LABOUR ONLY.
        // Never invent hours or rates. Without an imported real Labour source row, keep payable at zero
        // and require review/import before approval.
        if (projCfg?.salary_group === 'LABOUR' || projCfg?.calculation_method === 'HOURLY') {
          defaultGrossFils = 0;
          projectEarningsLines.push({
            id: `psl_missing_${emp.id}`,
            employee_id: emp.id,
            payroll_period_id: periodId,
            project_id: emp.project_id || '',
            project_name: pName,
            salary_group: 'LABOUR',
            from_date: `${periodKey}-01`,
            to_date: `${periodKey}-${daysInMonth}`,
            days_eligible: daysWorked,
            calculation_method: 'HOURLY',
            working_hours: 0,
            hourly_rate: 0,
            gross_earnings: 0,
            allowance: 0,
            incentive: 0,
            deduction: 0,
            net_project_amount: 0,
            notes: 'Real Labour timesheet required. No default hours or hourly rate were generated.',
          });
          empExceptions.push({
            type: 'AWAITING_LABOUR_TIMESHEET',
            message: `Real Labour timesheet is required for ${pName}. No hours or rate were assumed.`,
            severity: 'WARNING',
            resolved: false,
          });
        } else if (
          projCfg?.salary_group === 'KEETA' ||
          projCfg?.salary_group === 'NOON' ||
          importProfile?.status === 'WAITING_FOR_SOURCE_FORMAT'
        ) {
          // 2. KEETA / NOON / DELIVERY PROJECTS:
          // Do NOT invent formulas or speculative drop counts!
          // Profiles are kept in WAITING_FOR_SOURCE_FORMAT until client supplies real sample timesheet.
          defaultGrossFils = 0;
          projectEarningsLines.push({
            id: `psl_def_${emp.id}`,
            employee_id: emp.id,
            payroll_period_id: periodId,
            project_id: emp.project_id || '',
            project_name: pName,
            salary_group: (projCfg?.salary_group || 'KEETA') as any,
            from_date: `${periodKey}-01`,
            to_date: `${periodKey}-${daysInMonth}`,
            days_eligible: daysWorked,
            calculation_method: 'MANUAL_IMPORT',
            units_completed: 0,
            gross_earnings: 0,
            allowance: 0,
            incentive: 0,
            deduction: 0,
            net_project_amount: 0,
            notes: 'WAITING FOR REAL TIMESHEET FORMAT. No delivery formula is assumed without actual client timesheet sample.',
          });

          empExceptions.push({
            type: 'AWAITING_SOURCE_TIMESHEET',
            message: `Timesheet profile for ${pName} (${projCfg?.salary_group || 'DELIVERY'}) is in WAITING_FOR_SOURCE_FORMAT. Awaiting client timesheet.`,
            severity: 'INFO',
            resolved: false,
          });
        } else {
          // Fixed monthly contract staff
          const proratedBaseFils = Math.round((toFils(baseSalary) / daysInMonth) * daysWorked);
          defaultGrossFils = proratedBaseFils;
          projectEarningsLines.push({
            id: `psl_def_${emp.id}`,
            employee_id: emp.id,
            payroll_period_id: periodId,
            project_id: emp.project_id || '',
            project_name: pName,
            salary_group: 'FIXED',
            from_date: `${periodKey}-01`,
            to_date: `${periodKey}-${daysInMonth}`,
            days_eligible: daysWorked,
            calculation_method: 'FIXED_MONTHLY',
            gross_earnings: fromFils(proratedBaseFils),
            allowance: 0,
            incentive: 0,
            deduction: 0,
            net_project_amount: fromFils(proratedBaseFils),
            notes: 'Fixed monthly salary allocated.',
          });
        }
        totalProjectGrossFils = defaultGrossFils;
      }

      // Base pay, allowances, overtime
      const proratedBaseFils = Math.round((toFils(baseSalary) / daysInMonth) * daysWorked);
      const empAllowFils = toFils(totalAllowances);
      const overtimePayFils = Math.round(overtimeHours * (toFils(baseSalary) > 0 ? (toFils(baseSalary) / (daysInMonth * 8)) * 1.5 : 0));

      // D. Automatic Deductions:
      // 1. Traffic Fines Auto-Sync (Historical Violation Timestamp Resolution + Anti-Duplication + Partial Ledger)
      const empFines = (db.trafficFines || []).filter((f: any) => {
        if (f.tenant_id !== tenantId) return false;
        if (f.charge_status !== 'CHARGED') return false;
        if (f.status === 'PAID' || f.status === 'DISPUTED' || f.status === 'CANCELLED') return false;

        // Historical liability verification: verify fine belongs to this employee
        const directMatch =
          f.assigned_employee_id === emp.id ||
          f.assigned_employee_code === emp.employee_code ||
          f.rider_id === emp.id;

        if (directMatch) return true;

        // If fine is unassigned or assigned without timestamp, attempt historical resolution
        const vTs = f.violation_timestamp || f.violation_date || f.violationDate;
        const plate = f.plate_number || f.plateNo || f.vehicle_plate;
        if (plate && vTs) {
          const resolved = resolveEmployeeForFineTimestamp(tenantId, plate, f.vehicle_id, vTs);
          if (resolved && resolved.employee_id === emp.id) {
            // Found historical rider at exact timestamp
            f.assigned_employee_id = emp.id;
            f.assigned_employee_code = emp.employee_code;
            f.assigned_employee_name = emp.full_name;
            return true;
          }
        }

        return false;
      });

      let fineFils = 0;
      const fineTicketIds: string[] = [];
      const trafficFinesBreakdown: TrafficFineDeductionDetail[] = [];

      for (const fine of empFines) {
        const totalLiability = Number(fine.employee_liability || fine.amount || fine.fine_amount || fine.fineAmountAED || 0);
        const totalLiabilityFils = toFils(totalLiability);
        const alreadyDeducted = Number(fine.already_deducted || (fine.status === 'PAID' ? totalLiability : 0));
        const alreadyDeductedFils = toFils(alreadyDeducted);

        const remainingBalanceFils = Math.max(0, totalLiabilityFils - alreadyDeductedFils);

        // Anti-duplication: If remaining balance = 0, do not include again
        if (remainingBalanceFils <= 0) continue;

        // Installment deduction check
        const installmentFils = fine.monthly_installment ? toFils(fine.monthly_installment) : remainingBalanceFils;
        const currentDeductionFils = Math.min(remainingBalanceFils, installmentFils);

        fineFils += currentDeductionFils;
        fineTicketIds.push(fine.id);

        trafficFinesBreakdown.push({
          fine_id: fine.id,
          ticket_number: fine.ticket_number || fine.ticketNo || fine.id,
          plate_number: fine.plate_number || fine.plateNo || fine.vehicle_plate || 'N/A',
          violation_timestamp: fine.violation_timestamp || fine.violation_date || `${periodKey}-15`,
          posting_date: (fine.violation_date || fine.violationDate || fine.violation_timestamp || '').substring(0, 10),
          total_liability: fromFils(totalLiabilityFils),
          previously_deducted: fromFils(alreadyDeductedFils),
          current_deduction: fromFils(currentDeductionFils),
          remaining_balance: fromFils(remainingBalanceFils - currentDeductionFils),
          allocation_source: 'HISTORICAL_TIMESTAMPS',
        });
      }

      // 2. Salik Auto-Sync (Source crossing ID tracking + Anti-Duplication)
      const empSalik = (db.salikRecords || []).filter(
        (s: any) =>
          s.tenant_id === tenantId &&
          (s.assigned_employee_id === emp.id || s.assigned_employee_code === emp.employee_code) &&
          s.charge_status === 'CHARGED' &&
          s.status !== 'PAID'
      );
      let salikFils = 0;
      const salikIds: string[] = [];
      const salikBreakdown: SalikDeductionDetail[] = [];

      for (const slk of empSalik) {
        const amtFils = toFils(slk.employee_liability || slk.amount || 4.0);
        salikFils += amtFils;
        salikIds.push(slk.id);

        salikBreakdown.push({
          salik_id: slk.id,
          transaction_id: slk.id,
          toll_gate: slk.toll_gate || slk.gate || 'Salik Toll',
          plate_number: slk.plate_number || slk.plateNo || 'N/A',
          crossing_timestamp: slk.crossing_timestamp || slk.crossing_date || `${periodKey}-15T10:00:00`,
          amount: fromFils(amtFils),
        });
      }

      // 3. Loans Auto-Sync
      const empLoans = (db.employeeLoans || []).filter(
        (l: any) =>
          l.tenant_id === tenantId &&
          (l.employee_id === emp.id || l.employee_code === emp.employee_code) &&
          l.status === 'ACTIVE' &&
          l.remaining_balance > 0
      );
      let loanFils = 0;
      const loanIds: string[] = [];
      const loanBreakdown: LoanDeductionDetail[] = [];

      for (const loan of empLoans) {
        const installmentFils = Math.min(toFils(loan.monthly_installment), toFils(loan.remaining_balance));
        loanFils += installmentFils;
        loanIds.push(loan.id);

        loanBreakdown.push({
          loan_id: loan.id,
          reason: loan.reason || 'Employee Loan',
          installment_amount: fromFils(installmentFils),
          remaining_balance_after: fromFils(Math.max(0, toFils(loan.remaining_balance) - installmentFils)),
        });
      }

      // 4. Advances Auto-Sync
      const empAdvances = (db.employeeAdvances || []).filter(
        (a: any) =>
          a.tenant_id === tenantId &&
          (a.employee_id === emp.id || a.employee_code === emp.employee_code) &&
          a.status === 'ACTIVE' &&
          a.remaining_balance > 0
      );
      let advanceFils = 0;
      const advanceIds: string[] = [];
      const advanceBreakdown: AdvanceDeductionDetail[] = [];

      for (const adv of empAdvances) {
        const instFils = Math.min(toFils(adv.monthly_installment), toFils(adv.remaining_balance));
        advanceFils += instFils;
        advanceIds.push(adv.id);

        advanceBreakdown.push({
          advance_id: adv.id,
          reason: adv.reason || 'Salary Advance',
          installment_amount: fromFils(instFils),
          remaining_balance_after: fromFils(Math.max(0, toFils(adv.remaining_balance) - instFils)),
        });
      }

      // 5. Manual Monthly Adjustments
      const empAdjustments = (db.payrollAdjustments || []).filter(
        (adj: any) =>
          adj.tenant_id === tenantId &&
          (adj.employee_id === emp.id || adj.employee_code === emp.employee_code) &&
          adj.effective_month === periodKey &&
          adj.status !== 'CANCELLED'
      );

      let bonusFils = 0;
      let manualDeductionsFils = 0;
      for (const adj of empAdjustments) {
        const aFils = toFils(adj.amount);
        if (['BONUS', 'INCENTIVE', 'ALLOWANCE', 'OTHER_EARNING'].includes(adj.type)) {
          bonusFils += aFils;
        } else {
          manualDeductionsFils += aFils;
        }
      }

      // Absence deductions
      const absenceDeductionsFils = unexcusedAbsences > 0 ? Math.round((toFils(baseSalary) / daysInMonth) * unexcusedAbsences) : 0;

      // E. Total Gross, Total Deductions, Net Salary (FILS MATH)
      const empGrossFils = totalProjectGrossFils + empAllowFils + overtimePayFils + bonusFils;
      const empTotalDeductionsFils =
        absenceDeductionsFils + fineFils + salikFils + loanFils + advanceFils + manualDeductionsFils + totalProjectDeductionsFils;
      const empNetFils = empGrossFils - empTotalDeductionsFils;

      // F. Anomaly Detection
      if (empNetFils < 0) {
        empExceptions.push({
          type: 'NEGATIVE_NET_SALARY',
          message: `Net salary is negative (AED ${fromFils(empNetFils)}). Deductions (AED ${fromFils(empTotalDeductionsFils)}) exceed gross pay (AED ${fromFils(empGrossFils)}).`,
          severity: 'CRITICAL',
        });
      }

      const hasBank = !!(emp.iban || emp.bank_name);
      if (!hasBank && !emp.notes?.includes('WPS Exempt')) {
        empExceptions.push({
          type: 'MISSING_BANK_OR_IBAN',
          message: `Bank account / IBAN not configured for ${emp.full_name}. WPS file cannot be generated.`,
          severity: 'CRITICAL',
        });
      }

      if (fineFils > 0 && fineFils >= toFils(baseSalary) * 0.5) {
        empExceptions.push({
          type: 'HIGH_TRAFFIC_FINES',
          message: `Traffic violations total (AED ${fromFils(fineFils)}) exceeds 50% of base salary.`,
          severity: 'WARNING',
        });
      }

      const hasExceptions = empExceptions.length > 0;
      if (hasExceptions) exceptionsCount++;

      // Accumulate period totals
      periodGrossFils += empGrossFils;
      periodAllowancesFils += empAllowFils;
      periodOvertimeFils += overtimePayFils;
      periodDeductionsFils += empTotalDeductionsFils;
      periodTrafficFinesFils += fineFils;
      periodSalikFils += salikFils;
      periodLoansFils += loanFils;
      periodAdvancesFils += advanceFils;
      periodNetFils += empNetFils;

      const record: EnterprisePayrollRecord = {
        id: `pr_${targetYear}_${String(targetMonth).padStart(2, '0')}_${emp.id}`,
        tenant_id: tenantId,
        payroll_period_id: periodId,
        period_key: periodKey,
        period_month: periodMonth,
        year: targetYear,
        month: targetMonth,
        employee_id: emp.id,
        employee_code: emp.employee_code || `ALLIED-${emp.id}`,
        employee_name: emp.full_name,
        emirates_id: emp.emirates_id || emp.emirates_id_number,
        designation: emp.designation || 'Staff',
        department: emp.department || 'Fleet Delivery Operations',
        branch_id: emp.branch_id || '',
        branch_name: emp.branch_name || emp.branch || '',
        bank_name: emp.bank_name || '',
        iban: emp.iban || '',
        status: hasExceptions ? 'NEEDS_REVIEW' : 'READY',
        has_exceptions: hasExceptions,
        exceptions: empExceptions,
        projects_worked: Array.from(projectsWorkedSet),
        project_earnings_lines: projectEarningsLines,
        base_salary: baseSalary,
        prorated_base_salary: fromFils(proratedBaseFils),
        working_hours: totalWorkingHours,
        deliveries_completed: totalDeliveries,
        overtime_hours: overtimeHours,
        overtime_pay: fromFils(overtimePayFils),
        total_allowances: fromFils(empAllowFils),
        delivery_incentives: fromFils(totalProjectGrossFils),
        bonus_adjustments: fromFils(bonusFils),
        other_earnings: 0,
        gross_earnings: fromFils(empGrossFils),
        absence_deductions: fromFils(absenceDeductionsFils),
        traffic_fines_deduction: fromFils(fineFils),
        fine_ticket_ids: fineTicketIds,
        traffic_fines_breakdown: trafficFinesBreakdown,
        salik_deduction: fromFils(salikFils),
        salik_ids: salikIds,
        salik_breakdown: salikBreakdown,
        loan_deduction: fromFils(loanFils),
        loan_ids: loanIds,
        loan_breakdown: loanBreakdown,
        advance_deduction: fromFils(advanceFils),
        advance_ids: advanceIds,
        advance_breakdown: advanceBreakdown,
        manual_deductions: fromFils(manualDeductionsFils + totalProjectDeductionsFils),
        penalty_deductions: 0,
        other_deductions: 0,
        total_deductions: fromFils(empTotalDeductionsFils),
        net_salary: fromFils(empNetFils),
        payment_method: hasBank ? 'WPS_SIF' : 'CASH',
        notes: `${emp.full_name} payroll calculated for ${periodMonth}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      records.push(record);
    }

    // Period reconciliation verification
    const reconciled = periodNetFils === records.reduce((s, r) => s + toFils(r.net_salary), 0);

    const updatedPeriod: EnterprisePayrollPeriod = {
      id: periodId,
      tenant_id: tenantId,
      period_month: periodMonth,
      period_key: periodKey,
      year: targetYear,
      month: targetMonth,
      status: exceptionsCount > 0 ? 'NEEDS_REVIEW' : 'READY',
      cutoff_date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${daysInMonth}`,
      total_employees: masterEmployees.length,
      total_gross_pay: fromFils(periodGrossFils),
      total_allowances: fromFils(periodAllowancesFils),
      total_delivery_incentives: 0,
      total_overtime_pay: fromFils(periodOvertimeFils),
      total_deductions: fromFils(periodDeductionsFils),
      total_traffic_fines: fromFils(periodTrafficFinesFils),
      total_salik: fromFils(periodSalikFils),
      total_loans_recovered: fromFils(periodLoansFils),
      total_advances_recovered: fromFils(periodAdvancesFils),
      total_net_payable: fromFils(periodNetFils),
      exceptions_count: exceptionsCount,
      ready_count: records.filter((r) => !r.has_exceptions).length,
      reconciled,
      generated_at: new Date().toISOString(),
      generated_by: userName,
      wps_file_generated: false,
      notes: `${periodMonth} payroll calculated with automated fines, Salik, loans & multi-project earnings.`,
      created_at: existingPeriod ? existingPeriod.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Replace records in DB
    db.payrollRecords = db.payrollRecords.filter(
      (r: any) => !(r.tenant_id === tenantId && r.period_key === periodKey)
    );
    db.payrollRecords.push(...records);

    const pIndex = db.payrollPeriods.findIndex(
      (p: any) => p.tenant_id === tenantId && p.period_key === periodKey
    );
    if (pIndex >= 0) {
      db.payrollPeriods[pIndex] = updatedPeriod;
    } else {
      db.payrollPeriods.unshift(updatedPeriod);
    }

    // Audit log
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_pay_gen_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'GENERATE_PAYROLL',
      actionType: 'CREATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Generated payroll period ${periodMonth}: ${masterEmployees.length} employees, Net AED ${updatedPeriod.total_net_payable.toLocaleString()} (${exceptionsCount} exceptions).`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payroll for ${periodMonth} calculated successfully.`,
      period: updatedPeriod,
      recordsCount: records.length,
      exceptionsCount,
    });
  };

  router.post('/periods/generate', handleGeneratePeriod);
  router.post('/generate', handleGeneratePeriod);

  // ---------------------------------------------------------------------------
  // 4. PRE-POPULATED TEMPLATE DOWNLOAD
  // ---------------------------------------------------------------------------
  router.get('/templates/download', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const month = (req.query.month as string) || '2026-08';
    const salaryGroup = (req.query.salary_group as string) || 'LABOUR';
    const projectId = (req.query.project_id as string) || '';

    // Find eligible employees
    let employees = (db.masterEmployees || []).filter(
      (e: any) => e.tenant_id === tenantId && !e.is_archived
    );

    if (projectId) {
      employees = employees.filter((e: any) => e.project_id === projectId);
    }

    const defaultRate = salaryGroup === 'LABOUR' ? '5.00' : '14.00';
    const defaultHours = salaryGroup === 'LABOUR' ? '200' : '0';

    const header =
      'Employee Code,Emirates ID,Employee Name,Project,Payroll Month,Working Hours,Hourly Rate,Allowance,Incentive,Overtime Amount,Other Earnings,Manual Deduction,Expected Total,Notes\n';

    const rows = employees.map((e: any) => {
      const eCode = e.employee_code || `EMP-${e.id}`;
      const eid = e.emirates_id || e.emirates_id_number || '';
      const name = `"${e.full_name || ''}"`;
      const proj = `"${e.project_name || 'Labour Supply Technical Services'}"`;
      return `${eCode},${eid},${name},${proj},${month},${defaultHours},${defaultRate},0,0,0,0,0,1000.00,""`;
    });

    const csvContent = header + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Payroll_Template_${salaryGroup}_${month}.csv`
    );
    res.send(csvContent);
  });

  // ---------------------------------------------------------------------------
  // 5. PRE-IMPORT VALIDATION (Level 1: Server-side validation)
  // ---------------------------------------------------------------------------
  router.post('/import/validate', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const { month, salaryGroup, projectId, projectName, rows, fileName } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows provided for import validation.' });
    }

    const targetMonth = month || '2026-08';
    const sGroup = (salaryGroup || 'LABOUR').toUpperCase();
    const pId = projectId || (sGroup === 'LABOUR' ? 'proj_labour_1' : sGroup === 'KEETA' ? 'proj_keeta_1' : 'proj_noon_1');
    const defaultProjName = projectName || (sGroup === 'LABOUR' ? 'Labour Supply Technical Services' : sGroup === 'KEETA' ? 'Keeta Express Delivery' : 'Noon Minutes Logistics');

    // Check project import profile
    const profile = (db.projectImportProfiles || []).find(
      (p: any) => p.tenant_id === tenantId && (p.project_id === pId || p.salary_group === sGroup)
    );

    // Strict Architectural Constraint: Keeta/Noon WAITING_FOR_SOURCE_FORMAT check
    if (profile && profile.status === 'WAITING_FOR_SOURCE_FORMAT') {
      return res.status(400).json({
        success: false,
        code: 'WAITING_FOR_SOURCE_FORMAT',
        profile_status: 'WAITING_FOR_SOURCE_FORMAT',
        message: `Project import profile "${profile.profile_name}" is locked in WAITING_FOR_SOURCE_FORMAT. System is awaiting the client's real timesheet sample. Do not invent formulas or import speculative delivery figures.`,
      });
    }

    const previewRows: any[] = [];
    let readyCount = 0;
    let warningCount = 0;
    let errorCount = 0;
    const seenEmpCodes = new Set<string>();

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 1;
      const errors: string[] = [];
      const warnings: string[] = [];

      // Resolve employee using Strict Priority: 1. Code, 2. Emirates ID, 3. Project Rider ID
      const resolved = resolveEmployeeFromRow(tenantId, row, pId, sGroup);
      let emp: any = null;

      if (!resolved.success) {
        errors.push(resolved.message);
      } else {
        emp = resolved.employee;
      }

      const empCode = (row.employee_code || row['Employee Code'] || emp?.employee_code || '').toString().trim();
      const emiratesId = (row.emirates_id || row['Emirates ID'] || emp?.emirates_id || '').toString().trim();
      const empName = (row.employee_name || row['Employee Name'] || emp?.full_name || '').toString().trim();
      const rowProj = (row.project || row['Project'] || defaultProjName).toString().trim();
      const rowMonth = (row.payroll_month || row['Payroll Month'] || targetMonth).toString().trim();
      const rawHours = row.working_hours !== undefined ? row.working_hours : row['Working Hours'];
      const rawRate = row.hourly_rate !== undefined ? row.hourly_rate : row['Hourly Rate'];
      const rawExpected = row.expected_total !== undefined ? row.expected_total : row['Expected Total'] || row['Gross Amount'];
      const allowance = parseFloat(row.allowance || row['Allowance'] || '0') || 0;
      const incentive = parseFloat(row.incentive || row['Incentive'] || '0') || 0;
      const overtime = parseFloat(row.overtime || row['Overtime Amount'] || '0') || 0;
      const manualDeduction = parseFloat(row.manual_deduction || row['Manual Deduction'] || '0') || 0;

      // Check duplicate row in import sheet
      if (empCode && seenEmpCodes.has(empCode)) {
        warnings.push(`Duplicate employee code '${empCode}' in uploaded sheet.`);
      } else if (empCode) {
        seenEmpCodes.add(empCode);
      }

      // Validate hours and rates (Labour Hourly)
      const hours = parseFloat(rawHours);
      const rate = parseFloat(rawRate);

      if (isNaN(hours) || hours < 0) {
        errors.push(`Invalid working hours '${rawHours}'. Must be a non-negative number.`);
      } else if (hours > 320) {
        warnings.push(`Reported working hours (${hours}) exceeds 320 hrs monthly threshold.`);
      }

      if (isNaN(rate) || rate < 0) {
        errors.push(`Invalid hourly rate '${rawRate}'. Must be a positive number.`);
      }

      // Server independent recalculation: Working Hours × Hourly Rate applies exclusively to Labour Hourly
      const hoursFils = toFils(hours);
      const rateFils = toFils(rate);
      const calculatedGrossFils = !isNaN(hours) && !isNaN(rate) ? Math.round(hours * rateFils) : 0;
      const calculatedGross = fromFils(calculatedGrossFils);

      // Check expected total vs server recalculated
      let mismatch = false;
      if (rawExpected !== undefined && rawExpected !== null && rawExpected !== '') {
        const expectedNum = parseFloat(rawExpected);
        if (!isNaN(expectedNum)) {
          const expFils = toFils(expectedNum);
          if (Math.abs(expFils - calculatedGrossFils) > 10) {
            mismatch = true;
            warnings.push(
              `Excel expected total (AED ${expectedNum.toFixed(2)}) disagrees with server calculation (AED ${calculatedGross.toFixed(2)}).`
            );
          }
        }
      }

      let rowStatus: 'READY' | 'WARNING' | 'ERROR' = 'READY';
      if (errors.length > 0) {
        rowStatus = 'ERROR';
        errorCount++;
      } else if (warnings.length > 0) {
        rowStatus = 'WARNING';
        warningCount++;
      } else {
        readyCount++;
      }

      previewRows.push({
        rowNumber: rowNum,
        employee_id: emp?.id || `unknown_${index}`,
        employee_code: empCode || emp?.employee_code,
        employee_name: emp?.full_name || empName,
        emirates_id: emiratesId || emp?.emirates_id,
        project: rowProj,
        payroll_month: rowMonth,
        working_hours: hours,
        hourly_rate: rate,
        calculated_gross: calculatedGross,
        allowance,
        incentive,
        overtime,
        manual_deduction: manualDeduction,
        expected_total: rawExpected ? parseFloat(rawExpected) : null,
        mismatch,
        status: rowStatus,
        errors,
        warnings,
        raw_row: row,
      });
    }

    const batchToken = `batch_${Date.now()}`;

    res.json({
      success: true,
      batchToken,
      month: targetMonth,
      salaryGroup: sGroup,
      totalRows: rows.length,
      readyCount,
      warningCount,
      errorCount,
      canCommit: errorCount === 0,
      previewRows,
    });
  });

  // ---------------------------------------------------------------------------
  // 6. CONFIRM BATCH IMPORT (Commit validated project salary lines)
  // ---------------------------------------------------------------------------
  router.post('/import/confirm', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { month, salaryGroup, projectId, projectName, rows, fileName } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No rows to commit.' });
    }

    const targetMonth = month || '2026-08';
    const periodKey = targetMonth;
    const sGroup = (salaryGroup || 'LABOUR').toUpperCase();
    const pName = projectName || (sGroup === 'LABOUR' ? 'Labour Supply Technical Services' : 'Partner Project');
    const pId = projectId || (sGroup === 'LABOUR' ? 'proj_labour_1' : 'proj_partner_1');
    const periodId = `pp_${targetMonth.replace('-', '_')}`;

    // Check lock
    const existingPeriod = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && p.period_key === periodKey
    );
    if (existingPeriod && (existingPeriod.status === 'LOCKED' || existingPeriod.status === 'PAID')) {
      return res.status(400).json({
        success: false,
        code: 'PERIOD_LOCKED',
        message: `${targetMonth} payroll is locked. Cannot import into a locked period.`,
      });
    }

    let committedCount = 0;
    const batchId = `bat_${Date.now()}`;

    for (let index = 0; index < rows.length; index++) {
      const r = rows[index];
      if (r.status === 'ERROR') continue; // Skip fatal errors

      const empCode = r.employee_code;
      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          e.tenant_id === tenantId &&
          (e.id === r.employee_id || e.employee_code?.toLowerCase() === empCode?.toLowerCase())
      );
      if (!emp) continue;

      const hrs = Number(r.working_hours || 0);
      const rate = Number(r.hourly_rate || 5.0);
      const grossFils = Math.round(hrs * toFils(rate));
      const allowFils = toFils(r.allowance || 0);
      const incentFils = toFils(r.incentive || 0);
      const dedFils = toFils(r.manual_deduction || 0);
      const netFils = grossFils + allowFils + incentFils - dedFils;

      // Check if project salary line already exists for this employee + project + period
      const existingLineIndex = (db.projectSalaryLines || []).findIndex(
        (l: any) =>
          l.tenant_id === tenantId &&
          l.employee_id === emp.id &&
          l.payroll_period_id === periodId &&
          (l.project_id === pId || l.project_name === pName)
      );

      const newLine: ProjectSalaryLine = {
        id: `psl_${Date.now()}_${emp.id}_${index}`,
        employee_id: emp.id,
        payroll_period_id: periodId,
        project_id: pId,
        project_name: pName,
        salary_group: sGroup as any,
        from_date: `${periodKey}-01`,
        to_date: `${periodKey}-28`,
        days_eligible: 26,
        calculation_method: sGroup === 'LABOUR' ? 'HOURLY' : 'MANUAL_IMPORT',
        working_hours: hrs,
        hourly_rate: rate,
        gross_earnings: fromFils(grossFils),
        allowance: fromFils(allowFils),
        incentive: fromFils(incentFils),
        deduction: fromFils(dedFils),
        net_project_amount: fromFils(netFils),
        source_batch_id: batchId,
        source_row_reference: r.rowNumber || index + 1,
        source_metrics_json: JSON.stringify(r.raw_row || r),
        gross_project_earning: fromFils(grossFils),
        allowances: fromFils(allowFils),
        incentives: fromFils(incentFils),
        project_penalties: 0,
        manual_adjustment: fromFils(-dedFils),
        net_project_earning: fromFils(netFils),
        source_total: r.expected_total || fromFils(grossFils),
        calculation_audit: `Labour Hourly: ${hrs} hrs × AED ${rate}/hr = AED ${fromFils(grossFils)}`,
        notes: r.notes || `Imported via batch ${batchId}`,
      };

      if (existingLineIndex >= 0) {
        db.projectSalaryLines[existingLineIndex] = { ...db.projectSalaryLines[existingLineIndex], ...newLine };
      } else {
        db.projectSalaryLines.push({ ...newLine, tenant_id: tenantId });
      }
      committedCount++;
    }

    // Save batch record
    const batchRecord: PayrollImportBatch = {
      id: `pib_${Date.now()}`,
      tenant_id: tenantId,
      batch_id: batchId,
      file_name: fileName || `Salary_Import_${sGroup}_${targetMonth}.csv`,
      month: targetMonth,
      project_id: pId,
      project_name: pName,
      salary_group: sGroup,
      total_rows: rows.length,
      valid_rows: committedCount,
      warning_rows: rows.filter((r: any) => r.status === 'WARNING').length,
      error_rows: rows.filter((r: any) => r.status === 'ERROR').length,
      imported_by: userName,
      imported_at: new Date().toISOString(),
      status: 'COMMITTED',
    };
    db.payrollImportBatches.unshift(batchRecord);

    // Audit log
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_import_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'IMPORT_SALARY_DATA',
      actionType: 'CREATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Imported ${committedCount} salary lines for ${pName} (${sGroup}) for ${targetMonth}.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Successfully imported ${committedCount} salary lines. Run 'Generate Payroll' to recalculate month.`,
      batch: batchRecord,
    });
  });

  // ---------------------------------------------------------------------------
  // 7. GET IMPORT BATCHES HISTORY
  // ---------------------------------------------------------------------------
  const handleGetImportBatches = (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const batches = (db.payrollImportBatches || [])
      .filter((b: any) => isSuperAdmin || b.tenant_id === tenantId)
      .sort((a: any, b: any) => new Date(b.imported_at).getTime() - new Date(a.imported_at).getTime());
    res.json({ success: true, batches });
  };
  router.get('/import-batches', handleGetImportBatches);
  router.get('/import/batches', handleGetImportBatches);

  // ---------------------------------------------------------------------------
  // 8. APPROVE PAYROLL PERIOD
  // ---------------------------------------------------------------------------
  router.post('/periods/:id/approve', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { id } = req.params;

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    if (period.status === 'LOCKED' || period.status === 'PAID') {
      return res.status(400).json({ success: false, message: `Period is already ${period.status}.` });
    }

    // Safety checks: reconciliation
    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );

    const sumNetFils = records.reduce((s: number, r: any) => s + toFils(r.net_salary), 0);
    const periodNetFils = toFils(period.total_net_payable);

    if (sumNetFils !== periodNetFils) {
      return res.status(400).json({
        success: false,
        code: 'RECONCILIATION_MISMATCH',
        message: `Approval blocked: Sum of employee net salaries (AED ${fromFils(sumNetFils)}) does not match period total net payable (AED ${fromFils(periodNetFils)}). Recalculate first.`,
      });
    }

    // Check critical blocking exceptions
    const criticalExceptions = records
      .flatMap((r: any) => r.exceptions || [])
      .filter((ex: any) => ex.severity === 'CRITICAL');

    if (criticalExceptions.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'CRITICAL_EXCEPTIONS_PENDING',
        message: `Approval blocked: There are ${criticalExceptions.length} critical unresolved exceptions (e.g. negative net salary, missing bank info).`,
        exceptions: criticalExceptions,
      });
    }

    period.status = 'APPROVED';
    period.approved_at = new Date().toISOString();
    period.approved_by = userName;
    period.updated_at = new Date().toISOString();

    // Mark records as APPROVED
    records.forEach((r: any) => {
      r.status = 'APPROVED';
      r.updated_at = new Date().toISOString();
    });

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_appr_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'APPROVE_PAYROLL',
      actionType: 'UPDATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Approved payroll for ${period.period_month} (AED ${period.total_net_payable.toLocaleString()}) with ${records.length} employees.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payroll period ${period.period_month} officially APPROVED.`,
      period,
    });
  });

  // ---------------------------------------------------------------------------
  // 9. REOPEN APPROVED PAYROLL (Edit Safety with Mandatory Reason)
  // ---------------------------------------------------------------------------
  router.post('/periods/:id/reopen', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        code: 'REASON_REQUIRED',
        message: 'A detailed reason (minimum 5 characters) is mandatory to reopen an approved payroll period.',
      });
    }

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    const oldStatus = period.status;
    const oldNet = period.total_net_payable;

    period.status = 'NEEDS_REVIEW';
    period.updated_at = new Date().toISOString();

    if (!period.reopened_history) period.reopened_history = [];
    period.reopened_history.push({
      date: new Date().toISOString(),
      user: userName,
      reason,
      old_net: oldNet,
      new_net: oldNet,
    });

    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );
    records.forEach((r: any) => {
      r.status = 'DRAFT';
      r.updated_at = new Date().toISOString();
    });

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_reopen_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'REOPEN_PAYROLL',
      actionType: 'UPDATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Reopened ${period.period_month} payroll from ${oldStatus} to DRAFT. Reason: "${reason}".`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payroll period ${period.period_month} reopened for corrections.`,
      period,
    });
  });

  // ---------------------------------------------------------------------------
  // 10. PUBLISH PAYROLL (Make visible to Employee Portal)
  // ---------------------------------------------------------------------------
  router.post('/periods/:id/publish', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { id } = req.params;

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    if (period.status !== 'APPROVED' && period.status !== 'PAID') {
      return res.status(400).json({
        success: false,
        message: `Cannot publish unapproved payroll. Current status: ${period.status}. Approve first.`,
      });
    }

    period.status = 'PUBLISHED';
    period.published_at = new Date().toISOString();
    period.published_by = userName;
    period.updated_at = new Date().toISOString();

    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );
    records.forEach((r: any) => {
      r.status = 'PUBLISHED';
      r.updated_at = new Date().toISOString();
    });

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_pub_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'PUBLISH_PAYROLL',
      actionType: 'UPDATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Published ${period.period_month} payroll. Slips now visible to ${records.length} employees.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payroll period ${period.period_month} published. Available in Employee Portal.`,
      period,
    });
  });

  // ---------------------------------------------------------------------------
  // 11. RECORD PAYMENT & DISBURSEMENT
  // ---------------------------------------------------------------------------
  router.post('/periods/:id/pay', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { id } = req.params;
    const { paymentReference, paymentMethod, paymentDate } = req.body;

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    const pRef = paymentReference || `PAY-WPS-${period.period_key}-${Date.now()}`;
    const pDate = paymentDate || new Date().toISOString().substring(0, 10);
    const pMethod = paymentMethod || 'WPS_SIF';

    period.status = 'PAID';
    period.paid_at = new Date().toISOString();
    period.paid_by = userName;
    period.wps_file_generated = true;
    period.updated_at = new Date().toISOString();

    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );

    records.forEach((r: any) => {
      r.status = 'PAID';
      r.payment_reference = pRef;
      r.payment_date = pDate;
      r.payment_method = pMethod;
      r.updated_at = new Date().toISOString();

      // Deduct fine tickets in db with full ledger tracking & installment deduction
      if (r.traffic_fines_breakdown && r.traffic_fines_breakdown.length > 0) {
        for (const detail of r.traffic_fines_breakdown) {
          const fine = (db.trafficFines || []).find((f: any) => f.id === detail.fine_id);
          if (fine) {
            const currentDed = Number(detail.current_deduction || 0);
            fine.already_deducted = Number(fine.already_deducted || 0) + currentDed;
            fine.employee_paid = fine.already_deducted;
            const liability = Number(fine.employee_liability || fine.amount || fine.fine_amount || 0);
            fine.outstanding_balance = Math.max(0, liability - fine.already_deducted);
            if (fine.outstanding_balance <= 0) {
              fine.status = 'PAID';
              fine.deducted_from_payroll = true;
            } else {
              fine.status = 'PARTIALLY_DEDUCTED';
              fine.deducted_from_payroll = false;
            }
            fine.payroll_period = period.period_key;
            if (!fine.payroll_deductions) fine.payroll_deductions = [];
            fine.payroll_deductions.push({
              payroll_period: period.period_key,
              amount: currentDed,
              deducted_at: pDate,
              payroll_record_id: r.id,
              remaining_balance: fine.outstanding_balance,
            });
          }
        }
      } else if (r.fine_ticket_ids && r.fine_ticket_ids.length > 0) {
        for (const fId of r.fine_ticket_ids) {
          const fine = (db.trafficFines || []).find((f: any) => f.id === fId);
          if (fine) {
            fine.status = 'PAID';
            fine.deducted_from_payroll = true;
            fine.payroll_period = period.period_key;
          }
        }
      }

      // Mark salik crossings in db
      if (r.salik_ids && r.salik_ids.length > 0) {
        for (const sId of r.salik_ids) {
          const slk = (db.salikRecords || []).find((s: any) => s.id === sId);
          if (slk) {
            slk.status = 'PAID';
            slk.payroll_period = period.period_key;
          }
        }
      }

      // Repay loans
      if (r.loan_ids && r.loan_ids.length > 0) {
        for (const lId of r.loan_ids) {
          const loan = (db.employeeLoans || []).find((l: any) => l.id === lId);
          if (loan) {
            const instFils = Math.min(toFils(loan.monthly_installment), toFils(loan.remaining_balance));
            loan.amount_paid += fromFils(instFils);
            loan.remaining_balance = Math.max(0, loan.remaining_balance - fromFils(instFils));
            if (loan.remaining_balance <= 0) loan.status = 'PAID_OFF';
            if (!loan.repayment_history) loan.repayment_history = [];
            loan.repayment_history.push({
              date: pDate,
              amount: fromFils(instFils),
              payroll_period_id: period.id,
              recorded_by: userName,
            });
          }
        }
      }

      // Repay advances
      if (r.advance_ids && r.advance_ids.length > 0) {
        for (const aId of r.advance_ids) {
          const adv = (db.employeeAdvances || []).find((a: any) => a.id === aId);
          if (adv) {
            const instFils = Math.min(toFils(adv.monthly_installment), toFils(adv.remaining_balance));
            adv.amount_repaid += fromFils(instFils);
            adv.remaining_balance = Math.max(0, adv.remaining_balance - fromFils(instFils));
            if (adv.remaining_balance <= 0) adv.status = 'PAID_OFF';
            if (!adv.repayment_history) adv.repayment_history = [];
            adv.repayment_history.push({
              date: pDate,
              amount: fromFils(instFils),
              payroll_period_id: period.id,
              recorded_by: userName,
            });
          }
        }
      }
    });

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_pay_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'DISBURSE_PAYROLL',
      actionType: 'UPDATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Recorded payment of AED ${period.total_net_payable.toLocaleString()} for ${period.period_month} via ${pMethod} (Ref: ${pRef}).`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payment of AED ${period.total_net_payable.toLocaleString()} recorded for ${period.period_month}.`,
      period,
    });
  });

  // ---------------------------------------------------------------------------
  // 12. REVERSE PAYMENT (Authorized Audit Flow - No Hard Delete)
  // ---------------------------------------------------------------------------
  router.post('/periods/:id/reverse-payment', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required for payment reversal.' });
    }

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    if (period.status !== 'PAID') {
      return res.status(400).json({ success: false, message: 'Only PAID periods can be reversed.' });
    }

    period.status = 'APPROVED';
    period.paid_at = undefined;
    period.paid_by = undefined;
    period.updated_at = new Date().toISOString();

    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );
    records.forEach((r: any) => {
      r.status = 'APPROVED';
      r.payment_reference = undefined;
      r.payment_date = undefined;
    });

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_rev_pay_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'REVERSE_PAYROLL_PAYMENT',
      actionType: 'UPDATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Reversed payment for ${period.period_month}. Reason: "${reason}". Original payment event preserved in audit log.`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      message: `Payment reversed for ${period.period_month}. Period restored to APPROVED status.`,
      period,
    });
  });

  // ---------------------------------------------------------------------------
  // 13. MONTHLY ADJUSTMENTS MANAGEMENT & DOUBLE DEDUCTION BLOCK
  // ---------------------------------------------------------------------------
  router.get('/adjustments', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const month = (req.query.month as string) || '';
    let adjs = (db.payrollAdjustments || []).filter(
      (a: any) => isSuperAdmin || a.tenant_id === tenantId
    );
    if (month) {
      adjs = adjs.filter((a: any) => a.effective_month === month);
    }
    res.json(adjs);
  });

  router.post('/adjustments', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const {
      employee_id,
      employee_code,
      type,
      amount,
      reason,
      effective_month,
      reference,
      project_id,
      project_name,
      source_transaction_id,
    } = req.body;

    if (!employee_id && !employee_code) {
      return res.status(400).json({ success: false, message: 'Employee is required.' });
    }
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is mandatory for manual adjustments.' });
    }

    const emp = (db.masterEmployees || []).find(
      (e: any) =>
        e.tenant_id === tenantId &&
        (e.id === employee_id || e.employee_code === employee_id || e.employee_code === employee_code)
    );
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const monthKey = effective_month || '2026-08';

    // DOUBLE DEDUCTION PREVENTION CHECK:
    // If user tries to manually add a fine deduction with reference that already exists in Traffic Fines or Salik
    if (source_transaction_id || reference) {
      const refToCheck = source_transaction_id || reference;
      const existingFine = (db.trafficFines || []).find(
        (f: any) =>
          f.tenant_id === tenantId &&
          (f.id === refToCheck || f.fine_ticket_id === refToCheck || f.invoice_number === refToCheck)
      );
      if (existingFine) {
        return res.status(400).json({
          success: false,
          code: 'DOUBLE_DEDUCTION_BLOCKED',
          message: `Double deduction blocked: Traffic Fine '${refToCheck}' is already managed automatically via the Traffic Fines module. Do not manually re-enter it.`,
        });
      }

      const existingSalik = (db.salikRecords || []).find(
        (s: any) => fTenant(s) && (s.id === refToCheck || s.transaction_id === refToCheck)
      );
      if (existingSalik) {
        return res.status(400).json({
          success: false,
          code: 'DOUBLE_DEDUCTION_BLOCKED',
          message: `Double deduction blocked: Salik crossing '${refToCheck}' is already managed automatically via the Salik module.`,
        });
      }

      // Check if adjustment with same source_transaction_id already created
      const duplicateAdj = (db.payrollAdjustments || []).find(
        (a: any) =>
          a.tenant_id === tenantId &&
          a.effective_month === monthKey &&
          a.source_transaction_id === refToCheck &&
          a.status !== 'CANCELLED'
      );
      if (duplicateAdj) {
        return res.status(400).json({
          success: false,
          code: 'DUPLICATE_ADJUSTMENT_BLOCKED',
          message: `Adjustment with reference '${refToCheck}' already exists for ${monthKey}.`,
        });
      }
    }

    function fTenant(obj: any) {
      return obj.tenant_id === tenantId;
    }

    const newAdj: PayrollAdjustment = {
      id: `adj_${Date.now()}`,
      tenant_id: tenantId,
      employee_id: emp.id,
      employee_name: emp.full_name,
      employee_code: emp.employee_code || `EMP-${emp.id}`,
      type: type || 'ALLOWANCE',
      amount: Math.abs(parseFloat(amount || '0')),
      reason: reason.trim(),
      effective_month: monthKey,
      reference,
      project_id,
      project_name,
      source_transaction_id,
      created_by: userName,
      created_at: new Date().toISOString(),
      status: 'ACTIVE',
    };

    db.payrollAdjustments.push(newAdj);

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_adj_${Date.now()}`,
      tenant_id: tenantId,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      userId,
      userName,
      userRole,
      action: 'CREATE_PAYROLL_ADJUSTMENT',
      actionType: 'CREATE',
      status: 'SUCCESS',
      module: 'Payroll Management',
      details: `Added ${newAdj.type} adjustment of AED ${newAdj.amount} for ${emp.full_name} (${monthKey}): ${newAdj.reason}`,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.status(201).json({
      success: true,
      message: `Adjustment of AED ${newAdj.amount} added.`,
      adjustment: newAdj,
    });
  });

  // ---------------------------------------------------------------------------
  // 14. LOANS & ADVANCES MANAGEMENT
  // ---------------------------------------------------------------------------
  router.get('/loans', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const loans = (db.employeeLoans || []).filter(
      (l: any) => isSuperAdmin || l.tenant_id === tenantId
    );
    res.json(loans);
  });

  router.post('/loans', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { employee_id, original_amount, monthly_installment, reason, start_date, start_month } = req.body;

    const emp = (db.masterEmployees || []).find(
      (e: any) => e.tenant_id === tenantId && (e.id === employee_id || e.employee_code === employee_id)
    );
    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found.' });
    }

    const amt = parseFloat(original_amount || '0');
    const monthly = parseFloat(monthly_installment || '0');

    if (amt <= 0 || monthly <= 0) {
      return res.status(400).json({ success: false, message: 'Valid loan amount and monthly installment required.' });
    }

    const newLoan: EmployeeLoan = {
      id: `loan_${Date.now()}`,
      tenant_id: tenantId,
      employee_id: emp.id,
      employee_code: emp.employee_code || `EMP-${emp.id}`,
      employee_name: emp.full_name,
      original_amount: amt,
      start_date: start_date || new Date().toISOString().substring(0, 10),
      start_month: start_month || '2026-08',
      monthly_installment: monthly,
      amount_paid: 0,
      remaining_balance: amt,
      reason: reason || 'Company Employee Loan',
      status: 'ACTIVE',
      approved_by: userName,
      repayment_history: [],
      created_at: new Date().toISOString(),
    };

    db.employeeLoans.push(newLoan);
    res.status(201).json({ success: true, loan: newLoan });
  });

  router.get('/advances', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const list = (db.employeeAdvances || []).filter(
      (a: any) => isSuperAdmin || a.tenant_id === tenantId
    );
    res.json({ success: true, advances: list });
  });

  router.post('/advances', (req: Request, res: Response) => {
    const { tenantId, userName, userId, userRole } = getContext(req);
    const { employeeId, employee_id, amount, installments, reason } = req.body;

    const targetEmpId = employeeId || employee_id;
    const emp = (db.masterEmployees || []).find(
      (e: any) => e.tenant_id === tenantId && (e.id === targetEmpId || e.employee_code === targetEmpId)
    );

    const amt = parseFloat(amount || '0');
    const instCount = Math.max(1, parseInt(installments || '1', 10));
    const monthlyInst = Math.round(amt / instCount);

    const newAdvance: EmployeeAdvance = {
      id: `adv_${Date.now()}`,
      tenant_id: tenantId,
      employee_id: emp ? emp.id : (targetEmpId || 'emp_01'),
      employee_code: emp ? emp.employee_code : (targetEmpId || 'EMP-1001'),
      employee_name: emp ? emp.full_name : 'Staff Employee',
      advance_amount: amt,
      installments_count: instCount,
      monthly_installment: monthlyInst,
      amount_repaid: 0,
      remaining_balance: amt,
      reason: reason || 'Salary Advance Request',
      disbursed_date: new Date().toISOString().substring(0, 10),
      deduction_start_month: '2026-08',
      status: 'ACTIVE',
      approved_by: userName,
      repayment_history: [],
      created_at: new Date().toISOString(),
    };

    db.employeeAdvances.push(newAdvance);
    res.status(201).json({ success: true, advance: newAdvance, message: `Cash advance of AED ${amt} registered.` });
  });

  // ---------------------------------------------------------------------------
  // 15. PROJECT SALARY CONFIGURATION (Dynamic Project Master Integration)
  // ---------------------------------------------------------------------------
  router.get('/project-configs', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const configs = (db.projectSalaryConfigs || []).filter(
      (c: any) => isSuperAdmin || c.tenant_id === tenantId
    );
    res.json(configs);
  });

  router.post('/project-configs', (req: Request, res: Response) => {
    const { tenantId, userName } = getContext(req);
    const { project_id, project_name, salary_group, calculation_method, default_rate, rate_type, allowance_rules, incentive_rules } = req.body;

    const existingIndex = (db.projectSalaryConfigs || []).findIndex(
      (c: any) => c.tenant_id === tenantId && (c.project_id === project_id || c.project_name === project_name)
    );

    const config: ProjectSalaryConfig = {
      id: existingIndex >= 0 ? db.projectSalaryConfigs[existingIndex].id : `cfg_${Date.now()}`,
      tenant_id: tenantId,
      project_id: project_id || `proj_${(project_name || 'new').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      project_name: project_name || 'Partner Project',
      salary_group: salary_group || 'GENERAL',
      calculation_method: calculation_method || 'HOURLY',
      default_rate: parseFloat(default_rate || '0'),
      rate_type: rate_type || (calculation_method === 'HOURLY' ? 'HOURLY' : 'PER_DELIVERY'),
      allowance_rules: allowance_rules || '',
      incentive_rules: incentive_rules || '',
      required_fields: calculation_method === 'HOURLY' ? ['Working Hours', 'Hourly Rate'] : ['Deliveries', 'Rate'],
    };

    if (existingIndex >= 0) {
      db.projectSalaryConfigs[existingIndex] = config;
    } else {
      db.projectSalaryConfigs.push(config);
    }

    res.json({ success: true, config });
  });

  // ---------------------------------------------------------------------------
  // 15b. SALARY STRUCTURES & SALARY HISTORY (Compatibility)
  // ---------------------------------------------------------------------------
  router.get('/salary-structures', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const list = isSuperAdmin ? db.salaryStructures || [] : (db.salaryStructures || []).filter((s: any) => s.tenant_id === tenantId);
    res.json({ success: true, structures: list });
  });

  router.get('/structures', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const list = isSuperAdmin ? db.salaryStructures || [] : (db.salaryStructures || []).filter((s: any) => s.tenant_id === tenantId);
    res.json({ success: true, structures: list });
  });

  router.get('/salary-history/:employeeId', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const { employeeId } = req.params;

    const structuresHistory = (db.employeeSalaryHistories || [])
      .filter((h: any) => h.tenant_id === tenantId && (h.employee_id === employeeId || h.employee_name === employeeId));

    const monthlyPayrollHistory = (db.payrollRecords || [])
      .filter((r: any) => r.tenant_id === tenantId && (r.employee_id === employeeId || r.employee_code === employeeId));

    const projectSalaryLines = (db.projectSalaryLines || [])
      .filter((l: any) => (l.tenant_id === tenantId || !l.tenant_id) && (l.employee_id === employeeId || l.employee_code === employeeId));

    res.json({
      success: true,
      structuresHistory,
      monthlyPayrollHistory,
      projectSalaryLines,
      history: structuresHistory,
    });
  });

  router.get('/employee-payroll-360/:employeeId', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const { employeeId } = req.params;

    const emp = (db.masterEmployees || []).find(
      (e: any) => (e.tenant_id === tenantId || !e.tenant_id) && (e.id === employeeId || e.employee_code === employeeId)
    );

    const projectSalaryLines = (db.projectSalaryLines || [])
      .filter((l: any) => (l.tenant_id === tenantId || !l.tenant_id) && (l.employee_id === employeeId || l.employee_code === employeeId));

    const monthlyRecords = (db.payrollRecords || [])
      .filter((r: any) => (r.tenant_id === tenantId || !r.tenant_id) && (r.employee_id === employeeId || r.employee_code === employeeId));

    // Group by month
    const monthMap: Record<string, any> = {};

    for (const psl of projectSalaryLines) {
      const m = psl.payroll_month || psl.payroll_period || (psl.from_date ? psl.from_date.slice(0, 7) : '2026-08');
      if (!monthMap[m]) {
        monthMap[m] = {
          month: m,
          project_lines: [],
          total_units: 0,
          gross_earnings: 0,
          allowances: 0,
          incentives: 0,
          deductions: 0,
          net_payable: 0,
          records: [],
        };
      }
      monthMap[m].project_lines.push(psl);
      monthMap[m].total_units += Number(psl.units_completed || 0);
      monthMap[m].gross_earnings += Number(psl.gross_earnings || psl.gross_project_earning || 0);
      monthMap[m].allowances += Number(psl.allowance || psl.allowances || 0);
      monthMap[m].incentives += Number(psl.incentive || psl.incentives || 0);
      monthMap[m].deductions += Number(psl.deduction || psl.project_penalties || 0);
      monthMap[m].net_payable += Number(psl.net_project_amount || psl.net_payable || psl.net_project_earning || 0);
    }

    for (const rec of monthlyRecords) {
      const m = rec.payroll_month || rec.payroll_period_id?.replace('pp_', '').replace('_', '-') || '2026-08';
      if (!monthMap[m]) {
        monthMap[m] = {
          month: m,
          project_lines: [],
          total_units: 0,
          gross_earnings: Number(rec.gross_salary || 0),
          allowances: Number(rec.allowances || 0),
          incentives: 0,
          deductions: Number(rec.total_deductions || 0),
          net_payable: Number(rec.net_salary || 0),
          records: [rec],
        };
      } else {
        monthMap[m].records.push(rec);
      }
    }

    const months = Object.values(monthMap).sort((a: any, b: any) => b.month.localeCompare(a.month));

    res.json({
      success: true,
      employee: emp ? {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        current_status: emp.current_status,
      } : null,
      months,
      projectSalaryLines,
      monthlyRecords,
    });
  });

  // ---------------------------------------------------------------------------
  // 15c. FINAL SETTLEMENTS & GRATUITY
  // ---------------------------------------------------------------------------
  router.get('/final-settlements', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const list = isSuperAdmin ? db.finalSettlements || [] : (db.finalSettlements || []).filter((s: any) => s.tenant_id === tenantId);
    res.json({ success: true, settlements: list });
  });

  router.get('/final-settlement', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const query = (req.query.query as string) || '';
    const exitType = (req.query.exitType as string) || 'Resignation';

    const emp = (db.masterEmployees || []).find(
      (e: any) => e.tenant_id === tenantId && (e.id === query || e.employee_code === query || e.full_name?.toLowerCase().includes(query.toLowerCase()))
    ) || db.masterEmployees?.[0];

    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const joinDate = new Date(emp.joining_date || '2024-01-01');
    const exDate = new Date();
    const diffDays = Math.max(1, Math.ceil((exDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
    const tenureYears = Number((diffDays / 365.25).toFixed(2));
    const baseSalary = emp.basic_salary || 2500;
    const dailyRate = baseSalary / 30;

    let gratuity = 0;
    if (tenureYears >= 1) {
      if (tenureYears <= 5) {
        gratuity = tenureYears * (dailyRate * 21);
      } else {
        gratuity = (5 * 21 * dailyRate) + ((tenureYears - 5) * 30 * dailyRate);
      }
    }

    const daysInExitMonth = exDate.getDate();
    const proratedSalary = Math.round(dailyRate * daysInExitMonth);
    const leaveEncashment = Math.round(dailyRate * 10);
    const grossEntitlement = proratedSalary + leaveEncashment + gratuity;
    const netFinalSettlement = grossEntitlement;

    res.json({
      success: true,
      settlement: {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.full_name,
        joining_date: emp.joining_date || '2024-01-01',
        exit_date: exDate.toISOString().substring(0, 10),
        exit_type: exitType,
        total_tenure_years: tenureYears,
        base_salary: baseSalary,
        gratuity_amount: Math.round(gratuity),
        prorated_salary: proratedSalary,
        leave_encashment: leaveEncashment,
        gross_entitlement: Math.round(grossEntitlement),
        total_deductions: 0,
        net_final_settlement: Math.round(netFinalSettlement),
      },
    });
  });

  // ---------------------------------------------------------------------------
  // 16. WPS / SIF EXPORT (CBUAE Standard File Generation)
  // ---------------------------------------------------------------------------
  router.get('/periods/:id/wps-export', (req: Request, res: Response) => {
    const { tenantId } = getContext(req);
    const { id } = req.params;

    const period = (db.payrollPeriods || []).find(
      (p: any) => p.tenant_id === tenantId && (p.id === id || p.period_key === id)
    );
    if (!period) {
      return res.status(404).json({ success: false, message: 'Payroll period not found.' });
    }

    const records = (db.payrollRecords || []).filter(
      (r: any) => r.tenant_id === tenantId && (r.payroll_period_id === period.id || r.period_key === period.period_key)
    );

    const employerCrn = '1002948210';
    const bankRoutingCode = 'EBIUAEA';
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');
    const timeStr = '120000';
    const fileHeader = `SCR,${employerCrn},${bankRoutingCode},${dateStr},${timeStr},${records.length},${period.total_net_payable.toFixed(2)},AED,${period.period_key}`;

    const bodyLines = records.map((r: any) => {
      const routingCode = '026';
      const iban = r.iban || 'AE0000000000000000000';
      const payStartDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
      const payEndDate = `${period.year}-${String(period.month).padStart(2, '0')}-${daysIn(period.year, period.month)}`;
      const fixedPay = (r.prorated_base_salary || 0).toFixed(2);
      const varPay = (r.total_allowances || 0).toFixed(2);
      const netPay = (r.net_salary || 0).toFixed(2);
      return `EDR,${r.employee_code},${routingCode},${iban},${payStartDate},${payEndDate},${r.days_worked || 26},${fixedPay},${varPay},${netPay},0.00`;
    });

    const sifContent = [fileHeader, ...bodyLines].join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=SIF_${period.period_key}_${employerCrn}.sif`);
    res.send(sifContent);
  });

  // ---------------------------------------------------------------------------
  // 17. EMPLOYEE PORTAL MY SALARY (Enforcing RBAC & Published Only)
  // ---------------------------------------------------------------------------
  router.get('/my-salary', (req: Request, res: Response) => {
    const { tenantId, userId, userRole } = getContext(req);

    // Identify employee record for this user
    let emp = (db.masterEmployees || []).find(
      (e: any) =>
        e.tenant_id === tenantId &&
        (e.id === userId || e.user_id === userId || e.employee_code === userId)
    );

    // If caller is admin, allow viewing test employee (e.g. emp_01)
    if (!emp && (userRole === 'COMPANY_ADMIN' || userRole === 'SUPER_ADMIN')) {
      const requestedEmpId = req.query.employeeId as string;
      emp = (db.masterEmployees || []).find(
        (e: any) =>
          e.tenant_id === tenantId &&
          (e.id === requestedEmpId || e.employee_code === requestedEmpId || e.id === 'emp_01')
      );
    }

    if (!emp) {
      return res.status(404).json({ success: false, message: 'Employee profile not found.' });
    }

    // RBAC: Riders can ONLY see their own records, and ONLY PUBLISHED/PAID periods
    const records = (db.payrollRecords || []).filter(
      (r: any) =>
        r.tenant_id === tenantId &&
        r.employee_id === emp.id &&
        (r.status === 'PUBLISHED' || r.status === 'PAID')
    );

    res.json({
      success: true,
      employee: {
        id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        designation: emp.designation,
        department: emp.department,
        project_name: emp.project_name,
      },
      salaries: records.sort((a: any, b: any) => (b.year * 12 + b.month) - (a.year * 12 + a.month)),
    });
  });

  // ---------------------------------------------------------------------------
  // 17b. INDIVIDUAL PAYROLL RECORD DETAIL
  // ---------------------------------------------------------------------------
  router.get('/records/:id', (req: Request, res: Response) => {
    const { tenantId, userId, userRole, isSuperAdmin } = getContext(req);
    const { id } = req.params;

    const record = (db.payrollRecords || []).find(
      (r: any) =>
        (isSuperAdmin || r.tenant_id === tenantId) &&
        (r.id === id || r.employee_id === id || r.employee_code === id)
    );

    if (!record) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    res.json({
      success: true,
      record,
      payslip: record,
    });
  });

  // ---------------------------------------------------------------------------
  // 18. INDIVIDUAL PAYSLIP DATA (With Full Project Breakdown & Deductions)
  // ---------------------------------------------------------------------------
  router.get('/records/:id/payslip', (req: Request, res: Response) => {
    const { tenantId, userId, userRole, isSuperAdmin } = getContext(req);
    const { id } = req.params;

    const record = (db.payrollRecords || []).find(
      (r: any) =>
        (isSuperAdmin || r.tenant_id === tenantId) &&
        (r.id === id || r.employee_id === id || r.employee_code === id)
    );

    if (!record) {
      return res.status(404).json({ success: false, message: 'Payroll record not found.' });
    }

    // RBAC: If user is rider, they can ONLY access their own record AND only if published
    if (userRole === 'RIDER' && record.employee_id !== userId && record.employee_code !== userId) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Access denied: You cannot view payroll slips of other employees.',
      });
    }

    if (userRole === 'RIDER' && record.status !== 'PUBLISHED' && record.status !== 'PAID') {
      return res.status(403).json({
        success: false,
        code: 'NOT_PUBLISHED',
        message: 'This payroll period has not been published yet.',
      });
    }

    // Return complete itemized payslip model
    res.json({
      success: true,
      company: {
        name: 'ALLIED FLEET & DELIVERY SERVICES L.L.C.',
        address: 'Al Quoz Industrial Area 3, P.O. Box 88921, Dubai, UAE',
        tax_id: 'TRN-100294821000003',
        license: 'DED-882104',
      },
      payslip: record,
    });
  });

  // ---------------------------------------------------------------------------
  // 19. PROJECT IMPORT PROFILES (Single Payroll Engine, Configurable Source Formats)
  // ---------------------------------------------------------------------------
  router.get('/import-profiles', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const profiles = (db.projectImportProfiles || []).filter(
      (p: any) => isSuperAdmin || p.tenant_id === tenantId
    );
    res.json({ success: true, profiles });
  });

  router.get('/import-profiles/:id', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const { id } = req.params;
    const profile = (db.projectImportProfiles || []).find(
      (p: any) => (isSuperAdmin || p.tenant_id === tenantId) && (p.id === id || p.salary_group === id)
    );
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Project import profile not found.' });
    }
    res.json({ success: true, profile });
  });

  router.post('/import-profiles', (req: Request, res: Response) => {
    const { tenantId, userName, userRole } = getContext(req);
    const {
      project_id,
      project_name,
      salary_group,
      profile_name,
      source_type,
      calculation_method,
      required_columns,
      optional_columns,
      status,
      notes,
    } = req.body;

    if (!project_id || !salary_group || !source_type) {
      return res.status(400).json({
        success: false,
        message: 'project_id, salary_group, and source_type are required.',
      });
    }

    if (!db.projectImportProfiles) db.projectImportProfiles = [];

    const existingIdx = db.projectImportProfiles.findIndex(
      (p: any) => p.tenant_id === tenantId && (p.project_id === project_id || p.salary_group === salary_group)
    );

    const newProfile: ProjectImportProfile = {
      id: existingIdx >= 0 ? db.projectImportProfiles[existingIdx].id : `pip_${Date.now()}`,
      tenant_id: tenantId,
      project_id,
      project_name: project_name || project_id,
      salary_group,
      profile_name: profile_name || `${salary_group} Source Profile`,
      source_type: source_type as PayrollSourceType,
      status: status || 'WAITING_FOR_SOURCE_FORMAT',
      status_note: notes || '',
      accepted_file_types: ['.csv', '.xlsx', '.xls'],
      header_row: 1,
      column_mapping: {},
      required_columns: required_columns || [],
      employee_resolver_priority: ['EMPLOYEE_CODE', 'EMIRATES_ID', 'PROJECT_RIDER_ID'],
      calculation_rules: {
        method: salary_group === 'LABOUR' ? 'HOURLY' : 'CLIENT_SPECIFIED_UNCONFIGURED',
        formula_description: calculation_method || (salary_group === 'LABOUR' ? 'Working Hours × Hourly Rate' : 'Pending client timesheet specification'),
      },
      validation_rules: {
        max_hours_warning: 320,
        allow_unresolved_employees: false,
        recalculate_totals: true,
      },
      duplicate_key_fields: ['employee_id', 'work_from', 'work_to'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.projectImportProfiles[existingIdx] = newProfile;
    } else {
      db.projectImportProfiles.push(newProfile);
    }

    res.json({
      success: true,
      message: `Import profile for ${newProfile.salary_group} saved successfully (Status: ${newProfile.status}).`,
      profile: newProfile,
    });
  });

  // ---------------------------------------------------------------------------
  // 20. PROJECT RIDER MAPPINGS (External Rider ID <-> Internal Employee Code)
  // ---------------------------------------------------------------------------
  router.get('/rider-mappings', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const { project_id, employee_id } = req.query;

    let mappings = (db.projectRiderMappings || []).filter(
      (m: any) => isSuperAdmin || m.tenant_id === tenantId
    );

    if (project_id) {
      mappings = mappings.filter((m: any) => m.project_id === project_id);
    }
    if (employee_id) {
      mappings = mappings.filter((m: any) => m.employee_id === employee_id);
    }

    res.json({ success: true, mappings });
  });

  router.post('/rider-mappings', (req: Request, res: Response) => {
    const { tenantId, userName } = getContext(req);
    const {
      project_id,
      project_name,
      external_rider_id,
      employee_id,
      employee_code,
      effective_from,
      effective_to,
      notes,
    } = req.body;

    if (!project_id || !external_rider_id || (!employee_id && !employee_code)) {
      return res.status(400).json({
        success: false,
        message: 'project_id, external_rider_id, and employee_id or employee_code are required.',
      });
    }

    // Verify employee
    const emp = (db.masterEmployees || []).find(
      (e: any) =>
        e.tenant_id === tenantId &&
        (e.id === employee_id || e.employee_code?.toLowerCase() === employee_code?.toLowerCase())
    );

    if (!emp) {
      return res.status(404).json({
        success: false,
        message: `Employee not found with id '${employee_id}' or code '${employee_code}'.`,
      });
    }

    if (!db.projectRiderMappings) db.projectRiderMappings = [];

    // Check duplicate mapping
    const existing = db.projectRiderMappings.find(
      (m: any) =>
        m.tenant_id === tenantId &&
        m.project_id === project_id &&
        m.external_rider_id.toLowerCase() === external_rider_id.toLowerCase()
    );

    if (existing) {
      existing.employee_id = emp.id;
      existing.employee_code = emp.employee_code;
      existing.effective_from = effective_from || existing.effective_from;
      existing.effective_to = effective_to || existing.effective_to;
      existing.notes = notes || existing.notes;
      existing.status = 'ACTIVE';

      return res.json({
        success: true,
        message: `Updated rider mapping for ${external_rider_id} -> ${emp.employee_code}.`,
        mapping: existing,
      });
    }

    const mapping: ProjectRiderMapping = {
      id: `prm_${Date.now()}_${emp.id}`,
      tenant_id: tenantId,
      project_id,
      project_name: project_name || project_id,
      external_rider_id,
      employee_id: emp.id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    db.projectRiderMappings.push(mapping);

    res.json({
      success: true,
      message: `Created rider mapping: ${external_rider_id} -> ${emp.employee_code} (${emp.full_name}).`,
      mapping,
    });
  });

  router.delete('/rider-mappings/:id', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const { id } = req.params;

    if (!db.projectRiderMappings) db.projectRiderMappings = [];

    const idx = db.projectRiderMappings.findIndex(
      (m: any) => (isSuperAdmin || m.tenant_id === tenantId) && m.id === id
    );

    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Rider mapping not found.' });
    }

    db.projectRiderMappings.splice(idx, 1);
    res.json({ success: true, message: 'Rider mapping deleted successfully.' });
  });

  // ---------------------------------------------------------------------------
  // 12. ALLIED PARTNER WORKBOOK IMPORT (ALLIED_DELIVERY_PARTNER_PAYOUT_V1)
  // ---------------------------------------------------------------------------

  // Parse partner workbook and generate authoritative preview & reconciliation
  router.post('/partner-workbook/parse', (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = getContext(req);
      const { month = '2026-08', fileBase64, fileName, useDefaultSample = true } = req.body;

      let buffer: Buffer;
      let effectiveFileName = fileName || 'Pixel Syntax Delivery Software.xlsx';

      if (fileBase64) {
        buffer = Buffer.from(fileBase64, 'base64');
      } else if (useDefaultSample) {
        const samplePath = path.resolve(process.cwd(), 'Pixel Syntax Delivery Software.xlsx');
        if (!fs.existsSync(samplePath)) {
          return res.status(404).json({
            success: false,
            message: `Sample workbook not found at ${samplePath}. Please upload a workbook.`,
          });
        }
        buffer = fs.readFileSync(samplePath);
        effectiveFileName = 'Pixel Syntax Delivery Software.xlsx';
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either fileBase64 or useDefaultSample must be provided.',
        });
      }

      const parseResult = parseAlliedPartnerWorkbook(buffer, tenantId, month, db);

      // Check if this exact file has already been committed for this tenant and month
      if (!db.partnerWorkbookBatches) db.partnerWorkbookBatches = [];
      const duplicateBatch = db.partnerWorkbookBatches.find(
        (b: any) =>
          b.tenant_id === tenantId &&
          b.file_hash === parseResult.fileHash &&
          b.payroll_month === month &&
          b.status === 'COMMITTED'
      );

      let duplicateWarning: string | null = null;
      if (duplicateBatch) {
        duplicateWarning = `DUPLICATE_WORKBOOK: This exact workbook has already been imported and committed by ${duplicateBatch.uploaded_by} on ${duplicateBatch.uploaded_at}.`;
      }

      res.json({
        success: true,
        fileName: effectiveFileName,
        fileHash: parseResult.fileHash,
        isDuplicateCommitted: !!duplicateBatch,
        duplicateWarning,
        data: parseResult,
      });
    } catch (err: any) {
      console.error('Error parsing partner workbook:', err);
      res.status(500).json({
        success: false,
        message: `Failed to parse partner workbook: ${err.message}`,
      });
    }
  });

  // Commit partner workbook batch into unified payroll engine
  router.post('/partner-workbook/commit', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, userRole } = getContext(req);
      const {
        batchId,
        fileName,
        fileHash,
        month = '2026-08',
        sourcePeriodStart,
        sourcePeriodEnd,
        resolvedRows = [],
        reconciliation,
      } = req.body;

      if (!fileHash || !resolvedRows.length) {
        return res.status(400).json({
          success: false,
          message: 'File hash and resolved rows are required to commit.',
        });
      }

      if (!db.partnerWorkbookBatches) db.partnerWorkbookBatches = [];

      // Check if already committed
      const existing = db.partnerWorkbookBatches.find(
        (b: any) =>
          b.tenant_id === tenantId &&
          b.file_hash === fileHash &&
          b.payroll_month === month &&
          b.status === 'COMMITTED'
      );

      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'DUPLICATE_WORKBOOK',
          message: `This workbook has already been committed as batch ${existing.batch_id}. Use rollback or re-open before importing again.`,
        });
      }

      const effectiveBatchId = batchId || `pwb_${Date.now()}`;
      const nowIso = new Date().toISOString();

      if (!db.projectSalaryLines) db.projectSalaryLines = [];

      let linesAdded = 0;
      let totalAmountFils = 0;

      for (const row of resolvedRows) {
        if (!row.employee_id) continue;

        // Clean out any previous lines from this exact batch
        db.projectSalaryLines = db.projectSalaryLines.filter(
          (l: any) => !(l.employee_id === row.employee_id && l.source_batch_id === effectiveBatchId)
        );

        const grossFils = toFils(row.final_source_earning);
        totalAmountFils += grossFils;

        const psl: ProjectSalaryLine = {
          id: `psl_allied_${Date.now()}_${row.employee_id}`,
          employee_id: row.employee_id,
          payroll_period_id: `pp_${month.replace('-', '_')}`,
          project_id: 'proj_allied_partner',
          project_name: 'Allied Delivery Services Partner Payout',
          salary_group: 'ALLIED_DELIVERY_PARTNER_PAYOUT_V1',
          calculation_method: 'PER_DELIVERY',
          from_date: sourcePeriodStart || `${month}-01`,
          to_date: sourcePeriodEnd || `${month}-30`,
          work_from: sourcePeriodStart || `${month}-01`,
          work_to: sourcePeriodEnd || `${month}-30`,
          units_completed: row.orders || 0,
          gross_earnings: row.actual_earnings + (row.mg || 0) + (row.additional_earnings || 0),
          gross_project_earning: row.actual_earnings + (row.mg || 0) + (row.additional_earnings || 0),
          allowance: row.additional_earnings || 0,
          allowances: row.additional_earnings || 0,
          incentive: row.mg || 0,
          incentives: row.mg || 0,
          deduction: row.source_deductions || 0,
          project_penalties: row.source_deductions || 0,
          net_project_amount: row.final_source_earning,
          net_project_earning: row.final_source_earning,
          source_total: row.final_source_earning,
          source_batch_id: effectiveBatchId,
          source_row_reference: row.external_rider_id,
          source_metrics_json: {
            external_rider_id: row.external_rider_id,
            payout_mapping: row.payout_mapping,
            orders: row.orders,
            actual_earnings: row.actual_earnings,
            mg: row.mg,
            additional_earnings: row.additional_earnings,
            source_deductions: row.source_deductions,
            final_source_earning: row.final_source_earning,
            is_negative_earning: row.is_negative_earning,
            supporting_details: row.supporting_details,
          },
          notes: `Delivery partner payout for ${row.payout_mapping} (Rider: ${row.external_rider_id}).`,
        };

        db.projectSalaryLines.push(psl);
        linesAdded++;
      }

      // Record batch in audit database
      const newBatch = {
        batch_id: effectiveBatchId,
        tenant_id: tenantId,
        original_file_name: fileName || 'Pixel Syntax Delivery Software.xlsx',
        file_hash: fileHash,
        uploaded_by: userName || 'Admin',
        uploaded_at: nowIso,
        source_profile: 'ALLIED_DELIVERY_PARTNER_PAYOUT_V1',
        source_period_start: sourcePeriodStart,
        source_period_end: sourcePeriodEnd,
        payroll_month: month,
        total_riders_found: resolvedRows.length,
        lines_committed: linesAdded,
        total_committed_aed: fromFils(totalAmountFils),
        reconciliation: reconciliation || null,
        status: 'COMMITTED',
      };

      db.partnerWorkbookBatches.push(newBatch);

      // Add to audit trail
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.push({
        id: `aud_${Date.now()}`,
        tenant_id: tenantId,
        user_id: userId || 'usr_admin',
        user_name: userName || 'Admin',
        user_role: userRole || 'SUPER_ADMIN',
        action: 'COMMIT_PARTNER_WORKBOOK',
        entity_type: 'PAYROLL_IMPORT_BATCH',
        entity_id: effectiveBatchId,
        details: `Committed partner workbook '${newBatch.original_file_name}' for ${month}. ${linesAdded} rider lines committed (Total: AED ${newBatch.total_committed_aed}).`,
        timestamp: nowIso,
      });

      res.json({
        success: true,
        message: `Successfully committed ${linesAdded} partner payout lines for period ${month}.`,
        batch: newBatch,
      });
    } catch (err: any) {
      console.error('Error committing partner workbook:', err);
      res.status(500).json({
        success: false,
        message: `Failed to commit partner workbook: ${err.message}`,
      });
    }
  });

  // Get partner workbook batches
  router.get('/partner-workbook/batches', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const batches = (db.partnerWorkbookBatches || []).filter(
      (b: any) => isSuperAdmin || b.tenant_id === tenantId
    );
    res.json({ success: true, batches });
  });

  // Download / inspect sample partner workbook
  router.get('/partner-workbook/sample-file', (req: Request, res: Response) => {
    const samplePath = path.resolve(process.cwd(), 'Pixel Syntax Delivery Software.xlsx');
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ success: false, message: 'Sample file not found.' });
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Pixel Syntax Delivery Software.xlsx"'
    );
    fs.createReadStream(samplePath).pipe(res);
  });

  // ---------------------------------------------------------------------------
  // 13. NOON EXCEL PAYROLL TEMPLATE & IMPORT (NOON_Payroll_Template.xlsx)
  // ---------------------------------------------------------------------------

  // 1. Download official Noon Excel template (.xlsx)
  router.get('/templates/noon', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = getContext(req);
      const month = (req.query.month as string) || '2026-08';

      const buffer = await generateNoonExcelTemplate(db, tenantId, month, userName);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="NOON_Payroll_Template.xlsx"'
      );
      res.send(buffer);
    } catch (err: any) {
      console.error('Error generating Noon Excel template:', err);
      res.status(500).json({
        success: false,
        message: `Failed to generate Noon Excel template: ${err.message}`,
      });
    }
  });

  // 2. Parse and validate uploaded Noon Excel workbook
  router.post('/import/noon/validate', async (req: Request, res: Response) => {
    try {
      const actor = getContext(req);
      const { month = '2026-08', fileBase64, fileName = 'NOON_Payroll_Template.xlsx' } = req.body;

      if (!fileBase64) {
        return res.status(400).json({
          success: false,
          message: 'No fileBase64 provided. Expected base64 encoded .xlsx file buffer.',
        });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await parseAndValidateNoonWorkbook(db, buffer, fileName, month, actor);
      res.json(result);
    } catch (err: any) {
      console.error('Error validating Noon workbook:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to parse and validate Noon workbook.',
      });
    }
  });

  // 3. Commit validated Noon payroll batch
  router.post('/import/noon/commit', (req: Request, res: Response) => {
    try {
      const actor = getContext(req);
      const {
        month = '2026-08',
        fileName = 'NOON_Payroll_Template.xlsx',
        fileHash,
        rows = [],
        reconciliation,
      } = req.body;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No rows provided to commit.',
        });
      }

      const result = commitNoonPayrollBatch(
        db,
        actor.tenantId,
        month,
        { fileName, fileHash, rows, reconciliation },
        actor
      );

      res.json(result);
    } catch (err: any) {
      console.error('Error committing Noon payroll batch:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to commit Noon payroll batch.',
      });
    }
  });

  // ---------------------------------------------------------------------------
  // 13b. KEETA EXCEL PAYROLL TEMPLATE & IMPORT (KEETA_Payroll_Template.xlsx)
  // ---------------------------------------------------------------------------

  // 1. Download official Keeta Excel template (.xlsx)
  router.get('/templates/keeta', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = getContext(req);
      const month = (req.query.month as string) || '2026-08';

      const buffer = await generateKeetaExcelTemplate(db, tenantId, month, userName);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="KEETA_Payroll_Template.xlsx"'
      );
      res.send(buffer);
    } catch (err: any) {
      console.error('Error generating Keeta Excel template:', err);
      res.status(500).json({
        success: false,
        message: `Failed to generate Keeta Excel template: ${err.message}`,
      });
    }
  });

  // 2. Parse and validate uploaded Keeta Excel workbook
  router.post('/import/keeta/validate', async (req: Request, res: Response) => {
    try {
      const actor = getContext(req);
      const { month = '2026-08', fileBase64, fileName = 'KEETA_Payroll_Template.xlsx' } = req.body;

      if (!fileBase64) {
        return res.status(400).json({
          success: false,
          message: 'No fileBase64 provided. Expected base64 encoded .xlsx file buffer.',
        });
      }

      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await parseAndValidateKeetaWorkbook(db, buffer, fileName, month, actor);
      res.json(result);
    } catch (err: any) {
      console.error('Error validating Keeta workbook:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to parse and validate Keeta workbook.',
      });
    }
  });

  // 3. Commit validated Keeta payroll batch
  router.post('/import/keeta/commit', (req: Request, res: Response) => {
    try {
      const actor = getContext(req);
      const {
        month = '2026-08',
        fileName = 'KEETA_Payroll_Template.xlsx',
        fileHash,
        rows = [],
        reconciliation,
      } = req.body;

      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No rows provided to commit.',
        });
      }

      const result = commitKeetaPayrollBatch(
        db,
        actor.tenantId,
        month,
        { fileName, fileHash, rows, reconciliation },
        actor
      );

      res.json(result);
    } catch (err: any) {
      console.error('Error committing Keeta payroll batch:', err);
      res.status(400).json({
        success: false,
        message: err.message || 'Failed to commit Keeta payroll batch.',
      });
    }
  });

  // 4. Unified single endpoint for Keeta import
  router.post('/import/keeta', async (req: Request, res: Response) => {
    try {
      const actor = getContext(req);
      const { action = 'validate', month = '2026-08', fileBase64, fileName = 'KEETA_Payroll_Template.xlsx', fileHash, rows, reconciliation } = req.body;

      if (action === 'commit') {
        if (!rows || !Array.isArray(rows) || rows.length === 0) {
          return res.status(400).json({ success: false, message: 'No rows provided to commit.' });
        }
        const result = commitKeetaPayrollBatch(
          db,
          actor.tenantId,
          month,
          { fileName, fileHash, rows, reconciliation },
          actor
        );
        return res.json(result);
      }

      if (!fileBase64) {
        return res.status(400).json({ success: false, message: 'No fileBase64 provided.' });
      }
      const buffer = Buffer.from(fileBase64, 'base64');
      const result = await parseAndValidateKeetaWorkbook(db, buffer, fileName, month, actor);
      res.json(result);
    } catch (err: any) {
      console.error('Error processing Keeta import:', err);
      res.status(400).json({ success: false, message: err.message || 'Failed to process Keeta import.' });
    }
  });

  // 5. Get all Keeta project rider mappings
  router.get('/mappings/keeta', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const mappings = (db.projectRiderMappings || []).filter(
      (m: any) =>
        (isSuperAdmin || m.tenant_id === tenantId) &&
        (m.project_id === 'proj_keeta_1' || m.project_name?.toLowerCase().includes('keeta') || m.external_rider_id?.toLowerCase().startsWith('kee-'))
    );
    res.json({ success: true, mappings });
  });

  // 6. Map unmapped Keeta Courier ID to an Allied Employee Master record
  router.post('/mappings/keeta', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, userRole, isSuperAdmin } = getContext(req);
      const { employee_id, external_rider_id, courier_id } = req.body;
      const cleanCourierId = String(courier_id || external_rider_id || '').trim();

      if (!employee_id || !cleanCourierId) {
        return res.status(400).json({
          success: false,
          message: 'employee_id and courier_id are required.',
        });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === employee_id || e.employee_code === employee_id) &&
          (isSuperAdmin || e.tenant_id === tenantId)
      );
      if (!emp) {
        return res.status(404).json({
          success: false,
          message: `Employee '${employee_id}' not found in tenant master records.`,
        });
      }

      if (!db.projectRiderMappings) db.projectRiderMappings = [];

      const existingIndex = db.projectRiderMappings.findIndex(
        (m: any) =>
          m.tenant_id === tenantId &&
          m.external_rider_id === cleanCourierId &&
          (m.project_id === 'proj_keeta_1' || m.project_name?.toLowerCase().includes('keeta'))
      );

      const mappingObj: ProjectRiderMapping = {
        id: existingIndex >= 0 ? db.projectRiderMappings[existingIndex].id : `prm_keeta_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        tenant_id: tenantId,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.full_name,
        project_id: 'proj_keeta_1',
        project_name: 'Keeta Express Delivery',
        external_rider_id: cleanCourierId,
        is_active: true,
        created_at: existingIndex >= 0 ? db.projectRiderMappings[existingIndex].created_at : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        db.projectRiderMappings[existingIndex] = mappingObj;
      } else {
        db.projectRiderMappings.push(mappingObj);
      }

      // Also ensure active EmployeeProjectAssignment is synchronized
      if (!db.employeeProjectAssignments) db.employeeProjectAssignments = [];
      const epaIndex = db.employeeProjectAssignments.findIndex(
        (a: any) =>
          (isSuperAdmin || a.tenant_id === tenantId) &&
          a.external_rider_id === cleanCourierId &&
          (a.project_id === 'proj_keeta_1' || a.project_name?.toLowerCase().includes('keeta')) &&
          a.status === 'ACTIVE'
      );
      if (epaIndex >= 0) {
        db.employeeProjectAssignments[epaIndex].employee_id = emp.id;
        db.employeeProjectAssignments[epaIndex].employee_code = emp.employee_code;
        db.employeeProjectAssignments[epaIndex].employee_name = emp.full_name;
        db.employeeProjectAssignments[epaIndex].updated_at = new Date().toISOString();
      } else {
        db.employeeProjectAssignments.push({
          id: `epa_keeta_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          tenant_id: tenantId,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          project_id: 'proj_keeta_1',
          project_name: 'Keeta Express Delivery',
          external_rider_id: cleanCourierId,
          status: 'ACTIVE',
          effective_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        id: `aud_keeta_${Date.now()}`,
        tenant_id: tenantId,
        user_id: userId || 'usr_admin',
        user_name: userName || 'Admin',
        user_role: userRole || 'SUPER_ADMIN',
        action: 'MAP_KEETA_COURIER_ID',
        entity_type: 'PROJECT_RIDER_MAPPING',
        entity_id: mappingObj.id,
        details: `Mapped Keeta Courier ID '${cleanCourierId}' to employee ${emp.full_name} (${emp.employee_code}) for Keeta Express Delivery.`,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        mapping: mappingObj,
        message: `Successfully mapped Keeta Courier ID '${cleanCourierId}' to ${emp.full_name} (${emp.employee_code}).`,
      });
    } catch (err: any) {
      console.error('Error creating Keeta mapping:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 4. Map unmapped NIM ID to an Allied Employee Master record
  router.post('/mappings/create', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, userRole, isSuperAdmin } = getContext(req);
      const {
        employee_id,
        external_rider_id,
        project_id = 'proj_noon_1',
        project_name = 'Noon Minutes Logistics',
      } = req.body;

      if (!employee_id || !external_rider_id) {
        return res.status(400).json({
          success: false,
          message: 'employee_id and external_rider_id are required.',
        });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === employee_id || e.employee_code === employee_id) &&
          (isSuperAdmin || e.tenant_id === tenantId)
      );
      if (!emp) {
        return res.status(404).json({
          success: false,
          message: `Employee '${employee_id}' not found in tenant master records.`,
        });
      }

      if (!db.projectRiderMappings) db.projectRiderMappings = [];

      const cleanNIM = String(external_rider_id).trim();

      const existingIndex = db.projectRiderMappings.findIndex(
        (m: any) =>
          m.tenant_id === tenantId &&
          m.external_rider_id === cleanNIM &&
          m.project_id === project_id
      );

      const mappingObj: ProjectRiderMapping = {
        id:
          existingIndex >= 0
            ? db.projectRiderMappings[existingIndex].id
            : `prm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        tenant_id: tenantId,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        employee_name: emp.full_name,
        project_id,
        project_name,
        external_rider_id: cleanNIM,
        is_active: true,
        created_at:
          existingIndex >= 0
            ? db.projectRiderMappings[existingIndex].created_at
            : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        db.projectRiderMappings[existingIndex] = mappingObj;
      } else {
        db.projectRiderMappings.push(mappingObj);
      }

      // Also ensure active EmployeeProjectAssignment is synchronized
      if (!db.employeeProjectAssignments) db.employeeProjectAssignments = [];
      const epaIndex = db.employeeProjectAssignments.findIndex(
        (a: any) =>
          (isSuperAdmin || a.tenant_id === tenantId) &&
          a.external_rider_id === cleanNIM &&
          a.project_id === project_id &&
          a.status === 'ACTIVE'
      );
      if (epaIndex >= 0) {
        db.employeeProjectAssignments[epaIndex].employee_id = emp.id;
        db.employeeProjectAssignments[epaIndex].employee_code = emp.employee_code;
        db.employeeProjectAssignments[epaIndex].employee_name = emp.full_name;
        db.employeeProjectAssignments[epaIndex].updated_at = new Date().toISOString();
      } else {
        db.employeeProjectAssignments.push({
          id: `epa_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          tenant_id: tenantId,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name: emp.full_name,
          project_id,
          project_name,
          external_rider_id: cleanNIM,
          status: 'ACTIVE',
          effective_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }

      // Add audit log
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        id: `aud_${Date.now()}`,
        tenant_id: tenantId,
        user_id: userId || 'usr_admin',
        user_name: userName || 'Admin',
        user_role: userRole || 'SUPER_ADMIN',
        action: 'MAP_PROJECT_RIDER_ID',
        entity_type: 'PROJECT_RIDER_MAPPING',
        entity_id: mappingObj.id,
        details: `Mapped NIM ID '${cleanNIM}' to employee ${emp.full_name} (${emp.employee_code}) for ${project_name}.`,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        mapping: mappingObj,
        message: `Successfully mapped NIM ID '${cleanNIM}' to ${emp.full_name} (${emp.employee_code}).`,
      });
    } catch (err: any) {
      console.error('Error creating project rider mapping:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // 5. Get all Noon project rider mappings
  router.get('/mappings/noon', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const mappings = (db.projectRiderMappings || []).filter(
      (m: any) =>
        (isSuperAdmin || m.tenant_id === tenantId) &&
        (m.project_id === 'proj_noon_1' || m.project_name?.includes('Noon'))
    );
    res.json({ success: true, mappings });
  });

  // 6. Get active master employees for mapping resolution
  router.get('/employees', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const employees = (db.masterEmployees || [])
      .filter((e: any) => (isSuperAdmin || e.tenant_id === tenantId) && !e.is_archived)
      .map((e: any) => ({
        id: e.id,
        employee_code: e.employee_code,
        full_name: e.full_name,
        designation: e.designation,
        department: e.department,
        emirates_id: e.emirates_id || e.emirates_id_number,
      }));
    res.json({ success: true, employees });
  });

  // 7. Get live projects for payroll import project selection
  router.get('/projects', (req: Request, res: Response) => {
    const { tenantId, isSuperAdmin } = getContext(req);
    const projects = (db.projects || [])
      .filter((p: any) => (isSuperAdmin || p.tenant_id === tenantId))
      .map((p: any) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        salary_group: p.salary_group || (p.name.toLowerCase().includes('keeta') ? 'KEETA' : p.name.toLowerCase().includes('noon') ? 'NOON' : 'FIXED'),
        import_profile: p.import_profile || p.payroll_import_profile,
        external_id_label: p.external_id_label || (p.name.toLowerCase().includes('keeta') ? 'Courier ID' : p.name.toLowerCase().includes('noon') ? 'NIM ID' : 'External Rider ID'),
        status: p.status || 'ACTIVE',
      }));
    res.json({ success: true, projects });
  });

  function daysIn(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }

  return router;
}
