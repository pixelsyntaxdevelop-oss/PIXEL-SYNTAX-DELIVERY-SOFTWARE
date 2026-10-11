import React, { useState } from 'react';
import { X, ShieldAlert, AlertCircle } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleAccidentModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleAccidentModal: React.FC<VehicleAccidentModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [severity, setSeverity] = useState<'MINOR' | 'MODERATE' | 'MAJOR' | 'TOTAL_LOSS'>('MINOR');
  const [dateTime, setDateTime] = useState(new Date().toISOString().replace('T', ' ').slice(0, 16));
  const [location, setLocation] = useState('Al Quoz Industrial Area 3, Dubai');
  const [description, setDescription] = useState('Low speed rear collision at roundabout. Front fender and headlamp cracked.');
  const [policeReportNumber, setPoliceReportNumber] = useState('');
  const [insuranceClaimNumber, setInsuranceClaimNumber] = useState('');
  const [estimatedCost, setEstimatedCost] = useState<number>(650);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !vehicle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.reportAccident(vehicle.id, {
        severity,
        date_time: dateTime,
        location,
        description,
        police_report_number: policeReportNumber || `POL-${Date.now().toString().slice(-6)}`,
        insurance_claim_number: insuranceClaimNumber || `CLM-${Date.now().toString().slice(-5)}`,
        estimated_cost: estimatedCost,
        rider_id: vehicle.current_rider_id,
        rider_name: vehicle.current_rider_name,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to record accident report.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
          <div>
            <h3 className="text-base font-bold text-rose-900">Report Incident / Collision</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number}
              {vehicle.current_rider_name ? ` • Rider: ${vehicle.current_rider_name}` : ''}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Severity</label>
            <div className="grid grid-cols-4 gap-2">
              {(['MINOR', 'MODERATE', 'MAJOR', 'TOTAL_LOSS'] as const).map((sev) => (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSeverity(sev)}
                  className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                    severity === sev
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date & Time</label>
              <input
                type="text"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Repair Cost (AED)</label>
              <input
                type="number"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Police Report #</label>
              <input
                type="text"
                value={policeReportNumber}
                onChange={(e) => setPoliceReportNumber(e.target.value)}
                placeholder="e.g. DXB-POL-99212"
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Insurance Claim #</label>
              <input
                type="text"
                value={insuranceClaimNumber}
                onChange={(e) => setInsuranceClaimNumber(e.target.value)}
                placeholder="e.g. CLM-SUK-1102"
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Location of Incident</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Incident Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-white text-slate-900"
            />
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
              {loading ? <span>Submitting...</span> : <span>Log Accident Report</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
