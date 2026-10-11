import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Smartphone,
  Search,
  Plus,
  Download,
  PhoneCall,
  UserCheck,
  CheckCircle2,
  RefreshCw,
  History,
  ArrowRightLeft,
  RotateCcw,
  Sliders,
  DollarSign,
  AlertTriangle,
  MoreVertical,
  Edit2,
  Trash2,
  ShieldAlert,
  CircleX,
  Layers,
  Building,
  MapPin,
  Radio,
  FileSpreadsheet,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient';
import { SimRecord, SimDashboardStats } from '../../types/sim';
import { CreateSimsModal } from './sim/CreateSimsModal';
import { AssignSimModal } from './sim/AssignSimModal';
import { SimHistoryModal } from './sim/SimHistoryModal';
import { ChangeStatusModal } from './sim/ChangeStatusModal';
import { EditSimModal } from './sim/EditSimModal';
import { SimUndertakingModal } from './sim/SimUndertakingModal';
import { ReturnSimToProviderModal } from './sim/ReturnSimToProviderModal';
import { MarkSimLostModal } from './sim/MarkSimLostModal';
import { RecoverSimModal } from './sim/RecoverSimModal';
import { BulkSimImportModal } from '../documents/BulkSimImportModal';

interface SimManagementViewProps {
  lang: 'EN' | 'AR';
}

export const SimManagementView: React.FC<SimManagementViewProps> = ({ lang }) => {
  const isAr = lang === 'AR';

  // Server-side data state
  const [sims, setSims] = useState<SimRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [stats, setStats] = useState<SimDashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [statsLoading, setStatsLoading] = useState<boolean>(true);

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [assignmentFilter, setAssignmentFilter] = useState<string>('ALL');
  const [serviceFilter, setServiceFilter] = useState<string>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [projectList, setProjectList] = useState<{ id: string; name: string; code?: string }[]>([]);

  // Modal controls
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isChangeStatusModalOpen, setIsChangeStatusModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUndertakingModalOpen, setIsUndertakingModalOpen] = useState(false);
  const [isReturnToProviderOpen, setIsReturnToProviderOpen] = useState(false);
  const [isMarkLostModalOpen, setIsMarkLostModalOpen] = useState(false);
  const [isRecoverModalOpen, setIsRecoverModalOpen] = useState(false);
  const [undertakingEmployeeId, setUndertakingEmployeeId] = useState<string | null>(null);
  const [undertakingSimNumber, setUndertakingSimNumber] = useState<string | null>(null);
  const [assignModalConfig, setAssignModalConfig] = useState<{
    isOpen: boolean;
    mode: 'ASSIGN' | 'TRANSFER' | 'RETURN' | 'REPLACE';
  }>({
    isOpen: false,
    mode: 'ASSIGN',
  });

  const [activeSim, setActiveSim] = useState<SimRecord | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // The action sheet sits outside the horizontally scrolling table. ESC closes it.
  useEffect(() => {
    if (!openDropdownId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDropdownId(null);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [openDropdownId]);
  const [importResultBanner, setImportResultBanner] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  // Search Debouncing
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load Configured Projects dynamically from Project Master
  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await apiClient.get<any>('/api/erp/sims/projects');
        if (res.data?.projects && Array.isArray(res.data.projects)) {
          setProjectList(res.data.projects);
        } else {
          const fallbackRes = await apiClient.get<any>('/api/erp/rider-projects/projects');
          if (fallbackRes.data?.projects && Array.isArray(fallbackRes.data.projects)) {
            setProjectList(fallbackRes.data.projects);
          }
        }
      } catch (err) {
        console.error('Failed to load dynamic project list:', err);
      }
    }
    loadProjects();
  }, []);

  // Fetch Dashboard Stats
  const fetchDashboardStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiClient.get<SimDashboardStats>('/api/erp/sims/dashboard');
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch SIM dashboard stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Paginated SIM Records
  const fetchSimList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));

      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (assignmentFilter !== 'ALL') params.set('assignment_status', assignmentFilter);
      if (serviceFilter !== 'ALL') params.set('service_status', serviceFilter);
      if (stateFilter !== 'ALL') params.set('state', stateFilter);
      if (sourceFilter !== 'ALL') params.set('source', sourceFilter);
      if (vendorFilter !== 'ALL') params.set('vendor', vendorFilter);
      if (projectFilter !== 'ALL') params.set('project', projectFilter);

      const res = await apiClient.get(`/api/erp/sims?${params.toString()}`);
      if (res.data) {
        const payload = res.data;
        if (Array.isArray(payload.items)) {
          setSims(payload.items);
          setTotalCount(payload.total || 0);
          setTotalPages(payload.totalPages || 1);
        } else if (Array.isArray(payload)) {
          setSims(payload);
          setTotalCount(payload.length);
          setTotalPages(1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch SIM card records:', err);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    pageSize,
    debouncedSearch,
    assignmentFilter,
    serviceFilter,
    stateFilter,
    sourceFilter,
    vendorFilter,
    projectFilter,
  ]);

  // Trigger loads
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  useEffect(() => {
    fetchSimList();
  }, [fetchSimList]);

  // Listen for background mutations (creation, assignment, return, import) to keep counts live
  useEffect(() => {
    const handleSimsUpdated = () => {
      fetchDashboardStats();
      fetchSimList();
    };
    window.addEventListener('erp:sims-updated', handleSimsUpdated);
    window.addEventListener('focus', handleSimsUpdated);
    return () => {
      window.removeEventListener('erp:sims-updated', handleSimsUpdated);
      window.removeEventListener('focus', handleSimsUpdated);
    };
  }, [fetchDashboardStats, fetchSimList]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setAssignmentFilter('ALL');
    setServiceFilter('ALL');
    setStateFilter('ALL');
    setSourceFilter('ALL');
    setVendorFilter('ALL');
    setProjectFilter('ALL');
    setPage(1);
  };

  const showAssignment = (status: string) => {
    handleResetFilters();
    setAssignmentFilter(status);
  };

  const showService = (status: string) => {
    handleResetFilters();
    setServiceFilter(status);
  };

  const showState = (state: string) => {
    handleResetFilters();
    setStateFilter(state);
  };

  // Toggle Active/Inactive Line
  const handleToggleActive = async (sim: SimRecord) => {
    try {
      const res = await apiClient.post(`/api/erp/sims/${sim.id}/toggle-active`, {});
      if (!res.error) {
        fetchSimList();
        fetchDashboardStats();
      }
    } catch (err) {
      console.error('Failed to toggle active state:', err);
    }
  };

  // Archive SIM
  const handleArchive = async (sim: SimRecord) => {
    if (!confirm(`Are you sure you want to archive SIM ${sim.mobile_number}?`)) return;
    try {
      const res = await apiClient.post(`/api/erp/sims/${sim.id}/archive`, {});
      if (!res.error) {
        fetchSimList();
        fetchDashboardStats();
      }
    } catch (err) {
      console.error('Failed to archive SIM:', err);
    }
  };

  // Export every matching SIM, including records on other pages.
  const handleExportCsv = async () => {
    setExporting(true);
    setExportError('');
    try {
      // Inventory sheet always includes every operational SIM in every state,
      // independent of the current screen's search and filter selection.
      const response = await apiClient.get('/api/erp/sims');
      if (response.error) throw new Error(String(response.error));
      const payload = response.data as SimRecord[] | { items: SimRecord[] };
      const records = Array.isArray(payload) ? payload : payload?.items || [];
      if (records.length === 0) {
        setExportError('No assigned or available SIMs to export.');
        return;
      }

      const headers = [
        'Mobile Number', 'Assignment Status', 'Service Status',
        'Rider Name', 'Employee Code', 'Emirates ID', 'Bike Plate',
        'Project', 'Reporting State', 'Vendor', 'Source', 'Assigned Date',
        'ICCID', 'SIM Serial', 'Data Plan', 'Monthly Cost (AED)',
        'Approved Amount (AED)', 'Notes',
      ];
      const escapeCell = (value: unknown) => {
        const raw = String(value ?? '');
        const safe = /^[=+@-]/.test(raw) && !/^-?\d+(\.\d+)?$/.test(raw) ? "'" + raw : raw;
        return '"' + safe.replace(/"/g, '""') + '"';
      };
      const rows = records.map((sim) => {
        const assigned = sim.assignment_status === 'Assigned' && !!sim.current_employee_name;
        return [
          sim.mobile_number, assigned ? 'Assigned' : 'Available',
          sim.service_status || (sim.is_active ? 'Active' : 'Inactive'),
          assigned ? sim.current_employee_name : '',
          assigned ? sim.current_employee_code : '',
          assigned ? sim.current_emirates_id : '',
          assigned ? sim.current_vehicle_plate : '',
          assigned ? sim.current_project_name : '',
          sim.state, sim.vendor || sim.provider, sim.source,
          assigned ? sim.assigned_date : '', sim.iccid,
          sim.sim_serial_number, sim.plan,
          sim.monthly_package_amount ?? sim.monthly_cost ?? 0,
          sim.approved_amount ?? 0, sim.notes,
        ].map(escapeCell).join(',');
      });
      const csv = '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sim_inventory_all_states_' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      console.error('SIM export failed:', error);
      setExportError('SIM export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Vendor styling helper
  const getVendorBadge = (v: string) => {
    const norm = (v || '').toUpperCase();
    if (norm.includes('DU')) {
      return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800';
    }
    if (norm.includes('ETISALAT')) {
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
    if (norm.includes('VIRGIN')) {
      return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
    }
    return 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200 dark:border-purple-800';
  };

  // Status styling helpers
  const getAssignmentBadge = (asgn: string) => {
    switch (asgn) {
      case 'Assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Unassigned':
      default:
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
    }
  };

  const getServiceBadge = (srv: string) => {
    switch (srv) {
      case 'Active':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Suspended':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Cancelled':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      case 'Inactive':
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Available':
      case 'Unassigned':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Inactive':
        return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700';
      case 'Suspended':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Cancelled':
      case 'Lost':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-5" onClick={() => setOpenDropdownId(null)}>
      {/* 1. Page Header & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-1">
            <span>{isAr ? 'إدارة التوصيل' : 'Delivery Management'}</span>
            <span>/</span>
            <span className="text-slate-700 dark:text-slate-300">
              {isAr ? 'إدارة شرائح الاتصال' : 'SIM Card Management'}
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <Smartphone className="w-6 h-6 text-blue-600" />
            {isAr ? 'إدارة شرائح الاتصال وبيانات الأسطول' : 'SIM Card Management'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'سجل شرائح الاتصال، متابعة حزم البيانات، تعيين السائقين، والتحكم بدورة حياة الخطوط.'
              : 'UAE Telecommunications fleet registry, data bundle tracking, rider allocations, and SIM lifecycle operations.'}
          </p>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              setUndertakingEmployeeId(null);
              setUndertakingSimNumber(null);
              setIsUndertakingModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-colors"
            title="Generate official SIM custody undertaking (LT0020)"
          >
            <FileText className="w-4 h-4" />
            {isAr ? 'تعهد الشريحة (LT0020)' : 'SIM Undertaking (LT0020)'}
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            {isAr ? 'إنشاء شرائح (متعدد)' : 'Create SIM(s)'}
          </button>

          <button
            onClick={() => setIsBulkImportModalOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isAr ? 'استيراد جماعي' : 'Bulk Import'}
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || statsLoading || (stats?.totalSims ?? 0) === 0}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-50"
            title="Export assigned and available SIMs from all states, excluding cancelled and lost"
          >
            <Download className="w-4 h-4" />
            {exporting ? (isAr ? 'جارٍ التصدير...' : 'Exporting...') : (isAr ? 'تصدير المخزون' : 'Export Inventory Sheet')}
          </button>

          <button
            onClick={() => {
              fetchSimList();
              fetchDashboardStats();
            }}
            className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || statsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {exportError && <div role="alert" className="text-sm text-rose-600 dark:text-rose-400">{exportError}</div>}

      {/* Post-Import Results Notification Banner */}
      {importResultBanner && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                {isAr ? 'اكتمل استيراد الشرائح بنجاح' : 'SIM Import Process Completed'}
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                {isAr ? (
                  <>تم استيراد <strong>{importResultBanner.imported}</strong> شريحة بنجاح إلى المخزون، تم تخطي <strong>{importResultBanner.skipped}</strong> تكرار، وفشل <strong>{importResultBanner.failed}</strong>.</>
                ) : (
                  <>Successfully imported <strong>{importResultBanner.imported}</strong> SIM cards into active inventory. Skipped <strong>{importResultBanner.skipped}</strong> duplicates. Failed: <strong>{importResultBanner.failed}</strong>.</>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportResultBanner(null)}
            className="p-1.5 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. KPI Cards Grid: Distinct Custody & Telecom Line Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Registered */}
        <button type="button" onClick={() => handleResetFilters()} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">
              {isAr ? 'إجمالي الشرائح' : 'Total SIMs'}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
            {stats ? stats.totalSims : totalCount}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Assigned + available; excludes cancelled and lost</div>
        </button>

        {/* Assigned (Custody) */}
        <button type="button" onClick={() => showAssignment('Assigned')} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400">
              {isAr ? 'مخصصة للسائقين' : 'Assigned (Custody)'}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-blue-600 dark:text-blue-400">
            {stats?.assignmentCounts?.Assigned ?? stats?.assigned ?? stats?.assignedSims ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">In delivery field</div>
        </button>

        {/* Unassigned in Inventory (Custody) */}
        <button type="button" onClick={() => showAssignment('Unassigned')} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {isAr ? 'غير مخصصة (المخزون)' : 'Unassigned (Pool)'}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <Radio className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats?.assignmentCounts?.Unassigned ?? stats?.unassigned ?? stats?.available ?? stats?.availableSims ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Not with a rider</div>
        </button>

        {/* Active Lines (Telecom State) */}
        <button type="button" onClick={() => showService('Active')} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {isAr ? 'خطوط نشطة' : 'Active Lines'}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {stats?.serviceCounts?.Active ?? stats?.active ?? (stats?.totalSims && stats?.inactiveSims !== undefined ? stats.totalSims - stats.inactiveSims : (stats?.totalSims ?? 0))}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Telecom line operational</div>
        </button>

        {/* Cancelled Lines (Telecom State) */}
        <button type="button" onClick={() => showService('Cancelled')} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              {isAr ? 'خطوط ملغاة' : 'Cancelled SIMs'}
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <CircleX className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-rose-600 dark:text-rose-400">
            {stats?.serviceCounts?.Cancelled ?? stats?.cancelled ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Returned to provider / cancelled</div>
        </button>

        {/* Lost SIMs (Audited Asset State) */}
        <button type="button" onClick={() => showAssignment('Lost')} className="p-3.5 text-left w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs hover:border-blue-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              {isAr ? 'شرائح مفقودة' : 'Lost SIMs'}
            </span>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-xl font-bold text-rose-600 dark:text-rose-400">
            {stats?.lost ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Audited missing assets</div>
        </button>

        {/* Monthly Telecom Billing */}
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              {isAr ? 'الفاتورة الشهرية' : 'Monthly Run-Rate'}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white font-mono">
            AED {(stats?.totalMonthlyBillingAED || stats?.totalMonthlySpend || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total corporate commit</div>
        </div>
      </div>

      {/* State summary cards use the same tenant-wide counts as the table filters. */}
      {stats?.stateCounts && Object.keys(stats.stateCounts).length > 0 && (
        <section className="mt-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">SIMs by City / State</h3>
              <p className="text-xs text-slate-500 mt-0.5">Select a city to view its SIM cards</p>
            </div>
            {stateFilter !== 'ALL' && <button type="button" onClick={() => showState('ALL')} className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all states</button>}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(stats.stateCounts).sort(([a], [b]) => a.localeCompare(b)).map(([state, counts]) => (
              <button
                key={state}
                type="button"
                aria-pressed={stateFilter === state}
                onClick={() => showState(state)}
                className={`min-w-0 min-h-[138px] text-left rounded-2xl border bg-white dark:bg-slate-900 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  stateFilter === state
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate" title={state}>{state}</span>
                  <span className={`shrink-0 p-2 rounded-xl ${stateFilter === state ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-600'}`}><MapPin size={16}/></span>
                </div>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{counts.total}</span>
                  <span className="text-[11px] text-slate-500">SIMs</span>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                  <span className="text-blue-700 dark:text-blue-300"><strong>{counts.assigned}</strong> Assigned</span>
                  <span className="text-emerald-700 dark:text-emerald-300"><strong>{counts.available}</strong> Available</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 3. Separate Dual Filters (Assignment vs Telecom Service) */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
        {/* Assignment Custody: All / Assigned / Unassigned */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[90px] uppercase tracking-wider">
            {isAr ? 'حالة التعيين:' : 'Assignment:'}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {[
              { key: 'ALL', label: isAr ? 'الكل' : 'All', count: stats?.totalSims ?? totalCount },
              { key: 'Assigned', label: isAr ? 'مخصصة' : 'Assigned', count: stats?.assignmentCounts?.Assigned ?? stats?.assigned },
              { key: 'Unassigned', label: isAr ? 'غير مخصصة' : 'Unassigned', count: stats?.assignmentCounts?.Unassigned ?? stats?.unassigned ?? stats?.available },
              { key: 'Lost', label: isAr ? 'مفقودة' : 'Lost', count: stats?.assignmentCounts?.Lost ?? stats?.lost ?? 0 },
            ].map((tab) => {
              const isActive = assignmentFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setAssignmentFilter(tab.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-colors text-xs ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-blue-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Telecom Service: All / Active / Inactive / Suspended / Cancelled */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[90px] uppercase tracking-wider">
            {isAr ? 'حالة الخدمة:' : 'Service:'}
          </span>
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {[
              { key: 'ALL', label: isAr ? 'الكل' : 'All', count: stats?.totalSims ?? totalCount },
              { key: 'Active', label: isAr ? 'نشطة' : 'Active', count: stats?.serviceCounts?.Active ?? stats?.active },
              { key: 'Inactive', label: isAr ? 'معطلة' : 'Inactive', count: stats?.serviceCounts?.Inactive ?? stats?.inactive },
              { key: 'Suspended', label: isAr ? 'موقوفة' : 'Suspended', count: stats?.serviceCounts?.Suspended ?? stats?.suspended },
              { key: 'Cancelled', label: isAr ? 'ملغاة' : 'Cancelled', count: stats?.serviceCounts?.Cancelled ?? stats?.cancelled },
            ].map((tab) => {
              const isActive = serviceFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setServiceFilter(tab.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2 whitespace-nowrap transition-colors text-xs ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {stats?.stateCounts && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 min-w-[90px] uppercase tracking-wider">State:</span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button type="button" onClick={() => { setStateFilter('ALL'); setPage(1); }} className={`px-3 py-1.5 rounded-lg font-semibold border ${stateFilter === 'ALL' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>All {stats.totalSims}</button>
              {Object.entries(stats.stateCounts).sort(([a], [b]) => a.localeCompare(b)).map(([state, counts]) => (
                <button type="button" key={state} onClick={() => { setStateFilter(state); setPage(1); }} className={`px-3 py-1.5 rounded-lg font-semibold border ${stateFilter === state ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                  {state} {counts.total}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4. Search and Multi-Filter Controls */}
      <div className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          {/* Fast Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                isAr
                  ? 'بحث برقم الهاتف، ICCID، اسم السائق، رمز السائق...'
                  : 'Fast Search by Mobile Number, Rider Name, Rider Code, ICCID...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Selectors */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Separate Assignment Status Dropdown */}
            <select
              value={assignmentFilter}
              onChange={(e) => {
                setAssignmentFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
              title="Assignment Status (Custody)"
            >
              <option value="ALL">Assignment: All</option>
              <option value="Assigned">Assigned</option>
              <option value="Unassigned">Unassigned</option>
            </select>

            {/* Separate Service Status Dropdown */}
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
              title="Telecom Line Service Status"
            >
              <option value="ALL">Service: All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Suspended">Suspended</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Physical SIM location — editable in each SIM's Edit form */}
            <select
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
              className="min-h-11 px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 font-medium"
              aria-label="Filter SIMs by city or state"
            >
              <option value="ALL">All Cities / States</option>
              {Object.keys(stats?.stateCounts || {}).sort((a, b) => a.localeCompare(b)).map((state) => (
                <option key={state} value={state}>{state} ({stats?.stateCounts[state].total})</option>
              ))}
            </select>

            {/* Provider Filter */}
            <select
              value={vendorFilter}
              onChange={(e) => {
                setVendorFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Providers (DU, Etisalat...)</option>
              <option value="DU">DU</option>
              <option value="ETISALAT">ETISALAT</option>
              <option value="VIRGIN">VIRGIN</option>
              <option value="STC">STC</option>
            </select>

            {/* Project Filter (Dynamic from Project Master) */}
            <select
              value={projectFilter}
              onChange={(e) => {
                setProjectFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Projects</option>
              {projectList.map((proj) => (
                <option key={proj.id} value={proj.name}>
                  {proj.name}
                </option>
              ))}
            </select>

            {/* Reset Button */}
            {(debouncedSearch ||
              assignmentFilter !== 'ALL' ||
              serviceFilter !== 'ALL' ||
              stateFilter !== 'ALL' ||
              sourceFilter !== 'ALL' ||
              vendorFilter !== 'ALL' ||
              projectFilter !== 'ALL') && (
              <button
                onClick={handleResetFilters}
                className="px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Results summary line */}
        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>
            {isAr
              ? totalCount > 0
                ? `عرض ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} من إجمالي ${totalCount} شريحة اتصال مسجلة`
                : 'عرض 0 من إجمالي 0 شريحة اتصال'
              : totalCount > 0
                ? `Displaying ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, totalCount)} of ${totalCount} registered SIM cards`
                : 'Displaying 0 of 0 registered SIM cards'}
          </span>
          <span className="font-mono text-[10px]">Server-side Filtered & Paginated</span>
        </div>
      </div>

      {/* 5. Dense SIM Cards Operational Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
        {/* Mobile-first SIM registry: rider, custody and location without horizontal scrolling */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {sims.map((sim) => {
            const assigned = sim.assignment_status === 'Assigned' && Boolean(sim.current_employee_id);
            const lost = sim.assignment_status === 'Lost' || sim.status === 'Lost';
            return (
              <div key={sim.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-base text-slate-900 dark:text-white break-all">{sim.mobile_number}</div>
                    <div className="text-xs text-slate-500 mt-1">{sim.provider || sim.vendor || 'Telecom'} · {sim.state || 'State not set'}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${lost ? 'bg-rose-100 text-rose-700' : assigned ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {lost ? 'Lost' : assigned ? 'Assigned' : 'Available'}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="text-xs text-slate-500">Current rider</div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white mt-1">
                    {assigned ? (sim.current_employee_name || 'Rider name needs verification') : 'No current rider'}
                  </div>
                  {assigned && sim.current_employee_code && <div className="text-xs text-slate-500 mt-1">ID: {sim.current_employee_code}</div>}
                  {sim.last_employee_name && <div className="text-xs text-slate-500 mt-1">Last assigned to: {sim.last_employee_name}</div>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => { setActiveSim(sim); setIsEditModalOpen(true); }} className="min-h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold">Edit state / SIM</button>
                  <button onClick={() => { setActiveSim(sim); setIsHistoryModalOpen(true); }} className="min-h-11 px-4 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold">History</button>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); setOpenDropdownId(sim.id); }}
                    aria-label={`All SIM actions for ${sim.mobile_number}`}
                    aria-haspopup="dialog"
                    className="min-h-11 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                  >
                    <MoreVertical className="w-4 h-4" /> All Actions
                  </button>
                  {!lost && <button disabled={!assigned && (sim.status !== 'Available' || sim.service_status !== 'Active')} title={!assigned && (sim.status !== 'Available' || sim.service_status !== 'Active') ? 'Only an Available SIM with Active service can be assigned' : undefined} onClick={() => { setActiveSim(sim); setAssignModalConfig({ isOpen: true, mode: assigned ? 'RETURN' : 'ASSIGN' }); }} className="min-h-11 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">{assigned ? 'Return' : 'Assign'}</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3 text-center w-10">#</th>
                <th className="py-3 px-4 min-w-[140px]">Mobile Number</th>
                <th className="py-3 px-3 min-w-[100px]">Provider</th>
                <th className="py-3 px-3 min-w-[105px]">City / State</th>
                <th className="py-3 px-3 min-w-[140px]">ICCID</th>
                <th className="py-3 px-3 min-w-[130px]">Plan</th>
                <th className="py-3 px-3 min-w-[110px]">Assignment</th>
                <th className="py-3 px-3 min-w-[90px] text-center">Service Status</th>
                <th className="py-3 px-4 min-w-[170px]">Current Rider</th>
                <th className="py-3 px-3 min-w-[130px]">Current Project</th>
                <th className="sticky right-0 z-20 min-w-[270px] border-l border-slate-200 bg-slate-50 px-4 py-3 text-right shadow-[-6px_0_12px_-9px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-800">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                      <span>Loading enterprise SIM cards...</span>
                    </div>
                  </td>
                </tr>
              ) : sims.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Smartphone className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                      <span className="font-semibold text-slate-600 dark:text-slate-400">
                        No SIM cards match your current criteria.
                      </span>
                      <button
                        onClick={handleResetFilters}
                        className="mt-1 text-xs text-blue-600 hover:underline font-bold"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                sims.map((sim, idx) => {
                  const isLost = sim.status === 'Lost' || sim.assignment_status === 'Lost';
                  const isAssigned = !isLost && (sim.assignment_status === 'Assigned' || sim.status === 'Assigned' || !!sim.current_employee_id);
                  const rowNumber = (page - 1) * pageSize + idx + 1;
                  const isServiceActive = sim.service_status === 'Active' || (sim.is_active !== false && sim.status !== 'Inactive');

                  return (
                    <tr
                      key={sim.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Index */}
                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-400">
                        {rowNumber}
                      </td>

                      {/* Mobile Number */}
                      <td className="py-2.5 px-4">
                        <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <PhoneCall className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>{sim.mobile_number}</span>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getVendorBadge(
                            sim.provider || sim.vendor || ''
                          )}`}
                        >
                          {sim.provider || sim.vendor || 'Telecom'}
                        </span>
                      </td>

                      {/* Saved physical SIM location: same field as mobile cards and state filter.
                          Do not guess the SIM's location from its rider or project. */}
                      <td className="py-2.5 px-3 min-w-[105px]">
                        <span
                          className="inline-flex max-w-[150px] items-center rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
                          title={sim.state?.trim() || 'SIM location not recorded'}
                        >
                          {sim.state?.trim() || 'State not set'}
                        </span>
                      </td>

                      {/* ICCID */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div>{sim.iccid || sim.sim_serial_number || '—'}</div>
                      </td>

                      {/* Plan */}
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={sim.plan}>
                          {sim.plan || 'Standard Corporate'}
                        </div>
                      </td>

                      {/* Assignment Status Badge (Custody) */}
                      <td className="py-2.5 px-3">
                        {isLost ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800">
                            Lost
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getAssignmentBadge(
                              isAssigned ? 'Assigned' : 'Unassigned'
                            )}`}
                          >
                            {isAssigned ? 'Assigned' : 'Unassigned'}
                          </span>
                        )}
                      </td>

                      {/* Service Status Badge (Telecom Line State) */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setActiveSim(sim);
                            setIsChangeStatusModalOpen(true);
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors ${getServiceBadge(
                            sim.service_status || (isServiceActive ? 'Active' : 'Inactive')
                          )}`}
                          title="Click to update Telecom Line Service Status (Active / Inactive / Suspended / Cancelled)"
                        >
                          {sim.service_status || (isServiceActive ? 'Active' : 'Inactive')}
                        </button>
                      </td>

                      {/* Current Custodian / Rider / Last Assignment */}
                      <td className="py-2.5 px-4">
                        {isLost ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400">
                              Asset Lost • Non-assignable
                            </span>
                            {sim.current_employee_name && (
                              <div className="text-[11px] text-slate-700 dark:text-slate-300">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold">Last Holder: </span>
                                <span className="font-semibold">{sim.current_employee_name}</span>
                                {sim.current_employee_code && (
                                  <span className="font-mono text-[10px] text-slate-400 ml-1">
                                    ({sim.current_employee_code})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : sim.current_employee_name ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{sim.current_employee_name}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded">
                                {sim.current_employee_code || 'EMP'}
                              </span>
                            </div>
                            {sim.last_employee_name && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Last assigned to: <span className="font-semibold">{sim.last_employee_name}</span>
                                {sim.last_employee_code && <span className="ml-1 font-mono">({sim.last_employee_code})</span>}
                              </div>
                            )}
                          </div>
                        ) : (sim as any).last_employee_name ? (
                          <div className="space-y-0.5">
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                              Available • In Stock
                            </span>
                            <div className="text-[11px] text-slate-700 dark:text-slate-300">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">Last: </span>
                              <span className="font-semibold">{(sim as any).last_employee_name}</span>
                              {(sim as any).last_employee_code && (
                                <span className="font-mono text-[10px] text-slate-400 ml-1">
                                  ({(sim as any).last_employee_code})
                                </span>
                              )}
                            </div>
                            {(sim as any).last_returned_date && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Ret: {(sim as any).last_returned_date}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 italic">
                            Available • In Stock
                          </span>
                        )}
                      </td>

                      {/* Current Project (Resolved dynamically from Employee) */}
                      <td className="py-2.5 px-3">
                        {sim.current_project && sim.current_project !== '—' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <Building className="w-3 h-3 text-slate-400" />
                            {sim.current_project}
                          </span>
                        ) : sim.current_project_name && sim.current_project_name !== '—' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                            <Building className="w-3 h-3 text-slate-400" />
                            {sim.current_project_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-xs font-mono">
                            —
                          </span>
                        )}
                      </td>

                      {/* Sticky actions: always reachable without scrolling to the far right. */}
                      <td className="sticky right-0 z-10 min-w-[270px] border-l border-slate-200 bg-white px-3 py-2.5 text-right shadow-[-6px_0_12px_-9px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {/* Quick Assign / Return / Replace / Recover / To Provider buttons */}
                          {isLost ? (
                            <button
                              onClick={() => {
                                setActiveSim(sim);
                                setIsRecoverModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
                              title="Recover physically retrieved SIM back into available inventory"
                            >
                              <ShieldAlert className="w-3 h-3" />
                              Recover
                            </button>
                          ) : !isAssigned ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveSim(sim);
                                  setAssignModalConfig({ isOpen: true, mode: 'ASSIGN' });
                                }}
                                disabled={sim.status !== 'Available' || sim.service_status !== 'Active'}
                                title={sim.status !== 'Available' || sim.service_status !== 'Active' ? 'Only an Available SIM with Active service can be assigned' : undefined}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                Assign
                              </button>
                              <button
                                onClick={() => {
                                  setActiveSim(sim);
                                  setIsReturnToProviderOpen(true);
                                }}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/60 rounded-lg font-semibold text-[11px] transition-colors border border-rose-200 dark:border-rose-800 cursor-pointer"
                                title="Return unassigned SIM line to Telecom Provider (du, Etisalat)"
                              >
                                To Provider
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setActiveSim(sim);
                                  setAssignModalConfig({ isOpen: true, mode: 'RETURN' });
                                }}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 text-slate-700 dark:text-slate-300 rounded-lg font-medium text-[11px] transition-colors border border-slate-200 dark:border-slate-700"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => {
                                  setActiveSim(sim);
                                  setAssignModalConfig({ isOpen: true, mode: 'REPLACE' });
                                }}
                                className="px-2 py-1 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 text-sky-700 dark:text-sky-300 rounded-lg font-bold text-[11px] transition-colors border border-sky-200 dark:border-sky-800"
                                title="1-Step Atomic SIM Replacement"
                              >
                                Replace
                              </button>
                            </div>
                          )}

                          {/* Direct actions remain visible even when the table is wide. */}
                          <button
                            type="button"
                            onClick={() => { setActiveSim(sim); setIsEditModalOpen(true); }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                          >
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveSim(sim); setIsHistoryModalOpen(true); }}
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          >
                            <History className="h-3.5 w-3.5" /> History
                          </button>

                          {/* All additional options open in a screen-level dialog, not clipped by table scrolling. */}
                          <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(openDropdownId === sim.id ? null : sim.id)}
                              aria-label={`All SIM actions for ${sim.mobile_number}`}
                              aria-haspopup="dialog"
                              aria-expanded={openDropdownId === sim.id}
                              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200"
                            >
                              <MoreVertical className="h-3.5 w-3.5" /> More
                            </button>

                            {openDropdownId === sim.id && typeof document !== 'undefined' && createPortal(
                              <div
                                className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6"
                                onClick={(event) => { event.stopPropagation(); setOpenDropdownId(null); }}
                              >
                                <div
                                  role="dialog"
                                  aria-modal="true"
                                  aria-label={`SIM actions for ${sim.mobile_number}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl dark:border-slate-700 dark:bg-slate-900"
                                >
                                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
                                    <div className="min-w-0">
                                      <h3 className="text-base font-bold text-slate-900 dark:text-white">SIM Actions</h3>
                                      <p className="mt-1 break-all text-sm font-semibold text-blue-700 dark:text-blue-300">{sim.mobile_number}</p>
                                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                        {sim.state || 'State not set'} · {isAssigned ? `Assigned to ${sim.current_employee_name || 'rider'}` : isLost ? 'Lost' : 'Unassigned'}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setOpenDropdownId(null)}
                                      aria-label="Close SIM actions"
                                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                                    >
                                      <X className="h-5 w-5" />
                                    </button>
                                  </div>
                                  <div className="overflow-y-auto overscroll-contain">
                                    <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
                                  {isLost ? (
                                    <button
                                      onClick={() => {
                                        setActiveSim(sim);
                                        setIsRecoverModalOpen(true);
                                        setOpenDropdownId(null);
                                      }}
                                      className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                                      Recover Lost SIM
                                    </button>
                                  ) : (
                                    <>
                                      {isAssigned ? (
                                        <>
                                          <button
                                            onClick={() => {
                                              setUndertakingEmployeeId(sim.current_employee_id || null);
                                              setUndertakingSimNumber(sim.mobile_number || null);
                                              setIsUndertakingModalOpen(true);
                                              setOpenDropdownId(null);
                                            }}
                                            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold"
                                          >
                                            <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                            SIM Undertaking (LT0020)
                                          </button>
                                          <button
                                            onClick={() => {
                                              setActiveSim(sim);
                                              setAssignModalConfig({ isOpen: true, mode: 'REPLACE' });
                                              setOpenDropdownId(null);
                                            }}
                                            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sky-700 dark:text-sky-300 font-bold"
                                          >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Replace (1-Step Swap)
                                          </button>
                                          <button
                                            onClick={() => {
                                              setActiveSim(sim);
                                              setAssignModalConfig({ isOpen: true, mode: 'TRANSFER' });
                                              setOpenDropdownId(null);
                                            }}
                                            className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                                          >
                                            <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                                            Transfer to Rider
                                          </button>
                                        </>
                                      ) : (
                                        <button
                                          onClick={() => {
                                            setActiveSim(sim);
                                            setIsReturnToProviderOpen(true);
                                            setOpenDropdownId(null);
                                          }}
                                          className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold cursor-pointer"
                                        >
                                          <Building className="w-3.5 h-3.5 text-rose-500" />
                                          Return to Provider (du/Etisalat)
                                        </button>
                                      )}
                                      <button
                                        onClick={() => {
                                          setActiveSim(sim);
                                          setIsMarkLostModalOpen(true);
                                          setOpenDropdownId(null);
                                        }}
                                        className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-700 dark:text-rose-400 font-semibold"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                        Mark as Lost
                                      </button>
                                    </>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleToggleActive(sim);
                                      setOpenDropdownId(null);
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                                  >
                                    <Radio className="w-3.5 h-3.5 text-emerald-600" />
                                    Toggle Service ({isServiceActive ? 'Deactivate' : 'Activate'})
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveSim(sim);
                                      setIsChangeStatusModalOpen(true);
                                      setOpenDropdownId(null);
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                                  >
                                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                                    Change Status
                                  </button>
                                  <button
                                    onClick={() => {
                                      setActiveSim(sim);
                                      setIsEditModalOpen(true);
                                      setOpenDropdownId(null);
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                    Edit Details
                                  </button>
                                </div>

                                    <div className="grid grid-cols-1 gap-2 border-t border-slate-200 p-4 dark:border-slate-700 sm:grid-cols-2">
                                  <button
                                    onClick={() => {
                                      setActiveSim(sim);
                                      setIsHistoryModalOpen(true);
                                      setOpenDropdownId(null);
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-700 dark:text-slate-300"
                                  >
                                    <History className="w-3.5 h-3.5 text-amber-600" />
                                    Audit & History Logs
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleArchive(sim);
                                      setOpenDropdownId(null);
                                    }}
                                    className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs leading-snug dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 text-rose-600 dark:text-rose-400"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Archive Line
                                  </button>
                                    </div>
                                  </div>
                                </div>
                              </div>,
                              document.body
                            )}
                          </div>
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
        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          {/* Entries Info */}
          <div className="text-slate-500 dark:text-slate-400">
            {totalCount > 0 ? (
              <>
                Showing{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {Math.min(page * pageSize, totalCount)}
                </span>{' '}
                of{' '}
                <span className="font-bold text-slate-800 dark:text-slate-200">{totalCount}</span>{' '}
                entries
              </>
            ) : (
              'No entries'
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 font-medium"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Previous / Next Buttons */}
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2.5 py-1 text-slate-700 dark:text-slate-300 font-medium">
                Page {page} of {totalPages || 1}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Modals */}
      {/* Create SIM(s) Modal */}
      <CreateSimsModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchSimList();
          fetchDashboardStats();
        }}
      />

      {/* Bulk Import SIMs Modal */}
      <BulkSimImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onSuccess={(result) => {
          setPage(1);
          setSearchQuery('');
          setDebouncedSearch('');
          setAssignmentFilter('ALL');
          setServiceFilter('ALL');
          setStateFilter('ALL');
          setSourceFilter('ALL');
          setVendorFilter('ALL');
          setProjectFilter('ALL');
          if (result && typeof result === 'object') {
            setImportResultBanner({
              imported: result.imported ?? 0,
              skipped: result.skipped ?? 0,
              failed: result.failed ?? 0,
            });
          }
          fetchSimList();
          fetchDashboardStats();
        }}
      />

      {/* Assign / Transfer / Return Modal */}
      <AssignSimModal
        isOpen={assignModalConfig.isOpen}
        mode={assignModalConfig.mode}
        sim={activeSim}
        onClose={() => setAssignModalConfig({ isOpen: false, mode: 'ASSIGN' })}
        onSuccess={() => {
          fetchSimList();
          fetchDashboardStats();
        }}
      />

      {/* Audit Trail & History Modal */}
      <SimHistoryModal
        isOpen={isHistoryModalOpen}
        sim={activeSim}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Change Status Modal */}
      <ChangeStatusModal
        isOpen={isChangeStatusModalOpen}
        sim={activeSim}
        onClose={() => setIsChangeStatusModalOpen(false)}
        onSuccess={() => {
          fetchSimList();
          fetchDashboardStats();
        }}
      />

      {/* Edit SIM Details Modal */}
      <EditSimModal
        isOpen={isEditModalOpen}
        sim={activeSim}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={() => {
          fetchSimList();
          fetchDashboardStats();
        }}
      />

      {/* Official SIM Undertaking (LT0020) Modal */}
      <SimUndertakingModal
        isOpen={isUndertakingModalOpen}
        onClose={() => {
          setIsUndertakingModalOpen(false);
          setUndertakingEmployeeId(null);
          setUndertakingSimNumber(null);
        }}
        preselectedEmployeeId={undertakingEmployeeId}
        preselectedSimNumber={undertakingSimNumber}
      />

      {/* Return SIM to Provider Modal */}
      {isReturnToProviderOpen && activeSim && (
        <ReturnSimToProviderModal
          isOpen={isReturnToProviderOpen}
          sim={activeSim}
          onClose={() => {
            setIsReturnToProviderOpen(false);
            setActiveSim(null);
          }}
          onSuccess={() => {
            fetchSimList();
            fetchDashboardStats();
          }}
        />
      )}

      {/* Mark SIM as Lost Modal */}
      {isMarkLostModalOpen && activeSim && (
        <MarkSimLostModal
          isOpen={isMarkLostModalOpen}
          sim={activeSim}
          onClose={() => {
            setIsMarkLostModalOpen(false);
            setActiveSim(null);
          }}
          onSuccess={() => {
            fetchSimList();
            fetchDashboardStats();
          }}
        />
      )}

      {/* Recover Lost SIM Modal */}
      {isRecoverModalOpen && activeSim && (
        <RecoverSimModal
          isOpen={isRecoverModalOpen}
          sim={activeSim}
          onClose={() => {
            setIsRecoverModalOpen(false);
            setActiveSim(null);
          }}
          onSuccess={() => {
            fetchSimList();
            fetchDashboardStats();
          }}
        />
      )}
    </div>
  );
};
