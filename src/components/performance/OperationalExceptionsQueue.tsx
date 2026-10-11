import React, { useState } from 'react';
import {
  AlertTriangle,
  Bike,
  Smartphone,
  CalendarX,
  TrendingDown,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { PerformanceException } from '../../types/performance';
import { Badge } from '../common/Badge';

interface Props {
  exceptions: PerformanceException[];
  onSelectRider: (employeeId: string) => void;
  onRunAiDiagnostic: (employeeId: string) => void;
  onResolveException?: (exceptionId: string) => void;
  onNavigateToModule?: (module: 'fleet' | 'sim' | 'attendance' | 'schedule') => void;
  lang?: 'EN' | 'AR';
}

export const OperationalExceptionsQueue: React.FC<Props> = ({
  exceptions,
  onSelectRider,
  onRunAiDiagnostic,
  onResolveException,
  onNavigateToModule,
  lang = 'EN',
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM'>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredExceptions = exceptions.filter((exc) => {
    const matchesSev = filterSeverity === 'ALL' || exc.severity === filterSeverity;
    const matchesType = filterType === 'ALL' || exc.type === filterType;
    return matchesSev && matchesType;
  });

  const getExceptionIcon = (type: string) => {
    switch (type) {
      case 'MISSING_ASSET_BIKE':
        return <Bike className="w-4 h-4 text-rose-600" />;
      case 'MISSING_ASSET_SIM':
        return <Smartphone className="w-4 h-4 text-amber-600" />;
      case 'HIGH_ABSENCE_RATE':
        return <CalendarX className="w-4 h-4 text-rose-600" />;
      case 'LOW_DELIVERIES':
      case 'LOW_LOGIN_HOURS':
      default:
        return <TrendingDown className="w-4 h-4 text-orange-600" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">HIGH</span>;
      case 'MEDIUM':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">MEDIUM</span>;
    }
  };

  const isAr = lang === 'AR';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr ? 'قائمة استثناءات العمليات (تتطلب تدخلاً)' : 'Attention Required — Operational Exceptions Queue'}
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300">
              {filteredExceptions.length} {isAr ? 'حالة' : 'Issues'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'الكشف التلقائي عن نقص الدراجات، الشرائح، الغياب، وضعف إنتاجية المناديب لتصحيحها فورياً.'
              : 'Auto-detected asset missing flags, unexcused absences, and delivery velocity drops requiring intervention.'}
          </p>
        </div>

        {/* Severity Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start sm:self-auto text-xs">
          {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                filterSeverity === sev
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {sev === 'ALL' ? (isAr ? 'الكل' : 'All') : sev}
            </button>
          ))}
        </div>
      </div>

      {/* Exception Cards Container */}
      <div className="p-4">
        {filteredExceptions.length === 0 ? (
          <div className="py-10 text-center flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {isAr ? 'لا توجد استثناءات أو بلاغات نشطة' : 'No Operational Exceptions Found'}
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {isAr
                ? 'جميع الكباتن والطلبات والمعدات تعمل بكفاءة ووفق المستهدفات المحددة.'
                : 'All active delivery riders are operating within target thresholds and have all required assets assigned.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredExceptions.map((exc) => (
              <div
                key={exc.id}
                className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-white dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        {getExceptionIcon(exc.type)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                          {exc.employee_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {exc.employee_code || exc.project_name || 'Active Project'}
                        </div>
                      </div>
                    </div>
                    {getSeverityBadge(exc.severity)}
                  </div>

                  <div className="mt-2.5">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {exc.title}
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {exc.description}
                    </p>
                  </div>

                  {exc.suggested_action && (
                    <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Action:</span>
                      <span className="truncate">{exc.suggested_action}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onRunAiDiagnostic(exc.employee_id)}
                    className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 py-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAr ? 'تشخيص AI' : 'AI Copilot'}
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onResolveException && (
                      <button
                        onClick={() => onResolveException(exc.id)}
                        className="px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                      >
                        {isAr ? 'تجاوز' : 'Dismiss'}
                      </button>
                    )}
                    <button
                      onClick={() => onSelectRider(exc.employee_id)}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-semibold flex items-center gap-1 transition-colors"
                    >
                      {isAr ? 'تفاصيل 360' : 'View 360'}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
