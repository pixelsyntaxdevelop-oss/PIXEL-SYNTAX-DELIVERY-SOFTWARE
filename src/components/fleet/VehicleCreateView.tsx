import React, { useState, useEffect, useRef } from 'react';
import {
  Bike,
  Car,
  Truck,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Search,
  ChevronDown,
  X,
  FileText,
  ShieldAlert,
  Building2,
  Gauge,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
  Ban,
  Check,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { fleetService } from '../../services/fleetService';

import { VehicleType, VehicleCategory, OwnershipType, VehicleOperationalStatus, DbVehicleMasterEnhanced } from '../../types/fleet';

interface VehicleCreateViewProps {
  lang: 'EN' | 'AR';
  onNavigate: (route: string) => void;
}

const UAE_EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Umm Al Quwain',
  'Ras Al Khaimah',
  'Fujairah',
];

const VEHICLE_TYPES = [
  { value: 'Motorcycle', label: 'Motorcycle / Delivery Bike', icon: Bike },
  { value: 'Car', label: 'Sedan / Hatchback Car', icon: Car },
  { value: 'Van', label: 'Delivery Van', icon: Truck },
  { value: 'Truck', label: 'Commercial Truck', icon: Truck },
];

const BRANCH_OPTIONS = [
  'Dubai Central Hub (Al Quoz)',
  'Dubai South Operations Hub',
  'Abu Dhabi Industrial Depot (Musaffah)',
  'Sharjah Distribution Station',
  'Ajman Logistics Hub',
  'Ras Al Khaimah Depot',
];

export const VehicleCreateView: React.FC<VehicleCreateViewProps> = ({ lang, onNavigate }) => {
  // Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [plateCode, setPlateCode] = useState('T');
  const [plateEmirate, setPlateEmirate] = useState('Dubai');
  const [vehicleType, setVehicleType] = useState('Motorcycle');

  // Make & Model State
  const [makes, setMakes] = useState<{ id: string; name: string; vehicle_type?: string; active: boolean }[]>([]);
  const [selectedMake, setSelectedMake] = useState<{ id: string; name: string } | null>(null);
  const [makeSearch, setMakeSearch] = useState('');
  const [isMakeOpen, setIsMakeOpen] = useState(false);

  const [models, setModels] = useState<{ id: string; make_id: string; name: string; active: boolean }[]>([]);
  const [selectedModel, setSelectedModel] = useState<{ id: string; name: string } | null>(null);
  const [modelSearch, setModelSearch] = useState('');
  const [isModelOpen, setIsModelOpen] = useState(false);

  const [year, setYear] = useState<number | ''>('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [tcNumber, setTcNumber] = useState('');
  const [gpsDeviceId, setGpsDeviceId] = useState('');

  // Mulkiya
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [registrationExpiry, setRegistrationExpiry] = useState('');

  // Ownership
  const [ownershipType, setOwnershipType] = useState<'OWNED' | 'LEASED' | 'RENTED'>('OWNED');
  const [ownerOrVendor, setOwnerOrVendor] = useState('Pixel Syntax Delivery Software');
  const [branchName, setBranchName] = useState('Dubai Central Hub (Al Quoz)');
  const [currentOdometer, setCurrentOdometer] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');

  // Submission & Validation
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    success: boolean;
    totalSourceRows: number;
    readyToImport: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    totalVehiclesAfterImport: number;
    rowErrors: { rowNumber: number; plate_number: string; error: string }[];
    importedVehicles?: any[];
  } | null>(null);

  // Refs for click outside
  const makeDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      setSubmitting(true);
      setError(null);
      setCommitResult(null);
      try {
        const response = await fetch('/api/erp/fleet/bulk-import/validate', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        if (response.ok) {
          setValidationResult(data);
        } else {
          setError(data.error || 'Failed to validate file');
        }
      } catch (err: any) {
        setError(err.message || 'Error uploading file');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const getRowValidationInfo = (row: any) => {
    const isPlateDup = validationResult?.summary?.duplicates?.plates?.includes(row.plate_number);
    const isChassisDup = row.chassis_number && validationResult?.summary?.duplicates?.chassis?.includes(row.chassis_number);
    const isConflict = row.errors?.some((e: string) => e.toLowerCase().includes('already registered') || e.toLowerCase().includes('conflict')) ||
                       validationResult?.summary?.conflicts?.includes(row.rowNumber);
    const hasMissing = row.errors?.some((e: string) => e.toLowerCase().includes('missing')) ||
                       validationResult?.summary?.missing?.includes(row.rowNumber);

    if (isConflict) {
      return {
        status: 'CONFLICT',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
        message: row.errors?.length ? row.errors.join('; ') : 'Chassis VIN already registered in production fleet',
      };
    }
    if (isChassisDup) {
      return {
        status: 'ERROR',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        message: `Duplicate chassis '${row.chassis_number}' in uploaded file`,
      };
    }
    if (hasMissing || (row.errors && row.errors.length > 0)) {
      return {
        status: 'ERROR',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
        message: row.errors?.length ? row.errors.join('; ') : 'Missing required fields',
      };
    }
    if (isPlateDup) {
      return {
        status: 'VALID',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        message: `Plate '${row.plate_number}' shared with another vehicle (Allowed)`,
      };
    }
    return {
      status: 'VALID',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      message: 'Valid for import',
    };
  };

  const validRowsList = validationResult?.rows?.filter((r: any) => getRowValidationInfo(r).status === 'VALID') || [];
  const validCount = validRowsList.length;

  const handleCommitImport = async () => {
    if (!validationResult || !validationResult.rows) return;
    setIsConfirmDialogOpen(false);
    setCommitting(true);
    setError(null);
    try {
      const result = await fleetService.commitBulkImport(validationResult.rows);
      setCommitResult(result);
      // Immediately refetch vehicle management so newly imported vehicles appear immediately
      await fleetService.getVehicles();
    } catch (err: any) {
      setError(err.message || 'Import commit failed');
    } finally {
      setCommitting(false);
    }
  };


  // Load makes on mount (no default selection)
  useEffect(() => {
    const loadMakes = async () => {
      try {
        const data = await fleetService.getMakes();
        setMakes(data);
      } catch (err) {
        console.error('Failed to load makes:', err);
      }
    };
    loadMakes();
  }, []);

  // Load models whenever selected make changes (reset model when make changes)
  useEffect(() => {
    const loadModels = async () => {
      setSelectedModel(null);
      if (!selectedMake) {
        setModels([]);
        return;
      }
      try {
        const data = await fleetService.getModels({ make_id: selectedMake.id });
        setModels(data);
      } catch (err) {
        console.error('Failed to load models:', err);
      }
    };
    loadModels();
  }, [selectedMake]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (makeDropdownRef.current && !makeDropdownRef.current.contains(e.target as Node)) {
        setIsMakeOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setIsModelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered makes & models
  const filteredMakes = makes.filter((m) =>
    m.name.toLowerCase().includes(makeSearch.toLowerCase().trim())
  );
  const filteredModels = models.filter((m) =>
    m.name.toLowerCase().includes(modelSearch.toLowerCase().trim())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPlate = plateNumber.trim().toUpperCase();
    if (!cleanPlate) {
      setError('Plate Number is required.');
      return;
    }
    if (!selectedMake) {
      setError('Please select a Make / Brand from the master.');
      return;
    }
    if (!selectedModel) {
      setError('Please select a Model from the master.');
      return;
    }
    if (!year) {
      setError('Please select a manufacturing year between 2009 and 2028.');
      return;
    }

    setSubmitting(true);

    try {
      const payload: Partial<DbVehicleMasterEnhanced> = {
        plate_number: cleanPlate,
        plate_code: plateCode.trim().toUpperCase(),
        plate_emirate: plateEmirate,
        vehicle_type: vehicleType as VehicleCategory,
        make: selectedMake.name,
        model: selectedModel.name,
        year: Number(year),
        chassis_number: chassisNumber.trim().toUpperCase() || undefined,
        tc_number: tcNumber.trim().toUpperCase() || undefined,
        engine_number: tcNumber.trim().toUpperCase() || undefined,
        registration_number: registrationNumber.trim() || undefined,
        registration_expiry: registrationExpiry || undefined,
        ownership_type: ownershipType,
        owner_or_vendor:
          ownershipType === 'OWNED'
            ? 'Pixel Syntax Delivery Software'
            : ownerOrVendor.trim() || 'Vendor Lease Partner',
        branch_name: branchName,
        current_odometer: currentOdometer !== '' ? Number(currentOdometer) : 0,
        gps_device_id: gpsDeviceId.trim() || undefined,
        current_status: 'Available' as VehicleOperationalStatus,
        notes: notes.trim() || undefined,
      };

      const result = await fleetService.createVehicle(payload);

      if (result.success && result.vehicle) {
        setSuccessMsg(`Vehicle ${result.vehicle.plate_number} registered successfully!`);
        setTimeout(() => {
          onNavigate('/vehicles');
        }, 1200);
      } else {
        setError(result.error || 'Failed to register vehicle.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error creating vehicle.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* 1. Header Bar */}
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
                  Register Vehicle
                </h1>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
                  Fleet Master
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Add a vehicle to the company fleet master.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold transition-colors shadow-xs cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />
              <FileText className="w-4 h-4" />
              Upload Vehicle Data (XLSX / CSV)
            </label>
            <button
              type="button"
              onClick={() => window.open('/api/erp/fleet/bulk-import-template', '_blank')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-bold transition-colors shadow-xs"
            >
              <FileText className="w-4 h-4" />
              Download Import Template
            </button>
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
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Register Vehicle</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success / Error Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold">Registration Error</h4>
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

      {/* PRE-COMMIT PREVIEW UI (VALIDATION ONLY — NO DB WRITES) */}
      {validationResult && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-6 animate-in fade-in duration-200">
          {/* Header & Mode Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 uppercase tracking-wider">
                  Pre-Commit Validation Preview
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  Validation Only — No DB Writes
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review verified Excel file rows, duplicate checks, conflicts, and missing field validations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setValidationResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Clear Preview
              </button>
            </div>
          </div>

          {/* 1. SIX AUTHORITATIVE VALIDATION METRICS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Rows */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Total Rows
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {validationResult.summary?.totalRows ?? 0}
              </div>
            </div>

            {/* Valid Rows */}
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20">
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Valid Rows
              </div>
              <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                {validationResult.summary?.validRows ?? validationResult.summary?.valid ?? 0}
              </div>
            </div>

            {/* Duplicate Chassis */}
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20">
              <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                Duplicate Chassis
              </div>
              <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
                {validationResult.summary?.duplicateChassis ?? validationResult.summary?.duplicates?.chassis?.length ?? 0}
              </div>
            </div>

            {/* Existing Chassis Conflicts */}
            <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/20">
              <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                Existing Chassis Conflicts
              </div>
              <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">
                {validationResult.summary?.existingChassisConflicts ?? validationResult.summary?.existingConflicts ?? validationResult.summary?.conflicts?.length ?? 0}
              </div>
            </div>

            {/* Missing Required */}
            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/20">
              <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Missing Required
              </div>
              <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                {validationResult.summary?.missingRequired ?? validationResult.summary?.missing?.length ?? 0}
              </div>
            </div>

            {/* Ready To Import */}
            <div
              className={`p-3.5 rounded-xl border ${
                (validationResult.summary?.readyToImport ?? validationResult.summary?.validRows ?? 0) > 0
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-900/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider">
                Ready To Import
              </div>
              <div className="text-xl font-black mt-1">
                {validationResult.summary?.readyToImport ?? validationResult.summary?.validRows ?? 0}
              </div>
            </div>
          </div>

          {/* Informational notice for duplicate plates (Allowed by fleet business rule) */}
          {Boolean(validationResult.summary?.duplicatePlate) && (
            <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold">Informational Note:</span>
                <span>{validationResult.summary?.duplicatePlate} row(s) have shared plate numbers. In Allied fleet, plate numbers are not globally unique; import proceeds normally.</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/50 text-[11px] font-bold text-blue-700 dark:text-blue-200">
                Allowed
              </span>
            </div>
          )}

          {/* 2. ROW PREVIEW TABLE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Row Validation Details ({validationResult.rows?.length ?? 0} Rows)
              </h4>
              <div className="text-[11px] text-slate-400">
                Pre-commit validation summary per vehicle record
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                    <th className="px-3.5 py-2.5">Row #</th>
                    <th className="px-3.5 py-2.5">Plate Number</th>
                    <th className="px-3.5 py-2.5">Chassis Number</th>
                    <th className="px-3.5 py-2.5">Vehicle Type</th>
                    <th className="px-3.5 py-2.5">Working Status</th>
                    <th className="px-3.5 py-2.5">Validation Status</th>
                    <th className="px-3.5 py-2.5">Error / Warning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                  {validationResult.rows?.map((row: any, idx: number) => {
                    const valInfo = getRowValidationInfo(row);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-750 transition-colors">
                        <td className="px-3.5 py-2.5 font-mono text-slate-500 dark:text-slate-400 font-bold">
                          {row.rowNumber}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900 dark:text-white">
                          {row.plate_number ? `${row.plate_number} ${row.plate_code || ''}`.trim() : '—'}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-slate-600 dark:text-slate-300">
                          {row.chassis_number || '—'}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                          {row.vehicle_type || '—'}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {row.working_status || 'Active'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${valInfo.badgeClass}`}>
                            {valInfo.status}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 dark:text-slate-400 max-w-xs truncate" title={valInfo.message}>
                          {valInfo.message}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar / Confirm Import */}
          {!commitResult && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-900/30 -mx-6 -mb-6 p-4 rounded-b-2xl">
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  Validation complete: <span className="font-bold text-slate-900 dark:text-white">{validCount}</span> of {validationResult.summary?.totalRows || 0} rows ready for safe production import.
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setValidationResult(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={committing}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs"
                >
                  Clear Preview
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmDialogOpen(true)}
                  disabled={validCount === 0 || committing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Import ({validCount} Ready)</span>
                </button>
              </div>
            </div>
          )}

          {/* Final Result Display */}
          {commitResult && (
            <div className="mt-6 p-6 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200/60 dark:border-emerald-800/60">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Vehicle Bulk Import Complete
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Validated vehicles committed to Allied production master.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationResult(null);
                      setCommitResult(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Import Another File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/vehicles')}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-1.5"
                  >
                    <span>View Vehicle Management</span>
                  </button>
                </div>
              </div>

              {/* 6 Required Final Result Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                    TOTAL SOURCE ROWS
                  </div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
                    {commitResult.totalSourceRows}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400">
                    READY TO IMPORT
                  </div>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">
                    {commitResult.readyToImport}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
                    IMPORTED
                  </div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
                    {commitResult.importedCount}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                    SKIPPED DUPLICATES/CONFLICTS
                  </div>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">
                    {commitResult.skippedCount}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-rose-600 dark:text-rose-400">
                    FAILED
                  </div>
                  <div className="text-xl font-black text-rose-700 dark:text-rose-300 mt-1">
                    {commitResult.failedCount}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
                  <div className="text-[10px] font-bold tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                    TOTAL VEHICLES AFTER IMPORT
                  </div>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">
                    {commitResult.totalVehiclesAfterImport}
                  </div>
                </div>
              </div>

              {/* Row-Level Errors Report if any */}
              {commitResult.rowErrors && commitResult.rowErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 text-xs font-bold">
                    <AlertCircle className="w-4 h-4" />
                    <span>Row-Level Errors ({commitResult.rowErrors.length})</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    {commitResult.rowErrors.map((err, idx) => (
                      <div key={idx} className="font-mono text-rose-700 dark:text-rose-400">
                        Row #{err.rowNumber} (Plate: {err.plate_number}): {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog Before Production Write */}
      {isConfirmDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Production Import
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Target Tenant: <span className="font-semibold text-slate-700 dark:text-slate-300">company_pixel_syntax</span>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-sm text-slate-800 dark:text-slate-200 font-medium">
              Import {validCount} validated vehicles into Allied production?
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>• Only validated rows without conflicts will be imported.</p>
              <p>• Existing vehicles and assignments will not be overwritten.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmDialogOpen(false)}
                disabled={committing}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                disabled={committing}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {committing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <span>Confirm Import</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Form Workspace */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION A — REGISTRATION */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
              A
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Registration Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Plate Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Plate Number</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. 12345"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <p className="text-[11px] text-slate-400">Official RTA/Traffic plate number</p>
            </div>

            {/* Plate Code */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Plate Code / Category
              </label>
              <input
                type="text"
                value={plateCode}
                onChange={(e) => setPlateCode(e.target.value)}
                placeholder="e.g. T, B, 1"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Optional plate category or letter</p>
            </div>

            {/* Plate Emirate */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Emirate</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={plateEmirate}
                onChange={(e) => setPlateEmirate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {UAE_EMIRATES.map((em) => (
                  <option key={em} value={em}>
                    {em}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Registration authority state</p>
            </div>

            {/* Vehicle Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Vehicle Type</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {VEHICLE_TYPES.map((vt) => (
                  <option key={vt.value} value={vt.value}>
                    {vt.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Operational category</p>
            </div>
          </div>
        </div>

        {/* SECTION B — VEHICLE DETAILS */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
              B
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Vehicle Specifications & Live Master
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Make / Brand (Live Searchable Master) */}
            <div className="space-y-1.5 relative" ref={makeDropdownRef}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Make / Brand</span>
                <span className="text-rose-500">*</span>
              </label>

              <div
                onClick={() => setIsMakeOpen(!isMakeOpen)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
              >
                <span>{selectedMake ? selectedMake.name : 'Select Make / Brand...'}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>

              {isMakeOpen && (
                <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={makeSearch}
                      onChange={(e) => setMakeSearch(e.target.value)}
                      placeholder="Search make (e.g. Yamaha, Honda)..."
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-hidden placeholder:text-slate-400"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    {makeSearch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMakeSearch('');
                        }}
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-700/50">
                    {filteredMakes.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMake({ id: m.id, name: m.name });
                          setIsMakeOpen(false);
                          setMakeSearch('');
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-medium rounded-lg flex items-center justify-between transition-colors ${
                          selectedMake?.id === m.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{m.name}</span>
                        {m.vehicle_type && (
                          <span className="text-[10px] text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700">
                            {m.vehicle_type}
                          </span>
                        )}
                      </button>
                    ))}
                    {filteredMakes.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No makes matching "{makeSearch}"
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Searchable live fleet master</p>
            </div>

            {/* Model (Live Searchable Master dependent on Make) */}
            <div className="space-y-1.5 relative" ref={modelDropdownRef}>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Model</span>
                <span className="text-rose-500">*</span>
              </label>

              <div
                onClick={() => {
                  if (selectedMake) setIsModelOpen(!isModelOpen);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-between transition-colors ${
                  !selectedMake ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900' : 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <span>
                  {selectedModel
                    ? selectedModel.name
                    : selectedMake
                    ? 'Select Model...'
                    : 'Select Make first...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </div>

              {isModelOpen && selectedMake && (
                <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={`Search ${selectedMake.name} model...`}
                      className="w-full bg-transparent text-xs text-slate-900 dark:text-white outline-hidden placeholder:text-slate-400"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    {modelSearch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModelSearch('');
                        }}
                      >
                        <X className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto p-1 divide-y divide-slate-50 dark:divide-slate-700/50">
                    {filteredModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel({ id: m.id, name: m.name });
                          setIsModelOpen(false);
                          setModelSearch('');
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-medium rounded-lg flex items-center justify-between transition-colors ${
                          selectedModel?.id === m.id
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <span>{m.name}</span>
                      </button>
                    ))}
                    {filteredModels.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No models for {selectedMake.name} matching "{modelSearch}"
                      </div>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[11px] text-slate-400">Filtered by selected Make</p>
            </div>

            {/* Manufacturing Year */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                Manufacturing Year <span className="text-rose-500">*</span>
              </label>
              <select
                id="vehicle-year-select"
                value={year}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="">Select Year</option>
                {Array.from({ length: 2028 - 2009 + 1 }, (_, i) => 2028 - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Valid range: 2009 – 2028</p>
            </div>

            {/* Chassis Number / VIN */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Chassis Number / VIN
              </label>
              <input
                type="text"
                value={chassisNumber}
                onChange={(e) => setChassisNumber(e.target.value)}
                placeholder="e.g. ME4JF50E0J800..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Tenant-scoped unique identifier</p>
            </div>

            {/* TC Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                TC Number
              </label>
              <input
                type="text"
                value={tcNumber}
                onChange={(e) => setTcNumber(e.target.value)}
                placeholder="e.g. TC-982134"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Traffic file / TC code</p>
            </div>
          </div>
        </div>

        {/* SECTION C — MULKIYA */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
              C
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Mulkiya (Registration Card)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mulkiya Card Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Mulkiya / Registration Number
              </label>
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. 10294819"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Traffic department card number</p>
            </div>

            {/* Mulkiya Expiry Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Mulkiya Expiry Date
              </label>
              <input
                type="date"
                value={registrationExpiry}
                onChange={(e) => setRegistrationExpiry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Valid vehicle registration expiry</p>
            </div>
          </div>
        </div>

        {/* SECTION D — OWNERSHIP & DEPOT */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-3">
            <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center text-xs font-bold">
              D
            </span>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
              Ownership, Branch & Initial Odometer
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ownership Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                <span>Ownership Type</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={ownershipType}
                onChange={(e) => setOwnershipType(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="OWNED">Company Owned</option>
                <option value="LEASED">Leased from Vendor</option>
                <option value="RENTED">Short-term Rented</option>
              </select>
              <p className="text-[11px] text-slate-400">Asset acquisition status</p>
            </div>

            {/* Vendor / Owner (when leased/rented) */}
            {ownershipType !== 'OWNED' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                  <span>Vendor / Leasing Company</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={ownerOrVendor}
                  onChange={(e) => setOwnerOrVendor(e.target.value)}
                  placeholder="e.g. Al Naboodah Fleet Leasing"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
                <p className="text-[11px] text-slate-400">Leasing partner or supplier</p>
              </div>
            )}

            {/* Branch / Depot */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Branch / Depot Location
              </label>
              <select
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">Home operational hub</p>
            </div>

            {/* Current Odometer */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Starting Odometer (km)
              </label>
              <input
                type="number"
                value={currentOdometer}
                onChange={(e) => setCurrentOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                min={0}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Kilometers logged at onboarding</p>
            </div>

            {/* GPS Tracker Device ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                GPS Tracker Device ID
              </label>
              <input
                type="text"
                value={gpsDeviceId}
                onChange={(e) => setGpsDeviceId(e.target.value)}
                placeholder="e.g. GPS-TRK-8821"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-400">Hardware telematics tracker code</p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-200">
              Operational Notes (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific delivery box setup, bracket installations, or initial condition notes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Bottom Action Footer */}
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
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors shadow-xs flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Registering...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Register Vehicle</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
