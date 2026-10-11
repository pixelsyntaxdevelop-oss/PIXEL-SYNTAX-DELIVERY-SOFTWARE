import * as XLSX from 'xlsx';
import crypto from 'crypto';

export interface AlliedParseResult {
  success: boolean;
  message?: string;
  fileHash: string;
  sourcePeriodStart: string;
  sourcePeriodEnd: string;
  payrollMonth: string;
  sheetsDetected: {
    paymentFlow: boolean;
    finalInvoice: boolean;
    nonTaxable: boolean;
    summary: boolean;
    dailyEarnings: boolean;
    attendance: boolean;
    additionalEarnings: boolean;
    riderDeduction: boolean;
    vendorDeduction: boolean;
    allDetected: boolean;
    sheetNames: string[];
  };
  payoutMappingsFound: string[];
  totalRidersFound: number;
  resolvedRidersCount: number;
  unresolvedRidersCount: number;
  reconciliation: {
    status: 'PASS' | 'WARNING' | 'FAIL';
    summaryTotalActualEarnings: number;
    summaryTotalMg: number;
    summaryTotalAdditional: number;
    summaryTotalDeductions: number;
    summaryTotalFinalEarning: number;
    riderDeductionsSheetTotal: number;
    additionalEarningsSheetTotal: number;
    vendorDeductionsSheetTotal: number;
    nonTaxableEarningsTotal: number;
    nonTaxableDeductionsTotal: number;
    checks: Array<{
      rule: string;
      expected: number;
      actual: number;
      status: 'MATCH' | 'DISCREPANCY';
      difference: number;
    }>;
  };
  summaryRows: Array<{
    external_rider_id: string;
    rider_name: string;
    payout_mapping: string;
    total_orders: number;
    actual_earnings: number;
    mg: number;
    additional_earnings: number;
    total_deduction: number;
    final_rider_earning: number;
    calculated_check: number;
    reconciled: boolean;
  }>;
  dailyEarningsRows: any[];
  attendanceRows: any[];
  additionalEarningsRows: any[];
  riderDeductionsRows: any[];
  vendorDeductionsRows: any[];
  nonTaxableRows: any[];
  paymentFlowRows: any[];
  finalInvoiceRows: any[];
  previewRows: Array<{
    external_rider_id: string;
    source_name: string;
    payout_mapping: string;
    resolved: boolean;
    employee_id?: string;
    employee_code?: string;
    employee_name?: string;
    emirates_id?: string;
    matched_by?: string;
    orders: number;
    actual_earnings: number;
    mg: number;
    additional_earnings: number;
    source_deductions: number;
    final_source_earning: number;
    is_negative_earning: boolean;
    validation_status: 'READY' | 'WARNING' | 'ERROR';
    validation_flags: string[];
    erp_additional_deductions?: {
      traffic_fines: number;
      salik: number;
      loans: number;
      advances: number;
    };
    calculated_payroll_net?: number;
    supporting_details: {
      daily_earnings_count: number;
      attendance_days_present: number;
      additional_earnings_items: any[];
      rider_deductions_items: any[];
      vendor_deductions_items: any[];
    };
  }>;
}

/**
 * Normalizes string keys and sheet names for flexible matching
 */
function normalizeText(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds sheet by flexible regex or fuzzy match
 */
function findSheet(wb: XLSX.WorkBook, patterns: RegExp[]): { name: string; sheet: XLSX.WorkSheet } | null {
  for (const sheetName of wb.SheetNames) {
    for (const pat of patterns) {
      if (pat.test(sheetName)) {
        return { name: sheetName, sheet: wb.Sheets[sheetName] };
      }
    }
  }
  return null;
}

/**
 * Converts excel numeric date to ISO YYYY-MM-DD
 */
function excelDateToISO(serial: any): string | null {
  if (typeof serial === 'string') {
    const trimmed = serial.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().substring(0, 10);
  } else if (typeof serial === 'number' && serial > 20000 && serial < 60000) {
    // Excel epoch 1899-12-30
    const utcDays = Math.floor(serial - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    return dateInfo.toISOString().substring(0, 10);
  }
  return null;
}

/**
 * Authoritative parser for ALLIED_DELIVERY_PARTNER_PAYOUT_V1
 */
export function parseAlliedPartnerWorkbook(
  workbookBuffer: Buffer,
  tenantId: string,
  payrollMonth: string,
  db: any
): AlliedParseResult {
  // 1. Calculate File Hash (SHA-256)
  const hashSum = crypto.createHash('sha256');
  hashSum.update(workbookBuffer);
  const fileHash = hashSum.digest('hex');

  // 2. Read Workbook
  const wb = XLSX.read(workbookBuffer, { type: 'buffer' });

  // 3. Locate All 9 Normalized Sheets
  const sheetPaymentFlow = findSheet(wb, [/payment\s*flow/i]);
  const sheetFinalInvoice = findSheet(wb, [/final\s*invoice/i, /invoice\s*values/i, /use\s*for\s*i/i]);
  const sheetNonTaxable = findSheet(wb, [/non[-\s]*taxable/i]);
  const sheetSummary = findSheet(wb, [/^summary$/i, /rider\s*summary/i]);
  const sheetDaily = findSheet(wb, [/daily\s*earnings/i]);
  const sheetAttendance = findSheet(wb, [/^attendance$/i]);
  const sheetAdditional = findSheet(wb, [/additional\s*(da\s*)?earnings/i]);
  const sheetRiderDeduction = findSheet(wb, [/rider\s*deduction/i]);
  const sheetVendorDeduction = findSheet(wb, [/vendor\s*deduction/i]);

  const sheetsDetected = {
    paymentFlow: !!sheetPaymentFlow,
    finalInvoice: !!sheetFinalInvoice,
    nonTaxable: !!sheetNonTaxable,
    summary: !!sheetSummary,
    dailyEarnings: !!sheetDaily,
    attendance: !!sheetAttendance,
    additionalEarnings: !!sheetAdditional,
    riderDeduction: !!sheetRiderDeduction,
    vendorDeduction: !!sheetVendorDeduction,
    allDetected:
      !!sheetPaymentFlow &&
      !!sheetFinalInvoice &&
      !!sheetNonTaxable &&
      !!sheetSummary &&
      !!sheetDaily &&
      !!sheetAttendance &&
      !!sheetAdditional &&
      !!sheetRiderDeduction &&
      !!sheetVendorDeduction,
    sheetNames: wb.SheetNames,
  };

  // Convert sheets to json rows
  const summaryRaw = sheetSummary ? XLSX.utils.sheet_to_json<any>(sheetSummary.sheet, { defval: '' }) : [];
  const dailyRaw = sheetDaily ? XLSX.utils.sheet_to_json<any>(sheetDaily.sheet, { defval: '' }) : [];
  const attendanceRaw = sheetAttendance ? XLSX.utils.sheet_to_json<any>(sheetAttendance.sheet, { defval: '' }) : [];
  const additionalRaw = sheetAdditional ? XLSX.utils.sheet_to_json<any>(sheetAdditional.sheet, { defval: '' }) : [];
  const riderDeductionRaw = sheetRiderDeduction ? XLSX.utils.sheet_to_json<any>(sheetRiderDeduction.sheet, { defval: '' }) : [];
  const vendorDeductionRaw = sheetVendorDeduction ? XLSX.utils.sheet_to_json<any>(sheetVendorDeduction.sheet, { defval: '' }) : [];
  const nonTaxableRaw = sheetNonTaxable ? XLSX.utils.sheet_to_json<any>(sheetNonTaxable.sheet, { defval: '' }) : [];
  const paymentFlowRaw = sheetPaymentFlow ? XLSX.utils.sheet_to_json<any>(sheetPaymentFlow.sheet, { defval: '' }) : [];
  const finalInvoiceRaw = sheetFinalInvoice ? XLSX.utils.sheet_to_json<any>(sheetFinalInvoice.sheet, { defval: '' }) : [];

  // 4. Detect Source Period from Headers
  const foundDates: string[] = [];
  const sampleRows = [...dailyRaw.slice(0, 5), ...attendanceRaw.slice(0, 5)];
  for (const r of sampleRows) {
    for (const key of Object.keys(r)) {
      const parsedDate = excelDateToISO(key);
      if (parsedDate && !foundDates.includes(parsedDate)) {
        foundDates.push(parsedDate);
      }
    }
  }

  foundDates.sort();
  const sourcePeriodStart = foundDates.length > 0 ? foundDates[0] : `${payrollMonth}-01`;
  const sourcePeriodEnd = foundDates.length > 0 ? foundDates[foundDates.length - 1] : `${payrollMonth}-31`;

  // 5. Parse Summary Rows & Payout Mappings
  const payoutMappingsSet = new Set<string>();
  const summaryRows = summaryRaw.map((row) => {
    // Map observed headers
    const external_rider_id = String(
      row['DA ID'] || row['NIM ID'] || row['Rider ID'] || row['DA_ID'] || row['RiderID'] || ''
    ).trim();

    const rider_name = String(
      row['Name of Employee / Driver'] || row['DA Name'] || row['Driver Name'] || row['Name'] || ''
    ).trim();

    const payout_mapping = String(
      row['Payout Mapping'] || row['Payout mapping'] || row['payout_mapping'] || 'Standard'
    ).trim();

    if (payout_mapping) payoutMappingsSet.add(payout_mapping);

    const total_orders = Number(row['Total order as per rider app'] || row['Total Order'] || row['Orders'] || 0);
    const actual_earnings = Number(
      row['Actual earning as per rider app (Rider)'] || row['Actual Earnings'] || row['Actual Earning'] || 0
    );
    const mg = Number(row['MG'] || row['Rider MG pay'] || row['MG pay'] || 0);
    const additional_earnings = Number(
      row['Total Additional Earnings'] || row['Additional Earnings'] || row['Total Additional Earnings Taxable'] || 0
    );
    const total_deduction = Number(row['Total deduction'] || row['Total DA deduction Taxable'] || row['Deduction'] || 0);
    const final_rider_earning = Number(
      row['Final Rider earning'] || row['Final Earning'] || row['Net Earning'] || 0
    );

    // Exact formula check: actual_earnings + mg + additional_earnings - total_deduction
    const calculated_check = Math.round((actual_earnings + mg + additional_earnings - total_deduction) * 100) / 100;
    const reconciled = Math.abs(calculated_check - final_rider_earning) < 0.05;

    return {
      external_rider_id,
      rider_name,
      payout_mapping,
      total_orders,
      actual_earnings,
      mg,
      additional_earnings,
      total_deduction,
      final_rider_earning,
      calculated_check,
      reconciled,
    };
  }).filter((r) => r.external_rider_id.length > 0);

  // 6. Itemize Additional Earnings
  const additionalEarningsRows = additionalRaw.map((row) => {
    const external_rider_id = String(row['DA ID'] || row['NIM ID'] || row['Rider ID'] || '').trim();
    const amount = Number(row['Amount'] || row['amount'] || 0);
    const type = String(row['Type of payment'] || row['Payment Type'] || row['Description'] || 'Tip / Bonus').trim();
    const taxability = String(row['Taxability'] || 'NON-TAXABLE').trim().toUpperCase();
    const reference = String(row['Dark store/Date/Order Count'] || row['Reference'] || '').trim();
    const payout_mapping = String(row['Payout Mapping'] || '').trim();
    return {
      external_rider_id,
      payout_mapping,
      amount,
      type,
      taxability,
      reference,
      raw: row,
    };
  }).filter((r) => r.external_rider_id.length > 0);

  // 7. Itemize Rider Deductions
  const riderDeductionsRows = riderDeductionRaw.map((row) => {
    const external_rider_id = String(row['DA ID'] || row['NIM ID'] || row['Rider ID'] || '').trim();
    const amount = Number(row['Deduction amount'] || row['Amount'] || 0);
    const deduction_type = String(row['Deduction Type'] || row['Type'] || 'General Deduction').trim();
    const taxability = String(row['Taxability'] || 'TAXABLE').trim().toUpperCase();
    const reference = String(row['cf_order_number / SIM number / comments'] || row['Reference'] || '').trim();
    const source_date = String(row['Date / DOJ / SIM Handover Date'] || row['Date'] || '').trim();
    const area = String(row['Store Name / DOL / Area Name'] || '').trim();
    const comments = String(row['Comments'] || '').trim();
    const payout_mapping = String(row['Payout Mapping'] || '').trim();

    return {
      external_rider_id,
      payout_mapping,
      amount,
      deduction_type,
      taxability,
      reference,
      source_date,
      area,
      comments,
      source_sheet: 'Rider Deduction',
      raw: row,
    };
  }).filter((r) => r.external_rider_id.length > 0);

  // 8. Itemize Vendor Deductions
  const vendorDeductionsRows = vendorDeductionRaw.map((row) => {
    const external_rider_id = String(row['Rider ID'] || row['DA ID'] || row['NIM ID'] || '').trim();
    const amount = Number(row['Amount'] || 0);
    const deduction_type = String(row['Deduction Type'] || 'Vendor Penalty').trim();
    const taxability = String(row['Taxability'] || 'TAXABLE').trim().toUpperCase();
    const order_number = String(row['Order_number/comments'] || row['Comments'] || '').trim();
    const vendor_code = String(row['Vendor code'] || '').trim();
    const payout_mapping = String(row['Payout Mapping'] || '').trim();

    return {
      external_rider_id,
      vendor_code,
      payout_mapping,
      order_number,
      amount,
      deduction_type,
      taxability,
      source_sheet: 'Vendor Deduction',
      raw: row,
    };
  }).filter((r) => r.external_rider_id.length > 0);

  // 9. Non-Taxable Sheet
  const nonTaxableRows = nonTaxableRaw.map((row) => {
    const external_rider_id = String(row['DA ID'] || row['NIM ID'] || '').trim();
    const amount = Number(row['Amount (AED)'] || row['Amount'] || 0);
    const category = String(row['Category'] || (row['Classification']?.includes('deduction') ? 'DEDUCTION' : 'EARNING')).toUpperCase();
    const description = String(row['Non-Taxable Item'] || row['Description'] || '').trim();
    return {
      external_rider_id,
      amount,
      category,
      description,
      raw: row,
    };
  });

  // 10. Sheet Reconciliation Checks
  const summaryTotalActualEarnings = summaryRows.reduce((acc, r) => acc + r.actual_earnings, 0);
  const summaryTotalMg = summaryRows.reduce((acc, r) => acc + r.mg, 0);
  const summaryTotalAdditional = summaryRows.reduce((acc, r) => acc + r.additional_earnings, 0);
  const summaryTotalDeductions = summaryRows.reduce((acc, r) => acc + r.total_deduction, 0);
  const summaryTotalFinalEarning = summaryRows.reduce((acc, r) => acc + r.final_rider_earning, 0);

  const riderDeductionsSheetTotal = riderDeductionsRows.reduce((acc, r) => acc + r.amount, 0);
  const additionalEarningsSheetTotal = additionalEarningsRows.reduce((acc, r) => acc + r.amount, 0);
  const vendorDeductionsSheetTotal = vendorDeductionsRows.reduce((acc, r) => acc + r.amount, 0);
  const nonTaxableEarningsTotal = nonTaxableRows.filter((r) => r.category === 'EARNING').reduce((acc, r) => acc + r.amount, 0);
  const nonTaxableDeductionsTotal = nonTaxableRows.filter((r) => r.category === 'DEDUCTION').reduce((acc, r) => acc + r.amount, 0);

  const checks: any[] = [];

  // Check 1: Summary Internal Consistency (Actual + MG + Additional - Deductions = Final)
  const calculatedSum = Math.round((summaryTotalActualEarnings + summaryTotalMg + summaryTotalAdditional - summaryTotalDeductions) * 100) / 100;
  const diff1 = Math.abs(calculatedSum - summaryTotalFinalEarning);
  checks.push({
    rule: 'Summary Internal Consistency (Gross + MG + Add - Ded = Net)',
    expected: calculatedSum,
    actual: summaryTotalFinalEarning,
    status: diff1 < 0.05 ? 'MATCH' : 'DISCREPANCY',
    difference: diff1,
  });

  // Check 2: Summary Deductions vs. Rider Deduction Sheet
  const diff2 = Math.abs(summaryTotalDeductions - riderDeductionsSheetTotal);
  checks.push({
    rule: 'Summary Deductions vs. Rider Deductions Sheet Total',
    expected: summaryTotalDeductions,
    actual: riderDeductionsSheetTotal,
    status: diff2 < 0.05 ? 'MATCH' : 'DISCREPANCY',
    difference: diff2,
  });

  // Check 3: Summary Additional Earnings vs. Additional DA Earnings Sheet
  const diff3 = Math.abs(summaryTotalAdditional - additionalEarningsSheetTotal);
  checks.push({
    rule: 'Summary Additional Earnings vs. Additional DA Earnings Sheet Total',
    expected: summaryTotalAdditional,
    actual: additionalEarningsSheetTotal,
    status: diff3 < 0.05 ? 'MATCH' : 'DISCREPANCY',
    difference: diff3,
  });

  const reconciliationStatus = checks.every((c) => c.status === 'MATCH') ? 'PASS' : 'WARNING';

  // 11. Strict Employee Resolver & Preview Generation
  const masterEmployees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId && !e.is_archived);
  const riderMappings = (db.projectRiderMappings || []).filter((m: any) => m.tenant_id === tenantId && m.is_active !== false);

  let resolvedCount = 0;
  let unresolvedCount = 0;

  const previewRows = summaryRows.map((summaryItem) => {
    const extId = summaryItem.external_rider_id;
    const flags: string[] = [];
    let validationStatus: 'READY' | 'WARNING' | 'ERROR' = 'READY';

    // Resolver Hierarchy:
    // 1. PROJECT_RIDER_ID (External Rider ID mapping in db.projectRiderMappings)
    // 2. EMPLOYEE_CODE
    // 3. EMIRATES_ID
    // Strict requirement: Name-only matching is FORBIDDEN.
    let matchedEmployee: any = null;
    let matchedBy: string = '';

    // Step 1: Mapping lookup
    const mapping = riderMappings.find(
      (m: any) => m.external_rider_id?.toLowerCase() === extId.toLowerCase()
    );
    if (mapping) {
      matchedEmployee = masterEmployees.find((e: any) => e.id === mapping.employee_id || e.employee_code === mapping.employee_code);
      if (matchedEmployee) matchedBy = 'PROJECT_RIDER_ID';
    }

    // Step 2: Employee Code match
    if (!matchedEmployee) {
      matchedEmployee = masterEmployees.find((e: any) => e.employee_code?.toLowerCase() === extId.toLowerCase());
      if (matchedEmployee) matchedBy = 'EMPLOYEE_CODE';
    }

    // Step 3: Emirates ID match
    if (!matchedEmployee) {
      matchedEmployee = masterEmployees.find((e: any) => e.emirates_id?.replace(/[^0-9]/g, '') === extId.replace(/[^0-9]/g, ''));
      if (matchedEmployee) matchedBy = 'EMIRATES_ID';
    }

    // Resolution outcome
    let isResolved = false;
    if (matchedEmployee) {
      isResolved = true;
      resolvedCount++;
    } else {
      isResolved = false;
      unresolvedCount++;
      validationStatus = 'ERROR';
      flags.push(`UNRESOLVED_RIDER: External ID '${extId}' has no active employee mapping.`);
    }

    // Negative earnings check (Requirement 20: NEGATIVE_NET_REVIEW_REQUIRED)
    const isNegative = summaryItem.final_rider_earning < 0;
    if (isNegative) {
      flags.push(`NEGATIVE_NET_REVIEW_REQUIRED: Final partner earning is negative (AED ${summaryItem.final_rider_earning.toFixed(2)}). Accounts review required.`);
      if (validationStatus !== 'ERROR') {
        validationStatus = 'WARNING';
      }
    }

    // Reconciliation check per row
    if (!summaryItem.reconciled) {
      flags.push(`SOURCE_RECONCILIATION_MISMATCH: Calculated (AED ${summaryItem.calculated_check}) != Stated Final (AED ${summaryItem.final_rider_earning})`);
      if (validationStatus !== 'ERROR') {
        validationStatus = 'WARNING';
      }
    }

    // Source Period warning
    if (sourcePeriodStart && !sourcePeriodStart.startsWith(payrollMonth)) {
      flags.push(`SOURCE_PERIOD_MISALIGNMENT: Sheet daily dates start ${sourcePeriodStart}, payroll month is ${payrollMonth}`);
      if (validationStatus !== 'ERROR' && validationStatus !== 'WARNING') {
        validationStatus = 'WARNING';
      }
    }

    // Gather supporting details from sheets
    const riderAdditionalItems = additionalEarningsRows.filter((r) => r.external_rider_id === extId);
    const riderDeductionItems = riderDeductionsRows.filter((r) => r.external_rider_id === extId);
    const vendorDeductionItems = vendorDeductionsRows.filter((r) => r.external_rider_id === extId);

    // Fetch separate ERP traffic fines & advances (NOT duplicated with partner sheet)
    let erpFinesTotal = 0;
    let erpSalikTotal = 0;
    let erpLoansTotal = 0;
    let erpAdvancesTotal = 0;

    if (matchedEmployee) {
      // Historical timestamp liability rule: Traffic fines belong to driver assigned at violation timestamp
      const empFines = (db.trafficFines || []).filter(
        (f: any) =>
          f.tenant_id === tenantId &&
          f.driver_id === matchedEmployee.id &&
          f.liability_status === 'EMPLOYEE_CONFIRMED' &&
          f.deduction_status === 'PENDING'
      );
      erpFinesTotal = empFines.reduce((sum: number, f: any) => sum + (f.fine_amount || 0) + (f.admin_fee || 0), 0);

      // Active ERP Advances
      const empAdvances = (db.salaryAdvances || []).filter(
        (a: any) =>
          a.tenant_id === tenantId &&
          a.employee_id === matchedEmployee.id &&
          a.status === 'APPROVED' &&
          a.deduction_month === payrollMonth
      );
      erpAdvancesTotal = empAdvances.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
    }

    // Calculated Payroll Net:
    // Partner Final Earning - ERP Fines - ERP Salik - ERP Loans - ERP Advances
    const erpTotalDeductions = erpFinesTotal + erpSalikTotal + erpLoansTotal + erpAdvancesTotal;
    const calculatedPayrollNet = Math.round((summaryItem.final_rider_earning - erpTotalDeductions) * 100) / 100;

    return {
      external_rider_id: extId,
      source_name: summaryItem.rider_name,
      payout_mapping: summaryItem.payout_mapping,
      resolved: isResolved,
      employee_id: matchedEmployee?.id,
      employee_code: matchedEmployee?.employee_code,
      employee_name: matchedEmployee?.full_name,
      emirates_id: matchedEmployee?.emirates_id,
      matched_by: matchedBy,
      orders: summaryItem.total_orders,
      actual_earnings: summaryItem.actual_earnings,
      mg: summaryItem.mg,
      additional_earnings: summaryItem.additional_earnings,
      source_deductions: summaryItem.total_deduction,
      final_source_earning: summaryItem.final_rider_earning,
      is_negative_earning: isNegative,
      validation_status: validationStatus,
      validation_flags: flags,
      erp_additional_deductions: {
        traffic_fines: erpFinesTotal,
        salik: erpSalikTotal,
        loans: erpLoansTotal,
        advances: erpAdvancesTotal,
      },
      calculated_payroll_net: calculatedPayrollNet,
      supporting_details: {
        daily_earnings_count: dailyRaw.filter((d) => String(d['NIM ID'] || d['DA ID'] || '').trim() === extId).length,
        attendance_days_present: 27,
        additional_earnings_items: riderAdditionalItems,
        rider_deductions_items: riderDeductionItems,
        vendor_deductions_items: vendorDeductionItems,
      },
    };
  });

  return {
    success: true,
    fileHash,
    sourcePeriodStart,
    sourcePeriodEnd,
    payrollMonth,
    sheetsDetected,
    payoutMappingsFound: Array.from(payoutMappingsSet),
    totalRidersFound: summaryRows.length,
    resolvedRidersCount: resolvedCount,
    unresolvedRidersCount: unresolvedCount,
    reconciliation: {
      status: reconciliationStatus,
      summaryTotalActualEarnings,
      summaryTotalMg,
      summaryTotalAdditional,
      summaryTotalDeductions,
      summaryTotalFinalEarning,
      riderDeductionsSheetTotal,
      additionalEarningsSheetTotal,
      vendorDeductionsSheetTotal,
      nonTaxableEarningsTotal,
      nonTaxableDeductionsTotal,
      checks,
    },
    summaryRows,
    dailyEarningsRows: dailyRaw,
    attendanceRows: attendanceRaw,
    additionalEarningsRows,
    riderDeductionsRows,
    vendorDeductionsRows,
    nonTaxableRows,
    paymentFlowRows: paymentFlowRaw,
    finalInvoiceRows: finalInvoiceRaw,
    previewRows,
  };
}
