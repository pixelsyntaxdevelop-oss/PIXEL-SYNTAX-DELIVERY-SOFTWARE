import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Eye,
  RefreshCw,
  History,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Search,
  LayoutGrid,
  List,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import {
  DbEntityDocument,
  DocumentCompletenessReport,
} from '../../types/database';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentReplaceModal } from './DocumentReplaceModal';
import { DocumentVersionHistoryModal } from './DocumentVersionHistoryModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface DocumentsTabProps {
  entityType: 'Employee' | 'Vehicle' | 'Company';
  entityId: string;
  entityName: string;
  entityReferenceNumber?: string;
  lang?: 'EN' | 'AR';
}

export const DocumentsTab: React.FC<DocumentsTabProps> = ({
  entityType,
  entityId,
  entityName,
  entityReferenceNumber,
  lang = 'EN',
}) => {
  const [documents, setDocuments] = useState<DbEntityDocument[]>([]);
  const [completeness, setCompleteness] = useState<DocumentCompletenessReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<DbEntityDocument | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DbEntityDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DbEntityDocument | null>(null);

  // Bulk download state
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsResponse, compResponse] = await Promise.all([
        documentService.getDocuments({ entityType, entityId, pageSize: 100 }),
        documentService.getDocumentCompleteness(entityType, entityId),
      ]);
      setDocuments(docsResponse.documents);
      setCompleteness(compResponse);
    } catch (err: any) {
      setError(err?.message || 'Failed to load entity document vault');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [entityType, entityId]);

  const handleArchive = async (doc: DbEntityDocument) => {
    if (!confirm(`Are you sure you want to archive "${doc.document_type_name}"?`)) return;
    try {
      await documentService.archiveDocument(doc.id, 'Manual user archive');
      setFeedback('Document archived successfully');
      setTimeout(() => setFeedback(null), 3000);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to archive document');
    }
  };

  const handleBulkDownloadZip = async () => {
    if (documents.length === 0) return;
    setDownloadingZip(true);
    try {
      const docIds = documents.map((d) => d.id);
      await documentService.bulkDownloadZip(docIds, `${entityName.replace(/\s+/g, '_')}_documents.zip`);
      setFeedback('Vault download initiated');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to package document archive');
    } finally {
      setDownloadingZip(false);
    }
  };

  // Filtering
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch =
      doc.document_type_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.document_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.issuing_authority?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'VALID') {
      return doc.status === 'ACTIVE' && (doc.days_remaining === undefined || doc.days_remaining > 30);
    }
    if (statusFilter === 'EXPIRING_SOON') {
      return doc.days_remaining !== undefined && doc.days_remaining >= 0 && doc.days_remaining <= 30;
    }
    if (statusFilter === 'EXPIRED') {
      return doc.days_remaining !== undefined && doc.days_remaining < 0;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)} className="text-emerald-600 hover:text-emerald-800">
            &times;
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Completeness Banner */}
      {completeness && (
        <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${
                  completeness.completenessPercentage === 100
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {completeness.completenessPercentage}%
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Compliance & Document Readiness
                </h4>
                <p className="text-[11px] text-slate-500">
                  {completeness.mandatoryPresent} of {completeness.mandatoryTotal} required statutory documents uploaded
                </p>
              </div>
            </div>

            {completeness.missingDocumentTypes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500 font-semibold">Missing:</span>
                {completeness.missingDocumentTypes.map((missingName) => (
                  <span
                    key={missingName}
                    className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-semibold rounded-md border border-rose-200 dark:border-rose-800"
                  >
                    {missingName}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search document type, number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="VALID">Valid / Healthy</option>
            <option value="EXPIRING_SOON">Expiring Soon (≤30 Days)</option>
            <option value="EXPIRED">Expired</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View"
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="Card Grid View"
              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBulkDownloadZip}
            disabled={downloadingZip || documents.length === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {downloadingZip ? 'Packaging ZIP...' : 'Download (.ZIP)'}
          </button>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* 3. Document Content Display */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold">Accessing Secure Vault Records...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
            No Documents In Vault
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Upload passports, Emirates IDs, licenses, or contracts to ensure statutory compliance and expiry tracking.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Upload First Document
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW (Reference-style standard columns) */
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <table className="w-full text-left text-xs divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-4 py-3">Document Type</th>
                <th className="px-4 py-3">Document Number</th>
                <th className="px-4 py-3">Issue Date</th>
                <th className="px-4 py-3">Expiry Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uploaded At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {filteredDocs.map((doc) => {
                const isExpired = doc.days_remaining !== undefined && doc.days_remaining < 0;
                const isExpiringSoon =
                  doc.days_remaining !== undefined && doc.days_remaining >= 0 && doc.days_remaining <= 30;

                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          {doc.document_type_name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono rounded">
                          v{doc.current_version_number || 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 dark:text-slate-300 font-bold">
                      {doc.document_number}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {doc.issue_date || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          isExpired
                            ? 'text-rose-600 font-bold'
                            : isExpiringSoon
                            ? 'text-amber-600 font-bold'
                            : 'text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {doc.expiry_date || 'No Expiry'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isExpired ? (
                        <span className="px-2 py-0.5 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-[10px] rounded-md border border-rose-200 dark:border-rose-800 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> EXPIRED ({Math.abs(doc.days_remaining || 0)}d)
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold text-[10px] rounded-md border border-amber-200 dark:border-amber-800 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {doc.days_remaining}d Left
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] rounded-md border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> VALID
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] font-mono">
                      {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          title="View Document & Metadata"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors font-medium flex items-center gap-1 text-[11px]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={async () => {
                            const auth = await documentService.getDocumentDownloadUrl(doc.id);
                            window.open(auth.downloadUrl, '_blank');
                          }}
                          title="Download File"
                          className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setReplacingDoc(doc)}
                          title="Upload New Version / Renew"
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors font-medium flex items-center gap-1 text-[11px]"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Renew</span>
                        </button>
                        <button
                          onClick={() => setHistoryDoc(doc)}
                          title="Version History"
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleArchive(doc)}
                          title="Archive Document"
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            const isExpired = doc.days_remaining !== undefined && doc.days_remaining < 0;
            const isExpiringSoon =
              doc.days_remaining !== undefined && doc.days_remaining >= 0 && doc.days_remaining <= 30;

            return (
              <div
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700">
                      v{doc.current_version_number || 1}
                    </span>

                    {isExpired ? (
                      <span className="px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-[10px] rounded-lg border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> EXPIRED ({Math.abs(doc.days_remaining || 0)}d)
                      </span>
                    ) : isExpiringSoon ? (
                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold text-[10px] rounded-lg border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {doc.days_remaining}d Left
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> VALID
                      </span>
                    )}
                  </div>

                  {/* Document Title & Number */}
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    {doc.document_type_name}
                  </h4>
                  <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 mt-1">
                    {doc.document_number}
                  </p>

                  {/* Dates Details */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Issue Date:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {doc.issue_date || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Expiry Date:</span>
                      <span
                        className={`font-semibold ${
                          isExpired
                            ? 'text-rose-600 font-bold'
                            : isExpiringSoon
                            ? 'text-amber-600 font-bold'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {doc.expiry_date || 'No Expiry'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Uploaded At:</span>
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-GB') : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      title="View Document"
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl transition-colors font-bold flex items-center gap-1 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={async () => {
                        const auth = await documentService.getDocumentDownloadUrl(doc.id);
                        window.open(auth.downloadUrl, '_blank');
                      }}
                      title="Download File"
                      className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setHistoryDoc(doc)}
                      title="Version History"
                      className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReplacingDoc(doc)}
                      title="Upload New Version / Renew"
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-bold rounded-xl transition-colors flex items-center gap-1 text-[11px]"
                    >
                      <RefreshCw className="w-3 h-3" /> Renew
                    </button>
                    <button
                      onClick={() => handleArchive(doc)}
                      title="Archive Document"
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setFeedback('Document successfully uploaded to employee record');
          setTimeout(() => setFeedback(null), 3000);
          loadData();
        }}
        preselectedEntityType={entityType}
        preselectedEntityId={entityId}
        preselectedEntityName={entityName}
        preselectedEntityReferenceNumber={entityReferenceNumber}
        lang={lang}
      />

      <DocumentReplaceModal
        isOpen={Boolean(replacingDoc)}
        onClose={() => setReplacingDoc(null)}
        document={replacingDoc}
        onSuccess={() => {
          setFeedback('Document renewed/replaced. New version active in vault.');
          setTimeout(() => setFeedback(null), 3000);
          loadData();
        }}
        lang={lang}
      />

      <DocumentVersionHistoryModal
        isOpen={Boolean(historyDoc)}
        onClose={() => setHistoryDoc(null)}
        document={historyDoc}
        lang={lang}
      />

      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        document={previewDoc}
        onReplace={(doc) => setReplacingDoc(doc)}
        lang={lang}
      />
    </div>
  );
};
