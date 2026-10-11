import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';

/**
 * Service to generate the official, enterprise-grade Vehicle Bulk Import template.
 * Filename: allied_fleet_vehicles_template.xlsx / .csv
 *
 * Vehicle Master ONLY (Strictly No Rider or Project Assignment columns).
 * Contains the 21 required fleet columns:
 * 1. Plate Number
 * 2. Plate Code
 * 3. Emirate
 * 4. Vehicle Type
 * 5. Make / Brand
 * 6. Model
 * 7. Manufacturing Year
 * 8. Chassis Number
 * 9. TC Number
 * 10. Mulkiya / Registration Number
 * 11. Mulkiya Expiry Date
 * 12. Insurance Number
 * 13. Insurance Expiry Date
 * 14. Ownership Type
 * 15. Vendor / Owner
 * 16. Branch
 * 17. Current Odometer (KM)
 * 18. Next Service Due (KM)
 * 19. GPS Tracker Device ID
 * 20. Vehicle Working Status
 * 21. Remarks
 */

export interface VehicleTemplateOptions {
  author?: string;
  companyName?: string;
}

export const VEHICLE_IMPORT_HEADERS = [
  'Plate Number',
  'Plate Code',
  'Emirate',
  'Vehicle Type',
  'Make / Brand',
  'Model',
  'Manufacturing Year',
  'Chassis Number',
  'TC Number',
  'Mulkiya / Registration Number',
  'Mulkiya Expiry Date',
  'Insurance Number',
  'Insurance Expiry Date',
  'Ownership Type',
  'Vendor / Owner',
  'Branch',
  'Current Odometer (KM)',
  'Next Service Due (KM)',
  'GPS Tracker Device ID',
  'Vehicle Working Status',
  'Remarks',
];

export async function generateVehicleXlsxTemplate(
  options: VehicleTemplateOptions = {}
): Promise<Buffer> {
  const author = options.author || 'Allied Enterprise Fleet ERP';
  const company = options.companyName || 'Pixel Syntax Delivery Software.';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = author;
  workbook.lastModifiedBy = author;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = company;

  const worksheet = workbook.addWorksheet('Vehicle Master', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A2' }],
    pageSetup: { fitToPage: true, orientation: 'landscape', paperSize: 9 },
  });

  worksheet.columns = [
    { header: 'Plate Number', key: 'plate_number', width: 18, style: { numFmt: '@' } },
    { header: 'Plate Code', key: 'plate_code', width: 14, style: { numFmt: '@' } },
    { header: 'Emirate', key: 'emirate', width: 16 },
    { header: 'Vehicle Type', key: 'vehicle_type', width: 18 },
    { header: 'Make / Brand', key: 'make', width: 20 },
    { header: 'Model', key: 'model', width: 20 },
    { header: 'Manufacturing Year', key: 'year', width: 20 },
    { header: 'Chassis Number', key: 'chassis_number', width: 26, style: { numFmt: '@' } },
    { header: 'TC Number', key: 'tc_number', width: 20, style: { numFmt: '@' } },
    { header: 'Mulkiya / Registration Number', key: 'registration_number', width: 28, style: { numFmt: '@' } },
    { header: 'Mulkiya Expiry Date', key: 'registration_expiry', width: 22, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Insurance Number', key: 'insurance_number', width: 24, style: { numFmt: '@' } },
    { header: 'Insurance Expiry Date', key: 'insurance_expiry', width: 22, style: { numFmt: 'yyyy-mm-dd' } },
    { header: 'Ownership Type', key: 'ownership_type', width: 18 },
    { header: 'Vendor / Owner', key: 'vendor_name', width: 28 },
    { header: 'Branch', key: 'branch_name', width: 26 },
    { header: 'Current Odometer (KM)', key: 'current_odometer', width: 24 },
    { header: 'Next Service Due (KM)', key: 'next_service_due', width: 24 },
    { header: 'GPS Tracker Device ID', key: 'gps_device_id', width: 24, style: { numFmt: '@' } },
    { header: 'Vehicle Working Status', key: 'working_status', width: 24 },
    { header: 'Remarks', key: 'remarks', width: 30 },
  ];

  // Header row styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });

  // Sample fleet bike rows for guidance
  const sampleRows = [
    {
      plate_number: '98214',
      plate_code: 'T',
      emirate: 'Dubai',
      vehicle_type: 'Motorcycle',
      make: 'Honda',
      model: 'CD110',
      year: 2024,
      chassis_number: 'ME4JF50E0J800101',
      tc_number: 'TC-982134',
      registration_number: 'MUL-982140',
      registration_expiry: '2027-10-31',
      insurance_number: 'INS-POL-8821',
      insurance_expiry: '2027-11-15',
      ownership_type: 'OWNED',
      vendor_name: 'Pixel Syntax Delivery Software',
      branch_name: 'Dubai Central Hub (Al Quoz)',
      current_odometer: 1250,
      next_service_due: 4000,
      gps_device_id: 'GPS-TRK-8821',
      working_status: 'Available',
      remarks: 'Primary operational bike',
    },
    {
      plate_number: '98215',
      plate_code: 'T',
      emirate: 'Dubai',
      vehicle_type: 'Motorcycle',
      make: 'Bajaj',
      model: 'Pulsar 150',
      year: 2024,
      chassis_number: 'MD2DS1234P800102',
      tc_number: 'TC-982135',
      registration_number: 'MUL-982150',
      registration_expiry: '2027-12-31',
      insurance_number: 'INS-POL-8822',
      insurance_expiry: '2028-01-15',
      ownership_type: 'LEASED',
      vendor_name: 'Fast Rent A Car',
      branch_name: 'Abu Dhabi Hub (Mussafah)',
      current_odometer: 3400,
      next_service_due: 6000,
      gps_device_id: 'GPS-TRK-8822',
      working_status: 'Available',
      remarks: 'Delivery bracket attached',
    },
  ];

  sampleRows.forEach((row) => {
    const addedRow = worksheet.addRow(row);
    addedRow.height = 22;
    addedRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function generateVehicleCsvTemplate(): string {
  const sample1 = [
    '98214',
    'T',
    'Dubai',
    'Motorcycle',
    'Honda',
    'CD110',
    '2024',
    'ME4JF50E0J800101',
    'TC-982134',
    'MUL-982140',
    '2027-10-31',
    'INS-POL-8821',
    '2027-11-15',
    'OWNED',
    '"Pixel Syntax Delivery Software"',
    '"Dubai Central Hub (Al Quoz)"',
    '1250',
    '4000',
    'GPS-TRK-8821',
    'Available',
    '"Primary operational bike"',
  ].join(',');

  const sample2 = [
    '98215',
    'T',
    'Dubai',
    'Motorcycle',
    'Bajaj',
    'Pulsar 150',
    '2024',
    'MD2DS1234P800102',
    'TC-982135',
    'MUL-982150',
    '2027-12-31',
    'INS-POL-8822',
    '2028-01-15',
    'LEASED',
    '"Fast Rent A Car"',
    '"Abu Dhabi Hub (Mussafah)"',
    '3400',
    '6000',
    'GPS-TRK-8822',
    'Available',
    '"Delivery bracket attached"',
  ].join(',');

  return [VEHICLE_IMPORT_HEADERS.join(','), sample1, sample2].join('\n');
}

/**
 * Robust date sanitizer that safely parses Excel serial numbers,
 * DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, and textual dates into ISO YYYY-MM-DD.
 * Returns null if the value is invalid or a placeholder.
 */
export function sanitizeDateToYmd(val: any): string | null {
  if (val === null || val === undefined) return null;

  // Handle Excel numeric serial dates (e.g. 45000)
  if (typeof val === 'number' && val > 20000 && val < 80000) {
    try {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // fallback
    }
  }

  const str = String(val).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    lower === 'n/a' ||
    lower === 'na' ||
    lower === '-' ||
    lower === '--' ||
    lower === 'null' ||
    lower === 'nil' ||
    lower === 'none' ||
    lower === '0'
  ) {
    return null;
  }

  // 1. Try YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Try DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (very common in UAE/legacy sheets)
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1990 && y <= 2100) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // 3. Fallback to JavaScript Date.parse
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    try {
      const d = new Date(parsed);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch {
      // fallback
    }
  }

  return null;
}

/**
 * Normalizes Chassis (VIN) number.
 * Returns clean uppercase string or null if empty or placeholder ('-', 'N/A', etc.).
 * In PostgreSQL, null chassis numbers NEVER violate UNIQUE(tenant_id, chassis_number).
 */
export function cleanChassisNumber(raw?: any): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toUpperCase();
  const placeholders = [
    '-',
    '--',
    '---',
    'N/A',
    'NA',
    'NONE',
    'NULL',
    'NIL',
    '0',
    'TBD',
    'NOT APPLICABLE',
    'NOT SPECIFIED',
    'EMPTY',
    'UNKNOWN',
  ];
  if (s.length === 0 || placeholders.includes(s)) {
    return null;
  }
  return s;
}

/**
 * Normalizes ownership type to enum supported by schema (OWNED, LEASED, RENTED).
 */
export function normalizeOwnershipType(raw?: any): 'OWNED' | 'LEASED' | 'RENTED' {
  const s = String(raw || '').trim().toUpperCase();
  if (s.includes('LEASE')) return 'LEASED';
  if (s.includes('RENT')) return 'RENTED';
  if (s.includes('VENDOR') || s.includes('THIRD') || s.includes('SUPPLI')) return 'LEASED';
  return 'OWNED';
}

/**
 * Normalizes vehicle working status into both DB check constraint status
 * ('AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE') and UI Operational status.
 */
export function normalizeVehicleWorkingStatus(raw?: any): {
  dbStatus: 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';
  uiStatus: string;
} {
  const s = String(raw || '').trim().toLowerCase();
  if (
    s.includes('maint') ||
    s.includes('workshop') ||
    s.includes('repair') ||
    s.includes('garage') ||
    s.includes('service')
  ) {
    return { dbStatus: 'MAINTENANCE', uiStatus: 'In Maintenance' };
  }
  if (
    s.includes('out') ||
    s.includes('break') ||
    s.includes('accident') ||
    s.includes('scrap') ||
    s.includes('inactive') ||
    s.includes('decom') ||
    s.includes('lost') ||
    s.includes('sold') ||
    s.includes('damage')
  ) {
    return { dbStatus: 'OUT_OF_SERVICE', uiStatus: 'Out of Service' };
  }
  // Default: available for active/working/standby/spare bikes
  return { dbStatus: 'AVAILABLE', uiStatus: 'Available' };
}

/**
 * Resolves branch name to known branch foreign key ID safely.
 * Returns null if no exact foreign key match, preventing FK constraint violations.
 */
export function resolveBranchId(
  rawBranch?: any,
  knownBranches: any[] = []
): { branchId: string | null; branchName: string } {
  const bStr = String(rawBranch || '').trim();
  const lower = bStr.toLowerCase();

  // 1. Direct match on known branches (by id, code, or name)
  if (knownBranches && knownBranches.length > 0) {
    const directMatch = knownBranches.find(
      (b: any) =>
        (b.id && b.id.toLowerCase() === lower) ||
        (b.code && b.code.toLowerCase() === lower) ||
        (b.name && b.name.toLowerCase() === lower)
    );
    if (directMatch) {
      return { branchId: directMatch.id, branchName: directMatch.name };
    }
  }

  // 2. Standard Allied branches mapping
  if (lower.includes('dubai') || lower.includes('dxb') || lower.includes('quoz') || lower.includes('central')) {
    return { branchId: 'b_dxb', branchName: 'Dubai Head Office & Logistics Center' };
  }
  if (lower.includes('abu dhabi') || lower.includes('auh') || lower.includes('mussafah')) {
    return { branchId: 'b_auh', branchName: 'Abu Dhabi Operations Branch' };
  }
  if (lower.includes('sharjah') || lower.includes('shj') || lower.includes('northern')) {
    return { branchId: 'b_shj', branchName: 'Sharjah & Northern Emirates Hub' };
  }

  // Default fallback: keep branch_id null to prevent foreign key constraint violations
  return { branchId: null, branchName: bStr || 'Dubai Head Office & Logistics Center' };
}

/**
 * Dissects Postgres error objects and categorizes root cause, failing column, and value.
 */
export function categorizeDbError(err: any): {
  cause: string;
  column: string;
  value: string;
  details: string;
} {
  const msg = String(err?.message || '');
  const code = String(err?.code || '');
  const details = String(err?.details || err?.hint || '');
  const combined = `${msg} ${details}`;

  // Unique constraint (e.g. uq_vehicles_tenant_chassis)
  if (code === '23505' || combined.includes('duplicate key') || combined.includes('unique constraint')) {
    const keyMatch = combined.match(/Key \(([^)]+)\)=\(([^)]+)\)/i);
    return {
      cause: 'UNIQUE_CHASSIS_CONFLICT',
      column: keyMatch ? keyMatch[1] : 'chassis_number',
      value: keyMatch ? keyMatch[2] : '',
      details: details || msg,
    };
  }

  // Missing column (e.g. 42703 column "insurance_number" does not exist)
  if (code === '42703' || combined.includes('does not exist')) {
    const colMatch = combined.match(/column "([^"]+)"/i);
    return {
      cause: 'COLUMN_NOT_FOUND',
      column: colMatch ? colMatch[1] : '',
      value: '',
      details: details || msg,
    };
  }

  // Foreign key violation (e.g. 23503 branch_id)
  if (code === '23503' || combined.includes('foreign key constraint')) {
    const fkMatch = combined.match(/Key \(([^)]+)\)=\(([^)]+)\)/i);
    return {
      cause: 'FOREIGN_KEY_VIOLATION',
      column: fkMatch ? fkMatch[1] : 'branch_id',
      value: fkMatch ? fkMatch[2] : '',
      details: details || msg,
    };
  }

  // Invalid date format (e.g. 22007 or 22008)
  if (code === '22007' || code === '22008' || combined.includes('date/time')) {
    return {
      cause: 'INVALID_DATE_FORMAT',
      column: combined.includes('expiry') ? 'expiry_date' : 'date_field',
      value: '',
      details: details || msg,
    };
  }

  // Check constraint (e.g. 23514)
  if (code === '23514' || combined.includes('check constraint')) {
    return {
      cause: 'CHECK_CONSTRAINT_VIOLATION',
      column: 'status_or_type',
      value: '',
      details: details || msg,
    };
  }

  // Not null constraint (e.g. 23502)
  if (code === '23502' || combined.includes('not-null constraint')) {
    const colMatch = combined.match(/column "([^"]+)"/i);
    return {
      cause: 'NOT_NULL_VIOLATION',
      column: colMatch ? colMatch[1] : '',
      value: '',
      details: details || msg,
    };
  }

  return {
    cause: 'GENERAL_DATABASE_ERROR',
    column: '',
    value: '',
    details: details || msg,
  };
}

export interface VehicleBulkImportRowError {
  rowNumber: number;
  plate_number: string;
  chassis_number: string;
  attemptedPayload?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: string;
  failingColumn?: string;
  failingValue?: any;
  cause?: string;
  error: string;
}

export interface VehicleBulkImportSummary {
  totalRows: number;
  validRows: number;
  duplicateChassis: number;
  existingChassisConflicts: number;
  missingRequired: number;
  readyToImport: number;
  valid: number;
  duplicatePlate: number;
  existingConflicts: number;
  duplicates: {
    plates: string[];
    chassis: string[];
  };
  conflicts: number[];
  missing: number[];
}

export interface VehicleBulkImportRow {
  rowNumber: number;
  plate_number: string;
  plate_code: string;
  plate_emirate: string;
  vehicle_type: string;
  make: string;
  model: string;
  year: number;
  chassis_number: string;
  tc_number: string;
  registration_number: string;
  registration_expiry: string;
  insurance_number: string;
  insurance_expiry: string;
  ownership_type: string;
  vendor_name: string;
  branch_name: string;
  current_odometer: number;
  next_service_due: number;
  gps_device_id: string;
  working_status: string;
  remarks: string;
  assigned_rider: null;
  rider_code: null;
  project: null;
  errors: string[];
}

export interface VehicleBulkImportValidationResult {
  summary: VehicleBulkImportSummary;
  rows: VehicleBulkImportRow[];
}

export interface VehicleBulkImportCommitResult {
  success: boolean;
  totalSourceRows: number;
  readyToImport: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  totalVehiclesAfterImport: number;
  totalVehiclesInSupabase?: number;
  sourceRows?: number;
  alreadyExisting?: number;
  newlyImported?: number;
  failed?: number;
  rowErrors: VehicleBulkImportRowError[];
  importedVehicles: { id: string; plate_number: string; vehicle_code: string }[];
  failureSummaryByCause?: Record<
    string,
    { count: number; description: string; samplePlates: string[]; sampleRows: number[] }
  >;
  simulation?: boolean;
}

/**
 * Shared pre-import validation logic
 * Used by both Express routes and Cloudflare Worker production routes.
 * Supports BOTH XLSX and CSV buffers natively.
 */
export async function validateVehicleBulkImport(
  fileBuffer: Buffer | Uint8Array,
  options: { supabase?: any; db?: any } = {}
): Promise<VehicleBulkImportValidationResult> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('No file uploaded. Please provide an XLSX or CSV file.');
  }

  const buf = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  // Read buffer using SheetJS which supports both XLSX and CSV natively
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true, raw: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('The uploaded workbook does not contain any sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (sheetData.length === 0) {
    throw new Error('The uploaded file is empty.');
  }

  // Detect header row
  const headerRow = sheetData[0].map((h: any) => String(h || '').trim());
  const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Build header map
  const colMap: Record<string, number> = {};
  headerRow.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (norm) colMap[norm] = idx;
  });

  const findCol = (aliases: string[], fallbackIdx: number): number => {
    for (const alias of aliases) {
      const norm = normalizeHeader(alias);
      if (colMap[norm] !== undefined) return colMap[norm];
    }
    return fallbackIdx < headerRow.length ? fallbackIdx : -1;
  };

  const idxPlate = findCol(['platenumber', 'plate', 'plateno', 'regno', 'vehicleplate'], 0);
  const idxPlateCode = findCol(['platecode', 'code', 'category'], 1);
  const idxEmirate = findCol(['emirate', 'plateemirate', 'state', 'registrationstate'], 2);
  const idxVehicleType = findCol(['vehicletype', 'type'], 3);
  const idxMake = findCol(['makebrand', 'make', 'brand', 'vehiclebrand'], 4);
  const idxModel = findCol(['model', 'vehiclemodel'], 5);
  const idxYear = findCol(['manufacturingyear', 'year', 'mfgyear'], 6);
  const idxChassis = findCol(['chassisnumber', 'chassis', 'vin', 'chassisno'], 7);
  const idxTcNumber = findCol(['tcnumber', 'tc', 'trafficfilenumber', 'tcno', 'trafficfile'], 8);
  const idxMulkiya = findCol(
    ['mulkiyaregistrationnumber', 'mulkiyanumber', 'registrationnumber', 'mulkiya', 'cardnumber'],
    9
  );
  const idxMulkiyaExpiry = findCol(
    ['mulkiyaexpirydate', 'mulkiyaexpiry', 'registrationexpiry', 'registrationexpirydate'],
    10
  );
  const idxInsurance = findCol(
    ['insurancenumber', 'insurancepolicy', 'policynumber', 'insurancepolicynumber'],
    11
  );
  const idxInsuranceExpiry = findCol(['insuranceexpirydate', 'insuranceexpiry'], 12);
  const idxOwnership = findCol(['ownershiptype', 'ownership', 'vehicleownertype'], 13);
  const idxVendor = findCol(['vendorowner', 'vendor', 'owner', 'vendorname', 'ownerorvendor'], 14);
  const idxBranch = findCol(['branch', 'depot', 'branchname', 'depotbranch'], 15);
  const idxOdometer = findCol(['currentodometerkm', 'currentodometer', 'startingodometer', 'odometer', 'km'], 16);
  const idxNextService = findCol(['nextserviceduekm', 'nextservicedue', 'servicedue'], 17);
  const idxGps = findCol(['gpstrackerdeviceid', 'gpsdeviceid', 'gpsid', 'trackerid'], 18);
  const idxStatus = findCol(['vehicleworkingstatus', 'workingstatus', 'status', 'currentstatus'], 19);
  const idxRemarks = findCol(['remarks', 'notes', 'comments'], 20);

  const getVal = (row: any[], colIdx: number): string => {
    if (colIdx < 0 || colIdx >= row.length) return '';
    const v = row[colIdx];
    if (v === null || v === undefined) return '';
    return String(v).trim();
  };

  const rawDataRows = sheetData.slice(1);
  const rows: VehicleBulkImportRow[] = [];

  rawDataRows.forEach((r, i) => {
    // Skip completely empty rows
    const hasContent = r.some((c: any) => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasContent) return;

    const rowNumber = i + 2;
    const plate = getVal(r, idxPlate);
    const rawChassis = getVal(r, idxChassis);
    const cleanChassis = cleanChassisNumber(rawChassis) || '';

    const rawYear = getVal(r, idxYear);
    const yearDigits = rawYear.replace(/[^0-9]/g, '');
    let yearNum = 2024;
    if (yearDigits.length === 4) {
      yearNum = parseInt(yearDigits, 10);
    } else if (yearDigits.length === 2) {
      const short = parseInt(yearDigits, 10);
      yearNum = short > 50 ? 1900 + short : 2000 + short;
    }

    const rawOdo = getVal(r, idxOdometer);
    const odoNum = Number(rawOdo.replace(/[^0-9.]/g, '')) || 0;

    const rawNextService = getVal(r, idxNextService);
    const nextServiceNum = Number(rawNextService.replace(/[^0-9.]/g, '')) || odoNum + 3000;

    const regExpiry = sanitizeDateToYmd(getVal(r, idxMulkiyaExpiry)) || '';
    const insExpiry = sanitizeDateToYmd(getVal(r, idxInsuranceExpiry)) || '';

    rows.push({
      rowNumber,
      plate_number: plate,
      plate_code: getVal(r, idxPlateCode) || 'T',
      plate_emirate: getVal(r, idxEmirate) || 'Dubai',
      vehicle_type: getVal(r, idxVehicleType) || 'Motorcycle',
      make: getVal(r, idxMake) || 'Honda',
      model: getVal(r, idxModel) || 'Standard',
      year: yearNum,
      chassis_number: cleanChassis,
      tc_number: getVal(r, idxTcNumber),
      registration_number: getVal(r, idxMulkiya),
      registration_expiry: regExpiry,
      insurance_number: getVal(r, idxInsurance),
      insurance_expiry: insExpiry,
      ownership_type: normalizeOwnershipType(getVal(r, idxOwnership)),
      vendor_name: getVal(r, idxVendor) || 'Pixel Syntax Delivery Software',
      branch_name: getVal(r, idxBranch) || 'Dubai Central Hub (Al Quoz)',
      current_odometer: odoNum,
      next_service_due: nextServiceNum,
      gps_device_id: getVal(r, idxGps),
      working_status: getVal(r, idxStatus) || 'Available',
      remarks: getVal(r, idxRemarks),
      // Production safety: strictly NO rider / project assignments imported
      assigned_rider: null,
      rider_code: null,
      project: null,
      errors: [] as string[],
    });
  });

  const totalRows = rows.length;

  // 1. Gather all existing production vehicles (Allied tenant)
  const existingPlates = new Set<string>();
  const existingChassis = new Set<string>();

  const db = options.db;
  if (db) {
    (db.fleetVehicles || []).forEach((v: any) => {
      if (v.plate_number) existingPlates.add(String(v.plate_number).trim().toUpperCase());
      const c = cleanChassisNumber(v.chassis_number);
      if (c) existingChassis.add(c);
    });
    (db.vehicles || []).forEach((v: any) => {
      if (v.plate_number) existingPlates.add(String(v.plate_number).trim().toUpperCase());
      const c = cleanChassisNumber(v.chassis_number);
      if (c) existingChassis.add(c);
    });
  }

  const supabase = options.supabase;
  if (supabase) {
    try {
      const { data: sbVehicles } = await supabase
        .from('vehicles')
        .select('plate_number, chassis_number')
        .eq('tenant_id', 'company_pixel_syntax');
      if (Array.isArray(sbVehicles)) {
        sbVehicles.forEach((v: any) => {
          if (v.plate_number) existingPlates.add(String(v.plate_number).trim().toUpperCase());
          const c = cleanChassisNumber(v.chassis_number);
          if (c) existingChassis.add(c);
        });
      }
    } catch (err) {
      console.warn('Could not check Supabase vehicles during validate:', err);
    }
  }

  // 2. Count occurrences within file for duplicate checks
  const plateCounts: Record<string, number> = {};
  const chassisCounts: Record<string, number> = {};

  rows.forEach((r) => {
    if (r.plate_number) {
      const p = r.plate_number.toUpperCase();
      plateCounts[p] = (plateCounts[p] || 0) + 1;
    }
    // Only count non-empty, non-placeholder chassis numbers
    const c = cleanChassisNumber(r.chassis_number);
    if (c) {
      chassisCounts[c] = (chassisCounts[c] || 0) + 1;
    }
  });

  let duplicatePlateCount = 0;
  let duplicateChassisCount = 0;
  let existingChassisConflictsCount = 0;
  let missingRequiredCount = 0;
  let validCount = 0;

  rows.forEach((row) => {
    const pUpper = row.plate_number ? row.plate_number.toUpperCase() : '';
    const cClean = cleanChassisNumber(row.chassis_number);

    let hasError = false;

    // Missing required: Plate Number
    if (!pUpper) {
      row.errors.push('Missing Plate Number');
      missingRequiredCount++;
      hasError = true;
    }

    // Business rule: Plate Number is NOT unique. Two bikes/vehicles may share the same Plate Number.
    // Duplicate plate within file: informational warning only, MUST NOT block import!
    if (pUpper && plateCounts[pUpper] > 1) {
      duplicatePlateCount++;
    }

    // Duplicate chassis in file: BLOCKING conflict
    // Chassis Number MUST be unique if present.
    if (cClean && chassisCounts[cClean] > 1) {
      row.errors.push(`Duplicate chassis in uploaded file (${chassisCounts[cClean]} occurrences)`);
      duplicateChassisCount++;
      hasError = true;
    }

    // Production conflicts: Chassis Number MUST be unique across company_pixel_syntax
    // Plate duplicate against existing production fleet does NOT block import.
    const isChassisConflict = cClean && existingChassis.has(cClean);
    if (isChassisConflict) {
      row.errors.push('Chassis VIN already registered in production fleet');
      existingChassisConflictsCount++;
      hasError = true;
    }

    if (!hasError) {
      validCount++;
    }
  });

  const readyToImport = validCount;

  return {
    summary: {
      totalRows,
      validRows: validCount,
      duplicateChassis: duplicateChassisCount,
      existingChassisConflicts: existingChassisConflictsCount,
      missingRequired: missingRequiredCount,
      readyToImport,
      // Backward compatibility mappings
      valid: validCount,
      duplicatePlate: duplicatePlateCount,
      existingConflicts: existingChassisConflictsCount,
      duplicates: {
        plates: Object.keys(plateCounts).filter((p) => plateCounts[p] > 1),
        chassis: Object.keys(chassisCounts).filter((c) => chassisCounts[c] > 1),
      },
      conflicts: existingChassisConflictsCount > 0 ? Array(existingChassisConflictsCount).fill(1) : [],
      missing: missingRequiredCount > 0 ? Array(missingRequiredCount).fill(1) : [],
    },
    rows,
  };
}

/**
 * Shared vehicle bulk import commit logic
 * - company_pixel_syntax only
 * - Persists to Supabase production vehicles table & updates in-memory fleet master if provided
 * - Commits ONLY rows marked READY / VALID
 * - Strictly NO auto-assignment of riders or projects
 * - No deletes, resets, or overwrites
 * - Retry safety: vehicles already imported are safely skipped
 * - Dry-run simulation support: options.dryRun === true
 */
export async function commitVehicleBulkImport(
  rows: any[],
  options: { supabase?: any; db?: any; dryRun?: boolean } = {}
): Promise<VehicleBulkImportCommitResult> {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('No vehicle rows provided for commit');
  }

  const tenantId = 'company_pixel_syntax'; // STRICT PRODUCTION TENANT ISOLATION
  const totalSourceRows = rows.length;
  const isDryRun = Boolean(options.dryRun);

  // 1. Gather all existing production vehicle identifiers to guarantee conflict avoidance
  const existingPlates = new Set<string>();
  const existingChassis = new Set<string>();
  const existingVehicleSignatures = new Set<string>();

  const buildSig = (plate: string, code?: string, emirate?: string, chassis?: string | null) => {
    return `${plate.toUpperCase()}|${(code || '').toUpperCase()}|${(emirate || '').toUpperCase()}|${
      chassis ? chassis.toUpperCase() : 'NO_CHASSIS'
    }`;
  };

  const db = options.db;
  if (db) {
    (db.fleetVehicles || []).forEach((v: any) => {
      const p = String(v.plate_number || '').trim().toUpperCase();
      if (p) existingPlates.add(p);
      const c = cleanChassisNumber(v.chassis_number);
      if (c) existingChassis.add(c);
      if (p) existingVehicleSignatures.add(buildSig(p, v.plate_code, v.plate_emirate, c));
    });
    (db.vehicles || []).forEach((v: any) => {
      const p = String(v.plate_number || '').trim().toUpperCase();
      if (p) existingPlates.add(p);
      const c = cleanChassisNumber(v.chassis_number);
      if (c) existingChassis.add(c);
      if (p) existingVehicleSignatures.add(buildSig(p, v.plate_code, v.plate_emirate, c));
    });
  }

  const supabase = options.supabase;
  if (supabase) {
    try {
      const { data: sbVehicles } = await supabase
        .from('vehicles')
        .select('id, vehicle_id, plate_number, plate_code, plate_emirate, chassis_number')
        .eq('tenant_id', tenantId);

      if (Array.isArray(sbVehicles)) {
        sbVehicles.forEach((v: any) => {
          const p = String(v.plate_number || '').trim().toUpperCase();
          if (p) existingPlates.add(p);
          const c = cleanChassisNumber(v.chassis_number);
          if (c) existingChassis.add(c);
          if (p) existingVehicleSignatures.add(buildSig(p, v.plate_code, v.plate_emirate, c));
        });
      }
    } catch (err) {
      console.warn('Could not pre-fetch Supabase vehicles for commit check:', err);
    }
  }

  // Fetch known branches for branch_id resolution
  let knownBranches: any[] = [];
  if (db && Array.isArray(db.branches)) {
    knownBranches = db.branches;
  } else if (supabase) {
    try {
      const { data: bData } = await supabase.from('branches').select('id, code, name').eq('tenant_id', tenantId);
      if (Array.isArray(bData)) knownBranches = bData;
    } catch {
      // fallback
    }
  }

  // 2. Count occurrences within file for duplicate checks
  const plateCounts: Record<string, number> = {};
  const chassisCounts: Record<string, number> = {};

  rows.forEach((r: any) => {
    const p = String(r.plate_number || '').trim().toUpperCase();
    if (p) plateCounts[p] = (plateCounts[p] || 0) + 1;
    const c = cleanChassisNumber(r.chassis_number);
    if (c) chassisCounts[c] = (chassisCounts[c] || 0) + 1;
  });

  // 3. Filter strictly: Commit ONLY rows marked READY / VALID
  // Retry safety: Skip already imported vehicles cleanly without error
  const readyRows: any[] = [];
  let skippedCount = 0;
  const committedChassisInBatch = new Set<string>();

  rows.forEach((row: any) => {
    const plate = String(row.plate_number || '').trim();
    const cleanChassis = cleanChassisNumber(row.chassis_number);

    // Check missing required plate
    if (!plate) {
      skippedCount++;
      return;
    }

    // Business rule: Plate Number is NOT unique. Two bikes/vehicles may share the same Plate Number.
    // Duplicate plate within file or production is ALLOWED! Do not skip!

    // Check duplicate chassis in file (only for real chassis numbers)
    if (cleanChassis && chassisCounts[cleanChassis] > 1) {
      skippedCount++;
      return;
    }

    // Check existing production conflicts / retry safety (already imported)
    if (cleanChassis && existingChassis.has(cleanChassis)) {
      // Cleanly skip: already imported in live production database
      skippedCount++;
      return;
    }

    // Check signature for rows without chassis to avoid duplicating already-imported records on retry
    const sig = buildSig(plate, row.plate_code, row.plate_emirate, cleanChassis);
    if (!cleanChassis && existingVehicleSignatures.has(sig)) {
      skippedCount++;
      return;
    }

    if (cleanChassis && committedChassisInBatch.has(cleanChassis)) {
      skippedCount++;
      return;
    }

    // Check if row already had validation errors
    if (Array.isArray(row.errors) && row.errors.length > 0) {
      skippedCount++;
      return;
    }

    if (cleanChassis) {
      committedChassisInBatch.add(cleanChassis);
    }

    readyRows.push(row);
  });

  const readyToImport = readyRows.length;
  let importedCount = 0;
  let failedCount = 0;
  const rowErrors: VehicleBulkImportRowError[] = [];
  const importedVehicles: any[] = [];
  const failureSummaryByCause: Record<
    string,
    { count: number; description: string; samplePlates: string[]; sampleRows: number[] }
  > = {};

  const recordFailure = (errorItem: VehicleBulkImportRowError) => {
    failedCount++;
    rowErrors.push(errorItem);
    const causeKey = errorItem.cause || 'GENERAL_DATABASE_ERROR';
    if (!failureSummaryByCause[causeKey]) {
      failureSummaryByCause[causeKey] = {
        count: 0,
        description: errorItem.errorMessage || 'Database error',
        samplePlates: [],
        sampleRows: [],
      };
    }
    failureSummaryByCause[causeKey].count++;
    if (failureSummaryByCause[causeKey].samplePlates.length < 5) {
      failureSummaryByCause[causeKey].samplePlates.push(errorItem.plate_number);
    }
    if (failureSummaryByCause[causeKey].sampleRows.length < 5) {
      failureSummaryByCause[causeKey].sampleRows.push(errorItem.rowNumber);
    }
  };

  // 4. Batch commit (Batch bulk insert for Cloudflare Worker subrequest safety)
  // To strictly comply with Cloudflare Workers subrequest limit (max 50 per invocation),
  // we do a single bulk insert per batch instead of sequential individual network requests per row.
  const BATCH_SIZE = 50;

  for (let i = 0; i < readyRows.length; i += BATCH_SIZE) {
    const batch = readyRows.slice(i, i + BATCH_SIZE);
    const batchVehicleRecords: any[] = [];
    const batchSupabasePayloads: any[] = [];
    const batchRowMetadata: any[] = [];

    for (const row of batch) {
      const plate = String(row.plate_number).trim();
      const chassis = cleanChassisNumber(row.chassis_number); // Clean uppercase string or null
      const vehicleId = `veh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${
        row.rowNumber || importedCount + batchVehicleRecords.length + 1
      }`;
      const vehicleCode = `VH-${(db?.fleetVehicles?.length || 0) + importedCount + batchVehicleRecords.length + 1001}`;

      const plateCode = row.plate_code ? String(row.plate_code).trim() : 'T';
      const plateEmirate = row.plate_emirate ? String(row.plate_emirate).trim() : 'Dubai';
      const vehicleType = row.vehicle_type ? String(row.vehicle_type).trim() : 'Motorcycle';
      const make = row.make ? String(row.make).trim() : 'Honda';
      const model = row.model ? String(row.model).trim() : 'Standard';

      let year = Number(row.year);
      if (isNaN(year) || year < 1990 || year > 2035) {
        year = 2024;
      }

      const ownershipType = normalizeOwnershipType(row.ownership_type);
      const vendorName = row.vendor_name ? String(row.vendor_name).trim() : 'Pixel Syntax Delivery Software';
      const resolvedBranch = resolveBranchId(row.branch_name, knownBranches);
      const tcNumber = row.tc_number ? String(row.tc_number).trim() : '';
      const registrationNumber = row.registration_number ? String(row.registration_number).trim() : '';
      const registrationExpiry = sanitizeDateToYmd(row.registration_expiry);
      const insuranceNumber = row.insurance_number ? String(row.insurance_number).trim() : '';
      const insuranceExpiry = sanitizeDateToYmd(row.insurance_expiry);
      const currentOdometer = Math.max(0, Number(row.current_odometer) || 0);
      const gpsDeviceId = row.gps_device_id ? String(row.gps_device_id).trim() : null;
      const remarks = row.remarks ? String(row.remarks).trim() : null;
      const statusMapping = normalizeVehicleWorkingStatus(row.working_status);

      // Build primary DB payload strictly conforming to Supabase table schema
      const supabaseVehiclePayload: any = {
        id: vehicleId,
        vehicle_id: vehicleCode,
        tenant_id: tenantId,
        vehicle_type: vehicleType,
        plate_number: plate,
        plate_code: plateCode || null,
        plate_emirate: plateEmirate,
        make: make,
        model: model,
        year: year,
        color: 'White',
        chassis_number: chassis, // Clean string or null (never empty string or placeholder!)
        engine_number: tcNumber || null,
        registration_number: registrationNumber || null,
        registration_expiry: registrationExpiry, // Clean YYYY-MM-DD or null
        insurance_company: vendorName || null,
        insurance_policy_number: insuranceNumber || null, // Primary schema column name
        insurance_expiry: insuranceExpiry, // Clean YYYY-MM-DD or null
        ownership_type: ownershipType, // Normalized 'OWNED' | 'LEASED' | 'RENTED'
        status: statusMapping.dbStatus, // Normalized 'AVAILABLE' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
        current_odometer: currentOdometer,
        current_employee_id: null, // Production safety: no employee assignment
        current_employee_name: null,
        branch_id: resolvedBranch.branchId, // Valid branch ID (b_dxb, b_auh, b_shj) or null
        gps_device_id: gpsDeviceId,
        is_active: true,
        created_at: new Date().toISOString(),
        created_by: 'Bulk Import',
        updated_at: new Date().toISOString(),
        updated_by: 'Bulk Import',
      };

      const newVehicleRecord = {
        id: vehicleId,
        tenant_id: tenantId,
        plate_number: plate,
        plate_code: plateCode,
        vehicle_code: vehicleCode,
        vehicle_type: vehicleType,
        make: make,
        model: model,
        year: year,
        color: 'White',
        chassis_number: chassis || '',
        tc_number: tcNumber,
        engine_number: tcNumber,
        registration_number: registrationNumber,
        registration_expiry: registrationExpiry || '',
        insurance_number: insuranceNumber,
        insurance_expiry: insuranceExpiry || '',
        ownership_type: ownershipType,
        owner_or_vendor: vendorName,
        plate_emirate: plateEmirate,
        current_odometer: currentOdometer,
        branch_id: resolvedBranch.branchId,
        branch_name: resolvedBranch.branchName,
        gps_device_id: gpsDeviceId || '',
        current_status: statusMapping.uiStatus,
        status_reason: 'Initial bulk import master registration',
        // Production safety: Strictly NO rider / project auto-assignment
        current_rider_id: null,
        current_rider_name: null,
        project_id: null,
        project_name: null,
        notes: remarks || '',
        created_at: new Date().toISOString(),
        created_by: 'Bulk Import',
        updated_at: new Date().toISOString(),
        updated_by: 'Bulk Import',
      };

      batchVehicleRecords.push(newVehicleRecord);
      batchSupabasePayloads.push(supabaseVehiclePayload);
      batchRowMetadata.push({ row, plate, chassis, statusMapping, vehicleCode });
    }

    // Dry-run simulation mode
    if (isDryRun) {
      for (const rec of batchVehicleRecords) {
        importedCount++;
        importedVehicles.push({
          id: rec.id,
          plate_number: rec.plate_number,
          vehicle_code: rec.vehicle_code,
        });
      }
      continue;
    }

    // Live Supabase commit with single bulk insert
    if (supabase) {
      try {
        let { error: sbBatchErr } = await supabase.from('vehicles').insert(batchSupabasePayloads);

        if (sbBatchErr) {
          console.warn(`Supabase vehicle bulk insert initial error on batch of ${batchSupabasePayloads.length}:`, sbBatchErr);

          // Adaptive healing: schema column variations
          if (sbBatchErr.code === '42703') {
            const msg = sbBatchErr.message || '';
            const healedPayloads = batchSupabasePayloads.map((p) => {
              const copy = { ...p };
              if (msg.includes('insurance_policy_number')) {
                copy.insurance_number = copy.insurance_policy_number;
                delete copy.insurance_policy_number;
              } else if (msg.includes('insurance_number')) {
                copy.insurance_policy_number = copy.insurance_number;
                delete copy.insurance_number;
              }
              if (msg.includes('vehicle_type')) delete copy.vehicle_type;
              if (msg.includes('vehicle_id')) delete copy.vehicle_id;
              if (msg.includes('gps_device_id')) delete copy.gps_device_id;
              return copy;
            });

            const retryRes = await supabase.from('vehicles').insert(healedPayloads);
            sbBatchErr = retryRes.error;
          }
        }

        if (sbBatchErr) {
          // If bulk insert failed due to row-specific constraint conflict, isolate failing rows
          console.warn('Falling back to row-level insert for batch to isolate failing rows:', sbBatchErr.message);
          for (let idx = 0; idx < batchSupabasePayloads.length; idx++) {
            const p = batchSupabasePayloads[idx];
            const meta = batchRowMetadata[idx];
            const rec = batchVehicleRecords[idx];

            try {
              const { error: singleErr } = await supabase.from('vehicles').insert(p);
              if (singleErr) {
                const parsedError = categorizeDbError(singleErr);
                recordFailure({
                  rowNumber: meta.row.rowNumber || idx + 1,
                  plate_number: meta.plate,
                  chassis_number: meta.chassis || '',
                  attemptedPayload: p,
                  errorCode: singleErr.code || 'INSERT_ERROR',
                  errorMessage: singleErr.message || 'Error inserting row',
                  failingColumn: parsedError.column,
                  failingValue: parsedError.value,
                  cause: singleErr.code === '23505' ? 'UNIQUE_CONSTRAINT_CONFLICT' : parsedError.cause,
                  error: `${singleErr.message} (Code: ${singleErr.code || 'N/A'}${
                    parsedError.column ? `, Column: ${parsedError.column}` : ''
                  })`,
                });
              } else {
                if (meta.chassis) existingChassis.add(meta.chassis);
                existingVehicleSignatures.add(buildSig(meta.plate, meta.row.plate_code, meta.row.plate_emirate, meta.chassis));
                importedCount++;
                importedVehicles.push(rec);

                if (db) {
                  db.fleetVehicles = db.fleetVehicles || [];
                  db.fleetVehicles.push(rec);
                  db.vehicles = db.vehicles || [];
                  db.vehicles.push(rec);
                }
              }
            } catch (singleEx: any) {
              recordFailure({
                rowNumber: meta.row.rowNumber || idx + 1,
                plate_number: meta.plate,
                chassis_number: meta.chassis || '',
                attemptedPayload: p,
                errorCode: singleEx.code || 'EXCEPTION',
                errorMessage: singleEx.message || 'Database exception',
                cause: 'RUNTIME_EXCEPTION',
                error: singleEx.message,
              });
            }
          }
        } else {
          // Bulk insert was 100% successful in 1 single subrequest!
          for (let idx = 0; idx < batchVehicleRecords.length; idx++) {
            const rec = batchVehicleRecords[idx];
            const meta = batchRowMetadata[idx];

            if (meta.chassis) existingChassis.add(meta.chassis);
            existingVehicleSignatures.add(buildSig(meta.plate, meta.row.plate_code, meta.row.plate_emirate, meta.chassis));
            importedCount++;
            importedVehicles.push(rec);

            if (db) {
              db.fleetVehicles = db.fleetVehicles || [];
              db.fleetVehicles.push(rec);
              db.vehicles = db.vehicles || [];
              db.vehicles.push(rec);
            }
          }
        }
      } catch (sbEx: any) {
        console.error('Exception during vehicle bulk insert in Supabase:', sbEx);
        for (let idx = 0; idx < batchSupabasePayloads.length; idx++) {
          const meta = batchRowMetadata[idx];
          recordFailure({
            rowNumber: meta.row.rowNumber || idx + 1,
            plate_number: meta.plate,
            chassis_number: meta.chassis || '',
            attemptedPayload: batchSupabasePayloads[idx],
            errorCode: sbEx.code || 'EXCEPTION',
            errorMessage: sbEx.message || 'Supabase database exception',
            cause: 'RUNTIME_EXCEPTION',
            error: sbEx.message || 'Supabase database exception',
          });
        }
      }
    } else {
      // In-memory fallback
      for (let idx = 0; idx < batchVehicleRecords.length; idx++) {
        const rec = batchVehicleRecords[idx];
        const meta = batchRowMetadata[idx];

        if (meta.chassis) existingChassis.add(meta.chassis);
        existingVehicleSignatures.add(buildSig(meta.plate, meta.row.plate_code, meta.row.plate_emirate, meta.chassis));
        importedCount++;
        importedVehicles.push(rec);

        if (db) {
          db.fleetVehicles = db.fleetVehicles || [];
          db.fleetVehicles.push(rec);
          db.vehicles = db.vehicles || [];
          db.vehicles.push(rec);
        }
      }
    }
  }

  let totalVehiclesAfterImport = importedCount;
  if (db) {
    totalVehiclesAfterImport = (db.fleetVehicles || []).filter(
      (v: any) => v.tenant_id === tenantId || !v.tenant_id
    ).length;
  } else if (supabase) {
    try {
      const { count } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (typeof count === 'number') {
        totalVehiclesAfterImport = count;
      }
    } catch {}
  }

  return {
    success: failedCount === 0,
    totalSourceRows,
    readyToImport,
    importedCount,
    skippedCount,
    failedCount,
    totalVehiclesAfterImport,
    // Explicit keys matching Task 4:
    totalVehiclesInSupabase: totalVehiclesAfterImport,
    sourceRows: totalSourceRows,
    alreadyExisting: skippedCount,
    newlyImported: importedCount,
    failed: failedCount,
    rowErrors,
    importedVehicles: importedVehicles.map((v) => ({
      id: v.id,
      plate_number: v.plate_number,
      vehicle_code: v.vehicle_code,
    })),
    failureSummaryByCause,
    simulation: isDryRun,
  };
}




