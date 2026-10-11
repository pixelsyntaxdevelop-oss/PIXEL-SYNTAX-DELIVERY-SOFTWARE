import React from 'react';
import { AlertCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { ExpiryDashboardStats } from '../../services/documentService';

interface DocumentKpiCardsProps {
  stats: ExpiryDashboardStats | null;
  activeBucket: string;
  onSelectBucket: (bucket: string) => void;
  isLoading?: boolean;
}

export const DocumentKpiCards: React.FC<DocumentKpiCardsProps> = ({
  stats,
  activeBucket,
  onSelectBucket,
  isLoading = false,
}) => {
  // Live counts calculated strictly from live database stats
  const count0to15 = stats ? stats.expiring_0_15 ?? 0 : 0;
  const count16to30 = stats ? stats.expiring_16_30 ?? 0 : 0;
  const count31to40 = stats ? stats.expiring_31_40 ?? 0 : 0;
  const countExpired = stats ? stats.expired ?? 0 : 0;

  const kpis = [
    {
      id: '0_15',
      title: 'Expiring in 0–15 Days',
      count: count0to15,
      icon: AlertCircle,
      textColor: 'text-amber-600 dark:text-amber-400',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
      activeBorder: 'ring-2 ring-amber-500 border-amber-500',
    },
    {
      id: '16_30',
      title: 'Expiring in 16–30 Days',
      count: count16to30,
      icon: Clock,
      textColor: 'text-blue-600 dark:text-blue-400',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
      activeBorder: 'ring-2 ring-blue-500 border-blue-500',
    },
    {
      id: '31_40',
      title: 'Expiring in 31–40 Days',
      count: count31to40,
      icon: AlertTriangle,
      textColor: 'text-indigo-600 dark:text-indigo-400',
      badgeBg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800',
      activeBorder: 'ring-2 ring-indigo-500 border-indigo-500',
    },
    {
      id: 'EXPIRED',
      title: 'Expired – Not Renewed',
      count: countExpired,
      icon: XCircle,
      textColor: 'text-rose-600 dark:text-rose-400',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
      activeBorder: 'ring-2 ring-rose-500 border-rose-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        const isActive = activeBucket === kpi.id;

        return (
          <button
            key={kpi.id}
            type="button"
            onClick={() => onSelectBucket(isActive ? 'ALL' : kpi.id)}
            className={`flex items-center justify-between p-4 rounded-xl border bg-white dark:bg-slate-900 transition-all text-left shadow-xs hover:shadow-sm ${
              isActive
                ? `${kpi.activeBorder} shadow-xs`
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {kpi.title}
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                {isLoading ? (
                  <div className="h-6 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                ) : (
                  <span className={`text-xl font-bold tracking-tight ${kpi.textColor}`}>
                    {kpi.count}
                  </span>
                )}
                {isActive && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Filtered
                  </span>
                )}
              </div>
            </div>
            <div className={`p-2.5 rounded-lg border ${kpi.badgeBg}`}>
              <Icon className={`w-5 h-5 ${kpi.textColor}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
};
