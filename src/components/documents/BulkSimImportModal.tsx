import React, { useState } from 'react';
import { X, FileSpreadsheet, Loader2, Upload, AlertCircle, ArrowRight, Filter } from 'lucide-react';
import { Modal } from '../common/Modal';
import { apiClient } from '../../services/apiClient';
import * as XLSX from 'xlsx';
import { normalizeAndValidateUaeMobileForWorker } from '../../utils/simValidationUtils';

interface BulkSimImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result?: any) => void;
}

type FilterType = 'ALL' | 'VALID' | 'DUPLICATE' | 'INVALID' | 'UNRESOLVED';

export const BulkSimImportModal: React.FC<BulkSimImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'SELECT' | 'PREVIEW' | 'VALIDATED'>('SELECT');
  const [preview, setPreview] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [validatedSims, setValidatedSims] = useState<any[]>([]);
  const [counts, setCounts] = useState<{
    total: number;
    valid: number;
    duplicates: number;
    invalid: number;
    unresolved: number;
  } | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAll = () => {
    setStep('SELECT');
    setFile(null);
    setPreview([]);
    setActiveFilter('ALL');
    setCounts(null);
    setValidatedSims([]);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleContinueToPreview = async () => {
    if (!file) return;

    setIsParsing(true);
    setError(null);
    setActiveFilter('ALL');
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets['SIMs'] || workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
      
      if (json.length === 0) {
        throw new Error('No data found in SIMs sheet.');
      }

      const parsedRows = json.map((item: any, idx: number) => {
        const rawMobile = String(
          item['SIM Number'] ??
          item['SIM number'] ??
          item['sim number'] ??
          item['Account number'] ??
          item['Account Number'] ??
          item['account number'] ??
          item.mobile_number ??
          item.phone ??
          item.phone_number ??
          ''
        ).trim();

        const rawIccid = String(
          item.iccid ??
          item.ICCID ??
          item['Chip Serial'] ??
          item.chip_serial ??
          item.sim_serial_number ??
          ''
        ).trim();

        const normResult = normalizeAndValidateUaeMobileForWorker(rawMobile);
        
        let reason = '';
        let status: 'VALID' | 'INVALID' | 'DUPLICATE' = 'VALID';

        if (!rawMobile) {
          status = 'INVALID';
          reason = 'Missing SIM Number';
        } else if (!normResult.valid) {
          status = 'INVALID';
          reason = normResult.error && normResult.error !== 'INVALID' ? normResult.error : 'Invalid SIM Number';
        }

        const hasAssignmentRef = Boolean(
          item['Assigned To'] ||
          item['Driver Name'] ||
          item['Employee'] ||
          item['Employee Name'] ||
          item['Vehicle'] ||
          item['Project'] ||
          item['Rider']
        );
        const refParts: string[] = [];
        if (item['Assigned To'] || item['Driver Name'] || item['Employee'] || item['Employee Name'] || item['Rider']) {
          refParts.push(`Employee: ${item['Assigned To'] || item['Driver Name'] || item['Employee'] || item['Employee Name'] || item['Rider']}`);
        }
        if (item['Vehicle']) refParts.push(`Vehicle: ${item['Vehicle']}`);
        if (item['Project']) refParts.push(`Project: ${item['Project']}`);

        return {
          ...item,
          _rowId: idx + 1,
          mobile_number: rawMobile,
          iccid: rawIccid,
          normalized_mobile_number: normResult.valid ? normResult.normalized : '',
          validationStatus: status,
          isUnresolved: hasAssignmentRef,
          unresolvedReason: refParts.join(', ') || 'Assignment reference (will import as unassigned inventory)',
          reason: reason || 'Ready to import',
        };
      });

      setPreview(parsedRows);
      setCounts({
        total: parsedRows.length,
        valid: parsedRows.filter(r => r.validationStatus === 'VALID').length,
        duplicates: 0,
        invalid: parsedRows.filter(r => r.validationStatus === 'INVALID').length,
        unresolved: parsedRows.filter(r => r.isUnresolved).length,
      });
      setStep('PREVIEW');
    } catch (err: any) {
      setError(err.message || 'Failed to parse Excel file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleValidate = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      // Send locally valid SIMs with validateOnly: true
      const locallyValidSims = preview.filter((r) => r.validationStatus === 'VALID');
      const res = await apiClient.post('/api/erp/sims/bulk-import', {
        sims: locallyValidSims.length > 0 ? locallyValidSims : preview,
        validateOnly: true,
      });

      if (!res || !res.data || !res.data.success) {
        throw new Error(res.data?.error || 'Backend validation failed.');
      }

      const validList = Array.isArray(res.data.valid) ? res.data.valid : [];
      const dupList = Array.isArray(res.data.duplicates) ? res.data.duplicates : [];
      const invList = Array.isArray(res.data.invalid) ? res.data.invalid : [];
      const unresList = Array.isArray(res.data.unresolved) ? res.data.unresolved : [];

      setValidatedSims(validList);

      const localInvalidCount = preview.filter((r) => r.validationStatus === 'INVALID').length;
      const totalInvalidCount = localInvalidCount + invList.length;

      setCounts({
        total: typeof res.data.total === 'number' ? res.data.total : preview.length,
        valid: validList.length,
        duplicates: dupList.length,
        invalid: totalInvalidCount,
        unresolved: unresList.length,
      });

      // Build mapping for duplicate reasons
      const dupPhoneMap = new Map<string, string>();
      const dupIccidMap = new Map<string, string>();
      for (const d of dupList) {
        const phone = String(d.mobile_number || d.raw_mobile_number || '').trim();
        const iccid = String(d.iccid || d.ICCID || '').trim().toLowerCase();
        const isIccidDup = d.error === 'DUPLICATE_ICCID' || (d.reason && d.reason.toLowerCase().includes('iccid'));
        const r = isIccidDup ? 'Duplicate ICCID' : 'Duplicate SIM Number';
        if (phone) dupPhoneMap.set(phone, r);
        if (iccid) dupIccidMap.set(iccid, r);
      }

      // Build mapping for invalid reasons
      const invMap = new Map<string, string>();
      for (const inv of invList) {
        const phone = String(inv.mobile_number || inv.raw_mobile_number || '').trim();
        const r = inv.reason || (inv.error === 'INVALID_PHONE_FORMAT' ? 'Invalid SIM Number' : (inv.error || 'Invalid SIM Number'));
        if (phone) invMap.set(phone, r);
      }

      // Build mapping for unresolved reasons
      const unresMap = new Map<string, string>();
      for (const u of unresList) {
        const phone = String(u.mobile_number || u.raw_mobile_number || '').trim();
        const iccid = String(u.iccid || '').trim().toLowerCase();
        const refParts: string[] = [];
        if (u.assigned_to) refParts.push(`Employee: ${u.assigned_to}`);
        if (u.vehicle) refParts.push(`Vehicle: ${u.vehicle}`);
        if (u.project) refParts.push(`Project: ${u.project}`);
        const r = refParts.join(', ') || u.note || 'Assignment reference (will import as unassigned inventory)';
        if (phone) unresMap.set(phone, r);
        if (iccid) unresMap.set(iccid, r);
      }

      const validPhoneSet = new Set(validList.map((v: any) => String(v.raw_mobile_number || v.mobile_number || '').trim()));

      setPreview((prev) =>
        prev.map((item) => {
          const phone = String(item.mobile_number || '').trim();
          const iccid = String(item.ICCID || item.iccid || '').trim();
          const iccidLower = iccid.toLowerCase();

          // 1. Invalid
          if (item.validationStatus === 'INVALID' || invMap.has(phone)) {
            const reason = invMap.get(phone) || item.reason || (!phone ? 'Missing SIM Number' : 'Invalid SIM Number');
            return {
              ...item,
              validationStatus: 'INVALID',
              reason,
            };
          }

          // 2. Duplicate
          if (dupPhoneMap.has(phone) || (iccid && dupIccidMap.has(iccidLower))) {
            const reason = (iccid && dupIccidMap.has(iccidLower))
              ? dupIccidMap.get(iccidLower)!
              : (dupPhoneMap.get(phone) || 'Duplicate SIM Number');
            return {
              ...item,
              validationStatus: 'DUPLICATE',
              reason,
            };
          }

          // 3. Unresolved
          const isUnres = unresMap.has(phone) || (iccid && unresMap.has(iccidLower)) || Boolean(item.isUnresolved);
          const unresReason = unresMap.get(phone) || (iccid ? unresMap.get(iccidLower) : null) || item.unresolvedReason || 'Assignment reference (will import as unassigned inventory)';

          // 4. Valid
          if (validPhoneSet.has(phone)) {
            return {
              ...item,
              validationStatus: 'VALID',
              isUnresolved: isUnres,
              unresolvedReason: unresReason,
              reason: isUnres ? unresReason : 'Ready to import',
            };
          }

          return {
            ...item,
            isUnresolved: isUnres,
            unresolvedReason: unresReason,
          };
        })
      );

      setStep('VALIDATED');
    } catch (err: any) {
      const backendError = err.response?.data?.error || err.message || 'Unknown error';
      const backendDetails = err.response?.data?.details ? ` (${err.response.data.details})` : '';
      setError(`Backend validation failed: ${backendError}${backendDetails}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!validatedSims || validatedSims.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await apiClient.post('/api/erp/sims/bulk-import', {
        sims: validatedSims,
        validateOnly: false,
      });

      if (res?.error) {
        const details = (res as any)?.details ? ` - ${(res as any).details}` : '';
        const code = (res as any)?.code ? ` [${(res as any).code}]` : '';
        throw new Error(`${res.error}${code}${details}`);
      }

      const data = res?.data;
      if (!data || !data.success || (data.imported === 0 && validatedSims.length > 0)) {
        const firstError = data?.errors?.[0]?.error || data?.errors?.[0]?.reason || data?.error || data?.message || 'Zero SIMs were inserted into database.';
        const firstCode = data?.errors?.[0]?.code || data?.code ? ` [${data?.errors?.[0]?.code || data?.code}]` : '';
        const firstDetails = data?.errors?.[0]?.details || data?.details ? ` - ${data?.errors?.[0]?.details || data?.details}` : '';
        throw new Error(`${firstError}${firstCode}${firstDetails}`);
      }

      onSuccess(data);
      onClose();
      resetAll();
    } catch (err: any) {
      const backendError = err.response?.data?.error || err.message || 'Failed to import SIMs.';
      const backendDetails = err.response?.data?.details ? ` (${err.response.data.details})` : '';
      setError(`Import failed: ${backendError}${backendDetails}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCardClick = (filter: FilterType) => {
    setActiveFilter((prev) => (prev === filter ? 'ALL' : filter));
  };

  const filteredRows = preview.filter((row) => {
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'VALID') return row.validationStatus === 'VALID';
    if (activeFilter === 'DUPLICATE') return row.validationStatus === 'DUPLICATE';
    if (activeFilter === 'INVALID') return row.validationStatus === 'INVALID';
    if (activeFilter === 'UNRESOLVED') return Boolean(row.isUnresolved);
    return true;
  });

  return (
    <Modal isOpen={isOpen} onClose={() => { onClose(); resetAll(); }} title="Bulk Import SIMs" maxWidth="4xl">
      <div className="space-y-4">
        {step === 'SELECT' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center">
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
              <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="mt-4 block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
              {file && <p className="mt-2 text-sm text-slate-700 font-medium">{file.name}</p>}
            </div>
            <button 
              onClick={handleContinueToPreview} 
              disabled={!file || isParsing} 
              className="w-full py-2 bg-blue-600 text-white rounded font-bold disabled:bg-slate-400 flex items-center justify-center gap-2"
            >
              {isParsing ? <Loader2 className="animate-spin" /> : <>Continue to Preview <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {(step === 'PREVIEW' || step === 'VALIDATED') && counts && (
          <div className="space-y-4">
            {/* Clickable Status Filter Summary Cards */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <button
                type="button"
                onClick={() => handleCardClick('VALID')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                  activeFilter === 'VALID'
                    ? 'bg-emerald-100/90 dark:bg-emerald-950/80 border-emerald-500 ring-2 ring-emerald-500/50 shadow-sm'
                    : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Valid</span>
                  {activeFilter === 'VALID' && (
                    <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">Active</span>
                  )}
                </div>
                <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-0.5">{counts.valid}</div>
              </button>

              <button
                type="button"
                onClick={() => handleCardClick('DUPLICATE')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                  activeFilter === 'DUPLICATE'
                    ? 'bg-amber-100/90 dark:bg-amber-950/80 border-amber-500 ring-2 ring-amber-500/50 shadow-sm'
                    : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold">Duplicates</span>
                  {activeFilter === 'DUPLICATE' && (
                    <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-bold">Active</span>
                  )}
                </div>
                <div className="text-lg font-bold text-amber-800 dark:text-amber-200 mt-0.5">{counts.duplicates}</div>
              </button>

              <button
                type="button"
                onClick={() => handleCardClick('INVALID')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                  activeFilter === 'INVALID'
                    ? 'bg-rose-100/90 dark:bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/50 shadow-sm'
                    : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-rose-700 dark:text-rose-300 font-semibold">Invalid</span>
                  {activeFilter === 'INVALID' && (
                    <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded font-bold">Active</span>
                  )}
                </div>
                <div className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-0.5">{counts.invalid}</div>
              </button>

              <button
                type="button"
                onClick={() => handleCardClick('UNRESOLVED')}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                  activeFilter === 'UNRESOLVED'
                    ? 'bg-purple-100/90 dark:bg-purple-950/80 border-purple-500 ring-2 ring-purple-500/50 shadow-sm'
                    : 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/60 hover:bg-purple-100/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-purple-700 dark:text-purple-300 font-semibold">Unresolved</span>
                  {activeFilter === 'UNRESOLVED' && (
                    <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-bold">Active</span>
                  )}
                </div>
                <div className="text-lg font-bold text-purple-800 dark:text-purple-200 mt-0.5">{counts.unresolved}</div>
              </button>
            </div>

            {/* Active Filter Bar & Row Count Display */}
            <div className="flex items-center justify-between text-xs px-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    activeFilter === 'ALL'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  All ({preview.length})
                </button>
                {activeFilter !== 'ALL' && (
                  <span className="text-slate-500 dark:text-slate-400">
                    Filter: <strong className="text-slate-800 dark:text-slate-200 uppercase tracking-wide">{activeFilter}</strong>
                  </span>
                )}
              </div>
              <div className="text-slate-600 dark:text-slate-300 font-medium">
                Showing {filteredRows.length} of {preview.length} rows
              </div>
            </div>
            
            {/* Table with SIM Number | ICCID | Status | Reason */}
            <div className="max-h-64 overflow-y-auto border rounded-lg border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 z-10">
                  <tr>
                    <th className="p-2.5 text-left font-semibold">SIM Number</th>
                    <th className="p-2.5 text-left font-semibold">ICCID</th>
                    <th className="p-2.5 text-left font-semibold">Status</th>
                    <th className="p-2.5 text-left font-semibold">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 dark:text-slate-500">
                        No {activeFilter === 'ALL' ? '' : activeFilter.toLowerCase()} rows found.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((item, i) => (
                      <tr 
                        key={item._rowId ?? i} 
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                          item.validationStatus === 'INVALID' 
                            ? 'bg-rose-50/40 dark:bg-rose-950/20' 
                            : item.validationStatus === 'DUPLICATE' 
                            ? 'bg-amber-50/40 dark:bg-amber-950/20' 
                            : ''
                        }`}
                      >
                        <td className="p-2.5 font-mono text-slate-800 dark:text-slate-200">{item.mobile_number || '-'}</td>
                        <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{item.ICCID || item.iccid || '-'}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold inline-block ${
                            item.validationStatus === 'VALID'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                              : item.validationStatus === 'DUPLICATE'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                          }`}>
                            {item.validationStatus === 'VALID' ? 'Valid' : item.validationStatus === 'DUPLICATE' ? 'Duplicate' : 'Invalid'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          {item.validationStatus === 'INVALID' ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium">
                              {item.reason || 'Invalid SIM Number'}
                            </span>
                          ) : item.validationStatus === 'DUPLICATE' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {item.reason || 'Duplicate SIM Number'}
                            </span>
                          ) : activeFilter === 'UNRESOLVED' || item.isUnresolved ? (
                            <span className="text-purple-700 dark:text-purple-300">
                              {item.unresolvedReason || 'Assignment reference (will import as unassigned inventory)'}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {item.reason || 'Ready to import'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={resetAll} 
                className="w-1/3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded font-bold transition-colors"
              >
                Back
              </button>
              {step === 'PREVIEW' && (
                <button 
                  onClick={handleValidate} 
                  disabled={isSubmitting || counts.valid === 0} 
                  className="w-2/3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate & Prepare Import'}
                </button>
              )}
              {step === 'VALIDATED' && (
                <button 
                  onClick={handleConfirmImport} 
                  disabled={isSubmitting || counts.valid === 0} 
                  className="w-2/3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold disabled:bg-slate-400 transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'CONFIRM & IMPORT VALID SIMS'}
                </button>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 break-words">{error}</div>
          </div>
        )}
      </div>
    </Modal>
  );
};

