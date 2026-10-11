import React, { useState, useEffect } from 'react';
import { X, Bike, Car, Truck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DbVehicleMasterEnhanced, VehicleType, VehicleOperationalStatus } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';

interface VehicleFormModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(vehicle);

  const [formData, setFormData] = useState<Partial<DbVehicleMasterEnhanced>>({
    plate_number: '',
    plate_code: 'T',
    plate_emirate: 'Dubai',
    vehicle_code: '',
    vehicle_type: 'Motorcycle',
    make: '',
    model: '',
    year: undefined,
    color: 'Standard Fleet Blue',
    chassis_number: '',
    tc_number: '',
    engine_number: '',
    registration_number: '',
    registration_expiry: '2027-10-31',
    ownership_type: 'OWNED',
    owner_or_vendor: 'Pixel Syntax Delivery Software',
    purchase_date: '2024-01-15',
    purchase_cost: 11500,
    monthly_lease_cost: 0,
    current_odometer: 0,
    fuel_type: 'PETROL_95',
    branch_name: 'Dubai Central Hub (Al Quoz)',
    current_status: 'Available',
    gps_device_id: '',
    fuel_card_number: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [makesList, setMakesList] = useState<{ id: string; name: string }[]>([]);
  const [modelsList, setModelsList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      fleetService.getMakes().then(setMakesList).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (formData.make) {
      fleetService.getModels({ make_name: formData.make }).then(setModelsList).catch(console.error);
    } else {
      setModelsList([]);
    }
  }, [formData.make]);

  useEffect(() => {
    if (isOpen) {
      if (vehicle) {
        setFormData({ ...vehicle });
      } else {
        setFormData({
          plate_number: '',
          plate_code: 'T',
          plate_emirate: 'Dubai',
          vehicle_code: `VH-${Math.floor(1000 + Math.random() * 9000)}`,
          vehicle_type: 'Motorcycle',
          make: '',
          model: '',
          year: undefined,
          color: 'Standard Fleet Blue',
          chassis_number: `VIN${Date.now().toString().slice(-8)}`,
          tc_number: `TC-${Math.floor(100000 + Math.random() * 900000)}`,
          engine_number: `TC-${Math.floor(100000 + Math.random() * 900000)}`,
          registration_number: `MUL-${Math.floor(100000 + Math.random() * 900000)}`,
          registration_expiry: '2027-12-31',
          ownership_type: 'OWNED',
          owner_or_vendor: 'Company Fleet',
          purchase_date: '2024-01-15',
          purchase_cost: 11500,
          monthly_lease_cost: 0,
          current_odometer: 0,
          fuel_type: 'PETROL_95',
          branch_name: 'Dubai Central Hub (Al Quoz)',
          current_status: 'Available',
          gps_device_id: `GPS-TRK-${Math.floor(1000 + Math.random() * 9000)}`,
          fuel_card_number: `ENOC-${Math.floor(100000 + Math.random() * 900000)}`,
          notes: '',
        });
      }
    }
  }, [isOpen, vehicle]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate_number?.trim()) {
      setError('Plate number is required.');
      return;
    }
    if (!formData.make) {
      setError('Please select a Make / Brand from the master.');
      return;
    }
    if (!formData.model) {
      setError('Please select a Model.');
      return;
    }
    if (!formData.year) {
      setError('Please select a Manufacturing Year between 2009 and 2028.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isEditing && vehicle) {
        const res = await fleetService.updateVehicle(vehicle.id, formData);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.error || 'Failed to update vehicle.');
        }
      } else {
        const res = await fleetService.createVehicle(formData);
        if (res.success) {
          onSuccess();
          onClose();
        } else {
          setError(res.error || 'Failed to create vehicle.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0 z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isEditing ? 'Edit Vehicle Master Record' : 'Register New Fleet Vehicle'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter vehicle specifications, Mulkiya registration, and assignment baselines.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Core Plate & Type */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              1. Plate & Classification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Plate Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.plate_number || ''}
                  onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                  placeholder="e.g. 72154"
                  required
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Plate Code / Category</label>
                <input
                  type="text"
                  value={formData.plate_code || ''}
                  onChange={(e) => setFormData({ ...formData, plate_code: e.target.value })}
                  placeholder="e.g. T or B"
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emirate</label>
                <select
                  value={formData.plate_emirate || 'Dubai'}
                  onChange={(e) => setFormData({ ...formData, plate_emirate: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                >
                  <option value="Dubai">Dubai</option>
                  <option value="Abu Dhabi">Abu Dhabi</option>
                  <option value="Sharjah">Sharjah</option>
                  <option value="Ajman">Ajman</option>
                  <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                  <option value="Fujairah">Fujairah</option>
                  <option value="Umm Al Quwain">Umm Al Quwain</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vehicle Type</label>
                <select
                  value={formData.vehicle_type || 'Motorcycle'}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value as any })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                >
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Van">Delivery Van</option>
                  <option value="Car">Sedan / Hatchback</option>
                  <option value="Truck">3-Ton Truck / Chiller</option>
                  <option value="Bicycle">Bicycle / E-Bike</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Make, Model & Specs */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              2. Make, Model & Technical Specifications
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Make / Brand <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.make || ''}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value, model: '' })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 cursor-pointer"
                >
                  <option value="">Select Make</option>
                  {makesList.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Model <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  disabled={!formData.make}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">{formData.make ? 'Select Model' : 'Select Make first'}</option>
                  {modelsList.map((mod) => (
                    <option key={mod.id} value={mod.name}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manufacturing Year <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formData.year || ''}
                  onChange={(e) => setFormData({ ...formData, year: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900 cursor-pointer"
                >
                  <option value="">Select Year</option>
                  {Array.from({ length: 2028 - 2009 + 1 }, (_, i) => 2028 - i).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Odometer (KM)</label>
                <input
                  type="number"
                  value={formData.current_odometer || 0}
                  onChange={(e) => setFormData({ ...formData, current_odometer: Number(e.target.value) })}
                  className="w-full text-xs font-bold rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chassis Number (VIN)</label>
                <input
                  type="text"
                  value={formData.chassis_number || ''}
                  onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
                  className="w-full text-xs font-mono rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">TC Number</label>
                <input
                  type="text"
                  value={formData.tc_number || formData.engine_number || ''}
                  onChange={(e) => setFormData({ ...formData, tc_number: e.target.value, engine_number: e.target.value })}
                  placeholder="e.g. TC-982134"
                  className="w-full text-xs font-mono rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Mulkiya Registration */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              3. Mulkiya Registration Expiry
            </h4>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800">Mulkiya (Registration Card)</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Mulkiya Expiry Date</label>
                  <input
                    type="date"
                    value={formData.registration_expiry || ''}
                    onChange={(e) => setFormData({ ...formData, registration_expiry: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-0.5">Mulkiya / Card Number</label>
                  <input
                    type="text"
                    value={formData.registration_number || ''}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 bg-white text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Ownership & Branch */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              4. Ownership & Depot Location
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ownership Type</label>
                <select
                  value={formData.ownership_type || 'OWNED'}
                  onChange={(e) => setFormData({ ...formData, ownership_type: e.target.value as any })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                >
                  <option value="OWNED">Company Owned</option>
                  <option value="LEASED">Leased / Monthly Rental</option>
                  <option value="RIDER_OWNED">Rider Owned</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Depot / Branch</label>
                <input
                  type="text"
                  value={formData.branch_name || ''}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GPS Tracker Device ID</label>
                <input
                  type="text"
                  value={formData.gps_device_id || ''}
                  onChange={(e) => setFormData({ ...formData, gps_device_id: e.target.value })}
                  placeholder="e.g. GPS-TRK-8821"
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end space-x-3 sticky bottom-0 bg-white z-10">
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
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Update Vehicle' : 'Register Vehicle'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
