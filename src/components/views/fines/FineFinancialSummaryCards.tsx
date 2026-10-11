import React, { useState } from 'react';
import {
  DollarSign,
  UserCheck,
  HelpCircle,
  Building2,
  User,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { FineFinancialStats } from '../../../types/trafficFines';

interface FineFinancialSummaryCardsProps {
  stats: FineFinancialStats | null;
  loading?: boolean;
}

export const FineFinancialSummaryCards: React.FC<FineFinancialSummaryCardsProps> = ({
  stats,
  loading = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const formatCurrency = (val?: number) => {
    if (val === undefined || isNaN(val)) return '0.00';
    return Number(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const totalAmt = stats?.totalFineAmount ?? 0;
  const allocatedAmt = stats?.allocatedAmount ?? 0;
  const unallocatedAmt = stats?.unallocatedAmount ?? 0;
  const companyLiab = stats?.companyLiability ?? 0;
  const employeeLiab = stats?.employeeLiability ?? 0;
  const outstandingBal = stats?.outstandingBalance ?? 0;

  const companyPaid = stats?.companyPaid ?? 0;
  const employeePaid = stats?.employeePaid ?? 0;
  const settledAmt = stats?.settledAmount ?? 0;
  const unsettledAmt = stats?.unsettledAmount ?? 0;

  return (
    <div className="space-y-3" id="traffic-fines-summary-container">
      {/* 6 Primary Financial KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Fine Amount */}
        <div
          id="kpi-total-fine-amount"
          className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Total Fines</span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(totalAmt)}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
            <span>{stats?.totalCount ?? 0} total tickets</span>
          </div>
        </div>

        {/* Allocated Amount */}
        <div
          id="kpi-allocated-amount"
          className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Allocated</span>
            <div className="p-1 rounded bg-emerald-50 text-emerald-600">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-700 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(allocatedAmt)}`}
          </div>
          <div className="text-[11px] text-emerald-600 mt-0.5">
            <span>{stats?.allocatedCount ?? 0} assigned fines</span>
          </div>
        </div>

        {/* Unallocated Amount */}
        <div
          id="kpi-unallocated-amount"
          className="bg-white border border-amber-200 bg-amber-50/20 rounded-lg p-3.5 shadow-sm transition-all hover:border-amber-300"
        >
          <div className="flex items-center justify-between text-amber-700 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Unallocated</span>
            <div className="p-1 rounded bg-amber-100 text-amber-700">
              <HelpCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-amber-700 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(unallocatedAmt)}`}
          </div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            <span>{stats?.unallocatedCount ?? 0} require review</span>
          </div>
        </div>

        {/* Company Liability */}
        <div
          id="kpi-company-liability"
          className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider">Company Liability</span>
            <div className="p-1 rounded bg-slate-100 text-slate-700">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-800 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(companyLiab)}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <span>Fleet / passing defects</span>
          </div>
        </div>

        {/* Employee Liability */}
        <div
          id="kpi-employee-liability"
          className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-sm transition-all hover:border-slate-300"
        >
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Employee Liability</span>
            <div className="p-1 rounded bg-indigo-50 text-indigo-600">
              <User className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-indigo-700 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(employeeLiab)}`}
          </div>
          <div className="text-[11px] text-indigo-600 mt-0.5">
            <span>Payroll recoverable</span>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div
          id="kpi-outstanding-balance"
          className="bg-white border border-rose-200 bg-rose-50/20 rounded-lg p-3.5 shadow-sm transition-all hover:border-rose-300"
        >
          <div className="flex items-center justify-between text-rose-700 mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-600">Outstanding Balance</span>
            <div className="p-1 rounded bg-rose-100 text-rose-700">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold text-rose-700 tracking-tight">
            {loading ? '...' : `AED ${formatCurrency(outstandingBal)}`}
          </div>
          <div className="text-[11px] text-rose-600 mt-0.5">
            <span>Pending collection</span>
          </div>
        </div>
      </div>

      {/* Expandable Financial Details Toggle */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          id="btn-toggle-financial-details"
          onClick={() => setShowDetails(!showDetails)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded transition-colors"
        >
          <span>Financial Details & Settlement Breakdown</span>
          {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expandable Accounting Section */}
      {showDetails && (
        <div
          id="financial-details-drawer"
          className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg"
        >
          <div className="bg-white border border-slate-200 rounded p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase">Company Paid</span>
            <div className="text-sm font-semibold text-slate-900 mt-0.5">
              AED {formatCurrency(companyPaid)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase">Employee Paid / Deducted</span>
            <div className="text-sm font-semibold text-emerald-700 mt-0.5">
              AED {formatCurrency(employeePaid)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase">Settled Amount</span>
            <div className="text-sm font-semibold text-emerald-700 mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>AED {formatCurrency(settledAmt)}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded p-2.5">
            <span className="text-[11px] font-medium text-slate-500 uppercase">Unsettled Amount</span>
            <div className="text-sm font-semibold text-amber-700 mt-0.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>AED {formatCurrency(unsettledAmt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
