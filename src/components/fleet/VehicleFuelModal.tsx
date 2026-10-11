import React, { useState, useEffect } from 'react';
import { X, Fuel, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleFuelModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleFuelModal: React.FC<VehicleFuelModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [liters, setLiters] = useState<number>(10.5);
  const [cost, setCost] = useState<number>(33.5);
  const [odometer, setOdometer] = useState<number>(0);
  const [stationVendor, setStationVendor] = useState('ENOC');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setOdometer(vehicle.current_odometer || 0);
      setReceiptNumber(`REC-${Date.now().toString().slice(-6)}`);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.logFuel(vehicle.id, {
        date,
        odometer,
        liters,
        cost,
        fuel_type: vehicle.fuel_type || 'PETROL_95',
        station_vendor: stationVendor,
        receipt_number: receiptNumber,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to record fuel entry.');
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
            <h3 className="text-base font-bold text-slate-900">Log Fuel Refill</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number} • {vehicle.make} {vehicle.model}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Station / Brand</label>
              <select
                value={stationVendor}
                onChange={(e) => setStationVendor(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              >
                <option value="ENOC">ENOC / EPPCO</option>
                <option value="ADNOC">ADNOC Distribution</option>
                <option value="EMARAT">EMARAT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Volume (Liters)</label>
              <input
                type="number"
                step="0.01"
                value={liters}
                onChange={(e) => setLiters(Number(e.target.value))}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total Cost (AED)</label>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Odometer Reading (KM)</label>
              <input
                type="number"
                value={odometer}
                onChange={(e) => setOdometer(Number(e.target.value))}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt / Invoice #</label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? <span>Logging...</span> : <span>Save Fuel Entry</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
