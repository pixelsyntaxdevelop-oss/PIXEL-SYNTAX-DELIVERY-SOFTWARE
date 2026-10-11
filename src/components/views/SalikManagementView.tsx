import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Plus,
  Filter,
  Download,
  RefreshCw,
  Eye,
  UserCheck,
  AlertTriangle,
  AlertCircle,
  FileText,
  DollarSign,
  Car,
  User,
  CheckCircle2,
  Clock,
  Building2,
  Users,
  RotateCcw,
  ShieldAlert,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Sparkles,
  MapPin,
  Tag,
  Building,
  Calendar,
  Layers,
  ArrowRight,
  History,
  Trash2,
} from 'lucide-react';
import {
  SalikRecord,
  SalikFinancialStats,
  SalikFilterState,
} from '../../types/salik';
import { SalikFinancialSummaryCards } from './salik/SalikFinancialSummaryCards';
import {
  SalikAssignModal,
  SalikBulkAssignModal,
  SalikLinkPayrollModal,
  SalikPrepaidModal,
  SalikTimelineModal,
  SalikUploadModal,
} from './salik/SalikActionModals';
import { Vehicle360ProfileModal } from '../fleet/Vehicle360ProfileModal';
import { Employee360ProfileView } from '../employee/Employee360ProfileView';
import { apiClient } from '../../services/apiClient';

export const SalikManagementView: React.FC<{ lang?: 'EN' | 'AR' }> = ({
  lang = 'EN',
}) => {
  // Metadata
  const [branches, setBranches] = useState<any[]>([]);
  const [tollGates, setTollGates] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState('2026-08');
  const [employees, setEmployees] = useState<any[]>([]);

  // Filter State
  const [filters, setFilters] = useState<SalikFilterState>({
    from: '2026-08-01',
    to: '2026-09-30',
    search: '',
    chargeFilter: 'ALL',
    tollGate: 'ALL',
    page: 1,
    pageSize: 25,
  });

  // Local Search Input
  const [searchInput, setSearchInput] = useState('');

  // Data & Stats State
  const [records, setRecords] = useState<SalikRecord[]>([]);
  const [stats, setStats] = useState<SalikFinancialStats | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Row Selection for Bulk Actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Auto-Assign Feedback Banner
  const [autoAssignResult, setAutoAssignResult] = useState<{
    success: boolean;
    message: string;
    resolved: number;
    pending: number;
  } | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Active Modals
  const [selectedForAssign, setSelectedForAssign] = useState<SalikRecord | null>(null);
  const [selectedForPayroll, setSelectedForPayroll] = useState<SalikRecord | null>(null);
  const [selectedForTimeline, setSelectedForTimeline] = useState<SalikRecord | null>(null);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isPrepaidOpen, setIsPrepaidOpen] = useState(false);

  // Vehicle 360 & Employee 360 Modals
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Load Metadata & Masters
  const fetchMetadata = async () => {
    try {
      const [metaRes, empRes] = await Promise.all([
        apiClient.get<any>('/api/erp/salik/meta'),
        apiClient.get<any[]>('/api/erp/master-employees'),
      ]);

      if (metaRes.data) {
        setBranches(metaRes.data.branches || []);
        setTollGates(metaRes.data.tollGates || []);
        if (metaRes.data.currentMonth) {
          setCurrentMonth(metaRes.data.currentMonth);
        }
      }

      if (empRes.data && Array.isArray(empRes.data)) {
        setEmployees(empRes.data);
      }
    } catch (err) {
      console.error('Failed to load Salik metadata:', err);
    }
  };

  // Fetch Financial Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (filters.from) qParams.append('from', filters.from);
      if (filters.to) qParams.append('to', filters.to);
      if (filters.tollGate && filters.tollGate !== 'ALL') qParams.append('tollGate', filters.tollGate);

      const res = await apiClient.get<SalikFinancialStats>(`/api/erp/salik/stats?${qParams.toString()}`);
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch Salik stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [filters.from, filters.to, filters.tollGate]);

  // Fetch Transactions List (Server-side filtered & paginated)
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
      });

      if (filters.from) qParams.append('from', filters.from);
      if (filters.to) qParams.append('to', filters.to);
      if (filters.chargeFilter && filters.chargeFilter !== 'ALL') {
        qParams.append('chargeFilter', filters.chargeFilter);
      }
      if (filters.tollGate && filters.tollGate !== 'ALL') {
        qParams.append('tollGate', filters.tollGate);
      }
      if (filters.search) {
        qParams.append('search', filters.search);
      }

      const res = await apiClient.get<any>(`/api/erp/salik?${qParams.toString()}`);

      if (res.data) {
        if (Array.isArray(res.data)) {
          setRecords(res.data);
          setTotalRecords(res.data.length);
          setTotalPages(Math.ceil(res.data.length / filters.pageSize));
        } else if (res.data.records) {
          setRecords(res.data.records);
          setTotalRecords(res.data.total || res.data.records.length);
          setTotalPages(res.data.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch Salik records:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecords();
  }, [fetchStats, fetchRecords]);

  // Handle Search Submission
  const handleApplySearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFilters((prev) => ({
      ...prev,
      search: searchInput.trim(),
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters({
      from: '2026-08-01',
      to: '2026-09-30',
      search: '',
      chargeFilter: 'ALL',
      tollGate: 'ALL',
      page: 1,
      pageSize: 25,
    });
    setSelectedIds(new Set());
  };

  // Row Selection Toggle
  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === records.length && records.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)));
    }
  };

  // Auto-Assign Trigger
  const handleRecheckAutoAssign = async () => {
    setIsAutoAssigning(true);
    setAutoAssignResult(null);
    try {
      const res = await apiClient.post<any>('/api/erp/salik/recheck-auto-assign');
      setAutoAssignResult({
        success: true,
        message: res.data?.message || 'Auto-assignment complete.',
        resolved: res.data?.auto_assigned_count || 0,
        pending: res.data?.remained_pending_count || 0,
      });
      fetchStats();
      fetchRecords();
    } catch (err: any) {
      setAutoAssignResult({
        success: false,
        message: err?.response?.data?.error || err?.message || 'Failed to auto-assign pending Salik.',
        resolved: 0,
        pending: 0,
      });
    } finally {
      setIsAutoAssigning(false);
    }
  };

  // Mark Company Liability
  const handleMarkCompanyLiability = async (record: SalikRecord) => {
    const confirmed = window.confirm(
      `Designate Salik toll ${record.transaction_id} (AED ${record.amount.toFixed(2)}) as Company Fleet Expense?`
    );
    if (!confirmed) return;

    try {
      await apiClient.post(`/api/erp/salik/${record.id}/set-company-liability`, {
        reason: 'Authorized business delivery trunk expense',
      });
      fetchStats();
      fetchRecords();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to mark company liability.');
    }
  };

  // Delete Salik Record
  const handleDeleteRecord = async (record: SalikRecord) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete pending Salik crossing ${record.transaction_id}?`
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/api/erp/salik/${record.id}`);
      fetchStats();
      fetchRecords();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete record.');
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const qParams = new URLSearchParams();
    if (filters.from) qParams.append('from', filters.from);
    if (filters.to) qParams.append('to', filters.to);
    if (filters.chargeFilter && filters.chargeFilter !== 'ALL') {
      qParams.append('chargeFilter', filters.chargeFilter);
    }
    if (filters.tollGate && filters.tollGate !== 'ALL') {
      qParams.append('tollGate', filters.tollGate);
    }
    if (filters.search) {
      qParams.append('search', filters.search);
    }

    window.open(`/api/erp/salik/export?${qParams.toString()}`, '_blank');
  };

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const csvContent =
      'Transaction ID,Trip Date,Trip Time,Toll Gate,Direction,Tag Number,Plate Number,Plate Code,Amount\n' +
      'SLK-2026-08-1001,2026-08-10,08:30:00,Al Barsha,Southbound,0010992451,72154,T,4.00\n' +
      'SLK-2026-08-1002,2026-08-10,14:20:00,Al Safa,Northbound,0010992451,72154,T,4.00\n' +
      'SLK-2026-08-1003,2026-08-11,09:15:00,Airport Tunnel,Eastbound,0010992452,49102,A,4.00\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'salik_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedRecordsList = records.filter((r) => selectedIds.has(r.id));

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
      {/* 1. TOP HEADER & OPERATIONAL ACTIONS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Salik Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                UAE Toll Crossing Audit, Dynamic Historical Rider Allocation & Payroll Sync
              </p>
            </div>
          </div>
        </div>

        {/* Top Action Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-1.5"
            title="Download CSV Import Template"
          >
            <Download className="w-3.5 h-3.5" />
            Download Template
          </button>

          {/* Upload */}
          <button
            type="button"
            onClick={() => setIsUploadOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-1.5"
            title="Upload Salik CSV or Excel File"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Upload
          </button>

          {/* Bulk Assign */}
          <button
            type="button"
            onClick={() => setIsBulkAssignOpen(true)}
            disabled={selectedIds.size === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-1.5 disabled:opacity-40 disabled:pointer-events-none"
            title="Assign selected Salik records"
          >
            <Users className="w-3.5 h-3.5" />
            Bulk Assign {selectedIds.size > 0 && `(${selectedIds.size})`}
          </button>

          {/* Recheck & Auto-Assign Pending Salik */}
          <button
            type="button"
            onClick={handleRecheckAutoAssign}
            disabled={isAutoAssigning}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            title="Recheck assignment history at exact transaction timestamps"
          >
            {isAutoAssigning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            Recheck & Auto-Assign Pending Salik
          </button>

          {/* Export */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center gap-1.5"
            title="Export filtered records to CSV"
          >
            <FileText className="w-3.5 h-3.5" />
            Export
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchRecords();
            }}
            disabled={loading}
            className="p-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs flex items-center"
            title="Refresh Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add Pre-Paid Salik */}
          <button
            type="button"
            onClick={() => setIsPrepaidOpen(true)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Pre-Paid Salik
          </button>
        </div>
      </div>

      {/* Auto-Assign Feedback Banner */}
      {autoAssignResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            autoAssignResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {autoAssignResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <div>
              <span className="font-semibold">{autoAssignResult.message}</span>
              {autoAssignResult.success && (
                <span className="ml-2 text-slate-600 dark:text-slate-300">
                  (Resolved: <strong>{autoAssignResult.resolved}</strong>, Remained Unassigned: <strong>{autoAssignResult.pending}</strong>)
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setAutoAssignResult(null)}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. LIVE FINANCIAL SUMMARY CARDS */}
      <SalikFinancialSummaryCards
        stats={stats}
        loading={statsLoading}
        activeFilter={filters.chargeFilter}
        onFilterChange={(filter) => {
          setFilters((prev) => ({ ...prev, chargeFilter: filter, page: 1 }));
        }}
      />

      {/* 3. FILTER / SEARCH PANEL */}
      <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <form onSubmit={handleApplySearch} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* FROM Date */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
              From
            </label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }))
              }
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          {/* TO Date */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
              To
            </label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }))
              }
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          {/* Toll Gate Filter */}
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Toll Gate
            </label>
            <select
              value={filters.tollGate || 'ALL'}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, tollGate: e.target.value, page: 1 }))
              }
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Toll Gates</option>
              {tollGates.map((gate) => (
                <option key={gate} value={gate}>
                  {gate}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">
              Search
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tx ID, Plate, Gate, Tag, Rider Name / Code..."
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Action Buttons: Find & Reset */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-lg shadow-xs flex items-center justify-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              Find
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-300 dark:border-slate-700"
              title="Reset Filters"
            >
              Reset
            </button>
          </div>
        </form>

        {/* Quick Filter Status Pills */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
              Filter By Status:
            </span>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, chargeFilter: 'ALL', page: 1 }))}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filters.chargeFilter === 'ALL'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All ({stats?.totalCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, chargeFilter: 'CHARGED', page: 1 }))}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filters.chargeFilter === 'CHARGED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              Charged ({stats?.chargedCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setFilters((prev) => ({ ...prev, chargeFilter: 'UNCHARGED', page: 1 }))}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filters.chargeFilter === 'UNCHARGED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Uncharged ({stats?.unchargedCount || 0})
            </button>
          </div>

          <div className="text-slate-500 text-[11px]">
            Showing <strong>{records.length}</strong> of <strong>{totalRecords}</strong> Salik crossings
          </div>
        </div>
      </div>

      {/* 4. SALIK TRANSACTION DATA TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 select-none uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === records.length && records.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Transaction ID</th>
                <th className="p-3">Trip Date & Time</th>
                <th className="p-3">Toll Gate</th>
                <th className="p-3">Direction</th>
                <th className="p-3">Tag</th>
                <th className="p-3">Plate</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Project</th>
                <th className="p-3">Charge Status</th>
                <th className="p-3">Payroll Month</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={15} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                    Loading verified Salik transactions...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={15} className="p-12 text-center text-slate-500">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      No Salik transactions found for selected period.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Adjust date range, reset filters, or upload a Salik portal statement.
                    </p>
                  </td>
                </tr>
              ) : (
                records.map((r, idx) => {
                  const isSelected = selectedIds.has(r.id);
                  const isPending = r.charge_status === 'UNCHARGED' || r.status === 'PENDING';
                  const isCompany = r.charge_status === 'COMPANY_LIABILITY' || r.status === 'COMPANY_LIABILITY';
                  const isPayrollLinked = r.status === 'PAYROLL_LINKED';

                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(r.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                      </td>

                      {/* Row Index */}
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {(filters.page - 1) * filters.pageSize + idx + 1}
                      </td>

                      {/* Transaction ID */}
                      <td className="p-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-white">
                          {r.transaction_id}
                        </div>
                        {r.reference && (
                          <div className="text-[10px] text-slate-400">Ref: {r.reference}</div>
                        )}
                      </td>

                      {/* Trip Date & Time */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {r.transaction_date}
                        </div>
                        <div className="text-[11px] text-slate-400">{r.transaction_time}</div>
                      </td>

                      {/* Toll Gate */}
                      <td className="p-3">
                        <span className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          {r.toll_gate}
                        </span>
                      </td>

                      {/* Direction */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {r.direction || 'Standard'}
                        </span>
                      </td>

                      {/* Tag Number */}
                      <td className="p-3 font-mono text-[11px] text-slate-500">
                        {r.tag_number || '-'}
                      </td>

                      {/* Plate (Click opens Vehicle 360) */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setSelectedVehicleId(r.vehicle_id || r.plate_number)}
                          className="font-bold text-slate-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1"
                          title="Open Vehicle 360 profile"
                        >
                          <Car className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.plate_number}</span>
                          {r.plate_code && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                              {r.plate_code}
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        AED {r.amount.toFixed(2)}
                      </td>

                      {/* Assigned Rider (Click opens Employee 360) */}
                      <td className="p-3">
                        {r.assigned_employee_name ? (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedEmployeeId(r.assigned_employee_id || r.assigned_employee_code || null)
                            }
                            className="text-left group"
                            title="Open Employee 360 profile"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white group-hover:text-emerald-600 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-emerald-600" />
                              {r.assigned_employee_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {r.assigned_employee_code || '-'}
                            </div>
                          </button>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 text-xs italic font-medium">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Project */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {r.assigned_project_name || 'Fleet'}
                        </span>
                      </td>

                      {/* Charge Status */}
                      <td className="p-3 whitespace-nowrap">
                        {r.charge_status === 'CHARGED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Charged
                          </span>
                        )}
                        {r.charge_status === 'UNCHARGED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="w-3 h-3" /> Uncharged
                          </span>
                        )}
                        {r.charge_status === 'COMPANY_LIABILITY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                            <Building className="w-3 h-3" /> Company Liability
                          </span>
                        )}
                        {r.charge_status === 'DISPUTED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                            <ShieldAlert className="w-3 h-3" /> Disputed
                          </span>
                        )}
                      </td>

                      {/* Payroll Month */}
                      <td className="p-3 font-mono text-[11px]">
                        {r.payroll_period ? (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                            {r.payroll_period}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                          {r.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {/* Assign / Reassign */}
                          <button
                            type="button"
                            onClick={() => setSelectedForAssign(r)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                            title="Assign or Reassign Crossing"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* Link to Payroll */}
                          {!isCompany && !isPayrollLinked && (
                            <button
                              type="button"
                              onClick={() => setSelectedForPayroll(r)}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600"
                              title="Link to Payroll Period"
                            >
                              <DollarSign className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Company Liability */}
                          {!isCompany && (
                            <button
                              type="button"
                              onClick={() => handleMarkCompanyLiability(r)}
                              className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                              title="Set as Company Fleet Expense"
                            >
                              <Building className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* View Audit Timeline */}
                          <button
                            type="button"
                            onClick={() => setSelectedForTimeline(r)}
                            className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                            title="View Complete Audit Trail"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete if pending */}
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(r)}
                              className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600"
                              title="Delete Pending Salik Crossing"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server Pagination Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Rows per page:</span>
            <select
              value={filters.pageSize}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  pageSize: parseInt(e.target.value, 10),
                  page: 1,
                }))
              }
              className="text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-800 dark:text-slate-200"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-500">
              Page <strong>{filters.page}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={filters.page <= 1}
                className="p-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))
                }
                disabled={filters.page >= totalPages}
                className="p-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {/* 1. Assign Modal */}
      <SalikAssignModal
        isOpen={!!selectedForAssign}
        onClose={() => setSelectedForAssign(null)}
        record={selectedForAssign}
        employees={employees}
        onSuccess={() => {
          fetchStats();
          fetchRecords();
        }}
      />

      {/* 2. Bulk Assign Modal */}
      <SalikBulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        selectedRecords={selectedRecordsList}
        employees={employees}
        onSuccess={() => {
          setSelectedIds(new Set());
          fetchStats();
          fetchRecords();
        }}
      />

      {/* 3. Link to Payroll Modal */}
      <SalikLinkPayrollModal
        isOpen={!!selectedForPayroll}
        onClose={() => setSelectedForPayroll(null)}
        record={selectedForPayroll}
        currentMonth={currentMonth}
        onSuccess={() => {
          fetchStats();
          fetchRecords();
        }}
      />

      {/* 4. Pre-Paid Salik Modal */}
      <SalikPrepaidModal
        isOpen={isPrepaidOpen}
        onClose={() => setIsPrepaidOpen(false)}
        onSuccess={() => {
          fetchStats();
          fetchRecords();
        }}
      />

      {/* 5. Audit Timeline Modal */}
      <SalikTimelineModal
        isOpen={!!selectedForTimeline}
        onClose={() => setSelectedForTimeline(null)}
        record={selectedForTimeline}
      />

      {/* 6. Upload Modal */}
      <SalikUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          fetchStats();
          fetchRecords();
        }}
      />

      {/* 7. Vehicle 360 Profile Modal */}
      {selectedVehicleId && (
        <Vehicle360ProfileModal
          vehicleId={selectedVehicleId}
          isOpen={!!selectedVehicleId}
          onClose={() => setSelectedVehicleId(null)}
        />
      )}

      {/* 8. Employee 360 Profile Modal Drawer */}
      {selectedEmployeeId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-5xl h-full bg-white dark:bg-slate-900 shadow-2xl overflow-y-auto">
            <Employee360ProfileView
              employeeId={selectedEmployeeId}
              onBack={() => setSelectedEmployeeId(null)}
              lang={lang}
            />
          </div>
        </div>
      )}
    </div>
  );
};
