import React, { useEffect, useState } from 'react';
import {
  Cloud,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  FileText,
  Truck,
  Users,
  FileCheck2,
  ArrowUpRight,
  Database,
  ExternalLink,
} from 'lucide-react';
import { clientStorageService, StorageUsageData } from '../../services/fileStorageService';

interface StorageDiagnosticsCardProps {
  onRefresh?: () => void;
  className?: string;
}

export const StorageDiagnosticsCard: React.FC<StorageDiagnosticsCardProps> = ({
  onRefresh,
  className = '',
}) => {
  const [data, setData] = useState<StorageUsageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await clientStorageService.getStorageDiagnostics();
      setData(stats);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch storage diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const getMeterColor = (level?: string) => {
    switch (level) {
      case 'CRITICAL_90':
        return 'bg-red-500';
      case 'WARNING_80':
        return 'bg-amber-500';
      case 'WARNING_70':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-600';
    }
  };

  return (
    <div
      id="cloudflare-r2-storage-diagnostics"
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20 shadow-xs">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Document Storage
              </h3>
              {data?.isConfigured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Storage Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Direct Storage Mode
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Your uploaded documents are stored securely.
            </p>
          </div>
        </div>

        <button
          id="btn-refresh-storage-diagnostics"
          onClick={fetchDiagnostics}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-all disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Metrics
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Warning Notice Banner */}
      {data?.warningMessage && (
        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <p className="font-bold">Storage Threshold Alert</p>
            <p className="mt-0.5">{data.warningMessage}</p>
          </div>
        </div>
      )}

      {/* Primary Capacity Meter */}
      <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between text-xs mb-2">
          <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
            <HardDrive className="w-4 h-4 text-blue-600" />
            <span>Used Document Storage</span>
            <span className="text-slate-400 font-normal">({data?.totalFiles || 0} active objects)</span>
          </div>
          <div className="font-mono font-bold text-slate-900 dark:text-white">
            <span>{data?.r2UsedStorageFormatted || '0 MB'}</span>
            <span className="text-slate-400 dark:text-slate-500 font-normal"> / 10 GB Free Tier</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getMeterColor(data?.warningLevel)}`}
            style={{ width: `${Math.max(1, Math.min(100, data?.percentageUsed || 0))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2">
          <span>0 GB</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {(data?.percentageUsed || 0).toFixed(1)}% consumed
          </span>
          <span>10 GB Limit</span>
        </div>
      </div>

      {/* Storage Category Breakdown */}
      <div className="mt-5 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Employees */}
        <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between text-blue-700 dark:text-blue-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Employee Docs</span>
            <Users className="w-4 h-4" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {data?.employeeDocsFormatted || '0 MB'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data?.employeeDocsCount || 0} files (Passport, Visa, EID)
          </p>
        </div>

        {/* Vehicles */}
        <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Fleet Mulkiya</span>
            <Truck className="w-4 h-4" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {data?.vehicleDocsFormatted || '0 MB'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data?.vehicleDocsCount || 0} files (Mulkiya, Insurance)
          </p>
        </div>

        {/* Office Forms */}
        <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Signed Forms</span>
            <FileCheck2 className="w-4 h-4" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {data?.officeFormsFormatted || '0 MB'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data?.officeFormsCount || 0} signed undertakings
          </p>
        </div>

        {/* Imports / Misc */}
        <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300">
            <span className="text-[11px] font-bold uppercase tracking-wider">Import Batches</span>
            <FileText className="w-4 h-4" />
          </div>
          <p className="text-lg font-black text-slate-900 dark:text-white mt-1">
            {data?.importFilesFormatted || '0 MB'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {data?.importFilesCount || 0} raw statement files
          </p>
        </div>
      </div>

      {/* Security Architecture Footnote */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Private bucket • 15-minute signed pre-signed URLs • SHA-256 deduplicated</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <span>Path pattern:</span>
          <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300">
            tenants/:tenant_id/:entity_type/:entity_id/:filename
          </code>
        </div>
      </div>
    </div>
  );
};
