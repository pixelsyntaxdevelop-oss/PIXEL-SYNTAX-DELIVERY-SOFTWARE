import React, { useState, useEffect } from 'react';
import {
  Ticket,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Ban,
  X,
  AlertTriangle,
  FileCheck2,
} from 'lucide-react';
import {
  platformAdminService,
  AdminFine,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminFinesTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminFinesTab: React.FC<AdminFinesTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [fines, setFines] = useState<AdminFine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [selectedFine, setSelectedFine] = useState<AdminFine | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');

  // Void modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await platformAdminService.getFines(tenantId, searchQuery, statusFilter);
      setFines(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load fines:', err);
      setFines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery, statusFilter]);

  const handleOpenEdit = (f: AdminFine) => {
    setSelectedFine(f);
    setEditFormData({
      fine_ticket_number: f.fine_ticket_number,
      plate_number: f.plate_number,
      amount: f.amount,
      liability: f.liability,
      status: f.status,
      fine_date: f.fine_date ? f.fine_date.substring(0, 10) : '',
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFine) return;
    if (!editReason.trim()) {
      alert('Please provide an audit reason for modifying fine record.');
      return;
    }
    const success = await platformAdminService.updateFine(tenantId, selectedFine.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update traffic fine.');
    }
  };

  const handleOpenVoid = (f: AdminFine) => {
    setSelectedFine(f);
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const handleExecuteVoid = async () => {
    if (!selectedFine) return;
    if (!voidReason.trim()) {
      alert('Please enter a reason to void this fine.');
      return;
    }
    const res = await platformAdminService.voidFine(tenantId, selectedFine.id, voidReason);
    if (res.success) {
      setVoidModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert(res.error || 'Failed to void fine.');
    }
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedFine) return;
    const res = await platformAdminService.deleteFine(
      tenantId,
      selectedFine.id,
      reason,
      confirmationPhrase
    );
    if (!res.success) throw new Error(res.error || 'Failed to delete traffic fine.');
    await loadData();
    onRefreshParentCounts();
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Ticket className="w-4 h-4 text-rose-600" />
            Traffic Fines Master Registry ({fines.length})
          </h3>
          <p className="text-xs text-slate-500">
            Audit, void, and correct police traffic fine records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticket #, plate, employee..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="DEDUCTED">DEDUCTED</option>
            <option value="PAID">PAID</option>
            <option value="VOID">VOID</option>
          </select>

          <button
            onClick={loadData}
            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            title="Refresh"
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
                <th className="py-3 px-4">Ticket Number</th>
                <th className="py-3 px-3">Plate</th>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Liability</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {(!Array.isArray(fines) || fines.length === 0) ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {loading ? 'Loading traffic fines...' : 'No fine records found for this tenant.'}
                  </td>
                </tr>
              ) : (
                (Array.isArray(fines) ? fines : []).map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {f.fine_ticket_number}
                    </td>
                    <td className="py-3 px-3 font-mono font-semibold">
                      {f.plate_number}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {f.employee_name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {f.fine_date?.substring(0, 10) || '-'}
                    </td>
                    <td className="py-3 px-3 font-bold text-rose-600 dark:text-rose-400">
                      AED {f.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800">
                        {f.liability}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          f.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : f.status === 'VOID'
                            ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 line-through'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">{f.source}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(f)}
                          className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          title="Edit Fine Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {f.status !== 'VOID' && (
                          <button
                            onClick={() => handleOpenVoid(f)}
                            className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/50"
                            title="Void Fine (Preferred over Deletion)"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedFine(f);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Safe Delete Fine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Fine Modal */}
      {editModalOpen && selectedFine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Traffic Fine Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Ticket Number</label>
                  <input
                    type="text"
                    value={editFormData.fine_ticket_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, fine_ticket_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Plate Number</label>
                  <input
                    type="text"
                    value={editFormData.plate_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, plate_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Amount (AED)</label>
                  <input
                    type="number"
                    value={editFormData.amount || 0}
                    onChange={(e) => setEditFormData({ ...editFormData, amount: Number(e.target.value) })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Liability</label>
                  <select
                    value={editFormData.liability || 'RIDER'}
                    onChange={(e) => setEditFormData({ ...editFormData, liability: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="RIDER">RIDER</option>
                    <option value="COMPANY">COMPANY</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Status</label>
                <select
                  value={editFormData.status || 'PENDING'}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="PENDING">PENDING</option>
                  <option value="DEDUCTED">DEDUCTED</option>
                  <option value="PAID">PAID</option>
                  <option value="VOID">VOID</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">
                  Required Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for modifying fine record..."
                  rows={2}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Save Changes (Audited)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModalOpen && selectedFine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Ban className="w-4 h-4 text-amber-600" />
                Void Traffic Fine
              </h3>
              <button onClick={() => setVoidModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Voiding preserves the audit trail while setting the fine status to VOID so it is not charged to the rider or company.
            </p>
            <div className="text-xs">
              <label className="block text-slate-500 mb-1">
                Void Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Explain why this fine is being voided (e.g. Police dismissed fine, disputed citation)..."
                rows={3}
                className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
              />
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setVoidModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteVoid}
                className="px-4 py-1.5 bg-amber-600 text-white text-xs font-bold rounded"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Modal */}
      {selectedFine && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Traffic Fine"
          recordIdentifier={`Ticket: ${selectedFine.fine_ticket_number} (AED ${selectedFine.amount} - Plate ${selectedFine.plate_number})`}
          entityType="TRAFFIC_FINE"
          isLiveTenant={isLiveTenant}
        />
      )}
    </div>
  );
};
