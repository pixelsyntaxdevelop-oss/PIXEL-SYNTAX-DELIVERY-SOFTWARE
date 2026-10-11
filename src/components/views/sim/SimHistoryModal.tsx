import React, { useState, useEffect } from 'react';
import { History, UserCheck, ShieldAlert, ArrowRightLeft, RotateCcw, Calendar, User, Clock, CheckCircle2, Edit3 } from 'lucide-react';
import { Modal } from '../../common/Modal';
import { apiClient } from '../../../services/apiClient';
import { SimRecord, SimAssignmentLog, SimStatusHistoryLog } from '../../../types/sim';
import { EditSimAssignmentModal } from './EditSimAssignmentModal';

interface SimHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sim: SimRecord | null;
}

export const SimHistoryModal: React.FC<SimHistoryModalProps> = ({
  isOpen,
  onClose,
  sim,
}) => {
  const [activeTab, setActiveTab] = useState<'ASSIGNMENTS' | 'STATUS'>('ASSIGNMENTS');
  const [assignmentLogs, setAssignmentLogs] = useState<SimAssignmentLog[]>([]);
  const [statusLogs, setStatusLogs] = useState<SimStatusHistoryLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<SimAssignmentLog | null>(null);

  const fetchHistory = async () => {
    if (!sim) return;
    setLoading(true);
    try {
      const [assignRes, statusRes] = await Promise.all([
        apiClient.get<SimAssignmentLog[]>(`/api/erp/sims/${sim.id}/assignment-history`),
        apiClient.get<SimStatusHistoryLog[]>(`/api/erp/sims/${sim.id}/status-history`),
      ]);

      if (assignRes.data && Array.isArray(assignRes.data)) {
        setAssignmentLogs(assignRes.data);
      }
      if (statusRes.data && Array.isArray(statusRes.data)) {
        setStatusLogs(statusRes.data);
      }
    } catch (err) {
      console.error('Failed to load history logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !sim) return;
    fetchHistory();
  }, [isOpen, sim]);

  if (!sim) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`SIM Lifecycle & Audit History — ${sim.mobile_number}`}
      subtitle={`Complete audit trail of rider custodianship and status transitions for line ${sim.mobile_number}.`}
      maxWidth="4xl"
    >
      <div className="space-y-4 text-xs">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('ASSIGNMENTS')}
            className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'ASSIGNMENTS'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Assignment History ({assignmentLogs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('STATUS')}
            className={`px-4 py-2.5 font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'STATUS'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="w-4 h-4" />
            Status History & Audit Trail ({statusLogs.length})
          </button>
        </div>

        {/* Tab 1: Assignment History */}
        {activeTab === 'ASSIGNMENTS' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading assignment records...</div>
            ) : assignmentLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No assignment records found for this SIM card.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {assignmentLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            log.return_date || log.status === 'RETURNED'
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          }`}
                        >
                          {log.status || (log.return_date ? 'RETURNED' : 'ACTIVE')}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {log.employee_name}
                        </span>
                        {log.employee_code && (
                          <span className="font-mono text-slate-500 text-[11px]">
                            ({log.employee_code})
                          </span>
                        )}
                        {log.employee_id && (
                          <span className="font-mono text-slate-400 text-[10px]">
                            ID: {log.employee_id}
                          </span>
                        )}
                        {(log.mobile_number || sim.mobile_number) && (
                          <span className="font-mono text-blue-600 dark:text-blue-400 text-[11px] font-semibold">
                            {log.mobile_number || sim.mobile_number}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingAssignment(log)}
                          className="px-2 py-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Edit Assignment History Record"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Assigned Date/Time</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                          {log.assigned_date}{log.assigned_time ? ` ${log.assigned_time}` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Returned Date/Time</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 font-mono">
                          {log.return_date ? (
                            `${log.return_date}${log.return_time ? ` ${log.return_time}` : ''}`
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Current Active Holder
                            </span>
                          )}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Assigned By</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {log.assigned_by || log.created_by || 'Telecom Admin'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Returned By</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {log.returned_by || (log.return_date ? 'Telecom Depot' : '—')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 pt-2 border-t border-slate-200/40 dark:border-slate-700/40 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Project</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {log.project_name || log.previous_project || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Assign Remark</span>
                        <span className="text-slate-600 dark:text-slate-300 italic">
                          {log.assign_remark || log.notes || '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Return / Unassign Remark</span>
                        <span className="font-medium text-amber-700 dark:text-amber-400">
                          {log.return_remark || log.return_reason || log.reason || (log.return_date ? 'Returned' : '—')}
                        </span>
                      </div>
                    </div>

                    {log.vehicle_plate && (
                      <div className="mt-1 text-[10px] text-slate-400">
                        Linked Vehicle: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{log.vehicle_plate}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Status History & Audit */}
        {activeTab === 'STATUS' && (
          <div className="space-y-3">
            {loading ? (
              <div className="py-12 text-center text-slate-400">Loading status history...</div>
            ) : statusLogs.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                No status transitions recorded yet for this SIM card.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {statusLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {log.previous_status || 'New Line'}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                          {log.new_status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <div>
                        {log.reason ? (
                          <span>Reason: <b className="text-slate-800 dark:text-slate-200">{log.reason}</b></span>
                        ) : (
                          <span className="text-slate-400 italic">No reason specified</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Actor: <span className="font-semibold text-slate-600 dark:text-slate-300">{log.created_by || 'System'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-xs"
          >
            Close Audit Trail
          </button>
        </div>
      </div>

      {editingAssignment && (
        <EditSimAssignmentModal
          isOpen={Boolean(editingAssignment)}
          onClose={() => setEditingAssignment(null)}
          onSuccess={() => {
            fetchHistory();
          }}
          assignment={editingAssignment}
          simMobileNumber={sim.mobile_number}
        />
      )}
    </Modal>
  );
};
