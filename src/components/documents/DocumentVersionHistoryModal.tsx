import React, { useEffect, useState } from 'react';
import {
  X,
  History,
  Download,
  Eye,
  CheckCircle2,
  FileText,
  Calendar,
  User,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { DbEntityDocument, DbDocumentVersion } from '../../types/database';

interface DocumentVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DbEntityDocument | null;
  onPreviewVersion?: (version: DbDocumentVersion) => void;
  lang?: 'EN' | 'AR';
}

export const DocumentVersionHistoryModal: React.FC<DocumentVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  document,
  onPreviewVersion,
  lang = 'EN',
}) => {
  const [versions, setVersions] = useState<DbDocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && document) {
      setLoading(true);
      documentService.getDocumentVersions(document.id)
        .then((data) => {
          // Sort newest version first
          const sorted = [...data].sort((a, b) => b.version_number - a.version_number);
          setVersions(sorted);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, document]);

  if (!isOpen || !document) return null;

  const handleDownloadVersion = async (version: DbDocumentVersion) => {
    try {
      const authDownload = await documentService.getDocumentDownloadUrl(document.id, version.id);
      window.open(authDownload.downloadUrl, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Document Version Vault
                </h3>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] rounded-md">
                  {versions.length} {versions.length === 1 ? 'Version' : 'Versions'} Recorded
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {document.document_type_name} • {document.entity_name} ({document.document_number})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Loading version ledger...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No version snapshots found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((ver) => (
                <div
                  key={ver.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    ver.is_current
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/60 shadow-xs ring-1 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-90'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black text-xs font-mono ${
                            ver.is_current
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          v{ver.version_number}
                        </span>
                        {ver.is_current && (
                          <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Current Active Version
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Doc #: {ver.document_number}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        <span className="font-bold text-slate-700 dark:text-slate-200">Reason: </span>
                        {ver.replacement_reason || 'Initial registration'}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 font-medium pt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {ver.uploaded_by}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {ver.uploaded_at?.substring(0, 10)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Expiry: {ver.expiry_date || 'No Expiry'}
                        </span>
                        <span className="font-mono text-slate-500">
                          {ver.file_size || '512 KB'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        onClick={() => handleDownloadVersion(ver)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
