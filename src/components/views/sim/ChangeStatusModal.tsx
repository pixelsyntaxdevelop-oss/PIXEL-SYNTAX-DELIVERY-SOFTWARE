import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, PhoneCall, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { apiClient } from '../../../services/apiClient';
import { SimRecord } from '../../../types/sim';

interface ChangeStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sim: SimRecord | null;
}

export const ChangeStatusModal: React.FC<ChangeStatusModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sim,
}) => {
  const [newStatus, setNewStatus] = useState<string>('Active');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sim) {
      setNewStatus(sim.service_status || 'Active');
      setReason('');
      setErrorMessage(null);
    }
  }, [sim, isOpen]);

  if (!sim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!reason.trim()) {
      setErrorMessage('A reason for updating the telecom service status is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post(`/api/erp/sims/${sim.id}/status`, {
        service_status: newStatus,
        reason: reason.trim(),
      });

      if (res.error || res.data?.success !== true) {
        setErrorMessage(res.data?.error || res.error || 'SIM service status was not changed.');
      } else {
        onSuccess();
        onClose();
        setReason('');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update SIM service status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Change SIM Service Status — ${sim.mobile_number}`}
      subtitle="Update telecom carrier line state. Custody assignment and employee details remain untouched."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* SIM Details Card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {sim.mobile_number}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-semibold">{sim.vendor || sim.provider}</span>
          </div>
          <div className="mt-2 text-[11px] grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
            <div>
              <span>Assignment Custody: </span>
              <b className="text-slate-800 dark:text-slate-200">{sim.assignment_status || (sim.current_employee_id ? 'Assigned' : 'Unassigned')}</b>
              {sim.current_employee_name && (
                <span className="block text-[10px] text-slate-500">Holder: {sim.current_employee_name}</span>
              )}
            </div>
            <div>
              <span>Current Service State: </span>
              <b className="text-slate-800 dark:text-slate-200">{sim.service_status || 'Active'}</b>
            </div>
          </div>
        </div>

        {/* Informational callout */}
        <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-blue-800 dark:text-blue-300 text-[11px] leading-relaxed">
          <strong>Non-destructive telecom update:</strong> Changing service status modifies the cellular carrier line state only. It does <em>not</em> alter employee assignment, rider project, vehicle, or payroll mapping.
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Target Service Status Dropdown */}
        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Target Service Status *
          </label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
          >
            {newStatus === 'Lost' && <option value="Lost" disabled>Lost (use Recover or choose a carrier line state)</option>}
            <option value="Active">Active (In Service / Operational)</option>
            <option value="Inactive">Inactive (Dormant / Off-Duty)</option>
            <option value="Suspended">Suspended (Temporarily Frozen)</option>
            <option value="Cancelled">Cancelled (Terminated Line)</option>
          </select>
        </div>

        {/* Reason */}
        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Status Change Reason & Justification *
          </label>
          <textarea
            required
            rows={3}
            placeholder="e.g. Line suspended due to rider seasonal vacation; or line cancelled with DU Telecom."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Updating Service Status...
              </>
            ) : (
              'Apply Service Status'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
