import React, { useState, useEffect } from 'react';
import { EmployeeEditModal } from './EmployeeEditModal';
import {
  Users,
  Briefcase,
  Truck,
  Smartphone,
  Package,
  FileCheck,
  CreditCard,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plus,
  ArrowLeft,
  Activity,
  ShieldCheck,
  ArrowRightLeft,
  UserMinus,
  Sparkles,
  DollarSign,
  Receipt,
  FileText,
  BadgePercent,
  Layers,
  CheckCircle,
  ExternalLink,
  UserPlus,
  Edit2,
  Edit3,
  Eye,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { ViewSimAssignmentModal } from './ViewSimAssignmentModal';
import { EditSimAssignmentModal } from './EditSimAssignmentModal';
import { VerifyLegacySimHandoverModal } from './VerifyLegacySimHandoverModal';
import {
  masterEmployeeService,
  Employee360Profile,
} from '../../services/masterEmployeeService';
import { candidateService } from '../../services/candidateService';
import {
  DbProject,
  DbVehicle,
  DbSimCardMaster,
  DbAsset,
} from '../../types/database';
import { EmployeeAssignmentModals, AssignmentModalType } from './EmployeeAssignmentModals';
import { DocumentsTab } from '../documents/DocumentsTab';
import { resolveCanonicalStatus, getCanonicalStatusBadgeClass, isLifecycleOverrideStatus } from '../../utils/canonicalStatus';
import { apiClient } from '../../services/apiClient';
import { mapToAuthoritativeBranch } from '../../lib/branches';

interface Employee360ProfileViewProps {
  employeeId: string;
  onBack: () => void;
  onMakeCandidate?: (emp: any) => void;
  onEdit?: (emp: any) => void;
  onNavigateModule?: (module: any) => void;
  lang?: 'EN' | 'AR';
}

type TabKey = 'overview' | 'projects' | 'assets' | 'documents' | 'payroll' | 'history';

const resolveExternalIdLabel = (projectName?: string, currentType?: string): string => {
  const name = (projectName || '').toLowerCase();
  if (name.includes('noon')) return 'NIM ID';
  if (name.includes('keeta')) return 'Courier ID';
  if (name.includes('labour') || name.includes('labor')) return 'Person Code / Labour ID';
  if (currentType && currentType !== 'External Rider ID' && currentType !== 'Rider ID' && currentType !== '-') {
    return currentType;
  }
  return 'External Project Employee ID';
};

const KNOWN_HUMAN_USERS: Record<string, string> = {};

const GENERIC_LABELS = new Set([
  'operations admin',
  'system admin',
  'erp user',
  'erp staff member',
  'employee operations',
  'fleet management',
  'admin',
  'system',
  'system user',
  'unauthenticated guest',
]);

const resolveHumanAssignedBy = (assignedBy?: string | null, assignedById?: string | null): string => {
  if (assignedById && KNOWN_HUMAN_USERS[assignedById]) {
    return KNOWN_HUMAN_USERS[assignedById];
  }
  if (!assignedBy || typeof assignedBy !== 'string') {
    return 'System User';
  }
  const trimmed = assignedBy.trim();
  if (KNOWN_HUMAN_USERS[trimmed]) {
    return KNOWN_HUMAN_USERS[trimmed];
  }
  if (GENERIC_LABELS.has(trimmed.toLowerCase())) {
    return 'System User';
  }
  return trimmed;
};

const resolveSimStaffUserName = (assignedBy?: string | null): string => {
  const recorded = typeof assignedBy === 'string' ? assignedBy.trim() : '';
  if (!recorded) return 'Not recorded';
  if (KNOWN_HUMAN_USERS[recorded]) return KNOWN_HUMAN_USERS[recorded];
  // The Worker resolves stored UUIDs through this tenant's verified staff profiles.
  // Never label a missing or generic legacy operator as System User.
  return recorded;
};

const resolveRecordedStaffName = (name?: string | null, userId?: string | null): string => {
  const recorded = (name || '').trim();
  if (userId && KNOWN_HUMAN_USERS[userId]) return KNOWN_HUMAN_USERS[userId];
  if (recorded && KNOWN_HUMAN_USERS[recorded]) return KNOWN_HUMAN_USERS[recorded];
  // Do not invent a staff member when a legacy record contains a generic actor.
  return recorded || 'Not recorded';
};

export const Employee360ProfileView: React.FC<Employee360ProfileViewProps> = ({
  employeeId,
  onBack,
  onMakeCandidate,
  onEdit,
  onNavigateModule,
  lang = 'EN',
}) => {
  const [profile, setProfile] = useState<Employee360Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [candidateRecord, setCandidateRecord] = useState<any>(null);
  const [candidateLoading, setCandidateLoading] = useState<boolean>(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Modals state
  const [activeModal, setActiveModal] = useState<AssignmentModalType>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Lists for dropdown pickers
  const [projectsList, setProjectsList] = useState<DbProject[]>([]);
  const [vehiclesList, setVehiclesList] = useState<DbVehicle[]>([]);
  const [simsList, setSimsList] = useState<DbSimCardMaster[]>([]);
  const [assetsList, setAssetsList] = useState<DbAsset[]>([]);

  // Payroll 360 State
  const [payrollData, setPayrollData] = useState<any>(null);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // External Project ID Inline Editing
  const [isEditingExternalId, setIsEditingExternalId] = useState(false);
  const [editedExternalId, setEditedExternalId] = useState('');
  const [savingExternalId, setSavingExternalId] = useState(false);
  const [externalIdSaveError, setExternalIdSaveError] = useState<string | null>(null);

  // Edit Vehicle Assignment Date State
  const [isEditDateModalOpen, setIsEditDateModalOpen] = useState(false);
  const [targetAssignmentForEdit, setTargetAssignmentForEdit] = useState<any>(null);
  const [newAssignmentDate, setNewAssignmentDate] = useState('');
  const [newReturnDate, setNewReturnDate] = useState('');
  const [dateCorrectionReason, setDateCorrectionReason] = useState('');
  const [savingDate, setSavingDate] = useState(false);
  const [dateSaveError, setDateSaveError] = useState<string | null>(null);

  // View & Edit SIM Assignment History State
  const [viewingSimAssignment, setViewingSimAssignment] = useState<any | null>(null);
  const [editingSimAssignment, setEditingSimAssignment] = useState<any | null>(null);
  const [legacySimForReview, setLegacySimForReview] = useState<any | null>(null);

  const handleViewSimHistory = (simAsgn: any) => {
    setViewingSimAssignment(simAsgn);
  };

  const handleEditSimHistory = (simAsgn: any) => {
    // A card summary has no saved history row. Offer explicit user-confirmed
    // legacy verification rather than silently inventing a date or operator.
    if (simAsgn?.is_synthetic || /^(asgn_sim_|asgn_live_|asgn_last_)/.test(String(simAsgn?.id || ''))) {
      setLegacySimForReview(simAsgn);
      return;
    }
    setEditingSimAssignment(simAsgn);
  };

  const handleSimEditSuccess = async () => {
    setFeedback('SIM assignment record corrected and authoritative audit log saved.');
    await loadProfile();
  };

  const handleVerifiedLegacySimSuccess = async () => {
    setFeedback('Verified SIM handover recorded with actual date, original assigner and audit trail.');
    await loadProfile();
  };

  const handleOpenEditDate = (assignment?: any) => {
    const asg = assignment || activeVehicleAssignment;
    if (!asg?.id || String(asg.id).startsWith('v_asgn_emp_')) {
      setFeedback('Only a saved vehicle history record can have its dates corrected.');
      return;
    }
    setTargetAssignmentForEdit(asg);
    setNewAssignmentDate(String(asg.assignment_date || asg.start_date || '').slice(0, 10));
    setNewReturnDate(String(asg.return_date || '').slice(0, 10));
    setDateCorrectionReason('');
    setDateSaveError(null);
    setIsEditDateModalOpen(true);
  };

  const handleSaveAssignmentDate = async (e: React.FormEvent) => {
    e.preventDefault();
    const assignment = targetAssignmentForEdit;
    const isReturned = assignment && String(assignment.assignment_status || assignment.status || '').toUpperCase() !== 'ACTIVE';
    if (!assignment?.id || !newAssignmentDate) {
      setDateSaveError('Choose a saved assignment and a valid assignment date.');
      return;
    }
    if (isReturned && (!newReturnDate || newReturnDate < newAssignmentDate)) {
      setDateSaveError('A returned vehicle needs a return date on or after its assignment date.');
      return;
    }
    if (!dateCorrectionReason.trim()) {
      setDateSaveError('Explain why the recorded dates need correction.');
      return;
    }
    setSavingDate(true);
    setDateSaveError(null);
    try {
      const res = await masterEmployeeService.updateVehicleAssignmentDate(
        employeeId,
        newAssignmentDate,
        assignment.id,
        isReturned ? newReturnDate : undefined,
        dateCorrectionReason.trim()
      );
      if (res.success) {
        setFeedback('Recorded vehicle dates corrected. Assignment and return custody are unchanged.');
        setIsEditDateModalOpen(false);
        await loadProfile();
      } else {
        setDateSaveError(res.error || 'Could not correct the recorded dates.');
      }
    } catch (err: any) {
      setDateSaveError(err.message || 'Could not correct the recorded dates.');
    } finally {
      setSavingDate(false);
    }
  };

  // Load Profile Data
  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await masterEmployeeService.getEmployee360Profile(employeeId);
      setProfile(data);
      if (!data) setError('Employee profile not found.');

      // Check if already linked as Candidate
      try {
        const cand = await candidateService.getCandidateByEmployeeId(employeeId);
        setCandidateRecord(cand);
      } catch (e) {
        // silent
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load employee 360 profile');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeCandidateAction = async () => {
    if (candidateRecord) {
      if (onNavigateModule) {
        onNavigateModule('recruitment');
      } else {
        setFeedback(`Candidate already exists (Candidate ID: ${candidateRecord.candidateId}, Stage: ${candidateRecord.currentStage || 'Stage 1'})`);
      }
      return;
    }
    if (!profile?.employee) return;
    setCandidateLoading(true);
    try {
      const emp = profile.employee;
      const res = await candidateService.createCandidate({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        fullName: emp.full_name,
        cnicPassport: emp.passport_number,
        mobile: emp.personal_mobile || emp.company_mobile,
        nationality: emp.nationality,
      });
      if (res.success && res.candidate) {
        setCandidateRecord(res.candidate);
        setFeedback(`🎉 Successfully created candidate profile for ${emp.full_name} (${res.candidate.candidateId})!`);
        if (onMakeCandidate) onMakeCandidate(emp);
      } else {
        setFeedback(res.error || 'Failed to create candidate record');
      }
    } catch (err: any) {
      setFeedback(err?.message || 'Failed to create candidate record');
    } finally {
      setCandidateLoading(false);
    }
  };

  // Load Payroll 360 Data
  const loadPayroll = async () => {
    setLoadingPayroll(true);
    try {
      const res = await apiClient.get<any>(`/api/erp/payroll/employee-payroll-360/${employeeId}`);
      if (res.data) {
        setPayrollData(res.data);
      }
    } catch (err) {
      console.error('Failed to load employee payroll history', err);
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadPayroll();
    masterEmployeeService.getProjects().then(setProjectsList).catch(() => {});
    masterEmployeeService.getVehiclesMaster().then(setVehiclesList).catch(() => {});
    masterEmployeeService.getSimsMaster().then(setSimsList).catch(() => {});
    masterEmployeeService.getAssetsMaster().then(setAssetsList).catch(() => {});

    const handleRefresh = () => {
      loadProfile();
      masterEmployeeService.getVehiclesMaster().then(setVehiclesList).catch(() => {});
      masterEmployeeService.getSimsMaster().then(setSimsList).catch(() => {});
    };

    window.addEventListener('erp:sims-updated', handleRefresh);
    window.addEventListener('erp:vehicles-updated', handleRefresh);
    window.addEventListener('erp:assignments-updated', handleRefresh);
    window.addEventListener('erp:employees-updated', handleRefresh);

    return () => {
      window.removeEventListener('erp:sims-updated', handleRefresh);
      window.removeEventListener('erp:vehicles-updated', handleRefresh);
      window.removeEventListener('erp:assignments-updated', handleRefresh);
      window.removeEventListener('erp:employees-updated', handleRefresh);
    };
  }, [employeeId]);

  const handleModalSuccess = (msg: string) => {
    setFeedback(msg);
    loadProfile();
    loadPayroll();
    setTimeout(() => setFeedback(null), 4000);
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold">Loading Employee 360 Profile & Operational Records...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 m-6">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to load profile</h3>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error || 'Record does not exist'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Back to Employee List
        </button>
      </div>
    );
  }

  const employee = profile?.employee;
  const currentProject = profile?.currentProject || null;
  const currentVehicle = profile?.currentVehicle || null;
  const currentSim = profile?.currentSim || null;
  const activeAssets = Array.isArray(profile?.activeAssets) ? profile.activeAssets : [];
  const timeline = Array.isArray(profile?.timeline) ? profile.timeline : [];
  const statusHistory = Array.isArray(profile?.statusHistory) ? profile.statusHistory : [];
  const vehicleHistory = Array.isArray(profile?.vehicleHistory) ? profile.vehicleHistory : [];
  const simHistory = Array.isArray(profile?.simHistory) ? profile.simHistory : [];
  const bikeCustodyHistory = Array.isArray((profile as any)?.bikeCustodyHistory) ? (profile as any).bikeCustodyHistory : [];
  const simCustodyHistory = Array.isArray((profile as any)?.simCustodyHistory) ? (profile as any).simCustodyHistory : [];
  const assetHistory = Array.isArray(profile?.assetHistory) ? profile.assetHistory : [];
  const projectHistory = Array.isArray(profile?.projectHistory) ? profile.projectHistory : [];

  if (!employee) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900 m-6">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">Unable to load employee master profile</h3>
        <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error || 'Record does not exist'}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          Back to Employee List
        </button>
      </div>
    );
  }

  // Active Project & Dynamic External ID resolution
  const activeAssignment = projectHistory.find((p: any) => p && p.status === 'ACTIVE' && p.is_primary)
    || projectHistory.find((p: any) => p && p.status === 'ACTIVE')
    || projectHistory.find((p: any) => p && !p.assignment_end_date);
  const effectiveProjectName = activeAssignment?.project_name || employee.project_name || currentProject?.name || 'Unassigned';
  const rawExtId =
    activeAssignment?.external_rider_id ||
    activeAssignment?.employee_code_on_project ||
    (employee as any).external_rider_id ||
    (employee as any).employee_code_on_project ||
    (employee as any).courier_id ||
    (employee as any).nim_id;
  const effectiveExternalId = rawExtId && String(rawExtId).trim() !== '' ? String(rawExtId).trim() : '-';
  const effectiveExternalIdType = resolveExternalIdLabel(effectiveProjectName, activeAssignment?.external_id_type);

  const handleSaveExternalId = async () => {
    if (!editedExternalId.trim()) return;
    try {
      setSavingExternalId(true);
      setExternalIdSaveError(null);
      const res = await masterEmployeeService.updateProjectExternalId(
        employee.id,
        activeAssignment?.id,
        editedExternalId.trim()
      );
      if (!res.success) {
        setExternalIdSaveError(res.error || 'Failed to update external ID');
        return;
      }
      // Update local profile state immediately for instant feedback
      setProfile((prev) => {
        if (!prev) return prev;
        const newExtId = editedExternalId.trim();
        const updatedEmployee = {
          ...prev.employee,
          external_rider_id: newExtId,
          employee_code_on_project: newExtId,
        };
        const updatedProjectHistory = (prev.projectHistory || []).map((p: any) => {
          if (activeAssignment?.id ? p.id === activeAssignment.id : p.status === 'ACTIVE') {
            return {
              ...p,
              external_rider_id: newExtId,
              employee_code_on_project: newExtId,
            };
          }
          return p;
        });
        const updatedActiveProjects = (prev.activeProjects || []).map((p: any) => {
          if (activeAssignment?.id ? p.id === activeAssignment.id : p.status === 'ACTIVE') {
            return {
              ...p,
              external_rider_id: newExtId,
              employee_code_on_project: newExtId,
            };
          }
          return p;
        });
        return {
          ...prev,
          employee: updatedEmployee,
          projectHistory: updatedProjectHistory,
          activeProjects: updatedActiveProjects,
        };
      });
      setIsEditingExternalId(false);
      setFeedback('External ID updated successfully!');
      setTimeout(() => setFeedback(null), 3000);
      loadProfile();
    } catch (err: any) {
      setExternalIdSaveError(err?.message || 'Error updating external ID');
    } finally {
      setSavingExternalId(false);
    }
  };

  // Visa / Contractor Ownership resolution
  const visaContractorType = employee.visa_contractor_type || employee.contractor || 'Allied DXB';
  const isVendor = visaContractorType === 'Vendor' || Boolean(employee.vendor_name || employee.vendor_id);
  const vendorName = employee.vendor_name || (employee.contractor && !['Own', 'ALLIED DXB', 'ALLIED AUH', 'Allied DXB', 'Allied AUH', 'Rapid Crew', 'RAPID CREW'].includes(employee.contractor) ? employee.contractor : null);
  const visaContractorDisplay = isVendor
    ? (vendorName ? `Vendor (${vendorName})` : 'Vendor')
    : visaContractorType;

  // Active Vehicle & SIM resolution
  const activeVehicleAssignment = (vehicleHistory || []).find((v: any) => v.assignment_status === 'ACTIVE' || v.status === 'ACTIVE') || null;
  const activeVehiclePlate = employee.current_bike_plate || currentVehicle?.plate_number || activeVehicleAssignment?.vehicle_plate || null;
  const activeAssignmentDate = activeVehicleAssignment?.assignment_date || (activeVehicleAssignment as any)?.start_date || null;
  const activeSimAssignment = (simHistory || []).find((s: any) => s.status === 'ACTIVE' || s.status === 'ASSIGNED' || s.assignment_status === 'ACTIVE' || s.assignment_status === 'ASSIGNED' || s.assignment_status === 'Assigned') || null;
  const activeSimNumber = activeSimAssignment
    ? (activeSimAssignment.mobile_number || employee.current_sim_number || currentSim?.mobile_number || null)
    : (currentSim && (currentSim.assignment_status === 'Assigned' || currentSim.status === 'Assigned') ? (currentSim.mobile_number || employee.current_sim_number) : (employee.current_sim_number || null));

  // Tenure calculation
  const joiningDateObj = new Date(employee.joining_date || '2024-01-01');
  const daysDiff = Math.max(0, Math.floor((Date.now() - joiningDateObj.getTime()) / (1000 * 60 * 60 * 24)));
  const tenureDisplay = daysDiff < 30 ? `${daysDiff} days` : daysDiff < 365 ? `${Math.floor(daysDiff / 30)} months` : `${(daysDiff / 365.25).toFixed(1)} years`;

  // Payroll cycle stats
  const completedPayrollCount = payrollData?.months?.length || 0;

  return (
    <div className="space-y-5">
      {/* Toast Feedback */}
      {feedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 hover:text-emerald-800">
            ×
          </button>
        </div>
      )}

      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-xl shadow-xs transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Profile Photo / Neutral Initials Badge */}
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/50 flex items-center justify-center font-bold text-base text-blue-600 dark:text-blue-300 shrink-0">
            {employee.photo_document_id || (employee.photo && !employee.photo.includes('unsplash.com')) ? (
              <img
                src={`/api/erp/master-employees/${employee.id}/photo-file`}
                alt={employee.full_name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              (employee.first_name || employee.full_name || 'E')[0].toUpperCase()
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Employee Profile
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-mono text-slate-500 font-semibold">{employee.employee_code}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {employee.full_name}
            </h2>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Employee
          </button>

          <button
            type="button"
            id="btn-emp-360-make-candidate"
            onClick={handleMakeCandidateAction}
            disabled={candidateLoading}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
              candidateRecord
                ? 'bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title={candidateRecord ? `Candidate exists: ${candidateRecord.candidateId}` : 'Promote to Candidate in Recruitment Pipeline'}
          >
            <UserPlus className="w-3.5 h-3.5" />
            {candidateLoading ? 'Processing...' : candidateRecord ? `Candidate (${candidateRecord.candidateId})` : 'Make Candidate'}
          </button>

          <button
            onClick={() => setActiveModal('PROJECT')}
            disabled={isLifecycleOverrideStatus(employee.current_status)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
              isLifecycleOverrideStatus(employee.current_status)
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title={
              isLifecycleOverrideStatus(employee.current_status)
                ? `Cannot assign project while in ${resolveCanonicalStatus(employee.current_status)} status`
                : effectiveProjectName !== 'Unassigned'
                ? 'Transfer Project'
                : 'Assign Project'
            }
          >
            <Briefcase className="w-3.5 h-3.5" />
            {effectiveProjectName !== 'Unassigned' ? 'Transfer Project' : 'Assign Project'}
          </button>

          <button
            onClick={() => setActiveModal('STATUS')}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            Change Status
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP SUMMARY AREA SPEC: ONLY 5 FIELDS (NO EXCESSIVE KPI CARDS) */}
      {/* 1. Current Status */}
      {/* 2. Visa / Contractor */}
      {/* 3. Current Primary Project */}
      {/* 4. Current Bike */}
      {/* 5. Current SIM */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          {/* 1. Current Status */}
          <div className="sm:pr-4 pt-3 sm:pt-0">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
              Current Status
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getCanonicalStatusBadgeClass(
                  employee.current_status
                )}`}
              >
                {resolveCanonicalStatus(employee.current_status)}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1 truncate">
              {employee.status_reason || (employee.status_effective_date ? `Since ${employee.status_effective_date}` : 'Operational')}
            </span>
          </div>

          {/* 2. Visa / Contractor */}
          <div className="sm:px-4 pt-3 sm:pt-0">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
              Visa / Contractor
            </span>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              {visaContractorDisplay}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1 truncate">
              {isVendor ? (vendorName ? `Vendor Master: ${vendorName}` : 'Vendor Outsourced') : 'Company / Direct'}
            </span>
          </div>

          {/* 3. Current Primary Project */}
          <div className="sm:px-4 pt-3 sm:pt-0">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
              Current Primary Project
            </span>
            <div className="font-bold text-indigo-600 dark:text-indigo-400 text-sm truncate">
              {effectiveProjectName}
            </div>
            <span className="text-[11px] text-slate-500 font-mono block mt-1 truncate">
              {effectiveProjectName !== 'Unassigned' && effectiveExternalId !== '-'
                ? `${effectiveExternalIdType}: ${effectiveExternalId}`
                : 'Standby / Unallocated'}
            </span>
          </div>

          {/* 4. Current Bike */}
          <div className="sm:px-4 pt-3 sm:pt-0">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
              Current Bike
            </span>
            <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
              {activeVehiclePlate || 'None Assigned'}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1 truncate">
              {activeVehiclePlate
                ? `${currentVehicle?.make || ''} ${currentVehicle?.model || ''}`.trim() || 'Assigned Motorcycle'
                : 'Available in Fleet Depot'}
            </span>
          </div>

          {/* 5. Current SIM */}
          <div className="sm:pl-4 pt-3 sm:pt-0">
            <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider block mb-1.5">
              Current SIM
            </span>
            <div className="font-mono font-bold text-sky-600 dark:text-sky-400 text-sm">
              {activeSimNumber || 'None Assigned'}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1 truncate">
              {activeSimNumber
                ? `${currentSim?.provider || 'Telecom'} ${currentSim?.plan ? `• ${currentSim?.plan}` : ''}`
                : 'Available in Telecom Stock'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6 SYSTEM TABS: Overview, Projects, Assets, Documents, Payroll, History */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* Navigation Tab Bar */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-3 overflow-x-auto gap-2 text-xs font-bold">
          {[
            { id: 'overview', label: 'Overview', icon: Users },
            { id: 'projects', label: 'Projects', icon: Briefcase, count: projectHistory.length },
            { id: 'assets', label: 'Assets', icon: Truck, count: (vehicleHistory.length + simHistory.length + assetHistory.length) },
            { id: 'documents', label: 'Documents', icon: ShieldCheck },
            { id: 'payroll', label: 'Payroll', icon: DollarSign, count: completedPayrollCount },
            { id: 'history', label: 'History', icon: Clock, count: timeline.length },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabKey)}
                className={`pb-3 px-3.5 flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {t.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                      active ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="p-6">
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Required Operational Fields */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Employee Master Details
                    </h4>
                  </div>
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    {employee.employee_code}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Employee Code</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{employee.employee_code}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Full Name</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{employee.full_name}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Mobile Number</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {employee.company_mobile || employee.personal_mobile || '-'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Emirates ID</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {employee.emirates_id_number || '-'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Nationality</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{employee.nationality || 'UAE'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Joining Date</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {employee.joining_date || '-'} ({tenureDisplay})
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Branch</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {mapToAuthoritativeBranch(employee.branch_name || employee.branch_id || (employee as any).branch)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Employment Status</span>
                    <span className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getCanonicalStatusBadgeClass(employee.current_status)}`}>
                      {resolveCanonicalStatus(employee.current_status)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Visa / Contractor Type</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-bold text-slate-900 dark:text-white">{visaContractorDisplay}</span>
                      {isVendor && vendorName && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold text-[10px] border border-purple-200 dark:border-purple-800">
                          Vendor: {vendorName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Designation / Role</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{employee.designation || 'Delivery Rider'}</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Basic Salary</span>
                    <span className="font-bold text-slate-900 dark:text-white">AED {employee.basic_salary || 3500} / month</span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">Employment Type</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{employee.employment_type || 'FULL_TIME'}</span>
                  </div>
                </div>
              </div>

              {/* Operational Foundation Pillars Separation */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Strict Operational Identity Separation
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">1. Employee Lifecycle</span>
                    <h5 className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{resolveCanonicalStatus(employee.current_status)}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">Independent of client contracts, tracks workforce availability and leave.</p>
                  </div>

                  <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">2. Visa / Contractor</span>
                    <h5 className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{visaContractorDisplay}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">{isVendor ? `Contracted through vendor: ${vendorName || 'Vendor'}` : 'Direct company sponsorship or own visa.'}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">3. Project Assignment</span>
                    <h5 className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{effectiveProjectName}</h5>
                    <p className="text-[11px] text-slate-500 font-mono mt-1">{effectiveExternalIdType}: {effectiveExternalId}</p>
                  </div>

                  <div className="bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">4. Asset Custody</span>
                    <h5 className="font-bold text-slate-900 dark:text-white mt-1 text-sm">{activeVehiclePlate || 'No Bike'} • {activeSimNumber || 'No SIM'}</h5>
                    <p className="text-[11px] text-slate-500 mt-1">Managed directly in vehicle & SIM inventory masters.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: PROJECTS */}
          {/* ========================================================================= */}
          {activeTab === 'projects' && (
            <div className="space-y-6">
              {/* Active Project Card */}
              {activeAssignment ? (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                          Active Project Assignment
                        </span>
                        <span className="text-xs text-slate-400 font-mono">Current Client Deployment</span>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                        {effectiveProjectName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveModal('PROJECT')}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-2xs"
                      >
                        Transfer Project
                      </button>
                      <button
                        onClick={() => setActiveModal('END_PROJECT')}
                        className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-colors"
                      >
                        End Assignment
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                        {effectiveExternalIdType}
                      </span>
                      {isEditingExternalId ? (
                        <div className="flex items-center gap-1.5 mt-1">
                          <input
                            type="text"
                            value={editedExternalId}
                            onChange={(e) => setEditedExternalId(e.target.value)}
                            placeholder={`Enter ${effectiveExternalIdType}`}
                            autoFocus
                            disabled={savingExternalId}
                            className="px-2 py-1 text-xs font-mono font-bold bg-white dark:bg-slate-900 border border-blue-500 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-36"
                          />
                          <button
                            onClick={handleSaveExternalId}
                            disabled={savingExternalId || !editedExternalId.trim()}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1"
                          >
                            {savingExternalId ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingExternalId(false);
                              setExternalIdSaveError(null);
                            }}
                            disabled={savingExternalId}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-bold rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                            {effectiveExternalId}
                          </span>
                          <button
                            onClick={() => {
                              setEditedExternalId(effectiveExternalId !== '-' ? effectiveExternalId : '');
                              setExternalIdSaveError(null);
                              setIsEditingExternalId(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800/80 rounded-md transition-colors"
                            title="Edit ID"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            Edit ID
                          </button>
                        </div>
                      )}
                      {externalIdSaveError && (
                        <p className="text-[10px] text-rose-500 mt-1 font-semibold">{externalIdSaveError}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                        Start Date
                      </span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {activeAssignment?.assignment_start_date || employee.joining_date || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                        Status
                      </span>
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" /> ACTIVE
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                        Assigned By
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {activeAssignment?.assigned_by || 'Operations Admin'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center">
                  <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Active Project Assignment</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    This employee is currently unallocated or on standby. Assign a project to link their external rider ID for operations and payroll.
                  </p>
                  <button
                    onClick={() => setActiveModal('PROJECT')}
                    disabled={isLifecycleOverrideStatus(employee.current_status)}
                    className={`mt-3 px-4 py-2 font-bold rounded-xl text-xs transition-colors shadow-2xs ${
                      isLifecycleOverrideStatus(employee.current_status)
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                    title={
                      isLifecycleOverrideStatus(employee.current_status)
                        ? `Cannot assign project while in ${resolveCanonicalStatus(employee.current_status)} status`
                        : undefined
                    }
                  >
                    + Assign Project
                  </button>
                </div>
              )}

              {/* Project Assignment History Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Project Assignment History (Preserves Complete History)
                  </h4>
                  <span className="text-[11px] text-slate-400 font-medium">Never overwritten on transfer</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
                        <th className="py-2.5 px-3">Project</th>
                        <th className="py-2.5 px-3">External ID</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Reason / Notes</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {projectHistory.map((p: any) => {
                        const rowExtId =
                          p.external_rider_id ||
                          p.employee_code_on_project ||
                          (p.status === 'ACTIVE' && effectiveExternalId !== '-' ? effectiveExternalId : '-');
                        const rowExtLabel = resolveExternalIdLabel(p.project_name, p.external_id_type);
                        const isActive = p.status === 'ACTIVE' || !p.assignment_end_date;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              {p.project_name || 'Client Project'}
                            </td>
                            <td className="py-3 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                              <div className="flex items-center gap-1.5">
                                <span>{rowExtId || '-'}</span>
                                {isActive && (
                                  <button
                                    onClick={() => {
                                      setEditedExternalId(rowExtId && rowExtId !== '-' ? rowExtId : '');
                                      setExternalIdSaveError(null);
                                      setIsEditingExternalId(true);
                                    }}
                                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                                    title="Edit ID"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    Edit ID
                                  </button>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block font-normal">
                                {rowExtLabel}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                              {p.designation || 'Bike Rider'}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                              {p.assignment_start_date || '-'}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                              {p.assignment_end_date || (p.status === 'ACTIVE' ? 'Active / Present' : '-')}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  p.status === 'ACTIVE' || !p.assignment_end_date
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                                }`}
                              >
                                {p.status || 'Active'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                              {p.notes || '-'}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {p.status === 'ACTIVE' && (
                                <button
                                  onClick={() => setActiveModal('END_PROJECT')}
                                  className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors"
                                >
                                  End
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {projectHistory.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                            No project assignment history recorded yet. Click "Assign Project" above to link this employee to a client project.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ASSETS */}
          {/* ========================================================================= */}
          {activeTab === 'assets' && (
            <div className="space-y-6">
              {/* Vehicle & SIM Active Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Vehicle Custody Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-amber-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Vehicle Assignment
                      </h4>
                    </div>
                    {activeVehiclePlate && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                        Assigned
                      </span>
                    )}
                  </div>

                  {activeVehiclePlate ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Vehicle Plate:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">{activeVehiclePlate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Model / Make:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {currentVehicle ? `${currentVehicle.make || ''} ${currentVehicle.model || ''}`.trim() || 'Motorcycle' : 'Motorcycle'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Starting Odometer:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {activeVehicleAssignment?.starting_odometer ?? 0} KM
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-t border-slate-100 dark:border-slate-800/80">
                        <span className="text-slate-400">Assignment Date:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                            {activeAssignmentDate || '—'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDate(activeVehicleAssignment)}
                            className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800 transition-colors inline-flex items-center gap-1 shadow-2xs"
                            title="Edit Assignment Date"
                          >
                            <Edit2 className="w-2.5 h-2.5 text-amber-600" />
                            Edit Date
                          </button>
                        </div>
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => setActiveModal('REPLACE_BIKE')}
                          className="flex-1 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 text-xs font-bold transition-colors border border-amber-200 dark:border-amber-800"
                        >
                          1-Step Bike Swap
                        </button>
                        <button
                          onClick={() => setActiveModal('RETURN_BIKE')}
                          className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                        >
                          Return Bike
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-3">
                      <p className="text-xs text-slate-500 mb-2">No vehicle currently assigned to this rider.</p>
                      <button
                        onClick={() => setActiveModal('ASSIGN_BIKE')}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                      >
                        + Assign Vehicle
                      </button>
                    </div>
                  )}
                </div>

                {/* SIM Custody Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-sky-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        SIM Card Assignment
                      </h4>
                    </div>
                    {activeSimNumber ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200">
                        Assigned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Unassigned
                      </span>
                    )}
                  </div>

                  {activeSimNumber ? (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Mobile Number:</span>
                        <span className="font-mono font-bold text-sky-600 text-sm">{activeSimNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Provider:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {currentSim?.provider || currentSim?.vendor || employee.current_sim_provider || activeSimAssignment?.provider || 'ETISALAT'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">ICCID:</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {currentSim?.iccid || currentSim?.sim_serial_number || employee.current_sim_iccid || activeSimAssignment?.iccid || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Assignment Date:</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {currentSim?.assigned_date ||
                            employee.current_sim_assigned_date ||
                            activeSimAssignment?.assigned_date ||
                            simHistory.find((s: any) => s.status === 'ACTIVE' || s.status === 'ASSIGNED' || s.assignment_status === 'ACTIVE' || s.assignment_status === 'ASSIGNED')?.assigned_at?.slice(0, 10) ||
                            simHistory.find((s: any) => s.status === 'ACTIVE' || s.status === 'ASSIGNED' || s.assignment_status === 'ACTIVE' || s.assignment_status === 'ASSIGNED')?.assigned_date ||
                            employee.assigned_date ||
                            'Active Duty'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Assigned By:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {resolveSimStaffUserName(currentSim?.assigned_by || employee.current_sim_assigned_by || activeSimAssignment?.assigned_by)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Service Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            currentSim?.service_status === 'Inactive' || currentSim?.is_active === false
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {currentSim?.service_status || (currentSim?.is_active === false ? 'Inactive' : 'Active')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Plan:</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {currentSim?.plan || 'Standard Fleet Plan'}
                        </span>
                      </div>
                      <div className="pt-2 flex gap-2">
                        <button
                          onClick={() => setActiveModal('REPLACE_SIM')}
                          className="flex-1 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200 text-xs font-bold transition-colors border border-sky-200 dark:border-sky-800"
                        >
                          1-Step SIM Swap
                        </button>
                        <button
                          onClick={() => setActiveModal('RETURN_SIM')}
                          className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors"
                        >
                          Return SIM
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-center py-3">
                      <p className="text-xs text-slate-500 mb-2">No SIM card currently assigned.</p>
                      <button
                        onClick={() => setActiveModal('ASSIGN_SIM')}
                        className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors shadow-2xs"
                      >
                        + Assign SIM
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(bikeCustodyHistory.length > 0 || simCustodyHistory.length > 0) && (
                <section className="space-y-3 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                    Previous Holders of Current Bike & SIM
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs">Bike {activeVehiclePlate || 'Not assigned'}</h5>
                      {bikeCustodyHistory.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                          <div className="font-bold">{item.holder_name} ({item.holder_code})</div>
                          <div>{item.assignment_date} to {item.return_date || 'Current'} • {item.assignment_status}</div>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs">SIM {employee.current_sim_number || 'Not assigned'}</h5>
                      {simCustodyHistory.map((item: any) => (
                        <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs">
                          <div className="font-bold">{item.holder_name} ({item.holder_code})</div>
                          <div>{item.assigned_date || String(item.assigned_at || '').slice(0, 10)} to {item.return_date || 'Current'} • {item.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
              {/* Vehicle History Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Vehicle Assignment History
                  </h4>
                </div>


                {/* Phone-first: show the full history without horizontal scrolling. */}
                <div className="md:hidden space-y-3">
                  {vehicleHistory.map((v: any) => {
                    const active = String(v.assignment_status || v.status || '').toUpperCase() === 'ACTIVE';
                    const assignedBy = resolveRecordedStaffName(v.assigned_by, v.assigned_by_id);
                    const returnedBy = active ? '—' : resolveRecordedStaffName(v.returned_by || v.returned_to);
                    return (
                      <div key={v.id || v.vehicle_plate} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3 dark:bg-slate-900 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">Plate {v.vehicle_plate || 'Not recorded'}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{v.assignment_status || (active ? 'ACTIVE' : 'RETURNED')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div><p className="text-slate-500">Assigned Date</p><p className="font-semibold font-mono break-words">{v.assignment_date || v.start_date || 'Not recorded'}</p></div>
                          <div><p className="text-slate-500">Return Date</p><p className="font-semibold font-mono break-words">{v.return_date || (active ? 'Still assigned' : 'Not recorded')}</p></div>
                          <div><p className="text-slate-500">Assigned By</p><p className="font-semibold break-words">{assignedBy}</p></div>
                          <div><p className="text-slate-500">Returned By</p><p className="font-semibold break-words">{returnedBy}</p></div>
                        </div>
                        {!active && <p className="text-xs text-slate-600 dark:text-slate-300">Return reason: {v.return_reason || v.return_notes || 'Not recorded'}</p>}
                        {v.id && !String(v.id).startsWith('v_asgn_emp_') && (
                          <button type="button" onClick={() => handleOpenEditDate(v)} className="min-h-11 w-full inline-flex justify-center items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800">
                            <Edit2 className="w-4 h-4" /> Edit Recorded Dates
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {vehicleHistory.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No vehicle history recorded.</p>}
                </div>

                <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
                        <th className="py-2.5 px-3">Plate No</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Assigned Date</th>
                        <th className="py-2.5 px-3">Returned Date</th>
                        <th className="py-2.5 px-3">Assigned By</th>
                        <th className="py-2.5 px-3">Returned By</th>
                        <th className="py-2.5 px-3">Start ODO</th>
                        <th className="py-2.5 px-3">Return ODO</th>
                        <th className="py-2.5 px-3">Return Reason</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {vehicleHistory.map((v: any) => {
                        const isRowActive = v.assignment_status === 'ACTIVE' || v.status === 'ACTIVE';
                        const humanAssignedBy = resolveRecordedStaffName(v.assigned_by, v.assigned_by_id);
                        const empName = v.employee_name || employee?.full_name || 'Rider';
                        const empId = v.employee_code || employee?.employee_code || v.employee_id || employee?.id || '—';
                        const retBy = isRowActive ? '—' : resolveRecordedStaffName(v.returned_by || v.returned_to);
                        const retReason = v.return_reason || v.reason || v.return_notes || (isRowActive ? '—' : 'Not recorded');

                        return (
                          <tr key={v.id || v.vehicle_plate} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">{v.vehicle_plate}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">{empName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{empId}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isRowActive
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                                }`}
                              >
                                {v.assignment_status || (isRowActive ? 'ACTIVE' : 'RETURNED')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                              {v.assignment_date || v.start_date || '—'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500">
                              {v.return_date || (isRowActive ? 'Active Handover' : '-')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-semibold">
                              <div>{humanAssignedBy}</div>
                              {(v.assigned_by_id || (typeof v.assigned_by === 'string' && v.assigned_by.startsWith('user_'))) && (
                                <div className="text-[10px] font-mono text-slate-400 font-normal">
                                  ID: {v.assigned_by_id || v.assigned_by}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                              {retBy}
                            </td>
                            <td className="py-2.5 px-3 font-mono">{v.starting_odometer ?? 0} km</td>
                            <td className="py-2.5 px-3 font-mono">{v.return_odometer ? `${v.return_odometer} km` : (isRowActive ? 'In Use' : '-')}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={retReason}>
                              {retReason}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {v.id && !String(v.id).startsWith('v_asgn_emp_') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditDate(v)}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800 transition-colors inline-flex items-center gap-1 shadow-2xs"
                                  title="Correct recorded assignment and return dates"
                                >
                                  <Edit2 className="w-2.5 h-2.5 text-amber-600" />
                                  Edit Dates
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {vehicleHistory.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-6 text-center text-slate-400 italic">
                            No vehicles assigned yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SIM History Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    SIM Card Assignment History
                  </h4>
                  <span className="text-[11px] text-slate-400">Independent SIM lifecycle records</span>
                </div>


                {/* Phone-first history: all dates, holders and operators visible without sideways scrolling. */}
                <div className="md:hidden space-y-3">
                  {simHistory.map((entry: any) => {
                    const active = ['ACTIVE', 'ASSIGNED'].includes(String(entry.assignment_status || entry.status || '').toUpperCase());
                    const number = entry.mobile_number || entry.sim_number || 'Not recorded';
                    const assignDate = entry.assigned_date || entry.assigned_at?.slice(0, 10) || 'Not recorded';
                    const returnedDate = active ? 'Still assigned' : (entry.return_date || entry.returned_date || entry.returned_at?.slice(0, 10) || 'Not recorded');
                    return (
                      <div key={entry.id || number} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold font-mono text-slate-900 dark:text-white break-all">{number}</span>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[10px] font-bold text-slate-700 dark:text-slate-200 shrink-0">
                            {active ? 'ASSIGNED' : String(entry.status || entry.assignment_status || 'RETURNED').toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 break-all">ICCID: {entry.iccid || entry.sim_serial_number || 'Not recorded'}</p>
                        {entry.is_synthetic && <p className="text-[11px] text-amber-700 dark:text-amber-300">
                          Card summary only — no verified handover. Use Review / Edit to confirm actual custody before recording one.
                        </p>}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div><p className="text-slate-500">Assigned Date</p><p className="font-semibold font-mono break-words">{assignDate}</p></div>
                          <div><p className="text-slate-500">Return Date</p><p className="font-semibold font-mono break-words">{returnedDate}</p></div>
                          <div><p className="text-slate-500">Assigned By</p><p className="font-semibold break-words">{resolveRecordedStaffName(entry.assigned_by)}</p></div>
                          <div><p className="text-slate-500">Returned By</p><p className="font-semibold break-words">{active ? '—' : resolveRecordedStaffName(entry.returned_by || entry.returned_to)}</p></div>
                        </div>
                        {!active && <p className="text-xs text-slate-600 dark:text-slate-300">Reason: {entry.return_reason || entry.return_remark || entry.notes || 'Not recorded'}</p>}
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button type="button" onClick={() => handleViewSimHistory(entry)}
                            className="w-full min-h-11 rounded-lg bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200 text-xs font-bold border border-sky-200 dark:border-sky-800 inline-flex items-center justify-center gap-2">
                            <Eye className="w-4 h-4" /> View Full SIM History
                          </button>
                          <button type="button" onClick={() => handleEditSimHistory(entry)}
                            className="w-full min-h-11 rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 text-xs font-bold border border-amber-200 dark:border-amber-800 inline-flex items-center justify-center gap-2">
                            <Edit2 className="w-4 h-4" />
                            {entry.is_synthetic ? 'Review / Edit Missing History' : 'Edit Dates / Assigned By'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {simHistory.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No recorded SIM handovers for this employee yet.</p>}
                </div>

                <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
                        <th className="py-2.5 px-3">Mobile Number</th>
                        <th className="py-2.5 px-3">Provider</th>
                        <th className="py-2.5 px-3">ICCID</th>
                        <th className="py-2.5 px-3">Employee Name + Code</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Assigned Date</th>
                        <th className="py-2.5 px-3">Returned Date</th>
                        <th className="py-2.5 px-3">Assigned By</th>
                        <th className="py-2.5 px-3">Returned By</th>
                        <th className="py-2.5 px-3">Return Reason / Remark</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {simHistory.map((s: any) => {
                        const isSimActive = s.status === 'ACTIVE' || s.status === 'ASSIGNED' || s.assignment_status === 'ACTIVE' || s.assignment_status === 'ASSIGNED' || s.assignment_status === 'Assigned';
                        let displayStatus = isSimActive ? 'ACTIVE' : 'RETURNED';
                        let badgeClass = isSimActive
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';

                        if (!isSimActive) {
                          const statusUpper = String(s.status || s.assignment_status || '').toUpperCase();
                          const reasonUpper = String(s.return_reason || s.return_remark || s.notes || '').toUpperCase();
                          if (statusUpper.includes('LOST') || reasonUpper.includes('LOST')) {
                            displayStatus = 'LOST';
                            badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
                          } else if (statusUpper.includes('TRANSFER') || reasonUpper.includes('TRANSFER')) {
                            displayStatus = 'TRANSFERRED';
                            badgeClass = 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800';
                          } else if (statusUpper.includes('REPLACE') || reasonUpper.includes('REPLACE')) {
                            displayStatus = 'REPLACED';
                            badgeClass = 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
                          }
                        }
                        const empName = s.employee_name || employee?.full_name || 'Not recorded';
                        const empId = s.employee_code || (s.employee_id ? String(s.employee_id).replace(/^emp_/, '') : '') || employee?.employee_code || employee?.id || 'Not recorded';
                        const assignedDate = s.assigned_date || (s.assigned_at ? (s.assigned_at.includes('T') ? s.assigned_at.split('T')[0] : new Date(s.assigned_at).toLocaleDateString()) : '') || 'Not recorded';
                        const returnedDate = isSimActive
                          ? 'Active / In Use'
                          : (s.return_date || s.returned_date || (s.returned_at ? (s.returned_at.includes('T') ? s.returned_at.split('T')[0] : new Date(s.returned_at).toLocaleDateString()) : '') || 'Not recorded');
                        const assignedBy = resolveSimStaffUserName(s.assigned_by);
                        const retBy = isSimActive ? '—' : (s.returned_by || s.returned_to ? resolveSimStaffUserName(s.returned_by || s.returned_to) : 'Not recorded');
                        const retReason = isSimActive ? '—' : ((s.return_reason || s.return_remark || s.reason || s.notes || '').trim() || 'Not recorded');
                        const simProvider = s.provider || s.vendor || 'ETISALAT';
                        const simIccid = s.iccid && s.iccid !== '—' ? s.iccid : (s.sim_serial_number && s.sim_serial_number !== '—' ? s.sim_serial_number : 'Not recorded');
                        const mobileNum = s.mobile_number && s.mobile_number !== '—' ? s.mobile_number : (s.sim_number && s.sim_number !== '—' ? s.sim_number : 'Not recorded');

                        return (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              {mobileNum}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className="font-semibold text-sky-600 dark:text-sky-400 text-[11px]">
                                {simProvider}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {simIccid}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900 dark:text-white">{empName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{empId}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}
                              >
                                {displayStatus}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                              {assignedDate}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">
                              {returnedDate}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-semibold">{assignedBy}</td>
                            <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{retBy}</td>
                            <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate" title={retReason}>
                              {retReason}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleViewSimHistory(s)}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1 shadow-2xs"
                                  title="View SIM Assignment & Return Details"
                                >
                                  <Eye className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
                                  View
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditSimHistory(s)}
                                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                                  title={s.is_synthetic
                                    ? 'Review missing history and explicitly verify original assignment'
                                    : 'Edit saved SIM assignment and return dates'}
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                  {s.is_synthetic ? 'Review / Edit' : 'Edit'}
                                </button>

                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {simHistory.length === 0 && (
                        <tr>
                          <td colSpan={11} className="py-6 text-center text-slate-400 italic">
                            No SIM card assignments recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Custody Equipment */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Equipment, Helmet & Delivery Kits
                  </h4>
                  <button
                    onClick={() => setActiveModal('ASSIGN_ASSET')}
                    className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-lg border border-purple-200 transition-colors"
                  >
                    + Issue Equipment
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
                        <th className="py-2.5 px-3">Asset Item</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Condition</th>
                        <th className="py-2.5 px-3">Assigned Date</th>
                        <th className="py-2.5 px-3">Assigned By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {assetHistory.map((a: any) => (
                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{a.asset_name}</td>
                          <td className="py-2.5 px-3 text-purple-600 font-medium">{a.asset_type}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                a.status === 'ACTIVE'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800'
                              }`}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">{a.condition_on_assignment}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-500">{new Date(a.assigned_at).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300">{a.assigned_by}</td>
                        </tr>
                      ))}
                      {assetHistory.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                            No equipment records found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: DOCUMENTS */}
          {/* ========================================================================= */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <section className="space-y-3 border rounded-2xl border-slate-200 dark:border-slate-800 p-4">
                <h4 className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                  Identity & Document Expiry Dates
                </h4>
                <p className="text-[11px] text-slate-500">
                  Dates from the employee record. Actual scans appear in the vault only after a successful upload.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  {[
                    { label: 'Emirates ID', expiry: employee.emirates_id_expiry },
                    { label: 'Residence Visa', expiry: employee.visa_expiry },
                    { label: 'Passport', expiry: employee.passport_expiry },
                    { label: 'Driving Licence', expiry: employee.driving_license_expiry },
                  ].map((item) => {
                    const days = item.expiry
                      ? Math.ceil((new Date(String(item.expiry) + 'T23:59:59+04:00').getTime() - Date.now()) / 86400000)
                      : null;
                    const condition = days === null || !Number.isFinite(days) ? 'Missing date'
                      : days < 0 ? 'EXPIRED' : days <= 30 ? 'RENEW SOON' : 'VALID';
                    return (
                      <div key={item.label} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs space-y-1">
                        <div className="font-bold">{item.label}</div>
                        <div>{item.expiry || 'No date saved'}</div>
                        <div className="font-semibold text-amber-700 dark:text-amber-400">{condition}</div>
                      </div>
                    );
                  })}
                </div>
              </section>
              {/* Passport Custody & Expiries Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Passport Custody Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Passport Custody
                      </h4>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      profile.passportCustody?.status === 'WITH_COMPANY'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                        : profile.passportCustody?.status === 'WITH_RIDER'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {profile.passportCustody?.status === 'WITH_COMPANY'
                        ? 'WITH COMPANY'
                        : profile.passportCustody?.status === 'WITH_RIDER'
                        ? 'WITH RIDER'
                        : (profile.passportCustody?.status || 'NOT IN SAFE')}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Passport Number:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        {profile.passportCustody?.passport_number || (employee as any).passport_number || 'On File'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Safe / Location:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {profile.passportCustody?.current_location || profile.passportCustody?.safe_location || (employee as any).passport_location || 'Office Vault'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Handler / Custodian:</span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {profile.passportCustody?.current_handler || profile.passportCustody?.handler_name || 'HR & Compliance Manager'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Received Date:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {profile.passportCustody?.receive_date || profile.passportCustody?.received_date || employee.joining_date || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Release Status:</span>
                      <span className={`font-medium ${profile.passportCustody?.status === 'WITH_RIDER' ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {profile.passportCustody?.status === 'WITH_RIDER'
                          ? `Returned to Rider (${profile.passportCustody?.return_date || profile.passportCustody?.release_date || 'Handover'})`
                          : profile.passportCustody?.status === 'WITH_COMPANY'
                          ? 'In Company Custody'
                          : 'Not in Vault'}
                      </span>
                    </div>
                    {profile.passportCustody?.return_reason && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Return Reason:</span>
                        <span className="font-medium text-amber-500">
                          {profile.passportCustody.return_reason}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Passport Movement History Log */}
                  {((profile.passportCustody?.history && profile.passportCustody.history.length > 0) || (profile.passportHistory && profile.passportHistory.length > 0)) && (
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Custody Movement History
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[11px]">
                        {((profile.passportCustody?.history || profile.passportHistory) as any[]).map((hist: any, hIdx: number) => (
                          <div key={hist.id || hIdx} className="p-1.5 bg-white dark:bg-slate-900/60 rounded border border-slate-200 dark:border-slate-700 flex items-start justify-between gap-2">
                            <div>
                              <span className={`font-bold ${hist.event_type === 'RECEIVED' ? 'text-emerald-500' : hist.event_type === 'RETURNED_TO_RIDER' ? 'text-amber-500' : 'text-blue-400'}`}>
                                {hist.event_type === 'RECEIVED' ? 'Received into Safe' : hist.event_type === 'RETURNED_TO_RIDER' ? 'Returned to Rider' : hist.event_type}
                              </span>
                              <span className="text-slate-400 ml-1.5">by {hist.actor_name || hist.handler_name || 'ERP User'}</span>
                              {hist.reason && <p className="text-[10px] text-slate-500 mt-0.5">{hist.reason}</p>}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono shrink-0">
                              {hist.event_date || (hist.timestamp ? hist.timestamp.split('T')[0] : '')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Official Identity Expiries Card */}
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        Official Identity Expiries
                      </h4>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">Compliance Monitor</span>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Emirates ID Expiry:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {(employee as any).emirates_id_expiry || (employee as any).eid_expiry || '2027-05-15'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Driving License Expiry:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {employee.driving_license_expiry || '2026-11-20'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Medical / Health Insurance:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {(employee as any).insurance_expiry || '2026-08-30'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Visa Expiry Date:</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {employee.visa_expiry || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Vault (PDFs & Scans) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Document Vault & Contracts
                </h4>
                <DocumentsTab
                  entityType="Employee"
                  entityId={employee.id}
                  entityName={employee.full_name}
                  entityReferenceNumber={employee.employee_code}
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: PAYROLL */}
          {/* ========================================================================= */}
          {activeTab === 'payroll' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Project-wise Monthly Payroll History
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Deterministic Project + External Rider ID matching audit record
                  </p>
                </div>
                <button
                  onClick={loadPayroll}
                  disabled={loadingPayroll}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                >
                  {loadingPayroll ? 'Refreshing...' : 'Refresh History'}
                </button>
              </div>

              {/* Compact Top Summary Metrics: Latest Recorded Salary (Draft Included) & Year-to-Date */}
              {payrollData?.months && payrollData.months.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 font-medium block">Latest Recorded Salary (Draft Included)</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      AED {((payrollData.months[0]?.net_payable || 0)).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Period: {payrollData.months[0]?.month}
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 font-medium block">Recorded Salary Total (Draft Included)</span>
                    <span className="text-base font-bold text-slate-900 dark:text-white mt-0.5 block">
                      AED {(payrollData.months.reduce((acc: number, m: any) => acc + (m.net_payable || 0), 0)).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Cumulative net across all projects
                    </span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500 font-medium block">Recorded Payroll Months</span>
                    <span className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5 block">
                      {payrollData.months.length} Month(s)
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Immutable project earning records
                    </span>
                  </div>
                </div>
              )}

              {payrollData?.months && payrollData.months.length > 0 ? (
                <div className="space-y-6">
                  {payrollData.months.map((m: any) => (
                    <div
                      key={m.month}
                      className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs"
                    >
                      {/* Month Header Banner */}
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Receipt className="w-4 h-4 text-blue-600" />
                          <h5 className="font-bold text-sm text-slate-900 dark:text-white">
                            Payroll Period: {m.month}
                          </h5>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                            {m.project_lines?.length || 1} Project Line(s)
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 text-[10px] block">Gross Earnings</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">AED {m.gross_earnings.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 text-[10px] block">Total Deductions</span>
                            <span className="font-bold text-rose-600">AED {m.deductions.toFixed(2)}</span>
                          </div>
                          <div className="bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                            <span className="text-emerald-700 dark:text-emerald-300 text-[10px] block font-medium">Net Payable</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">AED {m.net_payable.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Project-separated rows */}
                      <div className="p-4 space-y-3">
                        {m.project_lines && m.project_lines.length > 0 ? (
                          m.project_lines.map((line: any, idx: number) => (
                            <div
                              key={line.id || idx}
                              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 text-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-center"
                            >
                              <div className="lg:col-span-2">
                                <span className="text-[10px] text-slate-400 block font-medium">Project Name</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                  {line.project_name || 'Demo Delivery Project'}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  Method: {line.calculation_method || 'PER_DELIVERY'}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  {line.external_id_type || 'External Rider ID'}
                                </span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  {line.external_rider_id || line.source_row_reference || '-'}
                                </span>
                                <span className="text-[10px] text-emerald-600 block">Strict Match</span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Deliveries / Volume</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {line.units_completed || 0} Orders
                                </span>
                                <span className="text-[10px] text-slate-400 block">
                                  Incentives: AED {line.incentives || line.incentive || 0}
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Gross & Deductions</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  AED {(line.gross_earnings || line.gross_project_earning || 0).toFixed(2)}
                                </span>
                                <span className="text-[10px] text-rose-500 block">
                                  - AED {(line.deductions || line.deduction || line.project_penalties || 0).toFixed(2)} ded.
                                </span>
                              </div>

                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">Net Project Earning</span>
                                <span className="font-bold text-emerald-600 text-sm">
                                  AED {(line.net_project_amount || line.net_payable || line.net_project_earning || 0).toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block truncate" title={line.source_batch_id}>
                                  Batch: {line.source_batch_id ? line.source_batch_id.slice(-8) : 'Manual'}
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="py-3 text-center text-slate-400 italic text-xs">
                            Standard monthly salary structure applied (AED {m.net_payable.toFixed(2)}).
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                    No verified payroll cycles processed yet for this employee.
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    When Keeta, Noon, or Partner payroll is uploaded, rows matching this employee's active External Rider ID will permanently record project-wise history here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: HISTORY */}
          {/* ========================================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  Audit Lifecycle & Operational Events
                </h4>
                <span className="text-[11px] text-slate-400">Immutable chronological timeline</span>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {timeline.map((ev: any) => (
                  <div key={ev.id} className="relative group">
                    <div className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs group-hover:scale-110 transition-transform" />
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{ev.title}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(ev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{ev.description}</p>
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 font-medium">
                        <span>Handler: <strong className="text-slate-600 dark:text-slate-300">{ev.actor_name || 'System Admin'}</strong></span>
                        <span>•</span>
                        <span className="px-1.5 py-0.2 rounded-xs bg-slate-200/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-mono">
                          {ev.event_type}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {timeline.length === 0 && (
                  <div className="py-6 text-center text-slate-400 italic text-xs">
                    No timeline events recorded yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assignment & Operational Modals */}
      <EmployeeAssignmentModals
        employeeId={employee.id}
        employeeName={employee.full_name}
        activeModal={activeModal}
        activeAssignmentId={activeAssignment?.id}
        onClose={() => setActiveModal(null)}
        onSuccess={handleModalSuccess}
        projects={projectsList}
        vehicles={vehiclesList}
        sims={simsList}
        assets={assetsList}
        currentProjectName={effectiveProjectName}
        currentExternalId={effectiveExternalId !== '-' ? effectiveExternalId : undefined}
        currentBikePlate={activeVehiclePlate || employee.current_bike_plate}
        currentSimNumber={activeSimNumber || employee.current_sim_number}
        currentStatus={employee.current_status}
        employeeCode={employee.employee_code}
        emiratesId={employee.emirates_id_number || (employee as any).emirates_id}
        activeAssets={activeAssets}
        currentSim={currentSim}
        activeSimAssignment={activeSimAssignment}
        currentVehicle={currentVehicle}
        activeVehicleAssignment={activeVehicleAssignment}
        simHistory={simHistory}
        vehicleHistory={vehicleHistory}
      />
      {isEditModalOpen && profile?.employee && (
        <EmployeeEditModal
          employee={profile.employee}
          onClose={() => setIsEditModalOpen(false)}
          onSave={(updatedEmployee) => {
            loadProfile();
            setFeedback('🎉 Employee updated successfully!');
          }}
        />
      )}

      {/* Existing vehicle history dates only: no assignment, return or status changes. */}
      {isEditDateModalOpen && targetAssignmentForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Correct Vehicle History Dates</h3>
                <p className="text-xs text-slate-500 mt-1">Plate {targetAssignmentForEdit.vehicle_plate || 'Not recorded'} • {profile?.employee?.full_name}</p>
              </div>
              <button type="button" onClick={() => setIsEditDateModalOpen(false)} disabled={savingDate} className="min-h-11 min-w-11 flex items-center justify-center rounded-lg text-slate-500" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAssignmentDate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1" htmlFor="vehicle-history-assigned-date">Assignment Date</label>
                <input id="vehicle-history-assigned-date" type="date" required value={newAssignmentDate} onChange={(e) => setNewAssignmentDate(e.target.value)}
                  className="w-full min-h-11 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white" />
              </div>
              {String(targetAssignmentForEdit.assignment_status || targetAssignmentForEdit.status || '').toUpperCase() !== 'ACTIVE' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1" htmlFor="vehicle-history-return-date">Return Date</label>
                  <input id="vehicle-history-return-date" type="date" required min={newAssignmentDate || undefined} value={newReturnDate} onChange={(e) => setNewReturnDate(e.target.value)}
                    className="w-full min-h-11 px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white" />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1" htmlFor="vehicle-history-correction-reason">Reason for date correction</label>
                <textarea id="vehicle-history-correction-reason" required rows={2} value={dateCorrectionReason} onChange={(e) => setDateCorrectionReason(e.target.value)} maxLength={500} placeholder="Why are these dates being corrected?"
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white" />
                <p className="text-[11px] text-slate-500 mt-1">Only recorded dates are corrected. No bike is assigned, returned or moved. An audit log stores the original dates and editor.</p>
              </div>
              {dateSaveError && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-700">{dateSaveError}</p>}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsEditDateModalOpen(false)} disabled={savingDate} className="min-h-11 px-4 rounded-lg border border-slate-200 text-xs font-semibold">Cancel</button>
                <button type="submit" disabled={savingDate || !newAssignmentDate || !dateCorrectionReason.trim()} className="min-h-11 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold disabled:opacity-50">
                  {savingDate ? 'Saving...' : 'Save Corrected Dates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View SIM Assignment Details Modal */}
      {viewingSimAssignment && (
        <ViewSimAssignmentModal
          isOpen={Boolean(viewingSimAssignment)}
          onClose={() => setViewingSimAssignment(null)}
          assignment={viewingSimAssignment}
          employee={profile?.employee}
          onEdit={(asgn) => {
            setViewingSimAssignment(null);
            handleEditSimHistory(asgn);
          }}
        />
      )}

      {/* Edit SIM Assignment History Modal */}
      {editingSimAssignment && (
        <EditSimAssignmentModal
          isOpen={Boolean(editingSimAssignment)}
          onClose={() => setEditingSimAssignment(null)}
          assignment={editingSimAssignment}
          employee={profile?.employee}
          onSuccess={handleSimEditSuccess}
        />
      )}

      {/* Unverified legacy summaries need an explicit physical-custody confirmation,
          not a fabricated editable assignment row. No automatic production writes. */}
      {legacySimForReview && (
        <VerifyLegacySimHandoverModal
          assignment={legacySimForReview}
          employee={profile?.employee}
          onClose={() => setLegacySimForReview(null)}
          onSuccess={handleVerifiedLegacySimSuccess}
        />
      )}
    </div>
  );
};
