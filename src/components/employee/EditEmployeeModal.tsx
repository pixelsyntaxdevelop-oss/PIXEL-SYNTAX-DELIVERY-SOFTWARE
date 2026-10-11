import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Building,
  Phone,
  Mail,
  Calendar,
  KeyRound,
  User,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  Truck,
  Smartphone,
  BookOpen,
  FileText,
  Clock,
  Users,
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Camera,
  RotateCcw,
} from 'lucide-react';
import { AUTHORITATIVE_BRANCHES, getAuthoritativeContractorOptions } from '../../lib/branches';
import { STANDARD_DESIGNATIONS } from '../../lib/designations';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { resolveCanonicalStatus, CANONICAL_STATUS_LIST } from '../../utils/canonicalStatus';
import {
  DbEmployeeMaster,
  DbBranch,
  DbDepartment,
  DbProject,
  DbShift,
  DbDesignation,
  DbContractCategory,
  DbTeamMaster,
  DbManagerLookup,
} from '../../types/database';

interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: DbEmployeeMaster | null;
  onSuccess: (updated: DbEmployeeMaster) => void;
  onOpenExistingProfile?: (employeeId: string) => void;
  onManageProject?: (emp: DbEmployeeMaster) => void;
  onManageBike?: (emp: DbEmployeeMaster) => void;
  onManageSim?: (emp: DbEmployeeMaster) => void;
  onManagePassport?: (emp: DbEmployeeMaster) => void;
  branches?: DbBranch[];
  departments?: DbDepartment[];
  projects?: DbProject[];
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
  'Nigeria',
  'Ghana',
  'Kenya',
  'Morocco',
  'Jordan',
  'Syria',
  'Lebanon',
  'Sudan',
  'Yemen',
  'Uganda',
  'Burundi',
  'Ethiopia',
  'Indonesia',
  'United Kingdom',
  'Other',
];

export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
  onOpenExistingProfile,
  onManageProject,
  onManageBike,
  onManageSim,
  onManagePassport,
  departments = [],
  projects = [],
}) => {
  // Live Masters State
  const [safeBranches] = useState<DbBranch[]>(AUTHORITATIVE_BRANCHES);
  const [safeDepartments, setSafeDepartments] = useState<DbDepartment[]>([]);
  const [shifts, setShifts] = useState<DbShift[]>([]);
  const [designations, setDesignations] = useState<DbDesignation[]>([]);
  const [categories, setCategories] = useState<DbContractCategory[]>([]);
  const [teams, setTeams] = useState<DbTeamMaster[]>([]);
  const [managers, setManagers] = useState<DbManagerLookup[]>([]);
  const [safeProjects, setSafeProjects] = useState<DbProject[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // 1. System / Login Details
    employeeCode: '',
    username: '',
    companyMobile: '',
    email: '',

    // 2. Personal Details
    firstName: '',
    lastName: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    dateOfBirth: '1995-01-01',
    emiratesIdNumber: '',
    nationality: 'Pakistan',
    personalMobile: '',
    passportNumber: '',
    passportExpiry: '',

    // 3. Work Details
    managerId: '',
    shiftId: '',
    teamId: '',
    joiningDate: '',
    basicSalary: 3500,
    branchId: '',
    state: '',
    contractor: 'Company Visa',
    departmentId: '',
    designation: 'Delivery Bike Rider',
    currentStatus: 'Available / Unassigned' as any,
    statusReason: '',

    // 4. Additional Details
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    photo: '',
    leaveOpeningBalance: 0,
    notes: '',
  });

  // UI Control states
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // Duplicate Check states
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [emiratesIdConflict, setEmiratesIdConflict] = useState<{ id: string; fullName: string; employeeCode: string; emiratesId: string } | null>(null);
  const [codeConflict, setCodeConflict] = useState<{ id: string; fullName: string; employeeCode: string } | null>(null);

  // Submission States
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load masters and populate employee data
  useEffect(() => {
    if (!isOpen || !employee) {
      setError(null);
      setEmiratesIdConflict(null);
      setCodeConflict(null);
      return;
    }

    let isMounted = true;
    const fetchMasters = async () => {
      setLoadingMasters(true);
      try {
        const [dList, sList, desList, catList, tList, mList, pList] = await Promise.all([
          departments.length > 0 ? departments : masterEmployeeService.getDepartments(),
          masterEmployeeService.getShifts(),
          masterEmployeeService.getDesignations(),
          masterEmployeeService.getContractCategories(),
          masterEmployeeService.getTeams(),
          masterEmployeeService.getManagers(),
          projects.length > 0 ? projects : masterEmployeeService.getProjects(),
        ]);

        if (!isMounted) return;

        setSafeDepartments(Array.isArray(dList) ? dList : []);
        setShifts(Array.isArray(sList) ? sList : []);
        
        const masterDesignations = Array.isArray(desList) ? desList.map(d => d.name) : [];
        const allDesignations = Array.from(new Set([...masterDesignations, ...STANDARD_DESIGNATIONS]));
        setDesignations(allDesignations.map(d => ({ id: d, name: d })));
        
        setCategories(Array.isArray(catList) ? catList : []);
        setTeams(Array.isArray(tList) ? tList : []);
        setManagers(Array.isArray(mList) ? mList : []);
        setSafeProjects(Array.isArray(pList) ? pList : []);
      } catch (err) {
        console.warn('Error loading edit masters:', err);
      } finally {
        if (isMounted) setLoadingMasters(false);
      }
    };

    fetchMasters();

    // Populate existing employee data
    setFormData({
      employeeCode: employee.employee_code || '',
      username: employee.username || employee.employee_code?.toLowerCase() || '',
      companyMobile: employee.company_mobile || '',
      email: employee.email || '',

      firstName: employee.first_name || '',
      lastName: employee.last_name || '',
      gender: (employee.gender as any) || 'Male',
      dateOfBirth: employee.date_of_birth || '1995-01-01',
      emiratesIdNumber: employee.emirates_id_number || '',
      nationality: employee.nationality || 'Pakistan',
      personalMobile: employee.personal_mobile || '',
      passportNumber: employee.passport_number || '',
      passportExpiry: employee.passport_expiry || '',

      managerId: employee.manager_id || '',
      shiftId: employee.shift_id || '',
      teamId: employee.team_id || '',
      joiningDate: employee.joining_date || '',
      basicSalary: employee.basic_salary || 3500,
      state: employee.state || '',
      branchId: employee.branch_id === 'b_auh' || (employee.branch_name || '').toLowerCase().includes('spc') || (employee.branch_name || '').toLowerCase().includes('auh') ? 'b_auh' : 'b_dxb',
      contractor: employee.contractor || 'Own',
      departmentId: employee.department_id || 'dept_ops',
      designation: employee.designation || 'Delivery Bike Rider',
      currentStatus: resolveCanonicalStatus(employee.current_status),
      statusReason: '',

      address: employee.address || '',
      emergencyContactName: employee.emergency_contact_name || '',
      emergencyContactPhone: employee.emergency_contact_phone || '',
      photo: employee.photo || '',
      leaveOpeningBalance: employee.leave_opening_balance || 0,
      notes: employee.notes || '',
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, employee]);

  // Debounced duplicate check (excluding current employee ID)
  useEffect(() => {
    if (!isOpen || !employee) return;
    if (!formData.emiratesIdNumber && !formData.employeeCode) {
      setEmiratesIdConflict(null);
      setCodeConflict(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingDuplicate(true);
      try {
        const result = await masterEmployeeService.validateUnique({
          emiratesId: formData.emiratesIdNumber,
          employeeCode: formData.employeeCode,
          excludeEmployeeId: employee.id,
        });
        setEmiratesIdConflict(result.emiratesIdConflict);
        setCodeConflict(result.employeeCodeConflict);
      } catch (err) {
        console.error('Validation check failed', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.emiratesIdNumber, formData.employeeCode, employee?.id, isOpen]);

  const handleEmiratesIdChange = (val: string) => {
    let clean = val.replace(/[^0-9]/g, '');
    if (clean.length > 15) clean = clean.substring(0, 15);
    let formatted = clean;
    if (clean.length > 3) {
      formatted = `${clean.substring(0, 3)}-${clean.substring(3)}`;
    }
    if (clean.length > 7) {
      formatted = `${clean.substring(0, 3)}-${clean.substring(3, 7)}-${clean.substring(7)}`;
    }
    if (clean.length > 14) {
      formatted = `${clean.substring(0, 3)}-${clean.substring(3, 7)}-${clean.substring(7, 14)}-${clean.substring(14, 15)}`;
    }
    setFormData((prev) => ({ ...prev, emiratesIdNumber: formatted || val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setError(null);

    // Mandatory Field Validations
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }

    if (!formData.employeeCode.trim()) {
      setError('Employee Code is required.');
      return;
    }

    if (!formData.emiratesIdNumber.trim()) {
      setError('Emirates ID / Unique ID is required.');
      return;
    }

    if (!formData.personalMobile.trim()) {
      setError('Personal Mobile contact number is required.');
      return;
    }

    if (emiratesIdConflict) {
      setError(`Emirates ID already belongs to ${emiratesIdConflict.fullName} (${emiratesIdConflict.employeeCode}).`);
      return;
    }

    if (codeConflict) {
      setError(`Employee code ${codeConflict.employeeCode} already belongs to ${codeConflict.fullName}.`);
      return;
    }

    setSubmitting(true);
    try {
      const selectedBranch = safeBranches.find((b) => b.id === formData.branchId);
      const selectedDept = safeDepartments.find((d) => d.id === formData.departmentId);
      const selectedShift = shifts.find((s) => s.id === formData.shiftId);
      const selectedTeam = teams.find((t) => t.id === formData.teamId);
      const selectedManager = managers.find((m) => m.id === formData.managerId);

      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

      const updates: Partial<DbEmployeeMaster> = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        full_name: fullName,
        employee_code: formData.employeeCode.trim(),
        username: (formData.username || formData.employeeCode).toLowerCase().trim(),
        personal_mobile: formData.personalMobile.trim(),
        company_mobile: formData.companyMobile.trim(),
        email: formData.email.trim(),
        emirates_id_number: formData.emiratesIdNumber.trim(),
        nationality: formData.nationality,
        gender: formData.gender,
        date_of_birth: formData.dateOfBirth,
        passport_number: formData.passportNumber.trim(),
        passport_expiry: formData.passportExpiry || undefined,
        state: formData.state || null,
        branch_id: formData.branchId,
        department_id: formData.departmentId,
        contractor: formData.contractor,
        contractor_id: formData.contractor,
        designation: formData.designation,
        job_title: formData.designation,
        joining_date: formData.joiningDate,
        basic_salary: Number(formData.basicSalary) || 3500,
        current_status: formData.currentStatus,
        status_reason: formData.statusReason || (formData.currentStatus !== employee.current_status ? 'Status updated in master editor' : employee.status_reason),
        manager_id: formData.managerId || undefined,
        shift_id: formData.shiftId || undefined,
        team_id: formData.teamId || undefined,
        address: formData.address.trim(),
        emergency_contact_name: formData.emergencyContactName.trim(),
        emergency_contact_phone: formData.emergencyContactPhone.trim(),
        photo: formData.photo.trim() || employee.photo,
        leave_opening_balance: Number(formData.leaveOpeningBalance) || 0,
        notes: formData.notes.trim(),
      };

      const result = await masterEmployeeService.updateMasterEmployee(employee.id, updates);
      if (result.success && result.employee) {
        onSuccess(result.employee);
        onClose();
      } else {
        setError(result.error || 'Failed to update employee profile');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error occurred during employee update');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !employee) return null;

  const derivedFullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Employee Profile</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  {employee.employee_code}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {employee.full_name}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update master identity, verified credentials, reporting line, and employment parameters
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Live Hardware & Custody Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              {/* Project Card */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                    Project
                  </span>
                  {onManageProject && (
                    <button
                      type="button"
                      onClick={() => {
                        onManageProject(employee);
                        onClose();
                      }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline"
                    >
                      Change
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {employee.project_name || 'Unassigned / Available'}
                </div>
              </div>

              {/* Bike Card */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-indigo-500" />
                    Assigned Bike
                  </span>
                  {onManageBike && (
                    <button
                      type="button"
                      onClick={() => {
                        onManageBike(employee);
                        onClose();
                      }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {employee.current_bike_plate || 'No Bike Assigned'}
                </div>
              </div>

              {/* SIM Card */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-teal-500" />
                    Assigned SIM
                  </span>
                  {onManageSim && (
                    <button
                      type="button"
                      onClick={() => {
                        onManageSim(employee);
                        onClose();
                      }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {employee.current_sim_number || 'No SIM Assigned'}
                </div>
              </div>

              {/* Passport Custody */}
              <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    Passport Custody
                  </span>
                  {onManagePassport && (
                    <button
                      type="button"
                      onClick={() => {
                        onManagePassport(employee);
                        onClose();
                      }}
                      className="text-[10px] text-blue-600 font-semibold hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>
                <div className="text-xs font-bold truncate flex items-center gap-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      employee.passport_status === 'With Company' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  <span className={employee.passport_status === 'With Company' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}>
                    {employee.passport_status || 'With Rider'}
                  </span>
                </div>
              </div>
            </div>

            {/* Alert / Duplicate Warning Banner */}
            {emiratesIdConflict && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-xs">
                  <strong className="font-semibold block text-sm">Emirates ID Conflict Detected</strong>
                  <span>
                    This Emirates ID is currently assigned to another employee: <strong>{emiratesIdConflict.fullName}</strong> ({emiratesIdConflict.employeeCode}).
                  </span>
                </div>
              </div>
            )}

            {codeConflict && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Employee code <strong>{codeConflict.employeeCode}</strong> is already taken by {codeConflict.fullName}.</span>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* SECTION 1: LOGIN / SYSTEM DETAILS */}
            {/* ========================================================================= */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      1. Login / System Details
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Master identification, system username, work phone and email address</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Employee Code */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employee Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.employeeCode}
                    readOnly
                    onChange={(e) => setFormData((prev) => ({ ...prev, employeeCode: e.target.value.toUpperCase().trim() }))}
                    className="w-full px-3 py-2 font-mono text-xs uppercase bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value.toLowerCase().trim() }))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Work / Company Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work / Company Mobile <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.companyMobile}
                    onChange={(e) => setFormData((prev) => ({ ...prev, companyMobile: e.target.value }))}
                    placeholder="e.g. 050 123 4567"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Work / System Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 2: PERSONAL DETAILS */}
            {/* ========================================================================= */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      2. Personal Details
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Legal identity, verified Emirates ID, nationality, and personal contact</p>
                  </div>
                </div>
                {derivedFullName && (
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-lg bg-slate-200/70 dark:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Full Name: {derivedFullName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* First Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Gender
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData((prev) => ({ ...prev, gender: e.target.value as any }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Emirates ID */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Emirates ID <span className="text-rose-500">*</span>
                    </label>
                    {checkingDuplicate && <span className="text-[10px] text-blue-500 animate-pulse">Checking...</span>}
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.emiratesIdNumber}
                    onChange={(e) => handleEmiratesIdChange(e.target.value)}
                    placeholder="XXX-XXXX-XXXXXXX-X"
                    className={`w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      emiratesIdConflict ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                  />
                </div>

                {/* Nationality */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nationality <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.nationality}
                    onChange={(e) => setFormData((prev) => ({ ...prev, nationality: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {COMMON_NATIONALITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Personal Mobile */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Personal Mobile <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.personalMobile}
                    onChange={(e) => setFormData((prev) => ({ ...prev, personalMobile: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Passport Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Passport Number <span className="text-slate-400 font-normal">(Metadata)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.passportNumber}
                    onChange={(e) => setFormData((prev) => ({ ...prev, passportNumber: e.target.value.toUpperCase().trim() }))}
                    className="w-full px-3 py-2 text-xs uppercase font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Passport Expiry Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Passport Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.passportExpiry}
                    onChange={(e) => setFormData((prev) => ({ ...prev, passportExpiry: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 3: WORK DETAILS */}
            {/* ========================================================================= */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-700/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      3. Work & Operational Details
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Branch assignment, shift schedule, manager hierarchy, and contract structure</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.branchId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, branchId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {safeBranches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                    {safeBranches.length === 0 && (
                      <option value="b_dxb">ALLIED DELIVERY SERVICES L.L.C</option>
                    )}
                  </select>
                </div>

                <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label><select aria-label="Employee state" value={formData.state} onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))} className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"><option value="">Select state</option>{['Abu Dhabi', 'Al Ain', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
{/* Reporting Manager */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reporting Manager
                  </label>
                  <select
                    value={formData.managerId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, managerId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Reporting Manager --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.designation})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shift */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shift Schedule
                  </label>
                  <select
                    value={formData.shiftId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, shiftId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Shift --</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.start_time} - {s.end_time})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Designation */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Designation / Role <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData((prev) => ({ ...prev, designation: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {designations.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                    {designations.length === 0 && (
                      <option value={employee.designation}>{employee.designation}</option>
                    )}
                  </select>
                </div>

                {/* Contract / Visa Category */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contract / Visa Category
                  </label>
                  <select
                    value={formData.contractor}
                    onChange={(e) => setFormData((prev) => ({ ...prev, contractor: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getAuthoritativeContractorOptions(formData.contractor || employee.contractor).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Department */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, departmentId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {safeDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operational Team */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Operational Team <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.teamId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, teamId: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- No Team Assigned --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date of Joining */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Date of Joining <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.joiningDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, joiningDate: e.target.value }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Base Salary Per Month (AED) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Base Salary (AED / Month)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">AED</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={formData.basicSalary}
                      onChange={(e) => setFormData((prev) => ({ ...prev, basicSalary: Number(e.target.value) || 0 }))}
                      className="w-full pl-12 pr-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Current Operational Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Operational Status
                  </label>
                  <select
                    value={formData.currentStatus}
                    onChange={(e) => setFormData((prev) => ({ ...prev, currentStatus: e.target.value as any }))}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="Assigned / Active">Assigned / Active</option>
                    <option value="Available / Unassigned">Available / Unassigned</option>
                    <option value="On Leave">On Leave</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Absconding">Absconding</option>
                    <option value="Terminated">Terminated</option>
                    <option value="Exited">Exited</option>
                  </select>
                </div>

                {/* Status Change Reason */}
                {formData.currentStatus !== employee.current_status && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                      Status Change Reason <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.statusReason}
                      onChange={(e) => setFormData((prev) => ({ ...prev, statusReason: e.target.value }))}
                      placeholder="e.g. Returned from annual leave / Reassigned to Dubai branch"
                      className="w-full px-3 py-2 text-xs bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ========================================================================= */}
            {/* SECTION 4: PROGRESSIVE DISCLOSURE (Additional Details) */}
            {/* ========================================================================= */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
                className="w-full px-5 py-3.5 bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    4. Additional Details & Settings
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{showAdditionalDetails ? 'Collapse' : 'Expand'}</span>
                  {showAdditionalDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {showAdditionalDetails && (
                <div className="p-5 bg-white dark:bg-slate-900 space-y-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Address */}
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Residential Address in UAE
                      </label>
                      <input
                        type="text"
                        value={formData.address}
                        onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                        placeholder="e.g. Al Quoz Industrial Area 3, Accommodation Block B, Dubai"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Leave Opening Balance */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Leave Opening Balance (Days)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="60"
                        value={formData.leaveOpeningBalance}
                        onChange={(e) => setFormData((prev) => ({ ...prev, leaveOpeningBalance: Number(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Emergency Contact Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Emergency Contact Name
                      </label>
                      <input
                        type="text"
                        value={formData.emergencyContactName}
                        onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactName: e.target.value }))}
                        placeholder="e.g. Tariq Mehmood (Brother)"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Emergency Contact Phone */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Emergency Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.emergencyContactPhone}
                        onChange={(e) => setFormData((prev) => ({ ...prev, emergencyContactPhone: e.target.value }))}
                        placeholder="e.g. +971 50 111 2222"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Profile Photo URL */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Profile Photo URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={formData.photo}
                          onChange={(e) => setFormData((prev) => ({ ...prev, photo: e.target.value }))}
                          placeholder="https://..."
                          className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                          {formData.photo ? (
                            <img src={formData.photo} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <Camera className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Internal Operational Notes
                      </label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="Internal notes, compliance remarks or special conditions..."
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Action Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/80 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <div className="flex items-center gap-3">
              {emiratesIdConflict && (
                <span className="text-xs text-amber-600 font-medium hidden sm:inline-block">
                  Duplicate Emirates ID detected. Action blocked.
                </span>
              )}
              <button
                type="submit"
                disabled={submitting || !!emiratesIdConflict || !!codeConflict}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

