import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  User,
  Gauge,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Search,
  Phone,
  CreditCard,
  AlertTriangle,
  Bike,
  Smartphone,
} from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { apiClient } from '../../services/apiClient';
import { masterEmployeeService } from '../../services/masterEmployeeService';

interface VehicleAssignModalProps {
  vehicle: DbVehicleMasterEnhanced | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  vehiclesList?: DbVehicleMasterEnhanced[];
}

export const VehicleAssignModal: React.FC<VehicleAssignModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onSuccess,
  vehiclesList = [],
}) => {
  const [internalVehicle, setInternalVehicle] = useState<DbVehicleMasterEnhanced | null>(vehicle);
  const [allVehicles, setAllVehicles] = useState<DbVehicleMasterEnhanced[]>(vehiclesList);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');

  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [startingOdometer, setStartingOdometer] = useState<number | ''>('');
  const [condition, setCondition] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [forceReassign, setForceReassign] = useState(false);
  const [showReassignPrompt, setShowReassignPrompt] = useState(false);
  const [reassignReason, setReassignReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync passed vehicle when modal opens
  useEffect(() => {
    if (isOpen) {
      setInternalVehicle(vehicle);
      setVehicleSearchQuery('');
      setSelectedEmployeeId('');
      setSearchQuery('');
      setStartingOdometer('');
      setCondition('');
      setHandoverNotes('');
      setForceReassign(false);
      setShowReassignPrompt(false);
      setReassignReason(null);
      setError(null);
      loadEmployees();

      if (!vehicle && vehiclesList.length === 0) {
        // Load vehicles master if not provided
        apiClient.get<DbVehicleMasterEnhanced[]>('/api/erp/vehicles/master')
          .then((res) => {
            if (res.data && Array.isArray(res.data)) {
              setAllVehicles(res.data);
            }
          })
          .catch((err) => console.warn('Failed to load vehicles master:', err));
      } else if (vehiclesList.length > 0) {
        setAllVehicles(vehiclesList);
      }
    }
  }, [isOpen, vehicle, vehiclesList]);

  const activeVehicle = internalVehicle || vehicle;

  const loadEmployees = async (query = '') => {
    setLoadingEmployees(true);
    try {
      const data = await masterEmployeeService.searchAuthoritativeEmployeesForAssignment(query);
      if (data && Array.isArray(data)) {
        setEmployees(data as any);
      }
    } catch (err) {
      console.error('Failed to load authoritative employees for vehicle assignment:', err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Debounce search effect to query authoritative employee directory while typing
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = searchQuery.trim();
    const timer = setTimeout(() => {
      loadEmployees(trimmed);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // Filter vehicles by Plate, Chassis, TC, Make & Model
  const filteredVehicles = useMemo(() => {
    const q = vehicleSearchQuery.trim().toLowerCase();
    if (!q) return allVehicles.slice(0, 25);
    const qDigits = q.replace(/\D/g, '');

    return allVehicles.filter((v) => {
      const plate = (v.plate_number || (v as any).plateNumber || '').toLowerCase();
      const code = (v.plate_code || (v as any).plateCode || '').toLowerCase();
      const emirate = (v.plate_emirate || (v as any).plateEmirate || '').toLowerCase();
      const fullPlate = `${emirate} ${code} ${plate}`.toLowerCase();
      const chassis = (v.chassis_number || (v as any).chassisNumber || (v as any).vin || '').toLowerCase();
      const tc = (
        `${(v as any).tc_number || ''} ${(v as any).tcNumber || ''} ${(v as any).engine_number || ''}`
      ).toLowerCase();
      const makeModel = `${v.make || ''} ${v.model || ''}`.toLowerCase();

      if (fullPlate.includes(q) || plate.includes(q)) return true;
      if (qDigits && (plate.includes(qDigits) || chassis.includes(qDigits) || tc.includes(qDigits))) return true;
      if (chassis.includes(q)) return true;
      if (tc.includes(q)) return true;
      if (makeModel.includes(q)) return true;
      return false;
    });
  }, [allVehicles, vehicleSearchQuery]);

  // Filter employees across Name, Employee Code, Emirates ID, and Mobile
  const filteredEmployees = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return employees.slice(0, 30);

    const termDigits = term.replace(/\D/g, '');
    const termWords = term.split(/\s+/).filter(Boolean);

    return employees.filter((emp) => {
      const fn = (emp.full_name || emp.name || '').toLowerCase();
      const dn = (emp.display_name || '').toLowerCase();
      const first = (emp.first_name || '').toLowerCase();
      const last = (emp.last_name || '').toLowerCase();
      const namesCombined = `${first} ${last} ${fn} ${dn}`;

      const code = (emp.employee_code || '').toLowerCase();
      const idStr = (emp.id || '').toLowerCase();

      const eid = (emp.emirates_id_number || emp.emirates_id || '').toLowerCase();
      const eidDigits = eid.replace(/\D/g, '');

      const mob = (
        `${emp.personal_mobile || ''} ${emp.mobile_number || ''} ${emp.company_mobile || ''} ${emp.phone || ''}`
      ).toLowerCase();
      const mobDigits = mob.replace(/\D/g, '');

      // 1. Name match
      if (namesCombined.includes(term) || (termWords.length > 1 && termWords.every((w) => namesCombined.includes(w)))) {
        return true;
      }

      // 2. Employee Code match
      if (code.includes(term) || idStr.includes(term)) {
        return true;
      }
      if (termDigits && code.includes(termDigits)) {
        return true;
      }

      // 3. Emirates ID match
      if (eid.includes(term)) {
        return true;
      }
      if (termDigits.length >= 3 && eidDigits.includes(termDigits)) {
        return true;
      }

      // 4. Mobile match
      if (mob.includes(term)) {
        return true;
      }
      if (termDigits.length >= 3 && mobDigits.includes(termDigits)) {
        return true;
      }

      return false;
    });
  }, [employees, searchQuery]);

  if (!isOpen) return null;

  const isVehicleCurrentlyAssigned = Boolean(
    activeVehicle &&
      (activeVehicle.current_rider_id ||
        (activeVehicle as any).current_employee_id ||
        activeVehicle.current_rider_name ||
        (activeVehicle.current_status && activeVehicle.current_status.toLowerCase() === 'assigned'))
  );

  const doesSelectedEmployeeHaveBike = Boolean(
    selectedEmployee?.current_bike_plate || selectedEmployee?.current_bike_id
  );

  const needsReassignmentWarning = isVehicleCurrentlyAssigned || doesSelectedEmployeeHaveBike || showReassignPrompt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVehicle) {
      setError('Please select a vehicle to assign.');
      return;
    }
    if (!selectedEmployeeId) {
      setError('Please select an employee / rider to assign this vehicle.');
      return;
    }

    if (startingOdometer !== '' && activeVehicle.current_odometer !== undefined && Number(startingOdometer) < activeVehicle.current_odometer) {
      setError(
        `Starting odometer cannot be less than vehicle's current odometer (${activeVehicle.current_odometer} km).`
      );
      return;
    }

    // If re-assignment is needed and not yet confirmed
    if (needsReassignmentWarning && !forceReassign) {
      setShowReassignPrompt(true);
      setError(
        'This assignment involves an already assigned vehicle or employee. Please check the reassignment confirmation box below to proceed.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.assignVehicle(activeVehicle.id, selectedEmployeeId, {
        assignmentDate,
        startingOdometer: startingOdometer !== '' ? Number(startingOdometer) : undefined,
        condition: condition.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        forceReassign,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else if (res.reassignmentRequired) {
        setShowReassignPrompt(true);
        setReassignReason(
          res.error ||
            `Vehicle is currently assigned to ${res.currentAssignee?.name || 'another rider'}. Please confirm reassignment.`
        );
        setError(res.error || 'Reassignment confirmation required.');
      } else {
        setError(res.error || 'Failed to assign vehicle.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during assignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40 shrink-0">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Bike className="w-5 h-5 text-emerald-600" />
              Assign Vehicle to Employee
            </h3>
            {activeVehicle ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {activeVehicle.plate_emirate || 'UAE'} {activeVehicle.plate_code ? `${activeVehicle.plate_code}-` : ''}
                  {activeVehicle.plate_number}
                </span>{' '}
                • {activeVehicle.make} {activeVehicle.model} ({activeVehicle.year || '2024'})
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Select vehicle and assign to an authoritative company employee
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto grow">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* If no vehicle was preselected, show Vehicle Search First */}
          {!activeVehicle && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Search Bike / Vehicle <span className="text-rose-500">*</span>
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={vehicleSearchQuery}
                    onChange={(e) => setVehicleSearchQuery(e.target.value)}
                    placeholder="Search by Plate Number, Chassis Number, or TC Number..."
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    autoFocus
                  />
                  {vehicleSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setVehicleSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {filteredVehicles.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No vehicles found matching &ldquo;{vehicleSearchQuery}&rdquo;.
                    </div>
                  ) : (
                    filteredVehicles.map((v) => {
                      const isAssigned =
                        v.current_status === 'Assigned' ||
                        v.current_rider_id ||
                        (v as any).current_employee_id;
                      const riderName =
                        v.current_rider_name || (v as any).current_employee_name || 'Active Rider';
                      const plateDisplay = `${v.plate_emirate || ''} ${v.plate_code ? `${v.plate_code}-` : ''}${v.plate_number}`;

                      return (
                        <div
                          key={v.id}
                          onClick={() => setInternalVehicle(v)}
                          className="p-2.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              <Bike className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono">
                                  {plateDisplay}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  {v.make} {v.model}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                                {(v.chassis_number || (v as any).chassisNumber || (v as any).vin) && (
                                  <span>Chassis: {v.chassis_number || (v as any).chassisNumber || (v as any).vin}</span>
                                )}
                                {((v as any).tc_number || (v as any).tcNumber) && (
                                  <span>TC: {(v as any).tc_number || (v as any).tcNumber}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 pl-2 text-right">
                            {isAssigned ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                Assigned: {riderName}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                Available
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Vehicle Summary Card (When activeVehicle is known) */}
          {activeVehicle && (
            <div>
              <div className="p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-mono">
                        {activeVehicle.plate_emirate || 'UAE'} {activeVehicle.plate_code ? `${activeVehicle.plate_code}-` : ''}
                        {activeVehicle.plate_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {activeVehicle.make} {activeVehicle.model}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 font-mono">
                      {(activeVehicle.chassis_number || (activeVehicle as any).chassisNumber || (activeVehicle as any).vin) && (
                        <span>Chassis: {activeVehicle.chassis_number || (activeVehicle as any).chassisNumber || (activeVehicle as any).vin}</span>
                      )}
                      {((activeVehicle as any).tc_number || (activeVehicle as any).tcNumber) && (
                        <span>TC: {(activeVehicle as any).tc_number || (activeVehicle as any).tcNumber}</span>
                      )}
                      {activeVehicle.current_odometer !== undefined && (
                        <span>Odo: {activeVehicle.current_odometer} KM</span>
                      )}
                    </div>
                  </div>
                </div>
                {!vehicle && (
                  <button
                    type="button"
                    onClick={() => setInternalVehicle(null)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vehicle Current Custody Status Alert */}
          {isVehicleCurrentlyAssigned && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Currently Assigned Vehicle:</span> This bike is assigned to{' '}
                <span className="font-bold">
                  {activeVehicle?.current_rider_name || 'Active Rider'}
                </span>
                {activeVehicle?.current_rider_code ? ` (${activeVehicle.current_rider_code})` : ''}.
                Assigning will close the current assignment and transfer custody.
              </div>
            </div>
          )}

          {/* Employee Search & Selection Section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
              Search Employee <span className="text-rose-500">*</span>
            </label>

            {selectedEmployee ? (
              /* Selected Employee Preview Card */
              <div className="p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                    {(selectedEmployee.full_name || selectedEmployee.name || 'E')
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                        {selectedEmployee.full_name || selectedEmployee.name}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        {selectedEmployee.employee_code || 'ADL'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                      {(selectedEmployee.emirates_id_number || selectedEmployee.emirates_id) && (
                        <span className="flex items-center gap-1 font-mono">
                          <CreditCard className="w-3 h-3 text-slate-400" />
                          {selectedEmployee.emirates_id_number || selectedEmployee.emirates_id}
                        </span>
                      )}
                      {(selectedEmployee.personal_mobile ||
                        selectedEmployee.mobile_number ||
                        selectedEmployee.phone) && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {selectedEmployee.personal_mobile ||
                            selectedEmployee.mobile_number ||
                            selectedEmployee.phone}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {(selectedEmployee.has_active_sim || selectedEmployee.current_sim_number || selectedEmployee.current_sim_id) ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-md">
                          <Smartphone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>SIM: {selectedEmployee.current_sim_number || 'Active'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          No SIM Assigned
                        </span>
                      )}

                      {selectedEmployee.current_bike_plate ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-300 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                          ⚠️ Currently assigned bike: {selectedEmployee.current_bike_plate}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>No vehicle currently assigned</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeId('')}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              /* Search Input and Filtered List */
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Employee Name, Code (e.g. ADL0001), Emirates ID, or Mobile..."
                    className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                    autoFocus={Boolean(activeVehicle)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                  {loadingEmployees ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      Loading authoritative employees...
                    </div>
                  ) : filteredEmployees.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                      No employees match &ldquo;{searchQuery}&rdquo;. Try another search term.
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => {
                      const hasBike = Boolean(emp.current_bike_plate || emp.current_bike_id);
                      return (
                        <div
                          key={emp.id}
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            if (hasBike || isVehicleCurrentlyAssigned) {
                              setShowReassignPrompt(true);
                            }
                          }}
                          className="p-2.5 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 cursor-pointer transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              {(emp.full_name || emp.name || 'E').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {emp.full_name || emp.name}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {emp.employee_code || 'ADL'}
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                                  {emp.current_status || 'Active'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {(emp.emirates_id_number || emp.emirates_id) && (
                                  <span className="font-mono">
                                    ID: {emp.emirates_id_number || emp.emirates_id}
                                  </span>
                                )}
                                {(emp.personal_mobile || emp.mobile_number || emp.phone) && (
                                  <span>
                                    Mob: {emp.personal_mobile || emp.mobile_number || emp.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 pl-2 text-right flex flex-col items-end gap-1">
                            {Boolean(emp.has_active_sim || emp.current_sim_number || emp.current_sim_id) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300 px-1.5 py-0.5 rounded">
                                <Smartphone className="w-2.5 h-2.5" />
                                <span>SIM: {emp.current_sim_number || 'Active'}</span>
                              </span>
                            )}
                            {hasBike ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                                Has: {emp.current_bike_plate}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-md">
                                Available
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reassignment Confirmation Checkbox (if needed) */}
          {needsReassignmentWarning && (
            <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-800 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200">
                  <div className="font-bold">Reassignment Required</div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                    {reassignReason ||
                      'Assigning this vehicle will terminate previous active assignment records and transfer custody. Assignment history will be preserved.'}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-amber-200 dark:border-amber-800">
                <input
                  type="checkbox"
                  checked={forceReassign}
                  onChange={(e) => setForceReassign(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                />
                <span className="text-xs font-bold text-amber-950 dark:text-amber-100 select-none">
                  I explicitly confirm reassignment and custody handover
                </span>
              </label>
            </div>
          )}

          {/* Handover Details - Blank by default, operator enters manually */}
          {selectedEmployee && (
            <>
              {/* Odometer & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Handover Date
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="date"
                      value={assignmentDate}
                      onChange={(e) => setAssignmentDate(e.target.value)}
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                    Starting Odometer (KM)
                  </label>
                  <div className="relative">
                    <Gauge className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="number"
                      value={startingOdometer}
                      onChange={(e) => setStartingOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder={
                        activeVehicle?.current_odometer !== undefined
                          ? `Current: ${activeVehicle.current_odometer} KM`
                          : 'Enter starting KM'
                      }
                      className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Condition on Handover - Blank by default */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Condition on Handover
                </label>
                <input
                  type="text"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="e.g. Excellent, Good, Fair (enter condition)"
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 p-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Handover Checklist / Notes - Blank by default */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Handover Notes & Checklist
                </label>
                <textarea
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 p-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                  placeholder="Enter handover notes, equipment, or remarks manually..."
                />
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !activeVehicle || !selectedEmployeeId || (needsReassignmentWarning && !forceReassign)}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm flex items-center space-x-1.5 disabled:opacity-50 transition-all cursor-pointer"
            >
              {loading ? (
                <span>Assigning...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
