import React, { useState, useEffect } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Building,
  ArrowRight,
  RefreshCw,
  Lock,
  ChevronDown,
  ChevronUp,
  Briefcase,
  User,
  Phone,
  Calendar,
  CreditCard,
  Globe,
  Truck,
  Layers,
  FileCheck,
  ShieldCheck,
  Plus,
  ExternalLink,
  MapPin,
  Camera,
} from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import {
  DbEmployeeMaster,
  DbBranch,
  DbVisaContractorType,
  DbVendorCompany,
  DbDepartment,
  DbDesignation,
  DbTeamMaster,
} from '../../types/database';
import { SearchableSelect, SelectOption } from '../common/SearchableSelect';
import { NationalitySelector } from '../common/NationalitySelector';
import { STANDARD_DEPARTMENTS } from '../../lib/departments';
import { STANDARD_DESIGNATIONS } from '../../lib/designations';
import { AUTHORITATIVE_BRANCHES, AUTHORITATIVE_BRANCH_NAMES, AUTHORITATIVE_CONTRACTOR_CATEGORIES, mapToAuthoritativeBranch } from '../../lib/branches';

interface CreateEmployeePageProps {
  onCancel: () => void;
  onSuccessNavigate?: (action: 'view' | 'assign_project' | 'create_another', employee: DbEmployeeMaster) => void;
  currentTenantId?: string;
  onNavigateModule?: (module: string) => void;
}

const NATIONALITY_OPTIONS: SelectOption[] = [
  { value: 'Pakistan', label: 'Pakistan', badge: 'PK' },
  { value: 'India', label: 'India', badge: 'IN' },
  { value: 'Bangladesh', label: 'Bangladesh', badge: 'BD' },
  { value: 'United Arab Emirates', label: 'United Arab Emirates', badge: 'AE' },
  { value: 'Egypt', label: 'Egypt', badge: 'EG' },
  { value: 'Philippines', label: 'Philippines', badge: 'PH' },
  { value: 'Nepal', label: 'Nepal', badge: 'NP' },
  { value: 'Sri Lanka', label: 'Sri Lanka', badge: 'LK' },
  { value: 'Ghana', label: 'Ghana', badge: 'GH' },
  { value: 'Kenya', label: 'Kenya', badge: 'KE' },
  { value: 'Nigeria', label: 'Nigeria', badge: 'NG' },
  { value: 'Uganda', label: 'Uganda', badge: 'UG' },
  { value: 'Ethiopia', label: 'Ethiopia', badge: 'ET' },
  { value: 'Sudan', label: 'Sudan', badge: 'SD' },
  { value: 'Morocco', label: 'Morocco', badge: 'MA' },
  { value: 'Jordan', label: 'Jordan', badge: 'JO' },
  { value: 'Syria', label: 'Syria', badge: 'SY' },
  { value: 'Lebanon', label: 'Lebanon', badge: 'LB' },
  { value: 'Yemen', label: 'Yemen', badge: 'YE' },
  { value: 'United Kingdom', label: 'United Kingdom', badge: 'GB' },
  { value: 'Other', label: 'Other Nationality', badge: 'INT' },
];

const EMPLOYMENT_STATUS_OPTIONS: SelectOption[] = [
  { value: 'Available / Unassigned', label: 'Available / Unassigned', subLabel: 'Ready for project deployment' },
  { value: 'Assigned / Active', label: 'Assigned / Active', subLabel: 'Active in ongoing operations' },
  { value: 'On Leave', label: 'On Leave', subLabel: 'Authorized operational leave' },
  { value: 'On Hold', label: 'On Hold', subLabel: 'Document/compliance verification' },
  { value: 'Absconding', label: 'Absconding', subLabel: 'Unauthorized absence recorded' },
  { value: 'Terminated', label: 'Terminated', subLabel: 'Service terminated' },
  { value: 'Exited', label: 'Exited', subLabel: 'Completed exit formalities' },
];

export const CreateEmployeePage: React.FC<CreateEmployeePageProps> = ({
  onCancel,
  onSuccessNavigate,
  onNavigateModule,
}) => {
  // Live Masters State
  const [branches, setBranches] = useState<DbBranch[]>([]);
  const [visaTypes, setVisaTypes] = useState<DbVisaContractorType[]>([]);
  const [vendors, setVendors] = useState<DbVendorCompany[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [designations, setDesignations] = useState<DbDesignation[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Preview Code State (Never increments on page load or refresh)
  const [previewCode, setPreviewCode] = useState('EMP-00001');
  const [fetchingCode, setFetchingCode] = useState(false);

  // Form Fields - Basic Identity
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emiratesId, setEmiratesId] = useState('');
  const [nationality, setNationality] = useState('Pakistan');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employmentStatus, setEmploymentStatus] = useState('Available / Unassigned');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<DbTeamMaster[]>([]);

  // Form Fields - Employment Details
  const [branchId, setBranchId] = useState('b_dxb');
  const [visaContractorType, setVisaContractorType] = useState('Own');
  const [vendorId, setVendorId] = useState('');
  const [designation, setDesignation] = useState('Delivery Bike Rider');
  const [departmentId, setDepartmentId] = useState('');

  // Form Fields - Optional Additional Details (Collapsed by default)
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [personalNumber, setPersonalNumber] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  // Inline Quick Vendor Creation
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCity, setNewVendorCity] = useState('Dubai');
  const [addingVendor, setAddingVendor] = useState(false);

  // Submission & Validation States
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<DbEmployeeMaster | null>(null);

  useEffect(() => {
    if (createdEmployee) {
      alert('Employee created successfully.');
      onNavigateModule('employees_list');
    }
  }, [createdEmployee, onNavigateModule]);

  // Load Masters and Preview Code on Mount
  useEffect(() => {
    loadMasters();
    loadPreviewCode();
  }, []);

  const loadPreviewCode = async () => {
    setFetchingCode(true);
    try {
      const code = await masterEmployeeService.getNextEmployeeCode();
      if (code) {
        setPreviewCode(code);
      }
    } catch {
      // Keep fallback
    } finally {
      setFetchingCode(false);
    }
  };

  const loadMasters = async () => {
    setLoadingMasters(true);
    try {
      const [branchesData, visaData, vendorsData, deptsData, desigsData, teamsData] = await Promise.all([
        masterEmployeeService.getBranches(),
        masterEmployeeService.getVisaContractorTypes(),
        masterEmployeeService.getVendors(),
        masterEmployeeService.getDepartments(),
        masterEmployeeService.getDesignations(),
        masterEmployeeService.getTeams(),
      ]);

      if (Array.isArray(branchesData) && branchesData.length > 0) {
        setBranches(branchesData);
        setBranchId(branchesData[0].id);
      }

      if (Array.isArray(visaData) && visaData.length > 0) {
        setVisaTypes(visaData);
        setVisaContractorType(visaData[0].name);
      }

      if (Array.isArray(vendorsData) && vendorsData.length > 0) {
        setVendors(vendorsData);
        setVendorId(vendorsData[0].id);
      }

      if (Array.isArray(deptsData) && deptsData.length > 0) {
        setDepartments(deptsData);
        setDepartmentId(deptsData[0].id);
      }

      if (Array.isArray(desigsData) && desigsData.length > 0) {
        setDesignations(desigsData);
      }
      
      if (Array.isArray(teamsData) && teamsData.length > 0) {
        setTeams(teamsData);
      }
    } catch (e) {
      console.error('Failed to load employee masters:', e);
    } finally {
      setLoadingMasters(false);
    }
  };

  // Determine if selected Visa/Contractor requires Vendor Company
  const selectedVisaTypeObj = visaTypes.find(
    (v) => v.name.toLowerCase() === visaContractorType.toLowerCase() || v.code.toLowerCase() === visaContractorType.toLowerCase()
  );
  const isVendorRequired =
    selectedVisaTypeObj?.requires_vendor_company ||
    visaContractorType.toLowerCase().includes('vendor') ||
    visaContractorType.toLowerCase().includes('outsourc');

  // Client-side Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full Name is required.';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Full Name must be at least 3 characters.';
    }

    if (!mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required.';
    } else if (!/^[0-9+ ]{8,16}$/.test(mobileNumber.replace(/[\s-]/g, ''))) {
      newErrors.mobileNumber = 'Please enter a valid phone number (e.g. 050 123 4567).';
    }

    const cleanEid = emiratesId.replace(/[^0-9a-zA-Z]/g, '');
    if (!emiratesId.trim()) {
      newErrors.emiratesId = 'Emirates ID is required.';
    } else if (cleanEid.length < 8) {
      newErrors.emiratesId = 'Please enter a valid Emirates ID number (e.g. XXX-XXXX-XXXXXXX-X).';
    }

    if (!nationality.trim()) {
      newErrors.nationality = 'Nationality is required.';
    }

    if (!joiningDate) {
      newErrors.joiningDate = 'Joining Date is required.';
    }

    if (!branchId) {
      newErrors.branchId = 'Branch assignment is required.';
    }

    if (!employmentStatus) {
      newErrors.employmentStatus = 'Employment status is required.';
    }

    if (!visaContractorType) {
      newErrors.visaContractorType = 'Visa / Contractor Type is required.';
    }

    if (isVendorRequired && !vendorId) {
      newErrors.vendorId = 'Vendor Company is required when Contractor Type is Vendor.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit Handler
  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    try {
      const selectedBranch = branches.find((b) => b.id === branchId);
      const selectedVendor = vendors.find((v) => v.id === vendorId);

      const payload = {
        full_name: fullName.trim(),
        personal_mobile: personalNumber.trim() || mobileNumber.trim(),
        company_mobile: mobileNumber.trim(),
        mobile: mobileNumber.trim(),
        emirates_id_number: emiratesId.trim(),
        nationality,
        joining_date: joiningDate,
        current_status: employmentStatus,
        branch_id: branchId,
        branch: selectedBranch?.name || AUTHORITATIVE_BRANCH_NAMES[0],
        contractor: visaContractorType,
        contractor_id: isVendorRequired ? (selectedVendor?.name || 'Vendor') : visaContractorType,
        vendor_id: isVendorRequired ? vendorId : undefined,
        vendor_name: isVendorRequired ? selectedVendor?.name : undefined,
        designation: designation || 'Delivery Bike Rider',
        department_id: departmentId || undefined,
        photo: profilePhotoUrl || undefined,
        address: address.trim() || undefined,
        notes: emergencyContactName
          ? `Emergency Contact: ${emergencyContactName} (${emergencyContactNumber})`
          : undefined,
      };

      const response = await masterEmployeeService.createMasterEmployee(payload);
      if (response && response.success && response.employee) {
        setCreatedEmployee(response.employee);
      } else {
        setServerError(response?.error || 'Server failed to return created employee profile.');
      }
    } catch (err: any) {
      setServerError(err?.message || 'Failed to register employee. Please review input fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Reset Form for Next Entry
  const handleResetForNext = () => {
    setCreatedEmployee(null);
    setFullName('');
    setMobileNumber('');
    setEmiratesId('');
    setPersonalNumber('');
    setAddress('');
    setEmergencyContactName('');
    setEmergencyContactNumber('');
    setProfilePhotoUrl('');
    setErrors({});
    setServerError(null);
    loadPreviewCode();
  };

  // Inline Vendor Create Handler
  const handleSaveNewVendor = async () => {
    if (!newVendorName.trim()) return;
    setAddingVendor(true);
    try {
      const res = await masterEmployeeService.createVendor({
        name: newVendorName.trim(),
        city: newVendorCity || 'Dubai',
      });
      if (res && res.id) {
        setVendors((prev) => [res, ...prev]);
        setVendorId(res.id);
        setShowAddVendorModal(false);
        setNewVendorName('');
        setErrors((prev) => {
          const next = { ...prev };
          delete next.vendorId;
          return next;
        });
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to add new vendor.');
    } finally {
      setAddingVendor(false);
    }
  };

  // ============================================================================
  // SUCCESS STATE VIEW
  // ============================================================================
  if (createdEmployee) {
    const assignedBranch = branches.find((b) => b.id === createdEmployee.branch_id);

    return (
      <div className="min-h-screen bg-slate-50/60 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            {/* Success Header */}
            <div className="p-8 text-center border-b border-slate-100 bg-linear-to-b from-emerald-50/50 to-white">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Employee Created Successfully
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Workforce identity committed with sequential code allocation. All audit logs and history entries have been initialized.
              </p>
            </div>

            {/* Created Profile Summary Card */}
            <div className="p-8">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-200">
                      {createdEmployee.full_name?.charAt(0).toUpperCase() || 'E'}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 leading-tight">
                        {createdEmployee.full_name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {createdEmployee.designation || 'Delivery Bike Rider'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Assigned Code
                    </span>
                    <span className="text-base font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md inline-block mt-0.5">
                      {createdEmployee.employee_code}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                      Status
                    </span>
                    <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-sm inline-block mt-1">
                      {createdEmployee.current_status}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                      Visa / Contractor
                    </span>
                    <span className="font-medium text-slate-800 block mt-1">
                      {createdEmployee.contractor || 'Allied DXB'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                      Branch
                    </span>
                    <span className="font-medium text-slate-800 block mt-1 truncate">
                      {assignedBranch?.name || mapToAuthoritativeBranch(createdEmployee.branch)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 uppercase tracking-wider font-semibold block text-[10px]">
                      Joining Date
                    </span>
                    <span className="font-medium text-slate-800 block mt-1">
                      {createdEmployee.joining_date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSuccessNavigate) {
                        onSuccessNavigate('assign_project', createdEmployee);
                      } else if (onNavigateModule) {
                        onNavigateModule('drivers_assign_proj');
                      }
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Briefcase className="w-4 h-4" />
                    Assign Project
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSuccessNavigate) {
                        onSuccessNavigate('view', createdEmployee);
                      } else if (onNavigateModule) {
                        onNavigateModule('employees_list');
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <User className="w-4 h-4" />
                    View Employee
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleResetForNext}
                  className="w-full sm:w-auto px-4 py-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Create Another Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // FULL PAGE WORKSPACE VIEW
  // ============================================================================
  const safeBranches = branches.length > 0 ? branches : AUTHORITATIVE_BRANCHES;
  const branchOptions: SelectOption[] = safeBranches.map((b) => ({
    value: b.id,
    label: b.name,
  }));

  const visaOptions: SelectOption[] = AUTHORITATIVE_CONTRACTOR_CATEGORIES.map((cat) => ({
    value: cat,
    label: cat,
  }));

  const vendorOptions: SelectOption[] = vendors.map((vnd) => ({
    value: vnd.id,
    label: vnd.name,
    badge: vnd.city || 'UAE',
  }));

  const designationOptions: SelectOption[] = [
    ...STANDARD_DESIGNATIONS.map(d => ({ value: d, label: d })),
    ...designations
      .filter(d => !STANDARD_DESIGNATIONS.includes(d.name as any))
      .map((d) => ({
        value: d.name,
        label: d.name,
        badge: d.department || d.code,
      }))
  ];

  const departmentOptions: SelectOption[] = STANDARD_DEPARTMENTS.map((dep) => ({
    value: dep,
    label: dep,
  }));

  const teamOptions: SelectOption[] = teams.map((t) => ({
    value: t.id,
    label: t.name,
  }));

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* Enterprise Top Navigation & Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                  <UserPlus className="w-5 h-5" />
                </span>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Create Employee
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Register a new employee in the master workforce directory.
              </p>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer min-h-[40px] text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateEmployee}
                disabled={submitting}
                className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 min-h-[40px]"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating Employee...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Create Employee</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Form */}
      <main className="max-w-5xl mx-auto px-3 sm:px-6 lg:px-8 mt-4 sm:mt-6">
        {/* Segregation Notice: Office Login vs Workforce Directory */}
        <div className="mb-6 bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-900">
            <span className="font-semibold">Workforce Registration: </span>
            This form creates an employee master record in the operations directory. Operational staff (riders, drivers) do not receive software logins. Office staff user accounts are configured separately via controlled access management.
          </div>
        </div>

        {/* Server Error Alert Banner */}
        {serverError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-xs text-red-800">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block text-red-900 text-sm">Failed to Create Employee</span>
              <p className="mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleCreateEmployee} className="space-y-4 sm:space-y-6">
          {/* ================================================================== */}
          {/* SECTION: EMPLOYEE CODE (FINAL SEQUENCE SAFETY) */}
          {/* ================================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Employee Code</h2>
                  <p className="text-xs text-slate-500">
                    Allocated atomically upon creation by the master database sequence engine.
                  </p>
                </div>
              </div>

              {/* Read-Only Sequential Code Badge */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-medium text-slate-500">Allocated ID:</span>
                <span className="font-mono font-bold text-sm text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                  {fetchingCode ? 'Loading...' : previewCode}
                </span>
                <span className="text-[10px] uppercase font-semibold text-slate-400 bg-slate-200/70 px-1.5 py-0.5 rounded-sm">
                  Read-Only Preview
                </span>
              </div>
            </div>
          </div>

          {/* ================================================================== */}
          {/* SECTION 1: BASIC IDENTITY */}
          {/* ================================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Basic Identity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Core legal personal identity and mandatory regulatory details.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                  }}
                  placeholder="e.g. Muhammad Tariq Khan"
                  className={`w-full px-3.5 py-2 text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                    errors.fullName
                      ? 'border-red-400 focus:ring-red-100'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                  }`}
                />
                {errors.fullName && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.fullName}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Mobile <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={mobileNumber}
                    onChange={(e) => {
                      setMobileNumber(e.target.value);
                      if (errors.mobileNumber) setErrors((prev) => ({ ...prev, mobileNumber: '' }));
                    }}
                    placeholder="050 123 4567"
                    className={`w-full pl-9 pr-3.5 py-2 text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                      errors.mobileNumber
                        ? 'border-red-400 focus:ring-red-100'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {errors.mobileNumber && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.mobileNumber}</p>
                )}
              </div>

              {/* Emirates ID */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Emirates ID <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={emiratesId}
                    onChange={(e) => {
                      setEmiratesId(e.target.value);
                      if (errors.emiratesId) setErrors((prev) => ({ ...prev, emiratesId: '' }));
                    }}
                    placeholder="XXX-XXXX-XXXXXXX-X"
                    className={`w-full pl-9 pr-3.5 py-2 text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                      errors.emiratesId
                        ? 'border-red-400 focus:ring-red-100'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {errors.emiratesId && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.emiratesId}</p>
                )}
              </div>

              {/* Nationality */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">Nationality</label>
                <NationalitySelector value={nationality} onChange={(val) => {
                    setNationality(val);
                    if (errors.nationality) setErrors((prev) => ({ ...prev, nationality: '' }));
                }} />
                {errors.nationality && <p className="mt-1 text-xs text-red-600 font-medium">{errors.nationality}</p>}
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  Joining Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => {
                      setJoiningDate(e.target.value);
                      if (errors.joiningDate) setErrors((prev) => ({ ...prev, joiningDate: '' }));
                    }}
                    className={`w-full pl-9 pr-3.5 py-2 text-sm bg-white border rounded-lg focus:outline-hidden focus:ring-2 transition-all ${
                      errors.joiningDate
                        ? 'border-red-400 focus:ring-red-100'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {errors.joiningDate && (
                  <p className="mt-1 text-xs text-red-600 font-medium">{errors.joiningDate}</p>
                )}
              </div>

              {/* Employment Status */}
              <SearchableSelect
                label="Employment Status"
                required
                value={employmentStatus}
                onChange={(val) => {
                  setEmploymentStatus(val);
                  if (errors.employmentStatus) setErrors((prev) => ({ ...prev, employmentStatus: '' }));
                }}
                options={EMPLOYMENT_STATUS_OPTIONS}
                error={errors.employmentStatus}
                isSearchable={false}
              />
            </div>
          </div>

          {/* ================================================================== */}
          {/* SECTION 2: EMPLOYMENT DETAILS */}
          {/* ================================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-2xs">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Employment Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organizational hierarchy, branch placement, and visa / contractor ownership.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Branch (Live Backend Branch Master) */}
              <SearchableSelect
                label="Branch"
                required
                value={branchId}
                onChange={(val) => {
                  setBranchId(val);
                  if (errors.branchId) setErrors((prev) => ({ ...prev, branchId: '' }));
                }}
                options={branchOptions}
                loading={loadingMasters}
                loadingText="Loading branches..."
                emptyText="No active branches configured"
                searchPlaceholder="Search branch by name or code..."
                error={errors.branchId}
              />

              {/* Visa / Contractor Type (Live Backend Master) */}
              <SearchableSelect
                label="Visa / Contractor Type"
                required
                value={visaContractorType}
                onChange={(val) => {
                  setVisaContractorType(val);
                  if (errors.visaContractorType) setErrors((prev) => ({ ...prev, visaContractorType: '' }));
                }}
                options={visaOptions}
                loading={loadingMasters}
                loadingText="Loading visa types..."
                emptyText="No visa/contractor types configured"
                searchPlaceholder="Search visa or contractor type..."
                error={errors.visaContractorType}
              />

              {/* Vendor Company (Conditional on Vendor selection) */}
              {isVendorRequired && (
                <div className="animate-in fade-in zoom-in-95 duration-150">
                  <SearchableSelect
                    label="Vendor Company"
                    required
                    value={vendorId}
                    onChange={(val) => {
                      setVendorId(val);
                      if (errors.vendorId) setErrors((prev) => ({ ...prev, vendorId: '' }));
                    }}
                    options={vendorOptions}
                    loading={loadingMasters}
                    loadingText="Loading vendors..."
                    emptyText="No vendor companies registered"
                    searchPlaceholder="Search vendor company..."
                    error={errors.vendorId}
                    onAddNew={() => setShowAddVendorModal(true)}
                    addNewText="Register New Vendor"
                  />
                </div>
              )}

              {/* Role / Designation (Optional) */}
              <SearchableSelect
                label="Role / Designation (Optional)"
                value={designation}
                onChange={(val) => setDesignation(val)}
                options={designationOptions}
                loading={loadingMasters}
                loadingText="Loading designations..."
                emptyText="No designations configured"
                searchPlaceholder="Search role or designation..."
              />

              {/* Department (Optional) */}
              <SearchableSelect
                label="Department (Optional)"
                value={departmentId}
                onChange={(val) => setDepartmentId(val)}
                options={departmentOptions}
                loading={loadingMasters}
                loadingText="Loading departments..."
                emptyText="No departments configured"
                searchPlaceholder="Search department..."
              />

              {/* Team (Optional) */}
              <SearchableSelect
                label="Team (Optional)"
                value={teamId}
                onChange={(val) => setTeamId(val)}
                options={teamOptions}
                loading={loadingMasters}
                loadingText="Loading teams..."
                emptyText="No teams configured"
                searchPlaceholder="Search team..."
              />
            </div>
          </div>

          {/* ================================================================== */}
          {/* SECTION 3: OPTIONAL ADDITIONAL DETAILS (COLLAPSED) */}
          {/* ================================================================== */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowOptionalDetails((prev) => !prev)}
              className="w-full p-5 text-left flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Additional Details (Optional)</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-sm">
                    Non-blocking
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personal phone number, residential address, emergency contacts, and photo.
                </p>
              </div>
              <div className="text-slate-400">
                {showOptionalDetails ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </button>

            {showOptionalDetails && (
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/40 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Personal Mobile */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Personal Mobile
                    </label>
                    <input
                      type="text"
                      value={personalNumber}
                      onChange={(e) => setPersonalNumber(e.target.value)}
                      placeholder="05X XXX XXXX"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Emergency Contact Name */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      value={emergencyContactName}
                      onChange={(e) => setEmergencyContactName(e.target.value)}
                      placeholder="e.g. Brother / Relative Name"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Emergency Contact Phone */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="text"
                      value={emergencyContactNumber}
                      onChange={(e) => setEmergencyContactNumber(e.target.value)}
                      placeholder="+971 50 XXX XXXX"
                      className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  {/* Residential Address */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      UAE Accommodation / Residential Address
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. Building 14, Al Quoz Camp 2, Dubai"
                        className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  </div>

                  {/* Profile Photo URL / R2 Storage Note */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                      Profile Photo URL
                    </label>
                    <div className="relative">
                      <Camera className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="url"
                        value={profilePhotoUrl}
                        onChange={(e) => setProfilePhotoUrl(e.target.value)}
                        placeholder="https://... (Cloud R2 URI)"
                        className="w-full pl-9 pr-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Stores binary in R2 &amp; metadata in database. Never stores raw base64.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ================================================================== */}
          {/* BOTTOM FORM SUBMISSION BAR */}
          {/* ================================================================== */}
          <div className="pt-3 sm:pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors cursor-pointer order-2 sm:order-1 min-h-[44px] text-center"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 order-1 sm:order-2 min-h-[44px]"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Creating Employee...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Create Employee</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* ================================================================== */}
      {/* INLINE QUICK VENDOR REGISTRATION MODAL */}
      {/* ================================================================== */}
      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 border border-slate-200 max-h-[90dvh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Register New Vendor Company
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Add a new contractor supplier into the live backend Vendor Master.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Vendor Company Name *
                </label>
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Star Rider Outsourcing LLC"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  City / Emirate
                </label>
                <select
                  value={newVendorCity}
                  onChange={(e) => setNewVendorCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Dubai">Dubai</option>
                  <option value="Abu Dhabi">Abu Dhabi</option>
                  <option value="Sharjah">Sharjah</option>
                  <option value="Ajman">Ajman</option>
                  <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddVendorModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewVendor}
                disabled={addingVendor || !newVendorName.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {addingVendor && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Vendor</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
