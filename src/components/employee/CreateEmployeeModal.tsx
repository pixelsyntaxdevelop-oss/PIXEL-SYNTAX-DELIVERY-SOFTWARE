import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Building,
  Phone,
  Mail,
  Calendar,
  User,
  Briefcase,
  Truck,
  Smartphone,
  BookOpen,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  Lock,
  Unlock,
} from 'lucide-react';
import { AUTHORITATIVE_BRANCHES, AUTHORITATIVE_CONTRACTOR_CATEGORIES } from '../../lib/branches';
import { STANDARD_DESIGNATIONS } from '../../lib/designations';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { DbEmployeeMaster, DbVisaContractorType, DbVendorCompany } from '../../types/database';

interface CreateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (emp: DbEmployeeMaster) => void;
  onOpenExistingProfile?: (employeeId: string) => void;
  onAssignProject?: (emp: DbEmployeeMaster) => void;
  onAssignBike?: (emp: DbEmployeeMaster) => void;
  onAssignSim?: (emp: DbEmployeeMaster) => void;
  onReceivePassport?: (emp: DbEmployeeMaster) => void;
  departments?: any[];
  projects?: any[];
}

const COMMON_NATIONALITIES = [
  'Pakistan',
  'India',
  'Bangladesh',
  'United Arab Emirates',
  'Nepal',
  'Sri Lanka',
  'Egypt',
  'Philippines',
  'Ghana',
  'Kenya',
  'Nigeria',
  'Uganda',
  'Burundi',
  'Ethiopia',
  'Morocco',
  'Jordan',
  'Syria',
  'Lebanon',
  'Sudan',
  'Yemen',
  'Other',
];

const EMPLOYMENT_STATUSES = [
  'Available / Unassigned',
  'Assigned / Active',
  'On Leave',
  'On Hold',
  'Absconding',
  'Terminated',
  'Exited',
];

const EMPLOYMENT_CATEGORIES = [
  'Delivery Bike Rider',
  'Delivery Car Driver',
  'Fleet Supervisor',
  'Warehouse Specialist',
  'Office Staff / Admin',
];

export const CreateEmployeeModal: React.FC<CreateEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onOpenExistingProfile,
  onAssignProject,
  onAssignBike,
  onAssignSim,
  onReceivePassport,
}) => {
  // Live Branches
  const [safeBranches] = useState(AUTHORITATIVE_BRANCHES);

  // Live Masters: Visa / Contractor Types and Vendors
  const [visaContractorTypes, setVisaContractorTypes] = useState<DbVisaContractorType[]>([]);
  const [vendorCompanies, setVendorCompanies] = useState<DbVendorCompany[]>([]);
  const [liveRoles, setLiveRoles] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Form State - strictly essential daily fields
  const [employeeCode, setEmployeeCode] = useState('');
  const [isCodeEditable, setIsCodeEditable] = useState(false);
  const [codeOverrideReason, setCodeOverrideReason] = useState('');
  const [codeDuplicateWarning, setCodeDuplicateWarning] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emiratesId, setEmiratesId] = useState('');
  const [nationality, setNationality] = useState('Pakistan');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employeeState, setEmployeeState] = useState('');
  const [branchId, setBranchId] = useState('b_dxb');
  const [employmentStatus, setEmploymentStatus] = useState('Available / Unassigned');
  const [visaContractorType, setVisaContractorType] = useState<string>('Own');
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [email, setEmail] = useState('');
  const [designation, setDesignation] = useState('Delivery Bike Rider');

  // Quick inline new vendor creation
  const [isAddingNewVendor, setIsAddingNewVendor] = useState(false);
  const [newVendorInputName, setNewVendorInputName] = useState('');
  const [newVendorInputCity, setNewVendorInputCity] = useState('Dubai');
  const [addingVendorLoading, setAddingVendorLoading] = useState(false);

  // UI / Operational State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [createdEmployee, setCreatedEmployee] = useState<DbEmployeeMaster | null>(null);

  // Duplicate conflict tracking
  const [duplicateConflict, setDuplicateConflict] = useState<{
    id: string;
    employeeCode: string;
    fullName: string;
    field: 'Emirates ID' | 'Employee Code';
  } | null>(null);

  // Initialize Code, Branches, Visa Types & Vendors when opened
  useEffect(() => {
    if (!isOpen) return;

    setCreatedEmployee(null);
    setError(null);
    setDuplicateConflict(null);
    setIsAddingNewVendor(false);
    setNewVendorInputName('');
    setIsCodeEditable(false);
    setCodeOverrideReason('');
    setCodeDuplicateWarning(null);

    setEmployeeState('');
    // Set Branches
    setBranchId(AUTHORITATIVE_BRANCHES[0].id);

    // Fetch Live Visa Contractor Types, Vendors and Roles
    setLoadingMasters(true);
    Promise.all([
      masterEmployeeService.getVisaContractorTypes(),
      masterEmployeeService.getVendors(),
      masterEmployeeService.getDesignations(),
    ]).then(([vctList, vendorsList, rolesList]) => {
      if (Array.isArray(vctList) && vctList.length > 0) {
        setVisaContractorTypes(vctList);
        setVisaContractorType(vctList[0].name);
      }
      if (Array.isArray(vendorsList) && vendorsList.length > 0) {
        setVendorCompanies(vendorsList);
        if (!vendorId) {
          setVendorId(vendorsList[0].id);
          setVendorName(vendorsList[0].name);
        }
      }
      if (Array.isArray(rolesList) && rolesList.length > 0) {
        const masterRoles = rolesList.map(r => r.name);
        const allRoles = Array.from(new Set([...masterRoles, ...STANDARD_DESIGNATIONS]));
        setLiveRoles(allRoles.map(r => ({ id: r, name: r })));
      }
    }).catch(() => {})
    .finally(() => setLoadingMasters(false));

    // Auto-generate employee code
    fetchNextCode();
  }, [isOpen]);

  const fetchNextCode = async () => {
    setGeneratingCode(true);
    try {
      const nextCode = await masterEmployeeService.getNextEmployeeCode();
      setEmployeeCode(nextCode);
    } catch {
      setEmployeeCode('EMP-00001');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCreateNewVendor = async () => {
    if (!newVendorInputName.trim()) return;
    setAddingVendorLoading(true);
    try {
      const created = await masterEmployeeService.createVendor({
        name: newVendorInputName.trim(),
        city: newVendorInputCity || 'Dubai',
      });
      if (created && created.id) {
        setVendorCompanies((prev) => [created, ...prev]);
        setVendorId(created.id);
        setVendorName(created.name);
        setIsAddingNewVendor(false);
        setNewVendorInputName('');
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create new vendor company');
    } finally {
      setAddingVendorLoading(false);
    }
  };

  // Debounced duplicate detection for Emirates ID
  useEffect(() => {
    const cleanEid = emiratesId.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
    if (!cleanEid || cleanEid.length < 8) {
      if (duplicateConflict?.field === 'Emirates ID') setDuplicateConflict(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const matches = await masterEmployeeService.searchMasterEmployees(cleanEid);
        const exact = matches.find((m) => {
          const mEid = (m.emirates_id_number || '').replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
          return mEid === cleanEid;
        });
        if (exact) {
          setDuplicateConflict({
            id: exact.id,
            employeeCode: exact.employee_code,
            fullName: exact.full_name,
            field: 'Emirates ID',
          });
        } else if (duplicateConflict?.field === 'Emirates ID') {
          setDuplicateConflict(null);
        }
      } catch {
        // Ignore network search errors during debouncing
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [emiratesId]);

  // Debounced duplicate detection for Employee Code (when override is enabled)
  useEffect(() => {
    if (!isCodeEditable) {
      setCodeDuplicateWarning(null);
      return;
    }
    const cleanCode = employeeCode.trim().toLowerCase();
    if (!cleanCode || cleanCode.length < 3) {
      setCodeDuplicateWarning(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const matches = await masterEmployeeService.searchMasterEmployees(cleanCode);
        const exact = matches.find(
          (m) => (m.employee_code || '').trim().toLowerCase() === cleanCode
        );
        if (exact) {
          setCodeDuplicateWarning(
            `Explicit Duplicate Warning: Code "${exact.employee_code}" already exists in the system (Assigned to ${exact.full_name}). Duplicate employee codes are blocked.`
          );
        } else {
          setCodeDuplicateWarning(null);
        }
      } catch {
        // ignore search error
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [employeeCode, isCodeEditable]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedCode = employeeCode.trim();
    const trimmedMobile = mobileNumber.trim();
    const trimmedEid = emiratesId.trim();

    if (!trimmedName) {
      setError('Full Name is required.');
      return;
    }
    if (!trimmedCode) {
      setError('Employee Code is required.');
      return;
    }
    if (isCodeEditable) {
      if (!codeOverrideReason.trim()) {
        setError('A mandatory justification reason is required to manually override Employee Code.');
        return;
      }
      if (codeDuplicateWarning) {
        setError('Cannot submit with duplicate employee code. Duplicate employee codes are blocked.');
        return;
      }
    }
    if (!trimmedMobile) {
      setError('Mobile Number is required.');
      return;
    }
    if (!trimmedEid) {
      setError('Emirates ID is required.');
      return;
    }

    // Split name safely
    const nameParts = trimmedName.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const selectedBranch = safeBranches.find((b) => b.id === branchId);

    setSubmitting(true);
    try {
      const payload: Partial<DbEmployeeMaster> & { code_overridden?: boolean; code_override_reason?: string } = {
        employee_code: trimmedCode,
        code_overridden: isCodeEditable,
        code_override_reason: isCodeEditable ? codeOverrideReason.trim() : undefined,
        first_name: firstName,
        last_name: lastName,
        full_name: trimmedName,
        personal_mobile: trimmedMobile,
        company_mobile: trimmedMobile,
        emirates_id_number: trimmedEid,
        nationality,
        joining_date: joiningDate,
        state: employeeState || null,
        branch_id: branchId,
        current_status: employmentStatus as any,
        visa_contractor_type: visaContractorType,
        vendor_id: visaContractorType === 'Vendor' ? (vendorId || undefined) : undefined,
        vendor_name: visaContractorType === 'Vendor' ? (vendorName || undefined) : undefined,
        contractor: visaContractorType === 'Vendor' ? (vendorName || 'Vendor') : visaContractorType,
        designation: designation || 'Delivery Bike Rider',
        job_title: designation || 'Delivery Bike Rider',
        email: email.trim() || undefined,
        is_archived: false,
      };

      const res = await masterEmployeeService.createMasterEmployee(payload);
      if (res.success && res.employee) {
        setCreatedEmployee(res.employee);
        onSuccess(res.employee);
      } else {
        const errMsg = res.error || 'Failed to create employee record';
        setError(errMsg);
        if (errMsg.toLowerCase().includes('already belongs') || errMsg.toLowerCase().includes('already assigned')) {
          // Detect if conflict contains an existing employee
          const foundMatch = await masterEmployeeService.searchMasterEmployees(trimmedEid || trimmedCode);
          if (foundMatch && foundMatch.length > 0) {
            setDuplicateConflict({
              id: foundMatch[0].id,
              employeeCode: foundMatch[0].employee_code,
              fullName: foundMatch[0].full_name,
              field: 'Emirates ID',
            });
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Server error occurred during employee creation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden my-auto max-h-[90dvh] flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-xs">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Create Employee</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Single Employee Master
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Essential identity registration. Operational assignments (bike, project, SIM) are handled on next steps.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* POST-CREATION SUCCESS & ACTION HUB */}
        {createdEmployee ? (
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-emerald-900 dark:text-emerald-200">
                Employee created successfully
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 max-w-md mx-auto">
                <strong className="font-semibold">{createdEmployee.full_name}</strong> (<span className="font-mono">{createdEmployee.employee_code}</span>) has been registered in the system.
              </p>

              <div className="mt-4 bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl p-3.5 max-w-md mx-auto grid grid-cols-2 gap-2.5 text-left text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Employee Code</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-bold">{createdEmployee.employee_code}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Branch</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">{safeBranches.find(b => b.id === createdEmployee.branch_id)?.name || createdEmployee.branch_id || 'Dubai'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Emirates ID</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">{createdEmployee.emirates_id_number}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Status</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{createdEmployee.current_status}</span>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => {
                  if (onAssignProject) onAssignProject(createdEmployee);
                  onClose();
                }}
                className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <Briefcase className="w-4 h-4" />
                <span>Assign Project</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onOpenExistingProfile) onOpenExistingProfile(createdEmployee.id);
                  onClose();
                }}
                className="h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
              >
                <User className="w-4 h-4" />
                <span>View Employee</span>
              </button>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
              >
                Close & Return to Employee Directory
              </button>
            </div>
          </div>
        ) : (
          /* SIMPLE, LIGHT & PROFESSIONAL CREATION FORM */
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {/* Duplicate conflict notification banner */}
              {duplicateConflict && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <strong className="font-semibold block text-sm">
                      Existing Employee Found ({duplicateConflict.field})
                    </strong>
                    <span>
                      An employee with this {duplicateConflict.field} already exists: <strong>{duplicateConflict.fullName}</strong> ({duplicateConflict.employeeCode}).
                    </span>
                    {onOpenExistingProfile && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            onOpenExistingProfile(duplicateConflict.id);
                            onClose();
                          }}
                          className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View Existing Profile ({duplicateConflict.employeeCode})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Row 1: Employee Code + Joining Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Employee Code <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Automatic sequence</span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      required
                      readOnly={!isCodeEditable}
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                      placeholder="e.g. EMP-10023"
                      className={`w-full h-10 px-3 pr-9 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold outline-hidden transition-colors ${
                        !isCodeEditable
                          ? 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 cursor-default'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500'
                      }`}
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      {!isCodeEditable && (
                        <span title="Auto-generated read-only by default">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      )}
                      {isCodeEditable && (
                        <span title="Manual override active">
                          <Unlock className="w-3.5 h-3.5 text-amber-500" />
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={fetchNextCode}
                        disabled={generatingCode}
                        title="Auto-generate next unique employee code"
                        className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatingCode ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Manual Override Mandatory Reason Input */}
                  {isCodeEditable && (
                    <div className="mt-2 p-2.5 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                        <span>Override Reason (Mandatory) *</span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal">Audited with actor & timestamp</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={codeOverrideReason}
                        onChange={(e) => setCodeOverrideReason(e.target.value)}
                        placeholder="e.g. Client-assigned courier ID / legacy transfer"
                        className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  {/* Duplicate Code Explicit Warning */}
                  {codeDuplicateWarning && (
                    <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-900 dark:text-rose-200 text-xs flex items-start gap-2 animate-in fade-in">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span className="text-[11px] font-medium leading-tight">{codeDuplicateWarning}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Joining Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={joiningDate}
                      onChange={(e) => setJoiningDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Full Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Muhammad Bilal Khan"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                  />
                </div>
              </div>

              {/* Row 3: Mobile Number + Emirates ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="e.g. 0501234567"
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Emirates ID <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <FileCheck className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={emiratesId}
                      onChange={(e) => setEmiratesId(e.target.value)}
                      placeholder="XXX-XXXX-XXXXXXX-X"
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Row 4: Nationality + Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Nationality <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={nationality}
                    onChange={(e) => setNationality(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                  >
                    {COMMON_NATIONALITIES.map((nat) => (
                      <option key={nat} value={nat}>
                        {nat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Branch <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <select
                      value={branchId}
                      onChange={(e) => setBranchId(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                    >
                      {safeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label><select aria-label="Employee state" value={employeeState} onChange={(e) => setEmployeeState(e.target.value)} className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"><option value="">Select state</option>{['Abu Dhabi', 'Al Ain', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
{/* Row 5: Employment Status + Visa / Contractor Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Employment Status <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                  >
                    {EMPLOYMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Visa / Contractor Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={visaContractorType}
                    onChange={(e) => {
                      const val = e.target.value;
                      setVisaContractorType(val);
                      if (val === 'Vendor' && vendorCompanies.length > 0 && !vendorId) {
                        setVendorId(vendorCompanies[0].id);
                        setVendorName(vendorCompanies[0].name);
                      }
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                  >
                    {AUTHORITATIVE_CONTRACTOR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Conditional: Vendor Company Selector (When Visa / Contractor Type is Vendor) */}
              {visaContractorType === 'Vendor' && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-amber-600" />
                      <span>Vendor Company <span className="text-rose-500">*</span></span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewVendor(!isAddingNewVendor)}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 dark:text-amber-300 underline"
                    >
                      {isAddingNewVendor ? 'Cancel New Vendor' : '+ Add New Vendor'}
                    </button>
                  </div>

                  {!isAddingNewVendor ? (
                    <div>
                      <select
                        required
                        value={vendorId}
                        onChange={(e) => {
                          const chosenId = e.target.value;
                          setVendorId(chosenId);
                          const chosen = vendorCompanies.find((vc) => vc.id === chosenId);
                          setVendorName(chosen?.name || '');
                        }}
                        className="w-full h-10 px-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-hidden"
                      >
                        {vendorCompanies.length > 0 ? (
                          vendorCompanies.map((vc) => (
                            <option key={vc.id} value={vc.id}>
                              {vc.name} {vc.code ? `[${vc.code}]` : ''} • {vc.city || 'UAE'}
                            </option>
                          ))
                        ) : (
                          <option value="">No vendor companies found — add one below</option>
                        )}
                      </select>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-1">
                        Loaded from live backend Vendor Master. Outsourced payments & contractor billing mapped to this vendor.
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={newVendorInputName}
                        onChange={(e) => setNewVendorInputName(e.target.value)}
                        placeholder="Vendor Company Name (e.g. Rapid Crew Manpower LLC)"
                        className="flex-1 h-9 px-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-xs outline-hidden"
                      />
                      <input
                        type="text"
                        value={newVendorInputCity}
                        onChange={(e) => setNewVendorInputCity(e.target.value)}
                        placeholder="City (e.g. Dubai)"
                        className="w-24 h-9 px-2.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-xs outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleCreateNewVendor}
                        disabled={addingVendorLoading || !newVendorInputName.trim()}
                        className="px-3 h-9 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        {addingVendorLoading ? 'Saving...' : 'Add'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Row 6: Role & Optional Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Role / Category
                  </label>
                  <select
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                  >
                    {liveRoles.length > 0
                      ? liveRoles.map((r) => (
                          <option key={r.id || r.name} value={r.name}>
                            {r.name}
                          </option>
                        ))
                      : EMPLOYMENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Email Address <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. rider@alliedfleet.com"
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-3 sm:py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Takes less than 30s. Operational assets assigned on completion.
              </span>
              <div className="flex items-center gap-2 justify-end w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[40px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[40px]"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Employee</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

