import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Search,
  RefreshCw,
  Edit2,
  Archive,
  Users,
  X,
  AlertTriangle,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import {
  platformAdminService,
  AdminProject,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminProjectsTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminProjectsTab: React.FC<AdminProjectsTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AdminProject | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Safe delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<AdminProject | null>(null);

  const loadData = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const list = await platformAdminService.getProjects(tenantId);
      setProjects(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load projects' });
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleOpenEdit = (proj: AdminProject) => {
    setSelectedProject(proj);
    setEditFormData({
      name: proj.name,
      code: proj.code,
      client_name: proj.client_name || '',
      external_id_label: proj.external_id_label || 'External ID',
      status: proj.status,
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProject) return;
    if (!editReason.trim()) {
      alert('Please provide an audit reason.');
      return;
    }
    const success = await platformAdminService.updateProject(tenantId, selectedProject.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update project.');
    }
  };

  const handleArchive = async (proj: AdminProject) => {
    const confirm = window.confirm(`Archive project "${proj.name}"?`);
    if (!confirm) return;
    await platformAdminService.archiveProject(tenantId, proj.id, 'Archived via Platform Admin');
    await loadData();
    onRefreshParentCounts();
  };

  const handleDeleteClick = (proj: AdminProject) => {
    setProjectToDelete(proj);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase: string) => {
    if (!projectToDelete) return;
    try {
      const res = await platformAdminService.deleteProject(
        tenantId,
        projectToDelete.id,
        reason,
        confirmationPhrase
      );
      if (res.success) {
        setNotification({
          type: 'success',
          text: `Project '${projectToDelete.name}' was safely removed.`,
        });
        setDeleteModalOpen(false);
        setProjectToDelete(null);
        await loadData();
        onRefreshParentCounts();
      } else {
        setNotification({ type: 'error', text: res.error || 'Failed to delete project.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Deletion error occurred.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" />
            Tenant Projects & Accounts ({projects.length})
          </h3>
          <p className="text-xs text-slate-500">
            Delivery partner contracts and accounts.
          </p>
        </div>

        <button
          onClick={loadData}
          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Project Name</th>
              <th className="py-3 px-3">Code</th>
              <th className="py-3 px-3">Client Name</th>
              <th className="py-3 px-3">External ID Label</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Assigned Employees</th>
              <th className="py-3 px-4 text-right">Admin Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {(!Array.isArray(projects) || projects.length === 0) ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  {loading ? 'Loading projects...' : 'No project records found.'}
                </td>
              </tr>
            ) : (
              (Array.isArray(projects) ? projects : []).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {p.name}
                  </td>
                  <td className="py-3 px-3 font-mono font-semibold text-slate-600 dark:text-slate-300">
                    {p.code}
                  </td>
                  <td className="py-3 px-3">{p.client_name || '-'}</td>
                  <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                    {p.external_id_label || 'Rider ID'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                      <Users className="w-3 h-3 text-slate-400" />
                      {p.assigned_employees_count} active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        title="Edit Project"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {p.status === 'ACTIVE' && (
                        <button
                          onClick={() => handleArchive(p)}
                          className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/50"
                          title="Archive Project"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteClick(p)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="Safe Delete Project"
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

      {/* Edit Modal */}
      {editModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Project Master Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Project Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Code</label>
                  <input
                    type="text"
                    value={editFormData.code || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Client Name</label>
                  <input
                    type="text"
                    value={editFormData.client_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, client_name: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">External ID Label</label>
                  <input
                    type="text"
                    value={editFormData.external_id_label || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, external_id_label: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status</label>
                  <select
                    value={editFormData.status || 'ACTIVE'}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">
                  Required Audit Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for modifying project details..."
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
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Modal */}
      {projectToDelete && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setProjectToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Project"
          recordIdentifier={`Project: ${projectToDelete.name} (${projectToDelete.code})`}
          entityType="PROJECT"
          isLiveTenant={isLiveTenant}
        />
      )}
    </div>
  );
};
