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
} from 'lucide-react';
import {
  TrafficFineRecord,
  FineFinancialStats,
  FineFilterState,
} from '../../types/trafficFines';
import { FineFinancialSummaryCards } from './fines/FineFinancialSummaryCards';
import { AddTrafficFineView } from './fines/AddTrafficFineView';
import {
  AllocateFineModal,
  CorrectResponsibilityModal,
  LinkPayrollModal,
  SettleFineModal,
  DisputeFineModal,
  FineTimelineModal,
  BulkAllocateModal,
} from './fines/FineActionModals';
import { Vehicle360ProfileModal } from '../fleet/Vehicle360ProfileModal';
import { Employee360ProfileView } from '../employee/Employee360ProfileView';
import { apiClient } from '../../services/apiClient';

export const TrafficFinesManagementView: React.FC<{ lang?: 'EN' | 'AR' }> = ({
  lang = 'EN',
}) => {
  // Page Mode: 'LIST' | 'ADD_FINES'
  const [viewMode, setViewMode] = useState<'LIST' | 'ADD_FINES'>('LIST');

  // Metadata
  const [branches, setBranches] = useState<any[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [fineTypes, setFineTypes] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState('2026-08');
  const [employees, setEmployees] = useState<any[]>([]);

  // Filter State
  const [filters, setFilters] = useState<FineFilterState>({
    month: '2026-08',
    branch: 'ALL',
    fineType: 'ALL',
    allocationStatus: 'ALL',
    employee: 'ALL',
    search: '',
    page: 1,
    pageSize: 25,
  });

  // Local search input before pressing "Find"
  const [searchInput, setSearchInput] = useState('');

  // Data & Stats State
  const [fines, setFines] = useState<TrafficFineRecord[]>([]);
  const [stats, setStats] = useState<FineFinancialStats | null>(null);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Active Modals
  const [selectedFineForAllocate, setSelectedFineForAllocate] = useState<TrafficFineRecord | null>(null);
  const [selectedFineForCorrect, setSelectedFineForCorrect] = useState<TrafficFineRecord | null>(null);
  const [selectedFineForPayroll, setSelectedFineForPayroll] = useState<TrafficFineRecord | null>(null);
  const [selectedFineForSettle, setSelectedFineForSettle] = useState<TrafficFineRecord | null>(null);
  const [selectedFineForDispute, setSelectedFineForDispute] = useState<TrafficFineRecord | null>(null);
  const [selectedFineForTimeline, setSelectedFineForTimeline] = useState<TrafficFineRecord | null>(null);
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);

  // Vehicle 360 & Employee 360 Modals
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Fetch Metadata & Master Employees
  const fetchMetadata = async () => {
    try {
      const [metaRes, empRes] = await Promise.all([
        apiClient.get<any>('/api/erp/fines/meta'),
        apiClient.get<any[]>('/api/erp/master-employees'),
      ]);

      if (metaRes.data) {
        setBranches(metaRes.data.branches || []);
        setVendors(metaRes.data.vendors || []);
        setFineTypes(metaRes.data.fineTypes || []);
        if (metaRes.data.currentMonth) {
          setCurrentMonth(metaRes.data.currentMonth);
        }
      }

      if (empRes.data && Array.isArray(empRes.data)) {
        setEmployees(empRes.data);
      }
    } catch (err) {
      console.error('Failed to load traffic fine metadata:', err);
    }
  };

  // Fetch Financial Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (filters.month && filters.month !== 'ALL') qParams.append('month', filters.month);
      if (filters.branch && filters.branch !== 'ALL') qParams.append('branch', filters.branch);

      const res = await apiClient.get<FineFinancialStats>(`/api/erp/fines/stats?${qParams.toString()}`);
      if (res.data) {
        setStats(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch fine stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [filters.month, filters.branch]);

  // Fetch Fines List (Server-side filtered & paginated)
  const fetchFines = useCallback(async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams({
        page: filters.page.toString(),
        pageSize: filters.pageSize.toString(),
      });

      if (filters.month && filters.month !== 'ALL') qParams.append('month', filters.month);
      if (filters.branch && filters.branch !== 'ALL') qParams.append('branch', filters.branch);
      if (filters.fineType && filters.fineType !== 'ALL') qParams.append('fineType', filters.fineType);
      if (filters.allocationStatus && filters.allocationStatus !== 'ALL') qParams.append('allocationStatus', filters.allocationStatus);
      if (filters.employee && filters.employee !== 'ALL') qParams.append('employee', filters.employee);
      if (filters.search) qParams.append('search', filters.search);

      const res = await apiClient.get<any>(`/api/erp/fines?${qParams.toString()}`);

      if (res.data) {
        if (Array.isArray(res.data)) {
          setFines(res.data);
          setTotalRecords(res.data.length);
          setTotalPages(Math.ceil(res.data.length / filters.pageSize));
        } else if (res.data.records) {
          setFines(res.data.records);
          setTotalRecords(res.data.total || res.data.records.length);
          setTotalPages(res.data.totalPages || 1);
        }
      }
    } catch (err) {
      console.error('Failed to fetch fines list:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchStats();
    fetchFines();
  }, [fetchStats, fetchFines]);

  // Handle Find button click
  const handleFind = () => {
    setFilters((prev) => ({
      ...prev,
      search: searchInput.trim(),
      page: 1,
    }));
  };

  // Handle Reset button click
  const handleReset = () => {
    setSearchInput('');
    setFilters({
      month: '2026-08',
      branch: 'ALL',
      fineType: 'ALL',
      allocationStatus: 'ALL',
      employee: 'ALL',
      search: '',
      page: 1,
      pageSize: 25,
    });
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (fines.length === 0) return;

    const headers = [
      'Reference Number',
      'Invoice Number',
      'Plate Number',
      'Plate Code',
      'Emirate',
      'Transaction Date',
      'Time',
      'Authority / Vendor',
      'Violation Type',
      'Fine Amount (AED)',
      'Admin Fee (AED)',
      'Service Fee (AED)',
      'Total Amount (AED)',
      'Allocation Status',
      'Assigned Employee',
      'Employee Code',
      'Liability Type',
      'Company Liability (AED)',
      'Employee Liability (AED)',
      'Payroll Deducted',
      'Status',
    ];

    const rows = fines.map((f) => [
      f.reference_number,
      f.invoice_number || '',
      f.plate_number,
      f.plate_code || '',
      f.plate_emirate || '',
      f.transaction_date,
      f.transaction_time || '',
      f.vendor,
      f.violation_type,
      f.fine_amount,
      f.admin_fee,
      f.service_fee,
      f.total_amount,
      f.allocation_status,
      f.rider_name || 'Unallocated',
      f.rider_code || '',
      f.liability_type,
      f.company_liability,
      f.employee_liability,
      f.deducted_from_payroll ? 'YES' : 'NO',
      f.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `traffic_fines_${filters.month}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (fine: TrafficFineRecord) => {
    if (fine.status === 'DISPUTED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          DISPUTED
        </span>
      );
    }
    if (fine.status === 'DEDUCTED_FROM_PAYROLL' || fine.deducted_from_payroll) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200" title={`Deducted in ${fine.payroll_period_key}`}>
          PAYROLL DEDUCTED
        </span>
      );
    }
    if (fine.status === 'PAID' || fine.outstanding_balance <= 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          SETTLED / PAID
        </span>
      );
    }
    if (fine.allocation_status === 'UNALLOCATED') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          UNALLOCATED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
        ASSIGNED TO DRIVER
      </span>
    );
  };

  const getLiabilityBadge = (fine: TrafficFineRecord) => {
    if (fine.liability_type === 'COMPANY') {
      return (
        <div className="text-[11px]">
          <span className="font-semibold text-slate-800">Company (100%)</span>
          <div className="text-slate-500 font-mono text-[10px]">AED {fine.company_liability.toFixed(2)}</div>
        </div>
      );
    }
    if (fine.liability_type === 'SPLIT') {
      return (
        <div className="text-[11px]">
          <span className="font-semibold text-purple-700">Split Liability</span>
          <div className="text-slate-500 font-mono text-[10px]">
            Emp: {fine.employee_liability.toFixed(2)} | Comp: {fine.company_liability.toFixed(2)}
          </div>
        </div>
      );
    }
    return (
      <div className="text-[11px]">
        <span className="font-semibold text-indigo-700">Employee (100%)</span>
        <div className="text-slate-500 font-mono text-[10px]">AED {fine.employee_liability.toFixed(2)}</div>
      </div>
    );
  };

  // If user clicked "+ Add Traffic Fine", render the specialized Add Traffic Fine View
  if (viewMode === 'ADD_FINES') {
    return (
      <AddTrafficFineView
        onBack={() => {
          setViewMode('LIST');
          fetchFines();
          fetchStats();
        }}
        onSuccess={() => {
          setViewMode('LIST');
          fetchFines();
          fetchStats();
        }}
        branches={branches}
        vendors={vendors}
        fineTypes={fineTypes}
        currentMonth={currentMonth}
      />
    );
  }

  return (
    <div className="space-y-4 pb-12 text-slate-900" id="traffic-fines-management-view">
      {/* 1. TOP HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 border border-slate-200 rounded-lg shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Traffic Fines</span>
            <span className="text-xs font-normal px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
              Fleet Operations
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Fine radar ticketing, duplicate protection, historical custody resolution & payroll deduction
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Excel */}
          <button
            type="button"
            id="btn-export-fines"
            onClick={handleExportExcel}
            disabled={fines.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export Excel</span>
          </button>

          {/* Bulk Allocate (visible if unallocated fines exist) */}
          {stats && stats.unallocatedCount > 0 && (
            <button
              type="button"
              id="btn-bulk-allocate-fines"
              onClick={() => setIsBulkAllocateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-md hover:bg-emerald-100 shadow-sm transition-colors"
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Allocate ({stats.unallocatedCount})</span>
            </button>
          )}

          {/* Refresh */}
          <button
            type="button"
            id="btn-refresh-fines"
            onClick={() => {
              fetchStats();
              fetchFines();
            }}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 shadow-sm transition-colors"
            title="Refresh records"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Add Traffic Fine (Primary Action) */}
          <button
            type="button"
            id="btn-add-traffic-fine"
            onClick={() => setViewMode('ADD_FINES')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Traffic Fine</span>
          </button>
        </div>
      </div>

      {/* 2. DENSE FILTER & SEARCH PANEL */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm space-y-3" id="traffic-fines-filter-panel">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* For Month */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              For Month
            </label>
            <select
              id="filter-month"
              value={filters.month}
              onChange={(e) => setFilters({ ...filters, month: e.target.value, page: 1 })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
              <option value="2026-06">June 2026</option>
              <option value="2026-05">May 2026</option>
              <option value="ALL">All Months</option>
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Branch</label>
            <select
              id="filter-branch"
              value={filters.branch}
              onChange={(e) => setFilters({ ...filters, branch: e.target.value, page: 1 })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.branch_name || b.name || b.id}
                </option>
              ))}
            </select>
          </div>

          {/* Fine Type */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Fine Type
            </label>
            <select
              id="filter-fine-type"
              value={filters.fineType}
              onChange={(e) => setFilters({ ...filters, fineType: e.target.value, page: 1 })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">All Fine Types</option>
              <option value="Vendor Wise">Vendor Wise</option>
              <option value="Police Authority">Police Authority</option>
              <option value="Dubai Police">Dubai Police</option>
              <option value="Abu Dhabi Police">Abu Dhabi Police</option>
              <option value="Sharjah Police">Sharjah Police</option>
              <option value="RTA">RTA</option>
              <option value="Municipality">Municipality</option>
            </select>
          </div>

          {/* Employee */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Employee
            </label>
            <select
              id="filter-employee"
              value={filters.employee}
              onChange={(e) => setFilters({ ...filters, employee: e.target.value, page: 1 })}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              <option value="ALL">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} ({emp.employee_code || emp.id})
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="lg:col-span-2">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Search Fines
            </label>
            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  id="input-search-fines"
                  placeholder="Search plate #, ref #, inv #, vendor, employee..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFind()}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>

              {/* Find Button */}
              <button
                type="button"
                id="btn-find-fines"
                onClick={handleFind}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold shadow-xs transition-colors"
              >
                <span>Find</span>
              </button>

              {/* Reset Button */}
              <button
                type="button"
                id="btn-reset-filters"
                onClick={handleReset}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-xs transition-colors"
                title="Reset Filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. QUICK ALLOCATION TABS */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mr-1">
              Allocation Filter:
            </span>

            {/* All */}
            <button
              type="button"
              id="pill-allocation-all"
              onClick={() => setFilters({ ...filters, allocationStatus: 'ALL', page: 1 })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filters.allocationStatus === 'ALL'
                  ? 'bg-slate-900 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All</span>
              <span className="text-[10px] opacity-75">({stats?.totalCount ?? totalRecords})</span>
            </button>

            {/* Allocated */}
            <button
              type="button"
              id="pill-allocation-allocated"
              onClick={() => setFilters({ ...filters, allocationStatus: 'ALLOCATED', page: 1 })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filters.allocationStatus === 'ALLOCATED'
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Allocated</span>
              <span className="text-[10px] opacity-75">({stats?.allocatedCount ?? 0})</span>
            </button>

            {/* Unallocated */}
            <button
              type="button"
              id="pill-allocation-unallocated"
              onClick={() => setFilters({ ...filters, allocationStatus: 'UNALLOCATED', page: 1 })}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                filters.allocationStatus === 'UNALLOCATED'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Unallocated</span>
              <span className="text-[10px] opacity-75">({stats?.unallocatedCount ?? 0})</span>
            </button>
          </div>

          <div className="text-xs text-slate-500">
            Total Matched: <strong className="text-slate-800">{totalRecords}</strong>
          </div>
        </div>
      </div>

      {/* 4. FINANCIAL SUMMARY CARDS */}
      <FineFinancialSummaryCards stats={stats} loading={statsLoading} />

      {/* 5. DENSE OPERATIONAL DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden" id="traffic-fines-table-container">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" id="table-traffic-fines">
            <thead>
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold text-[11px] whitespace-nowrap">
                <th className="py-2.5 px-3">Ref # / Invoice #</th>
                <th className="py-2.5 px-3">Plate #</th>
                <th className="py-2.5 px-3">Violation Date</th>
                <th className="py-2.5 px-3">Authority / Vendor</th>
                <th className="py-2.5 px-3 min-w-[180px]">Violation & Location</th>
                <th className="py-2.5 px-3 text-right">Fine</th>
                <th className="py-2.5 px-3 text-right">Fees</th>
                <th className="py-2.5 px-3 text-right">Net Total</th>
                <th className="py-2.5 px-3">Liability</th>
                <th className="py-2.5 px-3">Assigned Employee</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-400" />
                    <span>Loading operational traffic fines...</span>
                  </td>
                </tr>
              ) : fines.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                    <div className="font-semibold text-slate-700 text-sm">
                      No traffic fines found for selected period
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Change the month or search criteria above, or click "Add Traffic Fine".
                    </p>
                  </td>
                </tr>
              ) : (
                fines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Ref # & Invoice */}
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedFineForTimeline(fine)}
                        className="font-mono font-bold text-slate-900 hover:text-red-600 block text-left"
                        title="Click to view full timeline audit history"
                      >
                        {fine.reference_number}
                      </button>
                      {fine.invoice_number && (
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Inv: {fine.invoice_number}
                        </span>
                      )}
                    </td>

                    {/* Plate No (Click opens Vehicle 360) */}
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleId(fine.vehicle_id || fine.plate_number)}
                        className="inline-flex items-center gap-1 font-mono font-bold text-slate-800 hover:text-blue-600 hover:underline"
                        title="Click to open Vehicle 360 profile"
                      >
                        <Car className="w-3.5 h-3.5 text-slate-400" />
                        <span>{fine.plate_number}</span>
                        {fine.plate_code && <span className="text-slate-500">({fine.plate_code})</span>}
                      </button>
                      <span className="text-[10px] text-slate-400 block font-normal">
                        {fine.plate_emirate || 'Dubai'} • {fine.vehicle_type || 'Motorcycle'}
                      </span>
                    </td>

                    {/* Violation Date */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-medium text-slate-800">{fine.transaction_date}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {fine.transaction_time || '12:00:00'}
                      </div>
                    </td>

                    {/* Authority / Vendor */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-slate-800">{fine.vendor}</span>
                      <span className="text-[10px] text-slate-400 block">{fine.fine_type}</span>
                    </td>

                    {/* Violation & Location */}
                    <td className="py-2.5 px-3 max-w-xs">
                      <div className="font-medium text-slate-800 truncate" title={fine.violation_type}>
                        {fine.violation_type}
                      </div>
                      {fine.location && (
                        <div className="text-[10px] text-slate-500 truncate" title={fine.location}>
                          📍 {fine.location}
                        </div>
                      )}
                    </td>

                    {/* Fine Amount */}
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                      {fine.fine_amount.toFixed(2)}
                    </td>

                    {/* Fees */}
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                      {(fine.admin_fee + fine.service_fee).toFixed(2)}
                    </td>

                    {/* Net Total */}
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 text-sm">
                      AED {fine.total_amount.toFixed(2)}
                    </td>

                    {/* Liability */}
                    <td className="py-2.5 px-3">{getLiabilityBadge(fine)}</td>

                    {/* Assigned Employee (Click opens Employee 360) */}
                    <td className="py-2.5 px-3">
                      {fine.rider_id ? (
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(fine.rider_id!)}
                          className="text-left font-semibold text-slate-900 hover:text-blue-600 hover:underline block"
                          title="Click to open Employee 360 profile"
                        >
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{fine.rider_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono block ml-4">
                            {fine.rider_code || fine.rider_id}
                          </span>
                        </button>
                      ) : (
                        <span className="text-amber-700 font-medium italic text-[11px]">
                          Unassigned Rider
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-3 text-center">{getStatusBadge(fine)}</td>

                    {/* Actions Menu */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {/* If unallocated -> Allocate button */}
                        {fine.allocation_status === 'UNALLOCATED' && (
                          <button
                            type="button"
                            onClick={() => setSelectedFineForAllocate(fine)}
                            className="px-2 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors"
                            title="Allocate to responsible rider"
                          >
                            Allocate
                          </button>
                        )}

                        {/* If allocated -> Correct Responsibility button */}
                        {fine.allocation_status === 'ALLOCATED' && (
                          <button
                            type="button"
                            onClick={() => setSelectedFineForCorrect(fine)}
                            className="px-2 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors"
                            title="Correct fine responsibility"
                          >
                            Correct
                          </button>
                        )}

                        {/* Link to Payroll (if not yet deducted and employee liability > 0) */}
                        {!fine.deducted_from_payroll && fine.employee_liability > 0 && fine.rider_id && (
                          <button
                            type="button"
                            onClick={() => setSelectedFineForPayroll(fine)}
                            className="px-2 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors"
                            title="Link fine to monthly payroll deduction"
                          >
                            Payroll
                          </button>
                        )}

                        {/* Settle (if outstanding balance > 0) */}
                        {fine.outstanding_balance > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedFineForSettle(fine)}
                            className="px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors"
                            title="Record fine settlement"
                          >
                            Settle
                          </button>
                        )}

                        {/* View Audit Timeline */}
                        <button
                          type="button"
                          onClick={() => setSelectedFineForTimeline(fine)}
                          className="p-1 text-slate-400 hover:text-slate-800 transition-colors"
                          title="View audit history"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 6. SERVER-SIDE PAGINATION BAR */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-600">
            Showing{' '}
            <strong>
              {totalRecords === 0 ? 0 : (filters.page - 1) * filters.pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong>
              {Math.min(filters.page * filters.pageSize, totalRecords)}
            </strong>{' '}
            of <strong>{totalRecords}</strong> fines
          </div>

          <div className="flex items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">Rows per page:</span>
              <select
                id="select-page-size"
                value={filters.pageSize}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    pageSize: Number(e.target.value),
                    page: 1,
                  })
                }
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-800"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Prev / Next Pagination Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                id="btn-prev-page"
                onClick={() => setFilters({ ...filters, page: Math.max(1, filters.page - 1) })}
                disabled={filters.page <= 1}
                className="p-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-2 font-semibold text-slate-800 text-xs">
                Page {filters.page} of {Math.max(1, totalPages)}
              </span>

              <button
                type="button"
                id="btn-next-page"
                onClick={() => setFilters({ ...filters, page: Math.min(totalPages, filters.page + 1) })}
                disabled={filters.page >= totalPages}
                className="p-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 7. ALL ACTION MODALS */}

      {/* Allocate Modal */}
      <AllocateFineModal
        isOpen={!!selectedFineForAllocate}
        onClose={() => setSelectedFineForAllocate(null)}
        fine={selectedFineForAllocate}
        employees={employees}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Correct Responsibility Modal */}
      <CorrectResponsibilityModal
        isOpen={!!selectedFineForCorrect}
        onClose={() => setSelectedFineForCorrect(null)}
        fine={selectedFineForCorrect}
        employees={employees}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Link to Payroll Modal */}
      <LinkPayrollModal
        isOpen={!!selectedFineForPayroll}
        onClose={() => setSelectedFineForPayroll(null)}
        fine={selectedFineForPayroll}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Settle Fine Modal */}
      <SettleFineModal
        isOpen={!!selectedFineForSettle}
        onClose={() => setSelectedFineForSettle(null)}
        fine={selectedFineForSettle}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Dispute Fine Modal */}
      <DisputeFineModal
        isOpen={!!selectedFineForDispute}
        onClose={() => setSelectedFineForDispute(null)}
        fine={selectedFineForDispute}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Fine Audit & Timeline Modal */}
      <FineTimelineModal
        isOpen={!!selectedFineForTimeline}
        onClose={() => setSelectedFineForTimeline(null)}
        fine={selectedFineForTimeline}
      />

      {/* Bulk Allocate Modal */}
      <BulkAllocateModal
        isOpen={isBulkAllocateOpen}
        onClose={() => setIsBulkAllocateOpen(false)}
        unallocatedFines={fines.filter((f) => f.allocation_status === 'UNALLOCATED')}
        onSuccess={() => {
          fetchFines();
          fetchStats();
        }}
      />

      {/* Vehicle 360 Profile Modal */}
      {selectedVehicleId && (
        <Vehicle360ProfileModal
          vehicleId={selectedVehicleId}
          isOpen={!!selectedVehicleId}
          onClose={() => setSelectedVehicleId(null)}
          onRefreshList={() => {
            fetchFines();
            fetchStats();
          }}
        />
      )}

      {/* Employee 360 Profile Modal Drawer */}
      {selectedEmployeeId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full h-[90vh] overflow-y-auto border border-slate-200 p-6 relative">
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
