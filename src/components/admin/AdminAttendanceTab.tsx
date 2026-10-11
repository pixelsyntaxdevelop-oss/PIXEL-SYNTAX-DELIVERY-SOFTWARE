import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  RefreshCw,
  Trash2,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  platformAdminService,
  AdminAttendanceRecord,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminAttendanceTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminAttendanceTab: React.FC<AdminAttendanceTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [records, setRecords] = useState<AdminAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Safe delete modal
  const [selectedRecord, setSelectedRecord] = useState<AdminAttendanceRecord | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const list = await platformAdminService.getAttendance(tenantId, {
        status: statusFilter,
        date: dateFilter,
      });
      setRecords(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load attendance records' });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, statusFilter, dateFilter]);

  const filteredRecords = (Array.isArray(records) ? records : []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.employee_name || '').toLowerCase().includes(q) ||
      (r.employee_code || '').toLowerCase().includes(q) ||
      (r.date || '').toLowerCase().includes(q)
    );
  });

  const handleDeleteClick = (record: AdminAttendanceRecord) => {
    setSelectedRecord(record);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase: string) => {
    if (!selectedRecord) return;
    try {
      const res = await platformAdminService.deleteAttendance(
        tenantId,
        selectedRecord.id,
        reason,
        confirmationPhrase
      );
      if (res.success) {
        setNotification({
          type: 'success',
          text: `Attendance record for ${selectedRecord.employee_name} on ${selectedRecord.date} was safely removed.`,
        });
        setDeleteModalOpen(false);
        setSelectedRecord(null);
        loadData();
        onRefreshParentCounts();
      } else {
        setNotification({ type: 'error', text: res.error || 'Failed to delete attendance record.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Deletion error occurred.' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search rider name or employee code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
            <option value="LEAVE">Leave</option>
            <option value="OFF">Rest Day</option>
          </select>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
          />

          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
            >
              Clear Date
            </button>
          )}
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 self-end sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Notifications */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* Records Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Date</th>
                <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold">Check In</th>
                <th className="py-2.5 px-4 font-semibold">Check Out</th>
                <th className="py-2.5 px-4 font-semibold text-center">Deliveries</th>
                <th className="py-2.5 px-4 font-semibold text-center">Overtime</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {loading && records.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading attendance records...
                  </td>
                </tr>
              ) : (!Array.isArray(filteredRecords) || filteredRecords.length === 0) ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No attendance records found matching filters.
                  </td>
                </tr>
              ) : (
                (Array.isArray(filteredRecords) ? filteredRecords : []).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {r.date}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        {r.employee_name}
                      </div>
                      <div className="text-[11px] text-slate-400">{r.employee_code}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          r.status === 'PRESENT'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : r.status === 'ABSENT'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : r.status === 'LEAVE'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{r.check_in || '-'}</td>
                    <td className="py-2.5 px-4 text-slate-500">{r.check_out || '-'}</td>
                    <td className="py-2.5 px-4 text-center font-medium">{r.deliveries_count}</td>
                    <td className="py-2.5 px-4 text-center font-medium">
                      {r.overtime_hours > 0 ? `${r.overtime_hours} hrs` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        onClick={() => handleDeleteClick(r)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Safe Delete Attendance Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safe Delete Modal */}
      {selectedRecord && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedRecord(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Attendance Record"
          recordIdentifier={`Attendance: ${selectedRecord.employee_name} (${selectedRecord.employee_code}) on ${selectedRecord.date}`}
          entityType="ATTENDANCE_RECORD"
          isLiveTenant={isLiveTenant}
        />
      )}
    </div>
  );
};
