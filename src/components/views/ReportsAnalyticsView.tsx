import React, { useState } from 'react';
import { BarChart3, Download, Calendar, Mail, FileSpreadsheet, FileText, CheckCircle2, Sparkles } from 'lucide-react';
import { Badge } from '../common/Badge';

interface ReportsAnalyticsViewProps {
  lang: 'EN' | 'AR';
}

export const ReportsAnalyticsView: React.FC<ReportsAnalyticsViewProps> = ({ lang }) => {
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  const handleExport = (format: string) => {
    setDownloadingFormat(format);
    setTimeout(() => {
      setDownloadingFormat(null);
      alert(`Export Complete: ApexFleet_Enterprise_Report_${Date.now()}.${format.toLowerCase()}`);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            {lang === 'EN' ? 'Enterprise Reports & Scheduled Analytics Engine' : 'التقارير الشاملة والتحليلات الجدولة'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Generate PDF, Excel, and CSV operational reports, scheduled email digests, and AI summary reports.'
              : 'إنشاء تقارير PDF وExcel وCSV، الجدولة التلقائية عبر البريد الإلكتروني، والتقارير الذكية.'}
          </p>
        </div>
      </div>

      {/* Export Options */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <FileText className="w-8 h-8 text-rose-500 mb-2" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">PDF Executive Summary</h3>
            <p className="text-xs text-slate-500 mt-1">Formatted C-level executive report with charts, KPIs, and P&L summaries.</p>
          </div>
          <button
            onClick={() => handleExport('PDF')}
            disabled={!!downloadingFormat}
            className="mt-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            {downloadingFormat === 'PDF' ? 'Generating PDF...' : 'Download PDF Report'}
          </button>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <FileSpreadsheet className="w-8 h-8 text-emerald-500 mb-2" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Excel / CSV Telematics Data</h3>
            <p className="text-xs text-slate-500 mt-1">Raw dataset containing rider delivery timestamps, fuel logs, and order dispatches.</p>
          </div>
          <button
            onClick={() => handleExport('CSV')}
            disabled={!!downloadingFormat}
            className="mt-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            {downloadingFormat === 'CSV' ? 'Exporting CSV...' : 'Export Excel / CSV'}
          </button>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <Mail className="w-8 h-8 text-blue-500 mb-2" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">Scheduled Email Digests</h3>
            <p className="text-xs text-slate-500 mt-1">Automatic daily 08:00 AM dispatch performance digests sent to stakeholders.</p>
          </div>
          <button
            onClick={() => alert('Scheduled Daily Report Cron Job Activated')}
            className="mt-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Calendar className="w-4 h-4" /> Configure Cron Schedule
          </button>
        </div>
      </div>
    </div>
  );
};
