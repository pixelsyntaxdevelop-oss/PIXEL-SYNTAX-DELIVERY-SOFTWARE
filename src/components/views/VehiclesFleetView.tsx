import React, { useState, useEffect, useCallback } from 'react';
import {
  Bike,
  Car,
  Truck,
  Plus,
  RefreshCw,
  Eye,
  UserCheck,
  RotateCcw,
  ArrowRightLeft,
  Gauge,
  Edit,
  SlidersHorizontal,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Calendar,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Search,
  X,
  Clock,
  Layers,
  UploadCloud,
  MapPin,
} from 'lucide-react';
import { Vehicle } from '../../types/erp';
import { DbVehicleMasterEnhanced, VehicleKPIStats, VehicleOperationalStatus, VehicleFilters } from '../../types/fleet';
import { fleetService } from '../../services/fleetService';
import { Vehicle360ProfileModal } from '../fleet/Vehicle360ProfileModal';
import { VehicleAssignModal } from '../fleet/VehicleAssignModal';
import { VehicleReturnModal } from '../fleet/VehicleReturnModal';
import { VehicleReplaceModal } from '../fleet/VehicleReplaceModal';
import { ChangeVehicleStatusModal } from '../fleet/ChangeVehicleStatusModal';
import { VehicleOdometerModal } from '../fleet/VehicleOdometerModal';
import { VehicleFormModal } from '../fleet/VehicleFormModal';
import { VehicleImportModal } from '../fleet/VehicleImportModal';
import { ReturnVehicleToVendorModal } from '../fleet/ReturnVehicleToVendorModal';
import { VehicleLocationModal } from '../fleet/VehicleLocationModal';

/** Fleet list display only: vendor names come from saved asset metadata, never guessed. */
const displayLeaseProvider = (savedValue?: string | null): string => {
  const raw = String(savedValue || '').trim();
  if (/^easy\s*lease(?:\s+rental)?$/i.test(raw)) return 'EasyLease';
  if (/^power\s*lease$/i.test(raw)) return 'Power Lease';
  if (/^raid\s*lease$/i.test(raw)) return 'Raid Lease';
  if (!raw || /^(leased?\s*(?:vehicle|bike)?|rented|vendor(?:\s*supplied)?|allied\s*(?:delivery|fleet).*)$/i.test(raw)) {
    return 'Vendor not recorded';
  }
  return raw;
};

const displayFleetOwner = (vehicle: DbVehicleMasterEnhanced): string => {
  const kind = String(vehicle.ownership_type || '').trim().toUpperCase();
  if (['OWNED', 'OWN VEHICLE', 'COMPANY OWNED'].includes(kind)) return 'Own Vehicle';
  return displayLeaseProvider(vehicle.owner_or_vendor || vehicle.vendor || vehicle.insurance_company);
};

interface VehiclesFleetViewProps {
  vehicles?: Vehicle[];
  onAddVehicle?: (veh: any) => void;
  lang: 'EN' | 'AR';
  onNavigate?: (route: string) => void;
}

export const VehiclesFleetView: React.FC<VehiclesFleetViewProps> = ({ lang, onNavigate }) => {
  // Data State
  const [vehicles, setVehicles] = useState<DbVehicleMasterEnhanced[]>([]);
  const [kpis, setKpis] = useState<VehicleKPIStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [vendorFilter, setVendorFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [ownershipFilter, setOwnershipFilter] = useState('All');

  // Modal State
  const [selectedVehicle, setSelectedVehicle] = useState<DbVehicleMasterEnhanced | null>(null);
  const [selected360VehicleId, setSelected360VehicleId] = useState<string | null>(null);
  const [is360Open, setIs360Open] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [isChangeStatusOpen, setIsChangeStatusOpen] = useState(false);
  const [isOdometerOpen, setIsOdometerOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isReturnToVendorOpen, setIsReturnToVendorOpen] = useState(false);
  const [isLocationOpen, setIsLocationOpen] = useState(false);

  // Search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load data callback
  const loadFleetData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: VehicleFilters = {
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        state: stateFilter !== 'All' ? stateFilter : undefined,
        vendor: vendorFilter !== 'All' ? vendorFilter : undefined,
        type: typeFilter !== 'All' ? typeFilter : undefined,
        ownership: ownershipFilter !== 'All' ? ownershipFilter : undefined,
        page,
        pageSize,
      };

      const [pagedRes, kpiData] = await Promise.all([
        fleetService.getVehiclesPaginated(filters),
        fleetService.getKPIs(),
      ]);

      setVehicles(pagedRes.items || []);
      setTotal(pagedRes.total || 0);
      setTotalPages(pagedRes.totalPages || 1);
      setKpis(kpiData);
    } catch (err: any) {
      console.error('Failed to load fleet data:', err);
      setError(err?.message || 'Operational database unreachable. Fail closed active: no fallback data loaded.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, stateFilter, vendorFilter, typeFilter, ownershipFilter, page, pageSize]);

  useEffect(() => {
    loadFleetData();
  }, [loadFleetData]);

  // Reset page when filters change
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('All');
    setStateFilter('All');
    setVendorFilter('All');
    setTypeFilter('All');
    setOwnershipFilter('All');
    setPage(1);
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    statusFilter !== 'All' ||
    stateFilter !== 'All' ||
    vendorFilter !== 'All' ||
    typeFilter !== 'All' ||
    ownershipFilter !== 'All';

  // Export to CSV
  const handleExportCsv = async () => {
    try {
      // Fetch current filtered full list without pagination limits for accurate export
      const fullList = await fleetService.getVehicles({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter !== 'All' ? statusFilter : undefined,
        state: stateFilter !== 'All' ? stateFilter : undefined,
        vendor: vendorFilter !== 'All' ? vendorFilter : undefined,
        type: typeFilter !== 'All' ? typeFilter : undefined,
        ownership: ownershipFilter !== 'All' ? ownershipFilter : undefined,
      });

      const headers = [
        'Vehicle ID',
        'Plate Number',
        'Plate Code',
        'Plate Emirate',
        'Reporting State',
        'Make',
        'Model',
        'Year',
        'Type',
        'Status',
        'Assigned Rider',
        'Rider Code',
        'Project',
        'Branch',
        'Odometer (km)',
        'Next Service Due (km)',
        'Mulkiya Expiry',
        'Vendor / Owner',
        'Ownership Type',
      ];

      const rows = fullList.map((v) => [
        `"${v.vehicle_code || v.id}"`,
        `"${v.plate_number}"`,
        `"${v.plate_code || ''}"`,
        `"${v.plate_emirate}"`,
        `"${v.location_state || 'Not set'}"`,
        `"${v.make}"`,
        `"${v.model}"`,
        v.year || '',
        `"${v.vehicle_type}"`,
        `"${v.current_status}"`,
        `"${v.current_rider_name || 'Unassigned'}"`,
        `"${v.current_rider_code || ''}"`,
        `"${v.project_name || ''}"`,
        `"${v.branch_name || ''}"`,
        v.current_odometer || 0,
        v.next_service_due_km || '',
        `"${v.registration_expiry || ''}"`,
        `"${displayFleetOwner(v)}"`,
        `"${v.ownership_type || ''}"`,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `fleet_vehicles_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export CSV failed:', err);
    }
  };

  // Helper styling for Vehicle Type icon
  const getVehicleIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'motorcycle':
      case 'bike':
        return <Bike className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'van':
      case 'truck':
        return <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />;
      default:
        return <Car className="w-4 h-4 text-slate-600 dark:text-slate-400" />;
    }
  };

  // Helper styling for Operational Status Badge
  const renderStatusBadge = (status: VehicleOperationalStatus | string) => {
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
      case 'In Garage':
      case 'In Garage / Maintenance':
      case 'Repair':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            In Maintenance
          </span>
        );
      case 'Returned to Vendor':
      case 'Returned':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Returned to Vendor
          </span>
        );
      case 'Out of Service':
      case 'Decommissioned':
      case 'Sold':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Out of Service
          </span>
        );
      case 'Accident':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Accident
          </span>
        );
      case 'Inactive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-zinc-100 text-zinc-600 border border-zinc-300 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Inactive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  // Compliance Calculation for Mulkiya
  const getMulkiyaCompliance = (expiryDate?: string) => {
    if (!expiryDate) return { text: 'Not Registered', badge: 'bg-slate-100 text-slate-600 border-slate-200', days: 0 };
    const now = new Date();
    const exp = new Date(expiryDate);
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (days < 0) {
      return {
        text: `Expired ${Math.abs(days)}d ago`,
        badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        days,
      };
    }
    if (days <= 30) {
      return {
        text: `Expiring (${days}d)`,
        badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        days,
      };
    }
    return {
      text: `Valid (${days}d)`,
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      days,
    };
  };

  // Keep vendor options for the compact filter dropdown
  const vendorBreakdownDetailed = kpis?.vendorBreakdownDetailed || {};
  const reportingStateEntries = Object.entries(kpis?.stateBreakdownDetailed || {})
    .filter(([, counts]) => counts.total > 0)
    .sort(([a], [b]) => {
      const order = ['Dubai', 'Abu Dhabi', 'Al Ain', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Not set'];
      return (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)) || a.localeCompare(b);
    });

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Page Header & Top-Right Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Vehicle Management
            </h1>
            <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              Live Fleet Operations
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time fleet operations, assignment tracking, compliance monitoring, and authenticated audit logs.
          </p>
        </div>

        {/* Top-Right Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Vehicles</span>
          </button>

          <button
            onClick={() => setIsImportOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import fleet vehicles from CSV or XLSX"
          >
            <UploadCloud className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Import Vehicles</span>
          </button>

          <button
            onClick={loadFleetData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-slate-300 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setSelectedVehicle(null);
              setIsAssignOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <UserCheck className="w-4 h-4" />
            <span>Assign Vehicle</span>
          </button>

          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate('/vehicles/create');
              } else {
                setSelectedVehicle(null);
                setIsFormOpen(true);
              }
            }}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Vehicle</span>
          </button>
        </div>
      </div>

      {/* Database Error Banner (Fail Closed) */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-bold">System Connection Notice: </span>
            <span>{error}</span>
          </div>
          <button
            onClick={loadFleetData}
            className="px-3 py-1 bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-800 dark:text-rose-200 font-semibold text-xs rounded-lg transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* 2. Compact Live Summary (4 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Vehicles */}
        <button
          onClick={() => handleFilterChange(setStatusFilter, 'All')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'All'
              ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/20 dark:bg-blue-950/20 dark:border-blue-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
            Total Vehicles
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {kpis?.totalVehicles ?? total}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            {kpis?.utilizationRate ?? 0}% active fleet rate
          </span>
        </button>

        {/* Assigned */}
        <button
          onClick={() => handleFilterChange(setStatusFilter, 'Assigned')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Assigned'
              ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-500/20 dark:bg-blue-950/20 dark:border-blue-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
            Assigned
          </span>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {kpis?.assignedVehicles ?? 0}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Active with Captains
          </span>
        </button>

        {/* Available */}
        <button
          onClick={() => handleFilterChange(setStatusFilter, 'Available')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Available'
              ? 'bg-emerald-50/50 border-emerald-400 ring-2 ring-emerald-500/20 dark:bg-emerald-950/20 dark:border-emerald-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Available
          </span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {kpis?.availableVehicles ?? 0}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Ready in depot / hub
          </span>
        </button>

        {/* Returned to Vendor — separate operational inventory section */}
        <button
          onClick={() => handleFilterChange(setStatusFilter, 'Returned to Vendor')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            statusFilter === 'Returned to Vendor'
              ? 'bg-violet-50/50 border-violet-400 ring-2 ring-violet-500/20 dark:bg-violet-950/20 dark:border-violet-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 block">
            Returned to Vendor
          </span>
          <p className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">
            {kpis?.returnedToVendorVehicles ?? 0}
          </p>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
            Returned bikes • Not assignable
          </span>
        </button>


      </div>

      {/* Reporting State counts use saved vehicle.location_state, never plate_emirate. */}
      <section aria-label="Reporting State breakdown" className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Reporting State</h2>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Select a state to filter vehicles</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          <button type="button" onClick={() => handleFilterChange(setStateFilter, 'All')}
            aria-pressed={stateFilter === 'All'}
            className={`min-h-24 rounded-2xl border p-4 text-left transition-all ${stateFilter === 'All'
              ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/30'
              : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900'}`}>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">All reporting states</span>
            <span className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">{kpis?.totalVehicles ?? 0}</span>
            <span className="text-[11px] text-slate-500">Vehicles</span>
          </button>
          {reportingStateEntries.map(([state, counts]) => (
            <button key={state} type="button" onClick={() => handleFilterChange(setStateFilter, state)}
              aria-pressed={stateFilter === state}
              className={`min-h-24 rounded-2xl border p-4 text-left transition-all ${stateFilter === state
                ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500/20 dark:bg-blue-950/30'
                : 'border-slate-200 bg-white hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900'}`}>
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                <MapPin className="h-3.5 w-3.5 text-blue-500" />{state}
              </span>
              <span className="mt-2 block text-2xl font-black text-slate-900 dark:text-white">{counts.total}</span>
              <span className="text-[11px] text-slate-500">{counts.assigned} assigned · {counts.available} available</span>
            </button>
          ))}
        </div>
      </section>

      {/* 3. Search and Filter Bar — state and vendor filters remain available below */}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Plate (e.g. 72154), Make, Model, VIN, Rider Name, Rider Code, or Vendor..."
              className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 pl-10 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown Filters Row */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase text-[10px]">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="All">All Operational Statuses</option>
            <option value="Available">Available (In Depot)</option>
            <option value="Assigned">Assigned (Active with Captain)</option>
            <option value="In Maintenance">In Garage / Maintenance</option>
            <option value="Returned to Vendor">Returned to Vendor</option>
            <option value="Out of Service">Out of Service</option>
            <option value="Accident">Accident</option>
            <option value="Inactive">Inactive</option>
          </select>

          {/* Reporting State Filter (saved operational location, not plate emirate) */}
          <select
            value={stateFilter}
            onChange={(e) => handleFilterChange(setStateFilter, e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="All">All Reporting States</option>
            <option value="Not set">Not set</option>
            <option value="Dubai">Dubai</option>
            <option value="Abu Dhabi">Abu Dhabi</option>
            <option value="Al Ain">Al Ain</option>
            <option value="Sharjah">Sharjah</option>
            <option value="Ajman">Ajman</option>
            <option value="Ras Al Khaimah">Ras Al Khaimah</option>
            <option value="Fujairah">Fujairah</option>
            <option value="Umm Al Quwain">Umm Al Quwain</option>
          </select>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => handleFilterChange(setVendorFilter, e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="All">All Vendors / Owners</option>
            {Object.keys(vendorBreakdownDetailed).map((v) => (
              <option key={v} value={v}>
                {displayLeaseProvider(v) === 'Vendor not recorded' && /allied/i.test(v) ? 'Own Vehicle' : displayLeaseProvider(v)} ({vendorBreakdownDetailed[v].total})
              </option>
            ))}
          </select>

          {/* Vehicle Type */}
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="All">All Types</option>
            <option value="Motorcycle">Motorcycle</option>
            <option value="Van">Delivery Van</option>
            <option value="Car">Car</option>
            <option value="Truck">Truck</option>
          </select>

          {/* Ownership */}
          <select
            value={ownershipFilter}
            onChange={(e) => handleFilterChange(setOwnershipFilter, e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="All">All Ownership</option>
            <option value="OWNED">Company Owned</option>
            <option value="LEASED">Leased</option>
            <option value="VENDOR_SUPPLIED">Vendor Supplied</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 ml-auto"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Phone-first fleet cards: no sideways scrolling to reach key actions. */}
      <div className="md:hidden space-y-3">
        {loading && vehicles.length === 0 ? (
          <div className="rounded-xl border p-6 text-center text-sm text-slate-500">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="rounded-xl border p-6 text-center text-sm text-slate-500">No vehicles found for these filters.</div>
        ) : vehicles.map((v) => (
          <div key={v.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-black text-slate-900 dark:text-white">{v.plate_emirate || 'Dubai'} {v.plate_code || ''} {v.plate_number}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">{v.make} {v.model}</div>
              </div>
              <div className="shrink-0">{renderStatusBadge(v.current_status)}</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
              <div><span className="block text-slate-500">Current rider</span><span className="font-semibold text-slate-800 dark:text-slate-100">{v.current_rider_name || 'No current rider'}</span>{(v.last_rider_name || v.last_assignment_employee_name) && <div className="mt-1 text-slate-500">Last assigned to: <span className="font-semibold">{v.last_rider_name || v.last_assignment_employee_name}</span></div>}</div>
              <div><span className="block text-slate-500">Vendor / Owner</span><span className="text-sm font-black text-slate-800 dark:text-slate-100">{displayFleetOwner(v)}</span></div>
              <div className="col-span-2"><span className="block text-slate-500">Reporting State</span><span className="inline-flex whitespace-nowrap font-semibold text-slate-800 dark:text-slate-100">{v.location_state || 'Not set'}</span></div>
              <div><span className="block text-slate-500">Project</span><span className="font-semibold text-slate-800 dark:text-slate-100">{v.project_name || 'No project'}</span></div>
              <div><span className="block text-slate-500">Mulkiya expiry</span><span className="font-semibold text-slate-800 dark:text-slate-100">{v.registration_expiry || 'Not registered'}</span></div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {v.current_status === 'Available' && (
                <button type="button" className="min-h-11 rounded-xl bg-blue-600 px-3 text-sm font-bold text-white" onClick={() => { setSelectedVehicle(v); setIsAssignOpen(true); }}>Assign rider</button>
              )}
              {v.current_status === 'Assigned' && (
                <button type="button" className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-bold text-amber-800" onClick={() => { setSelectedVehicle(v); setIsReturnOpen(true); }}>Return from rider</button>
              )}
              {v.current_status === 'Available' && (
                <button type="button" className="min-h-11 rounded-xl border border-rose-300 bg-rose-50 px-3 text-sm font-bold text-rose-800" onClick={() => { setSelectedVehicle(v); setIsReturnToVendorOpen(true); }}>Return to vendor</button>
              )}
              <button type="button" className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-bold text-blue-800" onClick={() => { if (onNavigate) onNavigate(`/vehicles/${v.id}`); else { setSelected360VehicleId(v.id); setIs360Open(true); } }}>View history / 360</button>
              <button type="button" className="min-h-11 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 dark:border-blue-800 dark:bg-slate-800 dark:text-blue-200" onClick={() => { setSelectedVehicle(v); setIsLocationOpen(true); }}>Set reporting state</button>
              <button type="button" className="min-h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-600" onClick={() => { setSelectedVehicle(v); setIsFormOpen(true); }}>Edit details</button>
            </div>
          </div>
        ))}
      </div>

      {/* 5. Dense, High-Information Vehicle Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[1280px] text-left text-xs border-collapse">
            <thead className="bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Vehicle / Plate</th>
                <th className="py-3 px-3.5">Make & Model</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="min-w-[126px] whitespace-nowrap py-3 px-3.5">Reporting State</th>
                <th className="py-3 px-3.5">Current Employee</th>
                <th className="py-3 px-3.5">Current Project</th>
                <th className="py-3 px-3.5">Ownership / Vendor</th>
                <th className="py-3 px-3.5">Mulkiya Expiry</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && vehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Fetching live fleet database...</span>
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <div className="max-w-xs mx-auto text-slate-400 dark:text-slate-500">
                      <Bike className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">No vehicles found</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        Try adjusting your search criteria or register a new vehicle.
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={handleResetFilters}
                          className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => {
                  const mulkiya = getMulkiyaCompliance(v.registration_expiry);

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* 1. Vehicle / Plate */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-start gap-2.5">
                          {/* UAE Plate Graphic Pill */}
                          <div className="shrink-0 border border-slate-800 dark:border-slate-300 rounded-md overflow-hidden bg-white text-slate-900 font-mono text-[11px] shadow-xs">
                            <div className="bg-slate-800 dark:bg-slate-700 text-white text-[9px] font-bold px-1.5 py-0.2 text-center tracking-wider">
                              {v.plate_emirate?.toUpperCase() || 'DUBAI'}
                            </div>
                            <div className="px-2 py-0.5 font-black text-center text-xs tracking-tight flex items-center justify-center gap-1">
                              {v.plate_code && <span className="text-slate-500 font-bold">{v.plate_code}</span>}
                              <span>{v.plate_number}</span>
                            </div>
                          </div>
                          <div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                              {v.plate_number}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                              {v.chassis_number ? `VIN: ${v.chassis_number}` : v.vehicle_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Make & Model */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 dark:text-white text-xs">
                          {v.make} {v.model}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <span>Year {v.year || '2024'}</span>
                          <span>•</span>
                          <span>{v.vehicle_type || 'Motorcycle'}</span>
                        </div>
                      </td>

                      {/* 3. Status */}
                      <td className="py-3 px-3.5">
                        <div>{renderStatusBadge(v.current_status)}</div>
                        {v.status_reason && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[130px] mt-0.5" title={v.status_reason}>
                            {v.status_reason}
                          </div>
                        )}
                      </td>

                      {/* Saved reporting state — independent of number-plate registration. */}
                      <td className="min-w-[126px] whitespace-nowrap py-3 px-3.5">
                        <span className="inline-flex whitespace-nowrap rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 dark:bg-slate-800 dark:text-sky-200">
                          {v.location_state || 'Not set'}
                        </span>
                      </td>

                      {/* 4. Current Employee / Last Assignment */}
                      <td className="py-3 px-3.5">
                        {v.current_rider_name ? (
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                              <span className="truncate max-w-[140px]">{v.current_rider_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                              {v.current_rider_code || 'Assigned'}
                            </div>
                            {(v.last_rider_name || v.last_assignment_employee_name) && (
                              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Last assigned to: <span className="font-semibold">{v.last_rider_name || v.last_assignment_employee_name}</span>
                                {(v.last_rider_code || v.last_assignment_employee_code) && <span className="ml-1 font-mono">({v.last_rider_code || v.last_assignment_employee_code})</span>}
                              </div>
                            )}
                          </div>
                        ) : (v.last_rider_name || v.last_assignment_employee_name) ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {v.current_status === 'Available' ? 'Available • In Depot' : 'Last Assignment'}
                            </span>
                            <div className="text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Last: </span>
                              <span className="font-semibold">{v.last_rider_name || v.last_assignment_employee_name}</span>
                              {(v.last_rider_code || v.last_assignment_employee_code) && (
                                <span className="font-mono text-[10px] text-slate-400 ml-1">
                                  ({v.last_rider_code || v.last_assignment_employee_code})
                                </span>
                              )}
                            </div>
                            {(v.last_returned_date || v.last_assignment_return_date) && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Ret: {v.last_returned_date || v.last_assignment_return_date}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                            {v.current_status === 'Available' ? 'Available • In Depot' : v.current_status}
                          </span>
                        )}
                      </td>

                      {/* 5. Current Project */}
                      <td className="py-3 px-3.5">
                        {v.project_name ? (
                          <span className="inline-block text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md">
                            {v.project_name}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No Project</span>
                        )}
                      </td>

                      {/* 6. Real leasing company, or Own Vehicle for company bikes. */}
                      <td className="min-w-[120px] whitespace-nowrap py-3 px-3.5">
                        <span className="text-sm font-black text-slate-800 dark:text-slate-100" title={displayFleetOwner(v)}>
                          {displayFleetOwner(v)}
                        </span>
                      </td>

                      {/* 7. Mulkiya Expiry (NO Insurance!) */}
                      <td className="py-3 px-3.5">
                        <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {v.registration_expiry || 'Not Registered'}
                        </div>
                        <div className="mt-1">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${mulkiya.badge}`}>
                            {mulkiya.text}
                          </span>
                        </div>
                      </td>

                      {/* 8. Actions */}
                      <td className="py-3 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Assign only confirmed depot bikes; reassign only genuine active custody. */}
                          {(v.current_status === 'Available' || v.current_status === 'Assigned') && (
                          <button
                            onClick={() => {
                              setSelectedVehicle(v);
                              setIsAssignOpen(true);
                            }}
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center gap-1 cursor-pointer ${
                              v.current_status === 'Assigned'
                                ? 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                : 'text-white bg-blue-600 hover:bg-blue-700'
                            }`}
                            title={v.current_status === 'Assigned' ? 'Reassign to Employee / Rider' : 'Assign to Employee / Rider'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{v.current_status === 'Assigned' ? 'Reassign' : 'Assign'}</span>
                          </button>
                          )}

                          {v.current_status === 'Assigned' ? (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsReturnOpen(true);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Return Vehicle from Rider to Fleet Depot"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Return</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedVehicle(v);
                                  setIsReplaceOpen(true);
                                }}
                                className="px-2 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Swap Vehicle"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                                <span>Swap</span>
                              </button>
                            </>
                          ) : v.current_status === 'Available' ? (
                            <button
                              onClick={() => {
                                setSelectedVehicle(v);
                                setIsReturnToVendorOpen(true);
                              }}
                              className="px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Return Leased Bike to Vendor / Supplier (Easylease, Raid Lease, etc.)"
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>To Vendor</span>
                            </button>
                          ) : null}

                          {/* View 360 */}
                          <button
                            onClick={() => {
                              if (onNavigate) {
                                onNavigate(`/vehicles/${v.id}`);
                              } else {
                                setSelected360VehicleId(v.id);
                                setIs360Open(true);
                              }
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors flex items-center gap-1"
                            title="360° Profile & Lifecycle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>360</span>
                          </button>

                          {/* Reporting state editor; available for every registered bike. */}
                          <button
                            type="button"
                            onClick={() => { setSelectedVehicle(v); setIsLocationOpen(true); }}
                            className="min-h-9 rounded-lg border border-sky-200 bg-sky-50 px-2 text-[11px] font-bold text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
                            title="Edit reporting state"
                          >
                            Set State
                          </button>

                          {/* Edit Master */}
                          <button
                            onClick={() => {
                              setSelectedVehicle(v);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Vehicle Master Record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Server-Side Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
            <span>
              Showing <strong className="text-slate-800 dark:text-slate-200">{total > 0 ? (page - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="text-slate-800 dark:text-slate-200">{Math.min(page * pageSize, total)}</strong> of{' '}
              <strong className="text-slate-800 dark:text-slate-200">{total}</strong> vehicles
            </span>

            <div className="flex items-center gap-1.5">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold focus:ring-1 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {/* Page Pill Indicators */}
            <span className="px-3 py-1 text-xs font-bold text-slate-700 dark:text-slate-300">
              Page {page} of {totalPages || 1}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {isLocationOpen && selectedVehicle && (
        <VehicleLocationModal
          vehicle={selectedVehicle}
          onClose={() => { setIsLocationOpen(false); setSelectedVehicle(null); }}
          onSuccess={loadFleetData}
        />
      )}

      {/* 1. Register / Edit Vehicle Form Modal */}
      {isFormOpen && (
        <VehicleFormModal
          vehicle={selectedVehicle}
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 2. Assign Rider Modal */}
      {isAssignOpen && (
        <VehicleAssignModal
          vehicle={selectedVehicle}
          isOpen={isAssignOpen}
          vehiclesList={vehicles}
          onClose={() => {
            setIsAssignOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 3. Return Vehicle Modal */}
      {isReturnOpen && selectedVehicle && (
        <VehicleReturnModal
          vehicle={selectedVehicle}
          isOpen={isReturnOpen}
          onClose={() => {
            setIsReturnOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 4. Atomic Replace / Swap Vehicle Modal */}
      {isReplaceOpen && selectedVehicle && (
        <VehicleReplaceModal
          currentVehicle={selectedVehicle}
          isOpen={isReplaceOpen}
          onClose={() => {
            setIsReplaceOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 5. Change Operational Status Modal */}
      {isChangeStatusOpen && selectedVehicle && (
        <ChangeVehicleStatusModal
          vehicle={selectedVehicle}
          isOpen={isChangeStatusOpen}
          onClose={() => {
            setIsChangeStatusOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 6. Update Odometer Modal */}
      {isOdometerOpen && selectedVehicle && (
        <VehicleOdometerModal
          vehicle={selectedVehicle}
          isOpen={isOdometerOpen}
          onClose={() => {
            setIsOdometerOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 7. 360 Profile & Complete History Modal */}
      {is360Open && selected360VehicleId && (
        <Vehicle360ProfileModal
          vehicleId={selected360VehicleId}
          isOpen={is360Open}
          onClose={() => {
            setIs360Open(false);
            setSelected360VehicleId(null);
          }}
          onRefreshList={() => {
            loadFleetData();
          }}
        />
      )}

      {/* 8. Vehicle Bulk Import Modal */}
      <VehicleImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          loadFleetData();
        }}
      />

      {/* 9. Return to Vendor Modal */}
      {isReturnToVendorOpen && selectedVehicle && (
        <ReturnVehicleToVendorModal
          vehicle={selectedVehicle}
          isOpen={isReturnToVendorOpen}
          onClose={() => {
            setIsReturnToVendorOpen(false);
            setSelectedVehicle(null);
          }}
          onSuccess={() => {
            loadFleetData();
          }}
        />
      )}
    </div>
  );
};
