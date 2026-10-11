import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  History,
  Building,
  User,
  ShieldCheck,
  Calendar,
  MapPin,
  Clock,
  ArrowRightLeft,
  FileText,
  Lock,
} from 'lucide-react';
import {
  platformAdminService,
  AdminPassportRecord,
  AdminPassportStats,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminPassportTabProps {
  tenantId: string;
  isLiveTenant: boolean;
  onRefreshParentCounts: () => void;
}

export const AdminPassportTab: React.FC<AdminPassportTabProps> = ({
  tenantId,
  isLiveTenant,
  onRefreshParentCounts,
}) => {
  const [passports, setPassports] = useState<AdminPassportRecord[]>([]);
  const [stats, setStats] = useState<AdminPassportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WITH_COMPANY' | 'WITH_RIDER'>('ALL');

  // History Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedPassportForHistory, setSelectedPassportForHistory] = useState<AdminPassportRecord | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit Modal State
  const [selectedPassportForEdit, setSelectedPassportForEdit] = useState<AdminPassportRecord | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [editReason, setEditReason] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPassportForDelete, setSelectedPassportForDelete] = useState<AdminPassportRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast / Alert banner
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 6000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, statsData] = await Promise.all([
        platformAdminService.getPassports(tenantId, searchQuery),
        platformAdminService.getPassportStats(tenantId),
      ]);
      setPassports(Array.isArray(list) ? list : []);
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load authoritative passport records:', err);
      showToast('error', 'Failed to load passport records: ' + (err?.message || 'Server error'));
      setPassports([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId, searchQuery]);

  // Filtered Passports
  const filteredPassports = passports.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  // History Handler
  const handleOpenHistory = async (record: AdminPassportRecord) => {
    setSelectedPassportForHistory(record);
    setHistoryModalOpen(true);
    setLoadingHistory(true);
    try {
      const logs = await platformAdminService.getPassportHistory(tenantId, record.id);
      setHistoryLogs(Array.isArray(logs) ? logs : []);
    } catch (err: any) {
      console.error('Failed to load passport history:', err);
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Edit Handler
  const handleOpenEdit = (record: AdminPassportRecord) => {
    setSelectedPassportForEdit(record);
    setEditFormData({
      current_location: record.current_location || record.safe_location || '',
      current_handler: record.current_handler || '',
      branch_name: record.branch_name || '',
      passport_expiry: record.passport_expiry || record.expiry_date || '',
      notes: record.notes || '',
    });
    setEditReason('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPassportForEdit) return;
    if (!editReason.trim() || editReason.trim().length < 5) {
      alert('Audit Requirement: Please provide a descriptive reason for editing (min 5 characters).');
      return;
    }
    setSavingEdit(true);
    try {
      const ok = await platformAdminService.updatePassport(tenantId, selectedPassportForEdit.id, {
        ...editFormData,
        reason: editReason,
      });
      if (ok) {
        showToast('success', `Passport record ${selectedPassportForEdit.serial_number} updated with audit trail.`);
        setEditModalOpen(false);
        await loadData();
        onRefreshParentCounts();
      } else {
        showToast('error', 'Failed to update passport record.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Update failed.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Safe Delete Handler
  const handleOpenDelete = (record: AdminPassportRecord) => {
    setSelectedPassportForDelete(record);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase?: string) => {
    if (!selectedPassportForDelete) return;
    setDeleteLoading(true);
    try {
      const res = await platformAdminService.deletePassport(
        tenantId,
        selectedPassportForDelete.id,
        reason,
        confirmationPhrase
      );
      if (!res.success) {
        throw new Error(res.error || 'Failed to delete passport record.');
      }
      showToast(
        'success',
        `Passport record ${selectedPassportForDelete.serial_number} for ${selectedPassportForDelete.employee_name} (${selectedPassportForDelete.employee_code}) was safely deleted. Master employee remains intact.`
      );
      setDeleteModalOpen(false);
      setSelectedPassportForDelete(null);
      await loadData();
      onRefreshParentCounts();
    } catch (err: any) {
      throw err;
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalRecords = stats?.totalTracked ?? passports.length;
  const withCompanyCount = stats?.withCompany ?? passports.filter((p) => p.status === 'WITH_COMPANY').length;
  const withRiderCount = stats?.withRider ?? passports.filter((p) => p.status === 'WITH_RIDER').length;

  return (
    <div className="space-y-5" id="admin-passport-tab">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between border shadow-sm transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span className="font-medium">{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards: Authoritative Production Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Records */}
        <div
          className={`p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-xs transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          onClick={() => setStatusFilter('ALL')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Passport Records
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {totalRecords}
            </span>
            <span className="text-xs text-slate-400 font-medium">Authoritative custody</span>
          </div>
        </div>

        {/* With Company */}
        <div
          className={`p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-xs transition-all cursor-pointer ${
            statusFilter === 'WITH_COMPANY'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          onClick={() => setStatusFilter('WITH_COMPANY')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              With Company
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {withCompanyCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">In safe storage</span>
          </div>
        </div>

        {/* With Rider */}
        <div
          className={`p-4 bg-white dark:bg-slate-900 border rounded-xl shadow-xs transition-all cursor-pointer ${
            statusFilter === 'WITH_RIDER'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
          }`}
          onClick={() => setStatusFilter('WITH_RIDER')}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              With Rider
            </span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {withRiderCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">Temporarily released</span>
          </div>
        </div>
      </div>

      {/* Controls & Search Bar */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search employee name, code, Emirates ID, or passport number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons & Refresh */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All ({passports.length})
            </button>
            <button
              onClick={() => setStatusFilter('WITH_COMPANY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                statusFilter === 'WITH_COMPANY'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Company ({withCompanyCount})
            </button>
            <button
              onClick={() => setStatusFilter('WITH_RIDER')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                statusFilter === 'WITH_RIDER'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Rider ({withRiderCount})
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Refresh authoritative passport data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Safety Notice for Admin Delete */}
      <div className="p-3.5 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Administrative Guardrail:</span> Deleting a passport record removes
          ONLY the physical custody tracker and its custody audit history. It NEVER deletes or alters the
          underlying master employee record, civil identity, or other employee assets.
        </div>
      </div>

      {/* Table: Passport Records */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">Serial</th>
                <th className="py-3 px-3.5">Employee Name & Code</th>
                <th className="py-3 px-3.5">Emirates ID</th>
                <th className="py-3 px-3.5">Passport Number</th>
                <th className="py-3 px-3.5">Passport Expiry</th>
                <th className="py-3 px-3.5">Custody Status</th>
                <th className="py-3 px-3.5">Branch</th>
                <th className="py-3 px-3.5">Storage Location</th>
                <th className="py-3 px-3.5">Receive Date</th>
                <th className="py-3 px-3.5">Return Date</th>
                <th className="py-3 px-3.5">Current Handler</th>
                <th className="py-3 px-3.5">Last Updated</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && passports.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    <span>Loading authoritative passport records...</span>
                  </td>
                </tr>
              ) : filteredPassports.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-600 dark:text-slate-300">No passport records found</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {searchQuery
                        ? 'Try adjusting your search query or status filter.'
                        : 'No passport custody records have been registered for this tenant.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPassports.map((record) => {
                  const isWithCompany = record.status === 'WITH_COMPANY';
                  const returnDateDisplay = record.return_date || record.returned_to || '-';
                  const receiveDateDisplay = record.receive_date ? record.receive_date.substring(0, 10) : '-';
                  const updatedDateDisplay = record.updated_at
                    ? new Date(record.updated_at).toLocaleDateString('en-GB')
                    : '-';

                  return (
                    <tr
                      key={record.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      id={`passport-row-${record.id}`}
                    >
                      {/* Serial Number */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {record.serial_number || record.passport_serial || '-'}
                      </td>

                      {/* Employee Name & Code */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {record.employee_name || 'Unknown Employee'}
                        </div>
                        <div className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-semibold">
                          {record.employee_code || '-'}
                        </div>
                      </td>

                      {/* Emirates ID */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {record.emirates_id || '-'}
                      </td>

                      {/* Passport Number */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {record.passport_number || '-'}
                      </td>

                      {/* Passport Expiry */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {record.passport_expiry || record.expiry_date || '-'}
                      </td>

                      {/* Custody Status */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight ${
                            isWithCompany
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isWithCompany ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                          />
                          {isWithCompany ? 'With Company' : 'With Rider'}
                        </span>
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {record.branch_name || 'Allied Dubai HQ'}
                      </td>

                      {/* Storage Location */}
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap font-medium">
                        {record.current_location || record.safe_location || record.storage_detail || '-'}
                      </td>

                      {/* Receive Date */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {receiveDateDisplay}
                      </td>

                      {/* Return Date */}
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {returnDateDisplay}
                      </td>

                      {/* Current Handler */}
                      <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {record.current_handler || '-'}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3 px-3.5 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap text-[11px]">
                        {updatedDateDisplay}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {/* View History */}
                          <button
                            onClick={() => handleOpenHistory(record)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="View Custody History"
                            id={`btn-history-${record.id}`}
                          >
                            <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(record)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Passport Custody"
                            id={`btn-edit-${record.id}`}
                          >
                            <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleOpenDelete(record)}
                            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                            title="Safe Delete Passport Record"
                            id={`btn-delete-${record.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Count */}
        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white font-mono">{filteredPassports.length}</strong> of{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{passports.length}</strong> passport records
          </span>
          <span className="font-mono text-[11px] text-slate-400">Tenant: {tenantId}</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. VIEW HISTORY MODAL                                     */}
      {/* ========================================================= */}
      {historyModalOpen && selectedPassportForHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Passport Custody History
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {selectedPassportForHistory.employee_name} ({selectedPassportForHistory.employee_code}) -{' '}
                    <span className="font-mono font-semibold">{selectedPassportForHistory.passport_number}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Timeline */}
            <div className="p-5 overflow-y-auto space-y-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                  <span className="text-xs">Fetching immutable audit history...</span>
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                    No history events recorded
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Initial custody registration has no subsequent handovers yet.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {historyLogs.map((log, idx) => {
                    const eventType = log.event_type || log.action || 'CUSTODY_EVENT';
                    const isReceive = eventType.includes('RECEIVE') || eventType.includes('CREATED');
                    const isReturn = eventType.includes('RETURN');

                    return (
                      <div key={log.id || idx} className="relative group">
                        {/* Dot */}
                        <div
                          className={`absolute -left-6 top-1.5 w-4 h-4 rounded-full border-2 bg-white dark:bg-slate-900 ${
                            isReceive
                              ? 'border-emerald-500 text-emerald-500'
                              : isReturn
                              ? 'border-amber-500 text-amber-500'
                              : 'border-blue-500 text-blue-500'
                          }`}
                        />
                        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                                isReceive
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : isReturn
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              }`}
                            >
                              {eventType}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {log.created_at ? new Date(log.created_at).toLocaleString('en-GB') : '-'}
                            </span>
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Handler / Actor:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {log.handler || log.actor_name || log.created_by || 'System Admin'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Location / Destination:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {log.storage_location || log.returned_to || '-'}
                              </span>
                            </div>
                          </div>

                          {(log.remarks || log.notes || log.reason) && (
                            <div className="mt-2 text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-200/60 dark:border-slate-800">
                              <span className="font-semibold text-slate-500 text-[10px] block">Remarks / Reason:</span>
                              {log.remarks || log.notes || log.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT MODAL (With Mandatory Audit Reason)               */}
      {/* ========================================================= */}
      {editModalOpen && selectedPassportForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                    Edit Passport Custody Record
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Serial: <span className="font-mono font-bold">{selectedPassportForEdit.serial_number}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Employee Summary Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Employee:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedPassportForEdit.employee_name}
                  </span>
                  <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 block font-semibold">
                    {selectedPassportForEdit.employee_code}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Passport Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {selectedPassportForEdit.passport_number}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 block">
                    EID: {selectedPassportForEdit.emirates_id || '-'}
                  </span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Storage Location / Safe Locker
                  </label>
                  <input
                    type="text"
                    value={editFormData.current_location || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, current_location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Safe Locker A-12, Dubai HQ"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Current Handler
                    </label>
                    <input
                      type="text"
                      value={editFormData.current_handler || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, current_handler: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., HR Custody Officer"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.branch_name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, branch_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Allied Dubai HQ"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Passport Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editFormData.passport_expiry || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, passport_expiry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Custody Notes
                  </label>
                  <textarea
                    rows={2}
                    value={editFormData.notes || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    placeholder="Physical condition, safe compartment details..."
                  />
                </div>

                {/* Audit Reason */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Reason for Administrative Modification <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Mandatory audit log reason (min 5 characters)..."
                    className="w-full px-3 py-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    This modification will be permanently recorded in the immutable custody audit log.
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-lg text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || editReason.trim().length < 5}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              >
                {savingEdit && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Save Changes with Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. SAFE DELETE MODAL (Critical Safety Guardrails)         */}
      {/* ========================================================= */}
      {selectedPassportForDelete && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedPassportForDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Passport Custody Record"
          recordIdentifier={selectedPassportForDelete.serial_number || selectedPassportForDelete.id}
          entityType="Passport Custody Record"
          isLiveTenant={isLiveTenant}
          requireConfirmationPhrase={true}
          metadata={{
            name: selectedPassportForDelete.employee_name,
            code: `${selectedPassportForDelete.employee_code} | Passport: ${selectedPassportForDelete.passport_number}`,
            tenant: tenantId,
            status: selectedPassportForDelete.status === 'WITH_COMPANY' ? 'With Company' : 'With Rider',
          }}
          dependencies={{
            warnings: [
              'Delete ONLY the selected passport custody record and dependent custody history entries.',
              'NEVER deletes or modifies the master employee account.',
              'NEVER deletes or modifies other documents, SIMs, bikes, or fines.',
              'Action requires SUPER_ADMIN auth and is permanently audited.',
            ],
            historicalCounts: [
              {
                label: 'Custody Status',
                count: selectedPassportForDelete.status === 'WITH_COMPANY' ? 1 : 0,
                note: selectedPassportForDelete.status === 'WITH_COMPANY' ? 'Currently in company safe' : 'With rider',
              },
            ],
          }}
          loading={deleteLoading}
        />
      )}
    </div>
  );
};
