import React, { useState } from 'react';
import { CheckCircle2, X, RefreshCw, Calendar, User, ShieldCheck, FileText, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';

interface SimRecord {
  id: string;
  mobile_number: string;
  sim_serial_number?: string;
  iccid?: string;
  provider?: string;
  last_return_reason?: string | null;
  last_employee_name?: string | null;
  last_employee_code?: string | null;
}

interface RecoverSimModalProps {
  isOpen: boolean;
  sim: SimRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecoverSimModal: React.FC<RecoverSimModalProps> = ({
  isOpen,
  sim,
  onClose,
  onSuccess,
}) => {
  const [recoveryDate, setRecoveryDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<string>('');
  const [recoveredBy, setRecoveredBy] = useState<string>('Operations Admin');
  const [authorizedBy, setAuthorizedBy] = useState<string>('Platform Supervisor');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !sim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setErrorMessage('Recovery verification reason is mandatory.');
      return;
    }
    if (!authorizedBy.trim()) {
      setErrorMessage('Authorized supervisor name is mandatory for restoring a lost asset.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.post(`/api/erp/sims/${sim.id}/recover`, {
        recovery_date: recoveryDate,
        recovery_reason: reason.trim(),
        recovered_by: recoveredBy.trim(),
        authorized_by: authorizedBy.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.data?.success || res.status === 200) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(res.data?.error || 'Failed to recover SIM.');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'An error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-emerald-50/80 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize Lost SIM Recovery
              </h3>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Verified physical retrieval & return to available inventory
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
            {sim.last_return_reason && (
              <div className="text-xs pt-1 border-t border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400">
                <span className="text-slate-500">Loss Record: </span>
                {sim.last_return_reason}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Recovery Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Physical Recovery Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={recoveryDate}
                onChange={(e) => setRecoveryDate(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Recovered By */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Physical Handler <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={recoveredBy}
                onChange={(e) => setRecoveredBy(e.target.value)}
                placeholder="Staff verifying card"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Supervisor Authorization */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Supervisor Authorization <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={authorizedBy}
              onChange={(e) => setAuthorizedBy(e.target.value)}
              placeholder="e.g. Operations Director / Platform Admin"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Recovery Verification Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Recovery Verification & Testing Details <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe physical verification (e.g. Physical SIM card retrieved from lost & found / depot, inspected for damage, line verified active)..."
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
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
              placeholder="Additional internal audit context"
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
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
              disabled={isSubmitting || !reason.trim() || !authorizedBy.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Restoring...' : 'Authorize & Restore to Available'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
