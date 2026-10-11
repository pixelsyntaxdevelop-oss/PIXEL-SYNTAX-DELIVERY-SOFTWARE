import React, { useState, useEffect } from 'react';
import { X, AlertCircle, CheckCircle2, ShieldCheck, ArrowRightLeft } from 'lucide-react';
import { DbVehicleMasterEnhanced, VehicleOperationalStatus } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface ChangeVehicleStatusModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PRIMARY_STATUSES: { value: VehicleOperationalStatus; label: string; desc: string; color: string }[] = [
  {
    value: 'Available',
    label: 'Available',
    desc: 'Ready for rider assignment in the depot/hub.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  },
  {
    value: 'Assigned',
    label: 'Assigned',
    desc: 'Actively deployed with a delivery captain/rider.',
    color: 'border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  },
  {
    value: 'In Maintenance',
    label: 'In Garage / Maintenance',
    desc: 'Under routine servicing, repair, or inspection in garage.',
    color: 'border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  },
  {
    value: 'Returned to Vendor',
    label: 'Returned to Vendor',
    desc: 'Lease/rental unit off-hired and returned to vendor.',
    color: 'border-purple-200 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:border-purple-800 dark:text-purple-300',
  },
  {
    value: 'Out of Service',
    label: 'Out of Service',
    desc: 'Temporarily or permanently decommissioned from daily roster.',
    color: 'border-slate-300 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300',
  },
  {
    value: 'Accident',
    label: 'Accident',
    desc: 'Involved in traffic incident / pending insurance police report.',
    color: 'border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
  },
  {
    value: 'Inactive',
    label: 'Inactive',
    desc: 'Dormant vehicle with no operational schedule.',
    color: 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300',
  },
];

export const ChangeVehicleStatusModal: React.FC<ChangeVehicleStatusModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<VehicleOperationalStatus>('Available');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setSelectedStatus(vehicle.current_status || 'Available');
      setReason('');
      setNotes('');
      setEffectiveDate(new Date().toISOString().split('T')[0]);
      setError(null);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) {
      setError('Please select a target status.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.changeVehicleStatus(
        vehicle.id,
        selectedStatus,
        reason || `Status updated from ${vehicle.current_status} to ${selectedStatus}`,
        effectiveDate,
        notes
      );

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to update vehicle status.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-400/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Change Operational Status</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Plate: <span className="font-semibold text-slate-700 dark:text-slate-200">{vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number}</span> ({vehicle.make} {vehicle.model})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs New Status Preview */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 block">Current Status</span>
              <span className="font-bold text-slate-700 dark:text-slate-200">{vehicle.current_status}</span>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-slate-400" />
            <div className="text-right">
              <span className="text-slate-400 dark:text-slate-500 block">Target Status</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{selectedStatus}</span>
            </div>
          </div>

          {/* Primary Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select New Operational Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
              {PRIMARY_STATUSES.map((item) => {
                const isSelected = selectedStatus === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setSelectedStatus(item.value)}
                    className={`text-left p-2.5 rounded-xl border transition-all flex items-start justify-between ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 dark:bg-blue-900/20'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${item.color}`}>
                          {item.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                        {item.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Warning if vehicle has active rider and changing to non-available/non-assigned */}
          {vehicle.current_rider_name && selectedStatus !== 'Assigned' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Active Assignment Detected</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  This vehicle is currently assigned to <strong>{vehicle.current_rider_name}</strong>. If returned or in maintenance, consider processing the Return / Unassign flow to release the rider.
                </p>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reason / Justification
            </label>
            <input
              type="text"
              placeholder="e.g. Scheduled 10,000 km routine service or off-hired from vendor"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Effective Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Effective Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Add workshop job card number, garage contact, or vendor return ticket..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            />
          </div>

          {/* Security & Authenticated Audit Notice */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Authenticated actor and immutable audit trail will be logged with this change.</span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors"
            >
              {loading ? 'Updating Status...' : 'Apply Status Change'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
