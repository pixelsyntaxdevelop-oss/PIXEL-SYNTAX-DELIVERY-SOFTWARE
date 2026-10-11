import React, { useState, useEffect } from 'react';
import { X, RotateCcw, AlertCircle, CheckCircle2, User, Calendar, Gauge } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { authService } from '../../services/authService';

interface VehicleReturnModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleReturnModal: React.FC<VehicleReturnModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnOdometer, setReturnOdometer] = useState<number>(0);
  const [returnReason, setReturnReason] = useState('RETURN');
  const [conditionOnReturn, setConditionOnReturn] = useState('GOOD');
  const [returnNotes, setReturnNotes] = useState('Checked into depot garage. Keys & helmet returned.');
  const [returnedBy, setReturnedBy] = useState('Operations Admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const RETURN_REASONS = [
    { value: 'RETURN', label: 'RETURN (Standard Depot Return)' },
    { value: 'REPLACEMENT', label: 'REPLACEMENT (Vehicle Exchange)' },
    { value: 'DAMAGED', label: 'DAMAGED (Accident / Major Breakdown)' },
    { value: 'EMPLOYEE EXIT', label: 'EMPLOYEE EXIT (Resignation / Termination)' },
    { value: 'OTHER', label: 'OTHER (Depot Relocation / Audit)' },
  ];

  useEffect(() => {
    if (isOpen && vehicle) {
      setReturnOdometer(vehicle.current_odometer || 0);
      const user = authService.getCurrentUser();
      setReturnedBy(user?.name || user?.username || 'Operations Admin');
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnReason) {
      setError('Please select a Return Remark / Reason.');
      return;
    }
    if (returnOdometer < vehicle.current_odometer) {
      setError(`Return odometer cannot be less than current odometer (${vehicle.current_odometer} km).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.returnVehicle(vehicle.id, {
        returnDate,
        returnOdometer,
        conditionOnReturn,
        returnNotes,
        returnReason,
        returnedBy,
        returnedTo: returnedBy,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to return vehicle.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during return.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Return Vehicle from Rider</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                To Depot Stock
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Returning custody from: <span className="font-semibold text-slate-800">{vehicle.current_rider_name} ({vehicle.current_rider_code})</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 bg-blue-50/70 border-b border-blue-100 text-xs text-blue-900 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            This returns the vehicle to Allied depot inventory (Status: <strong>Available</strong>). Vendor/ownership is preserved.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Return Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Return Date *</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>

            {/* Return Odometer */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><Gauge className="w-3.5 h-3.5 text-slate-500" /> Final Odometer (KM) *</span>
              </label>
              <input
                type="number"
                value={returnOdometer}
                onChange={(e) => setReturnOdometer(Number(e.target.value))}
                min={vehicle.current_odometer}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Return Remark / Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Return Remark / Reason <span className="text-rose-500">*</span>
              </label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Returned By */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-500" /> Returned By *</span>
              </label>
              <input
                type="text"
                value={returnedBy}
                onChange={(e) => setReturnedBy(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
              />
            </div>
          </div>

          {/* Condition on Return */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Condition on Return
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED'].map((cond) => (
                <button
                  type="button"
                  key={cond}
                  onClick={() => setConditionOnReturn(cond)}
                  className={`py-2 text-xs font-semibold rounded-xl border transition-colors ${
                    conditionOnReturn === cond
                      ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>

          {/* Inspection / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Return Inspection Notes
            </label>
            <textarea
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              rows={3}
              className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-white text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Minor scratch on right mirror, fuel half tank, keys received..."
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Processing Return...</span>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>Confirm Return</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
