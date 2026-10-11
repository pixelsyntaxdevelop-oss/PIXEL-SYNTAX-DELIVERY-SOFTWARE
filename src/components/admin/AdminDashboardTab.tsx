import React from 'react';
import {
  Users,
  Car,
  Smartphone,
  Ticket,
  Landmark,
  FolderKanban,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Clock,
  Building,
  BookOpen,
} from 'lucide-react';
import { AdminDashboardData } from '../../services/platformAdminService';

interface AdminDashboardTabProps {
  data: AdminDashboardData | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
  onUpdateTenantMode: (mode: 'SETUP' | 'TESTING' | 'LIVE') => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({
  data,
  loading,
  onRefresh,
  onNavigateTab,
  onUpdateTenantMode,
}) => {
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading live tenant metrics...</span>
      </div>
    );
  }

  const counts = data?.counts || {
    employees: 0,
    totalEmployeesWithArchived: 0,
    vehicles: 0,
    simCards: 0,
    trafficFines: 0,
    salikTransactions: 0,
    projects: 0,
    payrollRecords: 0,
    activeUsers: 0,
    passports: 0,
    passportsWithCompany: 0,
    passportsWithRider: 0,
    duplicateWarnings: 0,
    dataIntegrityIssues: 0,
    orphanRelations: 0,
  };

  const tenant = data?.tenant;

  const statCards = [
    {
      id: 'employees',
      label: 'Employees',
      count: counts.employees,
      subLabel: `${counts.totalEmployeesWithArchived} total records`,
      icon: Users,
      color: 'blue',
      tab: 'employees',
    },
    {
      id: 'passports',
      label: 'Passport Records',
      count: counts.passports ?? 0,
      subLabel: `${counts.passportsWithCompany ?? 0} Company | ${counts.passportsWithRider ?? 0} Rider`,
      icon: BookOpen,
      color: 'teal',
      tab: 'passports',
    },
    {
      id: 'vehicles',
      label: 'Bikes / Vehicles',
      count: counts.vehicles,
      subLabel: 'Active fleet assets',
      icon: Car,
      color: 'emerald',
      tab: 'vehicles',
    },
    {
      id: 'sims',
      label: 'SIM Cards',
      count: counts.simCards,
      subLabel: 'Cellular inventory',
      icon: Smartphone,
      color: 'purple',
      tab: 'sims',
    },
    {
      id: 'fines',
      label: 'Traffic Fines',
      count: counts.trafficFines,
      subLabel: 'Police violations',
      icon: Ticket,
      color: 'rose',
      tab: 'fines',
    },
    {
      id: 'salik',
      label: 'Salik Transactions',
      count: counts.salikTransactions,
      subLabel: 'Toll gate records',
      icon: Landmark,
      color: 'amber',
      tab: 'salik',
    },
    {
      id: 'projects',
      label: 'Projects',
      count: counts.projects,
      subLabel: 'Delivery accounts',
      icon: FolderKanban,
      color: 'indigo',
      tab: 'projects',
    },
    {
      id: 'payroll',
      label: 'Payroll Records',
      count: counts.payrollRecords,
      subLabel: 'Historical payouts',
      icon: DollarSign,
      color: 'cyan',
      tab: 'audit',
    },
    {
      id: 'users',
      label: 'Active Users',
      count: counts.activeUsers,
      subLabel: 'Staff login accounts',
      icon: ShieldCheck,
      color: 'sky',
      tab: 'users',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Tenant Banner */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-300">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {tenant?.name || 'Selected Tenant'}
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {tenant?.id}
                </span>
                <span
                  className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase tracking-wider ${
                    tenant?.go_live_status === 'LIVE'
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : tenant?.go_live_status === 'TESTING'
                      ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                  }`}
                >
                  {tenant?.go_live_status || 'TESTING'} MODE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Domain: <span className="font-mono text-slate-700 dark:text-slate-300">{tenant?.domain || 'apexfleet.ae'}</span> • Status: <span className="text-emerald-600 font-semibold">{tenant?.status || 'ACTIVE'}</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher & Refresh */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="px-2 font-medium text-slate-500">Mode:</span>
              {(['SETUP', 'TESTING', 'LIVE'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => onUpdateTenantMode(mode)}
                  className={`px-2.5 py-1 rounded font-semibold transition-all ${
                    tenant?.go_live_status === mode
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              onClick={onRefresh}
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              title="Refresh counts from production database"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {tenant?.go_live_status === 'LIVE' && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg flex items-center gap-2.5 text-xs text-red-800 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>
              <strong>LIVE Protected Tenant:</strong> This tenant is in production. Hard deletions are restricted, require SUPER_ADMIN authority, explicit audit reason, and confirmation phrase &quot;CONFIRM DELETE&quot;.
            </span>
          </div>
        )}
      </div>

      {/* Primary Data Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => onNavigateTab(card.tab)}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/50 group-hover:text-blue-600 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {card.count.toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                <span>{card.subLabel}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Diagnostics & Integrity Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Duplicates */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Duplicate Warnings
            </span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
              {counts.duplicateWarnings}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Potential duplicate records across Emirates IDs, codes, plates, and SIM serials.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateTab('employees')}
              className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg transition-colors"
            >
              Employees Duplicates
            </button>
            <button
              onClick={() => onNavigateTab('vehicles')}
              className="px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg transition-colors"
            >
              Plates Duplicates
            </button>
          </div>
        </div>

        {/* Data Integrity */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4" />
              Integrity Issues
            </span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
              {counts.dataIntegrityIssues}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Inconsistent references, invalid relations, and broken entity linkages.
          </p>
          <button
            onClick={() => onNavigateTab('integrity')}
            className="w-full py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 rounded-lg transition-colors"
          >
            Open Data Integrity Scanner
          </button>
        </div>

        {/* Orphan Relations */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Orphan Relations
            </span>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300">
              {counts.orphanRelations}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Assets pointing to deleted or nonexistent employee IDs or project codes.
          </p>
          <button
            onClick={() => onNavigateTab('integrity')}
            className="w-full py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 rounded-lg transition-colors"
          >
            Review & Repair Pointers
          </button>
        </div>
      </div>
    </div>
  );
};
