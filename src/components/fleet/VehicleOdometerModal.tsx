import React, { useState, useEffect } from 'react';
import { X, Gauge, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleOdometerModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleOdometerModal: React.FC<VehicleOdometerModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [reading, setReading] = useState<number>(0);
  const [source, setSource] = useState('Weekly Audit');
  const [notes, setNotes] = useState('Physical meter check at garage depot');
  const [isCorrection, setIsCorrection] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setReading(vehicle.current_odometer || 0);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCorrection && reading < vehicle.current_odometer) {
      setError(`New reading (${reading} km) cannot be less than current reading (${vehicle.current_odometer} km) without flagging as an authorized correction.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.recordOdometer(vehicle.id, {
        reading,
        source,
        notes,
        isCorrection,
        correctionReason,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to record odometer reading.');
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
            <h3 className="text-base font-bold text-slate-900">Record Odometer Reading</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number} • Current: {vehicle.current_odometer.toLocaleString()} km
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              New Odometer Reading (KM) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={reading}
              onChange={(e) => setReading(Number(e.target.value))}
              required
              className="w-full text-sm font-bold rounded-xl border border-slate-200 px-3 py-2.5 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Source / Method</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            >
              <option value="Weekly Audit">Weekly Physical Depot Audit</option>
              <option value="GPS Telemetry">GPS Telemetry Sync</option>
              <option value="Rider Self-Inspection">Rider Daily Photo Inspection</option>
              <option value="Fuel Refill">Fuel Receipt Verification</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isCorrection}
                onChange={(e) => setIsCorrection(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>Authorized Typo / Calibration Correction</span>
            </label>
            {isCorrection && (
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Reason for odometer correction..."
                className="w-full text-xs rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-slate-900"
              />
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? <span>Saving...</span> : <span>Save Reading</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
