import React, { useState, useEffect } from 'react';
import {
  X,
  Truck,
  Bike,
  Car,
  User,
  Gauge,
  Calendar,
  ShieldAlert,
  Fuel,
  Wrench,
  FileText,
  AlertTriangle,
  Receipt,
  DollarSign,
  Clock,
  History,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  Tag,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Building2,
  Edit3,
} from 'lucide-react';
import { Vehicle360Data, DbVehicleMasterEnhanced, VehicleOperationalStatus } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { EditVehicleAssignmentModal } from './EditVehicleAssignmentModal';
import { ReturnVehicleToVendorModal } from './ReturnVehicleToVendorModal';

interface Vehicle360ProfileModalProps {
  vehicleId: string;
  isOpen: boolean;
  onClose: () => void;
  onRefreshList?: () => void;
  onOpenAssign?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenReturn?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenReplace?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenMaintenance?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenFuel?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenFine?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenAccident?: (vehicle: DbVehicleMasterEnhanced) => void;
  onOpenOdometer?: (vehicle: DbVehicleMasterEnhanced) => void;
}

export const Vehicle360ProfileModal: React.FC<Vehicle360ProfileModalProps> = ({
  vehicleId,
  isOpen,
  onClose,
  onRefreshList,
  onOpenAssign,
  onOpenReturn,
  onOpenReplace,
  onOpenMaintenance,
  onOpenFuel,
  onOpenFine,
  onOpenAccident,
  onOpenOdometer,
}) => {
  const [data, setData] = useState<Vehicle360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'assignments' | 'maintenance' | 'fuel' | 'odometer' | 'fines' | 'accidents' | 'tco' | 'timeline'
  >('overview');
  const [isReturnVendorOpen, setIsReturnVendorOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && vehicleId) {
      loadProfile();
    }
  }, [isOpen, vehicleId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await fleetService.getVehicle360Profile(vehicleId);
      setData(res);
    } catch (err) {
      console.error('Failed to load 360 profile:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const vehicle = data?.vehicle;

  const getStatusBadge = (status?: VehicleOperationalStatus) => {
    switch (status) {
      case 'Available':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Available</span>;
      case 'Assigned':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">Assigned</span>;
      case 'In Maintenance':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">In Maintenance</span>;
      case 'Accident':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200">Accident</span>;
      case 'Out of Service':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">Out of Service</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-50 text-slate-600 border border-slate-200">{status || 'Unknown'}</span>;
    }
  };

  const getVehicleIcon = (type?: string) => {
    if (type === 'Motorcycle') return <Bike className="w-5 h-5" />;
    if (type === 'Van' || type === 'Truck') return <Truck className="w-5 h-5" />;
    return <Car className="w-5 h-5" />;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-5xl min-h-screen shadow-2xl flex flex-col border-l border-slate-200">
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              {getVehicleIcon(vehicle?.vehicle_type)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {vehicle?.plate_emirate} {vehicle?.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle?.plate_number}
                </span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                  {vehicle?.vehicle_code}
                </span>
                {getStatusBadge(vehicle?.current_status)}
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {vehicle?.make} {vehicle?.model} ({vehicle?.year}) • {vehicle?.ownership_type} • {vehicle?.branch_name}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={loadProfile}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
              title="Refresh profile"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Summary Strip & Quick Actions */}
        {vehicle && (
          <div className="px-6 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-6">
              <div>
                <span className="text-xs text-slate-400 font-medium">Assigned Rider</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800">
                    {vehicle.current_rider_name ? (
                      <span className="text-blue-600">{vehicle.current_rider_name} ({vehicle.current_rider_code})</span>
                    ) : (
                      <span className="text-slate-400 italic">Unassigned (In Depot)</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200" />

              <div>
                <span className="text-xs text-slate-400 font-medium">Current Odometer</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Gauge className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-900">
                    {vehicle.current_odometer.toLocaleString()} km
                  </span>
                </div>
              </div>

              <div className="h-7 w-px bg-slate-200" />

              <div>
                <span className="text-xs text-slate-400 font-medium">Mulkiya Expiry</span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span
                    className={`text-sm font-semibold ${
                      data?.registrationExpiryStatus.mulkiyaStatus === 'EXPIRED'
                        ? 'text-rose-600 font-bold'
                        : data?.registrationExpiryStatus.mulkiyaStatus === 'EXPIRING_SOON'
                        ? 'text-amber-600 font-bold'
                        : 'text-slate-700'
                    }`}
                  >
                    {vehicle.registration_expiry || 'N/A'}
                    {data?.registrationExpiryStatus.mulkiyaStatus === 'EXPIRED' && ' (Expired!)'}
                    {data?.registrationExpiryStatus.mulkiyaStatus === 'EXPIRING_SOON' && ` (${data.registrationExpiryStatus.mulkiyaDaysRemaining}d)`}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              {vehicle.current_status === 'Available' ? (
                <>
                  <button
                    onClick={() => onOpenAssign?.(vehicle)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Assign Rider</span>
                  </button>
                  <button
                    onClick={() => setIsReturnVendorOpen(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 flex items-center space-x-1 cursor-pointer"
                    title="Return bike to vendor/leasing company (Easylease, Raid Lease, etc.)"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Return to Vendor</span>
                  </button>
                </>
              ) : vehicle.current_status === 'Assigned' ? (
                <>
                  <button
                    onClick={() => onOpenReturn?.(vehicle)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return to Fleet</span>
                  </button>
                  <button
                    onClick={() => onOpenReplace?.(vehicle)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 flex items-center space-x-1"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Swap Vehicle</span>
                  </button>
                </>
              ) : null}

              <button
                onClick={() => onOpenMaintenance?.(vehicle)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 flex items-center space-x-1"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Service / Job</span>
              </button>

              <button
                onClick={() => onOpenFuel?.(vehicle)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 flex items-center space-x-1"
              >
                <Fuel className="w-3.5 h-3.5" />
                <span>Fuel</span>
              </button>

              <button
                onClick={() => onOpenFine?.(vehicle)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 flex items-center space-x-1"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Fine</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 bg-white flex space-x-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Specs', icon: FileText },
            { id: 'assignments', label: `Assignments (${data?.assignmentHistory.length || 0})`, icon: User },
            { id: 'maintenance', label: `Service & Repairs (${data?.maintenanceHistory.length || 0})`, icon: Wrench },
            { id: 'fuel', label: `Fuel Telemetry (${data?.fuelLogs.length || 0})`, icon: Fuel },
            { id: 'odometer', label: `Odometer (${data?.odometerHistory.length || 0})`, icon: Gauge },
            { id: 'fines', label: `Traffic Fines (${data?.fines.length || 0})`, icon: Receipt },
            { id: 'accidents', label: `Accidents (${data?.accidents.length || 0})`, icon: ShieldAlert },
            { id: 'tco', label: 'TCO & Cost Analytics', icon: DollarSign },
            { id: 'timeline', label: 'Timeline', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3.5 text-xs font-semibold border-b-2 flex items-center space-x-1.5 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Loading comprehensive 360 profile...</p>
            </div>
          ) : !vehicle ? (
            <div className="py-20 text-center text-slate-500">Vehicle not found.</div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW & SPECS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Maintenance Alert Box if Due */}
                  {data?.maintenanceDueStatus.isDue && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start space-x-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-900">Preventive Maintenance Required</h4>
                        <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
                          {data.maintenanceDueStatus.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                      <button
                        onClick={() => onOpenMaintenance?.(vehicle)}
                        className="px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                      >
                        Book Workshop
                      </button>
                    </div>
                  )}

                  {/* Custody / Last Assignment Card */}
                  {(() => {
                    const isAssigned = vehicle.current_status === 'Assigned' && Boolean(vehicle.current_rider_name || data?.currentAssignment);
                    const lastAsgn = data?.assignmentHistory?.find((a: any) => a.assignment_status !== 'ACTIVE');
                    const lastRider = vehicle.last_employee_name || vehicle.last_rider_name || lastAsgn?.employee_name || '—';
                    const lastCode = vehicle.last_employee_code || vehicle.last_rider_code || vehicle.last_employee_id || lastAsgn?.employee_code || '';
                    const lastProj = vehicle.previous_project || lastAsgn?.project_name || 'General Fleet';
                    const lastAsgDate = vehicle.last_assigned_date || lastAsgn?.assignment_date || '—';
                    const lastRetDate = vehicle.last_returned_date || lastAsgn?.return_date || '—';
                    const lastAsgBy = vehicle.last_assigned_by || lastAsgn?.assigned_by || 'Operations Admin';
                    const lastRetBy = vehicle.last_returned_by || lastAsgn?.returned_by || lastAsgn?.returned_to || 'Operations Admin';
                    const lastReason = vehicle.last_return_reason || vehicle.last_return_notes || lastAsgn?.return_reason || (lastAsgn as any)?.reason || 'Depot Return';

                    return (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600" />
                            {isAssigned ? 'Active Custody & Assignment' : 'Last Custody & Assignment History'}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isAssigned
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {isAssigned ? 'Active Custody' : 'Available • Preserved Last Custody'}
                          </span>
                        </div>

                        {isAssigned ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Current Rider</span>
                              <span className="font-bold text-slate-900">{vehicle.current_rider_name || data?.currentAssignment?.employee_name}</span>
                              <span className="block text-[10px] font-mono text-slate-500">{vehicle.current_rider_code || data?.currentAssignment?.employee_code}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Current Project</span>
                              <span className="font-semibold text-slate-800">{vehicle.project_name || data?.currentAssignment?.project_name || 'General Fleet'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Assigned Date</span>
                              <span className="font-mono text-slate-800">{data?.currentAssignment?.assignment_date || vehicle.last_assigned_date || '—'}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Assigned By</span>
                              <span className="font-semibold text-slate-800">{data?.currentAssignment?.assigned_by || vehicle.last_assigned_by || 'Operations Admin'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Previous Employee</span>
                              <span className="font-bold text-slate-900">{lastRider}</span>
                              {lastCode && <span className="block text-[10px] font-mono text-slate-500">ID: {lastCode}</span>}
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Previous Project</span>
                              <span className="font-semibold text-slate-800">{lastProj}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Assigned Date & By</span>
                              <span className="font-mono text-slate-800 block">{lastAsgDate}</span>
                              <span className="text-[10px] text-slate-500">by {lastAsgBy}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">Returned Date & By</span>
                              <span className="font-mono text-slate-800 block">{lastRetDate}</span>
                              <span className="text-[10px] text-slate-500">by {lastRetBy}</span>
                            </div>
                            <div className="col-span-2 sm:col-span-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] font-medium text-slate-500">Return Reason / Remark:</span>
                              <span className="text-xs font-semibold text-slate-800">{lastReason}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Primary Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vehicle Identification */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Vehicle Identification
                      </h4>
                      <dl className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Plate Number</dt>
                          <dd className="font-semibold text-slate-900">{vehicle.plate_emirate} {vehicle.plate_code ? `${vehicle.plate_code}-` : ''}{vehicle.plate_number}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Chassis Number (VIN)</dt>
                          <dd className="font-mono text-slate-800">{vehicle.chassis_number}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Engine Number</dt>
                          <dd className="font-mono text-slate-800">{vehicle.engine_number || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Make & Model</dt>
                          <dd className="font-semibold text-slate-800">{vehicle.make} {vehicle.model} ({vehicle.year})</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Fuel Type</dt>
                          <dd className="font-semibold text-slate-800">{vehicle.fuel_type}</dd>
                        </div>
                        <div className="flex justify-between py-1">
                          <dt className="text-slate-500 font-medium">GPS Device ID</dt>
                          <dd className="font-mono text-blue-600">{vehicle.gps_device_id || 'Not Installed'}</dd>
                        </div>
                      </dl>
                    </div>

                    {/* Mulkiya Registration */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        Mulkiya & Compliance
                      </h4>
                      <dl className="space-y-3 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Registration Number</dt>
                          <dd className="font-semibold text-slate-800">{vehicle.registration_number || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <dt className="text-slate-500 font-medium">Mulkiya Expiry Date</dt>
                          <dd className="font-semibold text-slate-900">{vehicle.registration_expiry}</dd>
                        </div>
                        <div className="flex justify-between py-1">
                          <dt className="text-slate-500 font-medium">Ownership</dt>
                          <dd className="font-semibold text-slate-800">{vehicle.ownership_type} • {vehicle.owner_or_vendor}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* Operational Notes */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Operational Dispatch Notes
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {vehicle.notes || 'No dispatch notes recorded for this vehicle.'}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: ASSIGNMENTS */}
              {activeTab === 'assignments' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Assignment & Handover History
                    </h4>
                    {vehicle.current_status === 'Available' && (
                      <button
                        onClick={() => onOpenAssign?.(vehicle)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Assign to Rider</span>
                      </button>
                    )}
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Rider</th>
                        <th className="p-3">Project / Hub</th>
                        <th className="p-3">Assignment Date</th>
                        <th className="p-3">Return Date</th>
                        <th className="p-3">Assigned By</th>
                        <th className="p-3">Returned By</th>
                        <th className="p-3">Starting Odo</th>
                        <th className="p-3">Return Odo</th>
                        <th className="p-3">Distance</th>
                        <th className="p-3">Return Reason</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.assignmentHistory.length ? (
                        data.assignmentHistory.map((asgn) => {
                          const dist = asgn.return_odometer
                            ? asgn.return_odometer - asgn.starting_odometer
                            : vehicle.current_odometer - asgn.starting_odometer;
                          const isAct = asgn.assignment_status === 'ACTIVE';
                          const retBy = asgn.returned_by || asgn.returned_to || (!isAct ? 'Operations Admin' : '—');
                          const retReason = asgn.return_reason || (asgn as any)?.reason || asgn.return_notes || (!isAct ? 'Depot Return' : '—');

                          return (
                            <tr key={asgn.id} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-900">
                                {asgn.employee_name}
                                <span className="block text-slate-400 font-normal text-[11px]">{asgn.employee_code}</span>
                              </td>
                              <td className="p-3 text-slate-600">{asgn.project_name || 'General Fleet'}</td>
                              <td className="p-3 text-slate-700">{asgn.assignment_date} {asgn.assignment_time || ''}</td>
                              <td className="p-3 text-slate-700">{asgn.return_date ? `${asgn.return_date} ${asgn.return_time || ''}` : <span className="text-emerald-600 font-semibold">Active Handover</span>}</td>
                              <td className="p-3 text-slate-700">{asgn.assigned_by || 'Operations Admin'}</td>
                              <td className="p-3 text-slate-700">{retBy}</td>
                              <td className="p-3 font-mono text-slate-700">{asgn.starting_odometer.toLocaleString()} km</td>
                              <td className="p-3 font-mono text-slate-700">{asgn.return_odometer ? `${asgn.return_odometer.toLocaleString()} km` : '-'}</td>
                              <td className="p-3 font-semibold text-slate-800">+{dist.toLocaleString()} km</td>
                              <td className="p-3 text-slate-600 max-w-[150px] truncate" title={retReason}>{retReason}</td>
                              <td className="p-3">
                                {isAct ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">ACTIVE</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{asgn.assignment_status}</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => setEditingAssignment(asgn)}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="Edit assignment record (dates, odometer, notes)"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-slate-400">
                            No assignment history recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: MAINTENANCE */}
              {activeTab === 'maintenance' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Maintenance & Workshop Service Jobs
                    </h4>
                    <button
                      onClick={() => onOpenMaintenance?.(vehicle)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Service / Repair</span>
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Service Type</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Workshop</th>
                        <th className="p-3">Odometer</th>
                        <th className="p-3">Cost (AED)</th>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.maintenanceHistory.length ? (
                        data.maintenanceHistory.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-900">
                              {m.maintenance_type}
                              <span className="block text-slate-500 font-normal text-[11px] truncate max-w-xs">{m.description}</span>
                            </td>
                            <td className="p-3 text-slate-700">{m.completed_date || m.reported_date}</td>
                            <td className="p-3 text-slate-700">{m.workshop_name}</td>
                            <td className="p-3 font-mono text-slate-700">{m.odometer_at_service?.toLocaleString()} km</td>
                            <td className="p-3 font-bold text-slate-900">AED {m.cost}</td>
                            <td className="p-3 font-mono text-slate-600">{m.invoice_number || 'N/A'}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-semibold ${
                                  m.status === 'Completed'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {m.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No service records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: FUEL */}
              {activeTab === 'fuel' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Fuel Refills & Station Logs
                    </h4>
                    <button
                      onClick={() => onOpenFuel?.(vehicle)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Fuel Refill</span>
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Driver</th>
                        <th className="p-3">Station</th>
                        <th className="p-3">Odometer</th>
                        <th className="p-3">Liters</th>
                        <th className="p-3">Cost (AED)</th>
                        <th className="p-3">Anomaly</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.fuelLogs.length ? (
                        data.fuelLogs.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-700">{f.date}</td>
                            <td className="p-3 text-slate-800 font-medium">{f.employee_name || 'Driver'}</td>
                            <td className="p-3 text-slate-700">{f.station_vendor}</td>
                            <td className="p-3 font-mono text-slate-700">{f.odometer.toLocaleString()} km</td>
                            <td className="p-3 font-semibold text-slate-800">{f.liters} L</td>
                            <td className="p-3 font-bold text-slate-900">AED {f.cost}</td>
                            <td className="p-3">
                              {f.anomaly_flag ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold flex items-center space-x-1 w-fit">
                                  <AlertOctagon className="w-3 h-3" />
                                  <span>Flagged</span>
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No fuel records logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 5: ODOMETER */}
              {activeTab === 'odometer' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Odometer Readings & Monotonic Audit
                    </h4>
                    <button
                      onClick={() => onOpenOdometer?.(vehicle)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Reading</span>
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Date & Time</th>
                        <th className="p-3">Reading (KM)</th>
                        <th className="p-3">Source</th>
                        <th className="p-3">Entered By</th>
                        <th className="p-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.odometerHistory.length ? (
                        data.odometerHistory.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-700">{o.recorded_at.replace('T', ' ').slice(0, 16)}</td>
                            <td className="p-3 font-mono font-bold text-slate-900">{o.reading.toLocaleString()} km</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                                {o.source}
                              </span>
                            </td>
                            <td className="p-3 text-slate-700">{o.entered_by}</td>
                            <td className="p-3 text-slate-500">{o.notes || '-'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400">
                            No odometer history recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 6: TRAFFIC FINES */}
              {activeTab === 'fines' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Traffic Fines & Radar Tickets
                    </h4>
                    <button
                      onClick={() => onOpenFine?.(vehicle)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Log Ticket</span>
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Ticket #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Authority</th>
                        <th className="p-3">Violation</th>
                        <th className="p-3">Rider</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payroll Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.fines.length ? (
                        data.fines.map((fn) => (
                          <tr key={fn.id} className="hover:bg-slate-50">
                            <td className="p-3 font-mono font-semibold text-slate-900">{fn.fine_number}</td>
                            <td className="p-3 text-slate-700">{fn.fine_date}</td>
                            <td className="p-3 text-slate-700 font-medium">{fn.authority}</td>
                            <td className="p-3 text-slate-600 max-w-xs truncate">{fn.violation_type}</td>
                            <td className="p-3 text-slate-800">{fn.employee_name || 'Unassigned'}</td>
                            <td className="p-3 font-bold text-rose-600">AED {fn.amount}</td>
                            <td className="p-3">
                              {fn.deducted_from_payroll ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold">
                                  Deducted in {fn.payroll_period_key}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                  Pending Payroll
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            Clean traffic record. No fines logged.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 7: ACCIDENTS */}
              {activeTab === 'accidents' && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Accident Claims & Collision Reports
                    </h4>
                    <button
                      onClick={() => onOpenAccident?.(vehicle)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Report Accident</span>
                    </button>
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Severity</th>
                        <th className="p-3">Location & Details</th>
                        <th className="p-3">Police Report #</th>
                        <th className="p-3">Claim #</th>
                        <th className="p-3">Estimated Cost</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data?.accidents.length ? (
                        data.accidents.map((ac) => (
                          <tr key={ac.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-700">{ac.date_time}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold">
                                {ac.severity}
                              </span>
                            </td>
                            <td className="p-3 text-slate-800 max-w-xs">
                              <span className="font-semibold block">{ac.location}</span>
                              <span className="text-slate-500 text-[11px] truncate block">{ac.description}</span>
                            </td>
                            <td className="p-3 font-mono text-slate-700">{ac.police_report_number || 'Pending'}</td>
                            <td className="p-3 font-mono text-slate-700">{ac.insurance_claim_number || 'Pending'}</td>
                            <td className="p-3 font-bold text-slate-900">AED {ac.estimated_cost}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                                {ac.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            No accidents reported for this vehicle.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 8: TCO & ANALYTICS */}
              {activeTab === 'tco' && data?.tcoSummary && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-xs text-slate-400 font-medium">Total Lifetime Cost</span>
                      <p className="text-xl font-extrabold text-slate-900 mt-1">
                        AED {data.tcoSummary.totalCost.toLocaleString()}
                      </p>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">Purchase + Ops Spend</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-xs text-slate-400 font-medium">Cost Per Kilometer</span>
                      <p className="text-xl font-extrabold text-blue-600 mt-1">
                        AED {data.tcoSummary.costPerKm} / km
                      </p>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">Based on {vehicle.current_odometer.toLocaleString()} km</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-xs text-slate-400 font-medium">Total Maintenance</span>
                      <p className="text-xl font-extrabold text-amber-600 mt-1">
                        AED {data.tcoSummary.maintenance.toLocaleString()}
                      </p>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">{data.maintenanceHistory.length} workshop services</span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                      <span className="text-xs text-slate-400 font-medium">Total Fuel Spend</span>
                      <p className="text-xl font-extrabold text-emerald-600 mt-1">
                        AED {data.tcoSummary.fuel.toLocaleString()}
                      </p>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">{data.fuelLogs.length} fuel card refills</span>
                    </div>
                  </div>

                  {/* Cost Distribution Breakdown */}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">
                      Total Cost of Ownership (TCO) Distribution
                    </h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Vehicle Purchase / Lease Cost', amount: data.tcoSummary.purchaseOrLease, color: 'bg-blue-600' },
                        { label: 'Fuel Expenses', amount: data.tcoSummary.fuel, color: 'bg-emerald-500' },
                        { label: 'Maintenance & Repairs', amount: data.tcoSummary.maintenance, color: 'bg-amber-500' },
                        { label: 'Traffic Fines & Radar Penalties', amount: data.tcoSummary.fines, color: 'bg-rose-500' },
                        { label: 'Mulkiya & Compliance Renewal', amount: data.tcoSummary.insuranceAndRegistration, color: 'bg-indigo-500' },
                      ].map((item, idx) => {
                        const pct = data.tcoSummary.totalCost > 0
                          ? Math.round((item.amount / data.tcoSummary.totalCost) * 100)
                          : 0;
                        return (
                          <div key={idx}>
                            <div className="flex justify-between text-xs font-medium mb-1">
                              <span className="text-slate-700">{item.label}</span>
                              <span className="text-slate-900 font-bold">AED {item.amount.toLocaleString()} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div className={`${item.color} h-full rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: TIMELINE */}
              {activeTab === 'timeline' && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-4">
                    Lifecycle Audit Event Stream
                  </h4>
                  <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {data?.timeline.length ? (
                      data.timeline.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-600 shadow-xs" />
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900">{event.title}</span>
                              <span className="text-[11px] text-slate-400 font-mono">{event.date}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">{event.description}</p>
                            <span className="text-[10px] text-slate-400 block mt-1">Logged by: {event.user}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No lifecycle events recorded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Return to Vendor Modal */}
      {isReturnVendorOpen && vehicle && (
        <ReturnVehicleToVendorModal
          vehicle={vehicle}
          isOpen={isReturnVendorOpen}
          onClose={() => setIsReturnVendorOpen(false)}
          onSuccess={() => {
            loadProfile();
            onRefreshList?.();
          }}
        />
      )}

      {/* Edit Assignment Record Modal */}
      {editingAssignment && (
        <EditVehicleAssignmentModal
          assignment={editingAssignment}
          isOpen={Boolean(editingAssignment)}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            loadProfile();
            onRefreshList?.();
          }}
        />
      )}
    </div>
  );
};
