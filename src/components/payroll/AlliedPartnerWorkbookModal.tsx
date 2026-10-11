import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  FileCheck,
  Calculator,
  UserCheck,
  UserX,
  ShieldCheck,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

interface AlliedPartnerWorkbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodKey: string;
  onImportSuccess: (message: string) => void;
}

export const AlliedPartnerWorkbookModal: React.FC<AlliedPartnerWorkbookModalProps> = ({
  isOpen,
  onClose,
  periodKey,
  onImportSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any | null>(null);
  const [fileName, setFileName] = useState<string>('Pixel Syntax Delivery Software.xlsx');
  const [fileHash, setFileHash] = useState<string>('');
  const [isDuplicateCommitted, setIsDuplicateCommitted] = useState<boolean>(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Filter state in preview table
  const [riderFilter, setRiderFilter] = useState<'ALL' | 'RESOLVED' | 'UNRESOLVED' | 'NEGATIVE'>('ALL');

  // Inline Rider Mapping Modal state
  const [mappingTargetRider, setMappingTargetRider] = useState<any | null>(null);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [mappingLoading, setMappingLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch employees for mapping dropdown
  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/v1/payroll/employees');
      const data = await res.json();
      if (data.success) {
        setAvailableEmployees(data.employees || []);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  // Load and parse either the uploaded file or the sample workbook
  const handleParseWorkbook = async (fileBase64?: string, customFileName?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload: any = {
        month: periodKey,
        fileName: customFileName || fileName,
      };

      if (fileBase64) {
        payload.fileBase64 = fileBase64;
        payload.useDefaultSample = false;
      } else {
        payload.useDefaultSample = true;
      }

      const res = await fetch('/api/v1/payroll/partner-workbook/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setParsedData(json.data);
        setFileName(json.fileName);
        setFileHash(json.fileHash);
        setIsDuplicateCommitted(json.isDuplicateCommitted);
        setDuplicateWarning(json.duplicateWarning);
      } else {
        setErrorMsg(json.message || 'Failed to parse partner workbook.');
      }
    } catch (err: any) {
      console.error('Parse error:', err);
      setErrorMsg(err.message || 'Network error analyzing partner workbook.');
    } finally {
      setLoading(false);
    }
  };

  // Handle custom file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      handleParseWorkbook(base64String, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Save new Rider Mapping for unresolved rider
  const handleSaveRiderMapping = async () => {
    if (!mappingTargetRider || !selectedEmpId) return;
    setMappingLoading(true);
    try {
      const emp = availableEmployees.find((e) => e.id === selectedEmpId);
      const res = await fetch('/api/v1/payroll/rider-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: 'proj_allied_partner',
          project_name: 'Allied Delivery Services Partner Payout',
          external_rider_id: mappingTargetRider.external_rider_id,
          employee_id: selectedEmpId,
          employee_code: emp?.employee_code,
          notes: `Mapped from partner payout workbook for ${mappingTargetRider.source_name}`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMappingTargetRider(null);
        setSelectedEmpId('');
        // Re-parse with updated mappings!
        handleParseWorkbook();
      } else {
        alert(data.message || 'Failed to save rider mapping.');
      }
    } catch (err: any) {
      console.error('Mapping error:', err);
      alert(err.message || 'Network error saving rider mapping.');
    } finally {
      setMappingLoading(false);
    }
  };

  // Commit partner workbook batch
  const handleCommitBatch = async () => {
    if (!parsedData || isDuplicateCommitted) return;

    const unresolved = parsedData.previewRows.filter((r: any) => !r.resolved);
    if (unresolved.length > 0) {
      if (
        !window.confirm(
          `There are ${unresolved.length} unresolved riders in this workbook. They will be excluded from the payroll disimbursement until mapped. Do you wish to commit the ${parsedData.resolvedRidersCount} resolved riders?`
        )
      ) {
        return;
      }
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/v1/payroll/partner-workbook/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName,
          fileHash,
          month: periodKey,
          sourcePeriodStart: parsedData.sourcePeriodStart,
          sourcePeriodEnd: parsedData.sourcePeriodEnd,
          resolvedRows: parsedData.previewRows.filter((r: any) => r.resolved),
          reconciliation: parsedData.reconciliation,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onImportSuccess(data.message || 'Partner workbook committed to payroll successfully.');
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to commit partner workbook.');
      }
    } catch (err: any) {
      console.error('Commit error:', err);
      setErrorMsg(err.message || 'Network error committing partner workbook.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered rows for the review table
  const filteredRows = (parsedData?.previewRows || []).filter((row: any) => {
    if (riderFilter === 'RESOLVED') return row.resolved;
    if (riderFilter === 'UNRESOLVED') return !row.resolved;
    if (riderFilter === 'NEGATIVE') return row.is_negative_earning;
    return true;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delivery Partner Payout Workbook Import (V1 Engine)"
    >
      <div className="space-y-6 text-slate-900 dark:text-white max-w-5xl">
        {/* Architectural Scope Banner */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200 block text-sm">
                Strict Profile: ALLIED_DELIVERY_PARTNER_PAYOUT_V1
              </span>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                Hourly rate formula (Hours × Rate) is <strong>STRICTLY DISABLED</strong> for this partner format.
                Uses 9 sheets: Summary, Daily earnings, Attendance, Additional DA Earnings, Rider & Vendor Deductions, and Invoicing.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="amber" size="sm">NON-HOURLY</Badge>
            <Badge variant="blue" size="sm">9 SHEETS</Badge>
          </div>
        </div>

        {/* Error / Duplicate Warning */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <XCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {duplicateWarning && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 text-rose-700 dark:text-rose-300 text-xs font-semibold">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{duplicateWarning}</span>
            </div>
            <Badge variant="rose" size="sm">COMMITTED</Badge>
          </div>
        )}

        {/* File Analysis & Parse Controls */}
        {!parsedData ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-3xl p-6 bg-slate-50 dark:bg-slate-900/60 text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Select Partner Delivery Workbook
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Load the official partner settlement file for {periodKey} to verify deterministic calculations, batch reconciliation, and rider resolution.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => handleParseWorkbook()}
                disabled={loading}
                className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Load Client Sample (Pixel Syntax Delivery Software.xlsx)</span>
              </button>

              <label className="w-full sm:w-auto px-5 py-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>Upload Custom .xlsx File</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Batch Header Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Source Period</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                  {parsedData.sourcePeriodStart} → {parsedData.sourcePeriodEnd}
                </span>
                <span className="text-[10px] text-slate-500">From daily date headers</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Stated Net</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5">
                  AED {parsedData.reconciliation.summaryTotalFinalEarning.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500">Summary sheet sum</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deductions</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400 block mt-0.5">
                  AED {parsedData.reconciliation.summaryTotalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-500">Matches Rider Ded Sheet</span>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolution Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-black text-emerald-600">
                    {parsedData.resolvedRidersCount} Resolved
                  </span>
                  <span className="text-xs text-slate-400">/</span>
                  <span className={`text-xs font-black ${parsedData.unresolvedRidersCount > 0 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {parsedData.unresolvedRidersCount} Pending
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">Rider ID &gt; Code &gt; EID</span>
              </div>
            </div>

            {/* Reconciliation & Sheet Checklist */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Batch-Level 3-Way Deterministic Reconciliation
                  </span>
                </div>
                <Badge
                  variant={parsedData.reconciliation.status === 'PASS' ? 'emerald' : 'amber'}
                  size="sm"
                >
                  {parsedData.reconciliation.status === 'PASS' ? 'ALL CHECKS MATCH' : 'VERIFICATION WARNING'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                {parsedData.reconciliation.checks.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2"
                  >
                    <div>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block line-clamp-1">
                        {c.rule}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Exp: {c.expected.toFixed(2)} | Act: {c.actual.toFixed(2)}
                      </span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  </div>
                ))}
              </div>

              {/* Sheet presence indicators */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-semibold mr-1">Detected Sheets:</span>
                {parsedData.sheetsDetected.sheetNames.map((sName: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium text-[10px]"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {sName}
                  </span>
                ))}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setRiderFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    riderFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  All Riders ({parsedData.previewRows.length})
                </button>
                <button
                  onClick={() => setRiderFilter('RESOLVED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    riderFilter === 'RESOLVED'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Resolved ({parsedData.resolvedRidersCount})
                </button>
                <button
                  onClick={() => setRiderFilter('UNRESOLVED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    riderFilter === 'UNRESOLVED'
                      ? 'bg-amber-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Unresolved ({parsedData.unresolvedRidersCount})
                </button>
                <button
                  onClick={() => setRiderFilter('NEGATIVE')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    riderFilter === 'NEGATIVE'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Negative Net ({parsedData.previewRows.filter((r: any) => r.is_negative_earning).length})
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-mono">
                SHA-256: {fileHash.substring(0, 10)}...
              </span>
            </div>

            {/* Riders Preview Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/70 dark:bg-slate-800/70 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <th className="py-2.5 px-3">Rider ID & Source Name</th>
                    <th className="py-2.5 px-3">Payout Mapping</th>
                    <th className="py-2.5 px-3">ERP Match</th>
                    <th className="py-2.5 px-3 text-right">Orders</th>
                    <th className="py-2.5 px-3 text-right">Source Net</th>
                    <th className="py-2.5 px-3 text-right">ERP Liabilities</th>
                    <th className="py-2.5 px-3 text-right">Payroll Net</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {filteredRows.map((row: any) => {
                    const isExpanded = expandedRow === row.external_rider_id;
                    return (
                      <React.Fragment key={row.external_rider_id}>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span className="font-mono text-emerald-600 dark:text-emerald-400">
                                {row.external_rider_id}
                              </span>
                              <span>·</span>
                              <span>{row.source_name}</span>
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Att: {row.supporting_details.attendance_days_present} days present
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                              {row.payout_mapping}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            {row.resolved ? (
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {row.employee_name}
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {row.employee_code} ({row.matched_by})
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-amber-600 font-bold text-[11px]">
                                <UserX className="w-3.5 h-3.5" />
                                <span>UNRESOLVED</span>
                              </div>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono">
                            {row.orders}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            <span
                              className={
                                row.final_source_earning < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-900 dark:text-white'
                              }
                            >
                              AED {row.final_source_earning.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono text-[11px]">
                            {row.erp_additional_deductions?.traffic_fines > 0 ? (
                              <span className="text-amber-600">
                                -AED {row.erp_additional_deductions.traffic_fines.toFixed(2)} fine
                              </span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right font-mono font-black">
                            <span
                              className={
                                row.calculated_payroll_net < 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }
                            >
                              AED {row.calculated_payroll_net?.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {row.validation_status === 'READY' ? (
                              <Badge variant="emerald" size="sm">READY</Badge>
                            ) : row.validation_status === 'WARNING' ? (
                              <Badge variant="amber" size="sm">
                                {row.is_negative_earning ? 'NEGATIVE NET' : 'REVIEW'}
                              </Badge>
                            ) : (
                              <Badge variant="rose" size="sm">ACTION REQ</Badge>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!row.resolved && (
                                <button
                                  onClick={() => {
                                    setMappingTargetRider(row);
                                    // Preselect employee if matching by name hint
                                    const match = availableEmployees.find(
                                      (e) =>
                                        e.full_name?.toLowerCase().includes(row.source_name.toLowerCase()) ||
                                        row.source_name.toLowerCase().includes(e.full_name?.toLowerCase() || '')
                                    );
                                    if (match) setSelectedEmpId(match.id);
                                  }}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                >
                                  Map Rider
                                </button>
                              )}

                              <button
                                onClick={() =>
                                  setExpandedRow(isExpanded ? null : row.external_rider_id)
                                }
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="Toggle Sheet Breakdown"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Breakdown Accordion */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800">
                            <td colSpan={9} className="p-3 text-[11px] space-y-2">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] text-slate-400 uppercase block">Actual Earning (App)</span>
                                  <span className="font-bold">AED {row.actual_earnings.toFixed(2)}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] text-slate-400 uppercase block">Minimum Guarantee (MG)</span>
                                  <span className="font-bold">AED {row.mg.toFixed(2)}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] text-slate-400 uppercase block">Additional Earnings (Tips)</span>
                                  <span className="font-bold text-emerald-600">+AED {row.additional_earnings.toFixed(2)}</span>
                                </div>
                                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[10px] text-slate-400 uppercase block">Partner Deductions</span>
                                  <span className="font-bold text-rose-600">-AED {row.source_deductions.toFixed(2)}</span>
                                </div>
                              </div>

                              {row.validation_flags?.length > 0 && (
                                <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-800 dark:text-amber-300 space-y-1">
                                  <span className="font-bold block">Validation Notes:</span>
                                  {row.validation_flags.map((f: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1.5">
                                      <span>•</span>
                                      <span>{f}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setParsedData(null)}
                className="w-full sm:w-auto px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-2xl text-xs transition-colors"
              >
                ← Back / Select Another File
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCommitBatch}
                  disabled={loading || isDuplicateCommitted}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Commit Partner Payout to Payroll Engine</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Rider Mapping Modal */}
        {mappingTargetRider && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full space-y-4 animate-in fade-in zoom-in-95">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Authoritative Rider ID Mapping
                </span>
                <h4 className="text-base font-black text-slate-900 dark:text-white">
                  Link Rider {mappingTargetRider.external_rider_id} to ERP Employee
                </h4>
                <p className="text-xs text-slate-500">
                  Source Name: <strong>{mappingTargetRider.source_name}</strong>.
                  Name matching alone is forbidden. Select the verified employee record.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Select Master Employee
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Choose Employee --</option>
                  {availableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_code} - {emp.full_name} ({emp.designation || 'Rider'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setMappingTargetRider(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRiderMapping}
                  disabled={!selectedEmpId || mappingLoading}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-colors disabled:opacity-50"
                >
                  {mappingLoading ? 'Saving...' : 'Confirm Mapping'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
