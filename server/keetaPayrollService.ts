import ExcelJS from 'exceljs';
import crypto from 'crypto';
import { resolvePayrollEmployeeByIdentity } from './riderProjectRoutes';

export interface KeetaRow {
  row_number: number;
  courier_id: string;
  courier_name: string;
  valid_days: number;
  hours_avg: number;
  incentive: number;
  reward: number;
  food_charge: number;
  penalty: number;
  tip: number;
  source_rider_salary: number;
  rider_salary?: number;
  incentive_adjustment: number;
  bike_fine: number;
  maintenance_others: number;
  source_deductions?: number;
  source_net_payable: number;
  calculated_net: number;
  net_payable_salary?: number;
  negative_net_review_required?: boolean;
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
    tenant_id?: string;
  } | null;
  status: 'READY' | 'WARNING' | 'ERROR' | 'UNRESOLVED RIDER' | 'DUPLICATE ROW' | 'AMBIGUOUS';
  errors: string[];
  warnings: string[];
  erp_fine_warning?: string | null;
  linked_erp_fine_id?: string | null;
  double_deduction_status?: 'NO_CONFLICT' | 'MATCHED_LINKED' | 'NEEDS_REVIEW';
}

/**
 * EXACT 14 COLUMNS IN STRICT SPECIFIED ORDER
 * 1. Courier ID
 * 2. Courier Name
 * 3. Valid Days
 * 4. Hours Avg
 * 5. Incentive
 * 6. Reward
 * 7. Food Charge
 * 8. Penalty
 * 9. Tip
 * 10. Rider Salary
 * 11. Incentive Adjustment
 * 12. Bike Fine
 * 13. Maintenance / Others
 * 14. Net Payable Salary
 */
export const KEETA_EXCEL_COLUMNS = [
  'Courier ID',
  'Courier Name',
  'Valid Days',
  'Hours Avg',
  'Incentive',
  'Reward',
  'Food Charge',
  'Penalty',
  'Tip',
  'Rider Salary',
  'Incentive Adjustment',
  'Bike Fine',
  'Maintenance / Others',
  'Net Payable Salary',
];

/**
 * 1. GENERATE REAL KEETA EXCEL TEMPLATE (.xlsx)
 * - File: KEETA_Payroll_Template.xlsx
 * - Sheet name: "KEETA Payroll"
 * - Exact 14 columns in order
 * - Yellow header (#FFFFEB3B)
 * - Bold header, frozen top row, autofilter A1:N1
 * - Thin borders, readable column widths
 * - Professional numeric and currency formats
 * - Pre-populated with Courier ID & Courier Name for mapped Keeta riders
 * - Financial/source values left blank (no fake numbers, no fake employees)
 */
export async function generateKeetaExcelTemplate(
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

  const worksheet = workbook.addWorksheet('KEETA Payroll', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }],
    pageSetup: { fitToPage: true, orientation: 'landscape' },
  });

  // Exact 14 columns with proper display widths
  worksheet.columns = [
    { header: 'Courier ID', key: 'courier_id', width: 18 },
    { header: 'Courier Name', key: 'courier_name', width: 26 },
    { header: 'Valid Days', key: 'valid_days', width: 14 },
    { header: 'Hours Avg', key: 'hours_avg', width: 14 },
    { header: 'Incentive', key: 'incentive', width: 16 },
    { header: 'Reward', key: 'reward', width: 16 },
    { header: 'Food Charge', key: 'food_charge', width: 16 },
    { header: 'Penalty', key: 'penalty', width: 16 },
    { header: 'Tip', key: 'tip', width: 14 },
    { header: 'Rider Salary', key: 'rider_salary', width: 18 },
    { header: 'Incentive Adjustment', key: 'incentive_adjustment', width: 22 },
    { header: 'Bike Fine', key: 'bike_fine', width: 16 },
    { header: 'Maintenance / Others', key: 'maintenance_others', width: 24 },
    { header: 'Net Payable Salary', key: 'net_payable_salary', width: 20 },
  ];

  // Enable AutoFilter across all 14 columns
  worksheet.autoFilter = 'A1:N1';

  // Format Header Row (Row 1): Yellow background, bold, centered/aligned, borders
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

  // Query mapped Keeta riders for prepopulation
  const keetaMappings = (db.projectRiderMappings || []).filter(
    (m: any) =>
      m.tenant_id === tenantId &&
      m.is_active !== false &&
      (m.project_id === 'proj_keeta_1' ||
        (m.project_name && m.project_name.toLowerCase().includes('keeta')) ||
        (m.external_rider_id && m.external_rider_id.toLowerCase().startsWith('kee-')))
  );

  // If Keeta riders exist, pre-fill Courier ID & Courier Name, leaving financial values blank
  if (keetaMappings.length > 0) {
    keetaMappings.forEach((mapping: any) => {
      const emp = (db.masterEmployees || []).find((e: any) => e.id === mapping.employee_id);
      const courierName = emp?.full_name || mapping.employee_name || '';
      const courierId = mapping.external_rider_id || '';

      const row = worksheet.addRow({
        courier_id: courierId,
        courier_name: courierName,
        valid_days: null,
        hours_avg: null,
        incentive: null,
        reward: null,
        food_charge: null,
        penalty: null,
        tip: null,
        rider_salary: null,
        incentive_adjustment: null,
        bike_fine: null,
        maintenance_others: null,
        net_payable_salary: null,
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
        } else if (colNumber === 4) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '0.00';
        } else if (colNumber === 11) {
          // Signed Incentive Adjustment format
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '+#,##0.00;-#,##0.00;0.00';
        } else {
          // Currency components
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
 * 2. PARSE AND VALIDATE KEETA EXCEL WORKBOOK
 * Strictly enforces:
 * - Exact 14 columns in order
 * - Required identifier: Courier ID
 * - Courier Name used for display / verification only (never primary match)
 * - Primary rider resolver: Courier ID -> ProjectRiderMapping -> Employee Master
 * - Blank optional fields = 0 / not applicable (not rejected)
 * - Keeta is NOT Labour hourly: No Hours Avg x Rate calculation
 * - Earnings itemized: Incentive, Reward, Tip
 * - Deductions itemized: Food Charge, Penalty, Bike Fine, Maintenance / Others
 * - Signed adjustment: Incentive Adjustment (+ adds, - subtracts)
 * - Source Rider Salary preserved separately without double counting
 * - ERP Traffic Fine vs Keeta Bike Fine safety check (anti-double deduction)
 * - Duplicate Courier ID & Duplicate Workbook protection
 */
export async function parseAndValidateKeetaWorkbook(
  db: any,
  buffer: Buffer,
  fileName: string,
  targetMonth: string,
  actor: any
) {
  // Compute SHA-256 hash for duplicate workbook protection
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Check duplicate workbook committed
  const existingBatch = (db.payrollImportBatches || []).find(
    (b: any) =>
      b.tenant_id === actor.tenantId &&
      b.file_hash === fileHash &&
      b.payroll_month === targetMonth &&
      b.salary_group === 'KEETA' &&
      b.status === 'COMMITTED'
  );

  const isDuplicateWorkbook = !!existingBatch;

  // Load workbook using ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  // Find sheet: preferred 'KEETA Payroll', otherwise first sheet
  let worksheet = workbook.getWorksheet('KEETA Payroll');
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

  // Check missing headers
  const missingHeaders: string[] = [];
  KEETA_EXCEL_COLUMNS.forEach((expectedCol) => {
    const found = foundHeaders.some(
      (h) => h.toLowerCase() === expectedCol.toLowerCase()
    );
    if (!found) {
      missingHeaders.push(expectedCol);
    }
  });

  if (missingHeaders.length > 0) {
    throw new Error(
      `Invalid Keeta Excel format. Missing required columns: ${missingHeaders.join(
        ', '
      )}. Expected exact 14 columns: ${KEETA_EXCEL_COLUMNS.join(', ')}`
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
    if (typeof val === 'number') return isNaN(val) ? 0 : Number(val.toFixed(2));
    const str = String(val).trim();
    // Check if negative
    const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
    const cleanStr = str.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    return Number((isNegative ? -num : num).toFixed(2));
  }

  function parseSignedAdjustment(val: any): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : Number(val.toFixed(2));
    const str = String(val).trim();
    const isNegative = str.startsWith('-') || (str.startsWith('(') && str.endsWith(')'));
    const cleanStr = str.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleanStr);
    if (isNaN(num)) return 0;
    return Number((isNegative ? -num : num).toFixed(2));
  }

  const previewRows: KeetaRow[] = [];
  const seenCourierIds = new Set<string>();
  let readyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let unresolvedCount = 0;
  let duplicateRowCount = 0;
  let ambiguousCount = 0;

  let totalValidDaysSum = 0;
  let totalHoursAvgSum = 0;
  let totalIncentiveSum = 0;
  let totalRewardSum = 0;
  let totalFoodChargeSum = 0;
  let totalPenaltySum = 0;
  let totalTipSum = 0;
  let totalSourceRiderSalarySum = 0;
  let totalIncentiveAdjustmentSum = 0;
  let totalBikeFineSum = 0;
  let totalMaintenanceOthersSum = 0;
  let totalSourceNetPayableSum = 0;
  let totalCalculatedNetSum = 0;

  const totalRowCount = worksheet.rowCount;

  for (let rowNumber = 2; rowNumber <= totalRowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);

    // Check if row has any values
    let hasAnyValue = false;
    row.eachCell((cell) => {
      if (cell.value !== null && cell.value !== undefined && String(cell.value).trim() !== '') {
        hasAnyValue = true;
      }
    });

    if (!hasAnyValue) continue;

    const rawCourierId = String(getCellValue(row, 'Courier ID') || '').trim();
    const rawCourierName = String(getCellValue(row, 'Courier Name') || '').trim();

    const validDays = Math.max(0, Math.round(parseAmount(getCellValue(row, 'Valid Days'))));
    const hoursAvg = Math.max(0, parseAmount(getCellValue(row, 'Hours Avg')));
    const incentive = Math.max(0, parseAmount(getCellValue(row, 'Incentive')));
    const reward = Math.max(0, parseAmount(getCellValue(row, 'Reward')));
    const foodCharge = Math.max(0, parseAmount(getCellValue(row, 'Food Charge')));
    const penalty = Math.max(0, parseAmount(getCellValue(row, 'Penalty')));
    const tip = Math.max(0, parseAmount(getCellValue(row, 'Tip')));
    const sourceRiderSalary = parseAmount(getCellValue(row, 'Rider Salary'));
    const incentiveAdjustment = parseSignedAdjustment(getCellValue(row, 'Incentive Adjustment'));
    const bikeFine = Math.max(0, parseAmount(getCellValue(row, 'Bike Fine')));
    const maintenanceOthers = parseAmount(getCellValue(row, 'Maintenance / Others'));
    const sourceNetPayable = parseAmount(getCellValue(row, 'Net Payable Salary'));

    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Validate Required Identifier: Courier ID
    if (!rawCourierId) {
      errors.push('Row is missing required Courier ID.');
    }

    // 2. Duplicate Courier ID Protection within workbook
    if (rawCourierId) {
      const normalizedCourierId = rawCourierId.toLowerCase();
      if (seenCourierIds.has(normalizedCourierId)) {
        errors.push(`Duplicate Courier ID '${rawCourierId}' detected in workbook.`);
      } else {
        seenCourierIds.add(normalizedCourierId);
      }
    }

    // 3. Primary Resolution: Courier ID -> ProjectRiderMapping / Assignment -> Employee Master
    // Do NOT match by Courier Name, Emirates ID, Mobile or fuzzy matching!
    let matchedEmployee: any = null;
    let resolved = false;
    let isAmbiguous = false;

    if (rawCourierId) {
      const resolution = resolvePayrollEmployeeByIdentity(
        db,
        actor.tenantId,
        'proj_keeta_1',
        rawCourierId,
        targetMonth
      );

      if (resolution.status === 'AMBIGUOUS') {
        errors.push(resolution.reason || `AMBIGUOUS: Courier ID '${rawCourierId}' maps to multiple employees.`);
        isAmbiguous = true;
      } else if (resolution.status === 'MATCHED' && resolution.employee) {
        matchedEmployee = resolution.employee;
        resolved = true;
        // Tenant security check
        if (!actor.isSuperAdmin && matchedEmployee.tenant_id && matchedEmployee.tenant_id !== actor.tenantId) {
          errors.push(
            `Employee '${matchedEmployee.employee_code}' belongs to another tenant workspace.`
          );
          resolved = false;
        }
      } else {
        errors.push(
          `Courier ID '${rawCourierId}' is not mapped to any employee in Employee Master.`
        );
      }
    }

    // 4. Double Deduction Protection: Source Bike Fine vs ERP Traffic Fine
    let erpFineWarning: string | null = null;
    let linkedErpFineId: string | null = null;
    let doubleDeductionStatus: 'NO_CONFLICT' | 'MATCHED_LINKED' | 'NEEDS_REVIEW' = 'NO_CONFLICT';

    if (resolved && matchedEmployee) {
      const activeFines = (db.trafficFines || []).filter(
        (f: any) =>
          (f.driver_id === matchedEmployee.id || f.driver_id === matchedEmployee.employee_code) &&
          f.liability_status === 'EMPLOYEE_CONFIRMED' &&
          f.deduction_status !== 'DEDUCTED'
      );

      if (bikeFine > 0 && activeFines.length > 0) {
        // Attempt exact or close matching with active ERP fines
        const exactMatch = activeFines.find((f: any) => {
          const fineTotal = (f.fine_amount || 0) + (f.admin_fee || 0);
          return Math.abs(fineTotal - bikeFine) < 0.05;
        });

        if (exactMatch) {
          linkedErpFineId = exactMatch.id;
          doubleDeductionStatus = 'MATCHED_LINKED';
          warnings.push(
            `Keeta Bike Fine (AED ${bikeFine.toFixed(2)}) matches confirmed ERP Fine (${exactMatch.ticket_number || exactMatch.id}). Linked to prevent double deduction.`
          );
        } else {
          doubleDeductionStatus = 'NEEDS_REVIEW';
          erpFineWarning = `Rider has Keeta source Bike Fine (AED ${bikeFine.toFixed(2)}) and active ERP Traffic Fine(s) totaling AED ${activeFines.reduce((s: number, f: any) => s + (f.fine_amount || 0), 0)}. Flagged NEEDS_REVIEW to prevent double deduction.`;
          warnings.push(erpFineWarning);
        }
      }
    }

    // 5. Authoritative Keeta Final Payable Calculation
    // source_deductions = food_charge + penalty + bike_fine + maintenance_others
    // final_calculated_net = source_rider_salary + incentive_adjustment - source_deductions
    // Note: Incentive, Reward, Tip are informational source components already reflected in Rider Salary.
    const sourceDeductions = Number(
      (foodCharge + penalty + bikeFine + maintenanceOthers).toFixed(2)
    );

    const calculatedNet = Number(
      (sourceRiderSalary + incentiveAdjustment - sourceDeductions).toFixed(2)
    );

    // Negative Value Preservation & Protection
    const isNegativeNet = calculatedNet < 0 || sourceNetPayable < 0;
    if (isNegativeNet) {
      warnings.push(
        `NEGATIVE_NET_REVIEW_REQUIRED: Negative net salary detected (Calculated: AED ${calculatedNet.toFixed(2)}, Source: AED ${sourceNetPayable.toFixed(2)}). Preserved signed value; approval blocked until reviewed.`
      );
    }

    // 6. Reconciliation: Compare final_calculated_net against source_net_payable
    if (sourceNetPayable !== 0 || calculatedNet !== 0) {
      if (Math.abs(sourceNetPayable - calculatedNet) > 0.05) {
        warnings.push(
          `Sheet Net Payable (AED ${sourceNetPayable.toFixed(2)}) differs from calculated payable (AED ${calculatedNet.toFixed(2)}). Stored as source_net_payable.`
        );
      }
    }

    // Accumulate reconciliation sums
    totalValidDaysSum += validDays;
    totalHoursAvgSum += hoursAvg;
    totalIncentiveSum += incentive;
    totalRewardSum += reward;
    totalFoodChargeSum += foodCharge;
    totalPenaltySum += penalty;
    totalTipSum += tip;
    totalSourceRiderSalarySum += sourceRiderSalary;
    totalIncentiveAdjustmentSum += incentiveAdjustment;
    totalBikeFineSum += bikeFine;
    totalMaintenanceOthersSum += maintenanceOthers;
    totalSourceNetPayableSum += sourceNetPayable;
    totalCalculatedNetSum += calculatedNet;

    // Determine row status
    let status: 'READY' | 'WARNING' | 'ERROR' | 'UNRESOLVED RIDER' | 'DUPLICATE ROW' | 'AMBIGUOUS' = 'READY';

    if (errors.some((e) => e.includes('Duplicate Courier ID'))) {
      status = 'DUPLICATE ROW';
      duplicateRowCount++;
    } else if (isAmbiguous || errors.some((e) => e.includes('AMBIGUOUS'))) {
      status = 'AMBIGUOUS';
      ambiguousCount++;
    } else if (errors.length > 0 && !resolved) {
      status = 'UNRESOLVED RIDER';
      unresolvedCount++;
    } else if (errors.length > 0) {
      status = 'ERROR';
      errorCount++;
    } else if (warnings.length > 0) {
      status = 'WARNING';
      warningCount++;
    } else {
      status = 'READY';
      readyCount++;
    }

    previewRows.push({
      row_number: rowNumber,
      courier_id: rawCourierId,
      courier_name: rawCourierName,
      valid_days: validDays,
      hours_avg: hoursAvg,
      incentive,
      reward,
      food_charge: foodCharge,
      penalty,
      tip,
      source_rider_salary: sourceRiderSalary,
      rider_salary: sourceRiderSalary,
      incentive_adjustment: incentiveAdjustment,
      bike_fine: bikeFine,
      maintenance_others: maintenanceOthers,
      source_deductions: sourceDeductions,
      source_net_payable: sourceNetPayable,
      calculated_net: calculatedNet,
      net_payable_salary: calculatedNet,
      negative_net_review_required: isNegativeNet,
      resolved,
      is_resolved: resolved,
      employee_id: matchedEmployee?.id || null,
      employee_code: matchedEmployee?.employee_code || null,
      employee_name: matchedEmployee?.full_name || null,
      matched_employee: matchedEmployee
        ? {
            id: matchedEmployee.id,
            employee_id: matchedEmployee.id,
            employee_code: matchedEmployee.employee_code,
            full_name: matchedEmployee.full_name,
            emirates_id: matchedEmployee.emirates_id,
            tenant_id: matchedEmployee.tenant_id,
          }
        : null,
      status,
      errors,
      warnings,
      erp_fine_warning: erpFineWarning,
      linked_erp_fine_id: linkedErpFineId,
      double_deduction_status: doubleDeductionStatus,
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
      ? `This exact workbook (${fileName}) has already been committed for Keeta in ${targetMonth}.`
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
      total_valid_days: totalValidDaysSum,
      total_hours_avg: Number(totalHoursAvgSum.toFixed(2)),
      total_incentive: Number(totalIncentiveSum.toFixed(2)),
      total_reward: Number(totalRewardSum.toFixed(2)),
      total_food_charge: Number(totalFoodChargeSum.toFixed(2)),
      total_penalty: Number(totalPenaltySum.toFixed(2)),
      total_tip: Number(totalTipSum.toFixed(2)),
      total_source_rider_salary: Number(totalSourceRiderSalarySum.toFixed(2)),
      total_incentive_adjustment: Number(totalIncentiveAdjustmentSum.toFixed(2)),
      total_bike_fine: Number(totalBikeFineSum.toFixed(2)),
      total_maintenance_others: Number(totalMaintenanceOthersSum.toFixed(2)),
      total_source_net_payable: Number(totalSourceNetPayableSum.toFixed(2)),
      total_calculated_net: Number(totalCalculatedNetSum.toFixed(2)),
    },
    preview_rows: previewRows,
    actor_metadata: {
      validation_run_by: actor.userName,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * 3. COMMIT KEETA PAYROLL BATCH TO UNIFIED PAYROLL ENGINE
 * Normalizes rows into `db.projectSalaryLines` and `db.payrollImportBatches`
 */
export function commitKeetaPayrollBatch(
  db: any,
  tenantId: string,
  month: string,
  batchData: {
    fileName: string;
    fileHash: string;
    rows: KeetaRow[];
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
      b.salary_group === 'KEETA' &&
      b.status === 'COMMITTED'
  );
  if (existingBatch) {
    throw new Error(
      `Workbook with SHA-256 hash ${fileHash} has already been committed for Keeta in ${month}.`
    );
  }

  const batchId = `batch_keeta_${Date.now()}`;

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

  const resolvedRows = rows.filter((r) => r.resolved && r.matched_employee);

  if (resolvedRows.length === 0) {
    throw new Error('No resolved Keeta courier rows available to commit.');
  }

  // Remove existing Keeta project salary lines for these employees in this month to avoid duplicates
  const employeeIdsToUpdate = new Set(resolvedRows.map((r) => r.matched_employee!.id));
  db.projectSalaryLines = (db.projectSalaryLines || []).filter(
    (l: any) =>
      !(
        l.tenant_id === tenantId &&
        l.payroll_month === month &&
        l.project_id === 'proj_keeta_1' &&
        employeeIdsToUpdate.has(l.employee_id)
      )
  );

  // Normalize each row into unified projectSalaryLine schema (Requirement 22 & 23)
  const newSalaryLines = resolvedRows.map((row) => {
    const emp = row.matched_employee!;
    const sourceDeductions = Number(
      (
        (row.food_charge || 0) +
        (row.penalty || 0) +
        (row.bike_fine || 0) +
        (row.maintenance_others || 0)
      ).toFixed(2)
    );
    const finalCalculatedNet = Number(
      (
        (row.source_rider_salary || 0) +
        (row.incentive_adjustment || 0) -
        sourceDeductions
      ).toFixed(2)
    );

    return {
      id: `psl_keeta_${emp.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      employee_id: emp.id,
      employee_code: emp.employee_code,
      employee_name: emp.full_name,
      project_id: 'proj_keeta_1',
      project_name: 'Keeta Express Delivery',
      salary_group: 'KEETA',
      payroll_month: month,
      external_rider_id: row.courier_id,
      external_courier_id: row.courier_id,
      calculation_method: 'CLIENT_IMPORT',
      working_hours: undefined, // Keeta is NOT Labour hourly payroll
      hourly_rate: 0,
      valid_days: row.valid_days,
      hours_avg: row.hours_avg,
      incentive: row.incentive,
      reward: row.reward,
      food_charge: row.food_charge,
      penalty: row.penalty,
      tip: row.tip,
      source_rider_salary: row.source_rider_salary,
      incentive_adjustment: row.incentive_adjustment,
      source_bike_fine: row.bike_fine,
      maintenance_other: row.maintenance_others,
      source_net_payable: row.source_net_payable,
      source_batch_id: batchId,
      source_row_reference: `Row ${row.row_number}`,
      gross_earning: row.source_rider_salary,
      gross_earnings: row.source_rider_salary,
      manual_deduction: sourceDeductions,
      net_payable: finalCalculatedNet,
      calculated_payroll_net: finalCalculatedNet,
      supporting_details: {
        template_type: 'KEETA_EXCEL_PAYROLL',
        source_profile: 'KEETA',
        source_file: fileName,
        batch_id: batchId,
        courier_id: row.courier_id,
        courier_name: row.courier_name,
        valid_days: row.valid_days,
        hours_avg: row.hours_avg,
        incentive: row.incentive,
        reward: row.reward,
        food_charge: row.food_charge,
        penalty: row.penalty,
        tip: row.tip,
        source_rider_salary: row.source_rider_salary,
        incentive_adjustment: row.incentive_adjustment,
        source_bike_fine: row.bike_fine,
        maintenance_others: row.maintenance_others,
        source_deductions: sourceDeductions,
        source_net_payable: row.source_net_payable,
        final_calculated_net: finalCalculatedNet,
        negative_net_review_required: finalCalculatedNet < 0,
        linked_erp_fine_id: row.linked_erp_fine_id || null,
        double_deduction_status: row.double_deduction_status || 'NO_CONFLICT',
        erp_fine_warning: row.erp_fine_warning || null,
        uploaded_by: actor.userName,
        uploaded_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  db.projectSalaryLines.push(...newSalaryLines);

  // Record batch in db.payrollImportBatches
  const newBatch = {
    id: batchId,
    tenant_id: tenantId,
    payroll_month: month,
    salary_group: 'KEETA',
    project_id: 'proj_keeta_1',
    project_name: 'Keeta Express Delivery',
    source_file: fileName,
    file_name: fileName,
    file_hash: fileHash,
    status: 'COMMITTED',
    uploaded_by: actor.userName,
    created_by: actor.userName,
    total_rows: rows.length,
    imported_rows: resolvedRows.length,
    skipped_rows: rows.length - resolvedRows.length,
    valid_rows: resolvedRows.length,
    warning_rows: rows.filter((r) => r.status === 'WARNING').length,
    error_rows: rows.filter((r) => r.status === 'ERROR' || r.status === 'UNRESOLVED RIDER').length,
    reconciliation,
    created_at: new Date().toISOString(),
    imported_at: new Date().toISOString(),
  };

  db.payrollImportBatches.push(newBatch);

  // Update projectImportProfiles for Keeta
  const keetaProfile = (db.projectImportProfiles || []).find(
    (p: any) => p.salary_group === 'KEETA' || p.id === 'prof_keeta'
  );
  if (keetaProfile) {
    keetaProfile.status = 'SOURCE_FORMAT_RECEIVED';
    keetaProfile.status_note =
      'Verified official KEETA Payroll Excel format (.xlsx) with exact 14 columns: Courier ID, Courier Name, Valid Days, Hours Avg, Incentive, Reward, Food Charge, Penalty, Tip, Rider Salary, Incentive Adjustment, Bike Fine, Maintenance / Others, Net Payable Salary.';
    keetaProfile.updated_at = new Date().toISOString();
  }

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
        (pl: any) => pl.id !== line.id && pl.project_id !== 'proj_keeta_1'
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
        gross_salary: Number(line.source_rider_salary || 0),
        gross_earnings: Number(line.source_rider_salary || 0),
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

  // Record audit log
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift({
    id: `log_keeta_${Date.now()}`,
    tenantId,
    timestamp: new Date().toISOString(),
    userName: actor.userName,
    userId: actor.userId,
    userRole: actor.userRole,
    module: 'Payroll Engine',
    action: 'IMPORT_COMMITTED',
    details: `Committed Keeta Excel payroll batch [${batchId}] for ${month} with ${resolvedRows.length} couriers. Source Rider Salary: AED ${reconciliation?.total_source_rider_salary?.toFixed(2) || '0.00'}. Net Payable: AED ${reconciliation?.total_calculated_net?.toFixed(2) || '0.00'}.`,
    ipAddress: '127.0.0.1',
  });

  return {
    success: true,
    batch_id: batchId,
    message: `Successfully committed ${resolvedRows.length} Keeta courier salary lines for ${month}.`,
    imported_rows: resolvedRows.length,
    reconciliation,
  };
}
