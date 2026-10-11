import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  FileCheck,
  Link2,
  Search,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

interface PayrollImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodKey?: string;
  defaultPeriodMonth?: string;
  initialSalaryGroup?: string;
  onImportSuccess: (message?: string) => void;
}

export const PayrollImportModal: React.FC<PayrollImportModalProps> = ({
  isOpen,
  onClose,
  periodKey,
  defaultPeriodMonth,
  initialSalaryGroup,
  onImportSuccess,
}) => {
  const effectiveMonth = periodKey || defaultPeriodMonth || '2026-08';

  const [salaryGroup, setSalaryGroup] = useState<string>(initialSalaryGroup || 'NOON');
  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW'>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Master employees for resolving unmapped NIM/Courier IDs
  const [masterEmployees, setMasterEmployees] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedNimIdToMap, setSelectedNimIdToMap] = useState<string>('');
  const [selectedCourierIdToMap, setSelectedCourierIdToMap] = useState<string>('');
  const [selectedEmployeeIdToMap, setSelectedEmployeeIdToMap] = useState<string>('');

  // Map Now Modal state for on-the-fly resolution
  const [mapNowData, setMapNowData] = useState<{
    externalRiderId: string;
    sourceRiderName: string;
    projectId: string;
    projectName: string;
    isKeeta: boolean;
  } | null>(null);
  const [mapNowSearch, setMapNowSearch] = useState<string>('');
  const [mapNowSelectedEmpId, setMapNowSelectedEmpId] = useState<string>('');

  useEffect(() => {
    if (initialSalaryGroup) {
      setSalaryGroup(initialSalaryGroup);
    }
  }, [initialSalaryGroup]);

  useEffect(() => {
    if (isOpen) {
      // Fetch employees for quick NIM ID resolution
      fetch('/api/v1/payroll/employees')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setMasterEmployees(data);
          else if (data && Array.isArray(data.employees)) setMasterEmployees(data.employees);
        })
        .catch((err) => console.error('Error fetching employees for mapping:', err));

      // Fetch live project master for project selection
      fetch('/api/v1/payroll/projects')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.projects)) {
            setProjects(data.projects);
            if (!selectedProjectId && data.projects.length > 0) {
              const matched = data.projects.find((p: any) =>
                salaryGroup === 'KEETA'
                  ? p.name.toLowerCase().includes('keeta')
                  : salaryGroup === 'NOON'
                  ? p.name.toLowerCase().includes('noon')
                  : true
              );
              if (matched) setSelectedProjectId(matched.id);
            }
          }
        })
        .catch((err) => console.error('Error fetching projects:', err));
    }
  }, [isOpen, salaryGroup]);

  // 1. Download Pre-Populated Template
  const handleDownloadTemplate = async () => {
    setErrorMsg(null);
    try {
      if (salaryGroup === 'KEETA') {
        // Download official formatted Keeta Excel workbook (.xlsx)
        const response = await fetch(
          `/api/v1/payroll/templates/keeta?month=${encodeURIComponent(effectiveMonth)}`
        );
        if (!response.ok) {
          throw new Error('Failed to generate Keeta Excel template.');
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', 'KEETA_Payroll_Template.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } else if (salaryGroup === 'NOON') {
        // Download official formatted Excel workbook (.xlsx)
        const response = await fetch(
          `/api/v1/payroll/templates/noon?month=${encodeURIComponent(effectiveMonth)}`
        );
        if (!response.ok) {
          throw new Error('Failed to generate Noon Excel template.');
        }
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', 'NOON_Payroll_Template.xlsx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      } else {
        // Download standard CSV template
        const url = `/api/v1/payroll/templates/download?month=${encodeURIComponent(
          effectiveMonth
        )}&salary_group=${encodeURIComponent(salaryGroup)}`;
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Payroll_Template_${salaryGroup}_${effectiveMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err: any) {
      console.error('Download template error:', err);
      setErrorMsg(err.message || 'Error downloading template.');
    }
  };

  // Re-run Keeta validation using stored buffer
  const revalidateKeetaWorkbook = async (base64Content: string, fileName: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payroll/import/keeta/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: effectiveMonth,
          fileName,
          fileBase64: base64Content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setValidationResult({ ...data, isKeeta: true, isNoon: false });
        setStep('PREVIEW');
        // Pre-select first unmapped Courier ID if available
        const firstUnresolved = (data.preview_rows || []).find((r: any) => !r.is_resolved && r.courier_id);
        if (firstUnresolved) {
          setSelectedCourierIdToMap(firstUnresolved.courier_id);
        }
      } else {
        setErrorMsg(data.message || 'Validation failed on server.');
      }
    } catch (err: any) {
      console.error('Keeta re-validation error:', err);
      setErrorMsg(err.message || 'Failed to validate Keeta workbook.');
    } finally {
      setLoading(false);
    }
  };

  // Re-run Noon validation using stored buffer
  const revalidateNoonWorkbook = async (base64Content: string, fileName: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/payroll/import/noon/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: effectiveMonth,
          fileName,
          fileBase64: base64Content,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setValidationResult({ ...data, isNoon: true, isKeeta: false });
        setStep('PREVIEW');
        // Pre-select first unmapped NIM ID if available
        const firstUnresolved = (data.preview_rows || []).find((r: any) => !r.is_resolved && r.nim_id);
        if (firstUnresolved) {
          setSelectedNimIdToMap(firstUnresolved.nim_id);
        }
      } else {
        setErrorMsg(data.message || 'Validation failed on server.');
      }
    } catch (err: any) {
      console.error('Re-validation error:', err);
      setErrorMsg(err.message || 'Failed to validate Noon workbook.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle File Upload (.xlsx or .csv)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrorMsg(null);
    setLoading(true);

    const isKeeta = salaryGroup === 'KEETA';
    const isNoon = salaryGroup === 'NOON';
    const isExcelFile =
      selectedFile.name.endsWith('.xlsx') ||
      selectedFile.name.endsWith('.xls') ||
      selectedFile.type.includes('spreadsheet') ||
      isKeeta ||
      isNoon;

    if (isExcelFile && (isKeeta || isNoon)) {
      // -------------------------------------------------------------
      // EXCEL WORKFLOW (.xlsx via backend ExcelJS engine)
      // -------------------------------------------------------------
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          setFileBase64(base64);
          if (isKeeta) {
            await revalidateKeetaWorkbook(base64, selectedFile.name);
          } else {
            await revalidateNoonWorkbook(base64, selectedFile.name);
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to process Excel workbook.');
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setErrorMsg('Error reading uploaded Excel file.');
        setLoading(false);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      // -------------------------------------------------------------
      // STANDARD CSV WORKFLOW (Labour / Fixed)
      // -------------------------------------------------------------
      try {
        const text = await selectedFile.text();
        const lines = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length <= 1) {
          setErrorMsg('Uploaded CSV file contains no data rows.');
          setLoading(false);
          return;
        }

        const rawHeaders = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());
        const rows: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let inQuotes = false;
          let currentValue = '';

          for (const ch of lines[i]) {
            if (ch === '"' || ch === "'") {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += ch;
            }
          }
          values.push(currentValue.trim());

          const rowObj: any = {};
          rawHeaders.forEach((header, idx) => {
            rowObj[header] = values[idx] !== undefined ? values[idx].replace(/^["']|["']$/g, '') : '';
          });

          rowObj.employee_code = rowObj['Employee Code'] || rowObj.employee_code || values[0];
          rowObj.emirates_id = rowObj['Emirates ID'] || rowObj.emirates_id || values[1];
          rowObj.employee_name = rowObj['Employee Name'] || rowObj.employee_name || values[2];
          rowObj.project = rowObj['Project'] || rowObj.project || values[3];
          rowObj.payroll_month = rowObj['Payroll Month'] || rowObj.payroll_month || values[4];
          rowObj.working_hours = rowObj['Working Hours'] || rowObj.working_hours || values[5];
          rowObj.hourly_rate = rowObj['Hourly Rate'] || rowObj.hourly_rate || values[6];
          rowObj.allowance = rowObj['Allowance'] || rowObj.allowance || values[7];
          rowObj.incentive = rowObj['Incentive'] || rowObj.incentive || values[8];
          rowObj.overtime = rowObj['Overtime Amount'] || rowObj.overtime || values[9];
          rowObj.manual_deduction = rowObj['Manual Deduction'] || rowObj.manual_deduction || values[11];
          rowObj.expected_total = rowObj['Expected Total'] || rowObj.expected_total || values[12];
          rowObj.notes = rowObj['Notes'] || rowObj.notes || values[13];

          rows.push(rowObj);
        }

        const res = await fetch('/api/v1/payroll/import/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: effectiveMonth,
            salaryGroup,
            fileName: selectedFile.name,
            rows,
          }),
        });

        const data = await res.json();
        if (data.success) {
          setValidationResult({ ...data, isNoon: false });
          setStep('PREVIEW');
        } else {
          setErrorMsg(data.message || 'Validation failed on server.');
        }
      } catch (err: any) {
        console.error('File parsing error:', err);
        setErrorMsg(err.message || 'Failed to parse CSV file.');
      } finally {
        setLoading(false);
      }
    }
  };

  // 3. In-line Mapping of Unresolved Courier ID (KEETA)
  const handleMapCourierId = async () => {
    if (!selectedCourierIdToMap || !selectedEmployeeIdToMap) {
      setErrorMsg('Please select both a Keeta Courier ID and an Allied Employee to map.');
      return;
    }

    setMappingLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/payroll/mappings/keeta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courier_id: selectedCourierIdToMap,
          employee_id: selectedEmployeeIdToMap,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Re-validate the Keeta workbook with the newly created mapping!
        if (fileBase64 && file) {
          await revalidateKeetaWorkbook(fileBase64, file.name);
        }
        setSelectedCourierIdToMap('');
        setSelectedEmployeeIdToMap('');
      } else {
        setErrorMsg(data.message || 'Failed to create Keeta courier mapping.');
      }
    } catch (err: any) {
      console.error('Error creating Keeta mapping:', err);
      setErrorMsg(err.message || 'Network error creating mapping.');
    } finally {
      setMappingLoading(false);
    }
  };

  // 3b. In-line Mapping of Unresolved NIM ID (NOON)
  const handleMapNimId = async () => {
    if (!selectedNimIdToMap || !selectedEmployeeIdToMap) {
      setErrorMsg('Please select both a NIM ID and an Allied Employee to map.');
      return;
    }

    setMappingLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/v1/payroll/mappings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          external_rider_id: selectedNimIdToMap,
          employee_id: selectedEmployeeIdToMap,
          project_id: 'proj_noon_1',
          project_name: 'Noon Minutes Logistics',
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Re-validate the workbook with the newly created mapping!
        if (fileBase64 && file) {
          await revalidateNoonWorkbook(fileBase64, file.name);
        }
        setSelectedNimIdToMap('');
        setSelectedEmployeeIdToMap('');
      } else {
        setErrorMsg(data.message || 'Failed to create rider mapping.');
      }
    } catch (err: any) {
      console.error('Error creating rider mapping:', err);
      setErrorMsg(err.message || 'Network error creating mapping.');
    } finally {
      setMappingLoading(false);
    }
  };

  // 3c. Interactive Map Now Dialog submission
  const handleSaveMapNow = async () => {
    if (!mapNowData || !mapNowSelectedEmpId) {
      setErrorMsg('Please select an employee to map to this external rider ID.');
      return;
    }

    setMappingLoading(true);
    setErrorMsg(null);

    try {
      if (mapNowData.isKeeta) {
        const res = await fetch('/api/v1/payroll/mappings/keeta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courier_id: mapNowData.externalRiderId,
            employee_id: mapNowSelectedEmpId,
          }),
        });

        const data = await res.json();
        if (data.success) {
          if (fileBase64 && file) {
            await revalidateKeetaWorkbook(fileBase64, file.name);
          }
          setMapNowData(null);
          setMapNowSelectedEmpId('');
          setMapNowSearch('');
        } else {
          setErrorMsg(data.message || 'Failed to create Keeta courier mapping.');
        }
      } else {
        const res = await fetch('/api/v1/payroll/mappings/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_rider_id: mapNowData.externalRiderId,
            employee_id: mapNowSelectedEmpId,
            project_id: mapNowData.projectId || 'proj_noon_1',
            project_name: mapNowData.projectName || 'Noon Minutes Logistics',
          }),
        });

        const data = await res.json();
        if (data.success) {
          if (fileBase64 && file) {
            await revalidateNoonWorkbook(fileBase64, file.name);
          }
          setMapNowData(null);
          setMapNowSelectedEmpId('');
          setMapNowSearch('');
        } else {
          setErrorMsg(data.message || 'Failed to create rider mapping.');
        }
      }
    } catch (err: any) {
      console.error('Error saving mapping:', err);
      setErrorMsg(err.message || 'Network error creating mapping.');
    } finally {
      setMappingLoading(false);
    }
  };

  // 4. Confirm & Commit Validated Import
  const handleCommitImport = async () => {
    if (!validationResult) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      if (validationResult.isKeeta) {
        // Commit Keeta batch
        const res = await fetch('/api/v1/payroll/import/keeta/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: effectiveMonth,
            fileName: file?.name || 'KEETA_Payroll_Template.xlsx',
            fileHash: validationResult.file_hash,
            rows: validationResult.preview_rows,
            reconciliation: validationResult.reconciliation,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onImportSuccess(data.message || 'Keeta payroll data committed successfully.');
          onClose();
        } else {
          setErrorMsg(data.message || 'Failed to commit Keeta payroll batch.');
        }
      } else if (validationResult.isNoon) {
        // Commit Noon batch
        const res = await fetch('/api/v1/payroll/import/noon/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: effectiveMonth,
            fileName: file?.name || 'NOON_Payroll_Template.xlsx',
            fileHash: validationResult.file_hash,
            rows: validationResult.preview_rows,
            reconciliation: validationResult.reconciliation,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onImportSuccess(data.message || 'Noon payroll data committed successfully.');
          onClose();
        } else {
          setErrorMsg(data.message || 'Failed to commit Noon payroll batch.');
        }
      } else {
        // Standard CSV commit
        const res = await fetch('/api/v1/payroll/import/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            month: effectiveMonth,
            salaryGroup,
            fileName: file?.name || 'Import.csv',
            rows: validationResult.previewRows,
          }),
        });

        const data = await res.json();
        if (data.success) {
          onImportSuccess(data.message || 'Salary data committed successfully.');
          onClose();
        } else {
          setErrorMsg(data.message || 'Failed to commit import.');
        }
      }
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMsg(err.message || 'Network error committing salary data.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('UPLOAD');
    setFile(null);
    setFileBase64(null);
    setValidationResult(null);
    setErrorMsg(null);
    setSelectedNimIdToMap('');
    setSelectedCourierIdToMap('');
    setSelectedEmployeeIdToMap('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Two-Level Salary Data Import & Partner Template Engine"
    >
      <div className="space-y-5 text-slate-900 dark:text-white max-w-4xl">
        {/* Salary Group & Project Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Target Project & Payroll Period
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-black text-slate-900 dark:text-white">
                Period: {effectiveMonth}
              </span>
              {salaryGroup === 'KEETA' && (
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-lg border border-emerald-300 dark:border-emerald-800">
                  Exact 14 Columns • Keeta (.xlsx)
                </span>
              )}
              {salaryGroup === 'NOON' && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-lg border border-amber-300 dark:border-amber-800">
                  Exact 11 Columns • Noon (.xlsx)
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Live Project Master Selector */}
            {projects.length > 0 && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Project:</label>
                <select
                  value={selectedProjectId}
                  disabled={step === 'PREVIEW'}
                  onChange={(e) => {
                    const pId = e.target.value;
                    setSelectedProjectId(pId);
                    const chosen = projects.find((p: any) => p.id === pId);
                    if (chosen) {
                      const pName = (chosen.name || '').toLowerCase();
                      if (pName.includes('keeta')) setSalaryGroup('KEETA');
                      else if (pName.includes('noon')) setSalaryGroup('NOON');
                      else if (pName.includes('labour')) setSalaryGroup('LABOUR');
                      else if (pName.includes('fixed')) setSalaryGroup('FIXED');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer max-w-[200px] truncate"
                >
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Profile:</label>
              <select
                value={salaryGroup}
                disabled={step === 'PREVIEW'}
                onChange={(e) => setSalaryGroup(e.target.value)}
                className="px-2.5 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none cursor-pointer"
              >
                <option value="KEETA">KEETA (14 Columns .xlsx)</option>
                <option value="NOON">NOON (11 Columns .xlsx)</option>
                <option value="LABOUR">LABOUR (Hourly 5.00/hr)</option>
                <option value="DELIVEROO">DELIVEROO (Per-Delivery)</option>
                <option value="TALABAT">TALABAT (Per-Delivery)</option>
                <option value="FIXED">FIXED (Monthly Base)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 5-Item Operational Import Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 bg-slate-100/70 dark:bg-slate-850 rounded-2xl border border-slate-200/80 dark:border-slate-800 text-center">
          <div className="p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">File Name</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate" title={file?.name || 'No file selected'}>
              {file?.name || 'Awaiting file...'}
            </span>
          </div>
          <div className="p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Project</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
              {projects.find((p: any) => p.id === selectedProjectId)?.name || (salaryGroup === 'KEETA' ? 'Keeta Express Delivery' : salaryGroup === 'NOON' ? 'Noon Minutes Logistics' : 'Allied Operational Project')}
            </span>
          </div>
          <div className="p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Payroll Period</span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {effectiveMonth}
            </span>
          </div>
          <div className="p-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Import Profile</span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block truncate">
              {salaryGroup === 'KEETA' ? 'Keeta 14-Col' : salaryGroup === 'NOON' ? 'Noon 11-Col' : salaryGroup}
            </span>
          </div>
          <div className="p-2 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Row Count</span>
            <span className="text-xs font-black text-slate-900 dark:text-white block">
              {validationResult?.total_rows || validationResult?.totalRows || (file ? 'Parsing...' : '0 rows')}
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-semibold flex items-center gap-2.5">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD & DOWNLOAD TEMPLATE */}
        {step === 'UPLOAD' && (
          <div className="space-y-4">
            {/* Download Pre-Populated Template */}
            <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  {salaryGroup === 'KEETA'
                    ? 'Download Official KEETA Excel Template (.xlsx)'
                    : salaryGroup === 'NOON'
                    ? 'Download Official NOON Excel Template (.xlsx)'
                    : `Pre-Populated ${salaryGroup} Template`}
                </h4>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5 max-w-xl">
                  {salaryGroup === 'KEETA'
                    ? 'Generates real Excel (.xlsx) file with worksheet "KEETA Payroll", exact 14 columns, yellow header, frozen top row, autofilter, and pre-populated active Keeta riders for ' +
                      effectiveMonth +
                      '.'
                    : salaryGroup === 'NOON'
                    ? 'Generates real Excel (.xlsx) file with exact 11 columns, yellow header, frozen top row, autofilter, and pre-populated mapped riders for ' +
                      effectiveMonth +
                      '.'
                    : `Includes active employee codes, Emirates IDs, names, and project defaults for ${effectiveMonth}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Download {salaryGroup === 'KEETA' ? 'KEETA_Payroll_Template.xlsx' : salaryGroup === 'NOON' ? 'NOON_Payroll_Template.xlsx' : `${salaryGroup} Template`}
              </button>
            </div>

            {/* Business Rules & Structure Notice for KEETA */}
            {salaryGroup === 'KEETA' && (
              <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl text-[11px] text-emerald-950 dark:text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-950 dark:text-emerald-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  KEETA Commercial & Compliance Rules (KEETA_Payroll_Template.xlsx)
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-900 dark:text-emerald-300/90 pl-1">
                  <li>
                    <span className="font-semibold">Exact 14 Columns in order:</span> Courier ID, Courier Name, Valid Days, Hours Avg, Incentive, Reward, Food Charge, Penalty, Tip, Rider Salary, Incentive Adjustment, Bike Fine, Maintenance / Others, Net Payable Salary.
                  </li>
                  <li>
                    <span className="font-semibold">Courier ID Primary Key:</span> Resolves employee via ProjectRiderMapping → Employee Master. Courier Name is secondary and never matched by name alone.
                  </li>
                  <li>
                    <span className="font-semibold">Not Labour Hourly:</span> Keeta is a per-delivery logistics source. Valid Days and Hours Avg are preserved as reporting metrics, not used as hourly multipliers.
                  </li>
                  <li>
                    <span className="font-semibold">Source Deductions & Earnings Itemized:</span> Food Charge, Penalty, Bike Fine, and Maintenance / Others are preserved separately and never collapsed into a generic lump sum.
                  </li>
                  <li>
                    <span className="font-semibold">Signed Incentive Adjustment:</span> Both positive (+) and negative (-) adjustment values are preserved and applied with strict sign fidelity.
                  </li>
                  <li>
                    <span className="font-semibold">Source Rider Salary:</span> Preserved separately from Incentive, Reward, and Tip to prevent double-counting.
                  </li>
                  <li>
                    <span className="font-semibold">Anti-Double Deduction:</span> Source Bike Fine is tracked distinctly from ERP Traffic Fines. ERP Traffic Fines remain authoritative based on violation timestamp.
                  </li>
                </ul>
              </div>
            )}

            {/* Business Rules & Structure Notice for NOON */}
            {salaryGroup === 'NOON' && (
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  Noon Commercial & Compliance Rules
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300/90 pl-1">
                  <li>
                    <span className="font-semibold">Exact 11 Columns in order:</span> DA Name, NIM ID, Total Order, Rider Earning, Deduction, Penalty, COD, Vendor Share, Fine, Loan, Rider Salary.
                  </li>
                  <li>
                    <span className="font-semibold">NIM ID Primary Key:</span> Resolves employee via ProjectRiderMapping → Employee Master. Does not guess by name alone.
                  </li>
                  <li>
                    <span className="font-semibold">No Labour Hourly Calculation:</span> Delivery payout logic is preserved as reported by partner.
                  </li>
                  <li>
                    <span className="font-semibold">Anti-Double Deduction:</span> Source Fine and Loan columns are tracked distinctly from ERP fines and company loan ledgers.
                  </li>
                </ul>
              </div>
            )}

            {/* Dropzone File Upload */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-3xl p-8 text-center transition-colors">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Upload Completed Salary Sheet ({salaryGroup === 'KEETA' || salaryGroup === 'NOON' ? '.xlsx / .xls' : '.csv / .xlsx'})
              </h5>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {salaryGroup === 'KEETA'
                  ? 'Server-side parser verifies the exact 14 columns, resolves Courier IDs, checks duplicate rows and file SHA-256 hash, and computes full Keeta reconciliation.'
                  : salaryGroup === 'NOON'
                  ? 'Server-side parser verifies the exact 11 columns, maps NIM IDs, checks duplicate rows and file SHA-256 hash, and computes full reconciliation.'
                  : 'Automated validation will verify employee codes, recalculate gross totals, and flag anomalies.'}
              </p>
              <label className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold cursor-pointer shadow-md shadow-emerald-600/20 transition-all">
                <FileSpreadsheet className="w-4 h-4" />
                {loading ? 'Validating Workbook on Server...' : 'Select Excel / Spreadsheet File'}
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  disabled={loading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2: VALIDATION & PREVIEW GRID */}
        {step === 'PREVIEW' && validationResult && (
          <div className="space-y-4">
            {/* KEETA SPECIFIC RECONCILIATION SUMMARY */}
            {validationResult.isKeeta ? (
              <div className="space-y-3">
                {/* Duplicate Workbook Warning */}
                {validationResult.is_duplicate_workbook && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      DUPLICATE WORKBOOK: This exact Keeta file (SHA-256: {validationResult.file_hash?.substring(0, 10)}...) has already been imported and committed for {effectiveMonth}.
                    </span>
                  </div>
                )}

                {/* 7 TOP SUMMARY CARDS (ERP SAFETY GATE) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Records</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {validationResult.total_rows}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase">Matched</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {validationResult.ready_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] font-bold text-amber-600 block uppercase">Unmatched</span>
                    <span className="text-base font-black text-amber-700 dark:text-amber-400">
                      {validationResult.unresolved_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900">
                    <span className="text-[10px] font-bold text-orange-600 block uppercase">Ambiguous</span>
                    <span className="text-base font-black text-orange-700 dark:text-orange-400">
                      {validationResult.ambiguous_count || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase">Duplicates</span>
                    <span className="text-base font-black text-rose-700 dark:text-rose-400">
                      {validationResult.duplicate_row_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <span className="text-[10px] font-bold text-blue-600 block uppercase">Gross Expected</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 block truncate">
                      AED {((validationResult.reconciliation?.total_rider_salary || 0) + (validationResult.reconciliation?.total_incentive || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                    <span className="text-[10px] font-bold text-purple-600 block uppercase">Net Expected</span>
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300 block truncate">
                      AED {(validationResult.reconciliation?.total_net_payable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Additional Keeta reconciliation itemization bar */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-1.5">
                    <span className="text-slate-500 font-semibold">Keeta Earnings & Incentives:</span>
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span>Incentive: <strong className="text-blue-600 dark:text-blue-400">AED {validationResult.reconciliation?.total_incentive?.toFixed(2)}</strong></span>
                      <span>Reward: <strong className="text-blue-600 dark:text-blue-400">AED {validationResult.reconciliation?.total_reward?.toFixed(2)}</strong></span>
                      <span>Tip: <strong className="text-blue-600 dark:text-blue-400">AED {validationResult.reconciliation?.total_tip?.toFixed(2)}</strong></span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Incentive Adj (+/-): AED {validationResult.reconciliation?.total_incentive_adjustment?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold">Keeta Deductions Itemized:</span>
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span>Food Charge: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_food_charge?.toFixed(2)}</strong></span>
                      <span>Penalty: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_penalty?.toFixed(2)}</strong></span>
                      <span className="text-amber-700 dark:text-amber-400 font-bold" title="Stored on Keeta source ledger distinctly from ERP traffic fines">
                        Bike Fine: AED {validationResult.reconciliation?.total_bike_fine?.toFixed(2)}
                      </span>
                      <span>Maintenance / Others: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_maintenance_others?.toFixed(2)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Inline Resolver for Unmapped Courier IDs */}
                {validationResult.unresolved_count > 0 && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs space-y-2">
                    <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-amber-600" />
                      Resolve Unmapped Keeta Courier ID On-the-Fly
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <select
                        value={selectedCourierIdToMap}
                        onChange={(e) => setSelectedCourierIdToMap(e.target.value)}
                        className="w-full sm:w-1/3 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="">-- Select Unmapped Courier ID --</option>
                        {validationResult.preview_rows
                          ?.filter((r: any) => !r.is_resolved && r.courier_id)
                          .map((r: any, idx: number) => (
                            <option key={idx} value={r.courier_id}>
                              {r.courier_id} ({r.courier_name || 'No Courier Name'})
                            </option>
                          ))}
                      </select>

                      <select
                        value={selectedEmployeeIdToMap}
                        onChange={(e) => setSelectedEmployeeIdToMap(e.target.value)}
                        className="w-full sm:w-1/2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="">-- Select Allied Master Employee --</option>
                        {masterEmployees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_code || emp.id})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleMapCourierId}
                        disabled={mappingLoading || !selectedCourierIdToMap || !selectedEmployeeIdToMap}
                        className="w-full sm:w-auto px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                      >
                        {mappingLoading ? 'Mapping...' : 'Map Courier ID'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : validationResult.isNoon ? (
              <div className="space-y-3">
                {/* Duplicate Workbook Warning */}
                {validationResult.is_duplicate_workbook && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-2xl text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      DUPLICATE WORKBOOK: This exact file (SHA-256: {validationResult.file_hash?.substring(0, 10)}...) has already been imported and committed for {effectiveMonth}.
                    </span>
                  </div>
                )}

                {/* 7 TOP SUMMARY CARDS (NOON ERP SAFETY GATE) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
                  <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Records</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {validationResult.total_rows}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase">Matched</span>
                    <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                      {validationResult.ready_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                    <span className="text-[10px] font-bold text-amber-600 block uppercase">Unmatched</span>
                    <span className="text-base font-black text-amber-700 dark:text-amber-400">
                      {validationResult.unresolved_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900">
                    <span className="text-[10px] font-bold text-orange-600 block uppercase">Ambiguous</span>
                    <span className="text-base font-black text-orange-700 dark:text-orange-400">
                      {validationResult.ambiguous_count || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                    <span className="text-[10px] font-bold text-rose-600 block uppercase">Duplicates</span>
                    <span className="text-base font-black text-rose-700 dark:text-rose-400">
                      {validationResult.duplicate_row_count}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                    <span className="text-[10px] font-bold text-blue-600 block uppercase">Gross Expected</span>
                    <span className="text-xs font-black text-blue-700 dark:text-blue-300 block truncate">
                      AED {(validationResult.reconciliation?.total_rider_earning || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                    <span className="text-[10px] font-bold text-purple-600 block uppercase">Net Expected</span>
                    <span className="text-xs font-black text-purple-700 dark:text-purple-300 block truncate">
                      AED {(validationResult.reconciliation?.total_rider_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Additional reconciliation itemization bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px]">
                  <span className="text-slate-500 font-semibold">Source Deductions Breakdown:</span>
                  <div className="flex flex-wrap items-center gap-3 font-mono">
                    <span>COD: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_cod?.toFixed(2)}</strong></span>
                    <span>Penalty: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_penalty?.toFixed(2)}</strong></span>
                    <span>Vendor Share: <strong className="text-slate-900 dark:text-white">AED {validationResult.reconciliation?.total_vendor_share?.toFixed(2)}</strong></span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold" title="Stored separately from ERP traffic fines">
                      Source Fine: AED {validationResult.reconciliation?.total_fine?.toFixed(2)}
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold" title="Stored separately from ERP company loans">
                      Source Loan: AED {validationResult.reconciliation?.total_loan?.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Inline Resolver for Unmapped NIM IDs */}
                {validationResult.unresolved_count > 0 && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl text-xs space-y-2">
                    <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-amber-600" />
                      Resolve Unmapped NIM ID On-the-Fly
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <select
                        value={selectedNimIdToMap}
                        onChange={(e) => setSelectedNimIdToMap(e.target.value)}
                        className="w-full sm:w-1/3 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="">-- Select Unmapped NIM ID --</option>
                        {validationResult.preview_rows
                          ?.filter((r: any) => !r.is_resolved && r.nim_id)
                          .map((r: any, idx: number) => (
                            <option key={idx} value={r.nim_id}>
                              {r.nim_id} ({r.da_name || 'No DA Name'})
                            </option>
                          ))}
                      </select>

                      <select
                        value={selectedEmployeeIdToMap}
                        onChange={(e) => setSelectedEmployeeIdToMap(e.target.value)}
                        className="w-full sm:w-1/2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="">-- Select Allied Master Employee --</option>
                        {masterEmployees.map((emp: any) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.full_name} ({emp.employee_code || emp.id})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={handleMapNimId}
                        disabled={mappingLoading || !selectedNimIdToMap || !selectedEmployeeIdToMap}
                        className="w-full sm:w-auto px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 shrink-0"
                      >
                        {mappingLoading ? 'Mapping...' : 'Map NIM ID'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 7 TOP SUMMARY CARDS (STANDARD CSV SAFETY GATE) */
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center">
                <div className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Total Records</span>
                  <span className="text-base font-black text-slate-900 dark:text-white">
                    {validationResult.totalRows}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <span className="text-[10px] font-bold text-emerald-600 block uppercase">Matched</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400">
                    {validationResult.readyCount}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                  <span className="text-[10px] font-bold text-amber-600 block uppercase">Unmatched</span>
                  <span className="text-base font-black text-amber-700 dark:text-amber-400">
                    {validationResult.unmatchedCount || (validationResult.errorCount > 0 ? validationResult.errorCount : 0)}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900">
                  <span className="text-[10px] font-bold text-orange-600 block uppercase">Ambiguous</span>
                  <span className="text-base font-black text-orange-700 dark:text-orange-400">
                    {validationResult.ambiguousCount || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                  <span className="text-[10px] font-bold text-rose-600 block uppercase">Duplicates</span>
                  <span className="text-base font-black text-rose-700 dark:text-rose-400">
                    {validationResult.duplicateCount || 0}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                  <span className="text-[10px] font-bold text-blue-600 block uppercase">Gross Expected</span>
                  <span className="text-xs font-black text-blue-700 dark:text-blue-300 block truncate">
                    AED {(validationResult.totalGross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                  <span className="text-[10px] font-bold text-purple-600 block uppercase">Net Expected</span>
                  <span className="text-xs font-black text-purple-700 dark:text-purple-300 block truncate">
                    AED {(validationResult.totalNet || validationResult.totalGross || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

            {/* PREVIEW TABLE */}
            <div className="max-h-80 overflow-x-auto overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl text-xs">
              {validationResult.isKeeta ? (
                /* KEETA EXACT 14 COLUMNS TABLE + MATCHED EMPLOYEE */
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">Courier ID / Mapped Employee</th>
                      <th className="p-2">Courier Name</th>
                      <th className="p-2 text-right">Valid Days</th>
                      <th className="p-2 text-right">Hours Avg</th>
                      <th className="p-2 text-right">Incentive</th>
                      <th className="p-2 text-right">Reward</th>
                      <th className="p-2 text-right">Food Charge</th>
                      <th className="p-2 text-right">Penalty</th>
                      <th className="p-2 text-right">Tip</th>
                      <th className="p-2 text-right font-semibold text-slate-700 dark:text-slate-300">Rider Salary</th>
                      <th className="p-2 text-right">Incentive Adj</th>
                      <th className="p-2 text-right">Bike Fine</th>
                      <th className="p-2 text-right">Maint/Others</th>
                      <th className="p-2 text-right font-black text-slate-900 dark:text-white">Net Payable</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {validationResult.preview_rows?.map((row: any, idx: number) => {
                      const isUnmapped = !row.is_resolved;
                      const isDuplicate = row.is_duplicate;
                      return (
                        <tr
                          key={idx}
                          className={
                            isDuplicate || isUnmapped
                              ? 'bg-rose-50/50 dark:bg-rose-950/20'
                              : row.has_mismatch
                              ? 'bg-amber-50/40 dark:bg-amber-950/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="p-2 font-mono text-slate-400">#{row.row_number}</td>
                          <td className="p-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {row.courier_id}
                            </span>
                            {row.is_resolved ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                                <UserCheck className="w-3 h-3" />
                                {row.employee_name} ({row.employee_code})
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Unmatched Courier ID
                              </span>
                            )}
                          </td>
                          <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{row.courier_name || '-'}</td>
                          <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-300">{row.valid_days}</td>
                          <td className="p-2 text-right font-mono text-slate-600 dark:text-slate-300">{row.hours_avg.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {row.incentive.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {row.reward.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.food_charge.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.penalty.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-blue-600 dark:text-blue-400">{row.tip.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {(row.rider_salary ?? row.source_rider_salary ?? 0).toFixed(2)}
                          </td>
                          <td className={`p-2 text-right font-mono font-semibold ${(row.incentive_adjustment || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {(row.incentive_adjustment || 0) >= 0 ? `+${(row.incentive_adjustment || 0).toFixed(2)}` : (row.incentive_adjustment || 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400" title="Source Bike Fine (ERP traffic fine preserved separately)">
                            {(row.bike_fine ?? 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-500">{(row.maintenance_others ?? 0).toFixed(2)}</td>
                          <td className={`p-2 text-right font-mono font-black ${(row.net_payable_salary ?? row.calculated_net ?? 0) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {(row.net_payable_salary ?? row.calculated_net ?? 0).toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            {isDuplicate ? (
                              <Badge variant="danger">DUPLICATE</Badge>
                            ) : isUnmapped ? (
                              <Badge variant="danger">UNMATCHED</Badge>
                            ) : row.has_mismatch ? (
                              <Badge variant="warning">AMBIGUOUS</Badge>
                            ) : (
                              <Badge variant="success">MATCHED</Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isUnmapped && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMapNowData({
                                    externalRiderId: row.courier_id,
                                    sourceRiderName: row.courier_name || '',
                                    projectId: 'proj_keeta_1',
                                    projectName: 'Keeta Express Delivery',
                                    isKeeta: true,
                                  });
                                  setMapNowSelectedEmpId('');
                                  setMapNowSearch('');
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1 mx-auto"
                              >
                                <Link2 className="w-3 h-3" />
                                Map Now
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : validationResult.isNoon ? (
                /* NOON EXACT 11 COLUMNS TABLE */
                <table className="w-full text-left whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700 text-[11px]">
                    <tr>
                      <th className="p-2">Row</th>
                      <th className="p-2">DA Name</th>
                      <th className="p-2">NIM ID / Mapped Employee</th>
                      <th className="p-2 text-right">Orders</th>
                      <th className="p-2 text-right">Earning</th>
                      <th className="p-2 text-right">Deduction</th>
                      <th className="p-2 text-right">Penalty</th>
                      <th className="p-2 text-right">COD</th>
                      <th className="p-2 text-right">Vendor</th>
                      <th className="p-2 text-right">Fine</th>
                      <th className="p-2 text-right">Loan</th>
                      <th className="p-2 text-right font-black text-slate-900 dark:text-white">Rider Salary</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                    {validationResult.preview_rows?.map((row: any, idx: number) => {
                      const isUnmapped = !row.is_resolved;
                      const isDuplicate = row.is_duplicate;
                      return (
                        <tr
                          key={idx}
                          className={
                            isDuplicate || isUnmapped
                              ? 'bg-rose-50/50 dark:bg-rose-950/20'
                              : row.has_mismatch
                              ? 'bg-amber-50/40 dark:bg-amber-950/10'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="p-2 font-mono text-slate-400">#{row.row_number}</td>
                          <td className="p-2 font-medium text-slate-800 dark:text-slate-200">{row.da_name || '-'}</td>
                          <td className="p-2">
                            <span className="font-mono font-bold text-slate-900 dark:text-white block">
                              {row.nim_id}
                            </span>
                            {row.is_resolved ? (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                                <UserCheck className="w-3 h-3" />
                                {row.employee_name} ({row.employee_code})
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Unmatched NIM ID
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono">{row.total_orders}</td>
                          <td className="p-2 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                            {row.rider_earning.toFixed(2)}
                          </td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.deduction.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.penalty.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.cod.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-slate-500">{row.vendor_share.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">{row.fine.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono text-amber-600 dark:text-amber-400">{row.loan.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {row.rider_salary.toFixed(2)}
                          </td>
                          <td className="p-2 text-center">
                            {isDuplicate ? (
                              <Badge variant="danger">DUPLICATE</Badge>
                            ) : isUnmapped ? (
                              <Badge variant="danger">UNMATCHED</Badge>
                            ) : row.has_mismatch ? (
                              <Badge variant="warning">AMBIGUOUS</Badge>
                            ) : (
                              <Badge variant="success">MATCHED</Badge>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            {isUnmapped && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMapNowData({
                                    externalRiderId: row.nim_id,
                                    sourceRiderName: row.da_name || '',
                                    projectId: 'proj_noon_1',
                                    projectName: 'Noon Minutes Logistics',
                                    isKeeta: false,
                                  });
                                  setMapNowSelectedEmpId('');
                                  setMapNowSearch('');
                                }}
                                className="px-2.5 py-1 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1 mx-auto"
                              >
                                <Link2 className="w-3 h-3" />
                                Map Now
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                /* STANDARD CSV TABLE */
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-400 font-semibold sticky top-0 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-2.5">Row</th>
                      <th className="p-2.5">Employee</th>
                      <th className="p-2.5">Project</th>
                      <th className="p-2.5 text-right">Hours/Units</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Recalc Gross</th>
                      <th className="p-2.5 text-right">Excel Total</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {validationResult.previewRows?.map((row: any, idx: number) => (
                      <tr
                        key={idx}
                        className={
                          row.status === 'ERROR'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : row.status === 'WARNING'
                            ? 'bg-amber-50/40 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="p-2.5 font-mono text-slate-400">#{row.rowNumber}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {row.employee_name || 'Unknown'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {row.employee_code} • {row.emirates_id || 'No EID'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600 dark:text-slate-300">{row.project}</td>
                        <td className="p-2.5 text-right font-mono font-semibold">{row.working_hours}</td>
                        <td className="p-2.5 text-right font-mono">AED {row.hourly_rate?.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600">
                          AED {row.calculated_gross?.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          {row.expected_total !== null ? `AED ${row.expected_total.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2.5 text-center">
                          <Badge
                            variant={
                              row.status === 'READY'
                                ? 'success'
                                : row.status === 'WARNING'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Validation Feedback Status */}
            {validationResult.isKeeta ? (
              validationResult.can_commit ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Validation passed! All {validationResult.ready_count} Keeta courier rows verified and mapped to Allied Employee Master. Ready to commit into {effectiveMonth} payroll.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Cannot commit: workbook contains {validationResult.unresolved_count} unmapped Courier IDs or duplicate rows. Resolve mappings above before committing.
                  </span>
                </div>
              )
            ) : validationResult.isNoon ? (
              validationResult.can_commit ? (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Validation passed! All {validationResult.ready_count} Noon rider rows verified and mapped to Allied Employee Master. Ready to commit into {effectiveMonth} payroll.
                  </span>
                </div>
              ) : (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Cannot commit: workbook contains {validationResult.unresolved_count} unmapped NIM IDs or duplicate rows. Resolve mappings above before committing.
                  </span>
                </div>
              )
            ) : validationResult.errorCount > 0 ? (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Import contains {validationResult.errorCount} fatal errors. Please fix and re-upload.
                </span>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Validation passed! Ready to commit into {effectiveMonth} payroll.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Re-Upload File
              </button>

              <button
                type="button"
                onClick={handleCommitImport}
                disabled={
                  loading ||
                  (validationResult.isKeeta
                    ? !validationResult.can_commit
                    : validationResult.isNoon
                    ? !validationResult.can_commit
                    : validationResult.errorCount > 0)
                }
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                {loading
                  ? 'Committing to Unified Payroll Database...'
                  : validationResult.isKeeta
                  ? `Commit Validated KEETA Batch (${validationResult.ready_count} Couriers)`
                  : validationResult.isNoon
                  ? `Commit Validated NOON Batch (${validationResult.ready_count} Riders)`
                  : 'Commit & Import to Payroll'}
              </button>
            </div>
          </div>
        )}

        {/* Dedicated Interactive Map Now Dialog */}
        {mapNowData && (
          <Modal
            isOpen={true}
            onClose={() => setMapNowData(null)}
            title="Map External Rider ID to Employee Master"
          >
            <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200 max-w-lg">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="font-semibold">Project:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{mapNowData.projectName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span className="font-semibold">External Rider ID:</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800">
                    {mapNowData.externalRiderId}
                  </span>
                </div>
                {mapNowData.sourceRiderName && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span className="font-semibold">Partner Source Name:</span>
                    <span className="font-medium text-slate-900 dark:text-white">{mapNowData.sourceRiderName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 block">
                  Select Allied Master Employee:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by name, code or ID..."
                    value={mapNowSearch}
                    onChange={(e) => setMapNowSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {masterEmployees
                    .filter((emp: any) => {
                      const q = mapNowSearch.toLowerCase();
                      return (
                        (emp.full_name || '').toLowerCase().includes(q) ||
                        (emp.employee_code || '').toLowerCase().includes(q) ||
                        (emp.id || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 50)
                    .map((emp: any) => (
                      <div
                        key={emp.id}
                        onClick={() => setMapNowSelectedEmpId(emp.id)}
                        className={`p-2.5 cursor-pointer flex items-center justify-between transition-colors ${
                          mapNowSelectedEmpId === emp.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{emp.full_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Code: {emp.employee_code || emp.id} {emp.designation ? `• ${emp.designation}` : ''}
                          </div>
                        </div>
                        {mapNowSelectedEmpId === emp.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Saving will establish persistent Project Rider Mapping and synchronize the active Employee Project Assignment.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMapNowData(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMapNow}
                  disabled={mappingLoading || !mapNowSelectedEmpId}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {mappingLoading ? 'Saving & Synchronizing...' : 'Confirm Assignment & Save Mapping'}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
};
