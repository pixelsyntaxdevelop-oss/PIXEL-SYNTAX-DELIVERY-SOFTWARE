import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit,
  RotateCcw,
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Building,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  ArrowLeft,
  ShieldCheck,
  CreditCard,
  Phone,
  Mail,
  Truck,
  Smartphone,
  FileText,
  AlertCircle,
  UserPlus,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { RiderDriver, NavigationModule } from '../../types/erp';
import { Employee360ProfileView } from '../employee/Employee360ProfileView';
import { masterEmployeeService, EmployeeStatsResponse } from '../../services/masterEmployeeService';
import { DbEmployeeMaster, DbBranch, DbProject, DbVehicle, DbSimCardMaster, DbDepartment, DbAsset, DbVisaContractorType, DbVendorCompany } from '../../types/database';
import { AUTHORITATIVE_BRANCHES, AUTHORITATIVE_CONTRACTOR_CATEGORIES, mapToAuthoritativeBranch } from '../../lib/branches';
import { CreateEmployeeModal } from '../employee/CreateEmployeeModal';
import { EditEmployeeModal } from '../employee/EditEmployeeModal';
import { ImportEmployeesModal } from '../employee/ImportEmployeesModal';
import {
  BulkUpdateBranchModal,
  BulkUpdateContractorModal,
  BulkUpdateProjectModal,
} from '../employee/BulkActionModals';
import { EmployeeAssignmentModals, AssignmentModalType } from '../employee/EmployeeAssignmentModals';
import { EmployeeRowActionMenu } from '../employee/EmployeeRowActionMenu';
import { candidateService } from '../../services/candidateService';
import { riderProjectService, ProjectMasterItem } from '../../services/riderProjectService';
import { resolveCanonicalStatus, resolveEmployeeRecordStatus, isLifecycleOverrideStatus } from '../../utils/canonicalStatus';

/**
 * Authoritative check if employee is currently assigned to a Labour project.
 * Excludes Noon Minutes, Keeta, Office, Talabat, Deliveroo, Amazon, Careem, Logistics, Riders.
 */
export function isLabourEmployeeRecord(emp: any, projectsList: DbProject[] = []): boolean {
  if (!emp) return false;
  const pId = String(emp.project_id || (emp as any).projectId || '').toLowerCase();
  const pName = String(emp.project_name || emp.current_project || (emp as any).project || '').toLowerCase();

  // If unassigned or empty
  if (!pId && (!pName || pName === '-' || pName === 'unassigned')) {
    return false;
  }

  // Strict rejection for riders, office, logistics, or non-Labour projects
  if (
    pName.includes('noon') ||
    pName.includes('keeta') ||
    pName.includes('talabat') ||
    pName.includes('deliveroo') ||
    pName.includes('amazon') ||
    pName.includes('careem') ||
    pName.includes('office') ||
    pId.startsWith('proj_noon') ||
    pId.startsWith('proj_keeta') ||
    pId.startsWith('proj_talabat') ||
    pId.startsWith('proj_deliveroo') ||
    pId.startsWith('proj_amazon') ||
    pId.startsWith('proj_careem') ||
    pId.startsWith('proj_office')
  ) {
    return false;
  }

  // Check project definition if available
  const proj = projectsList.find((p) => p.id === emp.project_id);
  const pType = String((proj as any)?.project_type || '').toUpperCase();
  const pClient = String((proj as any)?.client_name || '').toLowerCase();

  if (pType === 'RIDER' || pType === 'OFFICE' || pType === 'LOGISTICS') {
    return false;
  }

  return (
    pType === 'LABOR' ||
    pType === 'LABOUR' ||
    pId === 'proj_labour_1' ||
    pName.includes('labour') ||
    pName.includes('labor') ||
    pClient.includes('labour') ||
    pClient.includes('labor')
  );
}

interface RidersDriversViewProps {
  riders?: RiderDriver[];
  onAddRider?: (newRider: RiderDriver) => void;
  onNavigateModule?: (module: NavigationModule, params?: any) => void;
  lang?: 'EN' | 'AR';
  initialEmployeeId?: string | null;
  onClearInitialEmployeeId?: () => void;
}

export const RidersDriversView: React.FC<RidersDriversViewProps> = ({
  riders,
  onAddRider,
  onNavigateModule,
  lang = 'EN',
  initialEmployeeId,
  onClearInitialEmployeeId,
}) => {
  // Navigation / 360 View State
  const [selected360EmployeeId, setSelected360EmployeeId] = useState<string | null>(initialEmployeeId || null);

  // Sync external initialEmployeeId if provided
  useEffect(() => {
    setSelected360EmployeeId(initialEmployeeId || null);
  }, [initialEmployeeId]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<DbEmployeeMaster | null>(null);
  const [isBulkBranchOpen, setIsBulkBranchOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [isBulkProjectOpen, setIsBulkProjectOpen] = useState(false);
  const [activeMoreMenu, setActiveMoreMenu] = useState(false);

  // Operational Assignment Modal State
  const [activeAssignmentModal, setActiveAssignmentModal] = useState<AssignmentModalType>(null);
  const [assignmentEmployee, setAssignmentEmployee] = useState<DbEmployeeMaster | null>(null);

  // Row Action Dropdown state
  const [openRowActionId, setOpenRowActionId] = useState<string | null>(null);
  const [rowActionAnchor, setRowActionAnchor] = useState<HTMLElement | null>(null);

  // Selection state for bulk actions
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Metadata / Lookup Lists
  const [branches, setBranches] = useState<DbBranch[]>([]);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProjectMasterItem[]>([]);
  const [activeProjectsLoading, setActiveProjectsLoading] = useState(false);
  const [vehicles, setVehicles] = useState<DbVehicle[]>([]);
  const [sims, setSims] = useState<DbSimCardMaster[]>([]);
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [assets, setAssets] = useState<DbAsset[]>([]);
  const [visaContractorTypes, setVisaContractorTypes] = useState<DbVisaContractorType[]>([]);
  const [vendorCompanies, setVendorCompanies] = useState<DbVendorCompany[]>([]);

  // Live Stats State
  const [stats, setStats] = useState<EmployeeStatsResponse>({
    totalEmployees: 0,
    activeEmployees: 0,
    inactiveEmployees: 0,
    statusCounts: {
      assignedActive: 0,
      availableUnassigned: 0,
      onLeave: 0,
      onHold: 0,
      absconding: 0,
      terminated: 0,
      exited: 0,
    },
    categoryCounts: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Filter & Search State
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedContractor, setSelectedContractor] = useState('ALL');
  const [selectedEnabled, setSelectedEnabled] = useState('ALL');

  // Server-side Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [employees, setEmployees] = useState<DbEmployeeMaster[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  // Success Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Close open dropdowns on outside click
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('[data-employee-action-portal]') ||
        target?.closest('[data-employee-action-trigger]')
      ) {
        return;
      }
      if (dropdownRef.current && !dropdownRef.current.contains(target as Node)) {
        setActiveMoreMenu(false);
        setOpenRowActionId(null);
        setRowActionAnchor(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 300ms Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1); // Reset to page 1 on new search query
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load auxiliary lookups (branches, projects, etc.)
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [bList, pList, vList, sList, dList, aList, vctList, vndList] = await Promise.all([
          masterEmployeeService.getBranches(),
          masterEmployeeService.getProjects(),
          masterEmployeeService.getVehicles(),
          masterEmployeeService.getSimCards(),
          masterEmployeeService.getDepartments(),
          masterEmployeeService.getAssets(),
          masterEmployeeService.getVisaContractorTypes(),
          masterEmployeeService.getVendors(),
        ]);
        setBranches(Array.isArray(bList) ? bList : []);
        setProjects(Array.isArray(pList) ? pList : []);
        setVehicles(Array.isArray(vList) ? vList : []);
        setSims(Array.isArray(sList) ? sList : []);
        setDepartments(Array.isArray(dList) ? dList : []);
        setAssets(Array.isArray(aList) ? aList : []);
        setVisaContractorTypes(Array.isArray(vctList) ? vctList : []);
        setVendorCompanies(Array.isArray(vndList) ? vndList : []);
      } catch (err) {
        console.warn('Error fetching lookups for employees', err);
      }
    };
    loadLookups();
  }, []);

  // Fetch active projects dynamically from authoritative Project Management source
  const fetchActiveProjects = useCallback(async () => {
    try {
      setActiveProjectsLoading(true);
      const res = await riderProjectService.getProjectsMaster({ status: 'Active' });
      if (Array.isArray(res) && res.length > 0) {
        setActiveProjects(res);
        setProjects(res as unknown as DbProject[]);
      } else {
        const pList = await masterEmployeeService.getProjects();
        if (Array.isArray(pList) && pList.length > 0) {
          setActiveProjects(
            pList.map(p => ({
              id: p.id,
              tenant_id: p.tenant_id || 'company_pixel_syntax',
              name: p.name,
              code: p.code || '',
              external_id_label: (p as any).external_id_label || 'Rider ID',
              status: 'Active' as const,
              active_count: (p as any).active_count ?? (p as any).employee_count ?? 0,
              created_at: p.created_at || '',
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to load active projects for Employee Management', err);
    } finally {
      setActiveProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveProjects();
  }, [fetchActiveProjects]);

  // Fetch KPI Stats from backend
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await masterEmployeeService.getEmployeeStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load employee stats', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Paginated Employees from backend with active filters
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchEmployees = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);

    try {
      const res = await masterEmployeeService.getMasterEmployeesPaginated({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        branch: selectedBranch,
        status: selectedStatus,
        project: selectedProject,
        contractor: selectedContractor,
        enabled: selectedEnabled,
      });

      let returnedRecords = res.records || [];
      // Guarantee that if a specific status tab or dropdown filter is selected, only matching canonical records are rendered
      if (selectedStatus && selectedStatus !== 'ALL' && selectedStatus !== 'All Status') {
        const targetCanonical = resolveCanonicalStatus(selectedStatus);
        returnedRecords = returnedRecords.filter(emp => resolveEmployeeRecordStatus(emp) === targetCanonical);
      }

      setEmployees(returnedRecords);
      setTotalRecords(selectedStatus !== 'ALL' && selectedStatus !== 'All Status' ? returnedRecords.length : (res.total || 0));
      setTotalPages(res.totalPages || 1);

      if (res.statusCounts) {
        const sc = res.statusCounts;
        const assignedActive = sc['Assigned / Active'] ?? sc.assignedActive ?? 0;
        const availableUnassigned = sc['Available / Unassigned'] ?? sc.availableUnassigned ?? 0;
        const onLeave = sc['On Leave'] ?? sc.onLeave ?? 0;
        const emergencyLeave = sc['Emergency Leave'] ?? sc.emergencyLeave ?? 0;
        const onHold = sc['On Hold'] ?? sc.onHold ?? 0;
        const absconding = sc['Absconding'] ?? sc.absconding ?? 0;
        const terminated = sc['Terminated'] ?? sc.terminated ?? 0;
        const exited = sc['Exited'] ?? sc.exited ?? 0;
        const totalEmployees = assignedActive + availableUnassigned + onLeave + emergencyLeave + onHold + absconding + terminated + exited;
        setStats(prev => ({
          ...prev,
          totalEmployees: totalEmployees || prev.totalEmployees,
          activeEmployees: assignedActive,
          inactiveEmployees: onLeave + emergencyLeave + onHold + absconding + terminated + exited,
          statusCounts: {
            ...sc,
            assignedActive,
            availableUnassigned,
            onLeave,
            emergencyLeave,
            onHold,
            absconding,
            terminated,
            exited,
            'Assigned / Active': assignedActive,
            'Available / Unassigned': availableUnassigned,
            'On Leave': onLeave,
            'Emergency Leave': emergencyLeave,
            'On Hold': onHold,
            'Absconding': absconding,
            'Terminated': terminated,
            'Exited': exited,
          } as any,
          projectCounts: (res as any).projectCounts || (prev as any).projectCounts,
        }));
      }
    } catch (err: any) {
      setTableError(err?.message || 'Failed to load employees from server');
    } finally {
      setTableLoading(false);
    }
  }, [page, pageSize, debouncedSearch, selectedBranch, selectedStatus, selectedProject, selectedContractor, selectedEnabled]);

  // Trigger stats on mount and when mutations happen
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Trigger employees query whenever parameters change
  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Real-time synchronization when employees change across components
  useEffect(() => {
    const handleRefreshEvents = () => {
      fetchEmployees();
      fetchStats();
      fetchActiveProjects();
    };
    window.addEventListener('erp:master-employees-updated', handleRefreshEvents);
    return () => {
      window.removeEventListener('erp:master-employees-updated', handleRefreshEvents);
    };
  }, [fetchEmployees, fetchStats, fetchActiveProjects]);

  // Authoritative project badge count helper matching filtered employee results exactly
  const getProjectBadgeCount = useCallback((p: { id: string; name: string; code?: string; active_count?: number }) => {
    // If this project is currently selected and the table is showing results with no conflicting status filter,
    // totalRecords is the live count returned by the API
    const isCurrentlySelected = selectedProject === p.name || selectedProject === p.id;
    if (isCurrentlySelected && totalRecords !== undefined && totalRecords !== null && (selectedStatus === 'ALL' || selectedStatus === 'All Status')) {
      return totalRecords;
    }

    const counts = (stats as any)?.projectCounts;
    if (counts && typeof counts === 'object') {
      // 1. Exact ID
      if (counts[p.id] !== undefined && counts[p.id] !== null) return counts[p.id];
      // 2. Exact Name
      if (counts[p.name] !== undefined && counts[p.name] !== null) return counts[p.name];
      // 3. Lowercase Name
      if (p.name && counts[p.name.trim().toLowerCase()] !== undefined) return counts[p.name.trim().toLowerCase()];
      // 4. Code
      if (p.code && counts[p.code] !== undefined) return counts[p.code];
      // 5. Stripped version ID (e.g. proj_noon for proj_noon_1)
      const baseId = p.id ? String(p.id).replace(/_\d+$/, '') : '';
      if (baseId && counts[baseId] !== undefined) return counts[baseId];
      // 6. Substring / fuzzy match across keys
      if (p.name) {
        const norm = p.name.trim().toLowerCase();
        for (const [k, v] of Object.entries(counts)) {
          const kNorm = k.trim().toLowerCase();
          if (kNorm === norm || (norm.length >= 4 && (kNorm.includes(norm) || norm.includes(kNorm)))) {
            return v as number;
          }
        }
      }
    }

    // Fallback to active_count or employee_count from project object if defined
    if (typeof p.active_count === 'number' && p.active_count >= 0) return p.active_count;
    if (typeof (p as any).employee_count === 'number' && (p as any).employee_count >= 0) return (p as any).employee_count;
    return 0;
  }, [selectedProject, selectedStatus, totalRecords, stats]);

  // Multi-select handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedEmployeeIds(employees.map(emp => emp.id));
    } else {
      setSelectedEmployeeIds([]);
    }
  };

  const handleToggleSelectRow = (id: string) => {
    setSelectedEmployeeIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setSelectedBranch('ALL');
    setSelectedStatus('ALL');
    setSelectedProject('ALL');
    setSelectedContractor('ALL');
    setSelectedEnabled('ALL');
    setPage(1);
  };

  // Unassign project directly from row action
  const handleUnassignProject = async (emp: DbEmployeeMaster) => {
    setOpenRowActionId(null);
    setRowActionAnchor(null);
    const confirmed = window.confirm(
      `Are you sure you want to unassign ${emp.full_name || emp.employee_code} from project "${emp.project_name}"?`
    );
    if (!confirmed) return;
    try {
      const res = await masterEmployeeService.unassignProject(
        emp.id,
        'Unassigned from Employee Action Menu'
      );
      if (res.success) {
        showToast(res.message || `Successfully unassigned ${emp.full_name} from project.`);
        fetchStats();
        fetchEmployees();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('erp:master-employees-updated'));
        }
      } else {
        showToast(res.error || 'Failed to unassign project.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to unassign project.');
    }
  };

  // Make Candidate from Row Action or 360 view
  const handleMakeCandidate = async (emp: DbEmployeeMaster) => {
    try {
      const res = await candidateService.createCandidate({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        fullName: emp.full_name,
        cnicPassport: emp.passport_number,
        mobile: emp.personal_mobile || emp.company_mobile,
        nationality: emp.nationality,
      });
      if (res.success && res.candidate) {
        showToast(`🎉 Registered ${emp.full_name} (${res.candidate.candidateId}) into Recruitment Pipeline!`);
      } else {
        showToast(res.error || 'Failed to create candidate record.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Candidate already exists or could not be created.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (employees.length === 0) {
      showToast('No employee records available to export.');
      return;
    }

    const headers = [
      'Employee Code',
      'Full Name',
      'Emirates ID',
      'Branch',
      'State',
      'Contract / Visa Category',
      'Work Status',
      'Project',
      'Passport Status',
      'Passport Number',
      'Current Bike',
      'Current SIM',
      'Personal Mobile',
      'Company Mobile',
      'Designation',
      'Basic Salary',
    ];

    const rows = employees.map(emp => {
      return [
        emp.employee_code || '',
        `"${(emp.full_name || '').replace(/"/g, '""')}"`,
        `"${emp.emirates_id_number || ''}"`,
        `"${(mapToAuthoritativeBranch(emp.branch_name || (Array.isArray(branches) ? branches.find(b => b.id === emp.branch_id)?.name : undefined) || emp.branch_id)).replace(/"/g, '""')}"`,
        `"${(emp.state || '').replace(/"/g, '""')}"`,
        `"${(emp.contractor || 'Own').replace(/"/g, '""')}"`,
        `"${emp.current_status || 'Available'}"`,
        `"${(emp.project_name || 'Unassigned').replace(/"/g, '""')}"`,
        `"${emp.passport_status || 'With Company'}"`,
        `"${emp.passport_number || ''}"`,
        `"${emp.current_bike_plate || '—'}"`,
        `"${emp.current_sim_number || '—'}"`,
        `"${emp.personal_mobile || ''}"`,
        `"${emp.company_mobile || ''}"`,
        `"${(emp.designation || 'Bike Rider').replace(/"/g, '""')}"`,
        emp.basic_salary || 3500,
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Employees CSV exported successfully.');
  };

  // If user selected 360 profile, render Employee 360 View
  if (selected360EmployeeId) {
    return (
      <div className="space-y-4">
        {/* Top Back Navigation Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-5 py-3 flex items-center justify-between shadow-xs">
          <button
            onClick={() => {
              setSelected360EmployeeId(null);
              if (typeof window !== 'undefined') {
                window.history.pushState(null, '', '/employees');
              }
              if (onClearInitialEmployeeId) onClearInitialEmployeeId();
              fetchStats();
              fetchEmployees();
            }}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Back to Employee Management</span>
          </button>
          <span className="text-xs text-slate-500 font-mono">Employee ID: {selected360EmployeeId}</span>
        </div>

        {/* 360 Profile Component */}
        <Employee360ProfileView
          employeeId={selected360EmployeeId}
          onNavigateModule={onNavigateModule}
          onMakeCandidate={handleMakeCandidate}
          onBack={() => {
            setSelected360EmployeeId(null);
            if (typeof window !== 'undefined') {
              window.history.pushState(null, '', '/employees');
            }
            if (onClearInitialEmployeeId) onClearInitialEmployeeId();
            fetchStats();
            fetchEmployees();
          }}
        />
      </div>
    );
  }

  const getStatusCount = (key: string, fallbackKey?: string) => {
    if (!stats?.statusCounts) return 0;
    const sc = stats.statusCounts as unknown as Record<string, number>;
    if (sc[key] !== undefined) return sc[key];
    if (fallbackKey && sc[fallbackKey] !== undefined) return sc[fallbackKey];
    return 0;
  };

  const assignedCount = getStatusCount('Assigned / Active', 'assignedActive');
  const availableCount = getStatusCount('Available / Unassigned', 'availableUnassigned');
  const onLeaveCount = getStatusCount('On Leave', 'onLeave');
  const emergencyLeaveCount = getStatusCount('Emergency Leave', 'emergencyLeave');
  const onHoldCount = getStatusCount('On Hold', 'onHold');
  const abscondingCount = getStatusCount('Absconding', 'absconding');
  const terminatedCount = getStatusCount('Terminated', 'terminated');
  const exitedCount = getStatusCount('Exited', 'exited');

  const totalSum = assignedCount + availableCount + onLeaveCount + emergencyLeaveCount + onHoldCount + abscondingCount + terminatedCount + exitedCount;
  const allCount = totalSum > 0 ? totalSum : (stats.totalEmployees || 0);

  const statusFilterTabs = [
    { id: 'ALL', label: 'All', count: allCount },
    { id: 'Assigned / Active', label: 'Assigned / Active', count: assignedCount },
    { id: 'Available / Unassigned', label: 'Available / Unassigned', count: availableCount },
    { id: 'On Leave', label: 'On Leave', count: onLeaveCount },
    { id: 'Emergency Leave', label: 'Emergency Leave', count: emergencyLeaveCount },
    { id: 'On Hold', label: 'On Hold', count: onHoldCount },
    { id: 'Absconding', label: 'Absconding', count: abscondingCount },
    { id: 'Terminated', label: 'Terminated', count: terminatedCount },
    { id: 'Exited', label: 'Cancelled', count: exitedCount },
  ];

  return (
    <div className="space-y-4 pb-16" ref={dropdownRef}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium border border-slate-700 animate-in fade-in slide-in-from-bottom-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* COMPACT ENTERPRISE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white dark:bg-slate-900 px-4 py-3.5 sm:px-6 sm:py-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Employee Management
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Central employee and contractor registry across all branches and operational projects
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-create-employee"
            type="button"
            onClick={() => {
              if (onNavigateModule) {
                onNavigateModule('employees_create');
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Employee</span>
          </button>

          <button
            id="btn-import-employees"
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import</span>
          </button>

          <button
            id="btn-export-employees"
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchEmployees();
              fetchActiveProjects();
              showToast('Directory synchronized with live database.');
            }}
            title="Refresh Data"
            className="p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* HORIZONTAL STATUS FILTER BAR */}
      <div id="employee-status-filter-bar" className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {statusFilterTabs.map((tab) => {
            const isActive = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                id={`status-filter-${tab.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                type="button"
                onClick={() => {
                  setSelectedStatus(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-2 shrink-0 ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-blue-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold leading-tight ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* WRAPPING PROJECT FILTER BAR */}
      <div id="employee-project-filter-bar" className="bg-white dark:bg-slate-900 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* First button: All Projects */}
          <button
            key="proj-filter-all"
            id="btn-project-filter-all"
            type="button"
            onClick={() => {
              setSelectedProject('ALL');
              setPage(1);
            }}
            className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer select-none ${
              selectedProject === 'ALL' || selectedProject === 'All Projects'
                ? 'bg-slate-900 border-slate-900 text-white shadow-xs dark:bg-blue-600 dark:border-blue-500'
                : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600'
            }`}
          >
            <span className="font-semibold tracking-tight">All Projects</span>
            <span
              className={`text-[11px] font-bold px-1.5 py-0.5 min-w-[20px] text-center rounded-full leading-none transition-colors ${
                selectedProject === 'ALL' || selectedProject === 'All Projects'
                  ? 'bg-white/20 text-white ring-1 ring-white/30'
                  : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 group-hover:bg-slate-300/80 dark:group-hover:bg-slate-600'
              }`}
            >
              {allCount}
            </span>
          </button>

          {/* Dynamic Active Projects from authoritative Project Management source */}
          {activeProjects.map((p) => {
            const isActive = selectedProject === p.name || selectedProject === p.id;
            const count = getProjectBadgeCount(p);

            return (
              <button
                key={p.id}
                id={`btn-project-filter-${p.id}`}
                type="button"
                onClick={() => {
                  setSelectedProject(p.name);
                  setPage(1);
                }}
                className={`group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer select-none ${
                  isActive
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs dark:bg-blue-600 dark:border-blue-500'
                    : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 hover:border-slate-300 dark:border-slate-700/80 dark:hover:border-slate-600'
                }`}
              >
                <span className="font-medium tracking-tight whitespace-nowrap">{p.name}</span>
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 min-w-[20px] text-center rounded-full leading-none transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white ring-1 ring-white/30'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 group-hover:bg-slate-300/80 dark:group-hover:bg-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SEARCH & FILTER TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, Code, Emirates ID, mobile..."
              className="w-full pl-8.5 pr-8 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Branches</option>
              {AUTHORITATIVE_BRANCHES.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter (Synced with Status Bar) */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Assigned / Active">Assigned / Active</option>
              <option value="Available / Unassigned">Available / Unassigned</option>
              <option value="On Leave">On Leave</option>
              <option value="Emergency Leave">Emergency Leave</option>
              <option value="On Hold">On Hold</option>
              <option value="Absconding">Absconding</option>
              <option value="Terminated">Terminated</option>
              <option value="Exited">Cancelled</option>
            </select>
          </div>

          {/* Project Filter */}
          <div>
            <select
              value={selectedProject}
              onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Projects</option>
              {(Array.isArray(projects) ? projects : []).map(p => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Visa / Contractor Filter */}
          <div>
            <select
              value={selectedContractor}
              onChange={(e) => { setSelectedContractor(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {AUTHORITATIVE_CONTRACTOR_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Toolbar Footer */}
        <div className="flex items-center justify-between pt-1 text-xs border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-3">
            <span className="text-slate-500">
              Showing <strong className="text-slate-900 dark:text-white">{totalRecords}</strong> matching employees
            </span>
            {(selectedBranch !== 'ALL' || selectedStatus !== 'ALL' || selectedProject !== 'ALL' || selectedContractor !== 'ALL' || debouncedSearch) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500">
            <span>Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      {/* EMPLOYEE DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {/* MOBILE SELECT ALL BAR */}
        <div className="md:hidden px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={employees.length > 0 && selectedEmployeeIds.length === employees.length}
              onChange={handleSelectAll}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
            />
            <span>Select All ({employees.length})</span>
          </label>
          {selectedEmployeeIds.length > 0 && (
            <span className="text-blue-600 dark:text-blue-400 font-bold text-[11px] bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full">
              {selectedEmployeeIds.length} selected
            </span>
          )}
        </div>

        {/* MOBILE CARD VIEW (Phones < 768px) */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {tableLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-36 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="w-24 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                  </div>
                </div>
              </div>
            ))
          ) : employees.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Employees Found</h4>
              <p className="text-xs text-slate-500 mt-1">No employee records match your filter criteria.</p>
            </div>
          ) : (
            employees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
              const statusNormalized = resolveEmployeeRecordStatus(emp);
              const isEligibleForProject = !isLifecycleOverrideStatus(statusNormalized);
              const branchName = mapToAuthoritativeBranch(emp.branch_name || (Array.isArray(branches) ? branches.find(b => b.id === emp.branch_id)?.name : undefined) || emp.branch_id);
              const activeProjectName = emp.project_name || emp.current_project || (emp as any).project;
              const hasProject = Boolean(activeProjectName && activeProjectName !== '-' && activeProjectName !== 'Unassigned');

              return (
                <div
                  key={emp.id}
                  className={`p-4 space-y-3 transition-colors ${
                    isSelected ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(emp.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100 dark:border-blue-900/50 overflow-hidden">
                        {emp.photo_document_id || (emp.photo && !emp.photo.includes('unsplash.com')) ? (
                          <img
                            src={`/api/erp/master-employees/${emp.id}/photo-file`}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          (emp.first_name || emp.full_name || 'E')[0].toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {emp.employee_code || `EMP-${emp.employee_id || 10270}`}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 inline-flex items-center gap-1 ${
                        statusNormalized === 'Assigned / Active'
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                          : statusNormalized === 'Available / Unassigned'
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                          : statusNormalized === 'On Leave'
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                          : statusNormalized === 'On Hold'
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                          : statusNormalized === 'Absconding'
                          ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                          : statusNormalized === 'Terminated'
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{statusNormalized}</span>
                    </span>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Branch</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">{branchName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">State</span><span className="block font-medium">{emp.state || 'State not set'}</span>
                      <span className="text-slate-400 block text-[10px]">Contractor</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{emp.contractor || 'Company Visa'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Project</span>
                      {hasProject ? (
                        <span className="text-sky-600 dark:text-sky-400 font-semibold truncate block">{activeProjectName}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Fleet &amp; SIM</span>
                      <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                        {emp.current_bike_plate ? `🏍️ ${emp.current_bike_plate}` : 'No Bike'}
                        {emp.current_sim_number ? ` • 📱 ${emp.current_sim_number}${emp.current_sim_provider ? ` (${emp.current_sim_provider})` : ''}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Actions Toolbar */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected360EmployeeId(emp.id);
                        if (typeof window !== 'undefined') {
                          window.history.pushState(null, '', `/employees/${emp.id}`);
                        }
                      }}
                      className="flex-1 py-2 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[40px]"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEmployee(emp);
                      }}
                      className="py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[40px]"
                    >
                      <Edit className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      disabled={!isEligibleForProject}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isEligibleForProject) return;
                        setAssignmentEmployee(emp);
                        setActiveAssignmentModal('PROJECT');
                      }}
                      className={`py-2 px-2.5 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[40px] ${
                        isEligibleForProject
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900'
                          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed opacity-60'
                      }`}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>{hasProject ? 'Transfer' : 'Assign'}</span>
                    </button>

                    <button
                      type="button"
                      data-employee-action-trigger="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (openRowActionId === emp.id) {
                          setOpenRowActionId(null);
                          setRowActionAnchor(null);
                        } else {
                          setOpenRowActionId(emp.id);
                          setRowActionAnchor(e.currentTarget);
                        }
                      }}
                      className="p-2 border rounded-lg bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="More Operational Actions"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP DATA TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800 shadow-xs">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={employees.length > 0 && selectedEmployeeIds.length === employees.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="p-3">Employee</th>
                <th className="p-3">Employee Code</th>
                <th className="p-3">Branch</th>
                <th className="p-3">State</th>
                <th className="p-3">Visa / Contractor</th>
                <th className="p-3">Status</th>
                <th className="p-3">Current Project</th>
                <th className="p-3 whitespace-nowrap w-24">Current Bike</th>
                <th className="p-3 whitespace-nowrap w-28">Current SIM</th>
                <th className="p-3 text-right pr-4 min-w-[240px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tableLoading ? (
                // Loading Skeletons
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="p-3 text-center"><div className="w-4 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                    <td className="p-3"><div className="w-36 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded" /></td>
                    <td className="p-3"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-800 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Employees Found</h4>
                      <p className="text-xs text-slate-500">
                        No employee records match the current filter criteria or the database is currently empty.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (onNavigateModule) {
                              onNavigateModule('employees_create');
                            } else {
                              setIsCreateModalOpen(true);
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
                        >
                          + Create Employee
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsImportModalOpen(true)}
                          className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold"
                        >
                          Bulk Import CSV
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp, index) => {
                  const isSelected = selectedEmployeeIds.includes(emp.id);
                  const statusNormalized = resolveEmployeeRecordStatus(emp);
                  const isTerminatedOrExited = statusNormalized === 'Terminated' || statusNormalized === 'Exited';
                  const isEligibleForProject = !isLifecycleOverrideStatus(statusNormalized);
                  const branchName = mapToAuthoritativeBranch(emp.branch_name || (Array.isArray(branches) ? branches.find(b => b.id === emp.branch_id)?.name : undefined) || emp.branch_id);

                  return (
                    <tr
                      key={emp.id}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-blue-50/60 dark:bg-blue-950/30'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectRow(emp.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>

                      {/* Employee Name & Identity */}
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100 dark:border-blue-900/50 overflow-hidden">
                            {emp.photo_document_id || (emp.photo && !emp.photo.includes('unsplash.com')) ? (
                              <img
                                src={`/api/erp/master-employees/${emp.id}/photo-file`}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              (emp.first_name || emp.full_name || 'E')[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {emp.emirates_id_number ? `EID: ${emp.emirates_id_number}` : emp.nationality ? emp.nationality : 'EID: Not Recorded'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Employee Code */}
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block text-xs">
                          {emp.employee_code || `EMP-${emp.employee_id || 10270}`}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[140px] truncate" title={branchName}>
                        {branchName}
                      </td>

                      <td className="p-3 text-xs text-slate-600 dark:text-slate-300">{emp.state || 'State not set'}</td>
                      {/* Contract / Visa Category */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-semibold border border-slate-200 dark:border-slate-700">
                          {emp.contractor || 'Company Visa'}
                        </span>
                      </td>

                      {/* Work Status Badge */}
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1.5 ${
                            statusNormalized === 'Assigned / Active'
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                              : statusNormalized === 'Available / Unassigned'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60'
                              : statusNormalized === 'On Leave'
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                              : statusNormalized === 'Emergency Leave'
                              ? 'bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60'
                              : statusNormalized === 'On Hold'
                              ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60'
                              : statusNormalized === 'Absconding'
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                              : statusNormalized === 'Terminated'
                              ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60'
                              : statusNormalized === 'Exited'
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{statusNormalized === 'Exited' ? 'Cancelled' : statusNormalized}</span>
                        </span>
                      </td>

                      {/* Project Assignment */}
                      <td className="p-3">
                        {(() => {
                          const activeProjectName = emp.project_name || emp.current_project || (emp as any).project;
                          const hasProject = Boolean(activeProjectName && activeProjectName !== '-' && activeProjectName !== 'Unassigned');
                          return hasProject ? (
                            <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 rounded border border-sky-200 dark:border-sky-800 text-[10px] font-bold block whitespace-nowrap" title={activeProjectName}>
                              {activeProjectName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium">—</span>
                          );
                        })()}
                      </td>

                      {/* Current Bike */}
                      <td className="p-3 whitespace-nowrap">
                        {emp.current_bike_plate ? (
                          <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {emp.current_bike_plate}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Current SIM */}
                      <td className="p-3 whitespace-nowrap">
                        {emp.current_sim_number ? (
                          <div className="flex flex-col">
                            <span className="font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                              {emp.current_sim_number}
                            </span>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                              {emp.current_sim_provider && (
                                <span className="font-semibold text-sky-600 dark:text-sky-400">
                                  {emp.current_sim_provider}
                                </span>
                              )}
                              {emp.current_sim_iccid && emp.current_sim_iccid !== '—' && (
                                <span className="font-mono truncate max-w-[100px]" title={`ICCID: ${emp.current_sim_iccid}`}>
                                  • {emp.current_sim_iccid}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Action Menu */}
                      <td className="p-3 text-right relative pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. View Profile */}
                          <button
                            type="button"
                            id={`btn-emp-view-${emp.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected360EmployeeId(emp.id);
                              if (typeof window !== 'undefined') {
                                window.history.pushState(null, '', `/employees/${emp.id}`);
                              }
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1"
                            title="View Employee Profile"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>View</span>
                          </button>

                          {/* 2. Edit Employee */}
                          <button
                            type="button"
                            id={`btn-emp-edit-${emp.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmployee(emp);
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1"
                            title="Edit Employee Details"
                          >
                            <Edit className="w-3 h-3 text-slate-500" />
                            <span>Edit</span>
                          </button>

                          {/* 3. Assign / Transfer Project (In-Place Modal) */}
                          <button
                            type="button"
                            id={`btn-emp-assign-project-${emp.id}`}
                            disabled={!isEligibleForProject}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isEligibleForProject) return;
                              setAssignmentEmployee(emp);
                              setActiveAssignmentModal('PROJECT');
                            }}
                            className={`px-2 py-1 border text-xs font-medium rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
                              isEligibleForProject
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                                : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
                            }`}
                            title={isEligibleForProject ? (emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '-' ? "Change / Transfer Project" : "Assign Project") : `Cannot assign project while in ${statusNormalized} status`}
                          >
                            <Briefcase className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>{emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '-' ? 'Transfer' : 'Assign'}</span>
                          </button>

                          {/* More Actions Dropdown */}
                          <button
                            type="button"
                            id={`btn-emp-more-${emp.id}`}
                            data-employee-action-trigger="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openRowActionId === emp.id) {
                                setOpenRowActionId(null);
                                setRowActionAnchor(null);
                              } else {
                                setOpenRowActionId(emp.id);
                                setRowActionAnchor(e.currentTarget);
                              }
                            }}
                            className={`p-1 border rounded transition-colors ${
                              openRowActionId === emp.id
                                ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'
                            }`}
                            title="More Operational Actions"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
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

        {/* PAGINATION FOOTER */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/40">
          <div>
            Showing <strong className="text-slate-900 dark:text-white">{Math.min((page - 1) * pageSize + 1, totalRecords)}</strong> to{' '}
            <strong className="text-slate-900 dark:text-white">{Math.min(page * pageSize, totalRecords)}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white">{totalRecords}</strong> employees
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white">
              Page {page} of {Math.max(totalPages, 1)}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* FLOATING BULK ACTIONS BAR */}
      {selectedEmployeeIds.length > 0 && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto z-30 bg-slate-900 dark:bg-slate-800 text-white px-4 sm:px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-start gap-2 sm:gap-4 text-xs animate-in fade-in slide-in-from-bottom-4 pb-safe">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[11px]">
              {selectedEmployeeIds.length}
            </span>
            <span className="font-semibold text-slate-200">Selected</span>
          </div>
          <div className="hidden sm:block h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsBulkBranchOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
            >
              Change Branch
            </button>
            <button
              type="button"
              onClick={() => setIsBulkCategoryOpen(true)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium transition-colors border border-slate-700"
            >
              Change Visa / Contractor
            </button>
            <button
              type="button"
              onClick={() => setSelectedEmployeeIds([])}
              className="px-2 py-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* CREATE EMPLOYEE MODAL */}
      <CreateEmployeeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        departments={departments}
        projects={projects}
        onSuccess={(newEmp) => {
          showToast(`Employee ${newEmp.full_name} (${newEmp.employee_code}) created successfully.`);
          fetchStats();
          fetchEmployees();
        }}
        onOpenExistingProfile={(existingId) => {
          setSelected360EmployeeId(existingId);
        }}
        onAssignProject={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal('PROJECT');
        }}
        onAssignBike={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal('ASSIGN_BIKE');
        }}
        onAssignSim={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal('ASSIGN_SIM');
        }}
      />

      {/* EDIT EMPLOYEE MODAL */}
      <EditEmployeeModal
        isOpen={!!editingEmployee}
        onClose={() => setEditingEmployee(null)}
        employee={editingEmployee}
        branches={branches}
        departments={departments}
        projects={projects}
        onSuccess={(updated) => {
          showToast(`Employee ${updated.full_name} profile updated successfully.`);
          fetchStats();
          fetchEmployees();
        }}
        onOpenExistingProfile={(existingId) => {
          setSelected360EmployeeId(existingId);
        }}
        onManageProject={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal('PROJECT');
        }}
        onManageBike={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal(emp.current_bike_plate ? 'REPLACE_BIKE' : 'ASSIGN_BIKE');
        }}
        onManageSim={(emp) => {
          setAssignmentEmployee(emp);
          setActiveAssignmentModal(emp.current_sim_number ? 'REPLACE_SIM' : 'ASSIGN_SIM');
        }}
      />

      {/* IMPORT EMPLOYEES MODAL */}
      <ImportEmployeesModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingEmiratesIds={employees.map(e => e.emirates_id_number || '').filter(Boolean)}
        existingEmployeeCodes={employees.map(e => e.employee_code || '').filter(Boolean)}
        onSuccess={(count) => {
          showToast(`Successfully imported ${count} employees to master directory.`);
          fetchStats();
          fetchEmployees();
        }}
      />

      {/* BULK UPDATE BRANCH MODAL */}
      <BulkUpdateBranchModal
        isOpen={isBulkBranchOpen}
        onClose={() => setIsBulkBranchOpen(false)}
        selectedIds={selectedEmployeeIds}
        branches={branches}
        onSuccess={(count) => {
          showToast(`Successfully updated branch for ${count} employees.`);
          setSelectedEmployeeIds([]);
          fetchStats();
          fetchEmployees();
        }}
      />

      {/* BULK UPDATE CATEGORY MODAL */}
      <BulkUpdateContractorModal
        isOpen={isBulkCategoryOpen}
        onClose={() => setIsBulkCategoryOpen(false)}
        selectedIds={selectedEmployeeIds}
        onSuccess={(count) => {
          showToast(`Successfully updated contract/visa category for ${count} employees.`);
          setSelectedEmployeeIds([]);
          fetchStats();
          fetchEmployees();
        }}
      />

      {/* BULK UPDATE PROJECT MODAL */}
      <BulkUpdateProjectModal
        isOpen={isBulkProjectOpen}
        onClose={() => setIsBulkProjectOpen(false)}
        selectedIds={selectedEmployeeIds}
        projects={projects}
        onSuccess={(count) => {
          showToast(`Successfully assigned project to ${count} employees.`);
          setSelectedEmployeeIds([]);
          fetchStats();
          fetchEmployees();
        }}
      />

      {/* PORTALED EMPLOYEE ROW ACTION MENU */}
      {openRowActionId && (
        <EmployeeRowActionMenu
          employee={employees.find((e) => e.id === openRowActionId) || null}
          anchorEl={rowActionAnchor}
          isOpen={Boolean(openRowActionId && rowActionAnchor)}
          onClose={() => {
            setOpenRowActionId(null);
            setRowActionAnchor(null);
          }}
          onAssignBike={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal(emp.current_bike_plate ? 'REPLACE_BIKE' : 'ASSIGN_BIKE');
          }}
          onAssignSim={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal(emp.current_sim_number ? 'REPLACE_SIM' : 'ASSIGN_SIM');
          }}
          onChangeStatus={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal('STATUS');
          }}
          onAssignProject={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal('PROJECT');
          }}
          onUnassignProject={(emp) => {
            handleUnassignProject(emp);
          }}
          onLogLeave={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal('LEAVE');
          }}
          onExitOffboard={(emp) => {
            setAssignmentEmployee(emp);
            setActiveAssignmentModal('EXIT');
          }}
          onMakeCandidate={handleMakeCandidate}
        />
      )}

      {/* OPERATIONAL ASSIGNMENT MODALS */}
      {assignmentEmployee && activeAssignmentModal && (
        <EmployeeAssignmentModals
          employeeId={assignmentEmployee.id}
          employeeName={assignmentEmployee.full_name || assignmentEmployee.employee_code}
          activeModal={activeAssignmentModal}
          onClose={() => {
            setActiveAssignmentModal(null);
            setAssignmentEmployee(null);
          }}
          onSuccess={(msg) => {
            showToast(msg);
            setActiveAssignmentModal(null);
            setAssignmentEmployee(null);
            fetchStats();
            fetchEmployees();
            window.dispatchEvent(new CustomEvent('erp:master-employees-updated'));
          }}
          projects={projects}
          vehicles={vehicles}
          sims={sims}
          assets={assets}
          currentProjectName={assignmentEmployee.project_name}
          currentBikePlate={assignmentEmployee.current_bike_plate}
          currentSimNumber={assignmentEmployee.current_sim_number}
          currentStatus={assignmentEmployee.current_status}
          employeeCode={assignmentEmployee.employee_code}
          emiratesId={assignmentEmployee.emirates_id_number || (assignmentEmployee as any).emirates_id}
        />
      )}
    </div>
  );
};

