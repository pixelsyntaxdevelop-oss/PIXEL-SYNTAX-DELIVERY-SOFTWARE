import React from 'react';
import {
  DollarSign,
  UserCheck,
  AlertCircle,
  Building,
  Clock,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { SalikFinancialStats } from '../../../types/salik';

interface SalikFinancialSummaryCardsProps {
  stats: SalikFinancialStats | null;
  loading: boolean;
  onFilterChange?: (filter: 'ALL' | 'CHARGED' | 'UNCHARGED') => void;
  activeFilter?: string;
}

export const SalikFinancialSummaryCards: React.FC<SalikFinancialSummaryCardsProps> = ({
  stats,
  loading,
  onFilterChange,
  activeFilter = 'ALL',
}) => {
  const totalAmount = stats?.totalSalikAmount ?? 0;
  const chargedAmount = stats?.chargedToEmployees ?? 0;
  const unchargedAmount = stats?.unchargedPending ?? 0;
  const companyLiability = stats?.companyLiability ?? 0;
  const outstanding = stats?.outstandingBalance ?? 0;

  const totalCount = stats?.totalCount ?? 0;
  const chargedCount = stats?.chargedCount ?? 0;
  const unchargedCount = stats?.unchargedCount ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {/* 1. Total Salik Amount */}
      <div
        onClick={() => onFilterChange && onFilterChange('ALL')}
        className={`p-4 rounded-xl border transition-all cursor-pointer ${
          activeFilter === 'ALL'
            ? 'border-slate-800 bg-slate-900 text-white shadow-md'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`text-xs font-semibold ${
              activeFilter === 'ALL'
                ? 'text-slate-300'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Total Salik Amount
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              activeFilter === 'ALL'
                ? 'bg-slate-800 text-slate-200'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight">
            {loading ? '...' : `AED ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span
            className={
              activeFilter === 'ALL' ? 'text-slate-400' : 'text-slate-500'
            }
          >
            {totalCount} total crossings
          </span>
          <span
            className={`font-semibold ${
              activeFilter === 'ALL' ? 'text-emerald-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            100% Volume
          </span>
        </div>
      </div>

      {/* 2. Charged to Employees */}
      <div
        onClick={() => onFilterChange && onFilterChange('CHARGED')}
        className={`p-4 rounded-xl border transition-all cursor-pointer ${
          activeFilter === 'CHARGED'
            ? 'border-emerald-600 bg-emerald-950/20 shadow-md ring-1 ring-emerald-500'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 dark:hover:border-emerald-800'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Charged to Employees
          </span>
          <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <UserCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {loading ? '...' : `AED ${chargedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            {chargedCount} allocated tolls
          </span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {totalAmount > 0
              ? `${Math.round((chargedAmount / totalAmount) * 100)}%`
              : '0%'}
          </span>
        </div>
      </div>

      {/* 3. Uncharged / Pending */}
      <div
        onClick={() => onFilterChange && onFilterChange('UNCHARGED')}
        className={`p-4 rounded-xl border transition-all cursor-pointer ${
          activeFilter === 'UNCHARGED'
            ? 'border-amber-600 bg-amber-950/20 shadow-md ring-1 ring-amber-500'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-800'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Uncharged / Pending
          </span>
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {loading ? '...' : `AED ${unchargedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            {unchargedCount} unallocated
          </span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            Needs Review
          </span>
        </div>
      </div>

      {/* 4. Company Liability */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Company Fleet Expense
          </span>
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Building className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
            {loading ? '...' : `AED ${companyLiability.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            {stats?.companyLiabilityCount || 0} business tolls
          </span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">
            Authorized
          </span>
        </div>
      </div>

      {/* 5. Outstanding Deductions */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Pending Payroll Sync
          </span>
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {loading ? '...' : `AED ${outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 dark:text-slate-400">
            To deduct from rider pay
          </span>
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            Awaiting Payroll
          </span>
        </div>
      </div>
    </div>
  );
};
