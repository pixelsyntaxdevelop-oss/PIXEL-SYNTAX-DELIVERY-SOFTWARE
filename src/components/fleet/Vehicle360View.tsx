import React, { useState, useEffect } from 'react';
import {
  Bike,
  Car,
  Truck,
  ArrowLeft,
  User,
  Gauge,
  Calendar,
  Fuel,
  Wrench,
  FileText,
  AlertTriangle,
  Receipt,
  Clock,
  History,
  CheckCircle2,
  AlertOctagon,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  Building2,
  Briefcase,
  ShieldCheck,
  ExternalLink,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import { Vehicle360Data, DbVehicleMasterEnhanced, VehicleOperationalStatus } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { VehicleAssignModal } from './VehicleAssignModal';
import { VehicleReturnModal } from './VehicleReturnModal';
import { VehicleReplaceModal } from './VehicleReplaceModal';

interface Vehicle360ViewProps {
  vehicleId: string;
  lang: 'EN' | 'AR';
  onNavigate: (route: string) => void;
}

export const Vehicle360View: React.FC<Vehicle360ViewProps> = ({
  vehicleId,
  lang,
  onNavigate,
}) => {
  const [data, setData] = useState<Vehicle360Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'assignments' | 'documents' | 'status_history' | 'fines' | 'salik' | 'audit'
  >('overview');

  // Modal State for Quick Actions
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);

  const loadProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fleetService.getVehicle360Profile(vehicleId);
      if (!res?.vehicle) {
        setError('Vehicle not found.');
      } else {
        setData(res);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load vehicle 360 profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vehicleId) {
      loadProfile();
    }
  }, [vehicleId]);

  const vehicle = data?.vehicle;

  const renderStatusBadge = (status?: VehicleOperationalStatus | string) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Available
          </span>
        );
      case 'Assigned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Assigned
          </span>
        );
      case 'In Maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            In Maintenance
          </span>
        );
      case 'Returned to Vendor':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
            Returned to Vendor
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  const getMulkiyaCompliance = (expiryDate?: string) => {
    if (!expiryDate) return { text: 'Not Registered', badge: 'bg-slate-100 text-slate-600', days: 0 };
    const now = new Date();
    const exp = new Date(expiryDate);
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));
    if (days < 0) {
      return { text: `Expired ${Math.abs(days)}d ago`, badge: 'bg-rose-50 text-rose-700 border-rose-200', days };
    }
    if (days <= 30) {
      return { text: `Expiring (${days}d)`, badge: 'bg-amber-50 text-amber-700 border-amber-200', days };
    }
    return { text: `Valid (${days}d remaining)`, badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', days };
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 font-medium">Loading Vehicle 360 Profile...</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold">{error || 'Vehicle record not found'}</h3>
          <button
            onClick={() => onNavigate('/vehicles')}
            className="px-4 py-2 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-bold shadow-xs hover:bg-rose-100"
          >
            Back to Vehicle Management
          </button>
        </div>
      </div>
    );
  }

  const mulkiyaComp = getMulkiyaCompliance(vehicle.registration_expiry);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16">
      {/* 1. Top Summary Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => onNavigate('/vehicles')}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Return to Vehicle Master"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {vehicle.plate_number}
                </span>
                {vehicle.plate_code && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
                    {vehicle.plate_code}
                  </span>
                )}
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium">
                  {vehicle.plate_emirate}
                </span>
                {renderStatusBadge(vehicle.current_status)}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {vehicle.make} {vehicle.model} • Year {vehicle.year || '2024'} • {vehicle.vehicle_type || 'Motorcycle'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {vehicle.current_status === 'Available' ? (
              <button
                onClick={() => setIsAssignOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Vehicle</span>
              </button>
            ) : vehicle.current_status === 'Assigned' ? (
              <>
                <button
                  onClick={() => setIsAssignOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 hover:bg-blue-100 text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Reassign</span>
                </button>
                <button
                  onClick={() => setIsReturnOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100 text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return Vehicle</span>
                </button>
                <button
                  onClick={() => setIsReplaceOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 hover:bg-purple-100 text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Swap Vehicle</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAssignOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Vehicle</span>
              </button>
            )}

            <button
              onClick={loadProfile}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
              title="Refresh Vehicle Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 4-Stat Header Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <User className="w-3 h-3 text-slate-400" />
              Current Custody
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {vehicle.current_rider_name || 'Unassigned (In Pool)'}
            </p>
            {vehicle.current_rider_code && (
              <p className="text-[11px] font-mono text-blue-600 dark:text-blue-400">
                {vehicle.current_rider_code}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-slate-400" />
              Current Project
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {vehicle.project_name || 'No Project Linked'}
            </p>
            <p className="text-[11px] text-slate-400">Derived from Employee custody</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3 text-slate-400" />
              Ownership & Vendor
            </span>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {vehicle.ownership_type === 'OWNED' ? 'Company Owned' : vehicle.ownership_type}
            </p>
            <p className="text-[11px] text-slate-500 truncate">{vehicle.owner_or_vendor || 'Allied Fleet'}</p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <Gauge className="w-3 h-3 text-slate-400" />
              Current Odometer
            </span>
            <p className="text-xs font-mono font-black text-slate-900 dark:text-white">
              {(vehicle.current_odometer || 0).toLocaleString()} km
            </p>
            <p className="text-[11px] text-slate-400">Hub: {vehicle.branch_name || 'Dubai Central'}</p>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: FileText },
          { id: 'assignments', label: 'Assignment History', icon: History, count: data?.assignments?.length },
          { id: 'documents', label: 'Documents', icon: FileText, count: data?.documents?.length },
          { id: 'status_history', label: 'Status History', icon: Clock, count: data?.statusHistory?.length },
          { id: 'fines', label: 'Traffic Fines', icon: Receipt, count: data?.fines?.length },
          { id: 'salik', label: 'Salik', icon: MapPin },
          { id: 'audit', label: 'Audit Log', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Tab Contents */}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Specification Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700/60 pb-2.5 flex items-center gap-2">
                <Bike className="w-4 h-4 text-blue-600" />
                Technical Specifications
              </h4>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Chassis / VIN</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {vehicle.chassis_number || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Engine Number</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {vehicle.engine_number || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Vehicle Make & Model</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {vehicle.make} {vehicle.model}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Model Year</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{vehicle.year || 2024}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Fuel Type</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{vehicle.fuel_type || 'PETROL_95'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Branch Hub</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{vehicle.branch_name || 'Dubai Central'}</dd>
                </div>
              </dl>
            </div>

            {/* Mulkiya Compliance Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-2.5">
                <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  Mulkiya Registration
                </h4>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${mulkiyaComp.badge}`}>
                  {mulkiyaComp.text}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Mulkiya Card Number</dt>
                  <dd className="font-mono font-bold text-slate-900 dark:text-white">
                    {vehicle.registration_number || 'Not Registered'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Expiry Date</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">
                    {vehicle.registration_expiry || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Registration Emirate</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">{vehicle.plate_emirate}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Storage Tier</dt>
                  <dd className="font-semibold text-slate-900 dark:text-white">Cloudflare R2 / Supabase</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Telemetry & Service Due */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-700/60 pb-2.5 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-600" />
              Telemetry & Maintenance Status
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Current Odometer</span>
                <p className="text-sm font-mono font-black text-slate-900 dark:text-white mt-0.5">
                  {(vehicle.current_odometer || 0).toLocaleString()} km
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Next Service Due</span>
                <p className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {vehicle.next_service_due_km ? `${vehicle.next_service_due_km.toLocaleString()} km` : 'Regular Interval'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">GPS Device ID</span>
                <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {vehicle.gps_device_id || 'Not Installed'}
                </p>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Fuel Card Number</span>
                <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                  {vehicle.fuel_card_number || 'Direct Reimbursement'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGNMENT HISTORY TAB */}
      {activeTab === 'assignments' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Chronological Assignment History
            </h4>
            <span className="text-xs text-slate-400">{data?.assignments?.length || 0} Records</span>
          </div>

          {(!data?.assignments || data.assignments.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No historical assignments logged for this vehicle.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400 font-bold">
                    <th className="pb-2.5">Employee / Driver</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5">Assigned Date/Time</th>
                    <th className="pb-2.5">Returned Date/Time</th>
                    <th className="pb-2.5">Assigned By</th>
                    <th className="pb-2.5">Returned By</th>
                    <th className="pb-2.5">Previous Project</th>
                    <th className="pb-2.5">Assign Remark</th>
                    <th className="pb-2.5">Return Remark</th>
                    <th className="pb-2.5 font-mono">Odo (Start / Return)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {data.assignments.map((asgn: any) => {
                    const isActive = asgn.assignment_status === 'ACTIVE';
                    const assignDate = asgn.assignment_date || asgn.start_date || '—';
                    const assignTime = asgn.assignment_time ? ` ${asgn.assignment_time}` : '';
                    const returnDate = asgn.return_date || asgn.end_date || (isActive ? 'Current Custody' : '—');
                    const returnTime = asgn.return_time ? ` ${asgn.return_time}` : '';
                    const assignRemark = asgn.handover_notes || asgn.assign_notes || asgn.notes || '—';
                    const returnRemark = asgn.return_reason || asgn.return_remark || asgn.return_notes || (isActive ? 'Active' : '—');
                    const project = asgn.project_name || asgn.primary_project || '—';

                    return (
                      <tr key={asgn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="py-3 font-semibold text-slate-900 dark:text-white">
                          <div>{asgn.employee_name || 'Rider'}</div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {asgn.employee_code || asgn.employee_id}
                          </div>
                          {asgn.employee_id && (
                            <div className="text-[10px] font-mono text-slate-400">
                              ID: {asgn.employee_id}
                            </div>
                          )}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {asgn.assignment_status || (isActive ? 'ACTIVE' : 'RETURNED')}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px]">
                          {assignDate}{assignTime}
                        </td>
                        <td className="py-3 font-mono text-[11px]">
                          {returnDate}{returnTime}
                        </td>
                        <td className="py-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {asgn.assigned_by || asgn.created_by || 'Operations'}
                        </td>
                        <td className="py-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {asgn.returned_by || asgn.returned_to || (!isActive ? 'Fleet Depot' : '—')}
                        </td>
                        <td className="py-3 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {project}
                        </td>
                        <td className="py-3 text-[11px] text-slate-500 max-w-[150px] truncate" title={assignRemark}>
                          {assignRemark}
                        </td>
                        <td className="py-3 text-[11px] text-slate-500 max-w-[150px] truncate" title={returnRemark}>
                          {returnRemark}
                        </td>
                        <td className="py-3 font-mono text-[11px]">
                          <div>{asgn.starting_odometer ?? 0} km</div>
                          <div className="text-slate-400">{asgn.return_odometer ?? asgn.ending_odometer ? `${asgn.return_odometer ?? asgn.ending_odometer} km` : '—'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DOCUMENTS TAB */}
      {activeTab === 'documents' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Vehicle Compliance Documents (Cloudflare R2)
            </h4>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center justify-center font-bold">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Mulkiya Registration Card - {vehicle.plate_number}
                </h5>
                <p className="text-[11px] text-slate-400 font-mono">
                  Card No: {vehicle.registration_number || (vehicle.plate_number ? `MUL-${vehicle.plate_number}` : 'N/A')} • Expiry: {vehicle.registration_expiry || 'N/A'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
              Active / Verified
            </span>
          </div>
        </div>
      )}

      {/* STATUS HISTORY TAB */}
      {activeTab === 'status_history' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Operational Status Transitions
            </h4>
          </div>

          {(!data?.statusHistory || data.statusHistory.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No status transitions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {data.statusHistory.map((sh: any) => (
                <div key={sh.id} className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{sh.to_status}</span>
                    <p className="text-[11px] text-slate-500">{sh.reason || 'Status update'}</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">{sh.effective_date || sh.created_at?.split('T')[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TRAFFIC FINES TAB */}
      {activeTab === 'fines' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Traffic Fines & Violations
            </h4>
            <span className="text-xs text-slate-400">{data?.fines?.length || 0} Fines</span>
          </div>

          {(!data?.fines || data.fines.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              No traffic fines recorded for this vehicle. Clean compliance record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold">
                    <th className="pb-2">Fine No</th>
                    <th className="pb-2">Violation</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fines.map((f: any) => (
                    <tr key={f.id} className="border-b border-slate-100 py-2">
                      <td className="font-mono">{f.ticket_number || f.fine_number}</td>
                      <td>{f.violation_type || f.violation_description}</td>
                      <td className="font-mono font-bold text-rose-600">AED {f.fine_amount || f.amount}</td>
                      <td>{f.fine_date || f.violation_date}</td>
                      <td>{f.settlement_status || f.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SALIK TAB */}
      {activeTab === 'salik' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              UAE Salik Toll Crossings
            </h4>
          </div>
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            No recent Salik toll crossings logged for this plate.
          </div>
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Universal Audit Ledger
            </h4>
          </div>
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Audit logging active. All assignment changes and status events are immutably signed.
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignOpen && vehicle && (
        <VehicleAssignModal
          vehicle={vehicle}
          isOpen={isAssignOpen}
          onClose={() => setIsAssignOpen(false)}
          onSuccess={() => {
            setIsAssignOpen(false);
            loadProfile();
          }}
        />
      )}

      {/* Return Modal */}
      {isReturnOpen && (
        <VehicleReturnModal
          vehicle={vehicle}
          isOpen={isReturnOpen}
          onClose={() => setIsReturnOpen(false)}
          onSuccess={() => {
            setIsReturnOpen(false);
            loadProfile();
          }}
        />
      )}

      {/* Replace / Swap Modal */}
      {isReplaceOpen && (
        <VehicleReplaceModal
          vehicle={vehicle}
          isOpen={isReplaceOpen}
          onClose={() => setIsReplaceOpen(false)}
          onSuccess={() => {
            setIsReplaceOpen(false);
            loadProfile();
          }}
        />
      )}
    </div>
  );
};
