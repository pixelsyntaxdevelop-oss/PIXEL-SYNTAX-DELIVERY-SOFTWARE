import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { apiClient } from '../../../services/apiClient';
import { CreateSimRow, BatchCreateResultItem } from '../../../types/sim';

interface CreateSimsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DEFAULT_ROW: CreateSimRow = {
  mobile_number: '',
  iccid: '',
  provider: 'ETISALAT',
  vendor: 'ETISALAT',
  service_status: 'Active',
  state: 'Dubai',
  source: 'Company SIMs',
  monthly_package_amount: 100,
  notes: '',
};

export const CreateSimsModal: React.FC<CreateSimsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [rows, setRows] = useState<CreateSimRow[]>([{ ...DEFAULT_ROW }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<BatchCreateResultItem[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { ...DEFAULT_ROW }]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index: number, field: keyof CreateSimRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setResults(null);

    // Frontend pre-validation
    const emptyPhones = rows.some((r) => !r.mobile_number.trim());
    if (emptyPhones) {
      setGlobalError('Every row must have a valid Mobile Phone Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        sims: rows.map((r) => ({
          mobile_number: r.mobile_number.trim(),
          iccid: r.iccid?.trim() || undefined,
          vendor: r.vendor || r.provider || 'DU',
          provider: r.provider || r.vendor || 'DU',
          service_status: r.service_status || 'Active',
          state: r.state,
          source: r.source,
          monthly_package_amount: r.monthly_package_amount !== undefined ? Number(r.monthly_package_amount) : 100,
          notes: r.notes?.trim() || undefined,
        })),
      };

      const res = await apiClient.post('/api/erp/sims/batch', payload);

      if (res.error) {
        setGlobalError(res.error);
      } else {
        const data = res.data;
        setResults(data.results || []);

        // If all succeeded, trigger refresh and close after brief delay or user inspection
        if (data.createdCount === rows.length) {
          onSuccess();
          setTimeout(() => {
            handleReset();
            onClose();
          }, 1200);
        } else {
          onSuccess(); // reload whatever succeeded
        }
      }
    } catch (err: any) {
      setGlobalError(err.message || 'Failed to submit batch SIM creation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setRows([{ ...DEFAULT_ROW }]);
    setResults(null);
    setGlobalError(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        handleReset();
        onClose();
      }}
      title="Create SIM(s) — Batch Multi-Row Entry"
      subtitle="Register single or multiple telecommunication lines into the company inventory with live duplicate protection."
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col h-full space-y-4">
        {/* Alerts / Error feedback */}
        {globalError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{globalError}</span>
          </div>
        )}

        {/* Results Banner */}
        {results && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2 text-xs">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>Batch Submission Results:</span>
              <span className="text-[11px] font-normal text-slate-500">
                {results.filter((r) => r.success).length} of {results.length} succeeded
              </span>
            </div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {results.map((res) => (
                <div
                  key={res.row}
                  className={`p-2 rounded flex items-center justify-between text-[11px] font-mono ${
                    res.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {res.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>
                      Row #{res.row}: {res.mobile_number}
                    </span>
                  </div>
                  <span className="text-[10px] font-sans font-medium">
                    {res.success ? 'Created in Pool' : res.error}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Multi-Row Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
          <div className="overflow-x-auto max-h-[50vh]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 px-2 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[140px]">Mobile Phone *</th>
                  <th className="py-2.5 px-3 min-w-[110px]">Provider *</th>
                  <th className="py-2.5 px-3 min-w-[110px]">Service Status</th>
                  <th className="py-2.5 px-3 min-w-[150px]">ICCID / Chip Serial</th>
                  <th className="py-2.5 px-3 min-w-[110px]">State</th>
                  <th className="py-2.5 px-3 min-w-[130px]">Source</th>
                  <th className="py-2.5 px-3 min-w-[110px]">Package (AED)</th>
                  <th className="py-2.5 px-3 min-w-[120px]">Notes</th>
                  <th className="py-2.5 px-2 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-2 text-center font-mono text-slate-400">{idx + 1}</td>

                    {/* Mobile Number */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        required
                        placeholder="050 123 4567"
                        value={row.mobile_number}
                        onChange={(e) => handleRowChange(idx, 'mobile_number', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs focus:ring-1 focus:ring-blue-500"
                      />
                    </td>

                    {/* Provider */}
                    <td className="py-2 px-3">
                      <select
                        value={row.provider || row.vendor || 'ETISALAT'}
                        onChange={(e) => {
                          handleRowChange(idx, 'provider', e.target.value);
                          handleRowChange(idx, 'vendor', e.target.value);
                        }}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <option value="ETISALAT">ETISALAT</option>
                        <option value="DU">DU</option>
                        <option value="VIRGIN">VIRGIN</option>
                        <option value="STC">STC</option>
                      </select>
                    </td>

                    {/* Service Status */}
                    <td className="py-2 px-3">
                      <select
                        value={row.service_status || 'Active'}
                        onChange={(e) => handleRowChange(idx, 'service_status', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>

                    {/* ICCID */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="899710..."
                        value={row.iccid}
                        onChange={(e) => handleRowChange(idx, 'iccid', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 font-mono text-xs"
                      />
                    </td>

                    {/* State */}
                    <td className="py-2 px-3">
                      <select
                        value={row.state}
                        onChange={(e) => handleRowChange(idx, 'state', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <option value="Dubai">Dubai</option>
                        <option value="Abu Dhabi">Abu Dhabi</option>
                        <option value="Al Ain">Al Ain</option>
                        <option value="Sharjah">Sharjah</option>
                        <option value="Ajman">Ajman</option>
                        <option value="RAK">Ras Al Khaimah</option>
                        <option value="Fujairah">Fujairah</option>
                      </select>
                    </td>

                    {/* Source */}
                    <td className="py-2 px-3">
                      <select
                        value={row.source}
                        onChange={(e) => handleRowChange(idx, 'source', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      >
                        <option value="Company SIMs">Company SIMs</option>
                        <option value="Direct DU Telecom">Direct DU Telecom</option>
                        <option value="Etisalat Corporate">Etisalat Corporate</option>
                        <option value="Virgin Mobile">Virgin Mobile</option>
                        <option value="STC">STC</option>
                      </select>
                    </td>

                    {/* Package (AED) */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        value={row.monthly_package_amount ?? 100}
                        onChange={(e) =>
                          handleRowChange(idx, 'monthly_package_amount', Number(e.target.value))
                        }
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono"
                      />
                    </td>

                    {/* Notes */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="Optional remarks"
                        value={row.notes}
                        onChange={(e) => handleRowChange(idx, 'notes', e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 text-xs"
                      />
                    </td>

                    {/* Remove Action */}
                    <td className="py-2 px-2 text-center">
                      <button
                        type="button"
                        disabled={rows.length === 1}
                        onClick={() => handleRemoveRow(idx)}
                        className={`p-1.5 rounded transition-colors ${
                          rows.length === 1
                            ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                            : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                        }`}
                        title="Remove row"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer Controls */}
          <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleAddRow}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-blue-600 dark:text-blue-400 font-bold border border-slate-200 dark:border-slate-700 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Another SIM Row
            </button>
            <div className="text-xs text-slate-500">
              Total lines queued: <span className="font-bold text-slate-900 dark:text-white">{rows.length}</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs rounded-lg transition-colors"
          >
            Reset Form
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Registering SIMs...
                </>
              ) : (
                <>
                  <Smartphone className="w-4 h-4" />
                  Confirm & Register {rows.length} SIM(s)
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
