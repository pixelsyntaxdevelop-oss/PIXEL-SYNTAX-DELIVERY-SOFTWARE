import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  FileText,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { mapToAuthoritativeBranch } from '../../lib/branches';

interface ImportEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
  existingEmiratesIds?: string[];
  existingEmployeeCodes?: string[];
}

interface ParsedEmployeeRow {
  rowNumber: number;
  fullName: string;
  employeeCode: string;
  emiratesId: string;
  mobile: string;
  companyMobile?: string;
  passportNumber: string;
  passportExpiry?: string;
  branch: string;
  contractor: string;
  designation: string;
  salary: number;
  status: string;
  joiningDate?: string;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

// Defensive helper: format Emirates ID as pure string without scientific notation
function sanitizeEmiratesId(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  // Handle scientific notation e.g. 7.84199512345671e+14
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(str)) {
    try {
      str = BigInt(Math.round(Number(str))).toString();
    } catch {
      // Keep as-is
    }
  }
  return str;
}

// Defensive helper: format Mobile number to preserve leading zeros
function sanitizeMobile(raw: any): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  // If UAE 9-digit mobile like 501122334 without leading zero, prepend 0
  if (/^5[0-9]{8}$/.test(str)) {
    str = '0' + str;
  }
  return str;
}

// Defensive helper: normalize dates to YYYY-MM-DD
function sanitizeDate(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'number') {
    // Excel date serial number
    try {
      const dateObj = new Date(Math.round((raw - 25569) * 86400 * 1000));
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
  }
  const s = String(raw).trim();
  // Match standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  // Try generic date parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return s;
}

export const ImportEmployeesModal: React.FC<ImportEmployeesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingEmiratesIds = [],
  existingEmployeeCodes = [],
}) => {
  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'IMPORTING' | 'RESULT'>('UPLOAD');
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedEmployeeRow[]>([]);
  const [importResults, setImportResults] = useState<{ imported: number; skipped: number; errors: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Download official XLSX Template (allied_master_employees_template.xlsx)
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    try {
      // Primary: Request official formatted XLSX from backend ExcelJS service
      const response = await fetch('/api/erp/master-employees/template/xlsx');
      if (response.ok) {
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', 'allied_master_employees_template.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return;
      }
      throw new Error(`Server returned status ${response.status}`);
    } catch (err: any) {
      console.warn('Backend template generation fallback:', err);
      // Fallback: Generate real XLSX directly in browser using SheetJS
      try {
        const wb = XLSX.utils.book_new();
        const headers = [
          'Full Name',
          'Employee Code',
          'Emirates ID',
          'Personal Mobile',
          'Company Mobile',
          'Passport Number',
          'Passport Expiry (YYYY-MM-DD)',
          'Branch (DXB/AUH/SHJ)',
          'Contract / Visa Category (Company Visa/Own Visa/ALLIED DXB)',
          'Designation (Bike Rider/Car Driver/Supervisor)',
          'Basic Salary (AED)',
          'Employee Status (Active/Inactive)',
          'Joining Date (YYYY-MM-DD)',
        ];

        const sampleRow1 = Array(headers.length).fill('');

        const sampleRow2 = Array(headers.length).fill('');

        const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow1, sampleRow2]);
        ws['!cols'] = [
          { wch: 28 },
          { wch: 18 },
          { wch: 24 },
          { wch: 22 },
          { wch: 22 },
          { wch: 22 },
          { wch: 28 },
          { wch: 34 },
          { wch: 44 },
          { wch: 36 },
          { wch: 20 },
          { wch: 30 },
          { wch: 26 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Master Employees');
        XLSX.writeFile(wb, 'allied_master_employees_template.xlsx');
      } catch (clientErr: any) {
        setError('Failed to generate template: ' + clientErr.message);
      }
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // 2. Parse 2D array of rows (common for XLSX and CSV)
  const parseRowsArray = (rawRows: any[][]) => {
    if (!rawRows || rawRows.length < 2) {
      setError('The uploaded file is empty or missing header and data rows.');
      return;
    }

    // 1. Locate header row dynamically within first 10 rows
    let headerRowIndex = -1;
    for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
      const rCells = (rawRows[r] || []).map((c: any) => String(c ?? '').trim().toLowerCase());
      const hasKeywords = rCells.some(
        (c) =>
          c.includes('name') ||
          c.includes('code') ||
          c.includes('status') ||
          c.includes('emirates') ||
          c.includes('salary') ||
          c.includes('mobile') ||
          c.includes('passport')
      );
      if (hasKeywords) {
        headerRowIndex = r;
        break;
      }
    }

    if (headerRowIndex === -1) {
      headerRowIndex = 0;
    }

    const headerRow = (rawRows[headerRowIndex] || []).map((h: any) =>
      String(h ?? '').replace(/["']/g, '').trim().toLowerCase()
    );

    const findCol = (predicate: (h: string) => boolean) => headerRow.findIndex(predicate);

    // Name: 'full name', 'employee name', 'rider name', 'driver name', 'name', 'staff name'
    let nameIdx = findCol(
      (h) =>
        (h.includes('name') || h === 'employee' || h === 'rider' || h === 'driver' || h === 'staff') &&
        !h.includes('branch') &&
        !h.includes('company') &&
        !h.includes('vendor') &&
        !h.includes('bank')
    );

    // Code: 'employee code', 'emp code', 'emp id', 'code', 'badge', 'da id', 'driver id', 'staff id', 'id', 's.no'
    let codeIdx = findCol(
      (h) =>
        h.includes('code') ||
        h.includes('emp') ||
        h.includes('badge') ||
        h.includes('da id') ||
        h === 'id' ||
        h.includes('driver id')
    );

    // Emirates ID: 'emirates id', 'eid', 'emirates', 'national id', 'uid'
    let eidIdx = findCol((h) => h.includes('emirates') || h.includes('eid') || h.includes('unique') || h.includes('national id'));

    // Personal Mobile: 'personal mobile', 'mobile', 'phone', 'contact', 'gsm' (excluding company)
    let mobileIdx = findCol(
      (h) =>
        (h.includes('personal') || h.includes('mobile') || h.includes('phone') || h.includes('contact') || h.includes('gsm')) &&
        !h.includes('company')
    );

    // Company Mobile: 'company mobile', 'company phone', 'work phone', 'work mobile'
    let companyMobileIdx = findCol(
      (h) =>
        (h.includes('company') || h.includes('work')) &&
        (h.includes('mobile') || h.includes('phone') || h.includes('sim'))
    );

    // Passport: 'passport number', 'passport no', 'passport' (excluding expiry)
    let passportIdx = findCol((h) => h.includes('passport') && !h.includes('expiry') && !h.includes('exp'));

    // Passport Expiry: 'passport expiry', 'passport exp', 'expiry date'
    let passportExpiryIdx = findCol((h) => h.includes('passport') && (h.includes('expiry') || h.includes('exp')));

    // Branch: 'branch', 'location', 'hub', 'office'
    let branchIdx = findCol((h) => h.includes('branch') || h.includes('location') || h.includes('hub'));

    // Contractor / Visa Category: 'contract', 'category', 'visa', 'sponsor'
    let contractorIdx = findCol((h) => h.includes('contract') || h.includes('category') || h.includes('visa') || h.includes('sponsor'));

    // Designation / Role: 'designation', 'role', 'job', 'position'
    let designationIdx = findCol((h) => h.includes('designation') || h.includes('role') || h.includes('job') || h.includes('position'));

    // Salary: 'basic salary', 'salary', 'basic', 'wage', 'pay'
    let salaryIdx = findCol((h) => h.includes('salary') || h.includes('basic') || h.includes('wage') || h.includes('pay'));

    // Status: 'status', 'employee status', 'work status', 'legacy status', 'active'
    let statusIdx = findCol((h) => h.includes('status') || h.includes('state') || h.includes('active'));

    // Joining Date: 'joining date', 'joining', 'join', 'doj', 'hire date'
    let joiningDateIdx = findCol((h) => h.includes('joining') || h.includes('join') || h.includes('doj') || h.includes('hire'));

    // Positional fallbacks for standard template if header names did not match
    if (nameIdx === -1 && headerRow.length >= 1) nameIdx = 0;
    if (codeIdx === -1 && headerRow.length >= 2) codeIdx = 1;
    if (eidIdx === -1 && headerRow.length >= 3) eidIdx = 2;
    if (mobileIdx === -1 && headerRow.length >= 4) mobileIdx = 3;
    if (statusIdx === -1 && headerRow.length >= 12) statusIdx = 11;

    const rows: ParsedEmployeeRow[] = [];
    const seenEidsInFile = new Set<string>();
    const seenCodesInFile = new Set<string>();

    for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || !Array.isArray(row)) continue;

      // Skip row ONLY if completely empty
      const hasAnyValue = row.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== '');
      if (!hasAnyValue) {
        continue;
      }

      // Extract raw strings/values
      const rawName = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : '';
      const rawCode = codeIdx !== -1 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : '';
      const rawEid = eidIdx !== -1 && row[eidIdx] !== undefined ? sanitizeEmiratesId(row[eidIdx]) : '';
      const rawMobile = mobileIdx !== -1 && row[mobileIdx] !== undefined ? sanitizeMobile(row[mobileIdx]) : '';
      const rawCompanyMobile = companyMobileIdx !== -1 && row[companyMobileIdx] !== undefined ? sanitizeMobile(row[companyMobileIdx]) : rawMobile;
      const rawPassport = passportIdx !== -1 && row[passportIdx] !== undefined ? String(row[passportIdx]).trim() : '';
      const rawPassportExpiry = passportExpiryIdx !== -1 && row[passportExpiryIdx] !== undefined ? sanitizeDate(row[passportExpiryIdx]) : '';
      const rawBranch = branchIdx !== -1 && row[branchIdx] !== undefined ? String(row[branchIdx]).trim() : '';
      const rawContractor = contractorIdx !== -1 && row[contractorIdx] !== undefined ? String(row[contractorIdx]).trim() : '';
      const rawDesignation = designationIdx !== -1 && row[designationIdx] !== undefined ? String(row[designationIdx]).trim() : '';
      const rawSalary = salaryIdx !== -1 && row[salaryIdx] !== undefined ? row[salaryIdx] : '';
      const rawStatus = statusIdx !== -1 && row[statusIdx] !== undefined ? row[statusIdx] : undefined;
      const rawJoiningDate = joiningDateIdx !== -1 && row[joiningDateIdx] !== undefined ? sanitizeDate(row[joiningDateIdx]) : '';

      // Map Status:
      // Status = 0 -> Active
      // Status = 1 -> Inactive
      let status: 'Active' | 'Inactive' = 'Active';
      if (rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== '') {
        const s = String(rawStatus).trim().toLowerCase();
        if (s === '1' || s === '1.0' || s === 'inactive' || s === 'in-active' || s.includes('inactive') || s === 'disabled' || s === 'closed' || s === 'terminated' || s === 'exited') {
          status = 'Inactive';
        } else if (s === '0' || s === '0.0' || s === 'active' || s.includes('active') || s === 'available' || s === 'assigned' || s === 'onboarding') {
          status = 'Active';
        } else {
          status = 'Active';
        }
      }

      const rowNum = i - headerRowIndex;
      let fullName = rawName;
      if (!fullName) {
        if (rawCode) {
          fullName = `Employee ${rawCode}`;
        } else {
          fullName = `Employee ${rowNum}`;
        }
      }

      let employeeCode = rawCode;
      if (!employeeCode) {
        employeeCode = `EMP-${Date.now().toString().slice(-4)}${rowNum}`;
      }

      const emiratesId = rawEid;
      const mobile = rawMobile || '0500000000';
      const companyMobile = rawCompanyMobile || mobile;
      const passportNumber = rawPassport;
      const passportExpiry = rawPassportExpiry || undefined;
      const branch = mapToAuthoritativeBranch(rawBranch || 'b_dxb');
      const contractor = rawContractor || 'Own';
      const designation = rawDesignation || 'Bike Rider';

      // Parse Basic Salary strictly numeric
      let salary = 3500;
      if (typeof rawSalary === 'number') {
        salary = rawSalary;
      } else if (rawSalary) {
        const cleanedSalary = parseFloat(String(rawSalary).replace(/[^0-9.]/g, ''));
        if (!isNaN(cleanedSalary)) {
          salary = cleanedSalary;
        }
      }

      const joiningDate = rawJoiningDate || new Date().toISOString().split('T')[0];

      const warnings: string[] = [];
      const errors: string[] = [];

      // Duplicate check against existing DB
      const cleanEid = emiratesId.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      if (
        cleanEid &&
        cleanEid !== 'na' &&
        !cleanEid.startsWith('784000') &&
        existingEmiratesIds.map((e) => e.replace(/[^0-9a-zA-Z]/g, '').toLowerCase()).includes(cleanEid)
      ) {
        errors.push(`Emirates ID ${emiratesId} already exists in ERP database`);
      }

      // Duplicate in file check
      if (cleanEid && cleanEid !== 'na') {
        if (seenEidsInFile.has(cleanEid)) {
          errors.push(`Duplicate Emirates ID ${emiratesId} inside uploaded file`);
        }
        seenEidsInFile.add(cleanEid);
      }

      if (rawCode) {
        if (existingEmployeeCodes.map((c) => c.toLowerCase()).includes(rawCode.toLowerCase())) {
          errors.push(`Employee Code ${rawCode} already exists in ERP database`);
        }
        if (seenCodesInFile.has(rawCode.toLowerCase())) {
          errors.push(`Duplicate Employee Code ${rawCode} inside file`);
        }
        seenCodesInFile.add(rawCode.toLowerCase());
      }

      if (!emiratesId) {
        warnings.push('Emirates ID missing (will require update before visa audit)');
      }

      rows.push({
        rowNumber: rowNum,
        fullName,
        employeeCode,
        emiratesId,
        mobile,
        companyMobile,
        passportNumber,
        passportExpiry,
        branch,
        contractor,
        designation,
        salary,
        status,
        joiningDate,
        isValid: errors.length === 0,
        warnings,
        errors,
      });
    }

    if (rows.length === 0) {
      setError('No employee records could be identified in the uploaded file.');
      return;
    }

    setParsedRows(rows);
    setStep('PREVIEW');
  };

  // 3. Process uploaded file (XLSX, XLS, CSV)
  const processFile = async (file: File) => {
    setFileName(file.name);
    setError(null);

    const isExcel =
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('excel');

    if (isExcel) {
      // Parse real XLSX / XLS file using SheetJS with text preservation
      try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, {
          type: 'array',
          cellText: true, // Extracts cell-formatted strings (preserves leading zeros)
          raw: false,     // Ensures strings are preferred over rounded scientific numbers
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setError('The uploaded Excel workbook contains no visible worksheets.');
          return;
        }

        // Select the sheet with the most rows, or one matching employee keywords
        let bestSheetName = workbook.SheetNames[0];
        let maxRowCount = 0;
        for (const sheetName of workbook.SheetNames) {
          const ws = workbook.Sheets[sheetName];
          if (ws && ws['!ref']) {
            const range = XLSX.utils.decode_range(ws['!ref']);
            const count = range.e.r - range.s.r + 1;
            const isEmpNamed = /employee|master|allied|rider|staff/i.test(sheetName);
            if (isEmpNamed && count > 1) {
              bestSheetName = sheetName;
              break;
            }
            if (count > maxRowCount) {
              maxRowCount = count;
              bestSheetName = sheetName;
            }
          }
        }

        const worksheet = workbook.Sheets[bestSheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: '',
        });

        parseRowsArray(rawRows);
      } catch (err: any) {
        console.error('Error parsing Excel workbook:', err);
        setError('Failed to parse Excel workbook: ' + (err?.message || 'Invalid file structure'));
      }
    } else {
      // Backward-compatible CSV parser
      try {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setError('The uploaded CSV file is empty or missing data rows.');
          return;
        }

        const rawRows: string[][] = lines.map((line) => {
          // Standard CSV splitter handling quotes
          const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);
          const cols = matches || line.split(',');
          return cols.map((c) => c.replace(/^["']|["']$/g, '').trim());
        });

        parseRowsArray(rawRows);
      } catch (err: any) {
        console.error('Error parsing CSV file:', err);
        setError('Failed to parse CSV file: ' + (err?.message || 'Invalid format'));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 4. Submit parsed valid rows to backend
  const handleCommitImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setError('No valid rows available to import. Please resolve validation errors or re-upload.');
      return;
    }

    setLoading(true);
    setStep('IMPORTING');

    try {
      const payload = validRows.map((r) => ({
        full_name: r.fullName,
        employee_code: r.employeeCode,
        emirates_id_number: r.emiratesId,
        personal_mobile: r.mobile,
        company_mobile: r.companyMobile || r.mobile,
        passport_number: r.passportNumber,
        passport_expiry: r.passportExpiry,
        branch: r.branch,
        contractor: r.contractor,
        designation: r.designation,
        basic_salary: r.salary,
        current_status: r.status,
        joining_date: r.joiningDate,
      }));

      const res = await masterEmployeeService.bulkImportEmployees(payload);
      if (!res.success) {
        throw new Error(res.error || 'Bulk import failed to persist to authoritative database');
      }

      setImportResults({
        imported: res.importedCount ?? 0,
        skipped: (res.skippedCount || 0) + (parsedRows.length - validRows.length),
        errors: res.skipped || [],
      });
      setStep('RESULT');
      if (res.importedCount && res.importedCount > 0) {
        onSuccess(res.importedCount);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to complete bulk import');
      setStep('PREVIEW');
    } finally {
      setLoading(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;
  const activeCount = parsedRows.filter((r) => r.status === 'Active').length;
  const inactiveCount = parsedRows.filter((r) => r.status === 'Inactive').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Import Employees</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Import employees via official Excel XLSX template with automatic duplicate detection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'UPLOAD' && (
          <div className="p-6 space-y-6">
            {/* Download Template Bar */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50/80 to-slate-50 dark:from-emerald-950/20 dark:to-slate-800/50 border border-emerald-200/80 dark:border-emerald-800/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Download Official Excel Template
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white tracking-wide">
                      .XLSX
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pre-formatted workbook (<span className="font-mono text-[11px] font-medium text-slate-700 dark:text-slate-300">allied_master_employees_template.xlsx</span>) with text-locked IDs and validation filters
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs shrink-0"
              >
                {downloadingTemplate ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Download Template (.xlsx)</span>
              </button>
            </div>

            {/* Template Formatting Guarantees Badge */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Text-Locked IDs & Phones
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Emirates ID & mobiles formatted strictly as Text to prevent scientific notation & leading zero loss.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  YYYY-MM-DD Date Display
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Passport Expiry and Joining Date formatted uniformly as ISO standard YYYY-MM-DD.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Numeric Salary & Filters
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Basic Salary stored as numeric (#,##0.00) with top row frozen and AutoFilter enabled.
                </p>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/30 dark:bg-slate-800/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Click to browse or drag & drop Excel (.xlsx) file here
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Supports Microsoft Excel (<span className="font-semibold text-emerald-700 dark:text-emerald-400">.xlsx</span>, <span className="font-semibold text-slate-700 dark:text-slate-300">.xls</span>) and legacy CSV. Automatic duplicate checks and validation will run before anything is committed.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-rose-800 dark:text-rose-200 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview & Validation */}
        {step === 'PREVIEW' && (
          <div className="p-6 space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TOTAL EMPLOYEES</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                  {parsedRows.length}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={fileName}>Rows detected in file</p>
              </div>
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">ACTIVE</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 font-mono">{activeCount}</p>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Status: Active / 0</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700">
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">INACTIVE</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">{inactiveCount}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Status: Inactive / 1</p>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">READY TO IMPORT</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-0.5 font-mono">{validCount}</p>
                <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 mt-0.5">
                  {invalidCount > 0 ? `${invalidCount} duplicate(s)/issue(s)` : 'All records validated'}
                </p>
              </div>
            </div>

            {/* Preview Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase text-[10px] tracking-wider sticky top-0">
                  <tr>
                    <th className="p-2.5">Row#</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Employee Code</th>
                    <th className="p-2.5">Emirates ID</th>
                    <th className="p-2.5">Employee Status</th>
                    <th className="p-2.5">Mobile</th>
                    <th className="p-2.5">Branch</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5 text-right">Salary (AED)</th>
                    <th className="p-2.5">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((r) => (
                    <tr
                      key={r.rowNumber}
                      className={
                        r.isValid
                          ? 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                          : 'bg-rose-50/40 dark:bg-rose-950/20'
                      }
                    >
                      <td className="p-2.5 font-mono text-slate-500">{r.rowNumber}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">{r.fullName}</td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{r.employeeCode}</td>
                      <td className="p-2.5 font-mono font-medium text-slate-900 dark:text-slate-100">
                        {r.emiratesId || '—'}
                      </td>
                      <td className="p-2.5">
                        {r.status === 'Inactive' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 inline-block tracking-wider">
                            INACTIVE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-block tracking-wider">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{r.mobile}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{r.branch}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{r.contractor}</td>
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {r.salary.toLocaleString()}
                      </td>
                      <td className="p-2.5">
                        {r.isValid ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3" /> Ready
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {r.errors.map((err, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 block max-w-xs truncate"
                                title={err}
                              >
                                ⚠️ {err}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions Bar */}
            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setStep('UPLOAD');
                  setParsedRows([]);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Upload Another File</span>
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={validCount === 0}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors flex items-center gap-2"
                >
                  <span>Commit Import ({validCount} Employees)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Importing state */}
        {step === 'IMPORTING' && (
          <div className="p-12 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin mx-auto" />
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Importing Employees to Database...</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Registering master profiles, assigning codes, and persisting records into Employee Master directory.
            </p>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 'RESULT' && importResults && (
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Import Successfully Completed</h4>
              <p className="text-xs text-slate-500 mt-1">
                All valid employee records have been registered in the Master Directory
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Employees Added</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                  {importResults.imported}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs font-semibold text-slate-500">Skipped (Conflicts)</p>
                <p className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1">
                  {importResults.skipped}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors"
              >
                Done & View Employees Directory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
