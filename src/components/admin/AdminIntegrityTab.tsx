import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Wrench,
  ShieldAlert,
  Info,
  Check,
} from 'lucide-react';
import {
  platformAdminService,
  IntegrityIssue,
} from '../../services/platformAdminService';

interface AdminIntegrityTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminIntegrityTab: React.FC<AdminIntegrityTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [repairingId, setRepairingId] = useState<string | null>(null);
  const [repairSuccessMsg, setRepairSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setRepairSuccessMsg(null);
    try {
      const res = await platformAdminService.getDataIntegrity(tenantId);
      setIssues(Array.isArray(res?.issues) ? res.issues : []);
    } catch (err) {
      console.error('Failed to run integrity scanner:', err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleRepair = async (issue: IntegrityIssue) => {
    setRepairingId(issue.id);
    try {
      const res = await platformAdminService.repairIntegrityIssue(
        tenantId,
        issue.id,
        issue.type,
        issue.actionPayload
      );
      if (res.success) {
        setRepairSuccessMsg(`Successfully repaired issue: "${issue.title}".`);
        await loadData();
        onRefreshParentCounts();
      } else {
        alert(res.error || 'Failed to repair integrity issue.');
      }
    } catch (err: any) {
      alert(err.message || 'Repair failed.');
    } finally {
      setRepairingId(null);
    }
  };

  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length;
  const warningCount = issues.filter((i) => i.severity === 'WARNING').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Data Integrity Scanner & Repair Center
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Detects broken relationships, orphan pointers, invalid references, and non-canonical states.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 font-bold flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              {criticalCount} Critical
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {warningCount} Warnings
            </span>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            title="Scan Database"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {repairSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{repairSuccessMsg}</span>
        </div>
      )}

      {/* Issues list */}
      {issues.length === 0 ? (
        <div className="p-10 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2.5" />
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            100% Data Integrity Verified
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            No orphan assignments, broken foreign keys, invalid statuses, or duplicate conflicts were found in this tenant.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {(Array.isArray(issues) ? issues : []).map((issue) => (
            <div
              key={issue.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      issue.severity === 'CRITICAL'
                        ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        : issue.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                    }`}
                  >
                    {issue.severity}
                  </span>
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    {issue.title}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({issue.recordType}: {issue.recordIdentifier})
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {issue.description}
                </p>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>
                    <strong>Recommended Action:</strong> {issue.recommendedAction}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                <button
                  onClick={() => handleRepair(issue)}
                  disabled={repairingId === issue.id}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {repairingId === issue.id ? 'Repairing...' : 'Execute Repair'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
