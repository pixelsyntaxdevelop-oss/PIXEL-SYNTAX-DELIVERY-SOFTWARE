import React, { useState, useEffect } from 'react';
import { X, Receipt, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleFineModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleFineModal: React.FC<VehicleFineModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [fineNumber, setFineNumber] = useState('');
  const [fineDate, setFineDate] = useState(new Date().toISOString().split('T')[0]);
  const [authority, setAuthority] = useState('Dubai Police');
  const [violationType, setViolationType] = useState('Exceeding Speed Limit by 20km/h (Radar)');
  const [location, setLocation] = useState('Sheikh Zayed Road, Dubai');
  const [amount, setAmount] = useState<number>(300);
  const [deductFromPayroll, setDeductFromPayroll] = useState(true);
  const [payrollPeriodKey, setPayrollPeriodKey] = useState('2026-08');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setFineNumber(`DXB-TKT-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.logFine(vehicle.id, {
        fine_number: fineNumber,
        fine_date: fineDate,
        authority,
        violation_type: violationType,
        location,
        amount,
        deducted_from_payroll: deductFromPayroll,
        payroll_period_key: payrollPeriodKey,
        status: deductFromPayroll ? 'DEDUCTED_FROM_PAYROLL' : 'ASSIGNED_TO_DRIVER',
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to log fine.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Log Traffic Radar Fine</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number}
              {vehicle.current_rider_name ? ` • Assigned to: ${vehicle.current_rider_name}` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fine Ticket #</label>
              <input
                type="text"
                value={fineNumber}
                onChange={(e) => setFineNumber(e.target.value)}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Authority</label>
              <select
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              >
                <option value="Dubai Police">Dubai Police</option>
                <option value="Abu Dhabi Police">Abu Dhabi Police</option>
                <option value="RTA Dubai">RTA Dubai (Salik/Parking)</option>
                <option value="Sharjah Police">Sharjah Police</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Violation Date</label>
              <input
                type="date"
                value={fineDate}
                onChange={(e) => setFineDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fine Amount (AED)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold text-rose-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Violation Description</label>
            <input
              type="text"
              value={violationType}
              onChange={(e) => setViolationType(e.target.value)}
              required
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>

          {/* Payroll Deduction Option */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={deductFromPayroll}
                onChange={(e) => setDeductFromPayroll(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Automatically link to Rider Payroll for deduction</span>
            </label>
            {deductFromPayroll && (
              <div className="pl-6 pt-1">
                <span className="text-[11px] text-slate-500 block mb-1">Payroll Cycle Period</span>
                <input
                  type="text"
                  value={payrollPeriodKey}
                  onChange={(e) => setPayrollPeriodKey(e.target.value)}
                  className="w-36 text-xs rounded-lg border border-slate-200 px-2 py-1 bg-white text-slate-900"
                  placeholder="YYYY-MM (e.g. 2026-08)"
                />
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? <span>Logging...</span> : <span>Save Traffic Fine</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
