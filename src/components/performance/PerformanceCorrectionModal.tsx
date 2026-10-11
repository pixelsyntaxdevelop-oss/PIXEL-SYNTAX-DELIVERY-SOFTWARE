import React, { useState, useEffect } from 'react';
import {
  Edit3,
  CheckCircle,
  AlertCircle,
  History,
  Calculator,
  Loader2,
  Clock,
  UserCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { performanceService } from '../../services/performanceService';
import { PerformanceCorrectionAuditLog } from '../../types/performance';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  onSuccess: () => void;
  lang?: 'EN' | 'AR';
}

export const PerformanceCorrectionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  employeeId,
  onSuccess,
  lang = 'EN',
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [riderData, setRiderData] = useState<any>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');

  // Form State
  const [deliveries, setDeliveries] = useState<number>(0);
  const [loginHours, setLoginHours] = useState<number>(0);
  const [acceptanceRate, setAcceptanceRate] = useState<number>(100);
  const [customerRating, setCustomerRating] = useState<number>(5.0);
  const [reason, setReason] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<PerformanceCorrectionAuditLog[]>([]);

  useEffect(() => {
    if (isOpen && employeeId) {
      loadRiderDetails();
    }
  }, [isOpen, employeeId]);

  const loadRiderDetails = async () => {
    setLoading(true);
    try {
      const data = await performanceService.getRider360(employeeId);
      setRiderData(data);
      const records = data?.dailyRecords || (data as any)?.daily_records || [];
      if (records.length > 0) {
        const latest = records[0];
        setSelectedRecordId(latest.id);
        setDeliveries(latest.deliveries ?? latest.orders_completed ?? 0);
        setLoginHours(latest.login_hours || 9.0);
        setAcceptanceRate(latest.acceptance_rate || 95.0);
        setCustomerRating(latest.customer_rating || 4.8);
      }
      setAuditLogs((data as any)?.correction_logs || []);
    } catch (err: any) {
      console.error('Error loading rider 360:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordSelect = (recId: string) => {
    setSelectedRecordId(recId);
    const records = riderData?.dailyRecords || (riderData as any)?.daily_records || [];
    const rec = records.find((r: any) => r.id === recId);
    if (rec) {
      setDeliveries(rec.deliveries ?? rec.orders_completed ?? 0);
      setLoginHours(rec.login_hours || 9.0);
      setAcceptanceRate(rec.acceptance_rate || 95.0);
      setCustomerRating(rec.customer_rating || 4.8);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('A valid reason for manual performance metric correction is mandatory.');
      return;
    }

    setSaving(true);
    try {
      await performanceService.correctDailyMetric({
        recordId: selectedRecordId,
        updates: {
          total_deliveries: Number(deliveries),
          orders_completed: Number(deliveries),
          login_hours: Number(loginHours),
          acceptance_rate: Number(acceptanceRate),
          customer_rating: Number(customerRating),
        },
        reason,
      });

      alert('Performance record successfully corrected and logged in audit trail.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert('Error updating record: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isAr = lang === 'AR';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isAr
          ? 'التعديل اليدوي لسجلات الأداء مع سجل التدقيق'
          : 'Manual Performance Metric Correction (with Mandatory Audit Trail)'
      }
      size="lg"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <span className="text-xs font-semibold">Loading rider performance history...</span>
        </div>
      ) : !riderData ? (
        <div className="py-8 text-center text-slate-500 text-xs">Rider performance record not found.</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Rider Header */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700">
            <div>
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {riderData.employee.full_name}
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs">
                {riderData.employee.employee_code} • {riderData.employee.project_name || 'Project'}
              </div>
            </div>
            <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200 rounded-full font-bold">
              Score: {riderData.summary?.avgScore || 85}
            </span>
          </div>

          {/* Record Selector */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {isAr ? 'اختر اليوم المراد تصحيحه' : 'Select Performance Date / Record'}
            </label>
            <select
              value={selectedRecordId}
              onChange={(e) => handleRecordSelect(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
            >
              {riderData.daily_records?.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.performance_date} — {r.total_deliveries} deliveries ({r.login_hours}h login, {r.acceptance_rate}%)
                </option>
              ))}
            </select>
          </div>

          {/* Metric Fields */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'الطلبات المنجزة' : 'Deliveries'}
              </label>
              <input
                type="number"
                min="0"
                value={deliveries}
                onChange={(e) => setDeliveries(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-blue-600"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'ساعات الحضور' : 'Login Hours'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="24"
                value={loginHours}
                onChange={(e) => setLoginHours(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'نسبة القبول %' : 'Acceptance %'}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={acceptanceRate}
                onChange={(e) => setAcceptanceRate(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {isAr ? 'التقييم (من 5)' : 'Rating (0-5)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                max="5"
                value={customerRating}
                onChange={(e) => setCustomerRating(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-amber-600"
                required
              />
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>{isAr ? 'سبب التعديل (إلزامي للتدقيق والامتثال)' : 'Correction Reason (MANDATORY for Audit & Compliance)'}</span>
              <span className="text-rose-500 font-bold">*</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Partner portal retroactive reconciliation: 4 offline drops verified by dark-store dispatch manager."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200"
              required
            />
          </div>

          {/* Existing Audit Logs for this Rider */}
          {auditLogs.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-slate-400" />
                <span>{isAr ? 'سجل التعديلات السابقة' : 'Previous Correction Audit History'}</span>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-[11px] border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between text-slate-500">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{log.field_name}: {log.old_value} → {log.new_value}</span>
                      <span>{log.created_at.substring(0, 10)} by {log.corrected_by}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 italic mt-0.5">"{log.reason}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              {isAr ? 'حفظ التعديل وإعادة الحساب' : 'Commit Correction & Recalculate'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};
