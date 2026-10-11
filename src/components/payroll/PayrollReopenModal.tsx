import React, { useState } from 'react';
import { LockOpen, AlertTriangle, ShieldCheck, XCircle } from 'lucide-react';
import { Modal } from '../common/Modal';

interface PayrollReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  period: any;
  onReopenSuccess: (message: string) => void;
}

export const PayrollReopenModal: React.FC<PayrollReopenModalProps> = ({
  isOpen,
  onClose,
  period,
  onReopenSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setErrorMsg('A detailed audit reason is required (minimum 5 characters).');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/payroll/periods/${period.id || period.period_key}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        onReopenSuccess(data.message || `Payroll period ${period.period_month} unlocked for adjustments.`);
        onClose();
      } else {
        setErrorMsg(data.message || 'Failed to reopen payroll period.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network error attempting to unlock payroll.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Unlock & Reopen Payroll Period (Audit Flow)"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-slate-900 dark:text-white">
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold block">Audit-Controlled Operation:</span>
            Reopening will transition <span className="font-bold">{period?.period_month}</span> back to{' '}
            <span className="font-bold uppercase text-amber-700 dark:text-amber-400">Needs Review / Draft</span> status, allowing corrections to hours, bonuses, traffic fine adjustments, or manual deductions.
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 rounded-2xl flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mandatory Business Justification & Reason *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="e.g., Client corrected Keeta order logs for rider EMP-10270; re-running calculations."
            className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            This entry will be permanently logged in the tenant audit trail with your timestamp and actor ID.
          </span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
          >
            <LockOpen className="w-4 h-4" />
            {loading ? 'Unlocking...' : 'Confirm Reopen Cycle'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
