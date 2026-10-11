import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import {
  platformAdminService,
  AdminSalik,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminSalikTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminSalikTab: React.FC<AdminSalikTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [salik, setSalik] = useState<AdminSalik[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [selectedSalik, setSelectedSalik] = useState<AdminSalik | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await platformAdminService.getSalik(tenantId, searchQuery);
      setSalik(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to load salik:', err);
      setSalik([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery]);

  const handleOpenEdit = (s: AdminSalik) => {
    setSelectedSalik(s);
    setEditFormData({
      transaction_id: s.transaction_id,
      plate_number: s.plate_number,
      toll_gate: s.toll_gate,
      amount: s.amount,
      status: s.status,
      trip_date: s.trip_date ? s.trip_date.substring(0, 10) : '',
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSalik) return;
    if (!editReason.trim()) {
      alert('Please provide an audit reason for modifying this Salik record.');
      return;
    }
    const success = await platformAdminService.updateSalik(tenantId, selectedSalik.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update Salik record.');
    }
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedSalik) return;
    const res = await platformAdminService.deleteSalik(
      tenantId,
      selectedSalik.id,
      reason,
      confirmationPhrase
    );
    if (!res.success) throw new Error(res.error || 'Failed to delete Salik record.');
    await loadData();
    onRefreshParentCounts();
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Landmark className="w-4 h-4 text-amber-600" />
            Salik Toll Gate Transactions ({salik.length})
          </h3>
          <p className="text-xs text-slate-500">
            Road toll trips, gate deductions, and vehicle mapping.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transaction, plate, gate..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-hidden focus:border-blue-500"
            />
          </div>

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
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-3">Trip Date</th>
                <th className="py-3 px-3">Toll Gate</th>
                <th className="py-3 px-3">Plate</th>
                <th className="py-3 px-3">Employee</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {(!Array.isArray(salik) || salik.length === 0) ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    {loading ? 'Loading Salik records...' : 'No Salik records found.'}
                  </td>
                </tr>
              ) : (
                (Array.isArray(salik) ? salik : []).map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {s.transaction_id}
                    </td>
                    <td className="py-3 px-3 text-slate-500">
                      {s.trip_date?.substring(0, 16) || '-'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {s.toll_gate}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold">
                      {s.plate_number}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {s.employee_name || 'Unassigned'}
                    </td>
                    <td className="py-3 px-3 font-bold text-amber-600 dark:text-amber-400">
                      AED {s.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400">{s.source}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          title="Edit Salik Record"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSalik(s);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                          title="Safe Delete Salik Record"
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

      {/* Edit Salik Modal */}
      {editModalOpen && selectedSalik && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Salik Transaction Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Transaction ID</label>
                  <input
                    type="text"
                    value={editFormData.transaction_id || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, transaction_id: e.target.value })}
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
                  <label className="block text-slate-500 mb-1">Toll Gate</label>
                  <input
                    type="text"
                    value={editFormData.toll_gate || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, toll_gate: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
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
              </div>
              <div>
                <label className="block text-slate-500 mb-1">
                  Required Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for modifying Salik toll record..."
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

      {/* Safe Delete Modal */}
      {selectedSalik && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Salik Transaction"
          recordIdentifier={`Transaction: ${selectedSalik.transaction_id} (Gate: ${selectedSalik.toll_gate} - AED ${selectedSalik.amount})`}
          entityType="SALIK"
          isLiveTenant={isLiveTenant}
        />
      )}
    </div>
  );
};
