import React, { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

const UAE_STATES = ['Dubai', 'Abu Dhabi', 'Al Ain', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'];

interface Props {
  vehicle: DbVehicleMasterEnhanced;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleLocationModal: React.FC<Props> = ({ vehicle, onClose, onSuccess }) => {
  const [state, setState] = useState(vehicle.location_state || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setState(vehicle.location_state || '');
    setError(null);
  }, [vehicle.id, vehicle.location_state]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fleetService.updateVehicleLocation(vehicle.id, state || null);
      if (!res.success) {
        setError(res.error || 'Reporting state could not be saved.');
        return;
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Reporting state could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="vehicle-location-title"
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="vehicle-location-title" className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <MapPin className="h-5 w-5 text-blue-600" /> Set reporting state
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Plate {vehicle.plate_emirate} {vehicle.plate_code || ''} {vehicle.plate_number}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={saving}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={save} className="space-y-4">
          <label htmlFor="bike-physical-state" className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Reporting State
          </label>
          <select id="bike-physical-state" value={state} onChange={(e) => setState(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Not set</option>
            {UAE_STATES.map((emirate) => <option value={emirate} key={emirate}>{emirate}</option>)}
          </select>
          <p className="text-xs text-slate-500">
            This reporting state controls the Vehicle Management state boxes and filter. It is separate from the plate emirate.
            Changing it will not assign or return the bike.
          </p>
          {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={saving}
              className="min-h-11 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:text-slate-200">Cancel</button>
            <button type="submit" disabled={saving || state === (vehicle.location_state || '')}
              className="min-h-11 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white disabled:opacity-50">
              {saving ? 'Saving...' : 'Save reporting state'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
