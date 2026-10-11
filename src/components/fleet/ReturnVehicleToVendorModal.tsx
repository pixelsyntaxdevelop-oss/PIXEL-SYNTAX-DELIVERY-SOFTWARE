import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  AlertTriangle,
  Calendar,
  Clock,
  Gauge,
  FileText,
  User,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { authService } from '../../services/authService';

interface ReturnVehicleToVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: DbVehicleMasterEnhanced | null;
  onSuccess: () => void;
}

export const ReturnVehicleToVendorModal: React.FC<ReturnVehicleToVendorModalProps> = ({
  isOpen,
  onClose,
  vehicle,
  onSuccess,
}) => {
  const [vendorReturnDate, setVendorReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorReturnTime, setVendorReturnTime] = useState(new Date().toTimeString().slice(0, 5));
  const [finalOdometer, setFinalOdometer] = useState<number>(0);
  const [vendorReturnReason, setVendorReturnReason] = useState('Lease Expiry / Contract Completed');
  const [customReason, setCustomReason] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [returnedBy, setReturnedBy] = useState('Operations Admin');
  const [notes, setNotes] = useState('');
  const [autoCloseRider, setAutoCloseRider] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setError(null);
      setConfirmed(false);
      setVendorReturnDate(new Date().toISOString().split('T')[0]);
      setVendorReturnTime(new Date().toTimeString().slice(0, 5));
      setFinalOdometer(vehicle.current_odometer || vehicle.odometerKm || 0);
      setVendorReturnReason('Lease Expiry / Contract Completed');
      setCustomReason('');
      setVendorReference('');
      setNotes('');
      setAutoCloseRider(true);

      const currentUser = authService.getCurrentUser();
      const name = currentUser?.name || currentUser?.username || 'Operations Admin';
      setReturnedBy(name);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const vendorName = vehicle.owner_or_vendor || vehicle.vendor || vehicle.leasing_company || 'Vendor / Leasing Partner';
  const hasActiveRider = Boolean(
    vehicle.current_rider_name ||
    vehicle.current_employee_id ||
    vehicle.status === 'ASSIGNED' ||
    vehicle.current_status === 'Assigned'
  );
  const riderName = vehicle.current_rider_name || 'Assigned Rider';
  const riderCode = vehicle.current_rider_code || 'ID-N/A';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError('Please acknowledge and confirm the vendor return.');
      return;
    }

    const effectiveReason = vendorReturnReason === 'Other' && customReason.trim()
      ? customReason.trim()
      : vendorReturnReason;

    if (!effectiveReason) {
      setError('Vendor return reason is mandatory.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.returnVehicleToVendor(vehicle.id, {
        vendorReturnDate,
        vendorReturnTime,
        vendorReturnReason: effectiveReason,
        finalOdometer: Number(finalOdometer),
        vendorReference: vendorReference.trim() || undefined,
        returnedBy: returnedBy.trim() || 'Operations Admin',
        notes: notes.trim() || undefined,
        autoCloseRiderAssignment: autoCloseRider,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to return vehicle to vendor.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during vendor return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Return Vehicle to Vendor / Leasing Partner
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                End Allied's possession and remove asset from available operational inventory
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

        {/* Informational Guidance Banner */}
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-100 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Business Rule Separation:</span>
            This action is for handing the bike back to <strong className="underline">{vendorName}</strong> (e.g. lease expiry, total loss, contract termination). It transitions status to <strong>RETURNED TO VENDOR</strong> and removes it from available depot stock.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Vehicle & Vendor Summary Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Vehicle Plate</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number}
              </span>
              <span className="text-[11px] text-slate-500 block">{vehicle.make} {vehicle.model} ({vehicle.year})</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Leasing Partner / Vendor</span>
              <span className="font-bold text-slate-900 dark:text-white text-sm block truncate" title={vendorName}>
                {vendorName}
              </span>
              <span className="text-[10px] font-mono text-slate-500">VIN: {vehicle.chassis_number || 'N/A'}</span>
            </div>
          </div>

          {/* Active Rider Warning & Auto-close option */}
          {hasActiveRider && (
            <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Vehicle Currently Assigned to Rider</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                This vehicle is currently held by <strong>{riderName}</strong> ({riderCode}). Returning to vendor requires closing rider custody first.
              </p>
              <label className="flex items-center gap-2 pt-1 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCloseRider}
                  onChange={(e) => setAutoCloseRider(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <span>Automatically close rider assignment as depot return before vendor handover</span>
              </label>
            </div>
          )}

          {/* Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Return to Vendor Date *</span>
              </label>
              <input
                type="date"
                required
                value={vendorReturnDate}
                onChange={(e) => setVendorReturnDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-500" /> Return Time</span>
              </label>
              <input
                type="time"
                value={vendorReturnTime}
                onChange={(e) => setVendorReturnTime(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Odometer & Vendor Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-slate-500" /> Final Odometer (KM) *</span>
              </label>
              <input
                type="number"
                required
                min={0}
                value={finalOdometer}
                onChange={(e) => setFinalOdometer(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-500" /> Handover Ref / Gate Pass #</span>
              </label>
              <input
                type="text"
                placeholder="e.g. GP-2026-8942 / Slip #44"
                value={vendorReference}
                onChange={(e) => setVendorReference(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Reason / Remark */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              Vendor Return Reason <span className="text-rose-500">*</span>
            </label>
            <select
              value={vendorReturnReason}
              onChange={(e) => setVendorReturnReason(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
            >
              <option value="Lease Expiry / Contract Completed">Lease Expiry / Contract Completed</option>
              <option value="Contract Early Termination">Contract Early Termination</option>
              <option value="Vendor Recall / Fleet Downsizing">Vendor Recall / Fleet Downsizing</option>
              <option value="Damaged / Total Loss / Scrapped">Damaged / Total Loss / Scrapped</option>
              <option value="Vehicle Exchange / Upgrade with Vendor">Vehicle Exchange / Upgrade with Vendor</option>
              <option value="Billing Dispute / Commercial Discontinuation">Billing Dispute / Commercial Discontinuation</option>
              <option value="Other">Other (Custom Reason)</option>
            </select>
          </div>

          {vendorReturnReason === 'Other' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                Specify Custom Reason *
              </label>
              <input
                type="text"
                required
                placeholder="Enter specific vendor return reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          )}

          {/* Returned By (Logged in user) */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Returned By (Logged-in ERP User) *</span>
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
              Vendor Inspection Notes & Observations
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handover checklist signed, duplicate keys handed over, scratches acknowledged by vendor agent..."
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-normal"
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <input
              type="checkbox"
              id="confirm-vendor-return"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="confirm-vendor-return" className="text-xs text-amber-950 dark:text-amber-200 font-bold cursor-pointer">
              I confirm this vehicle is being returned to {vendorName}. This removes it from Allied's available fleet inventory.
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
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                'Processing Handover...'
              ) : (
                <>
                  <span>Execute Return to Vendor</span>
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
