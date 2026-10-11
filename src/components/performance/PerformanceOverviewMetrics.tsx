import React from 'react';
import {
  TrendingUp,
  Award,
  AlertTriangle,
  Zap,
  DollarSign,
  Truck,
  Flame,
} from 'lucide-react';
import { RiderPerformanceSummary, PerformanceException } from '../../types/performance';

interface Props {
  summaries: RiderPerformanceSummary[];
  exceptions: PerformanceException[];
  onFilterExceptions?: () => void;
  lang?: 'EN' | 'AR';
}

export const PerformanceOverviewMetrics: React.FC<Props> = ({
  summaries,
  exceptions,
  onFilterExceptions,
  lang = 'EN',
}) => {
  const totalRiders = summaries.length;
  const totalDeliveries = summaries.reduce((acc, s) => acc + s.total_deliveries, 0);
  const avgFleetDeliveries = totalRiders > 0
    ? (summaries.reduce((acc, s) => acc + s.avg_deliveries_daily, 0) / totalRiders).toFixed(1)
    : '0';

  const excellentCount = summaries.filter((s) => s.score_category === 'EXCELLENT').length;
  const attentionCount = summaries.filter((s) => s.score_category === 'NEEDS_ATTENTION' || s.score_category === 'CRITICAL' || s.active_exceptions_count > 0).length;
  const totalIncentives = summaries.reduce((acc, s) => acc + s.total_incentives, 0);

  const isAr = lang === 'AR';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Metric 1: Total Fleet Deliveries */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'إجمالي الطلبات المنجزة' : 'Total Fleet Deliveries'}
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalDeliveries.toLocaleString()}
          </span>
          <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> Avg {avgFleetDeliveries}/day
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isAr ? `موزعة على ${totalRiders} مندوب نشط` : `Across ${totalRiders} active riders`}
        </div>
      </div>

      {/* Metric 2: Top Performers */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'كبار المنجزين (ممتاز 90+)' : 'Top Performers (90+ Score)'}
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Flame className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {excellentCount}
          </span>
          <span className="text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
            {totalRiders > 0 ? Math.round((excellentCount / totalRiders) * 100) : 0}% of fleet
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isAr ? 'يحققون المستهدفات بنجاح' : 'Exceeding project targets'}
        </div>
      </div>

      {/* Metric 3: Attention Required Exceptions */}
      <div
        onClick={onFilterExceptions}
        className={`bg-white dark:bg-slate-900 border rounded-xl p-4.5 shadow-xs transition-colors cursor-pointer ${
          exceptions.length > 0
            ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/20 hover:bg-rose-50/40'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isAr ? 'حالات تتطلب الانتباه' : 'Attention Required'}
          </span>
          <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-xs">
            {exceptions.length}
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-rose-700 dark:text-rose-400">
            {attentionCount}
          </span>
          <span className="text-xs font-medium text-rose-600">
            {isAr ? 'مناديب يحتاجون إجراء' : 'Riders with flags'}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {isAr ? 'انقر لتصفية الاستثناءات الفورية' : 'Click to view exception queue'}
        </div>
      </div>

      {/* Metric 4: Est. Performance Incentives */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {isAr ? 'حوافز الأداء المستحقة' : 'Performance Incentives'}
          </span>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            AED {totalIncentives.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          {isAr ? 'جاهزة للمزامنة مع الرواتب' : 'Auto-calculated for Payroll'}
        </div>
      </div>
    </div>
  );
};
