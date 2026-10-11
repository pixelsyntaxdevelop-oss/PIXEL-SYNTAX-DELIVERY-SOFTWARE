import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  HelpCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { fleetService } from '../../services/fleetService';
import { apiClient } from '../../services/apiClient';

interface VehicleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  duplicateChassis: number;
  existingChassisConflicts: number;
  missingRequired: number;
  readyToImport: number;
  valid?: number;
  duplicatePlate?: number;
  existingConflicts?: number;
}

export const VehicleImportModal: React.FC<VehicleImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    summary: ValidationSummary;
    rows: any[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    totalVehiclesAfterImport: number;
    rowErrors?: {
      rowNumber: number;
      plate_number: string;
      chassis_number?: string;
      error: string;
      failingColumn?: string;
      cause?: string;
    }[];
    failureSummaryByCause?: Record<
      string,
      { count: number; description: string; samplePlates: string[]; sampleRows: number[] }
    >;
  } | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setSelectedFile(null);
    setValidationResult(null);
    setError(null);
    setIsConfirmOpen(false);
    setCommitResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const processFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const nameLower = file.name.toLowerCase();
    const isValidExt = validExtensions.some((ext) => nameLower.endsWith(ext));

    if (!isValidExt) {
      setError('Please select a valid Excel (.xlsx) or CSV (.csv) file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setValidationResult(null);
    setCommitResult(null);
    setValidating(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiClient.post<any>('/api/erp/fleet/bulk-import/validate', formData);

      if (res.data && res.data.summary) {
        setValidationResult(res.data);
      } else {
        setError(res.error || 'Failed to validate uploaded file.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error parsing file.');
    } finally {
      setValidating(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleCommit = async () => {
    if (!validationResult || !validationResult.rows) return;
    setCommitting(true);
    setError(null);

    try {
      // Commit only valid rows
      const commitRes = await fleetService.commitBulkImport(validationResult.rows);

      if (commitRes.success || commitRes.importedCount > 0) {
        setCommitResult({
          success: true,
          importedCount: commitRes.importedCount,
          skippedCount: commitRes.skippedCount,
          failedCount: commitRes.failedCount,
          totalVehiclesAfterImport: commitRes.totalVehiclesAfterImport,
          rowErrors: commitRes.rowErrors || [],
          failureSummaryByCause: commitRes.failureSummaryByCause,
        });
        setIsConfirmOpen(false);
        // Trigger live fleet reload immediately
        onSuccess();
      } else {
        setError(commitRes.error || 'Failed to commit vehicles into fleet master.');
        setIsConfirmOpen(false);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error persisting vehicles.');
      setIsConfirmOpen(false);
    } finally {
      setCommitting(false);
    }
  };

  const summary = validationResult?.summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Import Fleet Vehicles
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Vehicle Master
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  XLSX & CSV
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Onboard motorcycles and fleet vehicles first. Assignments to riders and projects are handled separately.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/erp/fleet/bulk-import-template"
              download="allied_fleet_vehicles_template.xlsx"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
              title="Download official 21-column Excel template"
            >
              <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Template (.XLSX)</span>
            </a>
            <a
              href="/api/erp/fleet/bulk-import-template?format=csv"
              download="allied_fleet_vehicles_template.csv"
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
              title="Download official CSV template"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Template (.CSV)</span>
            </a>
            <button
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
              <div className="flex-1 font-semibold">{error}</div>
              <button
                onClick={() => setError(null)}
                className="text-rose-600 dark:text-rose-400 hover:underline font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Success Banner after commit */}
          {commitResult && (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <h4 className="text-sm font-black uppercase tracking-wider">
                  Vehicle Import Completed Successfully
                </h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Imported Vehicles</span>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {commitResult.importedCount}
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Skipped / Conflicts</span>
                  <div className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5">
                    {commitResult.skippedCount}
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Failed</span>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-0.5">
                    {commitResult.failedCount}
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-slate-900/60 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Active Fleet</span>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-0.5">
                    {commitResult.totalVehiclesAfterImport}
                  </div>
                </div>
              </div>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 pt-1">
                New vehicles are now registered in the Allied Fleet Master and appear in live operations immediately.
              </p>

              {commitResult.failedCount > 0 && commitResult.rowErrors && commitResult.rowErrors.length > 0 && (
                <div className="mt-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200 font-bold text-xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Failed Rows Breakdown ({commitResult.failedCount} rows)</span>
                  </div>
                  <div className="mt-2.5 max-h-40 overflow-y-auto space-y-1.5 text-xs text-rose-700 dark:text-rose-300">
                    {commitResult.rowErrors.map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white/60 dark:bg-slate-900/50 p-2 rounded-lg border border-rose-100 dark:border-rose-900/30">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">Row {err.rowNumber}:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">Plate {err.plate_number}</span>
                        {err.chassis_number && <span className="font-mono text-slate-500">VIN: {err.chassis_number}</span>}
                        <span className="text-rose-600 dark:text-rose-400 font-mono text-[11px] ml-auto">{err.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Dropzone (When not committing or already committed) */}
          {!commitResult && (
            <div>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                    {validating ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-6 h-6" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-800 dark:text-white">
                      {validating
                        ? 'Validating file rows & checking conflicts...'
                        : selectedFile
                        ? `Selected: ${selectedFile.name}`
                        : 'Choose or drag & drop vehicle data file'}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Supports Excel spreadsheet (.xlsx, .xls) and CSV (.csv)
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                      Vehicle Master Only
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                      No Auto-Assignments
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Result Preview */}
          {validationResult && summary && !commitResult && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* 1. SEVEN CRITICAL VALIDATION METRICS */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Validation Preview Statistics
                  </h4>
                  <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                    Pre-Commit Check — No DB Writes Yet
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* 1. Total Rows */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Rows
                    </div>
                    <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {summary.totalRows}
                    </div>
                  </div>

                  {/* 2. Valid Rows */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20">
                    <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Valid Rows
                    </div>
                    <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                      {summary.validRows ?? summary.valid}
                    </div>
                  </div>

                  {/* 3. Duplicate Chassis */}
                  <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20">
                    <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                      Duplicate Chassis
                    </div>
                    <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
                      {summary.duplicateChassis}
                    </div>
                  </div>

                  {/* 4. Existing Chassis Conflicts */}
                  <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20">
                    <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                      Existing Chassis Conflicts
                    </div>
                    <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
                      {summary.existingChassisConflicts ?? summary.existingConflicts}
                    </div>
                  </div>

                  {/* 5. Missing Required */}
                  <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
                    <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Missing Required
                    </div>
                    <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                      {summary.missingRequired}
                    </div>
                  </div>

                  {/* 6. Ready To Import */}
                  <div
                    className={`p-3.5 rounded-xl border ${
                      summary.readyToImport > 0
                        ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                        : 'border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider">
                      Ready To Import
                    </div>
                    <div className="text-xl font-black mt-1">
                      {summary.readyToImport}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational notice for duplicate plates (Allowed by fleet business rule) */}
              {Boolean(summary.duplicatePlate) && (
                <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Informational Note:</span>
                    <span>{summary.duplicatePlate} row(s) have shared plate numbers. In Allied fleet, plate numbers are not globally unique; import proceeds normally.</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-[11px] font-bold text-blue-700 dark:text-blue-200">
                    Allowed
                  </span>
                </div>
              )}

              {/* Safety Rule Notice */}
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 text-xs flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold">Production Isolation & Import Rules: </span>
                  <span>
                    Only VALID / READY rows will be committed to the production database for Allied (company_pixel_syntax).
                    Rows with duplicate chassis numbers or existing chassis conflicts will be safely skipped. Plate duplicates are permitted.
                    No riders or projects will be auto-assigned.
                  </span>
                </div>
              </div>

              {/* 2. ROW PREVIEW TABLE */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Parsed File Rows ({validationResult.rows.length})
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Showing all parsed rows
                  </span>
                </div>

                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Plate</th>
                        <th className="px-3 py-2">Emirate</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Make / Model</th>
                        <th className="px-3 py-2">Year</th>
                        <th className="px-3 py-2">TC Number</th>
                        <th className="px-3 py-2">Chassis</th>
                        <th className="px-3 py-2">Mulkiya Expiry</th>
                        <th className="px-3 py-2">Validation Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {validationResult.rows.map((row: any, idx: number) => {
                        const hasErrors = row.errors && row.errors.length > 0;
                        return (
                          <tr
                            key={idx}
                            className={
                              hasErrors
                                ? 'bg-rose-50/40 dark:bg-rose-950/10'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                            }
                          >
                            <td className="px-3 py-2 font-mono text-slate-500">
                              #{row.rowNumber || idx + 2}
                            </td>
                            <td className="px-3 py-2">
                              {hasErrors ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                                  <AlertCircle className="w-3 h-3" /> Error
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3" /> Ready
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">
                              {row.plate_number ? `${row.plate_code || ''} ${row.plate_number}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.plate_emirate || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.vehicle_type || '—'}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                              {row.make} {row.model}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.year || '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300">
                              {row.tc_number || '—'}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                              {row.chassis_number || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                              {row.registration_expiry || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {hasErrors ? (
                                <span className="text-rose-600 dark:text-rose-400 font-semibold text-[11px]">
                                  {row.errors.join(', ')}
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                                  Clean & valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between sticky bottom-0 bg-white dark:bg-slate-900 rounded-b-2xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {validationResult ? (
              <span>
                <strong className="text-slate-700 dark:text-slate-200">{summary?.readyToImport ?? 0}</strong> of{' '}
                <strong className="text-slate-700 dark:text-slate-200">{summary?.totalRows ?? 0}</strong> rows ready to import
              </span>
            ) : (
              <span>Upload an Excel or CSV file to begin validation preview</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
            >
              {commitResult ? 'Close' : 'Cancel'}
            </button>

            {validationResult && !commitResult && (
              <button
                type="button"
                disabled={committing || (summary?.readyToImport ?? 0) === 0}
                onClick={() => setIsConfirmOpen(true)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirm & Import ({summary?.readyToImport ?? 0} Bikes)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Before Write (Strict user consent before write) */}
      {isConfirmOpen && summary && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Confirm Vehicle Import
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target Tenant: Allied (company_pixel_syntax)
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to import{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{summary.readyToImport}</strong> valid
              vehicles into the production Fleet Master?
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span>Valid Rows to Add:</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{summary.readyToImport}</strong>
              </div>
              <div className="flex justify-between">
                <span>Skipped (Duplicates/Conflicts):</span>
                <strong className="text-amber-600 dark:text-amber-400">{summary.totalRows - summary.readyToImport}</strong>
              </div>
              <div className="flex justify-between">
                <span>Rider/Project Assignment:</span>
                <strong className="text-slate-700 dark:text-slate-300">None (Manual Later)</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={committing}
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={committing}
                onClick={handleCommit}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-2"
              >
                {committing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Writing to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, Import Vehicles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
