import React, { useState } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Star,
  Award,
  AlertTriangle,
  Bike,
  Smartphone,
  Sparkles,
  Edit3,
  Eye,
  CheckCircle,
  Clock,
  TrendingUp,
  Download,
} from 'lucide-react';
import { RiderPerformanceSummary, DeliveryPlatform } from '../../types/performance';
import { Badge } from '../common/Badge';

interface Props {
  summaries: RiderPerformanceSummary[];
  onSelectRider: (employeeId: string) => void;
  onCorrectMetric: (employeeId: string) => void;
  onRunAiDiagnostic: (employeeId: string) => void;
  onExportCsv?: () => void;
  lang?: 'EN' | 'AR';
}

export const RiderPerformanceTable: React.FC<Props> = ({
  summaries,
  onSelectRider,
  onCorrectMetric,
  onRunAiDiagnostic,
  onExportCsv,
  lang = 'EN',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyExceptions, setOnlyExceptions] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'deliveries' | 'rating' | 'incentives'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filtered = summaries
    .filter((s) => {
      const matchSearch =
        s.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.project_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchPlatform = selectedPlatform === 'ALL' || s.platform === selectedPlatform;
      const matchCat = selectedCategory === 'ALL' || s.score_category === selectedCategory;
      const matchExceptions = !onlyExceptions || s.active_exceptions_count > 0;

      return matchSearch && matchPlatform && matchCat && matchExceptions;
    })
    .sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'score') {
        valA = a.overall_score;
        valB = b.overall_score;
      } else if (sortBy === 'deliveries') {
        valA = a.total_deliveries;
        valB = b.total_deliveries;
      } else if (sortBy === 'rating') {
        valA = a.avg_customer_rating;
        valB = b.avg_customer_rating;
      } else if (sortBy === 'incentives') {
        valA = a.net_performance_earnings;
        valB = b.net_performance_earnings;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

  const getScoreBadge = (score: number, cat: string) => {
    switch (cat) {
      case 'EXCELLENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
            ★ {score} • Excellent
          </span>
        );
      case 'GOOD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            {score} • Good
          </span>
        );
      case 'AVERAGE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {score} • Normal
          </span>
        );
      case 'NEEDS_ATTENTION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
            {score} • Attention
          </span>
        );
      case 'CRITICAL':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300">
            {score} • Critical
          </span>
        );
    }
  };

  const getPlatformColor = (p: string) => {
    switch (p) {
      case 'TALABAT':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
      case 'DELIVEROO':
        return 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30';
      case 'NOON_MINUTES':
        return 'bg-yellow-500/10 text-yellow-800 dark:text-yellow-300 border-yellow-500/30';
      case 'AMAZON_FLEX':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30';
      case 'CAREEM':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
      default:
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30';
    }
  };

  const isAr = lang === 'AR';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isAr ? 'بحث بالاسم، الكود، المشروع...' : 'Search by rider name, code, project...'}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Platform Filter */}
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">{isAr ? 'جميع المنصات' : 'All Platforms'}</option>
            <option value="NOON_MINUTES">Noon Minutes</option>
            <option value="TALABAT">Talabat</option>
            <option value="DELIVEROO">Deliveroo</option>
            <option value="CAREEM">Careem</option>
            <option value="AMAZON_FLEX">Amazon Flex</option>
            <option value="CUSTOM">Custom Project</option>
          </select>

          {/* Score Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none"
          >
            <option value="ALL">{isAr ? 'جميع التقييمات' : 'All Score Tiers'}</option>
            <option value="EXCELLENT">Excellent (90+)</option>
            <option value="GOOD">Good (80-89)</option>
            <option value="AVERAGE">Average (65-79)</option>
            <option value="NEEDS_ATTENTION">Needs Attention (50-64)</option>
            <option value="CRITICAL">Critical (&lt;50)</option>
          </select>

          {/* Exceptions Only Toggle */}
          <button
            onClick={() => setOnlyExceptions(!onlyExceptions)}
            className={`px-2.5 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
              onlyExceptions
                ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
                : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {isAr ? 'الاستثناءات فقط' : 'Exceptions Only'}
          </button>

          {/* Export CSV */}
          {onExportCsv && (
            <button
              onClick={onExportCsv}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium flex items-center gap-1 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              {isAr ? 'تصدير' : 'Export'}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">{isAr ? 'الكابتن / المندوب' : 'Rider / Employee'}</th>
              <th className="py-3 px-4">{isAr ? 'مشروع التوزيع' : 'Project / Platform'}</th>
              <th className="py-3 px-4">{isAr ? 'الطلبات المنجزة' : 'Deliveries (Target)'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'ساعات الحضور' : 'Login Hours'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'نسبة القبول' : 'Acceptance / Rating'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'المعدات المخصصة' : 'Assets Assigned'}</th>
              <th className="py-3 px-4 text-right">{isAr ? 'صافي الحوافز' : 'Est. Incentives'}</th>
              <th className="py-3 px-4 text-center">{isAr ? 'تقييم الأداء' : 'Performance Score'}</th>
              <th className="py-3 px-4 text-right">{isAr ? 'إجراءات' : 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400 dark:text-slate-500">
                  {isAr ? 'لا توجد بيانات مطابقة لخيارات البحث' : 'No rider performance records found matching your filters.'}
                </td>
              </tr>
            ) : (
              filtered.map((s, idx) => (
                <tr
                  key={s.employee_id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Rank / Index */}
                  <td className="py-3 px-4 text-center font-bold text-slate-400 dark:text-slate-500">
                    {s.rank || idx + 1}
                  </td>

                  {/* Rider Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {s.photo ? (
                          <img
                            src={s.photo}
                            alt={s.employee_name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
                            {s.employee_name.charAt(0)}
                          </div>
                        )}
                        {s.active_exceptions_count > 0 && (
                          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white rounded-full flex items-center justify-center text-[9px] font-black">
                            !
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {s.employee_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {s.employee_code} • {s.branch_name}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Project / Platform */}
                  <td className="py-3 px-4">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${getPlatformColor(s.platform)}`}>
                      {s.project_name}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{s.platform}</div>
                  </td>

                  {/* Deliveries & Target Achieved */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {s.total_deliveries} <span className="text-slate-400 font-normal">({s.avg_deliveries_daily}/d)</span>
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {s.delivery_target_achieved_percent}%
                      </span>
                    </div>
                    <div className="w-28 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s.delivery_target_achieved_percent >= 100
                            ? 'bg-emerald-500'
                            : s.delivery_target_achieved_percent >= 75
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, s.delivery_target_achieved_percent)}%` }}
                      />
                    </div>
                  </td>

                  {/* Login Hours */}
                  <td className="py-3 px-4 text-center">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {s.avg_login_hours_daily}h/day
                    </div>
                    <div className="text-[10px] text-slate-400">{s.total_login_hours}h total</div>
                  </td>

                  {/* Acceptance & Rating */}
                  <td className="py-3 px-4 text-center">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">
                      {s.avg_acceptance_rate}% Acc.
                    </div>
                    <div className="text-[11px] text-amber-600 flex items-center justify-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      {s.avg_customer_rating}
                    </div>
                  </td>

                  {/* Assets Assigned */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {s.assigned_bike_plate ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px]" title={`Bike: ${s.assigned_bike_plate}`}>
                          <Bike className="w-3 h-3" /> {s.assigned_bike_plate}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[11px]" title="No bike allocated">
                          <Bike className="w-3 h-3 text-rose-500" /> Missing
                        </span>
                      )}

                      {s.assigned_sim_number ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[11px]" title={`SIM: ${s.assigned_sim_number}`}>
                          <Smartphone className="w-3 h-3" /> SIM
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 text-[11px]" title="No SIM allocated">
                          <Smartphone className="w-3 h-3 text-amber-500" /> Missing
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Net Incentives */}
                  <td className="py-3 px-4 text-right">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      +AED {s.total_incentives}
                    </div>
                    {s.total_penalties > 0 && (
                      <div className="text-[10px] text-rose-500">
                        -AED {s.total_penalties} pen.
                      </div>
                    )}
                  </td>

                  {/* Performance Score Badge */}
                  <td className="py-3 px-4 text-center">
                    {getScoreBadge(s.overall_score, s.score_category)}
                  </td>

                  {/* Quick Actions */}
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onRunAiDiagnostic(s.employee_id)}
                        className="p-1.5 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                        title="Run AI Copilot Performance Root Cause Diagnostic"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onCorrectMetric(s.employee_id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Manual Correction with Audit Log"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onSelectRider(s.employee_id)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        {isAr ? 'عرض 360' : '360'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
