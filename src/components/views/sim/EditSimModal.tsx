import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, PhoneCall, Save } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { apiClient } from '../../../services/apiClient';
import { SimRecord } from '../../../types/sim';

interface EditSimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sim: SimRecord | null;
}

export const EditSimModal: React.FC<EditSimModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  sim,
}) => {
  const [vendor, setVendor] = useState('ETISALAT');
  const [state, setState] = useState('Dubai');
  const [source, setSource] = useState('Company SIMs');
  const [iccid, setIccid] = useState('');
  const [plan, setPlan] = useState('');
  const [monthlyPackageAmount, setMonthlyPackageAmount] = useState(0);
  const [approvedAmount, setApprovedAmount] = useState(0);
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (sim) {
      setVendor(sim.vendor || sim.provider || 'ETISALAT');
      setState(sim.state || 'Dubai');
      setSource(sim.source || 'Company SIMs');
      setIccid(sim.iccid || sim.sim_serial_number || '');
      setPlan(sim.plan || '');
      setMonthlyPackageAmount(sim.monthly_package_amount || sim.monthly_cost || 0);
      setApprovedAmount(sim.approved_amount || sim.monthly_package_amount || 0);
      setNotes(sim.notes || '');
      setErrorMessage(null);
    }
  }, [sim, isOpen]);

  if (!sim) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await apiClient.put(`/api/erp/sims/${sim.id}`, {
        vendor,
        provider: vendor,
        state,
        source,
        iccid: iccid.trim() || undefined,
        plan: plan.trim(),
        monthly_package_amount: Number(monthlyPackageAmount) || 0,
        approved_amount: Number(approvedAmount) || 0,
        notes: notes.trim(),
      });

      // apiClient unwraps a response's "data" field, so the Worker result is
      // usually the saved SIM itself rather than { success, sim, data }.
      const savedSim = res.data?.sim || res.data?.data || res.data;
      const responseConfirmed = !res.error && savedSim?.id === sim.id && savedSim?.state === state;
      const responseLost = Boolean(res.error && res.status === 500 &&
        /failed to fetch|network|connection/i.test(res.error));
      let databaseConfirmed = false;

      // A network disconnect can happen after the Worker commits the change.
      // Verify the exact saved row before reporting either success or failure.
      if (!responseConfirmed && (responseLost || (!res.error && res.status >= 200 && res.status < 300))) {
        for (let attempt = 0; attempt < 3; attempt++) {
          if (attempt) await new Promise((resolve) => setTimeout(resolve, attempt * 450));
          const check = await apiClient.get<{ id: string; state: string; updated_at: string }>(
            `/api/erp/sims/${encodeURIComponent(sim.id)}/edit-confirmation`
          );
          const changedSinceOpen = state !== sim.state ||
            Date.parse(check.data?.updated_at || '') > Date.parse(sim.updated_at || '');
          if (!check.error && check.data?.id === sim.id && check.data.state === state && changedSinceOpen) {
            databaseConfirmed = true;
            break;
          }
        }
      }

      if (responseConfirmed || databaseConfirmed) {
        onSuccess();
        onClose();
      } else {
        setErrorMessage(responseLost
          ? 'Connection interrupted. SIM state could not be verified; refresh the registry before trying again.'
          : res.data?.error || res.error || 'SIM state was not confirmed as saved.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update SIM record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit SIM Card — ${sim.mobile_number}`}
      subtitle="Modify line configuration, data bundle terms, and operational state."
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Read-only Mobile Number */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-blue-600" />
            <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {sim.mobile_number}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">ID: {sim.id}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Vendor */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Telecom Provider / Vendor *
            </label>
            <select
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              <option value="ETISALAT">ETISALAT</option>
              <option value="DU">DU</option>
              <option value="VIRGIN">VIRGIN</option>
              <option value="STC">STC</option>
            </select>
          </div>

          {/* State */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Emirate / State *
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              <option value="Dubai">Dubai</option>
              <option value="Abu Dhabi">Abu Dhabi</option>
              <option value="Al Ain">Al Ain</option>
              <option value="Sharjah">Sharjah</option>
              <option value="Ajman">Ajman</option>
              <option value="RAK">Ras Al Khaimah</option>
              <option value="Fujairah">Fujairah</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Source */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Procurement Source *
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            >
              <option value="Company SIMs">Company SIMs</option>
              <option value="Direct DU Telecom">Direct DU Telecom</option>
              <option value="Etisalat Corporate">Etisalat Corporate</option>
              <option value="Virgin Mobile">Virgin Mobile</option>
              <option value="STC">STC</option>
            </select>
          </div>

          {/* ICCID */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              ICCID / Chip Serial Number
            </label>
            <input
              type="text"
              placeholder="e.g. 899710..."
              value={iccid}
              onChange={(e) => setIccid(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Plan */}
          <div className="sm:col-span-1">
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Data Plan *
            </label>
            <input
              type="text"
              required
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs"
            />
          </div>

          {/* Monthly Package Amount */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Monthly Cost (AED)
            </label>
            <input
              type="number"
              min="0"
              value={monthlyPackageAmount}
              onChange={(e) => setMonthlyPackageAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono"
            />
          </div>

          {/* Approved Amount */}
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Approved Amount (AED)
            </label>
            <input
              type="number"
              min="0"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Operational Remarks / Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
