import ExcelJS from 'exceljs';
import crypto from 'crypto';
import { resolvePayrollEmployeeByIdentity } from './riderProjectRoutes';

export interface NoonRow {
  row_number: number;
  da_name: string;
  nim_id: string;
  total_order: number;
  rider_earning: number;
  deduction: number;
  penalty: number;
  cod: number;
  vendor_share: number;
  fine: number;
  loan: number;
  source_rider_salary: number;
  calculated_net: number;
  resolved: boolean;
  is_resolved?: boolean;
  employee_id?: string | null;
  employee_code?: string | null;
  employee_name?: string | null;
  matched_employee: {
    id: string;
    employee_id?: string;
    employee_code: string;
    full_name: string;
    emirates_id?: string;
  } | null;
  status: 'READY' | 'WARNING' | 'ERROR' | 'UNRESOLVED RIDER' | 'DUPLICATE ROW' | 'AMBIGUOUS';
  errors: string[];
  warnings: string[];
  erp_fine_warning?: string | null;
  erp_loan_warning?: string | null;
}

export const NOON_EXCEL_COLUMNS = [
  'DA Name',
  'NIM ID',
  'Total Order',
  'Rider Earning',
  'Deduction',
  'Penalty',
  'COD',
  'Vendor Share',
  'Fine',
  'Loan',
  'Rider Salary',
];

/**
 * 1. GENERATE NOON EXCEL TEMPLATE (.xlsx)
 * Strictly follows requirements:
 * - File: NOON_Payroll_Template.xlsx
 * - Sheet name: "NOON Payroll"
 * - Exact 11 columns in order
 * - Yellow header background (#FFFFEB3B / #FFFF00)
 * - Bold header
 * - Frozen top row
 * - Autofilter enabled
 * - Readable column widths
 * - Professional borders
 * - Number formatting (#,##0.00 for currency, #,##0 for orders)
 * - Prepopulated with DA Name & NIM ID for existing mapped Noon riders with salary fields left blank
 */
export async function generateNoonExcelTemplate(
  db: any,
  tenantId: string,
  month: string,
  actorName: string
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = actorName || 'Allied Enterprise ERP';
  workbook.lastModifiedBy = actorName || 'Allied Enterprise ERP';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet('NOON Payroll', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }],
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

  // Define exact 11 columns with readable widths
  worksheet.columns = [
    { header: 'DA Name', key: 'da_name', width: 26 },
    { header: 'NIM ID', key: 'nim_id', width: 18 },
    { header: 'Total Order', key: 'total_order', width: 15 },
    { header: 'Rider Earning', key: 'rider_earning', width: 18 },
    { header: 'Deduction', key: 'deduction', width: 15 },
    { header: 'Penalty', key: 'penalty', width: 15 },
    { header: 'COD', key: 'cod', width: 15 },
    { header: 'Vendor Share', key: 'vendor_share', width: 16 },
    { header: 'Fine', key: 'fine', width: 15 },
    { header: 'Loan', key: 'loan', width: 15 },
    { header: 'Rider Salary', key: 'rider_salary', width: 18 },
  ];

  // Enable AutoFilter over exact 11 columns
  worksheet.autoFilter = 'A1:K1';

  // Format Header Row (Row 1): Yellow background, bold, centered, borders
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;

  headerRow.eachCell((cell, colNumber) => {
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF000000' },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFEB3B' }, // Yellow header background
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNumber <= 2 ? 'left' : colNumber === 3 ? 'center' : 'right',
      wrapText: false,
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FFD4A017' } },
      bottom: { style: 'medium', color: { argb: 'FFD4A017' } },
      left: { style: 'thin', color: { argb: 'FFE0B838' } },
      right: { style: 'thin', color: { argb: 'FFE0B838' } },
    };
  });

  // Query mapped Noon riders for prepopulation (Section 6)
  const noonMappings = (db.projectRiderMappings || []).filter(
    (m: any) =>
      m.tenant_id === tenantId &&
      m.is_active !== false &&
      (m.project_id === 'proj_noon_1' ||
        (m.project_name && m.project_name.toLowerCase().includes('noon')))
  );

  // If Noon riders exist, pre-fill DA Name & NIM ID, leaving all salary fields blank
  if (noonMappings.length > 0) {
    noonMappings.forEach((mapping: any) => {
      const emp = (db.masterEmployees || []).find((e: any) => e.id === mapping.employee_id);
      const daName = emp?.full_name || mapping.employee_name || '';
      const nimId = mapping.external_rider_id || '';

      const row = worksheet.addRow({
        da_name: daName,
        nim_id: nimId,
        total_order: null,
        rider_earning: null,
        deduction: null,
        penalty: null,
        cod: null,
        vendor_share: null,
        fine: null,
        loan: null,
        rider_salary: null,
      });

      row.height = 20;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };

        // Alignments & Number formats
        if (colNumber <= 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.numFmt = '#,##0';
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0.00';
        }
      });
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * 2. PARSE AND VALIDATE NOON EXCEL WORKBOOK
 * Strictly enforces:
 * - Exact 11 columns in order
 * - Required identifier: NIM ID
 * - Blank fields = 0 / not applicable (not rejected)
 * - Primary rider resolver: NIM ID -> ProjectRiderMapping -> Employee Master
 * - Separate storage of Fine, Loan, Deduction, Penalty, COD
 * - ERP Fine & Loan safety warning (never double deduct)
 * - No Labour hourly calculation applied
 * - Duplicate protection within sheet and committed batches
 */
export async function parseAndValidateNoonWorkbook(
  db: any,
  buffer: Buffer,
  fileName: string,
  targetMonth: string,
  actor: any
) {
  // Compute SHA-256 hash
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check duplicate workbook committed
  const existingBatch = (db.payrollImportBatches || []).find(
    (b: any) =>
      b.tenant_id === actor.tenantId &&
      b.file_hash === fileHash &&
      b.payroll_month === targetMonth &&
      b.status === 'COMMITTED'
  );

  const isDuplicateWorkbook = !!existingBatch;

  // Load workbook using ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  // Find sheet: preferred 'NOON Payroll', otherwise first sheet
  let worksheet = workbook.getWorksheet('NOON Payroll');
  if (!worksheet) {
    worksheet = workbook.worksheets[0];
  }

  if (!worksheet) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Validate Header Row
  const headerRow = worksheet.getRow(1);
  const foundHeaders: string[] = [];
  headerRow.eachCell((cell) => {
    foundHeaders.push(String(cell.value || '').trim());
  });

  // Verify headers match expected 11 columns
  const missingHeaders: string[] = [];
  NOON_EXCEL_COLUMNS.forEach((expectedCol) => {
    const found = foundHeaders.some(
      (h) => h.toLowerCase() === expectedCol.toLowerCase()
    );
    if (!found) {
      missingHeaders.push(expectedCol);
    }
  });

  if (missingHeaders.length > 0) {
    throw new Error(
      `Invalid Noon Excel format. Missing required columns: ${missingHeaders.join(
        ', '
      )}. Expected exact columns: ${NOON_EXCEL_COLUMNS.join(', ')}`
    );
  }

  // Header column index map (1-based)
  const colIndexMap: Record<string, number> = {};
  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '').trim().toLowerCase();
    colIndexMap[val] = colNumber;
  });

  function getCellValue(row: ExcelJS.Row, colName: string): any {
    const idx = colIndexMap[colName.toLowerCase()];
    if (!idx) return null;
    const cell = row.getCell(idx);
    let val = cell.value;
    if (val && typeof val === 'object' && 'result' in val) {
      val = val.result;
    }
    return val;
  }

  function parseAmount(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  const previewRows: NoonRow[] = [];
  const seenNimIds = new Set<string>();
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let unresolvedCount = 0;
  let duplicateRowCount = 0;
  let ambiguousCount = 0;

  let totalOrdersSum = 0;
  let totalRiderEarningsSum = 0;
  let totalDeductionsSum = 0;
  let totalPenaltiesSum = 0;
  let totalCodSum = 0;
  let totalVendorShareSum = 0;
  let totalFineSum = 0;
  let totalLoanSum = 0;
  let totalSourceRiderSalarySum = 0;
  let totalCalculatedNetSum = 0;

  // Process rows starting from Row 2
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Skip completely empty rows
    let hasAnyData = false;
    row.eachCell(() => {
      hasAnyData = true;
    });
    if (!hasAnyData) continue;

    const rawDaName = String(getCellValue(row, 'DA Name') || '').trim();
    const rawNimId = String(getCellValue(row, 'NIM ID') || '').trim();

    // If both name and NIM ID are empty, skip row
    if (!rawDaName && !rawNimId) continue;

    const totalOrder = Math.round(parseAmount(getCellValue(row, 'Total Order')));
    const riderEarning = parseAmount(getCellValue(row, 'Rider Earning'));
    const deduction = parseAmount(getCellValue(row, 'Deduction'));
    const penalty = parseAmount(getCellValue(row, 'Penalty'));
    const cod = parseAmount(getCellValue(row, 'COD'));
    const vendorShare = parseAmount(getCellValue(row, 'Vendor Share'));
    const fine = parseAmount(getCellValue(row, 'Fine'));
    const loan = parseAmount(getCellValue(row, 'Loan'));
    const sourceRiderSalary = parseAmount(getCellValue(row, 'Rider Salary'));

    // Summing for reconciliation
    totalOrdersSum += totalOrder;
    totalRiderEarningsSum += riderEarning;
    totalDeductionsSum += deduction;
    totalPenaltiesSum += penalty;
    totalCodSum += cod;
    totalVendorShareSum += vendorShare;
    totalFineSum += fine;
    totalLoanSum += loan;
    totalSourceRiderSalarySum += sourceRiderSalary;

    // Authoritative Noon source-salary rule:
    // Rider Salary is the provider salary value, stored as source_rider_salary.
    // Preserve all other columns separately.
    // Do NOT apply Labour hourly calculation or invent a subtraction formula.
    const calculatedNet = sourceRiderSalary > 0 ? sourceRiderSalary : riderEarning;
    totalCalculatedNetSum += calculatedNet;

    const errors: string[] = [];
    const warnings: string[] = [];
    let erpFineWarning: string | null = null;
    let erpLoanWarning: string | null = null;

    // 1. Check Required Identifier: NIM ID
    if (!rawNimId) {
      errors.push('NIM ID is required for Noon rider identification.');
    }

    // 2. Check Duplicate NIM ID in same sheet
    if (rawNimId && seenNimIds.has(rawNimId)) {
      errors.push(`Duplicate row with NIM ID '${rawNimId}' in uploaded workbook.`);
    } else if (rawNimId) {
      seenNimIds.add(rawNimId);
    }

    // 3. Check Duplicate against already committed payroll lines for this month
    const existingCommittedLine = (db.projectSalaryLines || []).find(
      (l: any) =>
        l.tenant_id === actor.tenantId &&
        l.payroll_month === targetMonth &&
        l.external_rider_id === rawNimId &&
        l.project_id === 'proj_noon_1'
    );
    if (existingCommittedLine) {
      warnings.push(
        `NIM ID '${rawNimId}' already has committed payroll lines for ${targetMonth}. Re-importing will replace previous line.`
      );
    }

    // 4. Primary Employee Matching: NIM ID -> Project Assignment / ProjectRiderMapping -> Employee Master
    // Do NOT match by DA Name, Emirates ID, Mobile or fuzzy matching!
    let resolved = false;
    let matchedEmployee: any = null;
    let isAmbiguous = false;

    if (rawNimId) {
      const resolution = resolvePayrollEmployeeByIdentity(
        db,
        actor.tenantId,
        'proj_noon_1',
        rawNimId,
        targetMonth
      );

      if (resolution.status === 'AMBIGUOUS') {
        errors.push(resolution.reason || `AMBIGUOUS: NIM ID '${rawNimId}' maps to multiple employees.`);
        isAmbiguous = true;
      } else if (resolution.status === 'MATCHED' && resolution.employee) {
        resolved = true;
        const emp = resolution.employee;
        matchedEmployee = {
          id: emp.id,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          emirates_id: emp.emirates_id || emp.emirates_id_number,
        };
      } else {
        warnings.push(`UNRESOLVED RIDER: NIM ID '${rawNimId}' is not mapped to any ERP Employee.`);
      }
    }

    // 5. ERP Fine / Loan Safety Check (Section 10)
    if (matchedEmployee) {
      if (fine > 0) {
        // Check ERP pending fines
        const erpFines = (db.trafficFines || []).filter(
          (f: any) =>
            f.tenant_id === actor.tenantId &&
            f.employee_id === matchedEmployee.id &&
            (f.status === 'PENDING' || f.status === 'NEW' || f.status === 'PENDING_PAYROLL')
        );
        const totalErpFine = erpFines.reduce(
          (acc: number, f: any) => acc + (Number(f.total_amount) || Number(f.fine_amount) || 0),
          0
        );
        if (totalErpFine > 0) {
          erpFineWarning = `Sheet specifies Fine AED ${fine.toFixed(2)}. ERP has pending Traffic Fines totaling AED ${totalErpFine.toFixed(2)}. Stored separately as source_fine to prevent double deduction.`;
          warnings.push(erpFineWarning);
        }
      }

      if (loan > 0) {
        // Check ERP loans
        const erpLoans = (db.employeeLoans || []).filter(
          (l: any) =>
            l.tenant_id === actor.tenantId &&
            l.employee_id === matchedEmployee.id &&
            l.status === 'ACTIVE'
        );
        if (erpLoans.length > 0) {
          erpLoanWarning = `Sheet specifies Loan AED ${loan.toFixed(2)}. ERP has active Loan installment. Stored separately as source_loan to prevent double deduction.`;
          warnings.push(erpLoanWarning);
        }
      }
    }

    // 6. Source Rider Salary Verification (Section 9)
    if (sourceRiderSalary > 0 && Math.abs(sourceRiderSalary - calculatedNet) > 0.05) {
      warnings.push(
        `Source Rider Salary (AED ${sourceRiderSalary.toFixed(2)}) differs from calculated net (AED ${calculatedNet.toFixed(2)}). Stored as source_rider_salary without overwriting.`
      );
    }

    // Determine row status
    let status: 'READY' | 'WARNING' | 'ERROR' | 'UNRESOLVED RIDER' | 'DUPLICATE ROW' | 'AMBIGUOUS' = 'READY';

    if (errors.some((e) => e.includes('Duplicate row'))) {
      status = 'DUPLICATE ROW';
      duplicateRowCount++;
    } else if (isAmbiguous || errors.some((e) => e.includes('AMBIGUOUS'))) {
      status = 'AMBIGUOUS';
      ambiguousCount++;
    } else if (errors.length > 0) {
      status = 'ERROR';
      errorCount++;
    } else if (!resolved) {
      status = 'UNRESOLVED RIDER';
      unresolvedCount++;
    } else if (warnings.length > 0) {
      status = 'WARNING';
      warningCount++;
    } else {
      status = 'READY';
      readyCount++;
    }

    previewRows.push({
      row_number: rowNumber,
      da_name: rawDaName,
      nim_id: rawNimId,
      total_order: totalOrder,
      rider_earning: riderEarning,
      deduction: deduction,
      penalty: penalty,
      cod: cod,
      vendor_share: vendorShare,
      fine: fine,
      loan: loan,
      source_rider_salary: sourceRiderSalary,
      calculated_net: calculatedNet,
      resolved,
      is_resolved: resolved,
      employee_id: matchedEmployee?.id || matchedEmployee?.employee_id || null,
      employee_code: matchedEmployee?.employee_code || null,
      employee_name: matchedEmployee?.full_name || null,
      matched_employee: matchedEmployee,
      status,
      errors,
      warnings,
      erp_fine_warning: erpFineWarning,
      erp_loan_warning: erpLoanWarning,
    });
  }

  const canCommit =
    errorCount === 0 && duplicateRowCount === 0 && unresolvedCount === 0 && ambiguousCount === 0 && !isDuplicateWorkbook;

  return {
    success: true,
    file_name: fileName,
    file_hash: fileHash,
    is_duplicate_workbook: isDuplicateWorkbook,
    duplicate_warning: isDuplicateWorkbook
      ? `This exact workbook (${fileName}) has already been committed for ${targetMonth}.`
      : null,
    total_rows: previewRows.length,
    ready_count: readyCount,
    warning_count: warningCount,
    error_count: errorCount,
    unresolved_count: unresolvedCount,
    duplicate_row_count: duplicateRowCount,
    ambiguous_count: ambiguousCount,
    can_commit: canCommit,
    reconciliation: {
      total_orders: totalOrdersSum,
      total_rider_earnings: totalRiderEarningsSum,
      total_rider_earning: totalRiderEarningsSum,
      total_deductions: totalDeductionsSum,
      total_penalties: totalPenaltiesSum,
      total_cod: totalCodSum,
      total_vendor_share: totalVendorShareSum,
      total_source_fine: totalFineSum,
      total_source_loan: totalLoanSum,
      total_source_rider_salary: totalSourceRiderSalarySum,
      total_rider_salary: totalSourceRiderSalarySum,
      total_calculated_net: totalCalculatedNetSum,
    },
    preview_rows: previewRows,
    actor_metadata: {
      validation_run_by: actor.userName,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 3. COMMIT NOON PAYROLL BATCH TO UNIFIED PAYROLL ENGINE
 * Normalizes rows into `db.projectSalaryLines` and `db.payrollImportBatches`
 */
export function commitNoonPayrollBatch(
  db: any,
  tenantId: string,
  month: string,
  batchData: {
    fileName: string;
    fileHash: string;
    rows: NoonRow[];
    reconciliation: any;
  },
  actor: any
) {
  const { fileName, fileHash, rows, reconciliation } = batchData;

  // Block duplicate workbook
  const existingBatch = (db.payrollImportBatches || []).find(
    (b: any) =>
      b.tenant_id === tenantId &&
      b.file_hash === fileHash &&
      b.payroll_month === month &&
      b.status === 'COMMITTED'
  );
  if (existingBatch) {
    throw new Error(`Workbook with SHA-256 hash ${fileHash} has already been committed for ${month}.`);
  }

  const batchId = `batch_noon_${Date.now()}`;

  // Enforce Payroll Safety Gate
  const hasUnresolved = rows.some((r: any) => !r.resolved || r.status === 'UNRESOLVED RIDER' || r.status === 'UNMATCHED');
  const hasDuplicates = rows.some((r: any) => r.status === 'DUPLICATE ROW');
  const hasAmbiguous = rows.some((r: any) => r.status === 'AMBIGUOUS');
  const hasErrors = rows.some((r: any) => r.status === 'ERROR' || (r.errors && r.errors.length > 0));

  if (hasUnresolved || hasDuplicates || hasAmbiguous || hasErrors) {
    throw new Error(
      `Payroll Safety Gate Blocked: Cannot commit payroll batch with unresolved, duplicate, ambiguous, or error rows. Resolve all safety gate issues first.`
    );
  }

  // Filter resolved rows
  const resolvedRows = rows.filter((r) => r.resolved && r.matched_employee);

  if (resolvedRows.length === 0) {
    throw new Error('No resolved rider rows available to commit.');
  }

  // Remove existing Noon project salary lines for these employees in this month to avoid duplicates
  const employeeIdsToUpdate = new Set(resolvedRows.map((r) => r.matched_employee!.id));
  db.projectSalaryLines = (db.projectSalaryLines || []).filter(
    (l: any) =>
      !(
        l.tenant_id === tenantId &&
        l.payroll_month === month &&
        l.project_id === 'proj_noon_1' &&
        employeeIdsToUpdate.has(l.employee_id)
      )
  );

  // Normalize each row into unified projectSalaryLine schema (Section 12)
  const newSalaryLines = resolvedRows.map((row) => {
    const emp = row.matched_employee!;
    return {
      id: `psl_noon_${emp.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      employee_id: emp.id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      project_id: 'proj_noon_1',
      project_name: 'Noon Minutes Logistics',
      salary_group: 'NOON',
      payroll_month: month,
      external_rider_id: row.nim_id,
      calculation_method: 'CLIENT_IMPORT',
      working_hours: undefined, // Noon is NOT Labour hourly payroll
      hourly_rate: 0,
      deliveries_count: row.total_order,
      rate: 0,
      gross_earning: row.source_rider_salary > 0 ? row.source_rider_salary : row.rider_earning,
      gross_earnings: row.source_rider_salary > 0 ? row.source_rider_salary : row.rider_earning,
      manual_deduction: 0,
      total_orders: row.total_order,
      rider_earning: row.rider_earning,
      deduction: row.deduction,
      penalty: row.penalty,
      cod: row.cod,
      vendor_share: row.vendor_share,
      source_fine: row.fine,
      source_loan: row.loan,
      source_rider_salary: row.source_rider_salary,
      calculated_payroll_net: row.source_rider_salary > 0 ? row.source_rider_salary : row.rider_earning,
      net_payable: row.source_rider_salary > 0 ? row.source_rider_salary : row.rider_earning,
      net_amount: row.source_rider_salary > 0 ? row.source_rider_salary : row.rider_earning,
      source_batch_id: batchId,
      supporting_details: {
        template_type: 'NOON_EXCEL_PAYROLL',
        da_name: row.da_name,
        nim_id: row.nim_id,
        total_order: row.total_order,
        rider_earning: row.rider_earning,
        deduction: row.deduction,
        penalty: row.penalty,
        cod: row.cod,
        vendor_share: row.vendor_share,
        source_fine: row.fine,
        source_loan: row.loan,
        source_rider_salary: row.source_rider_salary,
        erp_fine_warning: row.erp_fine_warning || null,
        erp_loan_warning: row.erp_loan_warning || null,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  db.projectSalaryLines.push(...newSalaryLines);

  // Update or create payroll records
  for (const line of newSalaryLines) {
    let record = (db.payrollRecords || []).find(
      (r: any) =>
        r.tenant_id === tenantId &&
        r.employee_id === line.employee_id &&
        (r.period_key === month || r.payroll_month === month)
    );

    if (record) {
      if (!record.project_earnings_lines) record.project_earnings_lines = [];
      record.project_earnings_lines = record.project_earnings_lines.filter(
        (pl: any) => pl.id !== line.id && pl.project_id !== 'proj_noon_1'
      );
      record.project_earnings_lines.push(line);
      const totalGross = record.project_earnings_lines.reduce(
        (acc: number, pl: any) => acc + (Number(pl.gross_earnings || pl.gross_earning || pl.source_rider_salary || 0)),
        Number(record.base_salary || 0)
      );
      const totalNet = record.project_earnings_lines.reduce(
        (acc: number, pl: any) => acc + (Number(pl.net_payable || pl.calculated_payroll_net || pl.net_project_amount || 0)),
        Number(record.base_salary || 0)
      );
      record.gross_earnings = Number(totalGross.toFixed(2));
      record.gross_salary = Number(totalGross.toFixed(2));
      record.net_salary = Number(totalNet.toFixed(2));
      record.updated_at = new Date().toISOString();
    } else {
      if (!db.payrollRecords) db.payrollRecords = [];
      const newRecord = {
        id: `pr_${Date.now()}_${line.employee_id}`,
        tenant_id: tenantId,
        employee_id: line.employee_id,
        employee_code: line.employee_code,
        employee_name: line.employee_name,
        period_key: month,
        payroll_month: month,
        status: 'DRAFT',
        base_salary: 0,
        gross_salary: Number(line.gross_earning || 0),
        gross_earnings: Number(line.gross_earning || 0),
        net_salary: Number(line.calculated_payroll_net || 0),
        allowances: 0,
        total_deductions: Number(line.manual_deduction || 0),
        project_earnings_lines: [line],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.payrollRecords.push(newRecord);
    }
  }

  // Record batch in db.payrollImportBatches
  const newBatch = {
    id: batchId,
    tenant_id: tenantId,
    payroll_month: month,
    salary_group: 'NOON',
    project_id: 'proj_noon_1',
    project_name: 'Noon Minutes Logistics',
    source_file: fileName,
    file_name: fileName,
    file_hash: fileHash,
    status: 'COMMITTED',
    uploaded_by: actor.userName,
    created_by: actor.userName,
    total_rows: rows.length,
    imported_rows: resolvedRows.length,
    skipped_rows: rows.length - resolvedRows.length,
    total_gross_amount: reconciliation?.total_rider_earnings || 0,
    total_net_amount: reconciliation?.total_calculated_net || 0,
    total_deductions_amount:
      (reconciliation?.total_deductions || 0) +
      (reconciliation?.total_penalties || 0) +
      (reconciliation?.total_cod || 0) +
      (reconciliation?.total_vendor_share || 0) +
      (reconciliation?.total_source_fine || 0) +
      (reconciliation?.total_source_loan || 0),
    template_type: 'NOON_EXCEL_PAYROLL',
    audit_trail: {
      template_generated_by: actor.userName,
      workbook_uploaded_by: actor.userName,
      validation_run_by: actor.userName,
      import_committed_by: actor.userName,
      committed_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };

  if (!db.payrollImportBatches) db.payrollImportBatches = [];
  db.payrollImportBatches.unshift(newBatch);

  // Record Audit Log
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `log_noon_imp_${Date.now()}`,
    tenant_id: tenantId,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: actor.userId,
    userName: actor.userName,
    userRole: actor.userRole,
    action: 'COMMIT_NOON_PAYROLL_BATCH',
    actionType: 'IMPORT',
    status: 'SUCCESS',
    module: 'Payroll Management',
    details: `Committed Noon Excel Payroll batch for ${month}: ${resolvedRows.length} riders, Gross AED ${reconciliation?.total_rider_earnings?.toFixed(2)}, Net AED ${reconciliation?.total_calculated_net?.toFixed(2)} (File: ${fileName}, SHA-256: ${fileHash.substring(0, 8)}...).`,
    ipAddress: '127.0.0.1',
  });

  return {
    success: true,
    batchId,
    batch: newBatch,
    sampleLine: newSalaryLines[0],
    committedRowsCount: resolvedRows.length,
    newSalaryLines,
    message: `Successfully committed ${resolvedRows.length} Noon riders to ${month} payroll engine.`,
  };
}
