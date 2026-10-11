import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Calendar,
  FileText,
  History,
  ShieldCheck,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { clientStorageService } from '../../services/fileStorageService';
import { DbEntityDocument } from '../../types/database';

interface DocumentReplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DbEntityDocument | null;
  onSuccess: (updatedDoc: any) => void;
  lang?: 'EN' | 'AR';
}

const COMMON_REASONS = [
  'Government Renewal / Extended Expiry',
  'Correction of Typographical Data',
  'Lost Document Replacement',
  'Updated Physical Card / Stamped Visa',
  'Annual Audit Re-verification',
  'Other Operational Reason',
];

export const DocumentReplaceModal: React.FC<DocumentReplaceModalProps> = ({
  isOpen,
  onClose,
  document,
  onSuccess,
  lang = 'EN',
}) => {
  if (!isOpen || !document) return null;

  const [documentNumber, setDocumentNumber] = useState(document.document_number || '');
  const [issueDate, setIssueDate] = useState(document.issue_date || '');
  const [expiryDate, setExpiryDate] = useState(document.expiry_date || '');
  const [replacementReason, setReplacementReason] = useState(COMMON_REASONS[0]);
  const [customReason, setCustomReason] = useState('');

  // File State
  const [file, setFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [mimeType, setMimeType] = useState('application/pdf');
  const [isDragging, setIsDragging] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nextVersionNumber = (document.current_version_number || 1) + 1;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (f: File) => {
    if (f.size > 25 * 1024 * 1024) {
      setError('File exceeds maximum allowable size of 25MB');
      return;
    }

    setFile(f);
    setFileName(f.name);
    setFileSize(f.size);
    setMimeType(f.type || 'application/pdf');
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalReason = replacementReason === 'Other Operational Reason' ? customReason.trim() : replacementReason;
    if (!finalReason) {
      setError('Replacement reason is mandatory to maintain compliance audit trails.');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      let updated: any;
      if (file) {
        updated = await clientStorageService.uploadDocumentDirectly(
          file,
          {
            entity_type: (document.entity_type === 'Rider' ? 'Employee' : document.entity_type) as any,
            entity_id: document.entity_id,
            entity_name: document.entity_name,
            document_type_id: document.document_type_id,
            document_number: documentNumber.trim(),
            issue_date: issueDate || undefined,
            expiry_date: expiryDate || undefined,
            replacement_reason: finalReason,
            is_replacement: true,
            parent_document_id: document.id,
          },
          (progress) => {
            setUploadProgress(progress);
          }
        );
      } else {
        updated = await documentService.replaceDocument(document.id, {
          document_number: documentNumber.trim(),
          issue_date: issueDate || undefined,
          expiry_date: expiryDate || undefined,
          replacement_reason: finalReason,
          file_name: fileName || `${document.document_type_name}_v${nextVersionNumber}.pdf`,
          original_file_name: fileName || `${document.document_type_name}_v${nextVersionNumber}.pdf`,
          mime_type: mimeType,
          file_size: fileSize || 524288,
          file_data_url: fileDataUrl || undefined,
        });
      }

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create new document version');
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-amber-500/5 dark:bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Renew / Replace Document (v{nextVersionNumber})
                </h3>
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] rounded-md">
                  Versioning Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {document.document_type_name} • {document.entity_name}
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-400 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Version Notice */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-300">Previous Version: v{document.current_version_number || 1}</p>
              <p className="text-slate-500 font-mono text-[11px]">Doc No: {document.document_number} • Expiry: {document.expiry_date || 'N/A'}</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-lg text-[10px]">
              Will be archived as historical record
            </span>
          </div>

          {/* Mandatory Replacement Reason */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Reason for Renewal / Replacement <span className="text-rose-500">*</span>
            </label>
            <select
              value={replacementReason}
              onChange={(e) => setReplacementReason(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {replacementReason === 'Other Operational Reason' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Specify exact operational reason..."
                required
                className="mt-2 w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            )}
          </div>

          {/* New Document Number */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              New Document / ID Number <span className="text-slate-400 font-normal">(if changed)</span>
            </label>
            <input
              type="text"
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* New Issue & Expiry Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                New Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
                New Expiry Date <span className="text-amber-600 font-bold">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* New File Attachment */}
          <div>
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">
              Upload Renewed Document Copy (PDF, JPG, PNG)
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10'
                  : fileName
                  ? 'border-emerald-500/50 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 bg-slate-50/50 dark:bg-slate-800/20'
              }`}
              onClick={() => window.document.getElementById('replace-file-upload-input')?.click()}
            >
              <input
                id="replace-file-upload-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={handleFileInput}
                className="hidden"
              />
              {fileName ? (
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-xs">{fileName}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{(fileSize / 1024).toFixed(0)} KB • Ready for version {nextVersionNumber}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="w-10 h-10 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Click or drag & drop new renewed document
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Creates version {nextVersionNumber} and updates timeline
                  </p>
                </div>
              )}
            </div>

            {uploadProgress !== null && (
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                  <span>Uploading New Version to Cloudflare R2...</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-amber-200 dark:bg-amber-900 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating Version {nextVersionNumber}...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Commit Version {nextVersionNumber}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
