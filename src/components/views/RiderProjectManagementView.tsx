import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Briefcase,
  Users,
  Search,
  Plus,
  RefreshCw,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  Calendar,
  Layers,
  Star,
  ExternalLink,
  Building,
  MapPin,
  Tag,
  Eye,
  Check,
  X,
  UserCheck,
  History,
  ShieldAlert,
  Info,
  ChevronDown,
} from 'lucide-react';
import {
  riderProjectService,
  RiderProjectSummaryResponse,
  EnrichedProjectEmployee,
  ActiveAssignmentItem,
  ProjectCardSummary,
} from '../../services/riderProjectService';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { DbBranch } from '../../types/database';
import { Employee360ProfileView } from '../employee/Employee360ProfileView';

interface RiderProjectManagementViewProps {
  onNavigateModule?: (module: string, params?: any) => void;
  lang?: 'EN' | 'AR';
  initialEmployeeId?: string | null;
  onClearInitialEmployeeId?: () => void;
}

export const RiderProjectManagementView: React.FC<RiderProjectManagementViewProps> = ({
  onNavigateModule,
  lang = 'EN',
  initialEmployeeId,
  onClearInitialEmployeeId,
}) => {
  // Employee 360 view state
  const [selected360EmployeeId, setSelected360EmployeeId] = useState<string | null>(initialEmployeeId || null);

  // Sync external initialEmployeeId
  useEffect(() => {
    if (initialEmployeeId) {
      setSelected360EmployeeId(initialEmployeeId);
    }
  }, [initialEmployeeId]);

  // Main Data States
  const [summary, setSummary] = useState<RiderProjectSummaryResponse | null>(null);
  const [employees, setEmployees] = useState<EnrichedProjectEmployee[]>([]);
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [branches, setBranches] = useState<DbBranch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);

  // Filter & Pagination States
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [selectedVisaContractor, setSelectedVisaContractor] = useState<string>('ALL');
  const [selectedAssignmentStatus, setSelectedAssignmentStatus] = useState<string>('ALL');
  const [selectedPrimaryAdditional, setSelectedPrimaryAdditional] = useState<string>('ALL');
  const [visaContractorsList, setVisaContractorsList] = useState<string[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [filterMultiOnly, setFilterMultiOnly] = useState<boolean>(false);

  // Selected row checkboxes for bulk actions
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [isEndModalOpen, setIsEndModalOpen] = useState<boolean>(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState<boolean>(false);

  // Active targeted employee / assignment for modals
  const [targetEmployee, setTargetEmployee] = useState<EnrichedProjectEmployee | null>(null);
  const [targetAssignment, setTargetAssignment] = useState<ActiveAssignmentItem | null>(null);
  const [assignmentHistoryData, setAssignmentHistoryData] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Modal Form States
  const [formEmployeeId, setFormEmployeeId] = useState<string>('');
  const [formProjectId, setFormProjectId] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formExternalId, setFormExternalId] = useState<string>('');
  const [formLocationState, setFormLocationState] = useState<string>('Dubai');
  const [formIsPrimary, setFormIsPrimary] = useState<boolean>(true);
  const [formEndReason, setFormEndReason] = useState<string>('Project Changed');
  const [formNewStatus, setFormNewStatus] = useState<string>('Assigned / Active');
  const [formReplacementPrimaryId, setFormReplacementPrimaryId] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [modalSubmitting, setModalSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccessMsg, setModalSuccessMsg] = useState<string | null>(null);

  // Typeahead search for employee in modals if not pre-selected
  const [empTypeaheadQuery, setEmpTypeaheadQuery] = useState<string>('');
  const [empTypeaheadResults, setEmpTypeaheadResults] = useState<any[]>([]);
  const [empTypeaheadLoading, setEmpTypeaheadLoading] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Metadata (Summary, Projects, Branches, Visa Contractors)
  const loadMetadata = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const [sumRes, projsRes, branchesRes, visaRes] = await Promise.all([
        riderProjectService.getSummary(),
        riderProjectService.getProjectsList(),
        masterEmployeeService.getBranches(),
        riderProjectService.getVisaContractors(),
      ]);
      setSummary(sumRes);
      setProjectsList(projsRes || []);
      setBranches(branchesRes || []);
      setVisaContractorsList(visaRes || ['Allied AUH', 'Allied DXB', 'Own Visa', 'Vendor']);
    } catch (err) {
      console.error('Failed to load project management metadata:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Fetch paginated employees
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await riderProjectService.getEmployees({
        page,
        limit,
        search: debouncedSearch,
        projectId: selectedProjectId,
        visaContractor: selectedVisaContractor,
        assignmentStatus: selectedAssignmentStatus,
        primaryAdditional: selectedPrimaryAdditional,
        branchId: selectedBranchId,
        hasMultiple: filterMultiOnly,
      });

      if (res && res.success) {
        setEmployees(res.employees || []);
        setTotalCount(res.pagination?.totalCount ?? 0);
        setTotalPages(res.pagination?.totalPages ?? 1);
      }
    } catch (err) {
      console.error('Failed to fetch rider employees:', err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, selectedProjectId, selectedVisaContractor, selectedAssignmentStatus, selectedPrimaryAdditional, selectedBranchId, filterMultiOnly]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Listen to system-wide employee updates to stay synchronized
  useEffect(() => {
    const handleGlobalUpdate = () => {
      loadMetadata();
      fetchEmployees();
    };
    window.addEventListener('erp:master-employees-updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('erp:master-employees-updated', handleGlobalUpdate);
    };
  }, [loadMetadata, fetchEmployees]);

  // Refresh all data
  const handleRefresh = (broadcast: boolean | React.SyntheticEvent = true) => {
    loadMetadata();
    fetchEmployees();
    if (broadcast !== false) {
      window.dispatchEvent(new CustomEvent('erp:master-employees-updated'));
    }
  };

  // Checkbox Selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(employees.map((e) => e.id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open "Assign Project" modal
  const handleOpenAssignModal = (emp?: EnrichedProjectEmployee) => {
    setModalError(null);
    setModalSuccessMsg(null);
    setFormNotes('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormLocationState('Dubai');

    if (emp) {
      setTargetEmployee(emp);
      setFormEmployeeId(emp.id);
      setEmpTypeaheadQuery(`${emp.full_name} (${emp.employee_code})`);
      // Default primary: true if employee has no current active projects
      setFormIsPrimary(emp.active_projects_count === 0);
    } else {
      setTargetEmployee(null);
      setFormEmployeeId('');
      setEmpTypeaheadQuery('');
      setFormIsPrimary(true);
    }

    // Default project to first available or selected filter
    const initialProj =
      selectedProjectId && selectedProjectId !== 'ALL' && selectedProjectId !== 'UNASSIGNED'
        ? selectedProjectId
        : projectsList[0]?.id || '';
    setFormProjectId(initialProj);
    setFormExternalId('');

    // Check if mapping exists for initial project
    if (emp && initialProj) {
      riderProjectService.lookupExternalId(emp.id, initialProj).then((res) => {
        if (res && res.found) {
          setFormExternalId(res.external_rider_id);
        }
      });
    }

    setIsAssignModalOpen(true);
  };

  // Handle project change in Assign modal to lookup external ID dynamically
  const handleProjectSelectChange = (projId: string) => {
    setFormProjectId(projId);
    if (formEmployeeId && projId) {
      riderProjectService.lookupExternalId(formEmployeeId, projId).then((res) => {
        if (res && res.found) {
          setFormExternalId(res.external_rider_id);
        }
      });
    }
  };

  // Open "End Assignment" modal from row
  const handleOpenEndModal = (emp: EnrichedProjectEmployee, assignment?: ActiveAssignmentItem) => {
    setModalError(null);
    setModalSuccessMsg(null);
    setTargetEmployee(emp);
    const assign = assignment || emp.active_assignments[0] || null;
    setTargetAssignment(assign);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormEndReason('Project Changed');
    setFormReplacementPrimaryId('');
    setFormNotes('');
    setIsEndModalOpen(true);
  };

  // Open "Move Project" modal from row
  const handleOpenMoveModal = (emp: EnrichedProjectEmployee, oldAssignment?: ActiveAssignmentItem) => {
    setModalError(null);
    setModalSuccessMsg(null);
    setTargetEmployee(emp);
    const assign = oldAssignment || emp.active_assignments[0] || null;
    setTargetAssignment(assign);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndReason('Project Changed');
    setFormNotes('');
    setFormLocationState('Dubai');

    // Default new project to different project
    const otherProjects = projectsList.filter((p) => p.id !== assign?.project_id);
    const newP = otherProjects[0]?.id || '';
    setFormProjectId(newP);
    setFormExternalId('');

    if (emp.id && newP) {
      riderProjectService.lookupExternalId(emp.id, newP).then((res) => {
        if (res && res.found) {
          setFormExternalId(res.external_rider_id);
        }
      });
    }

    setIsMoveModalOpen(true);
  };

  // Open top-level "Transfer Project" modal (allows typeahead employee selection)
  const handleOpenTopMoveModal = () => {
    setModalError(null);
    setModalSuccessMsg(null);
    setTargetEmployee(null);
    setTargetAssignment(null);
    setFormEmployeeId('');
    setEmpTypeaheadQuery('');
    setEmpTypeaheadResults([]);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndReason('Operational Reallocation');
    setFormNotes('');
    setFormLocationState('Dubai');
    setFormProjectId(projectsList[0]?.id || '');
    setFormExternalId('');
    setIsMoveModalOpen(true);
  };

  // Open top-level "End Assignment" modal (allows typeahead employee selection)
  const handleOpenTopEndModal = () => {
    setModalError(null);
    setModalSuccessMsg(null);
    setTargetEmployee(null);
    setTargetAssignment(null);
    setFormEmployeeId('');
    setEmpTypeaheadQuery('');
    setEmpTypeaheadResults([]);
    setFormEndDate(new Date().toISOString().split('T')[0]);
    setFormEndReason('Project Changed');
    setFormReplacementPrimaryId('');
    setFormNotes('');
    setIsEndModalOpen(true);
  };

  // Select employee from typeahead inside Move or End modal
  const handleSelectEmployeeForMoveOrEnd = async (emp: any) => {
    setFormEmployeeId(emp.id);
    setEmpTypeaheadQuery(`${emp.full_name} (${emp.employee_code})`);
    setEmpTypeaheadResults([]);
    setEmpTypeaheadLoading(true);
    try {
      const data = await riderProjectService.getEmployeeAssignments(emp.id);
      const activeList = data.activeAssignments || [];
      const rawPrimary = activeList.find((a: any) => a.is_primary) || activeList[0] || null;
      const primary_project = rawPrimary
        ? {
            id: rawPrimary.id,
            project_id: rawPrimary.project_id,
            project_name: rawPrimary.project_name,
            project_code: rawPrimary.project_code,
            external_rider_id: rawPrimary.external_rider_id,
            external_id_type: rawPrimary.external_id_type,
            start_date: rawPrimary.assignment_start_date,
            is_primary: rawPrimary.is_primary,
          }
        : null;

      const external_ids = activeList
        .filter((a: any) => a.external_rider_id)
        .map((a: any) => ({
          project_id: a.project_id,
          project_name: a.project_name,
          external_rider_id: a.external_rider_id,
          external_id_type: a.external_id_type,
          is_primary: a.is_primary,
          start_date: a.assignment_start_date,
        }));

      const enriched: EnrichedProjectEmployee = {
        id: emp.id,
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        visa_contractor_type: emp.visa_contractor_type || emp.contractor || 'Allied DXB',
        contractor: emp.contractor || emp.visa_contractor_type || 'Allied DXB',
        vendor_name: emp.vendor_name || '',
        current_status: emp.current_status || 'Available',
        active_assignments: activeList,
        active_projects_count: activeList.length,
        primary_project,
        latest_assignment_date: primary_project?.start_date || null,
        ended_assignments_count: (data.endedAssignments || []).length,
        external_ids,
      };
      setTargetEmployee(enriched);
      if (enriched.active_assignments.length > 0) {
        setTargetAssignment(enriched.active_assignments[0]);
        const diffProject = projectsList.find((p) => p.id !== enriched.active_assignments[0]?.project_id);
        if (diffProject) {
          setFormProjectId(diffProject.id);
        }
      } else {
        setTargetAssignment(null);
      }
    } catch (err) {
      console.error('Failed to load employee assignments for modal:', err);
    } finally {
      setEmpTypeaheadLoading(false);
    }
  };

  // Open "Change Status" modal
  const handleOpenStatusModal = (emp: EnrichedProjectEmployee) => {
    setModalError(null);
    setModalSuccessMsg(null);
    setTargetEmployee(emp);
    setFormEmployeeId(emp.id);
    setFormNewStatus(emp.current_status || 'Assigned');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndReason('');
    setFormNotes('');
    setIsStatusModalOpen(true);
  };

  // Open "View Assignments & History" modal
  const handleOpenHistoryModal = async (emp: EnrichedProjectEmployee) => {
    setTargetEmployee(emp);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    try {
      const data = await riderProjectService.getEmployeeAssignments(emp.id);
      setAssignmentHistoryData(data);
    } catch (err) {
      console.error('Failed to load assignment history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Open Bulk Assign Modal
  const handleOpenBulkAssignModal = () => {
    if (selectedEmployeeIds.length === 0) return;
    setModalError(null);
    setModalSuccessMsg(null);
    setFormProjectId(projectsList[0]?.id || '');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormLocationState('Dubai');
    setFormNotes('');
    setIsBulkAssignModalOpen(true);
  };

  // Submit: Assign Project
  const handleSubmitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmployeeId) {
      setModalError('Please select an employee.');
      return;
    }
    if (!formProjectId) {
      setModalError('Please select a project.');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);
      await riderProjectService.assignProject({
        employee_id: formEmployeeId,
        project_id: formProjectId,
        assignment_start_date: formStartDate,
        external_rider_id: formExternalId.trim(),
        location_state: formLocationState,
        is_primary: formIsPrimary,
        notes: formNotes,
      });

      setIsAssignModalOpen(false);
      handleRefresh();
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to assign project.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Submit: End Assignment
  const handleSubmitEndAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAssignment) return;

    try {
      setModalSubmitting(true);
      setModalError(null);
      await riderProjectService.endAssignment({
        assignment_id: targetAssignment.id,
        end_date: formEndDate,
        end_reason: formEndReason,
        replacement_primary_assignment_id: formReplacementPrimaryId || undefined,
        notes: formNotes,
      });

      setIsEndModalOpen(false);
      handleRefresh();
      // If history modal was open, refresh it as well
      if (isHistoryModalOpen && targetEmployee) {
        handleOpenHistoryModal(targetEmployee);
      }
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to end project assignment.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Submit: Move Project
  const handleSubmitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !formProjectId) {
      setModalError('Missing target employee or project.');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);
      await riderProjectService.moveProject({
        employee_id: targetEmployee.id,
        old_assignment_id: targetAssignment?.id,
        new_project_id: formProjectId,
        end_date: formEndDate,
        end_reason: formEndReason,
        start_date: formStartDate,
        external_rider_id: formExternalId.trim(),
        location_state: formLocationState,
        notes: formNotes,
      });

      setIsMoveModalOpen(false);
      handleRefresh();
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to move project.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Submit: Change Status
  const handleSubmitStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmployee || !formNewStatus) {
      setModalError('Missing required status details.');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError(null);
      await riderProjectService.changeStatus({
        employee_id: targetEmployee.id,
        status: formNewStatus,
        effective_date: formStartDate,
        reason: formEndReason || `Operational update to ${formNewStatus}`,
        notes: formNotes,
      });

      setIsStatusModalOpen(false);
      handleRefresh();
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to update employee status.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Action: Set Primary Project from History/Detail modal
  const handleSetPrimary = async (assignmentId: string) => {
    if (!targetEmployee) return;
    try {
      await riderProjectService.setPrimaryProject(targetEmployee.id, assignmentId);
      handleOpenHistoryModal(targetEmployee);
      handleRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to set primary project');
    }
  };

  // Submit: Bulk Assign
  const handleSubmitBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0 || !formProjectId) return;

    try {
      setModalSubmitting(true);
      setModalError(null);
      await riderProjectService.bulkAssign({
        employee_ids: selectedEmployeeIds,
        project_id: formProjectId,
        start_date: formStartDate,
        location_state: formLocationState,
        notes: formNotes,
      });

      setIsBulkAssignModalOpen(false);
      setSelectedEmployeeIds([]);
      handleRefresh();
    } catch (err: any) {
      setModalError(err.response?.data?.error || err.message || 'Failed to execute bulk assignment.');
    } finally {
      setModalSubmitting(false);
    }
  };

  // Employee typeahead search for assign modal
  useEffect(() => {
    if (!empTypeaheadQuery || formEmployeeId) {
      setEmpTypeaheadResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setEmpTypeaheadLoading(true);
        const res = await masterEmployeeService.searchEmployees(empTypeaheadQuery);
        setEmpTypeaheadResults(res || []);
      } catch (err) {
        console.error('Typeahead search error:', err);
      } finally {
        setEmpTypeaheadLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [empTypeaheadQuery, formEmployeeId]);

  // Label for External ID input based on selected project
  const getExternalIdLabel = (projId: string) => {
    const p = projectsList.find((x) => x.id === projId);
    const pName = (p?.name || '').toLowerCase();
    if (pName.includes('noon')) return 'Noon NIM ID (Required for Noon Payroll)';
    if (pName.includes('keeta')) return 'Keeta Courier ID (Required for Keeta Payroll)';
    if (pName.includes('talabat')) return 'Talabat Rider Code';
    if (pName.includes('labour') || pName.includes('construction')) return 'Project Person / Worker Code';
    return 'Project / External Rider ID';
  };

  // Render Employee 360 view if selected
  if (selected360EmployeeId) {
    return (
      <Employee360ProfileView
        employeeId={selected360EmployeeId}
        onBack={() => {
          setSelected360EmployeeId(null);
          if (onClearInitialEmployeeId) onClearInitialEmployeeId();
          handleRefresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 sm:p-6 space-y-6">
      {/* 1. Top Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Rider / Project Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operational workflow centered on Employee + Project + External Rider ID. Single source of truth.
            </p>
          </div>
        </div>

        {/* Top Actions: + Assign Project (primary), Transfer Project & End Assignment (secondary) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleRefresh}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || summaryLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Project Master Full Page */}
          <button
            onClick={() => onNavigateModule?.('projects_list')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Open dedicated Project Master workspace"
          >
            <Building className="w-3.5 h-3.5 text-blue-600" />
            Project Master
          </button>

          {/* Assignments Directory Full Page */}
          <button
            onClick={() => onNavigateModule?.('projects_assignments')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Open dedicated Project Assignments Directory"
          >
            <Users className="w-3.5 h-3.5 text-emerald-600" />
            Assignments Directory
          </button>

          {/* Transfer Project Full Page */}
          <button
            onClick={() => onNavigateModule?.('projects_transfer')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
            title="Transfer / Move employee to a different project"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Transfer Project
          </button>

          {/* + Assign Project Full Page */}
          <button
            onClick={() => onNavigateModule?.('projects_assign')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            title="Open dedicated Full-Page Assign Project workspace"
          >
            <Plus className="w-4 h-4" />
            + Assign Project
          </button>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
          {/* Search: Employee name, Employee code, External Rider ID */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Employee name, Employee code, External Rider ID..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter 1: Project */}
          <div>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full py-2 px-2.5 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Projects</option>
              <option value="UNASSIGNED">Unassigned Pool</option>
              {projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Visa / Contractor */}
          <div>
            <select
              value={selectedVisaContractor}
              onChange={(e) => setSelectedVisaContractor(e.target.value)}
              className="w-full py-2 px-2.5 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Visa / Contractors</option>
              {visaContractorsList.map((vc) => (
                <option key={vc} value={vc}>
                  {vc}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Assignment Status */}
          <div>
            <select
              value={selectedAssignmentStatus}
              onChange={(e) => setSelectedAssignmentStatus(e.target.value)}
              className="w-full py-2 px-2.5 text-xs bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Project Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="AVAILABLE">Ended / None</option>
            </select>
          </div>
        </div>

        {/* Secondary Row: Primary / Additional Filter & Active Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Assignment Type:</span>
            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Roles' },
                { id: 'PRIMARY', label: 'Primary Only' },
                { id: 'ADDITIONAL', label: 'Additional (Secondary)' },
                { id: 'MULTI', label: 'Multiple Active Projects' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSelectedPrimaryAdditional(opt.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    selectedPrimaryAdditional === opt.id
                      ? 'bg-blue-600 text-white font-semibold'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {(selectedProjectId !== 'ALL' || selectedVisaContractor !== 'ALL' || selectedAssignmentStatus !== 'ALL' || selectedPrimaryAdditional !== 'ALL' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedProjectId('ALL');
                setSelectedVisaContractor('ALL');
                setSelectedAssignmentStatus('ALL');
                setSelectedPrimaryAdditional('ALL');
                setSearchQuery('');
              }}
              className="px-2.5 py-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset All Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Main Operational Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Employee Code</th>
                <th className="py-3 px-3">Visa / Contractor</th>
                <th className="py-3 px-3">Current Project</th>
                <th className="py-3 px-3">External Rider ID</th>
                <th className="py-3 px-3">External ID Type</th>
                <th className="py-3 px-3">Start Date</th>
                <th className="py-3 px-3">Assignment Status</th>
                <th className="py-3 px-3">Primary / Additional</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    Loading employee project assignments...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <AlertTriangle className="w-6 h-6 mx-auto text-amber-500 mb-2" />
                    No employees match the selected search and filter criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const isMulti = emp.active_projects_count > 1;
                  const isAssigned = emp.active_assignments.length > 0;
                  const primaryAssgn = emp.primary_project || emp.active_assignments.find((a) => a.is_primary) || emp.active_assignments[0] || null;

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      {/* 1. Employee */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {emp.full_name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{emp.full_name}</span>
                              {isMulti && (
                                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded text-[10px] font-bold">
                                  {emp.active_projects_count} Projects
                                </span>
                              )}
                            </div>
                            {emp.branch && (
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                                {emp.branch}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Employee Code */}
                      <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 text-[11px]">
                        {emp.employee_code}
                      </td>

                      {/* 3. Visa / Contractor */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {emp.visa_contractor_type || emp.contractor || 'Allied DXB'}
                        </div>
                        {emp.vendor_name && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            {emp.vendor_name}
                          </div>
                        )}
                      </td>

                      {/* 4. Current Project */}
                      <td className="py-3 px-3">
                        {!isAssigned ? (
                          <span className="text-slate-400 italic text-[11px]">Unassigned Pool</span>
                        ) : isMulti ? (
                          <div className="flex flex-wrap items-center gap-1">
                            {emp.active_assignments.map((pa) => (
                              <span
                                key={pa.id}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 ${
                                  pa.is_primary
                                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 font-semibold'
                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {pa.is_primary && <Star className="w-2.5 h-2.5 fill-blue-600 text-blue-600 shrink-0" />}
                                <span>{pa.project_name}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            {primaryAssgn?.project_name || 'Assigned'}
                          </div>
                        )}
                      </td>

                      {/* 5. External Rider ID */}
                      <td className="py-3 px-3">
                        {emp.external_ids.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                            {emp.external_ids.map((ext, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded font-semibold border border-slate-200 dark:border-slate-600"
                              >
                                {ext.external_rider_id}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* 6. External ID Type */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                        {emp.external_ids.length > 0 ? (
                          <span>{emp.external_ids[0].external_id_type || 'Rider ID'}</span>
                        ) : primaryAssgn ? (
                          <span>{primaryAssgn.external_id_type || 'Rider ID'}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* 7. Start Date */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {primaryAssgn?.start_date || emp.latest_assignment_date || '—'}
                      </td>

                      {/* 8. Assignment Status */}
                      <td className="py-3 px-3">
                        {isAssigned ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 inline-block">
                            Ended
                          </span>
                        )}
                      </td>

                      {/* 9. Primary / Additional */}
                      <td className="py-3 px-3">
                        {!isAssigned ? (
                          <span className="text-slate-400">—</span>
                        ) : isMulti ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 inline-block">
                            Primary + Additional ({emp.active_assignments.length})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 inline-block">
                            Primary
                          </span>
                        )}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Assign */}
                          <button
                            onClick={() => handleOpenAssignModal(emp)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                            title="Assign Project"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>

                          {/* Transfer Project */}
                          {emp.active_assignments.length > 0 && (
                            <button
                              onClick={() => handleOpenMoveModal(emp)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                              title="Transfer Project (Move)"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* End Assignment */}
                          {emp.active_assignments.length > 0 && (
                            <button
                              onClick={() => handleOpenEndModal(emp, primaryAssgn as any)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="End Project Assignment"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View 360 */}
                          <button
                            onClick={() => setSelected360EmployeeId(emp.id)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                            title="Open Employee 360 Profile"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing <span className="font-semibold text-slate-700 dark:text-slate-200">{employees.length}</span> of{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-200">{totalCount}</span> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page <span className="font-semibold text-slate-700 dark:text-slate-200">{page}</span> of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">{totalPages}</span>
            </span>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* MODAL 1: ASSIGN PROJECT (Supports Multiple Active Projects & Inline External ID) */}
      {/* ============================================================================== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded">
                  <Briefcase className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Assign Project</h2>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAssign} className="space-y-4 text-xs">
              {/* Employee Selection */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                {targetEmployee ? (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{targetEmployee.full_name}</div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                        {targetEmployee.employee_code} • Current Active Projects: {targetEmployee.active_projects_count}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">
                      Selected
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={empTypeaheadQuery}
                      onChange={(e) => {
                        setEmpTypeaheadQuery(e.target.value);
                        setFormEmployeeId('');
                      }}
                      placeholder="Type name, employee code, or Emirates ID..."
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {empTypeaheadLoading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    )}

                    {/* Results Dropdown */}
                    {empTypeaheadResults.length > 0 && !formEmployeeId && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                        {empTypeaheadResults.map((e) => (
                          <button
                            key={e.id}
                            type="button"
                            onClick={() => {
                              setFormEmployeeId(e.id);
                              setEmpTypeaheadQuery(`${e.full_name} (${e.employee_code})`);
                              setEmpTypeaheadResults([]);
                            }}
                            className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">{e.full_name}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {e.employee_code} • {e.current_status || 'Available'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Project Selection */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => handleProjectSelectChange(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>
                    Select Project
                  </option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* External Rider ID / NIM ID (Inline Mapping) */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {getExternalIdLabel(formProjectId)}
                </label>
                <input
                  type="text"
                  value={formExternalId}
                  onChange={(e) => setFormExternalId(e.target.value)}
                  placeholder="e.g. NIM-8801, KT-7001, or external rider reference"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Automatically maps to payroll resolvers (Noon NIM ID / Keeta Courier ID). No separate source code setup required.
                </p>
              </div>

              {/* Start Date & Location */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignment Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Project Location / State
                  </label>
                  <select
                    value={formLocationState}
                    onChange={(e) => setFormLocationState(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Dubai">Dubai</option>
                    <option value="Abu Dhabi">Abu Dhabi</option>
                    <option value="Sharjah">Sharjah</option>
                    <option value="Ajman">Ajman</option>
                    <option value="RAK">Ras Al Khaimah</option>
                  </select>
                </div>
              </div>

              {/* Primary Project Checkbox */}
              <div className="p-3 bg-blue-50/60 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsPrimary}
                    onChange={(e) => setFormIsPrimary(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Set as Primary Project
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Sets this project as the employee's main display and reporting project. Any other active projects will remain active simultaneously.
                    </p>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Optional assignment instructions or notes..."
                  className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Multi-Project Notice */}
              <div className="p-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-lg text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500 shrink-0" />
                <span>
                  Multiple active assignments are supported. Assigning this project will not terminate existing projects.
                </span>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 2: END PROJECT ASSIGNMENT (Non-destructive, recorded with Reason & Actor) */}
      {/* ============================================================================== */}
      {isEndModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded">
                  <XCircle className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">End Project Assignment</h2>
              </div>
              <button
                onClick={() => setIsEndModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* If Employee is not yet selected (Top-Level Modal flow) */}
            {!targetEmployee ? (
              <div className="space-y-3">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  Search & Select Employee <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={empTypeaheadQuery}
                    onChange={(e) => {
                      setEmpTypeaheadQuery(e.target.value);
                      setFormEmployeeId('');
                    }}
                    placeholder="Type name, employee code, or Emirates ID..."
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    autoFocus
                  />
                  {empTypeaheadLoading && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  )}

                  {empTypeaheadResults.length > 0 && !formEmployeeId && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {empTypeaheadResults.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => handleSelectEmployeeForMoveOrEnd(e)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs"
                        >
                          <div className="font-semibold text-slate-900 dark:text-white">{e.full_name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {e.employee_code} • {e.current_status || 'Available'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{targetEmployee.full_name}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    {targetEmployee.employee_code} • {targetEmployee.visa_contractor_type || 'Allied DXB'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetEmployee(null);
                    setTargetAssignment(null);
                    setFormEmployeeId('');
                    setEmpTypeaheadQuery('');
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Change
                </button>
              </div>
            )}

            {targetEmployee && targetEmployee.active_assignments.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  No Active Assignments
                </div>
                <p className="text-[11px]">
                  {targetEmployee.full_name} is currently in the unassigned pool and has no active project assignments to end.
                </p>
              </div>
            ) : targetEmployee && (
              <form onSubmit={handleSubmitEndAssignment} className="space-y-4 text-xs">
                {/* Project Selection if multiple active assignments */}
                {targetEmployee.active_assignments.length > 1 ? (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Select Project Assignment to End <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetAssignment?.id || ''}
                      onChange={(e) => {
                        const assgn = targetEmployee.active_assignments.find((a) => a.id === e.target.value);
                        setTargetAssignment(assgn || null);
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {targetEmployee.active_assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.project_name} {a.is_primary ? '(Primary)' : '(Additional)'} {a.external_rider_id ? `[${a.external_rider_id}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-xs space-y-1">
                    <div>
                      <span className="text-slate-500">Project to End: </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {targetAssignment?.project_name || targetEmployee.active_assignments[0]?.project_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Started on: </span>
                      <span className="font-mono">
                        {targetAssignment?.assignment_start_date || targetEmployee.active_assignments[0]?.assignment_start_date || '-'}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Assignment End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Ending Assignment <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formEndReason}
                    onChange={(e) => setFormEndReason(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Project Changed">Project Changed (Transferred)</option>
                    <option value="Project Completed">Project Completed</option>
                    <option value="Client Offboarded">Client Offboarded</option>
                    <option value="Employee Exit">Employee Exit / Resignation</option>
                    <option value="Temporary Removal">Temporary Removal / Vacation</option>
                    <option value="Performance Reallocation">Performance Reallocation</option>
                    <option value="Other">Other Operational Reason</option>
                  </select>
                </div>

                {/* Select Replacement Primary Project if ending primary assignment */}
                {targetAssignment?.is_primary && (targetEmployee?.active_assignments || []).filter((a) => a.id !== targetAssignment?.id).length > 0 && (
                  <div>
                    <label className="block font-semibold text-amber-700 dark:text-amber-400 mb-1">
                      Replacement Primary Project
                    </label>
                    <select
                      value={formReplacementPrimaryId}
                      onChange={(e) => setFormReplacementPrimaryId(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      <option value="">Auto-Promote (First remaining active project)</option>
                      {(targetEmployee?.active_assignments || [])
                        .filter((a) => a.id !== targetAssignment?.id)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.project_name} ({a.project_code})
                          </option>
                        ))}
                      <option value="NONE">Leave without Primary Project</option>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Select which remaining active project becomes Primary, or leave without primary according to configuration.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional details regarding the unassignment..."
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <History className="w-4 h-4 shrink-0" />
                  <span>
                    This assignment record will be preserved in permanent history as ENDED. It will never be deleted.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsEndModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting || !targetAssignment}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {modalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Confirm End Assignment
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 3: MOVE PROJECT (Transfer from Old Project to New Project) */}
      {/* ============================================================================== */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Transfer Project</h2>
              </div>
              <button
                onClick={() => setIsMoveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {!targetEmployee ? (
              <div className="space-y-3">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 text-xs">
                  Search & Select Employee <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={empTypeaheadQuery}
                    onChange={(e) => {
                      setEmpTypeaheadQuery(e.target.value);
                      setFormEmployeeId('');
                    }}
                    placeholder="Type name, employee code, or Emirates ID..."
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                    autoFocus
                  />
                  {empTypeaheadLoading && (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  )}

                  {empTypeaheadResults.length > 0 && !formEmployeeId && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto z-20">
                      {empTypeaheadResults.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => handleSelectEmployeeForMoveOrEnd(e)}
                          className="w-full text-left p-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0 text-xs"
                        >
                          <div className="font-semibold text-slate-900 dark:text-white">{e.full_name}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {e.employee_code} • {e.current_status || 'Available'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-xs flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">{targetEmployee.full_name}</div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                    {targetEmployee.employee_code} • {targetEmployee.visa_contractor_type || 'Allied DXB'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetEmployee(null);
                    setTargetAssignment(null);
                    setFormEmployeeId('');
                    setEmpTypeaheadQuery('');
                  }}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Change
                </button>
              </div>
            )}

            {targetEmployee && targetEmployee.active_assignments.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-xs space-y-2">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  No Active Assignments
                </div>
                <p className="text-[11px]">
                  {targetEmployee.full_name} has no active project to transfer from. Please use the <strong>+ Assign Project</strong> button to assign a new project.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoveModalOpen(false);
                      handleOpenAssignModal(targetEmployee);
                    }}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors"
                  >
                    Switch to Assign Project
                  </button>
                </div>
              </div>
            ) : targetEmployee && (
              <form onSubmit={handleSubmitMove} className="space-y-4 text-xs">
                {/* Transfer From Project Selector */}
                {targetEmployee.active_assignments.length > 1 ? (
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Transfer From (Old Project) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetAssignment?.id || ''}
                      onChange={(e) => {
                        const assgn = targetEmployee.active_assignments.find((a) => a.id === e.target.value);
                        setTargetAssignment(assgn || null);
                      }}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {targetEmployee.active_assignments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.project_name} {a.is_primary ? '(Primary)' : '(Additional)'}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-xs flex items-center justify-between">
                    <div>
                      <span className="text-slate-500">Current Assignment: </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {targetAssignment?.project_name || targetEmployee.active_assignments[0]?.project_name}
                      </span>
                    </div>
                  </div>
                )}

                {/* New Project Target */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Project <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formProjectId}
                    onChange={(e) => handleProjectSelectChange(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="" disabled>
                      Select New Project
                    </option>
                    {projectsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      End Date (Old Project) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Start Date (New Project) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>

                {/* Transfer Reason */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Transfer Reason <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formEndReason}
                    onChange={(e) => setFormEndReason(e.target.value)}
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="Operational Reallocation">Operational Reallocation</option>
                    <option value="Client Demand Increase">Client Demand Increase</option>
                    <option value="Hub Relocation">Hub Relocation</option>
                    <option value="Employee Request">Employee Request</option>
                    <option value="Performance Transfer">Performance Transfer</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* New External ID */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {getExternalIdLabel(formProjectId)}
                  </label>
                  <input
                    type="text"
                    value={formExternalId}
                    onChange={(e) => setFormExternalId(e.target.value)}
                    placeholder="e.g. NIM-8801, KT-7001"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsMoveModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting || !formProjectId}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {modalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    Confirm Transfer
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 4: CHANGE EMPLOYEE STATUS (Canonical Status & Server-Side Audit) */}
      {/* ============================================================================== */}
      {isStatusModalOpen && targetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Change Working Status</h2>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 text-xs flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{targetEmployee.full_name}</div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono">
                  {targetEmployee.employee_code}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Current Status:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  {targetEmployee.current_status}
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitStatus} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={formNewStatus}
                  onChange={(e) => setFormNewStatus(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  required
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

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Effective Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Status Change <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formEndReason}
                  onChange={(e) => setFormEndReason(e.target.value)}
                  placeholder="e.g. Annual leave approved, Return to service, Contract completion"
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional notes for permanent HR audit..."
                  className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Update Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 5: VIEW ASSIGNMENTS & HISTORICAL TIMELINE */}
      {/* ============================================================================== */}
      {isHistoryModalOpen && targetEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Project Assignments & History
                  </h2>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{targetEmployee.full_name}</span>
                    <span>•</span>
                    <span className="font-mono">{targetEmployee.employee_code}</span>
                    <span>•</span>
                    <span>Status: {targetEmployee.current_status}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {historyLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  Loading assignment history...
                </div>
              ) : (
                <>
                  {/* Section 1: Active Project Assignments */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Current Active Projects ({assignmentHistoryData?.activeAssignments?.length || 0})
                      </h3>
                      <button
                        onClick={() => {
                          setIsHistoryModalOpen(false);
                          handleOpenAssignModal(targetEmployee);
                        }}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 rounded font-semibold text-[11px] flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Assign Additional Project
                      </button>
                    </div>

                    {(assignmentHistoryData?.activeAssignments || []).length === 0 ? (
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-slate-400 text-center">
                        No active project assignments. Employee is currently unassigned.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {assignmentHistoryData.activeAssignments.map((pa: ActiveAssignmentItem) => (
                          <div
                            key={pa.id}
                            className={`p-3.5 rounded-lg border flex items-center justify-between ${
                              pa.is_primary
                                ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                                : 'bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white text-sm">
                                  {pa.project_name}
                                </span>
                                {pa.is_primary ? (
                                  <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-bold flex items-center gap-1">
                                    <Star className="w-2.5 h-2.5 fill-white" /> Primary Project
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium">
                                    Additional Active
                                  </span>
                                )}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                                <span>Code: <strong className="font-mono text-slate-700 dark:text-slate-300">{pa.project_code}</strong></span>
                                <span>Started: <strong className="font-mono text-slate-700 dark:text-slate-300">{pa.assignment_start_date}</strong></span>
                                {pa.external_rider_id && (
                                  <span>External ID: <strong className="font-mono text-indigo-600 dark:text-indigo-400">{pa.external_rider_id}</strong></span>
                                )}
                                {pa.location_state && <span>Location: {pa.location_state}</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!pa.is_primary && (
                                <button
                                  onClick={() => handleSetPrimary(pa.id)}
                                  className="px-2.5 py-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded font-semibold"
                                >
                                  Make Primary
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEndModal(targetEmployee, pa)}
                                className="px-2.5 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-800 rounded font-semibold"
                              >
                                End Project
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Historical / Ended Project Assignments */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <History className="w-4 h-4 text-slate-500" />
                      Assignment History ({assignmentHistoryData?.endedAssignments?.length || 0})
                    </h3>

                    {(assignmentHistoryData?.endedAssignments || []).length === 0 ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-slate-400 text-center">
                        No previous ended assignments recorded.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-semibold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Project</th>
                              <th className="py-2.5 px-3">Dates</th>
                              <th className="py-2.5 px-3">Reason for Ending</th>
                              <th className="py-2.5 px-3">Ended By</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {assignmentHistoryData.endedAssignments.map((ha: ActiveAssignmentItem) => (
                              <tr key={ha.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                                <td className="py-2.5 px-3">
                                  <div className="font-semibold text-slate-900 dark:text-white">{ha.project_name}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{ha.project_code}</div>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px]">
                                  {ha.assignment_start_date} <span className="text-slate-400">→</span> {ha.assignment_end_date || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                                  {ha.end_reason || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {ha.ended_by || '—'}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded text-[10px] font-bold">
                                    ENDED
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Status History */}
                  <div className="space-y-2.5 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-500" />
                      Status Audit History ({assignmentHistoryData?.statusHistory?.length || 0})
                    </h3>

                    {(assignmentHistoryData?.statusHistory || []).length === 0 ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg text-slate-400 text-center">
                        No previous status changes logged.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {assignmentHistoryData.statusHistory.map((sh: any) => (
                          <div
                            key={sh.id}
                            className="p-2.5 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-white">{sh.status}</span>
                              <span className="text-slate-500 ml-2">Reason: {sh.reason}</span>
                            </div>
                            <div className="text-right text-slate-400 font-mono text-[10px]">
                              {sh.effective_from || sh.created_at?.split('T')[0]} • By: {sh.changed_by}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex justify-end shrink-0">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL 6: BULK ASSIGN PROJECTS */}
      {/* ============================================================================== */}
      {isBulkAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded">
                  <Layers className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Bulk Assign to Project ({selectedEmployeeIds.length})
                </h2>
              </div>
              <button
                onClick={() => setIsBulkAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitBulkAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="" disabled>
                    Select Project
                  </option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location / State
                </label>
                <select
                  value={formLocationState}
                  onChange={(e) => setFormLocationState(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Dubai">Dubai</option>
                  <option value="Abu Dhabi">Abu Dhabi</option>
                  <option value="Sharjah">Sharjah</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Bulk assignment operational note..."
                  className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>
                  This will assign the project to all {selectedEmployeeIds.length} selected employees without terminating their existing assignments.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsBulkAssignModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                >
                  {modalSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Bulk Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
