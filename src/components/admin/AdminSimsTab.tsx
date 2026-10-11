import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  User,
} from 'lucide-react';
import {
  platformAdminService,
  AdminSim,
  DuplicateGroup,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminSimsTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminSimsTab: React.FC<AdminSimsTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [sims, setSims] = useState<AdminSim[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup<AdminSim>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'ALL' | 'DUPLICATES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [selectedSim, setSelectedSim] = useState<AdminSim | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [simList, dupList] = await Promise.all([
        platformAdminService.getSims(tenantId, searchQuery),
        platformAdminService.getDuplicateSims(tenantId),
      ]);
      setSims(Array.isArray(simList) ? simList : []);
      setDuplicates(Array.isArray(dupList) ? dupList : []);
    } catch (err) {
      console.error('Failed to load SIMs:', err);
      setSims([]);
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery]);

  const handleOpenDelete = (sim: AdminSim) => {
    setSelectedSim(sim);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedSim) return;
    const res = await platformAdminService.deleteSim(
      tenantId,
      selectedSim.id,
      reason,
      confirmationPhrase
    );
    if (!res.success) throw new Error(res.error || 'Failed to delete SIM.');
    await loadData();
    onRefreshParentCounts();
  };

  const handleOpenEdit = (sim: AdminSim) => {
    setSelectedSim(sim);
    setEditFormData({
      sim_number: sim.sim_number,
      provider: sim.provider,
      iccid: sim.iccid,
      status: sim.status,
      package_name: sim.package_name || '',
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSim) return;
    if (!editReason.trim()) {
      alert('Please provide an audit reason for editing this SIM record.');
      return;
    }
    const success = await platformAdminService.updateSim(tenantId, selectedSim.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update SIM record.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubView === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            All SIM Cards ({sims.length})
          </button>
          <button
            onClick={() => setActiveSubView('DUPLICATES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeSubView === 'DUPLICATES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Duplicate Detection ({duplicates.length})
          </button>
        </div>

        {activeSubView === 'ALL' && (
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search phone number, ICCID, provider..."
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
        )}
      </div>

      {activeSubView === 'ALL' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-3">Provider</th>
                  <th className="py-3 px-3">ICCID</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assigned Employee</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Package / Plan</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(!Array.isArray(sims) || sims.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading cellular inventory...' : 'No SIM records found for this tenant.'}
                    </td>
                  </tr>
                ) : (
                  (Array.isArray(sims) ? sims : []).map((sim) => (
                    <tr
                      key={sim.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {sim.sim_number}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">
                        {sim.provider}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {sim.iccid || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sim.status === 'Assigned'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                              : sim.status === 'Available'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {sim.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {sim.assigned_employee_name ? (
                          <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                            <User className="w-3 h-3 text-slate-400" />
                            {sim.assigned_employee_name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                        {sim.project_name || '-'}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-500">
                        {sim.package_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(sim)}
                            className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="Edit SIM Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenDelete(sim)}
                            className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Safe Delete"
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
      ) : (
        /* Duplicate SIMs Sub-Tab */
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Duplicate SIM Card Detection</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Matches are detected by tenant + Normalized Phone Number or ICCID. Safely delete orphan duplicate SIM records.
              </p>
            </div>
          </div>

          {duplicates.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                No Duplicate SIM Cards Found
              </p>
              <p className="text-xs">
                All SIM entries in this tenant have distinct phone numbers and ICCIDs.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(Array.isArray(duplicates) ? duplicates : []).map((group) => (
                <div
                  key={group.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs"
                >
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      Duplicate: {group.matchValue}
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(Array.isArray(group.records) ? group.records : []).map((rec, i) => (
                      <div
                        key={rec.id}
                        className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            SIM #{i + 1}: {rec.sim_number} ({rec.provider})
                          </span>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            Status: {rec.status} • Assigned: {rec.assigned_employee_name || 'None'} • ICCID: {rec.iccid || 'None'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenDelete(rec)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded border border-red-200 dark:border-red-900/50"
                        >
                          Delete SIM #{i + 1}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit SIM Modal */}
      {editModalOpen && selectedSim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit SIM Card Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={editFormData.sim_number || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, sim_number: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Provider</label>
                  <select
                    value={editFormData.provider || 'ETISALAT'}
                    onChange={(e) => setEditFormData({ ...editFormData, provider: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="ETISALAT">ETISALAT</option>
                    <option value="DU">DU</option>
                    <option value="VIRGIN">VIRGIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status</label>
                  <select
                    value={editFormData.status || 'Available'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="Available">Available</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Lost">Lost</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">ICCID</label>
                <input
                  type="text"
                  value={editFormData.iccid || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, iccid: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">
                  Required Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for modifying SIM card record..."
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
      {selectedSim && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Safe Delete SIM Card"
          recordIdentifier={`Phone: ${selectedSim.sim_number} (${selectedSim.provider})`}
          entityType="SIM_CARD"
          isLiveTenant={isLiveTenant}
          dependencies={
            selectedSim.assigned_employee_name
              ? {
                  activePointers: [
                    `Assigned Employee: ${selectedSim.assigned_employee_name} (will be unlinked)`,
                  ],
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
