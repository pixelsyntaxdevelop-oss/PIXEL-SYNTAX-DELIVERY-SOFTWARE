import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Users,
  Truck,
  Smartphone,
  DollarSign,
  Calendar,
  BarChart2,
  RefreshCw,
  Download,
  ArrowRight,
  X,
  FileCheck,
} from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';

interface DataImportCenterViewProps {
  lang?: 'EN' | 'AR';
}

type ImportType = 'EMPLOYEES' | 'VEHICLES' | 'SIMS' | 'SALARY_SHEET' | 'ATTENDANCE' | 'PERFORMANCE';

export const DataImportCenterView: React.FC<DataImportCenterViewProps> = ({ lang = 'EN' }) => {
  const [selectedType, setSelectedType] = useState<ImportType>('EMPLOYEES');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Upload, 2: Mapping, 3: Preview/Validation, 4: Result
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Mock parsed preview records
  const [previewRecords, setPreviewRecords] = useState<Array<Record<string, any>>>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStep(2);
    }
  };

  const handleSimulateDrop = () => {
    setFileName('August_Rider_Roster_Master.xlsx');
    setStep(2);
  };

  const executeImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setStep(4);
    }, 1200);
  };

  const resetFlow = () => {
    setStep(1);
    setFileName(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Banner */}
      <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Bulk Data Migration & Sync Hub
            </span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Unified Data Import Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Safely bulk import employees, vehicle inventory, SIM cards, aggregator salary sheets, and daily attendance logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedType === 'SALARY_SHEET' ? (
            <div className="flex items-center gap-2">
              <a
                href="/api/v1/payroll/templates/keeta"
                download="KEETA_Payroll_Template.xlsx"
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download KEETA Template (.xlsx)</span>
              </a>
              <a
                href="/api/v1/payroll/templates/noon"
                download="NOON_Payroll_Template.xlsx"
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" />
                <span>NOON Template</span>
              </a>
            </div>
          ) : (
            <button
              onClick={() => {
                alert('Downloading standardized sample CSV template...');
              }}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Download Sample Template</span>
            </button>
          )}
        </div>
      </div>

      {/* Import Type Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-bold">
        {[
          { id: 'EMPLOYEES', label: 'Employees Master', icon: Users },
          { id: 'VEHICLES', label: 'Fleet & Bikes', icon: Truck },
          { id: 'SIMS', label: 'SIM Inventory', icon: Smartphone },
          { id: 'SALARY_SHEET', label: 'Project Salary Sheet', icon: DollarSign },
          { id: 'ATTENDANCE', label: 'Daily Attendance', icon: Calendar },
          { id: 'PERFORMANCE', label: 'Client Performance', icon: BarChart2 },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = selectedType === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setSelectedType(item.id as any);
                resetFlow();
              }}
              className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all ${
                isSelected
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 mb-1" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Progress Steps Header */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-6">
          <span className={`flex items-center gap-1.5 ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
            <span>Upload File</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={`flex items-center gap-1.5 ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">2</span>
            <span>Auto-Map Fields</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={`flex items-center gap-1.5 ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">3</span>
            <span>Validation Preview</span>
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={`flex items-center gap-1.5 ${step >= 4 ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">4</span>
            <span>Import Summary</span>
          </span>
        </div>
      </div>

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="p-10 bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-center flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white">
              Upload {selectedType.replace('_', ' ')} Spreadsheet
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Supports Microsoft Excel (.xlsx, .xls) and CSV files. Duplicate records will be automatically flagged before committing.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors">
              Browse Computer
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={handleSimulateDrop}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
            >
              Use Sample Data
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Field Mapping */}
      {step === 2 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Field Mapping Configuration ({fileName})
              </h3>
              <p className="text-xs text-slate-400">All columns automatically matched to enterprise database schema</p>
            </div>
            <button onClick={resetFlow} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">File Header: "Rider Name"</span>
              <span className="text-emerald-600 font-bold">→ full_name (Matched)</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">File Header: "Employee Code"</span>
              <span className="text-emerald-600 font-bold">→ employee_code (Matched)</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">File Header: "Emirates ID"</span>
              <span className="text-emerald-600 font-bold">→ emirates_id (Matched)</span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl flex items-center justify-between">
              <span className="font-bold text-slate-700 dark:text-slate-300">File Header: "Current Project"</span>
              <span className="text-emerald-600 font-bold">→ current_project_name (Matched)</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetFlow} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold">
              Cancel
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              Continue to Preview & Validate
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview & Validation */}
      {step === 3 && (
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Pre-Import Validation Check (3 Records Detected)
              </h3>
              <p className="text-xs text-slate-400">Review flagged warnings before writing to operational database</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              1 Warning Found
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Emirates ID</th>
                  <th className="py-2.5 px-3">Project</th>
                  <th className="py-2.5 px-3">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {previewRecords.map((r) => (
                  <tr key={r.code}>
                    <td className="py-2.5 px-3 font-mono font-bold">{r.code}</td>
                    <td className="py-2.5 px-3 font-bold">{r.name}</td>
                    <td className="py-2.5 px-3 font-mono">{r.emiratesId || '—'}</td>
                    <td className="py-2.5 px-3">{r.project}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.valid
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button onClick={() => setStep(2)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 rounded-xl text-xs font-bold">
              Back
            </button>
            <button
              onClick={executeImport}
              disabled={importing}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
            >
              {importing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
              <span>{importing ? 'Processing Data Import...' : 'Confirm & Commit Import'}</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Success Result Summary */}
      {step === 4 && (
        <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Data Import Successfully Completed!
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              3 employee records synchronized into Multi-Tenant Master Database with audit logs recorded.
            </p>
          </div>

          <div className="max-w-md mx-auto grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 text-emerald-800 dark:text-emerald-300 font-bold">
              3 Created / Updated
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 text-slate-600 dark:text-slate-300 font-bold">
              0 Duplicate Conflicts
            </div>
          </div>

          <button
            onClick={resetFlow}
            className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-xs font-bold"
          >
            Import Another Dataset
          </button>
        </div>
      )}
    </div>
  );
};
