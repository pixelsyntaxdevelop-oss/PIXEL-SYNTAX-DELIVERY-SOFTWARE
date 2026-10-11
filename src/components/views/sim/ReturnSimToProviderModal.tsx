import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  AlertTriangle,
  Calendar,
  FileText,
  User,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { simService } from '../../../services/simService';
import { authService } from '../../../services/authService';

interface ReturnSimToProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sim: any | null;
  onSuccess: () => void;
}

export const ReturnSimToProviderModal: React.FC<ReturnSimToProviderModalProps> = ({
  isOpen,
  onClose,
  sim,
  onSuccess,
}) => {
  const [providerReturnDate, setProviderReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [providerReturnReason, setProviderReturnReason] = useState('Line Cancellation / Contract Terminated');
  const [customReason, setCustomReason] = useState('');
  const [cancellationReference, setCancellationReference] = useState('');
  const [returnedBy, setReturnedBy] = useState('Telecom Admin');
  const [notes, setNotes] = useState('');
  const [autoCloseRider, setAutoCloseRider] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sim) {
      setError(null);
      setConfirmed(false);
      setProviderReturnDate(new Date().toISOString().split('T')[0]);
      setProviderReturnReason('Line Cancellation / Contract Terminated');
      setCustomReason('');
      setCancellationReference('');
      setNotes('');
      setAutoCloseRider(true);

      const currentUser = authService.getCurrentUser();
      const name = currentUser?.name || currentUser?.username || 'Telecom Admin';
      setReturnedBy(name);
    }
  }, [isOpen, sim]);

  if (!isOpen || !sim) return null;

  const providerName = sim.provider || sim.vendor || 'Telecom Provider';
  const hasActiveCustodian = Boolean(
    sim.assignedTo ||
    sim.current_employee_name ||
    sim.employee_name ||
    sim.status === 'Assigned' ||
    sim.status === 'ASSIGNED'
  );
  const custodianName = sim.assignedTo || sim.current_employee_name || sim.employee_name || 'Assigned Rider';
  const custodianCode = sim.assignedToCode || sim.current_employee_code || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError('Please acknowledge and confirm returning/cancelling the line with the telecom provider.');
      return;
    }

    const effectiveReason = providerReturnReason === 'Other' && customReason.trim()
      ? customReason.trim()
      : providerReturnReason === 'Other' ? '' : providerReturnReason;

    if (!effectiveReason) {
      setError('Provider return reason is mandatory.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await simService.returnSimToProvider(sim.id, {
        providerReturnDate,
        providerReturnReason: effectiveReason,
        cancellationReference: cancellationReference.trim() || undefined,
        returnedBy: returnedBy.trim() || 'Telecom Admin',
        notes: notes.trim() || undefined,
        autoCloseRiderAssignment: autoCloseRider,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to return SIM to provider.');
      }
    } catch (err: any) {
      setError(err.message || 'Error processing provider return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Return / Cancel SIM with Provider ({providerName})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cancel telecom subscription or return line to telecom operator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950/30 border-b border-rose-100 dark:border-rose-900 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Business Rule Separation:</span>
            This action is for returning or cancelling the line with <strong className="underline">{providerName}</strong> (e.g. terminating monthly bill, SIM discontinued). It sets status to <strong>Returned to Provider</strong> and permanently frees or archives the line. Historical rider logs remain intact.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* SIM Card Details Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Mobile Number</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {sim.mobile_number || sim.mobileNumber || 'N/A'}
              </span>
              <span className="text-[11px] text-slate-500 block">ICCID: {sim.sim_serial_number || sim.iccid || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Provider / Plan</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm block">
                {providerName}
              </span>
              <span className="text-[11px] text-slate-500 block">
                {sim.plan || 'Standard Plan'} • AED {sim.monthly_package_amount || sim.monthlyPackageAmount || 0}/mo
              </span>
            </div>
          </div>

          {/* Active Custody Warning */}
          {hasActiveCustodian && (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>SIM Currently Assigned to Rider</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                This SIM is currently held by <strong>{custodianName}</strong> {custodianCode ? `(${custodianCode})` : ''}.
              </p>
              <label className="flex items-center gap-2 pt-1 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCloseRider}
                  onChange={(e) => setAutoCloseRider(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <span>Auto-close active rider custody before provider cancellation</span>
              </label>
            </div>
          )}

          {/* Date & Ref */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Return / Cancellation Date *</span>
              </label>
              <input
                type="date"
                required
                value={providerReturnDate}
                onChange={(e) => setProviderReturnDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-500" /> Telecom SR / Ticket #</span>
              </label>
              <input
                type="text"
                placeholder="e.g. DU-SR-892144 / Etisalat #1002"
                value={cancellationReference}
                onChange={(e) => setCancellationReference(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              Provider Return / Cancellation Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={providerReturnReason}
              onChange={(e) => setProviderReturnReason(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
            >
              <option value="Line Cancellation / Contract Terminated">Line Cancellation / Contract Terminated</option>
              <option value="Project Downsizing / Fleet Reduction">Project Downsizing / Fleet Reduction</option>
              <option value="Defective / Damaged Chip">Defective / Damaged Chip</option>
              <option value="Lost / Stolen SIM Handover">Lost / Stolen SIM Handover</option>
              <option value="Number Ported Out to Other Network">Number Ported Out to Other Network</option>
              <option value="Other">Other (Custom Reason)</option>
            </select>
          </div>

          {providerReturnReason === 'Other' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                Specify Custom Reason *
              </label>
              <input
                type="text"
                required
                placeholder="Enter specific cancellation reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          )}

          {/* Returned By */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Logged-in ERP User Performing Action *</span>
            </label>
            <input
              type="text"
              required
              value={returnedBy}
              onChange={(e) => setReturnedBy(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              Telecom Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Account manager confirmed cancellation, final bill paid..."
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-normal"
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-xl">
            <input
              type="checkbox"
              id="confirm-sim-provider-return"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500 cursor-pointer"
            />
            <label htmlFor="confirm-sim-provider-return" className="text-xs text-rose-950 dark:text-rose-200 font-bold cursor-pointer">
              I confirm this SIM line is cancelled or returned to {providerName}. It will no longer be available for rider assignment.
            </label>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !confirmed}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                'Cancelling Line...'
              ) : (
                <>
                  <span>Execute Return to Provider</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
