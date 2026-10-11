import React, { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  Car,
  Truck,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  User,
  Gauge,
  Calendar,
  Building2,
  Briefcase,
  Smartphone,
  ArrowRightLeft,
  X,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import { DbVehicleMasterEnhanced } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { masterEmployeeService, Employee360Profile } from '../../services/masterEmployeeService';
import { DbEmployeeMaster } from '../../types/database';

interface VehicleAssignViewProps {
  lang: 'EN' | 'AR';
  initialVehicleId?: string | null;
  onNavigate: (route: string) => void;
}

export const VehicleAssignView: React.FC<VehicleAssignViewProps> = ({
  lang,
  initialVehicleId,
  onNavigate,
}) => {
  // Vehicles State
  const [availableVehicles, setAvailableVehicles] = useState<DbVehicleMasterEnhanced[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<DbVehicleMasterEnhanced | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Employee State
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState<DbEmployeeMaster[]>([]);
  const [searchingEmployees, setSearchingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<DbEmployeeMaster | null>(null);
  const [employee360, setEmployee360] = useState<Employee360Profile | null>(null);
  const [loading360, setLoading360] = useState(false);

  // Assignment Details Form
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [startingOdometer, setStartingOdometer] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Mode: Normal vs Swap
  const [isSwapMode, setIsSwapMode] = useState(false);

  // Submission & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load available vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      setLoadingVehicles(true);
      try {
        const list = await fleetService.getVehicles({ status: 'Available' });
        setAvailableVehicles(list);

        // If initialVehicleId is provided, select it
        if (initialVehicleId) {
          const found = list.find((v) => v.id === initialVehicleId);
          if (found) {
            setSelectedVehicle(found);
            setStartingOdometer(found.current_odometer || 0);
          } else {
            // Might be any status; fetch 360 profile to get vehicle
            const p = await fleetService.getVehicle360Profile(initialVehicleId);
            if (p?.vehicle) {
              setSelectedVehicle(p.vehicle);
              setStartingOdometer(p.vehicle.current_odometer || 0);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch available vehicles:', err);
      } finally {
        setLoadingVehicles(false);
      }
    };
    fetchVehicles();
  }, [initialVehicleId]);

  // Debounced employee search
  useEffect(() => {
    if (!employeeSearch.trim()) {
      setEmployeeResults([]);
      return;
    }
    const handler = setTimeout(async () => {
      setSearchingEmployees(true);
      try {
        const res = await masterEmployeeService.searchEmployees(employeeSearch);
        setEmployeeResults(res);
      } catch (err) {
        console.error('Employee search error:', err);
      } finally {
        setSearchingEmployees(false);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [employeeSearch]);

  // Load employee 360 profile whenever an employee is selected
  useEffect(() => {
    if (!selectedEmployee) {
      setEmployee360(null);
      return;
    }
    const loadProfile = async () => {
      setLoading360(true);
      try {
        const p = await masterEmployeeService.getEmployee360Profile(selectedEmployee.id);
        setEmployee360(p);
      } catch (err) {
        console.error('Failed to load employee 360:', err);
      } finally {
        setLoading360(false);
      }
    };
    loadProfile();
  }, [selectedEmployee]);

  // Handle vehicle selection
  const handleSelectVehicle = (veh: DbVehicleMasterEnhanced) => {
    setSelectedVehicle(veh);
    setStartingOdometer(veh.current_odometer || 0);
    setError(null);
  };

  // Check if employee already has a bike
  const currentBike = employee360?.currentVehicle || selectedEmployee?.current_bike_id;
  const currentBikePlate =
    employee360?.currentVehicle?.plate_number || selectedEmployee?.current_bike_plate || 'Existing Vehicle';
  const hasExistingBike = Boolean(currentBike);

  // Submit normal assignment
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedVehicle) {
      setError('Please select a vehicle to assign.');
      return;
    }
    if (!selectedEmployee) {
      setError('Please select an employee.');
      return;
    }
    if (hasExistingBike && !isSwapMode) {
      setError(
        `Employee ${selectedEmployee.full_name} already has vehicle ${currentBikePlate} assigned. Use Swap or return the existing vehicle first.`
      );
      return;
    }

    setSubmitting(true);

    try {
      if (isSwapMode && currentBike) {
        const oldVehicleId = typeof currentBike === 'string' ? currentBike : currentBike.id;
        const currentOdom =
          typeof currentBike === 'object' && currentBike?.current_odometer
            ? currentBike.current_odometer
            : 0;

        const result = await fleetService.replaceVehicle(
          selectedEmployee.id,
          oldVehicleId,
          selectedVehicle.id,
          {
            returnOdometer: currentOdom,
            newStartingOdometer:
              startingOdometer !== '' ? Number(startingOdometer) : selectedVehicle.current_odometer || 0,
            replacementReason: notes.trim() || 'Vehicle Swap requested via Assign Workspace',
          }
        );

        if (result.success) {
          setSuccessMsg(`Vehicle successfully swapped to ${selectedVehicle.plate_number}!`);
          setTimeout(() => onNavigate('/vehicles'), 1200);
        } else {
          setError(result.error || 'Failed to execute vehicle swap.');
        }
      } else {
        const result = await fleetService.assignVehicle(selectedVehicle.id, selectedEmployee.id, {
          assignmentDate,
          startingOdometer: startingOdometer !== '' ? Number(startingOdometer) : selectedVehicle.current_odometer || 0,
          handoverNotes: notes.trim() || undefined,
        });

        if (result.success) {
          setSuccessMsg(
            `Vehicle ${selectedVehicle.plate_number} successfully assigned to ${selectedEmployee.full_name}!`
          );
          setTimeout(() => onNavigate('/vehicles'), 1200);
        } else {
          setError(result.error || 'Failed to assign vehicle.');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error processing assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredVehicles = availableVehicles.filter(
    (v) =>
      v.plate_number.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      v.make.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      v.model.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
      (v.plate_emirate && v.plate_emirate.toLowerCase().includes(vehicleSearch.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* 1. Top Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/vehicles')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Return to Vehicle Master"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isSwapMode ? 'Swap Fleet Vehicle' : 'Assign Vehicle'}
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  Custody Handover
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign an available company fleet vehicle to an employee.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/vehicles')}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={submitting || !selectedVehicle || !selectedEmployee || (hasExistingBike && !isSwapMode)}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 ${
                isSwapMode
                  ? 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing...</span>
                </>
              ) : isSwapMode ? (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Execute Vehicle Swap</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold">Assignment Error</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200 flex items-center gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <p className="text-xs font-bold">{successMsg}</p>
        </div>
      )}

      <form onSubmit={handleAssign} className="space-y-6">
        {/* STEP 1: SELECT AVAILABLE VEHICLE */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Select Available Vehicle
              </h3>
            </div>
            {selectedVehicle && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Vehicle Selected
              </span>
            )}
          </div>

          {/* Selected Vehicle Card */}
          {selectedVehicle ? (
            <div className="p-4 rounded-xl border-2 border-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Bike className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                      {selectedVehicle.plate_number}
                    </span>
                    {selectedVehicle.plate_code && (
                      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                        {selectedVehicle.plate_code}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                      {selectedVehicle.plate_emirate}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5">
                    {selectedVehicle.make} {selectedVehicle.model} ({selectedVehicle.year}) •{' '}
                    <span className="font-mono">{selectedVehicle.current_odometer || 0} km</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedVehicle(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  Change Vehicle
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Search available vehicles by Plate Number, Make, Model, Emirate..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {loadingVehicles ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading fleet inventory...</div>
              ) : filteredVehicles.length === 0 ? (
                <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs">
                  No available vehicles found matching search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                  {filteredVehicles.map((veh) => (
                    <div
                      key={veh.id}
                      onClick={() => handleSelectVehicle(veh)}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-900/50 cursor-pointer transition-all hover:shadow-xs group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-slate-900 dark:text-white group-hover:text-blue-600">
                            {veh.plate_number}
                          </span>
                          {veh.plate_code && (
                            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                              {veh.plate_code}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                          Available
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                        {veh.make} {veh.model}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span>{veh.plate_emirate}</span>
                        <span className="font-mono">{veh.current_odometer || 0} km</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: SELECT EMPLOYEE & LIVE SUMMARY CARD */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
                2
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Select Employee (Workforce Master)
              </h3>
            </div>
            {selectedEmployee && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Employee Selected
              </span>
            )}
          </div>

          {!selectedEmployee ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  placeholder="Search employee by Name, Employee Code (e.g. ADS-), Emirates ID, Mobile..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {searchingEmployees && (
                <div className="p-4 text-center text-xs text-slate-400">Searching master employee database...</div>
              )}

              {employeeResults.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-700/60 max-h-60 overflow-y-auto bg-white dark:bg-slate-900">
                  {employeeResults.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => {
                        setSelectedEmployee(emp);
                        setEmployeeSearch('');
                        setEmployeeResults([]);
                        setError(null);
                        setIsSwapMode(false);
                      }}
                      className="p-3 hover:bg-blue-50/50 dark:hover:bg-slate-800 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold text-xs">
                          {emp.full_name?.charAt(0) || 'E'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white">{emp.full_name}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Code: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{emp.employee_code}</span> •{' '}
                            {emp.designation || 'Delivery Rider'} • {emp.mobile_number || emp.phone_number || ''}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* LIVE EMPLOYEE SUMMARY CARD */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                      {selectedEmployee.full_name?.charAt(0) || 'E'}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedEmployee.full_name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Code: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedEmployee.employee_code}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEmployee(null);
                      setEmployee360(null);
                      setIsSwapMode(false);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors self-start sm:self-auto"
                  >
                    Change Employee
                  </button>
                </div>

                {/* 5-Point Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-slate-400" />
                      Visa / Category
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {selectedEmployee.visa_contractor_type || 'Visa Holder'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      <Briefcase className="w-3 h-3 text-slate-400" />
                      Primary Project
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {employee360?.currentProject?.name || selectedEmployee.project_name || 'No Active Project'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      <Bike className="w-3 h-3 text-slate-400" />
                      Current Bike
                    </span>
                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                      {hasExistingBike ? (
                        <span className="text-amber-600 dark:text-amber-400">{currentBikePlate}</span>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">None (Available)</span>
                      )}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-slate-400" />
                      Current SIM
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {employee360?.currentSim?.mobile_number || 'None'}
                    </p>
                  </div>
                </div>
              </div>

              {/* CONFLICT DETECTION BANNER & SAFE ALTERNATIVES */}
              {hasExistingBike && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200 space-y-3 shadow-xs">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Active Vehicle Conflict Detected
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        Employee <span className="font-bold">{selectedEmployee.full_name}</span> already has vehicle{' '}
                        <span className="font-mono font-bold">{currentBikePlate}</span> assigned. Double-assignment is blocked.
                      </p>
                    </div>
                  </div>

                  {/* Safe Alternatives */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200/60 dark:border-amber-800/60">
                    <button
                      type="button"
                      onClick={() => setIsSwapMode(true)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
                        isSwapMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
                      }`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>{isSwapMode ? 'Swap Mode Active' : 'Swap Vehicle'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployee(null);
                        setEmployee360(null);
                        setIsSwapMode(false);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold transition-colors"
                    >
                      Choose Different Employee
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 3: ASSIGNMENT DETAILS */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
              3
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Assignment Handover Details
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignment Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Assignment Handover Date</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <p className="text-[11px] text-slate-400">Effective custody start date</p>
            </div>

            {/* Starting Odometer */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Starting Odometer (km)</span>
              </label>
              <input
                type="number"
                value={startingOdometer}
                onChange={(e) => setStartingOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={selectedVehicle ? String(selectedVehicle.current_odometer || 0) : '0'}
                min={selectedVehicle?.current_odometer || 0}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">
                Cannot be lower than vehicle's current recorded odometer ({selectedVehicle?.current_odometer || 0} km)
              </p>
            </div>
          </div>

          {/* Handover Notes */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Handover Condition & Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery box installed, helmet provided, clean physical condition..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/vehicles')}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedVehicle || !selectedEmployee || (hasExistingBike && !isSwapMode)}
            className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 ${
              isSwapMode
                ? 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50'
                : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50'
            }`}
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : isSwapMode ? (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                <span>Execute Vehicle Swap</span>
              </>
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
  );
};
