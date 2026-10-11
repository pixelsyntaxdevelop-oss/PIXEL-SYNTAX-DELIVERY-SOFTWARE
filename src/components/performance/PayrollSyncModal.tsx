import React, { useState } from 'react';
import {
  DollarSign,
  CheckCircle,
  Zap,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { performanceService } from '../../services/performanceService';
import { RiderPerformanceSummary } from '../../types/performance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  summaries: RiderPerformanceSummary[];
  onSuccess: () => void;
  lang?: 'EN' | 'AR';
}

export const PayrollSyncModal: React.FC<Props> = ({
  isOpen,
  onClose,
  summaries,
  onSuccess,
  lang = 'EN',
}) => {
  const [monthKey, setMonthKey] = useState('2026-08');
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const totalDeliveries = summaries.reduce((s, r) => s + r.total_deliveries, 0);
  const totalIncentives = summaries.reduce((s, r) => s + r.total_incentives, 0);
  const totalPenalties = summaries.reduce((s, r) => s + r.total_penalties, 0);
  const netEarnings = totalIncentives - totalPenalties;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await performanceService.syncToPayroll(monthKey);
      setSyncResult(res);
      setSynced(true);
    } catch (err: any) {
      alert('Error syncing to payroll: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const isAr = lang === 'AR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setSynced(false);
        onClose();
      }}
      title={
        isAr
          ? 'مزامنة أداء وحوافز المناديب مع مسير الرواتب'
          : 'Sync Rider Performance & Delivery Incentives to Automated Payroll'
      }
      size="md"
    >
      <div className="space-y-4 text-xs">
        {!synced ? (
          <>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/60 text-blue-900 dark:text-blue-200">
              <div className="font-bold text-xs flex items-center gap-1.5 mb-1">
                <Zap className="w-4 h-4 text-amber-500" />
                {isAr ? 'المزامنة التلقائية مع محرك الرواتب' : 'Real-Time Operational Payroll Integration'}
              </div>
              <p className="text-[11px] leading-relaxed text-blue-800/90 dark:text-blue-300">
                {isAr
                  ? 'يقوم النظام بنقل إجمالي الطلبات المنجزة، حوافز الإنتاجية، وخصومات الـ SLA مباشرة إلى كشف رواتب الشهر المحدد دون أي إدخال يدوي مكرر.'
                  : 'Pushes verified delivery completions, calculated piece-rate incentives, and SLA penalty deductions directly into the active payroll cycle.'}
              </p>
            </div>

            {/* Target Period */}
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'فترة مسير الرواتب المستهدفة' : 'Target Payroll Period'}
              </label>
              <select
                value={monthKey}
                onChange={(e) => setMonthKey(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-bold"
              >
                <option value="2026-08">August 2026 (Active Cycle)</option>
                <option value="2026-09">September 2026 (Next Cycle)</option>
              </select>
            </div>

            {/* Sync Financial Summary */}
            <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-500 text-[11px] block">Riders in Scope</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {summaries.length} Captains
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">Total Deliveries</span>
                <span className="text-base font-bold text-blue-600">
                  {totalDeliveries.toLocaleString()} drops
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">Gross Incentives</span>
                <span className="text-base font-bold text-emerald-600">
                  +AED {totalIncentives.toLocaleString()}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-[11px] block">Penalties Deducted</span>
                <span className="text-base font-bold text-rose-600">
                  -AED {totalPenalties.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center justify-between">
              <span className="font-bold text-emerald-900 dark:text-emerald-300">
                Net Performance Payable:
              </span>
              <span className="text-base font-black text-emerald-700 dark:text-emerald-300">
                AED {netEarnings.toLocaleString(undefined, { minimumFractionDigits: 1 })}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                {isAr ? 'مزامنة مع الرواتب الآن' : `Sync ${summaries.length} Riders to Payroll`}
              </button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isAr ? 'تمت مزامنة الرواتب بنجاح!' : 'Payroll Synchronization Complete!'}
            </h3>
            <p className="text-slate-500 text-xs max-w-sm mx-auto">
              {isAr
                ? `تم تحديث مسير رواتب ${monthKey} لـ ${syncResult?.total_riders_synced || summaries.length} مندوب بإجمالي حوافز AED ${syncResult?.total_incentives_synced || totalIncentives}.`
                : `Successfully pushed verified deliveries and incentive earnings to ${syncResult?.total_riders_synced || summaries.length} rider records for period ${monthKey}.`}
            </p>
            <button
              type="button"
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs mt-2"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};
