import React, { useState, useEffect } from 'react';
import {
  User,
  Star,
  Award,
  Bike,
  Smartphone,
  Sparkles,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Zap,
  Loader2,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { performanceService } from '../../services/performanceService';
import { PerformanceCalculationService } from '../../services/PerformanceCalculationService';
import { DbRiderDailyPerformance, PerformanceAiDiagnostic } from '../../types/performance';
import { Badge } from '../common/Badge';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  lang?: 'EN' | 'AR';
}

export const Rider360PerformanceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  employeeId,
  lang = 'EN',
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'AI_DIAGNOSTICS'>('OVERVIEW');
  const [loading, setLoading] = useState(false);
  const [riderData, setRiderData] = useState<any>(null);

  // AI Diagnostic State
  const [aiLoading, setAiLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<PerformanceAiDiagnostic | null>(null);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadRider360();
    }
  }, [isOpen, employeeId]);

  const loadRider360 = async () => {
    setLoading(true);
    try {
      const data = await performanceService.getRider360(employeeId);
      setRiderData(data);
    } catch (err: any) {
      console.error('Error loading 360 data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAiDiagnostics = async () => {
    setAiLoading(true);
    try {
      const result = await performanceService.runAiDiagnostic(employeeId);
      setDiagnostic(result);
      setActiveTab('AI_DIAGNOSTICS');
    } catch (err: any) {
      alert('AI Diagnostic failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const emp = riderData?.employee;
  const summary = riderData?.summary;
  const dailyRecords: DbRiderDailyPerformance[] = riderData?.daily_records || [];
  const config = riderData?.config;

  const isAr = lang === 'AR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? `الملف الشامل 360 لأداء الكابتن — ${emp?.full_name || 'Rider'}`
          : `Rider 360° Operations & Performance Dossier — ${emp?.full_name || 'Rider'}`
      }
      size="xl"
    >
      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Loading Rider 360 Dossier...</span>
        </div>
      ) : !emp ? (
        <div className="py-10 text-center text-slate-500 text-xs">Rider records not found.</div>
      ) : (
        <div className="space-y-4">
          {/* Rider Header Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {emp.photo ? (
                <img
                  src={emp.photo}
                  alt={emp.full_name}
                  className="w-12 h-12 rounded-xl object-cover border-2 border-white dark:border-slate-700 shadow-xs"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-base">
                  {emp.full_name.charAt(0)}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {emp.full_name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                    {emp.employee_code}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{emp.project_name || 'No Project Assigned'}</span>
                  <span>•</span>
                  <span>{emp.designation || 'Delivery Rider'}</span>
                  <span>•</span>
                  <span>{emp.nationality || 'UAE'}</span>
                </div>
              </div>
            </div>

            {/* Overall Score Badge */}
            <div className="flex items-center gap-3 self-end sm:self-center">
              <div className="text-right">
                <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                  {summary?.avgScore || 85}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {summary?.category || 'GOOD'} PERFORMANCE
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunAiDiagnostics}
                disabled={aiLoading}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isAr ? 'تحليل AI' : 'Run Copilot Diagnostics'}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('OVERVIEW')}
              className={`pb-2.5 px-3 font-bold border-b-2 transition-colors ${
                activeTab === 'OVERVIEW'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {isAr ? 'نظرة عامة والمعدات' : 'Overview & Assets'}
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`pb-2.5 px-3 font-bold border-b-2 transition-colors ${
                activeTab === 'HISTORY'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {isAr ? `سجل الأداء اليومي (${dailyRecords.length})` : `Daily Breakdown (${dailyRecords.length})`}
            </button>
            <button
              onClick={() => setActiveTab('AI_DIAGNOSTICS')}
              className={`pb-2.5 px-3 font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'AI_DIAGNOSTICS'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-slate-500 hover:text-purple-600'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAr ? 'تشخيص الذكاء الاصطناعي' : 'AI Root Cause Analysis'}
            </button>
          </div>

          {/* TAB 1: OVERVIEW & ASSETS */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4">
              {/* Asset & Readiness Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isAr ? 'الدراجة النارية المخصصة' : 'Motorcycle Asset'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {emp.current_bike_plate ? `Plate: ${emp.current_bike_plate}` : 'No vehicle allocated in garage'}
                      </div>
                    </div>
                  </div>
                  {emp.current_bike_plate ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      ASSIGNED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px]">
                      MISSING
                    </span>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950 flex items-center justify-center text-amber-600">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {isAr ? 'شريحة الاتصال وبيانات الطريق' : 'Corporate Data SIM'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {emp.current_sim_number ? `SIM: ${emp.current_sim_number}` : 'No active SIM card allocated'}
                      </div>
                    </div>
                  </div>
                  {emp.current_sim_number ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                      MISSING
                    </span>
                  )}
                </div>
              </div>

              {/* KPI Summary Tiles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 font-semibold">{isAr ? 'إجمالي الطلبات' : 'Total Deliveries'}</span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {summary?.totalDeliveries || 0}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">Avg {summary?.avgDeliveries || 0}/day</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 font-semibold">{isAr ? 'الحوافز المكتسبة' : 'Incentives Earned'}</span>
                  <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    AED {summary?.totalIncentives || 0}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-synced to payroll</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 font-semibold">{isAr ? 'الخصومات والجزاءات' : 'Penalties Applied'}</span>
                  <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">
                    AED {summary?.totalPenalties || 0}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">SLA / Cancellation rules</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[11px] text-slate-500 font-semibold">{isAr ? 'تقييم العملاء' : 'Customer Rating'}</span>
                  <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400" />
                    {dailyRecords[0]?.customer_rating || 4.8}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">5-star average</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DAILY PERFORMANCE HISTORY */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Deliveries</th>
                      <th className="py-2.5 px-3">Login Hours</th>
                      <th className="py-2.5 px-3">Acceptance</th>
                      <th className="py-2.5 px-3">Rating</th>
                      <th className="py-2.5 px-3">Incentive</th>
                      <th className="py-2.5 px-3 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dailyRecords.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No daily performance entries logged yet.
                        </td>
                      </tr>
                    ) : (
                      dailyRecords.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                            {r.performance_date}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-blue-600">
                            {r.deliveries ?? r.orders_completed ?? 0} drops
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {r.login_hours}h
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {r.acceptance_rate}%
                          </td>
                          <td className="py-2.5 px-3 text-amber-600">
                            ★ {r.customer_rating}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">
                            +AED {r.estimated_daily_incentive_aed ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-blue-600">
                            {r.performance_score}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: AI DIAGNOSTICS */}
          {activeTab === 'AI_DIAGNOSTICS' && (
            <div className="space-y-4">
              {!diagnostic ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center mx-auto">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    AI Operations Copilot — Rider Root Cause Diagnostic
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Our AI models analyze dark-store transit velocity, equipment readiness, route acceptance patterns, and absence logs to give actionable interventions.
                  </p>
                  <button
                    type="button"
                    onClick={handleRunAiDiagnostics}
                    disabled={aiLoading}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-xs inline-flex items-center gap-1.5 shadow-xs"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Diagnostic Report
                  </button>
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Executive Summary */}
                  <div className="p-3.5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-xl">
                    <div className="font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      Executive Operations Diagnosis
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                      {diagnostic.analysis}
                    </p>
                  </div>

                  {/* Contributing Factors */}
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                      Primary Root Cause Contributing Factors:
                    </div>
                    <div className="space-y-1.5">
                      {diagnostic.contributingFactors.map((factor, i) => (
                        <div key={i} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2 text-slate-700 dark:text-slate-300">
                          <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actionable Interventions */}
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-2">
                      Recommended Operations Interventions:
                    </div>
                    <div className="space-y-1.5">
                      {diagnostic.actionableSuggestions.map((sug, i) => (
                        <div key={i} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2 text-slate-700 dark:text-slate-300">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Project Match */}
                  {diagnostic.recommendedProjectMatch && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-center justify-between">
                      <span className="font-semibold text-blue-900 dark:text-blue-300">
                        Optimal Project SLA Fit:
                      </span>
                      <span className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold text-xs">
                        {diagnostic.recommendedProjectMatch}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};
