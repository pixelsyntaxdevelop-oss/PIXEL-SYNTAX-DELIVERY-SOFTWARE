import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit2,
  Archive,
  Trash2,
  AlertTriangle,
  GitMerge,
  CheckCircle,
  X,
  Bike,
  Smartphone,
  FolderKanban,
  FileText,
} from 'lucide-react';
import {
  platformAdminService,
  AdminEmployee,
  DuplicateGroup,
  EmployeeDependencies,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminEmployeesTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  currentUserRole?: string;
  currentUserName?: string;
  onRefreshParentCounts: () => void;
}

export const AdminEmployeesTab: React.FC<AdminEmployeesTabProps> = ({
  tenantId,
  isLiveTenant,
  currentUserRole,
  currentUserName,
  onRefreshParentCounts,
}) => {
  const [employees, setEmployees] = useState<AdminEmployee[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup<AdminEmployee>[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubView, setActiveSubView] = useState<'ALL' | 'DUPLICATES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [selectedEmp, setSelectedEmp] = useState<AdminEmployee | null>(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');

  // Archive modal state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveDependencies, setArchiveDependencies] = useState<EmployeeDependencies | null>(null);
  const [loadingArchiveDeps, setLoadingArchiveDeps] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteDependencies, setDeleteDependencies] = useState<EmployeeDependencies | null>(null);
  const [loadingDeps, setLoadingDeps] = useState(false);

  // Merge modal state
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeGroup, setMergeGroup] = useState<DuplicateGroup<AdminEmployee> | null>(null);
  const [primaryRecordId, setPrimaryRecordId] = useState<string>('');
  const [mergeReason, setMergeReason] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, dupList] = await Promise.all([
        platformAdminService.getEmployees(tenantId, searchQuery, statusFilter),
        platformAdminService.getDuplicateEmployees(tenantId),
      ]);
      setEmployees(Array.isArray(empList) ? empList : []);
      setDuplicates(Array.isArray(dupList) ? dupList : []);
    } catch (err) {
      console.error('Failed to load employees data:', err);
      setEmployees([]);
      setDuplicates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery, statusFilter]);

  const handleOpenDelete = async (emp: AdminEmployee) => {
    setSelectedEmp(emp);
    setLoadingDeps(true);
    setDeleteModalOpen(true);
    try {
      const deps = await platformAdminService.getEmployeeDependencies(tenantId, emp.id);
      setDeleteDependencies(deps);
    } catch (err) {
      console.error('Failed to load dependencies:', err);
    } finally {
      setLoadingDeps(false);
    }
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedEmp) return;
    const res = await platformAdminService.deleteEmployee(
      tenantId,
      selectedEmp.id,
      reason,
      confirmationPhrase,
      deleteDependencies
    );
    if (!res.success) {
      throw new Error(res.error || 'Failed to delete employee.');
    }
    await loadData();
    onRefreshParentCounts();
  };

  const handleOpenArchive = async (emp: AdminEmployee) => {
    setSelectedEmp(emp);
    setArchiveReason('Archiving employee record via Platform Admin');
    setLoadingArchiveDeps(true);
    setArchiveModalOpen(true);
    try {
      const deps = await platformAdminService.getEmployeeDependencies(tenantId, emp.id);
      setArchiveDependencies(deps);
    } catch (err) {
      console.error('Failed to load dependencies for archive:', err);
    } finally {
      setLoadingArchiveDeps(false);
    }
  };

  const handleConfirmArchive = async () => {
    if (!selectedEmp) return;
    if (!archiveReason.trim()) {
      return;
    }
    const success = await platformAdminService.archiveEmployee(
      tenantId,
      selectedEmp.id,
      archiveReason,
      archiveDependencies
    );
    if (success) {
      setArchiveModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to archive employee.');
    }
  };

  const handleOpenEdit = (emp: AdminEmployee) => {
    setSelectedEmp(emp);
    setEditFormData({
      full_name: emp.full_name,
      employee_code: emp.employee_code,
      emirates_id_number: emp.emirates_id,
      personal_mobile: emp.mobile_number,
      designation: emp.designation || 'Rider',
      current_status: emp.current_status,
      project_name: emp.project_name,
      project_id: emp.project_id,
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEmp) return;
    if (!editReason.trim()) {
      alert('Please provide a reason for editing this master record.');
      return;
    }
    const success = await platformAdminService.updateEmployee(tenantId, selectedEmp.id, {
      ...editFormData,
      reason: editReason,
    });
    if (success) {
      setEditModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert('Failed to update employee master record.');
    }
  };

  const handleOpenMerge = (group: DuplicateGroup<AdminEmployee>) => {
    setMergeGroup(group);
    setPrimaryRecordId(group.records[0]?.id || '');
    setMergeReason('Duplicate consolidation via Platform Admin');
    setMergeModalOpen(true);
  };

  const handleExecuteMerge = async () => {
    if (!mergeGroup || !primaryRecordId) return;
    const duplicateRecord = mergeGroup.records.find((r) => r.id !== primaryRecordId);
    if (!duplicateRecord) return;

    const res = await platformAdminService.mergeDuplicateEmployees(
      tenantId,
      primaryRecordId,
      duplicateRecord.id,
      {},
      mergeReason
    );

    if (res.success) {
      setMergeModalOpen(false);
      await loadData();
      onRefreshParentCounts();
    } else {
      alert(res.error || 'Failed to merge duplicate employees.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Policy Notice & Sub-Tabs */}
      <div className="p-4 bg-slate-900 text-white rounded-xl border border-slate-800 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Employee Removal & Lifecycle Policy (Admin Panel Only)
                {isLiveTenant && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-600 text-white">
                    Live Tenant Protected
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Normal ERP users cannot delete employee records. Standard departures must use Exit/Termination status workflows.
                Platform Admins may <strong className="text-slate-200">Archive</strong> records (deactivates while preserving complete history)
                or <strong className="text-slate-200">Permanently Remove</strong> duplicate/test records under strict audit logs.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubView('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              activeSubView === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            All Employees ({employees.length})
          </button>
          <button
            onClick={() => setActiveSubView('DUPLICATES')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              activeSubView === 'DUPLICATES'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
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
                placeholder="Search name, code, EID, mobile..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white w-64 focus:outline-hidden focus:border-blue-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="Assigned / Active">Assigned / Active</option>
              <option value="Active (Unassigned)">Active (Unassigned)</option>
              <option value="On Leave">On Leave</option>
              <option value="Archived">Archived</option>
            </select>

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

      {/* Main Table View */}
      {activeSubView === 'ALL' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Emirates ID</th>
                  <th className="py-3 px-3">Mobile</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Project</th>
                  <th className="py-3 px-3">Bike Plate</th>
                  <th className="py-3 px-3">SIM</th>
                  <th className="py-3 px-3">Created</th>
                  <th className="py-3 px-4 text-right">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(!Array.isArray(employees) || employees.length === 0) ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      {loading ? 'Loading employees...' : 'No employee records found for this tenant.'}
                    </td>
                  </tr>
                ) : (
                  (Array.isArray(employees) ? employees : []).map((emp) => (
                    <tr
                      key={emp.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {emp.full_name}
                        {emp.is_archived && (
                          <span className="ml-2 px-1.5 py-0.5 text-[10px] rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {emp.employee_code || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {emp.emirates_id || '-'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {emp.mobile_number || '-'}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            emp.current_status.includes('Active')
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : emp.current_status === 'Archived'
                              ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          }`}
                        >
                          {emp.current_status}
                        </span>
                      </td>
                      <td className="py-3 px-3">{emp.project_name || '-'}</td>
                      <td className="py-3 px-3 font-mono">
                        {emp.current_bike_plate ? (
                          <span className="flex items-center gap-1 text-slate-900 dark:text-white">
                            <Bike className="w-3 h-3 text-slate-400" />
                            {emp.current_bike_plate}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {emp.current_sim_number ? (
                          <span className="flex items-center gap-1 text-slate-900 dark:text-white">
                            <Smartphone className="w-3 h-3 text-slate-400" />
                            {emp.current_sim_number}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[11px] text-slate-400">
                        {emp.created_at?.substring(0, 10) || '-'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedEmp(emp);
                              setViewModalOpen(true);
                            }}
                            className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="Edit Master Data"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!emp.is_archived && (
                            <button
                              onClick={() => handleOpenArchive(emp)}
                              className="p-1 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/50"
                              title="Archive Record (Safe)"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenDelete(emp)}
                            className="p-1 text-red-600 hover:text-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Permanently Remove (Admin Only)"
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
        /* Duplicate Employees Sub-Tab */
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Duplicate Employee Resolution Engine</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-300">
                Matches are detected by tenant + Emirates ID, tenant + Employee Code, or normalized mobile number.
                Duplicates are NEVER automatically deleted; software owners inspect and merge or delete safely.
              </p>
            </div>
          </div>

          {duplicates.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Zero Duplicates Detected
              </p>
              <p className="text-xs">
                All employee records in this tenant have unique Emirates IDs, Codes, and Phone Numbers.
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
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300">
                        {group.matchType} Conflict
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {group.matchValue}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenMerge(group)}
                      className="px-3 py-1 text-xs font-bold text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Merge & Deduplicate
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(Array.isArray(group.records) ? group.records : []).map((rec, i) => (
                      <div
                        key={rec.id}
                        className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-bold">Record #{i + 1}:</span>
                            <span className="font-bold text-slate-900 dark:text-white">{rec.full_name}</span>
                            <span className="font-mono text-slate-500">({rec.employee_code})</span>
                          </div>
                          <div className="text-slate-500 text-[11px] flex gap-3">
                            <span>EID: {rec.emirates_id || 'None'}</span>
                            <span>Mobile: {rec.mobile_number || 'None'}</span>
                            <span>Status: {rec.current_status}</span>
                            <span>Created: {rec.created_at?.substring(0, 10)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenDelete(rec)}
                            className="px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 rounded border border-red-200 dark:border-red-900/50"
                          >
                            Delete Record #{i + 1}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View Record Details Modal */}
      {viewModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Employee Master Inspection
              </h3>
              <button
                onClick={() => setViewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="py-4 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Record ID</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedEmp.id}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Tenant ID</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedEmp.tenant_id}</span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-slate-400 block">Full Name</span>
                <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedEmp.full_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Employee Code</span>
                  <span className="font-mono">{selectedEmp.employee_code || '-'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Emirates ID</span>
                  <span className="font-mono">{selectedEmp.emirates_id || '-'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Mobile</span>
                  <span className="font-mono">{selectedEmp.mobile_number || '-'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Designation</span>
                  <span>{selectedEmp.designation || '-'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Active Bike</span>
                  <span>{selectedEmp.current_bike_plate || 'Unassigned'}</span>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-400 block">Active SIM</span>
                  <span>{selectedEmp.current_sim_number || 'Unassigned'}</span>
                </div>
              </div>
              <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                <span className="text-slate-400 block">Created At & By</span>
                <span>{selectedEmp.created_at} by {selectedEmp.created_by}</span>
              </div>
            </div>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-right">
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Master Data Modal */}
      {editModalOpen && selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Edit Employee Master Record
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editFormData.full_name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 mb-1">Employee Code</label>
                  <input
                    type="text"
                    value={editFormData.employee_code || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, employee_code: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Emirates ID</label>
                  <input
                    type="text"
                    value={editFormData.emirates_id_number || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, emirates_id_number: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={editFormData.personal_mobile || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, personal_mobile: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Status</label>
                  <select
                    value={editFormData.current_status || 'Assigned / Active'}
                    onChange={(e) => setEditFormData({ ...editFormData, current_status: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                  >
                    <option value="Assigned / Active">Assigned / Active</option>
                    <option value="Active (Unassigned)">Active (Unassigned)</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Archived">Archived</option>
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
                  placeholder="Reason for modifying critical master data..."
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

      {/* Merge Modal */}
      {mergeModalOpen && mergeGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <GitMerge className="w-4 h-4 text-blue-600" />
                Merge Duplicate Employee Records
              </h3>
              <button onClick={() => setMergeModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Select which record to <strong>KEEP as Primary</strong>. The secondary record will be safely unlinked, merged, and deleted.
              </p>

              <div className="space-y-2">
                {(Array.isArray(mergeGroup.records) ? mergeGroup.records : []).map((rec, i) => (
                  <label
                    key={rec.id}
                    className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                      primaryRecordId === rec.id
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="primaryRecord"
                        checked={primaryRecordId === rec.id}
                        onChange={() => setPrimaryRecordId(rec.id)}
                        className="text-blue-600"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">
                        Keep Record #{i + 1}: {rec.full_name}
                      </span>
                      <span className="font-mono text-slate-500">({rec.employee_code})</span>
                    </div>
                    <div className="pl-5 text-[11px] text-slate-500 mt-1">
                      ID: {rec.id} • Emirates ID: {rec.emirates_id || 'None'} • Mobile: {rec.mobile_number || 'None'}
                    </div>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-slate-500 mb-1">
                  Merge Reason <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mergeReason}
                  onChange={(e) => setMergeReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setMergeModalOpen(false)}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-xs font-semibold rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteMerge}
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {selectedEmp && archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/60 rounded-lg text-amber-700 dark:text-amber-300">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Archive Employee (Preferred Action)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Safe Lifecycle Deactivation & Asset Clearance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setArchiveModalOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 font-medium">Target Employee</div>
                  <div className="text-[11px] font-mono text-slate-500">Tenant: {tenantId}</div>
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {selectedEmp.full_name}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Code</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedEmp.employee_code || '-'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase">Status</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedEmp.current_status}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300 space-y-1.5">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  Preserves Complete Historical Data
                </p>
                <p className="text-blue-800 dark:text-blue-400 leading-relaxed">
                  Archiving marks the employee as inactive and automatically unassigns active bikes, SIMs, and projects.
                  All historical payroll, traffic fines, Salik transactions, loans, and audit records remain 100% intact.
                </p>
              </div>

              {archiveDependencies && archiveDependencies.hasBlockingPointers && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Active pointers to be released:
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300">
                    {archiveDependencies.dependencies.activeBike && (
                      <li>Vehicle: {archiveDependencies.dependencies.activeBike.plate}</li>
                    )}
                    {archiveDependencies.dependencies.activeSim && (
                      <li>SIM Card: {archiveDependencies.dependencies.activeSim.simNumber}</li>
                    )}
                    {archiveDependencies.dependencies.activeProject && (
                      <li>Project: {archiveDependencies.dependencies.activeProject.name}</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Reason for Archiving <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="e.g., Rider left company / inactive profile / visa cancelled"
                  className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmArchive}
                disabled={!archiveReason.trim() || loadingArchiveDeps}
                className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Archive className="w-3.5 h-3.5" />
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safe Delete Modal */}
      {selectedEmp && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Employee"
          recordIdentifier={`${selectedEmp.full_name} (${selectedEmp.employee_code || selectedEmp.id})`}
          entityType="EMPLOYEE"
          isLiveTenant={isLiveTenant}
          metadata={{
            name: selectedEmp.full_name,
            code: selectedEmp.employee_code || '-',
            tenant: tenantId,
            status: selectedEmp.current_status,
          }}
          loading={loadingDeps}
          dependencies={
            deleteDependencies
              ? {
                  activePointers: [
                    deleteDependencies.dependencies.activeBike
                      ? `Active Bike Assignment: ${deleteDependencies.dependencies.activeBike.plate}`
                      : '',
                    deleteDependencies.dependencies.activeSim
                      ? `Active SIM Assignment: ${deleteDependencies.dependencies.activeSim.simNumber}`
                      : '',
                    deleteDependencies.dependencies.activeProject
                      ? `Active Project: ${deleteDependencies.dependencies.activeProject.name}`
                      : '',
                  ].filter(Boolean),
                  historicalCounts: [
                    {
                      label: 'Historical Projects',
                      count: deleteDependencies.dependencies.historicalProjectsCount,
                    },
                    {
                      label: 'Historical Bikes',
                      count: deleteDependencies.dependencies.historicalBikesCount,
                    },
                    {
                      label: 'Historical SIMs',
                      count: deleteDependencies.dependencies.historicalSimsCount,
                    },
                    {
                      label: 'Traffic Fines',
                      count: deleteDependencies.dependencies.trafficFinesCount,
                    },
                    {
                      label: 'Salik Tolls',
                      count: deleteDependencies.dependencies.salikTransactionsCount,
                    },
                    {
                      label: 'Payroll Records',
                      count: deleteDependencies.dependencies.payrollRecordsCount,
                    },
                    {
                      label: 'Loans',
                      count: deleteDependencies.dependencies.loansCount,
                      note: `${deleteDependencies.dependencies.activeLoansCount} active`,
                    },
                    {
                      label: 'Attendance Records',
                      count: deleteDependencies.dependencies.attendanceRecordsCount,
                    },
                    {
                      label: 'Audit Logs',
                      count: deleteDependencies.dependencies.auditLogsCount,
                    },
                  ],
                  warnings: [deleteDependencies.recommendation],
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
