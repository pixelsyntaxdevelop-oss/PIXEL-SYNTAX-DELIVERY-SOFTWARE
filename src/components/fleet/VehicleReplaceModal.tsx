import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleReplaceModalProps {
  currentVehicle?: DbVehicleMasterEnhanced | null;
  vehicle?: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleReplaceModal: React.FC<VehicleReplaceModalProps> = ({
  currentVehicle,
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const activeVehicle = currentVehicle || vehicle;
  const [availableVehicles, setAvailableVehicles] = useState<DbVehicleMasterEnhanced[]>([]);
  const [newVehicleId, setNewVehicleId] = useState('');
  const [returnOdometer, setReturnOdometer] = useState<number>(0);
  const [newStartingOdometer, setNewStartingOdometer] = useState<number>(0);
  const [conditionOnReturn, setConditionOnReturn] = useState('GOOD');
  const [newCondition, setNewCondition] = useState('EXCELLENT');
  const [replacementReason, setReplacementReason] = useState('Routine replacement / maintenance swap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && activeVehicle) {
      setReturnOdometer(activeVehicle.current_odometer || 0);
      loadAvailableVehicles();
    }
  }, [isOpen, activeVehicle]);

  const loadAvailableVehicles = async () => {
    try {
      const res = await fleetService.getVehicles({ status: 'Available' });
      const filtered = res.filter((v) => v.id !== activeVehicle?.id);
      setAvailableVehicles(filtered);
      if (filtered.length > 0) {
        setNewVehicleId(filtered[0].id);
        setNewStartingOdometer(filtered[0].current_odometer || 0);
      }
    } catch (err) {
      console.error('Failed to load available replacement vehicles:', err);
    }
  };

  const handleSelectNewVehicle = (vId: string) => {
    setNewVehicleId(vId);
    const target = availableVehicles.find((v) => v.id === vId);
    if (target) {
      setNewStartingOdometer(target.current_odometer || 0);
    }
  };

  if (!isOpen || !currentVehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVehicle.current_rider_id) {
      setError('Current vehicle does not have an active rider.');
      return;
    }
    if (!newVehicleId) {
      setError('Please select an available replacement vehicle.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.replaceVehicleForEmployee(currentVehicle.current_rider_id, {
        oldVehicleId: currentVehicle.id,
        newVehicleId,
        returnOdometer,
        conditionOnReturn,
        returnNotes: `Replaced with new vehicle. Reason: ${replacementReason}`,
        newStartingOdometer,
        newCondition,
        replacementReason,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to replace vehicle.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during replacement.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Replace / Swap Rider Vehicle</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rider: <span className="font-semibold text-slate-800">{currentVehicle.current_rider_name} ({currentVehicle.current_rider_code})</span>
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

          {/* Current vs New Vehicle Comparison Banner */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400">Current Bike (Returning)</span>
              <p className="font-bold text-slate-800 mt-0.5">{currentVehicle.plate_emirate} {currentVehicle.plate_number}</p>
              <p className="text-slate-500">{currentVehicle.make} {currentVehicle.model}</p>
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase text-blue-500">New Target Bike</span>
              {availableVehicles.length > 0 ? (
                <select
                  value={newVehicleId}
                  onChange={(e) => handleSelectNewVehicle(e.target.value)}
                  className="w-full mt-1 text-xs font-semibold rounded-lg border border-blue-200 px-2 py-1.5 bg-white text-blue-900 focus:ring-2 focus:ring-blue-500"
                >
                  {availableVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate_emirate} {v.plate_number} ({v.make} {v.model}) - {v.current_odometer.toLocaleString()} km
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-rose-600 font-semibold mt-1">No available vehicles in fleet!</p>
              )}
            </div>
          </div>

          {/* Odometers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Old Bike Return Odometer (KM)
              </label>
              <input
                type="number"
                value={returnOdometer}
                onChange={(e) => setReturnOdometer(Number(e.target.value))}
                min={currentVehicle.current_odometer}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Bike Handover Odometer (KM)
              </label>
              <input
                type="number"
                value={newStartingOdometer}
                onChange={(e) => setNewStartingOdometer(Number(e.target.value))}
                required
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
          </div>

          {/* Reason for Replacement */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Replacement <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={replacementReason}
              onChange={(e) => setReplacementReason(e.target.value)}
              required
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              placeholder="e.g. Engine noise / Sent for 15,000km overhaul / Accident repair"
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
              disabled={loading || availableVehicles.length === 0}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Executing Swap...</span>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Execute Vehicle Swap</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
