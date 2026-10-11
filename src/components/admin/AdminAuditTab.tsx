import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  X,
  Clock,
  User,
  Shield,
  ArrowRight,
} from 'lucide-react';
import {
  platformAdminService,
  AdminAuditLog,
} from '../../services/platformAdminService';

interface AdminAuditTabProps {
  tenantId: string;
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({ tenantId }) => {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await platformAdminService.getAuditLogs(tenantId, 150);
      setLogs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const filteredLogs = (Array.isArray(logs) ? logs : []).filter((log) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.actor_name?.toLowerCase().includes(q) ||
      log.entity_id?.toLowerCase().includes(q) ||
      log.reason?.toLowerCase().includes(q) ||
      log.module?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Immutable Audit Trail ({logs.length} entries)
          </h3>
          <p className="text-xs text-slate-500">
            Append-only logs of every change, deletion, merge, repair, and administrative action.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search action, actor, entity ID, reason..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <button
            onClick={loadData}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            title="Refresh Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">Actor / Role</th>
                <th className="py-3 px-3">Module</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Entity ID</th>
                <th className="py-3 px-3">Audit Reason</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {(!Array.isArray(filteredLogs) || filteredLogs.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {loading ? 'Loading audit records...' : 'No audit log entries recorded yet.'}
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredLogs) ? filteredLogs : []).map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {log.timestamp?.replace('T', ' ').substring(0, 19)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {log.actor_name || 'System'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {log.actor_role || 'ADMIN'}
                      </div>
                    </td>
                    <td className="py-3 px-3 uppercase text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      {log.module}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          log.action?.includes('DELETE')
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                            : log.action?.includes('MERGE') || log.action?.includes('REPAIR')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : log.action?.includes('UPDATE') || log.action?.includes('EDIT')
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {log.entity_id}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {log.reason || '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="p-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        title="View Full Audit Entry & Diff"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail & Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Audit Trail Entry Details
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Audit ID</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedLog.id}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Timestamp</span>
                  <span className="font-mono">{selectedLog.timestamp}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Actor</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedLog.actor_name || 'System'}</span>
                  <span className="block text-[10px] text-slate-400">{selectedLog.actor_role}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Action</span>
                  <span className="font-mono font-bold text-blue-600">{selectedLog.action}</span>
                </div>
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Module / Entity</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedLog.module}</span>
                  <span className="block font-mono text-[10px] text-slate-500">{selectedLog.entity_id}</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <span className="text-slate-400 block text-[11px]">Required Audit Reason</span>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {selectedLog.reason || 'None provided'}
                </p>
              </div>

              {selectedLog.details && (
                <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <span className="text-slate-400 block text-[11px]">Context / Details</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-0.5 font-mono text-[11px]">
                    {selectedLog.details}
                  </p>
                </div>
              )}

              {/* State Diff Preview */}
              {(selectedLog.old_value || selectedLog.new_value) && (
                <div className="space-y-1 pt-2">
                  <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                    State Difference (Before & After)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg overflow-x-auto">
                      <span className="font-bold text-red-700 dark:text-red-300 block mb-1">
                        Previous State (Old)
                      </span>
                      <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {typeof selectedLog.old_value === 'object'
                          ? JSON.stringify(selectedLog.old_value, null, 2)
                          : selectedLog.old_value || 'None'}
                      </pre>
                    </div>

                    <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg overflow-x-auto">
                      <span className="font-bold text-emerald-700 dark:text-emerald-300 block mb-1">
                        New State (Updated)
                      </span>
                      <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {typeof selectedLog.new_value === 'object'
                          ? JSON.stringify(selectedLog.new_value, null, 2)
                          : selectedLog.new_value || 'None'}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
