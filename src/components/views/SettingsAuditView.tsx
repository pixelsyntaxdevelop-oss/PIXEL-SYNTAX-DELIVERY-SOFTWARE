import React from 'react';
import { Settings, Shield, Building2, Activity, ShieldCheck, Lock, Globe } from 'lucide-react';
import { SystemAuditLog, BranchInfo } from '../../types/erp';
import { Badge } from '../common/Badge';

interface SettingsAuditViewProps {
  branches: BranchInfo[];
  auditLogs: SystemAuditLog[];
  lang: 'EN' | 'AR';
}

export const SettingsAuditView: React.FC<SettingsAuditViewProps> = ({ branches, auditLogs, lang }) => {
  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-slate-700 dark:text-slate-200" />
            {lang === 'EN' ? 'System Settings & Enterprise Audit Trail' : 'إعدادات النظام وسجل التتبع'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Multi-branch management, company configuration, IP security restrictions, 2FA enforcement, and full immutable audit logs.'
              : 'إدارة الفروع، إعدادات الشركة، حظر عناوين IP، المصادقة الثنائية، وسجل تتبع الأمان.'}
          </p>
        </div>
      </div>

      {/* Multi-Branch Management */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" /> Registered Regional Branches ({safeBranches.length})
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {safeBranches.map((b) => (
            <div key={b.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-xs text-slate-900 dark:text-white">{b.name}</span>
                {b.isHeadquarters && <Badge variant="purple">HQ</Badge>}
              </div>
              <div className="text-xs text-slate-500 font-mono">Code: {b.code} • {b.city}, {b.country}</div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Monthly Rev: AED {(b.monthlyRevenue || 0).toLocaleString()}</div>
            </div>
          ))}
          {safeBranches.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-slate-400">
              No regional branches configured.
            </div>
          )}
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
        <h3 className="font-extrabold text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" /> Immutable System Audit Trail Logs
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor & Role</th>
                <th className="p-3">Action</th>
                <th className="p-3">Module</th>
                <th className="p-3">IP Address</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="p-3 font-mono text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {log.actorName} <span className="block text-[10px] text-slate-400 font-mono">{log.actorRole}</span>
                  </td>
                  <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{log.action}</td>
                  <td className="p-3 font-mono">{log.module}</td>
                  <td className="p-3 font-mono text-slate-500">{log.ipAddress}</td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
