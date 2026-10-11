import React from 'react';
import { X, AlertTriangle, FileWarning, Wrench, Clock, ShieldCheck, Check } from 'lucide-react';
import { ExpiringDocumentAlert } from '../../types/erp';
import { Badge } from '../common/Badge';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: ExpiringDocumentAlert[];
  lang: 'EN' | 'AR';
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose, alerts, lang }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              {lang === 'EN' ? 'System Alerts & Expiries' : 'التنبيهات والمستندات المنتهية'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex items-start gap-2.5">
            <FileWarning className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {lang === 'EN' ? 'Automated Document Expiry Warning' : 'تحذير انتهاء المستندات التلقائي'}
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                {lang === 'EN'
                  ? 'Visas, Emirates IDs, or vehicle insurance policies expiring within 30 days trigger compliance alerts.'
                  : 'تتطلب الإقامات أو الهويات الإماراتية أو تأمينات المركبات المنتهية خلال 30 يوماً تجديداً فورياً.'}
              </p>
            </div>
          </div>

          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 pt-2">
            {lang === 'EN' ? 'Active Expiry Queue' : 'قائمة المستندات الحرجة'} ({alerts.length})
          </h4>

          {alerts.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 rounded-xl flex flex-col items-center justify-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                {lang === 'EN' ? 'All Documents Compliant' : 'جميع المستندات سارية ومكتملة'}
              </h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {lang === 'EN'
                  ? 'No document expiries or compliance warnings for this company.'
                  : 'لا توجد مستندات منتهية أو تحذيرات مطابقة لهذه الشركة.'}
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === 'CRITICAL' ? 'danger' : 'warning'}>
                      {alert.severity}
                    </Badge>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {alert.documentType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{alert.entityName}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    <span>Expires: {alert.expiryDate}</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      {alert.daysRemaining} {lang === 'EN' ? 'days left' : 'يوم متبقي'}
                    </span>
                  </div>
                </div>

                <button className="px-2.5 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 transition-colors">
                  {lang === 'EN' ? 'Renew' : 'تجديد'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
