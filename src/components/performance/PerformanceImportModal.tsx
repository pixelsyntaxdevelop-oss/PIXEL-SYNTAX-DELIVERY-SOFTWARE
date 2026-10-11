import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Info,
  Loader2,
  Check,
  Download,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { performanceService } from '../../services/performanceService';
import { PerformanceImportPreviewRow, DeliveryPlatform } from '../../types/performance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang?: 'EN' | 'AR';
}

export const PerformanceImportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = 'EN',
}) => {
  const [step, setStep] = useState<'UPLOAD' | 'PREVIEW' | 'COMMITTED'>('UPLOAD');
  const [platform, setPlatform] = useState<DeliveryPlatform>('NOON_MINUTES');
  const [projectId, setProjectId] = useState('proj_noon_1');
  const [fileName, setFileName] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewRows, setPreviewRows] = useState<PerformanceImportPreviewRow[]>([]);
  const [overwriteDuplicates, setOverwriteDuplicates] = useState(true);
  const [importSummary, setImportSummary] = useState<{ imported: number; updated: number }>({ imported: 0, updated: 0 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      await generatePreview(file.name, text);
    };
    reader.readAsText(file);
  };

  const handleUseDemoData = async () => {
    setFileName('Sample_August_Noon_Performance.csv');
    const demoContent = `Rider Code,Date,Orders Completed,Login Hours,Acceptance Rate,Customer Rating
ADL0001,2026-08-25,26,9.5,99.0,4.9
ADL0002,2026-08-25,21,9.0,95.0,4.8
ADL0003,2026-08-25,18,8.5,92.0,4.7
ADL0004,2026-08-25,23,9.2,96.0,4.8
ADL0006,2026-08-25,14,8.0,90.0,4.5
ADL0007,2026-08-25,19,9.0,94.0,4.6`;
    setCsvContent(demoContent);
    await generatePreview('Sample_August_Noon_Performance.csv', demoContent);
  };

  const generatePreview = async (fname: string, content: string) => {
    setIsLoadingPreview(true);
    try {
      const res = await performanceService.previewImport({
        fileName: fname,
        projectId,
        platform,
        csvContent: content,
      });
      setPreviewRows(res.rows);
      setStep('PREVIEW');
    } catch (err: any) {
      alert('Error generating preview: ' + err.message);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    setIsCommitting(true);
    try {
      const res = await performanceService.commitImport({
        fileName,
        projectId,
        platform,
        rows: previewRows,
        overwriteDuplicates,
      });

      setImportSummary({
        imported: res.importedCount,
        updated: res.updatedCount,
      });
      setStep('COMMITTED');
    } catch (err: any) {
      alert('Error committing import: ' + err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const validCount = previewRows.filter((r) => r.status !== 'ERROR').length;
  const conflictCount = previewRows.filter((r) => r.isDuplicate).length;
  const errorCount = previewRows.filter((r) => r.status === 'ERROR').length;

  const isAr = lang === 'AR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setStep('UPLOAD');
        onClose();
      }}
      title={
        isAr
          ? 'استيراد تقارير أداء المناديب اليومية (CSV / Excel)'
          : 'Import Daily Rider Performance (CSV / Excel)'
      }
      size="xl"
    >
      <div className="space-y-5">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 text-xs">
          <div className={`flex items-center gap-1.5 font-bold ${step === 'UPLOAD' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
            {isAr ? 'رفع الملف' : 'Upload Data'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-1.5 font-bold ${step === 'PREVIEW' ? 'text-blue-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px]">2</span>
            {isAr ? 'المطابقة والمعاينة' : 'Mapping & Validation'}
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-1.5 font-bold ${step === 'COMMITTED' ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px]">3</span>
            {isAr ? 'اكتمال المعالجة' : 'Calculation Complete'}
          </div>
        </div>

        {/* STEP 1: UPLOAD */}
        {step === 'UPLOAD' && (
          <div className="space-y-4">
            {/* Target Project / Platform Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'منصة التوصيل (المصدر)' : 'Delivery Partner / Platform'}
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as DeliveryPlatform)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="NOON_MINUTES">Noon Minutes</option>
                  <option value="TALABAT">Talabat</option>
                  <option value="DELIVEROO">Deliveroo</option>
                  <option value="CAREEM">Careem</option>
                  <option value="AMAZON_FLEX">Amazon Flex</option>
                  <option value="CUSTOM">Custom Project Hub</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {isAr ? 'المشروع المرتبط بالعمليات' : 'Target Operations Project'}
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="proj_noon_1">Noon Minutes - Dubai Hub #01</option>
                  <option value="proj_talabat_1">Talabat Fleet Project</option>
                  <option value="proj_deliveroo_1">Deliveroo Logistics Node</option>
                  <option value="proj_careem_1">Careem Captains Roster</option>
                </select>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
              <UploadCloud className="w-10 h-10 text-blue-600 mb-2" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {isAr ? 'اضغط لاختيار ملف CSV أو اسحبه هنا' : 'Click to select CSV/Excel file or drag & drop'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Supports Partner export sheets (Rider Code, Deliveries, Hours, Acceptance Rate)
              </span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Quick Demo Template Helper */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 text-xs">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>{isAr ? 'أو تجربة استيراد بيانات نموذجية جاهزة' : 'Need quick test data? Use realistic sample partner export'}</span>
              </div>
              <button
                type="button"
                onClick={handleUseDemoData}
                disabled={isLoadingPreview}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5"
              >
                {isLoadingPreview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {isAr ? 'تحميل بيانات تجريبية' : 'Load Sample Data'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PREVIEW & VALIDATION */}
        {step === 'PREVIEW' && (
          <div className="space-y-4">
            {/* Validation Metrics Banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Valid Rows
                </div>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                  {validCount}
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl">
                <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Duplicates / Existing
                </div>
                <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
                  {conflictCount}
                </div>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                <div className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Unmatched / Errors
                </div>
                <div className="text-xl font-bold text-rose-700 dark:text-rose-300 mt-1">
                  {errorCount}
                </div>
              </div>
            </div>

            {/* Duplicate Policy Toggle */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {isAr ? 'تحديث السجلات المكررة لنفس التاريخ' : 'Overwrite existing daily records for matching dates'}
              </span>
              <input
                type="checkbox"
                checked={overwriteDuplicates}
                onChange={(e) => setOverwriteDuplicates(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>

            {/* Preview Table */}
            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-semibold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">Rider Matched</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Deliveries</th>
                    <th className="py-2 px-3">Hours</th>
                    <th className="py-2 px-3">Acc. %</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row) => (
                    <tr key={row.rowIndex} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono text-slate-400">{row.rowIndex}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                        {row.matchedEmployeeName} ({row.matchedEmployeeCode})
                      </td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.performanceDate}</td>
                      <td className="py-2 px-3 font-bold text-blue-600">{row.deliveries}</td>
                      <td className="py-2 px-3">{row.loginHours}h</td>
                      <td className="py-2 px-3">{row.acceptanceRate}%</td>
                      <td className="py-2 px-3">
                        {row.status === 'VALID' && (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            VALID
                          </span>
                        )}
                        {row.status === 'WARNING' && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                            DUPLICATE
                          </span>
                        )}
                        {row.status === 'ERROR' && (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold">
                            UNMATCHED
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                {isAr ? 'الرجوع لاختيار ملف آخر' : 'Back to Upload'}
              </button>

              <button
                type="button"
                onClick={handleCommit}
                disabled={isCommitting || validCount === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs flex items-center gap-2 shadow-xs"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isAr ? 'اعتماد وحساب النقاط والحوافز' : `Process & Commit (${validCount} records)`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: COMMITTED SUCCESS */}
        {step === 'COMMITTED' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'تم استيراد وحساب الأداء بنجاح!' : 'Performance Records Successfully Processed!'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {isAr
                  ? `تم حفظ ${importSummary.imported} سجلاً جديداً وتحديث ${importSummary.updated} سجلاً. تم تحديث تقييمات الأداء وحساب الحوافز تلقائياً.`
                  : `Successfully committed ${importSummary.imported} new and updated ${importSummary.updated} daily performance records. Scores and incentive tiers were recalculated in real-time.`}
              </p>
            </div>

            <div className="flex justify-center gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  onSuccess();
                  onClose();
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs"
              >
                {isAr ? 'عرض لوحة الأداء المحدثة' : 'View Updated Performance Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
