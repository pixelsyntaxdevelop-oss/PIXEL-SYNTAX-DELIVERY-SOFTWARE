import React, { useState, useEffect } from 'react';
import {
  Award,
  UploadCloud,
  Sliders,
  DollarSign,
  RefreshCw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { performanceService } from '../../services/performanceService';
import {
  RiderPerformanceSummary,
  PerformanceException,
  ProjectPerformanceConfig,
} from '../../types/performance';
import { PerformanceOverviewMetrics } from '../performance/PerformanceOverviewMetrics';
import { OperationalExceptionsQueue } from '../performance/OperationalExceptionsQueue';
import { RiderPerformanceTable } from '../performance/RiderPerformanceTable';
import { PerformanceImportModal } from '../performance/PerformanceImportModal';
import { PerformanceCorrectionModal } from '../performance/PerformanceCorrectionModal';
import { Rider360PerformanceModal } from '../performance/Rider360PerformanceModal';
import { ProjectConfigModal } from '../performance/ProjectConfigModal';
import { PayrollSyncModal } from '../performance/PayrollSyncModal';

export const PartnerPerformanceView: React.FC<{ lang: 'EN' | 'AR' }> = ({ lang = 'EN' }) => {
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<RiderPerformanceSummary[]>([]);
  const [exceptions, setExceptions] = useState<PerformanceException[]>([]);
  const [configs, setConfigs] = useState<ProjectPerformanceConfig[]>([]);

  // Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPayrollSyncOpen, setIsPayrollSyncOpen] = useState(false);
  const [selectedRider360Id, setSelectedRider360Id] = useState<string | null>(null);
  const [selectedCorrectRiderId, setSelectedCorrectRiderId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumData, excData, cfgData] = await Promise.all([
        performanceService.getSummaries(),
        performanceService.getExceptions(),
        performanceService.getConfigs(),
      ]);
      setSummaries(sumData);
      setExceptions(excData);
      setConfigs(cfgData);
    } catch (err: any) {
      console.error('Error loading performance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    if (summaries.length === 0) return;
    const headers = [
      'Rider Code',
      'Name',
      'Project',
      'Platform',
      'Total Deliveries',
      'Avg Daily Deliveries',
      'Target %',
      'Login Hours',
      'Acceptance %',
      'Rating',
      'Incentives (AED)',
      'Penalties (AED)',
      'Score',
      'Category',
    ];

    const rows = summaries.map((s) => [
      s.employeeCode,
      `"${s.employeeName}"`,
      `"${s.currentProjectName || ''}"`,
      s.platform,
      s.totalDeliveries,
      s.avgDeliveriesPerDay,
      `${s.targetAchievementRate}%`,
      s.totalLoginHours,
      `${s.avgAcceptanceRate}%`,
      s.avgCustomerRating,
      s.estimatedIncentiveAED,
      s.estimatedPenaltyAED,
      s.performanceScore,
      s.scoreCategory,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rider_Performance_Report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isAr = lang === 'AR';

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-blue-600" />
            {isAr ? 'محرك أداء المناديب وعمليات المشاريع' : 'Rider Performance & Project Operations Engine'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAr
              ? 'متابعة شاملة لإنتاجية المناديب عبر مشاريع نون، طلبات، دليفرو، كريم وأمازون مع الحساب التلقائي للنقاط والحوافز والمزامنة المباشرة مع الرواتب.'
              : 'Cross-project performance monitoring across Noon, Talabat, Deliveroo, Careem & Amazon with automated piece-rate incentives, SLA rules, and one-click payroll sync.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Refresh */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors"
            title="Refresh Performance Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* Project SLA Config */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-4 h-4" />
            {isAr ? 'معايير المشاريع' : 'Project Targets & Rules'}
          </button>

          {/* Sync to Payroll */}
          <button
            onClick={() => setIsPayrollSyncOpen(true)}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Zap className="w-4 h-4" />
            {isAr ? 'مزامنة الرواتب' : 'Sync to Payroll'}
          </button>

          {/* Import Data */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            {isAr ? 'استيراد تقارير المنصات' : 'Import Partner CSV'}
          </button>
        </div>
      </div>

      {/* KPI Overview Metrics */}
      <PerformanceOverviewMetrics
        summaries={summaries}
        exceptions={exceptions}
        lang={lang}
      />

      {/* Attention Required Exceptions Queue */}
      <OperationalExceptionsQueue
        exceptions={exceptions}
        onSelectRider={(empId) => setSelectedRider360Id(empId)}
        onRunAiDiagnostic={(empId) => setSelectedRider360Id(empId)}
        onResolveException={(excId) => {
          setExceptions(exceptions.filter((e) => e.id !== excId));
        }}
        lang={lang}
      />

      {/* Main Rider Performance Table */}
      <RiderPerformanceTable
        summaries={summaries}
        onSelectRider={(empId) => setSelectedRider360Id(empId)}
        onCorrectMetric={(empId) => setSelectedCorrectRiderId(empId)}
        onRunAiDiagnostic={(empId) => setSelectedRider360Id(empId)}
        onExportCsv={handleExportCsv}
        lang={lang}
      />

      {/* MODALS */}
      {isImportModalOpen && (
        <PerformanceImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={loadData}
          lang={lang}
        />
      )}

      {isConfigModalOpen && (
        <ProjectConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSuccess={loadData}
          lang={lang}
        />
      )}

      {isPayrollSyncOpen && (
        <PayrollSyncModal
          isOpen={isPayrollSyncOpen}
          onClose={() => setIsPayrollSyncOpen(false)}
          summaries={summaries}
          onSuccess={loadData}
          lang={lang}
        />
      )}

      {selectedRider360Id && (
        <Rider360PerformanceModal
          isOpen={!!selectedRider360Id}
          onClose={() => setSelectedRider360Id(null)}
          employeeId={selectedRider360Id}
          lang={lang}
        />
      )}

      {selectedCorrectRiderId && (
        <PerformanceCorrectionModal
          isOpen={!!selectedCorrectRiderId}
          onClose={() => setSelectedCorrectRiderId(null)}
          employeeId={selectedCorrectRiderId}
          onSuccess={loadData}
          lang={lang}
        />
      )}
    </div>
  );
};
