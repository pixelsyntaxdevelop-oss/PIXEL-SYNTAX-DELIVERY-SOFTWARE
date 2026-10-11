import React, { useState } from 'react';
import { AlertTriangle, X, ShieldAlert, Calendar, User, FileText } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

interface SimRecord {
  id: string;
  mobile_number: string;
  sim_serial_number?: string;
  iccid?: string;
  provider?: string;
  current_employee_id?: string | null;
  current_employee_name?: string | null;
  current_employee_code?: string | null;
}

interface MarkSimLostModalProps {
  isOpen: boolean;
  sim: SimRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const MarkSimLostModal: React.FC<MarkSimLostModalProps> = ({
  isOpen,
  sim,
  onClose,
  onSuccess,
}) => {
  const [lossDate, setLossDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !sim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Loss reason is mandatory when marking a SIM card as lost.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(`/api/erp/sims/${sim.id}/lost`, {
        loss_date: lossDate,
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.data?.success === true) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.data?.error || res.error || 'Failed to record SIM loss.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-rose-50/80 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Mark SIM Card as Lost
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400">
                Audited custody closure and inventory exclusion
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-white/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SIM Card Snapshot */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Target Line:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {sim.mobile_number}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Serial / ICCID:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {sim.iccid || sim.sim_serial_number || '—'}
              </span>
            </div>
            {sim.current_employee_name && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200 dark:border-slate-700">
                <span className="text-slate-500">Current Assigned Holder:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {sim.current_employee_name} ({sim.current_employee_code || '—'})
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Loss Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Loss Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={lossDate}
                onChange={(e) => setLossDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Reporting Staff */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Reported By <span className="text-rose-500">*</span>
              </label>
              <div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Your signed-in staff name is recorded automatically.
              </div>
            </div>
          </div>

          {/* Loss Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Loss Reason & Circumstances <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide specific details (e.g. Rider lost phone while on shift, stolen in transit, bag misplaced)..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal Operational Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Police complaint filed, replacement SIM requested"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          {/* Security & Audit Notice */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
            <strong>Authoritative Action:</strong> Marking this SIM as lost will close the active custody assignment as <code>LOST</code> (not Returned), release the employee pointer without changing duty status, and exclude this SIM from available stock. Only an authorized recovery workflow can restore it.
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? 'Recording Loss...' : 'Confirm Mark as Lost'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
