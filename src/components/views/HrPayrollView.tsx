import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Calendar,
  Check,
  AlertCircle,
  Briefcase,
  Download,
  Filter,
  Search,
  RefreshCw,
  Eye,
  ShieldAlert,
  Sparkles,
  Send,
  Printer,
  FileSpreadsheet,
  ChevronRight,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Building,
  Sliders,
  Award,
  Wallet,
  FileCheck,
  LockOpen,
  Car,
  History,
  Share2,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { EmployeeHR, LeaveRequest, PayrollRecord } from '../../types/erp';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { PayrollImportModal } from '../payroll/PayrollImportModal';
import { AlliedPartnerWorkbookModal } from '../payroll/AlliedPartnerWorkbookModal';
import { PayrollReopenModal } from '../payroll/PayrollReopenModal';
import { PayrollSlipModal } from '../payroll/PayrollSlipModal';

interface HrPayrollViewProps {
  employees?: EmployeeHR[];
  leaveRequests?: LeaveRequest[];
  payrollRecords?: PayrollRecord[];
  onApproveLeave?: (id: string) => void;
  onRejectLeave?: (id: string) => void;
  lang: 'EN' | 'AR';
  initialTab?: 'CYCLES' | 'EXCEPTIONS' | 'BATCHES' | 'SEARCH_SLIP' | 'ADVANCES' | 'STRUCTURES' | 'GRATUITY' | 'LEAVE';
}

export const HrPayrollView: React.FC<HrPayrollViewProps> = ({
  employees = [],
  leaveRequests = [],
  onApproveLeave,
  onRejectLeave,
  lang,
  initialTab = 'CYCLES',
}) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'CYCLES' | 'EXCEPTIONS' | 'BATCHES' | 'SEARCH_SLIP' | 'ADVANCES' | 'STRUCTURES' | 'GRATUITY' | 'LEAVE'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Selected Period
  const [selectedPeriodKey, setSelectedPeriodKey] = useState<string>('2026-09');
  const [periodData, setPeriodData] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [projectSummaries, setProjectSummaries] = useState<any[]>([]);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSalaryGroup, setImportSalaryGroup] = useState<string>('KEETA');
  const [isPartnerWorkbookModalOpen, setIsPartnerWorkbookModalOpen] = useState(false);
  const [selectedBatchForDetails, setSelectedBatchForDetails] = useState<any | null>(null);
  const [isReopenModalOpen, setIsReopenModalOpen] = useState(false);
  const [isReversePayModalOpen, setIsReversePayModalOpen] = useState(false);
  const [reversePayReason, setReversePayReason] = useState('');

  // Single Rider Search & Slip Modal
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecordForSlip, setSelectedRecordForSlip] = useState<any | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // Filter in Records table
  const [filterProject, setFilterProject] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Advance Modal State
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({
    employeeId: '',
    amount: 1500,
    installments: 2,
    reason: 'Personal Emergency',
  });

  // Independent employee directory, not dependent on whether payroll is generated.
  const [advanceDirectory, setAdvanceDirectory] = useState<Array<{ id: string; employee_code: string; full_name: string }>>([]);
  const [advanceEmployeeSearch, setAdvanceEmployeeSearch] = useState('');
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [confirmCancelAdvanceId, setConfirmCancelAdvanceId] = useState<string | null>(null);

  const filteredAdvanceEmployees = useMemo(() => {
    const query = advanceEmployeeSearch.trim().toLowerCase();
    const matches = advanceDirectory.filter((e) =>
      !query || e.full_name.toLowerCase().includes(query) || e.employee_code.toLowerCase().includes(query)
    );
    const selected = advanceDirectory.find((e) => e.id === advanceForm.employeeId);
    return [...(selected ? [selected] : []), ...matches.filter((e) => e.id !== selected?.id)].slice(0, 120);
  }, [advanceDirectory, advanceEmployeeSearch, advanceForm.employeeId]);

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/payroll/employees')
      .then((response) => {
        if (!response.ok) throw new Error('Employee directory unavailable');
        return response.json();
      })
      .then((data) => { if (mounted) setAdvanceDirectory(Array.isArray(data.employees) ? data.employees : []); })
      .catch((err) => { if (mounted) setAdvanceError(String(err?.message || 'Employee lookup failed')); });
    return () => { mounted = false; };
  }, []);

  // Gratuity Calculator State
  const [gratuityForm, setGratuityForm] = useState({
    employeeQuery: 'EMP-10270',
    exitType: 'Resignation',
    result: null as any,
  });

  // Real-time Live Reconciliation Engine
  const liveTotalNet = useMemo(() => {
    return records.reduce((acc, r) => acc + (r.net_salary || 0), 0);
  }, [records]);

  const isReconciled = useMemo(() => {
    if (!periodData) return true;
    const periodNet = periodData.total_net_payable ?? periodData.total_net_salary ?? 0;
    return Math.abs(periodNet - liveTotalNet) < 1;
  }, [periodData, liveTotalNet]);

  // Fetch Payroll Data whenever selectedPeriodKey changes
  const fetchPayrollData = async (periodKey = selectedPeriodKey) => {
    setLoading(true);
    setPayrollError(null);
    try {
      // 1. Periods & Summary
      const res = await fetch('/api/v1/payroll/periods/' + encodeURIComponent(periodKey));
      if (!res.ok) {
        const issue = await res.json().catch(() => ({}));
        throw new Error(issue.error || 'Payroll could not load.');
      }
      const data = await res.json();
      setPeriodData(data.period || null);
      setRecords(Array.isArray(data.records) ? data.records : []);
      setExceptions(Array.isArray(data.exceptions) ? data.exceptions : []);
      const projectsRes = await fetch('/api/v1/payroll/projects?period=' + encodeURIComponent(periodKey));
      if (projectsRes.ok) {
        const projectData = await projectsRes.json();
        setProjectSummaries(Array.isArray(projectData.projects) ? projectData.projects : []);
      } else {
        setProjectSummaries([]);
      }

      // 2. Advances
      const advRes = await fetch('/api/v1/payroll/advances');
      if (advRes.ok) {
        const advData = await advRes.json();
        if (advData.success || Array.isArray(advData.advances) || Array.isArray(advData)) {
          setAdvances(advData.advances || (Array.isArray(advData) ? advData : []));
        }
      }

      // 3. Structures
      const strRes = await fetch('/api/v1/payroll/structures');
      if (strRes.ok) {
        const strData = await strRes.json();
        if (strData.success || Array.isArray(strData.structures) || Array.isArray(strData)) {
          setStructures(strData.structures || (Array.isArray(strData) ? strData : []));
        }
      }

      // 4. Batches (Standard CSV + Partner Multi-Sheet Workbooks)
      const bRes = await fetch('/api/v1/payroll/import/batches');
      const bData = await bRes.json();
      const pwRes = await fetch('/api/v1/payroll/partner-workbook/batches');
      const pwData = await pwRes.json();

      const combinedBatches: any[] = [];
      if (bData.success && Array.isArray(bData.batches)) {
        combinedBatches.push(...bData.batches);
      }
      if (pwData.success && Array.isArray(pwData.batches)) {
        combinedBatches.push(...pwData.batches.map((pb: any) => ({
          ...pb,
          is_partner_workbook: true,
          salary_structure_type: pb.profile_id || 'ALLIED_DELIVERY_PARTNER_PAYOUT_V1',
          source_file: pb.file_name,
        })));
      }
      setBatches(combinedBatches);
    } catch (err: any) {
      console.error('Error fetching payroll data:', err);
      setPayrollError(String(err?.message || 'Payroll request failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollData(selectedPeriodKey);
  }, [selectedPeriodKey]);

  // Handler: Run / Recalculate Payroll
  const handleGeneratePayroll = async () => {
    setLoading(true);
    try {
      const [yearStr, monthStr] = selectedPeriodKey.split('-');
      const res = await fetch('/api/v1/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(yearStr, 10),
          month: parseInt(monthStr, 10),
          tenantId: 'company_pixel_syntax',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success || data.period) {
          setActionSuccessMsg(`Payroll calculation generated successfully for ${data.period?.period_month || selectedPeriodKey}!`);
          setPeriodData(data.period);
          setRecords(data.records || []);
          setExceptions(data.exceptions || []);
          setTimeout(() => setActionSuccessMsg(null), 5000);
        }
      }
    } catch (err) {
      console.error('Error generating payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Approve Payroll
  const handleApprovePayroll = async () => {
    if (!periodData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/payroll/periods/${periodData.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'company_pixel_syntax' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success || data.period) {
          setActionSuccessMsg(`Period ${periodData.period_month} officially APPROVED for disbursement.`);
          fetchPayrollData();
          setTimeout(() => setActionSuccessMsg(null), 5000);
        }
      }
    } catch (err) {
      console.error('Error approving payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Disburse / Pay Payroll
  const handlePayPayroll = async () => {
    if (!periodData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/payroll/periods/${periodData.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: `PAY-BANK-${Date.now()}` }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success || data.period) {
          setActionSuccessMsg(`Payroll marked as PAID & Bank Transfer Disbursed!`);
          fetchPayrollData();
          setTimeout(() => setActionSuccessMsg(null), 5000);
        }
      }
    } catch (err) {
      console.error('Error paying payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Publish to Employee Portal
  const handlePublishPayroll = async () => {
    if (!periodData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/payroll/periods/${periodData.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(`Period ${periodData.period_month} published to Employee & Rider Portal.`);
        fetchPayrollData();
        setTimeout(() => setActionSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('Error publishing payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler: Reverse Payment (Audit flow)
  const handleReversePayment = async () => {
    if (!periodData) return;
    if (!reversePayReason || reversePayReason.trim().length < 5) {
      alert('A valid reason (minimum 5 characters) is required to reverse payment.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/payroll/periods/${periodData.id}/reverse-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reversePayReason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIsReversePayModalOpen(false);
        setReversePayReason('');
        setActionSuccessMsg(`Payment reversed for ${periodData.period_month}. Restored to APPROVED status.`);
        fetchPayrollData();
        setTimeout(() => setActionSuccessMsg(null), 5000);
      }
    } catch (err) {
      console.error('Error reversing payment:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handler: New Advance
  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setAdvanceError(null);
      const res = await fetch(editingAdvanceId ? '/api/v1/payroll/advances/' + encodeURIComponent(editingAdvanceId) : '/api/v1/payroll/advances', {
        method: editingAdvanceId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advanceForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAdvanceError(data.error || 'Could not save advance.');
        return;
      }
      setIsAdvanceModalOpen(false);
      setEditingAdvanceId(null);
      setActionSuccessMsg(`DEMO advance record of AED ${advanceForm.amount} saved. No cash was transferred.`);
      fetchPayrollData();
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error saving advance:', err);
      setAdvanceError('Unable to save advance. Check your connection.');
    }
  };

  const handleCancelAdvance = async (id: string) => {
    try {
      const res = await fetch('/api/v1/payroll/advances/' + encodeURIComponent(id), { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not cancel advance');
      setConfirmCancelAdvanceId(null);
      setActionSuccessMsg('DEMO advance cancelled; the original ledger entry is preserved.');
      fetchPayrollData();
    } catch (err: any) {
      setAdvanceError(String(err?.message || 'Could not cancel advance'));
    }
  };

  // Handler: Calculate Gratuity
  const handleCalculateGratuity = async () => {
    try {
      const res = await fetch(`/api/v1/payroll/final-settlement?query=${encodeURIComponent(gratuityForm.employeeQuery)}&exitType=${gratuityForm.exitType}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.settlement) {
          setGratuityForm((prev) => ({ ...prev, result: data.settlement }));
        }
      }
    } catch (err) {
      console.error('Error calculating gratuity:', err);
    }
  };

  // Download Salary Sheet CSV
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Employee Code', 'Employee Name', 'Project', 'Base Salary', 'Commission', 'Overtime', 'Allowances', 'Fines', 'Advances', 'Net Salary', 'IBAN', 'Status'];
    const rows = records.map((r) => [
      r.employee_code,
      `"${r.employee_name}"`,
      r.project_name || 'Fleet Core',
      r.calculated_base_salary,
      r.calculated_deliveries_commission,
      r.overtime_pay,
      r.allowances_total,
      r.penalties_total,
      r.advance_deduction,
      r.net_salary,
      r.iban || 'N/A',
      r.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Payroll_Sheet_${selectedPeriodKey}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtering changes monetary attribution, not only the visible riders.
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const query = searchTerm.trim().toLowerCase();
      const matchSearch = !query ||
        String(r.employee_name || '').toLowerCase().includes(query) ||
        String(r.employee_code || '').toLowerCase().includes(query) ||
        (r.project_salary_lines || []).some((line: any) =>
          String(line.external_rider_id || '').toLowerCase().includes(query));
      const matchesProject = filterProject === 'ALL' ||
        (r.project_salary_lines || []).some((line: any) => line.project_name === filterProject) ||
        (!r.project_salary_lines?.length && r.project_name === filterProject);
      const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
      return matchSearch && matchesProject && matchesStatus;
    }).map((r: any) => {
      if (filterProject === 'ALL') return r;
      const projectLines = (r.project_salary_lines || []).filter((line: any) => line.project_name === filterProject);
      if (!projectLines.length) return r;
      const sum = (key: string) => Math.round(projectLines.reduce(
        (total: number, line: any) => total + Number(line[key] || 0), 0) * 100) / 100;
      return {
        ...r,
        original_monthly_net_salary: r.net_salary,
        project_name: filterProject,
        project_salary_lines: projectLines,
        calculated_base_salary: sum('base_salary_aed'),
        calculated_deliveries_commission: sum('commission_aed'),
        allowances_total: sum('tips_aed') + sum('incentives_aed'),
        traffic_fines_deduction: sum('deductions_aed'),
        penalties_total: sum('deductions_aed'),
        days_worked: sum('days_worked'),
        deliveries_count: sum('deliveries_count'),
        net_salary: sum('net_payable_aed'),
        is_project_filtered: true,
      };
    });
  }, [records, searchTerm, filterProject, filterStatus]);

  const projectList = useMemo(() => Array.from(
    new Set(projectSummaries.map((project) => String(project.project_name)))
  ).sort((a, b) => a.localeCompare(b)), [projectSummaries]);

  // Direct download for official Keeta Excel template
  const handleDownloadKeetaTemplate = async () => {
    try {
      const res = await fetch(`/api/v1/payroll/templates/keeta?month=${encodeURIComponent(selectedPeriodKey)}`);
      if (!res.ok) throw new Error('Failed to download Keeta template');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'KEETA_Payroll_Template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading Keeta template:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification Toast */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {payrollError && (
        <div role="alert" className="p-4 border border-rose-200 rounded-xl bg-rose-50 text-rose-800 text-xs">{payrollError}</div>
      )}
      {/* Main Top Header: Section 1 Compliance */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Payroll
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Monthly project payroll processing and employee salary history
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
          DEMO MODE — Salary records and slips are for testing only. No bank or WPS payments are sent.
        </p>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 border border-slate-200 dark:border-slate-700">
            <Calendar className="w-4 h-4 text-slate-500 ml-2.5 mr-1" />
            <select
              value={selectedPeriodKey}
              onChange={(e) => setSelectedPeriodKey(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 py-1.5 px-2 rounded-xl focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 15 }, (_, i) => {
                const date = new Date();
                date.setDate(1);
                date.setMonth(date.getMonth() - i);
                const key = String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0');
                return <option key={key} value={key}>{date.toLocaleDateString('en-AE', { month: 'long', year: 'numeric' })}</option>;
              })}
            </select>
          </div>

          {/* Primary Action: + New Payroll Import */}
          <button
            onClick={() => {
              setImportSalaryGroup('KEETA');
              setIsImportModalOpen(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Payroll Import</span>
          </button>

          {/* Secondary Action: Import History */}
          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              activeTab === 'BATCHES'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <History className="w-4 h-4 text-slate-500" />
            <span>Import History</span>
          </button>

          {/* Recalculate Period */}
          <button
            onClick={handleGeneratePayroll}
            disabled={loading}
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold rounded-2xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
            title="Recalculate deductions & fine ledgers for period"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Recalculate</span>
          </button>

          {/* WPS SIF Export */}
          <button type="button" disabled title="WPS file export requires bank format verification"
            className="px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl text-xs font-bold flex items-center gap-2 border border-slate-200 dark:border-slate-700 cursor-not-allowed">
            <Download className="w-4 h-4" />
            <span>WPS SIF — Unavailable</span>
          </button>
        </div>
      </div>

      {/* Compact Live Metrics Strip (Section 1: 4 Live Metrics, No Fake/Default Values) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Current Month Batches */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Current Month Batches
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
              {batches.filter((b) => (b.target_period_month || b.payroll_month) === selectedPeriodKey).length}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {batches.length} total batches in system
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-2xl">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Matched Employees */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Matched Employees
            </span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {records.filter((r) => r.status === 'READY' || r.status === 'CALCULATED' || r.status === 'APPROVED' || r.status === 'PAID').length}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {records.length} total employees evaluated
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Pending Review */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Pending Review
            </span>
            <div className={`text-2xl font-black mt-1 ${exceptions.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {exceptions.length}
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {exceptions.length === 0 ? '0 blocking review items' : 'Requires exception resolution'}
            </span>
          </div>
          <div className={`p-3 rounded-2xl ${exceptions.length > 0 ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Published Net Payable */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Published Net Payable
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-white mt-1">
              {periodData?.status === 'PUBLISHED' || periodData?.status === 'PAID'
                ? `AED ${(periodData?.total_net_payable || periodData?.total_net_salary || liveTotalNet).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'AED 0.00'}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${periodData?.status === 'PUBLISHED' || periodData?.status === 'PAID' ? 'bg-emerald-500' : periodData?.status === 'APPROVED' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">
                {periodData?.status === 'PUBLISHED' ? 'Published' : periodData?.status === 'PAID' ? 'Paid / Disbursed' : periodData?.status === 'APPROVED' ? 'Approved (Unpublished)' : 'Draft (Unpublished)'}
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('CYCLES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'CYCLES'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          {lang === 'EN' ? 'Payroll Register' : 'كشف الرواتب'} ({records.length})
        </button>

        <button
          onClick={() => setActiveTab('EXCEPTIONS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'EXCEPTIONS'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          {lang === 'EN' ? 'Exception Review Center' : 'مركز مراجعة الاستثناءات'}
          {exceptions.length > 0 && (
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${activeTab === 'EXCEPTIONS' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-800'}`}>
              {exceptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('BATCHES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'BATCHES'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          {lang === 'EN' ? 'Import Batches' : 'دفعات الاستيراد'} ({batches.length})
        </button>

        <button
          onClick={() => setActiveTab('ADVANCES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'ADVANCES'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4" />
          {lang === 'EN' ? 'Advances & Loans Ledger' : 'سجل السلف والقروض'} ({advances.length})
        </button>

        <button
          onClick={() => setActiveTab('STRUCTURES')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'STRUCTURES'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          {lang === 'EN' ? 'Salary Packages & Structures' : 'هيكل الرواتب والعمولات'}
        </button>

        <button
          onClick={() => setActiveTab('GRATUITY')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'GRATUITY'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          {lang === 'EN' ? 'UAE Gratuity / Settlement' : 'مكافأة نهاية الخدمة'}
        </button>

        <button
          onClick={() => setActiveTab('LEAVE')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'LEAVE'
              ? 'bg-slate-800 text-white shadow-md'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          {lang === 'EN' ? 'Leave Approvals' : 'اعتمادات الإجازات'} ({leaveRequests.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PAYROLL REGISTER (MAIN WORKFLOW) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'CYCLES' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder={lang === 'EN' ? 'Search rider name, code, IBAN...' : 'بحث بالاسم، الكود، الآيبان...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Projects</option>
                {projectList.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="CALCULATED">Calculated</option>
                <option value="APPROVED">Approved</option>
                <option value="PAID">Paid</option>
                <option value="ON_HOLD">On Hold</option>
              </select>
            </div>
          </div>

          {/* Keeta Dedicated Action Strip when Keeta is selected */}
          {filterProject.toLowerCase().includes('keeta') && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                    Keeta Express Delivery Profile ({selectedPeriodKey})
                  </h4>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Official 14-column Keeta layout with pre-populated active couriers, Courier ID resolution, itemized deductions, and signed incentive adjustments.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDownloadKeetaTemplate}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-slate-800 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  Download Keeta Template
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportSalaryGroup('KEETA');
                    setIsImportModalOpen(true);
                  }}
                  className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Keeta Salary Sheet
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="p-3">Rider / Employee</th>
                  <th className="p-3">Project & Plan</th>
                  <th className="p-3 text-right">Base Salary</th>
                  <th className="p-3 text-right">Commission & Drops</th>
                  <th className="p-3 text-right">Overtime & Allow.</th>
                  <th className="p-3 text-right">Traffic Fines</th>
                  <th className="p-3 text-right">Salik Tolls</th>
                  <th className="p-3 text-right">Advances</th>
                  <th className="p-3 text-right">Net Payable</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Salary Slip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRecords.map((rec) => {
                  const fines = rec.traffic_fines_deduction ?? rec.penalties_total ?? 0;
                  const salik = rec.salik_deduction ?? 0;
                  const adv = rec.advance_deduction ?? 0;
                  return (
                    <tr key={rec.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {rec.employee_name}
                          {rec.is_exception && (
                            <span title={rec.exception_notes} className="inline-block w-2 h-2 rounded-full bg-rose-500" />
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 block">{rec.employee_code}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">{rec.project_name || 'Fleet Hub'}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{rec.salary_structure_type || 'STANDARD'}</span>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                        AED {rec.calculated_base_salary?.toLocaleString()}
                        <span className="block text-[10px] text-slate-400">{rec.days_worked || 30} days</span>
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        +AED {rec.calculated_deliveries_commission?.toLocaleString()}
                        <span className="block text-[10px] text-slate-400">{rec.deliveries_count || 0} orders</span>
                      </td>
                      <td className="p-3 text-right font-mono text-blue-600 dark:text-blue-400">
                        +AED {(rec.overtime_pay + rec.allowances_total)?.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-500 font-medium">
                        {fines > 0 ? `-AED ${fines.toLocaleString()}` : <span className="text-slate-300 dark:text-slate-600">0</span>}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-600 font-medium">
                        {salik > 0 ? `-AED ${salik.toLocaleString()}` : <span className="text-slate-300 dark:text-slate-600">0</span>}
                      </td>
                      <td className="p-3 text-right font-mono text-indigo-500 font-medium">
                        {adv > 0 ? `-AED ${adv.toLocaleString()}` : <span className="text-slate-300 dark:text-slate-600">0</span>}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white text-sm">
                        AED {rec.net_salary?.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={rec.status === 'PAID' ? 'success' : rec.status === 'APPROVED' ? 'info' : rec.status === 'ON_HOLD' ? 'danger' : 'warning'}>
                          {rec.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedRecordForSlip(rec);
                            setIsSlipModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-600 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Slip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold bg-slate-50/80 dark:bg-slate-850/80 text-xs">
                  <td colSpan={2} className="p-3 text-slate-800 dark:text-slate-200">
                    Total ({filteredRecords.length} Employees)
                  </td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">
                    AED {filteredRecords.reduce((acc, r) => acc + (r.calculated_base_salary || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-600">
                    +AED {filteredRecords.reduce((acc, r) => acc + (r.calculated_deliveries_commission || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-blue-600">
                    +AED {filteredRecords.reduce((acc, r) => acc + ((r.overtime_pay || 0) + (r.allowances_total || 0)), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-rose-500">
                    -AED {filteredRecords.reduce((acc, r) => acc + (r.traffic_fines_deduction || r.penalties_total || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-amber-600">
                    -AED {filteredRecords.reduce((acc, r) => acc + (r.salik_deduction || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-500">
                    -AED {filteredRecords.reduce((acc, r) => acc + (r.advance_deduction || 0), 0).toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                    AED {filteredRecords.reduce((acc, r) => acc + (r.net_salary || 0), 0).toLocaleString()}
                  </td>
                  <td colSpan={2} className="p-3 text-center">
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">
                      {isReconciled ? '✓ Live Reconciled' : 'Discrepancy'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: EXCEPTION REVIEW CENTER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'EXCEPTIONS' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                {lang === 'EN' ? 'Exception-Based Review Dashboard' : 'لوحة مراجعة استثناءات الرواتب'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'EN'
                  ? 'Only records with missing bank IBANs, negative net salaries, or high penalties are flagged for human review. Clean records are auto-approved.'
                  : 'تنبيهات تلقائية للحالات التي تحتاج تدقيق بشري مثل نقص بيانات الآيبان أو الخصومات المرتفعة.'}
              </p>
            </div>
            <Badge variant="warning">{exceptions.length} Exceptions Requiring Attention</Badge>
          </div>

          {exceptions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h4 className="text-sm font-black text-slate-900 dark:text-white">All Records Clean & Verified</h4>
              <p className="text-xs text-slate-500 mt-1">Zero negative salaries or missing banking parameters detected in this period.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exceptions.map((ex, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-extrabold text-slate-900 dark:text-white text-sm block">
                        {ex.employee_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">{ex.employee_code}</span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {ex.exception_type}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/40">
                    {ex.details}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-900 dark:text-white">
                      Calculated Net: AED {ex.net_salary?.toLocaleString()}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const targetRec = records.find((r) => r.employee_id === ex.employee_id);
                          if (targetRec) {
                            setSelectedRecordForSlip(targetRec);
                            setIsSlipModalOpen(true);
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                      >
                        Inspect & Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB: IMPORT BATCHES & AUDIT HISTORY */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'BATCHES' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <History className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                {lang === 'EN' ? 'Spreadsheet Import Batches & Audit Trail' : 'دفعات الاستيراد وسجل التدقيق'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'EN'
                  ? 'Historical log of all external compensation files, staging previews, validation errors, and committed salary records.'
                  : 'سجل تدقيق كامل لكافة ملفات الرواتب المستوردة، التحقق، وتثبيت السجلات في قاعدة البيانات.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setImportSalaryGroup('KEETA');
                  setIsImportModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Import Keeta (.xlsx)</span>
              </button>

              <button
                onClick={() => {
                  setImportSalaryGroup('NOON');
                  setIsImportModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-bold flex items-center gap-1.5 border border-amber-200 dark:border-amber-800/80 transition-colors"
              >
                <Upload className="w-4 h-4 text-amber-600" />
                <span>Import Noon / CSV</span>
              </button>

              <button
                onClick={() => setIsPartnerWorkbookModalOpen(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Upload Partner Workbook (Allied V1)</span>
              </button>
            </div>
          </div>

          {batches.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-slate-50 dark:bg-slate-850/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Import Batches Yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Upload your external contractor or third-party payroll spreadsheet to preview validations, map columns, and commit records directly into the cycle.
              </p>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
              >
                Launch Import Wizard
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="p-3">Batch ID & Source</th>
                    <th className="p-3">Target Month</th>
                    <th className="p-3">Salary Group</th>
                    <th className="p-3 text-right">Rows Count</th>
                    <th className="p-3 text-right">Errors</th>
                    <th className="p-3 text-center">Batch Status</th>
                    <th className="p-3 text-right">Committed Date</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                      <td className="p-3">
                        <span className="font-mono font-bold text-slate-900 dark:text-white block">{b.id}</span>
                        <span className="text-[10px] text-slate-400 block">{b.source_file || 'Direct Spreadsheet Upload'}</span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                        {b.target_period_month || selectedPeriodKey}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {b.salary_structure_type || 'STANDARD_RIDER'}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {b.total_rows || 0}
                      </td>
                      <td className="p-3 text-right font-mono text-rose-500 font-bold">
                        {b.error_count || 0}
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant={b.status === 'COMMITTED' ? 'success' : b.status === 'FAILED' ? 'danger' : 'neutral'}>
                          {b.status || 'COMMITTED'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {b.committed_at ? new Date(b.committed_at).toLocaleString() : new Date().toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedBatchForDetails(b)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: ADVANCES & LOANS LEDGER */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ADVANCES' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-600" />
                {lang === 'EN' ? 'Employee Cash Advances & Loans' : 'سجل السلف والقروض المالية'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'EN'
                  ? 'Track cash advance requests, approved amounts, monthly installment deductions, and remaining debt.'
                  : 'متابعة السلف النقدية، المبالغ المعتمدة، الخصم الشهري التلقائي من الراتب، والرصيد المتبقي.'}
              </p>
            </div>

            <button
              onClick={() => {
                setEditingAdvanceId(null);
                setAdvanceEmployeeSearch('');
                setAdvanceError(null);
                setAdvanceForm({ employeeId: '', amount: 1500, installments: 2, reason: 'Demo advance' });
                setIsAdvanceModalOpen(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Plus className="w-4 h-4" />
              {lang === 'EN' ? 'Record Demo Advance' : 'تسجيل سلفة تجريبية'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="p-3">Employee</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Principal Amount</th>
                  <th className="p-3 text-right">Monthly Installment</th>
                  <th className="p-3 text-right">Remaining Balance</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Recorded Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {advances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-bold text-slate-900 dark:text-white">{adv.employee_name}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{adv.reason}</td>
                    <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">AED {adv.amount?.toLocaleString()}</td>
                    <td className="p-3 text-right font-mono text-blue-600">AED {adv.monthly_deduction?.toLocaleString()} / mo</td>
                    <td className="p-3 text-right font-mono font-black text-rose-600">AED {adv.remaining_amount?.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <Badge variant={adv.status === 'ACTIVE' ? 'info' : 'success'}>{adv.status}</Badge>
                    </td>
                    <td className="p-3 text-right font-mono text-slate-400">{adv.registered_date}</td>
                    <td className="p-3 text-right">
                      {adv.status === 'ACTIVE' && (
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" className="px-2 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-bold"
                            onClick={() => {
                              setEditingAdvanceId(adv.id);
                              setAdvanceEmployeeSearch(adv.employee_name || '');
                              setAdvanceError(null);
                              setAdvanceForm({
                                employeeId: adv.employeeId || adv.employee_id,
                                amount: Number(adv.amount || 0),
                                installments: Number(adv.installments || 1),
                                reason: adv.reason || '',
                              });
                              setIsAdvanceModalOpen(true);
                            }}>Edit</button>
                          <button type="button" className="px-2 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold"
                            onClick={() => {
                              if (confirmCancelAdvanceId === adv.id) {
                                handleCancelAdvance(adv.id);
                              } else setConfirmCancelAdvanceId(adv.id);
                            }}>{confirmCancelAdvanceId === adv.id ? 'Confirm cancel' : 'Cancel'}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: SALARY PACKAGES & STRUCTURES */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'STRUCTURES' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-600" />
                {lang === 'EN' ? 'Salary Packages & Commission Models' : 'باقات وهياكل الرواتب والعمولات'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'EN'
                  ? 'Define contract tiers: Fixed Base Salary, Per-Delivery Commission Rates, Fuel/SIM Allowances, and Target Bonuses.'
                  : 'تحديد الباقات: راتب ثابت، عمولة بالطلب (Deliveroo/Talabat/Noon)، بدلات الوقود والمكالمات، وحوافز الإنجاز.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {structures.map((st) => (
              <div
                key={st.id}
                className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">{st.name}</span>
                  <Badge variant={st.is_default ? 'success' : 'neutral'}>
                    {st.is_default ? 'Default' : st.structure_type}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs divide-y divide-slate-200/60 dark:divide-slate-800">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Base Salary</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">AED {st.base_salary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Rate Per Order</span>
                    <span className="font-bold text-emerald-600">AED {st.rate_per_order} / order</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Mobile & Fuel Allowances</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">AED {st.allowance_mobile + st.allowance_fuel}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-500">Monthly Target</span>
                    <span className="font-bold text-blue-600">{st.monthly_target_orders || 'N/A'} orders</span>
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  {st.description || 'Standard fleet compensation model.'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 5: UAE GRATUITY & END OF SERVICE */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'GRATUITY' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-600" />
                {lang === 'EN' ? 'UAE Labour Law Gratuity & Final Settlement Calculator' : 'حاسبة مكافأة نهاية الخدمة والتسوية النهائية'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'EN'
                  ? 'Automated calculation of end-of-service benefits based on UAE Federal Decree-Law No. 33 of 2021.'
                  : 'احتساب مكافأة نهاية الخدمة وبدل الإجازات غير المستخدمة والخصومات وفقاً لقانون العمل الإماراتي.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Form */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Employee & Separation Details
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Employee Code / Name
                </label>
                <input
                  type="text"
                  value={gratuityForm.employeeQuery}
                  onChange={(e) => setGratuityForm((prev) => ({ ...prev, employeeQuery: e.target.value }))}
                  placeholder="e.g. EMP-10270 or Tariq Mahmood"
                  className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Separation Type
                </label>
                <select
                  value={gratuityForm.exitType}
                  onChange={(e) => setGratuityForm((prev) => ({ ...prev, exitType: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Resignation">Employee Resignation (استقالة)</option>
                  <option value="Termination">Company Termination (إنهاء خدمة)</option>
                  <option value="ContractEnd">Contract Completion (انتهاء عقد)</option>
                </select>
              </div>

              <button
                onClick={handleCalculateGratuity}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Sparkles className="w-4 h-4" /> Calculate UAE Final Settlement
              </button>
            </div>

            {/* Results Display */}
            {gratuityForm.result ? (
              <div className="p-6 rounded-3xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/60 space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-indigo-950 dark:text-indigo-200">
                      {gratuityForm.result.employeeName}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      Service Tenure: {gratuityForm.result.yearsOfService} Years ({gratuityForm.result.joinDate} → {gratuityForm.result.lastWorkingDay})
                    </span>
                  </div>
                  <Badge variant="info">UAE Law Compliant</Badge>
                </div>

                <div className="space-y-2 text-xs divide-y divide-indigo-100 dark:divide-indigo-900/40">
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-600 dark:text-slate-300">Basic Salary Benchmark</span>
                    <span className="font-bold">AED {gratuityForm.result.basicSalary?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-600 dark:text-slate-300">Gratuity Entitlement Pay</span>
                    <span className="font-bold text-emerald-600">+ AED {gratuityForm.result.gratuityAmount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-600 dark:text-slate-300">Unused Leave Encashment</span>
                    <span className="font-bold text-blue-600">+ AED {gratuityForm.result.leaveEncashment?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-slate-600 dark:text-slate-300">Outstanding Advances / Fines</span>
                    <span className="font-bold text-rose-600">- AED {gratuityForm.result.deductions?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-3 font-black text-sm bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl">
                    <span className="text-indigo-900 dark:text-indigo-300">Net Settlement Payable</span>
                    <span className="text-indigo-700 dark:text-indigo-400">AED {gratuityForm.result.netSettlement?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                <Award className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2" />
                <span className="text-xs font-bold text-slate-500">Enter employee and click Calculate</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 6: LEAVE APPROVALS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'LEAVE' && (
        <div className="space-y-3">
          {leaveRequests.map((req) => (
            <div
              key={req.id}
              className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">{req.employeeName}</h3>
                  <Badge variant={req.leaveType === 'ANNUAL' ? 'info' : 'warning'}>{req.leaveType} LEAVE</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">{req.reason}</p>
                <div className="flex items-center gap-4 text-xs font-mono text-slate-400 mt-2">
                  <span>From: {req.startDate} → To: {req.endDate}</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{req.totalDays} Total Days</span>
                </div>
              </div>

              {req.status === 'PENDING' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onRejectLeave && onRejectLeave(req.id)}
                    className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold rounded-2xl text-xs transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => onApproveLeave && onApproveLeave(req.id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs transition-colors flex items-center gap-1 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Approve Leave
                  </button>
                </div>
              ) : (
                <Badge variant={req.status === 'APPROVED' ? 'success' : 'danger'}>{req.status}</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: SINGLE RIDER SALARY SLIP (PRINTABLE & ITEMISED VIEW) */}
      {/* ------------------------------------------------------------- */}
      <PayrollSlipModal
        isOpen={isSlipModalOpen}
        onClose={() => setIsSlipModalOpen(false)}
        record={selectedRecordForSlip}
        periodKey={selectedPeriodKey}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: TWO-LEVEL CSV / SPREADSHEET IMPORT WIZARD */}
      {/* ------------------------------------------------------------- */}
      <PayrollImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        initialSalaryGroup={importSalaryGroup}
        onImportSuccess={() => {
          fetchPayrollData();
          setActiveTab('CYCLES');
        }}
        defaultPeriodMonth={selectedPeriodKey}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ALLIED PARTNER PAYOUT WORKBOOK IMPORT (V1 ENGINE) */}
      {/* ------------------------------------------------------------- */}
      <AlliedPartnerWorkbookModal
        isOpen={isPartnerWorkbookModalOpen}
        onClose={() => setIsPartnerWorkbookModalOpen(false)}
        periodKey={selectedPeriodKey}
        onImportSuccess={(msg) => {
          setActionSuccessMsg(msg);
          fetchPayrollData(selectedPeriodKey);
          setActiveTab('CYCLES');
          setTimeout(() => setActionSuccessMsg(null), 5000);
        }}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: AUDIT-CONTROLLED PERIOD REOPEN / UNLOCK */}
      {/* ------------------------------------------------------------- */}
      <PayrollReopenModal
        isOpen={isReopenModalOpen}
        onClose={() => setIsReopenModalOpen(false)}
        onReopenSuccess={() => {
          fetchPayrollData();
        }}
        period={periodData}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: AUDITED REVERSE PAYMENT */}
      {/* ------------------------------------------------------------- */}
      {isReversePayModalOpen && periodData && (
        <Modal
          isOpen={isReversePayModalOpen}
          onClose={() => setIsReversePayModalOpen(false)}
          title={`Reverse Paid Status - ${periodData.period_month}`}
        >
          <div className="space-y-4 text-xs text-slate-900 dark:text-white">
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-rose-800 dark:text-rose-300">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <span className="font-bold block">Audited Payment Rollback</span>
                This will revert the status of period <strong className="font-mono">{periodData.period_month}</strong> from PAID back to APPROVED, logging a reversal transaction in the system ledger.
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason for Payment Reversal (Required, min 5 chars)
              </label>
              <textarea
                value={reversePayReason}
                onChange={(e) => setReversePayReason(e.target.value)}
                placeholder="e.g., Bank file rejected due to branch IBAN format; correcting batch..."
                rows={3}
                className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReversePayment}
                disabled={!reversePayReason || reversePayReason.trim().length < 5 || loading}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-md shadow-rose-600/20"
              >
                {loading ? 'Reversing...' : 'Confirm Reversal'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsReversePayModalOpen(false);
                  setReversePayReason('');
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: GRANT CASH ADVANCE */}
      {/* ------------------------------------------------------------- */}
      {isAdvanceModalOpen && (
        <Modal
          isOpen={isAdvanceModalOpen}
          onClose={() => setIsAdvanceModalOpen(false)}
          title={editingAdvanceId ? 'Edit Demo Advance' : 'Register Demo Advance'}
        >
          <form onSubmit={handleCreateAdvance} className="space-y-4 text-slate-900 dark:text-white">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Rider / Employee
              </label>
              <input type="search" value={advanceEmployeeSearch} disabled={Boolean(editingAdvanceId)}
                onChange={(e) => setAdvanceEmployeeSearch(e.target.value)}
                placeholder="Search by name or employee code..."
                className="w-full mb-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base sm:text-xs" />
              <select
                value={advanceForm.employeeId}
                onChange={(e) => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })}
                required
                disabled={Boolean(editingAdvanceId)}
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base sm:text-xs font-semibold"
              >
                <option value="">Choose Employee...</option>
                {filteredAdvanceEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
                ))}
              </select>
              {advanceDirectory.length > 120 && <p className="text-[11px] text-slate-500 mt-1">Search to narrow the full employee directory ({advanceDirectory.length} employees).</p>}
              {advanceError && <p role="alert" className="text-xs text-red-600 mt-1">{advanceError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Amount (AED)
                </label>
                <input
                  type="number"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: parseFloat(e.target.value) || 0 })}
                  required
                  min="100"
                  max="10000"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Installments (Months)
                </label>
                <input
                  type="number"
                  value={advanceForm.installments}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, installments: parseInt(e.target.value, 10) || 1 })}
                  required
                  min="1"
                  max="12"
                  className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Memo
              </label>
              <input
                type="text"
                value={advanceForm.reason}
                onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
              />
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-2xl border border-blue-200 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200">
              Planned installment: <span className="font-black">AED {Math.round(advanceForm.amount / (advanceForm.installments || 1))} / month</span>. This is a demo ledger entry only; automatic payroll deductions and actual cash disbursement are not enabled yet.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-blue-600/20"
              >
                {editingAdvanceId ? 'Save Advance Changes' : 'Save Demo Advance Record'}
              </button>
              <button
                type="button"
                onClick={() => setIsAdvanceModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold"
              >
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: BATCH DETAILS & AUDIT INSPECTION */}
      {/* ------------------------------------------------------------- */}
      {selectedBatchForDetails && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedBatchForDetails(null)}
          title={`Batch Audit Record: ${selectedBatchForDetails.id}`}
        >
          <div className="space-y-4 text-xs text-slate-800 dark:text-slate-200 max-w-lg">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Month</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedBatchForDetails.target_period_month || selectedPeriodKey}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Salary Group</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  {selectedBatchForDetails.salary_structure_type || 'STANDARD_RIDER'}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Source Workbook</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 truncate block">
                  {selectedBatchForDetails.source_file || 'Direct Spreadsheet Upload'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Rows</span>
                <span className="font-black text-slate-900 dark:text-white text-base">
                  {selectedBatchForDetails.total_rows || 0}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Errors / Unresolved</span>
                <span className="font-black text-rose-600 text-base">
                  {selectedBatchForDetails.error_count || 0}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                Committed on {selectedBatchForDetails.committed_at ? new Date(selectedBatchForDetails.committed_at).toLocaleString() : 'N/A'}. All matched rider salary lines are recorded in the active ledger.
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBatchForDetails(null)}
                className="px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
