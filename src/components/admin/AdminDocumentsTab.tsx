import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import {
  platformAdminService,
  AdminDocument,
} from '../../services/platformAdminService';
import { SafeDeleteModal } from './SafeDeleteModal';

interface AdminDocumentsTabProps {
  tenantId: string;
  isLiveTenant?: boolean;
  onRefreshParentCounts?: () => void;
}

export const AdminDocumentsTab: React.FC<AdminDocumentsTabProps> = ({
  tenantId,
  isLiveTenant = false,
  onRefreshParentCounts,
}) => {
  const [docs, setDocs] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Safe delete modal
  const [selectedDoc, setSelectedDoc] = useState<AdminDocument | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setNotification(null);
    try {
      const list = await platformAdminService.getDocuments(tenantId);
      setDocs(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to load documents' });
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const filteredDocs = (Array.isArray(docs) ? docs : []).filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.document_type?.toLowerCase().includes(q) ||
      d.employee_name?.toLowerCase().includes(q) ||
      d.employee_code?.toLowerCase().includes(q) ||
      d.document_number?.toLowerCase().includes(q)
    );
  });

  const handleDeleteClick = (doc: AdminDocument) => {
    setSelectedDoc(doc);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (reason: string, confirmationPhrase: string) => {
    if (!selectedDoc) return;
    try {
      const res = await platformAdminService.deleteDocument(
        tenantId,
        selectedDoc.id,
        reason,
        confirmationPhrase
      );
      if (res.success) {
        setNotification({
          type: 'success',
          text: `Document '${selectedDoc.document_type}' for ${selectedDoc.employee_name || 'Staff'} was safely removed.`,
        });
        setDeleteModalOpen(false);
        setSelectedDoc(null);
        loadData();
        if (onRefreshParentCounts) onRefreshParentCounts();
      } else {
        setNotification({ type: 'error', text: res.error || 'Failed to delete document record.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Deletion error occurred.' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            Tenant Document Metadata & Storage Registry ({docs.length})
          </h3>
          <p className="text-xs text-slate-500">
            Passports, visas, Emirates IDs, and driving licenses stored across this tenant.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search document type, employee..."
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

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-3">Document Type</th>
              <th className="py-3 px-3">Document Number</th>
              <th className="py-3 px-3">Expiry Date</th>
              <th className="py-3 px-3">Storage Status</th>
              <th className="py-3 px-3">Cloud Reference</th>
              <th className="py-3 px-3 text-center">Verification</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
            {(!Array.isArray(filteredDocs) || filteredDocs.length === 0) ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400">
                  {loading ? 'Scanning document storage...' : 'No document records found for this tenant.'}
                </td>
              </tr>
            ) : (
              (Array.isArray(filteredDocs) ? filteredDocs : []).map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {doc.employee_name || 'Unassigned'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {doc.employee_code || doc.employee_id}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-semibold uppercase text-slate-800 dark:text-slate-200">
                    {doc.document_type}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                    {doc.document_number || '-'}
                  </td>
                  <td className="py-3 px-3 text-slate-500">
                    {doc.expiry_date ? doc.expiry_date.substring(0, 10) : 'Not specified'}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        doc.storage_status === 'STORED'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : doc.storage_status === 'CLOUD_SYNCED'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      }`}
                    >
                      {doc.storage_status}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400 truncate max-w-xs">
                    {doc.cloud_reference || '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {doc.is_verified ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteClick(doc)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="Safe Delete Document Record"
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

      {/* Safe Delete Modal */}
      {selectedDoc && (
        <SafeDeleteModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedDoc(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Safe Delete Document Record"
          recordIdentifier={`Document: ${selectedDoc.document_type} (${selectedDoc.employee_name || 'Staff'} - ${selectedDoc.employee_code || selectedDoc.id})`}
          entityType="DOCUMENT"
          isLiveTenant={isLiveTenant}
        />
      )}
    </div>
  );
};
