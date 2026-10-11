import React, { useState, useEffect } from 'react';
import { X, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleMaintenanceModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleMaintenanceModal: React.FC<VehicleMaintenanceModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [maintenanceType, setMaintenanceType] = useState('General Service');
  const [category, setCategory] = useState<'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION'>('PREVENTIVE');
  const [workshopName, setWorkshopName] = useState('Apex Precision Garage Al Quoz');
  const [odometerAtService, setOdometerAtService] = useState<number>(0);
  const [partsCost, setPartsCost] = useState<number>(120);
  const [labourCost, setLabourCost] = useState<number>(80);
  const [status, setStatus] = useState<'Reported' | 'Scheduled' | 'In Progress' | 'Completed'>('In Progress');
  const [description, setDescription] = useState('Engine oil flush (10W40), spark plug inspection, brake shoe check.');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vehicle) {
      setOdometerAtService(vehicle.current_odometer || 0);
    }
  }, [isOpen, vehicle]);

  if (!isOpen || !vehicle) return null;

  const totalCost = (Number(partsCost) || 0) + (Number(labourCost) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.logMaintenance(vehicle.id, {
        maintenance_type: maintenanceType,
        maintenance_category: category,
        workshop_name: workshopName,
        odometer_at_service: odometerAtService,
        parts_cost: partsCost,
        labour_cost: labourCost,
        cost: totalCost,
        status,
        description,
        invoice_number: invoiceNumber || `INV-${Date.now().toString().slice(-5)}`,
        reported_date: new Date().toISOString().split('T')[0],
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to record maintenance job.');
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
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Book Workshop / Log Service</h3>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Service Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              >
                <option value="General Service">General Service (Routine)</option>
                <option value="Engine Oil Change">Engine Oil Change</option>
                <option value="Brake Overhaul">Brake Pads & Disc/Shoe</option>
                <option value="Tyre Replacement">Tyre Replacement</option>
                <option value="Periodic Inspection">RTA Passing / Inspection</option>
                <option value="Accident Repair">Accident Bodywork Repair</option>
                <option value="Battery Replacement">Battery Replacement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Workshop / Vendor <span className="text-rose-500">*</span>
              </label>
              <select
                value={workshopName}
                onChange={(e) => setWorkshopName(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              >
                <option value="Apex Precision Garage Al Quoz">Apex Precision Garage Al Quoz</option>
                <option value="Emirates Moto Body Shop">Emirates Moto Body Shop</option>
                <option value="Tasjeel Al Barsha RTA Testing">Tasjeel Al Barsha RTA Testing</option>
                <option value="In-House Mobile Fleet Van">In-House Mobile Fleet Van</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Parts Cost (AED)</label>
              <input
                type="number"
                value={partsCost}
                onChange={(e) => setPartsCost(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Labour Cost (AED)</label>
              <input
                type="number"
                value={labourCost}
                onChange={(e) => setLabourCost(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Total (AED)</label>
              <input
                type="text"
                readOnly
                value={`AED ${totalCost}`}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-slate-100 font-bold text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Current Odometer (KM)</label>
              <input
                type="number"
                value={odometerAtService}
                onChange={(e) => setOdometerAtService(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Job Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 font-semibold"
              >
                <option value="Scheduled">Scheduled</option>
                <option value="In Progress">In Progress (Bike in Garage)</option>
                <option value="Completed">Completed (Ready for road)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Work Completed</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs rounded-xl border border-slate-200 p-3 bg-white text-slate-900"
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
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading ? (
                <span>Recording...</span>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  <span>Submit Service Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
