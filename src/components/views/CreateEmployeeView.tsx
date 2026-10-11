import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  FileText,
  ChevronDown,
  Search,
  Plus,
  ExternalLink,
  Globe,
  Briefcase,
  MapPin,
  Camera,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { clientStorageService } from '../../services/fileStorageService';
import {
  DbEmployeeMaster,
  DbBranch,
  DbDepartment,
  DbDesignation,
  DbVisaContractorType,
  DbVendorCompany,
} from '../../types/database';
import { AUTHORITATIVE_BRANCHES, AUTHORITATIVE_CONTRACTOR_CATEGORIES, mapToAuthoritativeBranch } from '../../lib/branches';
import { STANDARD_DESIGNATIONS } from '../../lib/designations';

interface CreateEmployeeViewProps {
  onNavigateModule?: (module: string, params?: any) => void;
  onOpenEmployee360?: (employeeId: string) => void;
  onAssignProjectForEmployee?: (employee: DbEmployeeMaster) => void;
  onAssignVehicleForEmployee?: (employee: DbEmployeeMaster) => void;
  onAssignSimForEmployee?: (employee: DbEmployeeMaster) => void;
  lang?: 'EN' | 'AR';
}

const COMMON_NATIONALITIES = [
  'Pakistan',
  'India',
  'Bangladesh',
  'United Arab Emirates',
  'Egypt',
  'Philippines',
  'Nepal',
  'Sri Lanka',
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
  'Afghanistan',
  'Indonesia',
  'United Kingdom',
  'Other',
];

const INITIAL_STATUS_OPTIONS = [
  { value: 'Available / Unassigned', label: 'Available / Unassigned (Default)' },
  { value: 'Assigned / Active', label: 'Assigned / Active' },
  { value: 'On Leave', label: 'On Leave' },
  { value: 'On Hold', label: 'On Hold' },
];

export const CreateEmployeeView: React.FC<CreateEmployeeViewProps> = ({
  onNavigateModule,
  onOpenEmployee360,
  onAssignProjectForEmployee,
  onAssignVehicleForEmployee,
  onAssignSimForEmployee,
  lang = 'EN',
}) => {
  // Live Masters
  const [branches, setBranches] = useState<DbBranch[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [designations, setDesignations] = useState<DbDesignation[]>([]);
  const [visaContractorTypes, setVisaContractorTypes] = useState<DbVisaContractorType[]>([]);
  const [vendorCompanies, setVendorCompanies] = useState<DbVendorCompany[]>([]);
  const [loadingMasters, setLoadingMasters] = useState(true);

  // Section 1: Personal Details
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [emiratesIdNumber, setEmiratesIdNumber] = useState('');
  const [personalMobile, setPersonalMobile] = useState('');
  const [nationality, setNationality] = useState('Pakistan');
  const [personalNumber, setPersonalNumber] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactNumber, setEmergencyContactNumber] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  // Section 2: Work Details
  const [employeeCode, setEmployeeCode] = useState('');
  const [isCodeOverridden, setIsCodeOverridden] = useState(false);
  const [codeOverrideReason, setCodeOverrideReason] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [employeeState, setEmployeeState] = useState('');
  const [branchId, setBranchId] = useState('b_dxb');
  const [visaContractorType, setVisaContractorType] = useState('Own');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('Delivery Bike Rider');
  const [currentStatus, setCurrentStatus] = useState('Available / Unassigned');
  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');

  // Section 3: Passport / License Details
  const [passportNumber, setPassportNumber] = useState('');
  const [passportExpiry, setPassportExpiry] = useState('');
  const [drivingLicenseNumber, setDrivingLicenseNumber] = useState('');
  const [drivingLicenseExpiry, setDrivingLicenseExpiry] = useState('');

  // UI State
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<DbEmployeeMaster | null>(null);

  // Duplicate Check Conflict
  const [duplicateConflict, setDuplicateConflict] = useState<{
    id: string;
    employeeCode: string;
    fullName: string;
    field: string;
  } | null>(null);

  // Quick inline new vendor modal
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorCity, setNewVendorCity] = useState('Dubai');
  const [creatingVendor, setCreatingVendor] = useState(false);

  // Searchable dropdown state for Nationality
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [showNationalityDropdown, setShowNationalityDropdown] = useState(false);
  const nationalityRef = useRef<HTMLDivElement>(null);

  // Load masters on mount
  useEffect(() => {
    loadMastersAndNextCode();

    const handleClickOutside = (e: MouseEvent) => {
      if (nationalityRef.current && !nationalityRef.current.contains(e.target as Node)) {
        setShowNationalityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadMastersAndNextCode = async () => {
    setLoadingMasters(true);
    try {
      const [bList, dList, desList, vctList, venList, code] = await Promise.all([
        masterEmployeeService.getBranches(),
        masterEmployeeService.getDepartments(),
        masterEmployeeService.getDesignations(),
        masterEmployeeService.getVisaContractorTypes(),
        masterEmployeeService.getVendors(),
        masterEmployeeService.getNextEmployeeCode(),
      ]);

      if (Array.isArray(bList) && bList.length > 0) {
        setBranches(bList);
        setBranchId(bList[0].id);
      }
      if (Array.isArray(dList) && dList.length > 0) {
        setDepartments(dList);
        setDepartmentId(dList[0].id);
      }
      if (Array.isArray(desList) && desList.length > 0) {
        setDesignations(desList);
      }
      if (Array.isArray(vctList) && vctList.length > 0) {
        setVisaContractorTypes(vctList);
      }
      if (Array.isArray(venList) && venList.length > 0) {
        setVendorCompanies(venList);
        setVendorId(venList[0].id);
        setVendorName(venList[0].name);
      }

      setEmployeeCode(code || 'EMP-10001');
    } catch (err) {
      console.error('Failed to load employee masters:', err);
    } finally {
      setLoadingMasters(false);
    }
  };

  const handleRefreshNextCode = async () => {
    setLoadingNextCode(true);
    try {
      const code = await masterEmployeeService.getNextEmployeeCode();
      if (code) setEmployeeCode(code);
    } catch (err) {
      console.error('Failed to refresh next employee code:', err);
    } finally {
      setLoadingNextCode(false);
    }
  };

  // Emirates ID Auto-formatting: 784-XXXX-XXXXXXX-X
  const handleEmiratesIdChange = (val: string) => {
    let raw = val.replace(/[^0-9]/g, '');
    if (raw.length > 15) raw = raw.slice(0, 15);
    let formatted = raw;
    if (raw.length > 3) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    }
    if (raw.length > 7) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7)}`;
    }
    if (raw.length > 14) {
      formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 14)}-${raw.slice(14, 15)}`;
    }
    setEmiratesIdNumber(formatted);
  };

  // Duplicate Emirates ID checking debounced
  useEffect(() => {
    const trimmed = emiratesIdNumber.trim();
    const cleanEid = trimmed.replace(/\D/g, '');
    if (cleanEid.length < 15) {
      setDuplicateConflict(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const found = await masterEmployeeService.searchMasterEmployees(trimmed);
        if (found && found.length > 0) {
          setDuplicateConflict({
            id: found[0].id,
            employeeCode: found[0].employee_code,
            fullName: found[0].full_name,
            field: 'Emirates ID',
          });
        } else {
          setDuplicateConflict(null);
        }
      } catch {
        // quiet fallback
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [emiratesIdNumber]);

  const handleCreateVendorInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVendorName.trim()) return;
    setCreatingVendor(true);
    try {
      const created = await masterEmployeeService.createVendor({
        name: newVendorName.trim(),
        city: newVendorCity.trim() || 'Dubai',
      });
      if (created && created.id) {
        setVendorCompanies((prev) => [created, ...prev]);
        setVendorId(created.id);
        setVendorName(created.name);
        setShowAddVendorModal(false);
        setNewVendorName('');
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to create vendor');
    } finally {
      setCreatingVendor(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    const trimmedMobile = personalMobile.trim();
    const trimmedEid = emiratesIdNumber.trim();

    if (!trimmedName) {
      setFormError('Full Name is required.');
      return;
    }
    if (!trimmedMobile) {
      setFormError('Mobile Number is required.');
      return;
    }
    if (!trimmedEid) {
      setFormError('Emirates ID is required.');
      return;
    }

    const eidClean = trimmedEid.replace(/\D/g, '');
    if (eidClean.length !== 15 || !eidClean.startsWith('784')) {
      setFormError('Emirates ID must be in valid UAE format: 784-XXXX-XXXXXXX-X (15 digits starting with 784).');
      return;
    }

    if (isCodeOverridden) {
      if (!employeeCode.trim()) {
        setFormError('Manual Employee Code cannot be blank.');
        return;
      }
      if (!codeOverrideReason.trim()) {
        setFormError('A mandatory justification reason is required to manually override auto-generated Employee Code.');
        return;
      }
    }

    if (visaContractorType === 'Vendor' && !vendorId && !vendorName) {
      setFormError('Please select or create a Vendor Company for Vendor contractor type.');
      return;
    }

    const parts = trimmedName.split(' ').filter(Boolean);
    const firstName = parts[0] || 'Employee';
    const lastName = parts.slice(1).join(' ') || firstName;

    const selectedBranch = branches.find((b) => b.id === branchId);

    setSubmitting(true);
    try {
      const payload: Partial<DbEmployeeMaster> = {
        employee_code: isCodeOverridden ? employeeCode.trim() : undefined,
        code_overridden: isCodeOverridden,
        code_override_reason: isCodeOverridden ? codeOverrideReason.trim() : undefined,
        first_name: firstName,
        last_name: lastName,
        full_name: trimmedName,
        personal_mobile: trimmedMobile,
        company_mobile: personalNumber.trim() || trimmedMobile,
        emirates_id_number: trimmedEid,
        nationality,
        date_of_birth: dateOfBirth || undefined,
        gender,
        address: address.trim() || undefined,
        emergency_contact_name: emergencyContactName.trim() || undefined,
        emergency_contact_phone: emergencyContactNumber.trim() || undefined,
        email: email.trim() || undefined,
        joining_date: joiningDate,
        state: employeeState || null,
        branch_id: branchId || 'b_dxb',
        department_id: departmentId || 'dept_ops',
        designation: designation || 'Delivery Bike Rider',
        job_title: designation || 'Delivery Bike Rider',
        visa_contractor_type: visaContractorType,
        vendor_id: visaContractorType === 'Vendor' ? vendorId : undefined,
        vendor_name: visaContractorType === 'Vendor' ? vendorName : undefined,
        contractor: visaContractorType === 'Vendor' ? (vendorName || 'Vendor') : (visaContractorType as any),
        current_status: currentStatus as any,
        passport_number: passportNumber.trim() || undefined,
        passport_expiry: passportExpiry || undefined,
        driving_license_number: drivingLicenseNumber.trim() || undefined,
        driving_license_expiry: drivingLicenseExpiry || undefined,
        is_archived: false,
      };

      const res = await masterEmployeeService.createMasterEmployee(payload);
      if (res.success && res.employee) {
        let finalEmp = res.employee;

        // If a profile photo file was selected, upload directly via private storage architecture
        if (photoFile) {
          try {
            const uploadResult = await clientStorageService.uploadDocumentDirectly(
              photoFile,
              {
                entityType: 'Employee',
                entityId: finalEmp.id,
                entityName: finalEmp.full_name,
                documentTypeId: 'dt_photo',
                documentTypeName: 'Profile Photo',
                documentNumber: `PHOTO-${finalEmp.employee_code}`,
                notes: 'Profile photo uploaded during employee creation',
              }
            );

            if (uploadResult?.document?.id) {
              const updateRes = await masterEmployeeService.updateMasterEmployee(finalEmp.id, {
                photo_document_id: uploadResult.document.id,
                photo: uploadResult.document.id,
              });
              if (updateRes.success && updateRes.employee) {
                finalEmp = updateRes.employee;
              }
            }
          } catch (uploadErr: any) {
            console.warn('Profile picture upload notice:', uploadErr?.message || uploadErr);
          }
        }

        setCreatedEmployee(finalEmp);
      } else {
        const msg = res.error || 'Failed to create employee';
        setFormError(msg);
        if (msg.toLowerCase().includes('already belongs') || msg.toLowerCase().includes('already assigned')) {
          const match = await masterEmployeeService.searchMasterEmployees(trimmedEid);
          if (match && match.length > 0) {
            setDuplicateConflict({
              id: match[0].id,
              employeeCode: match[0].employee_code,
              fullName: match[0].full_name,
              field: 'Emirates ID',
            });
          }
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'A network or server error occurred during employee creation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForNewEmployee = () => {
    setCreatedEmployee(null);
    setFullName('');
    setPersonalMobile('');
    setEmiratesIdNumber('');
    setNationality('Pakistan');
    setDateOfBirth('');
    setGender('Male');
    setPersonalNumber('');
    setAddress('');
    setEmergencyContactName('');
    setEmergencyContactNumber('');
    setPhotoFile(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    setPhotoUploadError(null);
    setEmail('');
    setIsCodeOverridden(false);
    setCodeOverrideReason('');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setCurrentStatus('Available / Unassigned');
    setPassportNumber('');
    setPassportExpiry('');
    setDrivingLicenseNumber('');
    setDrivingLicenseExpiry('');
    setFormError(null);
    setDuplicateConflict(null);
    handleRefreshNextCode();
  };

  const handleCancel = () => {
    if (onNavigateModule) {
      onNavigateModule('riders_drivers');
    } else {
      window.history.back();
    }
  };

  const filteredNationalities = COMMON_NATIONALITIES.filter((n) =>
    n.toLowerCase().includes(nationalitySearch.toLowerCase())
  );
  const designationOptions = Array.from(new Set([
    'Delivery Bike Rider',
    'Delivery Car Driver',
    'Fleet Supervisor',
    'Warehouse Specialist',
    'Office Assistant',
    ...STANDARD_DESIGNATIONS,
    ...designations.map((des) => des.name),
  ]));

  // =========================================================================
  // POST-CREATE CLEAN SUCCESS WORKFLOW VIEW
  // =========================================================================
  if (createdEmployee) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-xs text-center space-y-6">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Employee Created Successfully
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              New master employee record has been registered with atomic sequence validation.
            </p>
          </div>

          {/* Summary Details Box */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-lg p-4 text-left max-w-lg mx-auto grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Full Name</span>
              <span className="font-semibold text-slate-900 dark:text-white">{createdEmployee.full_name}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Employee Code</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{createdEmployee.employee_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Status</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">{createdEmployee.current_status || 'Available / Unassigned'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Branch</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{mapToAuthoritativeBranch(branches.find((b) => b.id === createdEmployee.branch_id)?.name || createdEmployee.branch_id)}</span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-400 block text-[11px]">Visa / Contractor</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{createdEmployee.visa_contractor_type || createdEmployee.contractor || 'Own'}</span>
            </div>
          </div>

          {/* Actions: Primary & Secondary */}
          <div className="space-y-3 pt-2">
            {/* Primary Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                id="btn-post-create-assign-project"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', `/projects/assign?employeeId=${createdEmployee.id}`);
                  }
                  if (onAssignProjectForEmployee) {
                    onAssignProjectForEmployee(createdEmployee);
                  } else if (onNavigateModule) {
                    onNavigateModule('projects_assign', { employeeId: createdEmployee.id });
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Assign Project</span>
              </button>

              <button
                type="button"
                id="btn-post-create-view-employee"
                onClick={() => {
                  if (onOpenEmployee360) {
                    onOpenEmployee360(createdEmployee.id);
                  } else if (onNavigateModule) {
                    onNavigateModule('riders_drivers');
                  }
                }}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5" />
                <span>View Employee</span>
              </button>
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                id="btn-post-create-another"
                onClick={handleResetForNewEmployee}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Create Another Employee
              </button>

              <button
                type="button"
                id="btn-post-create-back"
                onClick={handleCancel}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors"
              >
                Back to Employee Management
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN COMPACT 4-COLUMN WORKSPACE FORM
  // =========================================================================
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
      {/* Top Header & Quick Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 dark:text-white">Create Employee</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              Master Record
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Register a new employee into the enterprise workforce registry.
          </p>
        </div>

        {/* Top Header Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            id="btn-cancel-create-employee-top"
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors"
          >
            Cancel
          </button>
          <button
            id="btn-submit-create-employee-top"
            type="button"
            onClick={() => handleSubmit()}
            disabled={submitting}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Creating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Create Employee</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {formError && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 flex items-start gap-2.5 text-red-700 dark:text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Validation Error: </span>
            <span>{formError}</span>
          </div>
        </div>
      )}

      {/* Duplicate Emirates ID Conflict Warning */}
      {duplicateConflict && (
        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-start justify-between gap-3 text-amber-800 dark:text-amber-200 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <span className="font-bold">Duplicate Emirates ID: </span>
              Already registered to <span className="font-semibold">{duplicateConflict.fullName}</span> ({duplicateConflict.employeeCode}).
            </div>
          </div>
          {onOpenEmployee360 && (
            <button
              type="button"
              onClick={() => onOpenEmployee360(duplicateConflict.id)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold rounded transition-colors shrink-0 flex items-center gap-1"
            >
              <span>View Record</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Unified Enterprise Form Card */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-xs space-y-6">
        {/* SECTION 1: PERSONAL DETAILS */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-3.5">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Personal Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="input-employee-full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Muhammad Ali Khan"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Gender
              </label>
              <select
                id="select-employee-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Date of Birth */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Date of Birth
              </label>
              <input
                id="input-employee-dob"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Emirates ID */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Emirates ID <span className="text-red-500">*</span>
              </label>
              <input
                id="input-employee-emirates-id"
                type="text"
                required
                value={emiratesIdNumber}
                onChange={(e) => handleEmiratesIdChange(e.target.value)}
                placeholder="784-XXXX-XXXXXXX-X"
                className={`w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  duplicateConflict ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300 dark:border-slate-700'
                }`}
              />
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                id="input-employee-mobile"
                type="tel"
                required
                value={personalMobile}
                onChange={(e) => setPersonalMobile(e.target.value)}
                placeholder="050 123 4567"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Nationality */}
            <div ref={nationalityRef} className="relative">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nationality <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNationalityDropdown(!showNationalityDropdown)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                <span>{nationality}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {showNationalityDropdown && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded shadow-lg p-2 max-h-52 overflow-y-auto">
                  <div className="relative mb-1.5">
                    <Search className="w-3 h-3 absolute left-2 top-2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search nationality..."
                      value={nationalitySearch}
                      onChange={(e) => setNationalitySearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                  <div className="space-y-0.5">
                    {filteredNationalities.map((nat) => (
                      <button
                        key={nat}
                        type="button"
                        onClick={() => {
                          setNationality(nat);
                          setShowNationalityDropdown(false);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          nationality === nat
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {nat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Personal Number (optional) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Personal Number <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="input-employee-personal-number"
                type="tel"
                value={personalNumber}
                onChange={(e) => setPersonalNumber(e.target.value)}
                placeholder="Secondary phone / WhatsApp"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Emergency Contact Name (optional) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Emergency Contact Name <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="input-employee-emergency-name"
                type="text"
                value={emergencyContactName}
                onChange={(e) => setEmergencyContactName(e.target.value)}
                placeholder="Next of kin / guardian"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Emergency Contact Number (optional) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Emergency Contact Number <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="input-employee-emergency-phone"
                type="tel"
                value={emergencyContactNumber}
                onChange={(e) => setEmergencyContactNumber(e.target.value)}
                placeholder="+971 50 000 0000"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Email Address (optional) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email Address <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="input-employee-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@example.com"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Profile Picture (File Upload via Cloudflare R2 / Private Storage) */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Profile Picture <span className="text-slate-400 text-[10px]">(Optional — JPG, PNG, WEBP)</span>
              </label>

              <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-200 dark:border-slate-700">
                {/* Photo Thumbnail or Neutral User Icon */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                  {photoPreviewUrl ? (
                    <img
                      src={photoPreviewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>

                {/* File selector & Selected file details */}
                <div className="flex-1 min-w-0">
                  {photoFile ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                          {photoFile.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(photoFile.size / 1024).toFixed(1)} KB • Ready for secure R2 upload
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoFile(null);
                          if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
                          setPhotoPreviewUrl(null);
                          setPhotoUploadError(null);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Remove photo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="input-employee-photo-file"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded shadow-xs hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Choose File</span>
                      </label>
                      <input
                        id="input-employee-photo-file"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              setPhotoUploadError('Please select a valid image file (JPG, PNG, WEBP).');
                              return;
                            }
                            if (file.size > 5 * 1024 * 1024) {
                              setPhotoUploadError('File size exceeds 5 MB limit.');
                              return;
                            }
                            setPhotoUploadError(null);
                            setPhotoFile(file);
                            const url = URL.createObjectURL(file);
                            setPhotoPreviewUrl(url);
                          }
                        }}
                      />
                      <span className="text-[11px] text-slate-400 truncate">
                        No file chosen
                      </span>
                    </div>
                  )}
                  {photoUploadError && (
                    <p className="text-[10px] text-rose-500 mt-1">{photoUploadError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Address (optional) */}
            <div className="sm:col-span-2 lg:col-span-4">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Residential Address <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <input
                id="input-employee-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Building / Flat, Area, Emirate (e.g. Al Quoz Industrial Area 3, Dubai)"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: WORK DETAILS */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-3.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Work Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            {/* Employee Code */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Employee Code
                </label>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500 select-none">
                  <input
                    type="checkbox"
                    checked={isCodeOverridden}
                    onChange={(e) => setIsCodeOverridden(e.target.checked)}
                    className="w-3 h-3 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Override</span>
                </label>
              </div>
              <input
                id="input-employee-code"
                type="text"
                readOnly={!isCodeOverridden}
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="EMP-00001"
                className={`w-full px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-all ${
                  isCodeOverridden
                    ? 'bg-white dark:bg-slate-800 border-2 border-amber-400 text-slate-900 dark:text-white'
                    : 'bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed'
                }`}
              />
            </div>

            {/* Joining Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Joining Date <span className="text-red-500">*</span>
              </label>
              <input
                id="input-employee-joining-date"
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Branch <span className="text-red-500">*</span>
              </label>
              <select
                id="select-employee-branch"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {(branches.length > 0 ? branches : AUTHORITATIVE_BRANCHES).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div><label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">State</label><select aria-label="Employee state" value={employeeState} onChange={(e) => setEmployeeState(e.target.value)} className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"><option value="">Select state</option>{['Abu Dhabi', 'Al Ain', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'].map((state) => <option key={state} value={state}>{state}</option>)}</select></div>
{/* Visa / Contractor Type */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Visa / Contractor Type <span className="text-red-500">*</span>
              </label>
              <select
                id="select-employee-visa-type"
                value={visaContractorType}
                onChange={(e) => setVisaContractorType(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {AUTHORITATIVE_CONTRACTOR_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Department (optional) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Department <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <select
                id="select-employee-department"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {departments.length === 0 ? (
                  <>
                    <option value="dept_ops">Operations Fleet Delivery</option>
                    <option value="dept_logistics">Logistics & Supply Chain</option>
                    <option value="dept_admin">Admin & Office Support</option>
                  </>
                ) : (
                  departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Designation / Role (optional workforce metadata) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Designation / Job Title <span className="text-slate-400 text-[10px]">(Optional)</span>
              </label>
              <select
                id="select-employee-designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {designationOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Initial Operational Status */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Initial Operational Status <span className="text-red-500">*</span>
              </label>
              <select
                id="select-employee-initial-status"
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {INITIAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor Company (Conditional when Vendor is selected) */}
            {visaContractorType === 'Vendor' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    Vendor Company <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddVendorModal(true)}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + New Vendor
                  </button>
                </div>
                <select
                  id="select-employee-vendor"
                  value={vendorId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setVendorId(id);
                    const ven = vendorCompanies.find((v) => v.id === id);
                    if (ven) setVendorName(ven.name);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {vendorCompanies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.city || 'UAE'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isCodeOverridden && (
            <div className="mt-3">
              <label className="block text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1">
                Mandatory Code Override Justification <span className="text-red-500">*</span>
              </label>
              <input
                id="input-employee-override-reason"
                type="text"
                required
                value={codeOverrideReason}
                onChange={(e) => setCodeOverrideReason(e.target.value)}
                placeholder="Reason for manual code override..."
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {/* SECTION 3: PASSPORT / LICENSE DETAILS */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2 mb-3.5">
            <h2 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              Passport / License Details <span className="text-slate-400 font-normal lowercase text-[10px]">(optional regulatory)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
            {/* Passport Number */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Passport Number
              </label>
              <input
                id="input-employee-passport-number"
                type="text"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value.toUpperCase())}
                placeholder="e.g. AB1234567"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white uppercase font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Passport Expiry Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Passport Expiry Date
              </label>
              <input
                id="input-employee-passport-expiry"
                type="date"
                value={passportExpiry}
                onChange={(e) => setPassportExpiry(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* UAE Driving License Number */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                UAE Driving License Number
              </label>
              <input
                id="input-employee-driving-license"
                type="text"
                value={drivingLicenseNumber}
                onChange={(e) => setDrivingLicenseNumber(e.target.value.toUpperCase())}
                placeholder="e.g. DXB-DL-12345"
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white uppercase font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Driving License Expiry Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Driving License Expiry Date
              </label>
              <input
                id="input-employee-license-expiry"
                type="date"
                value={drivingLicenseExpiry}
                onChange={(e) => setDrivingLicenseExpiry(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              id="btn-back-to-employees-bottom"
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Employee Management</span>
            </button>

            <button
              id="btn-cancel-create-employee-bottom"
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium rounded transition-colors"
            >
              Cancel
            </button>
          </div>

          <button
            id="btn-submit-create-employee-bottom"
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
      </form>

      {/* QUICK INLINE MODAL: ADD VENDOR COMPANY */}
      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg max-w-sm w-full p-5 shadow-xl">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
              Add Vendor Company
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
              Register a new vendor company for contractor management.
            </p>

            <form onSubmit={handleCreateVendorInline} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="e.g. Al Futtaim Logistics LLC"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Emirate / City
                </label>
                <input
                  type="text"
                  value={newVendorCity}
                  onChange={(e) => setNewVendorCity(e.target.value)}
                  placeholder="e.g. Dubai"
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  disabled={creatingVendor}
                  className="px-3 py-1 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingVendor}
                  className="px-3.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded flex items-center gap-1"
                >
                  {creatingVendor ? <RefreshCw className="w-3 h-3 animate-spin" /> : null}
                  <span>Save Vendor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

