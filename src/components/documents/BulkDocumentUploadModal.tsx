import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Trash2,
  Users,
  Building2,
  Truck,
  ShieldCheck,
} from 'lucide-react';
import {
  clientStorageService,
  BulkUploadItem,
  MAX_FILE_SIZE_BYTES,
} from '../../services/fileStorageService';
import { documentService } from '../../services/documentService';
import { DbDocumentType } from '../../types/database';

interface BulkDocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  lang?: 'EN' | 'AR';
}

export const BulkDocumentUploadModal: React.FC<BulkDocumentUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  lang = 'EN',
}) => {
  const [items, setItems] = useState<BulkUploadItem[]>([]);
  const [docTypes, setDocTypes] = useState<DbDocumentType[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  // Common default target entity (optional fallback)
  const [targetEntityType, setTargetEntityType] = useState<'Employee' | 'Vehicle' | 'Company'>('Employee');
  const [targetEntityId, setTargetEntityId] = useState('');
  const [targetEntityName, setTargetEntityName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      documentService.getDocumentTypes().then(setDocTypes).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(() => {
        documentService.searchEntities(searchQuery, targetEntityType).then(setSearchResults);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, targetEntityType]);

  if (!isOpen) return null;

  // Auto-detect document type from filename heuristics
  const detectDocumentType = (fileName: string, availableTypes: DbDocumentType[]): DbDocumentType | undefined => {
    const lower = fileName.toLowerCase();
    if (lower.includes('passport')) {
      return availableTypes.find((t) => t.id === 'dt_passport' || t.name.toLowerCase().includes('passport'));
    }
    if (lower.includes('eid') || lower.includes('emirates') || lower.includes('id')) {
      return availableTypes.find((t) => t.id === 'dt_eid' || t.name.toLowerCase().includes('emirates'));
    }
    if (lower.includes('visa') || lower.includes('residency')) {
      return availableTypes.find((t) => t.id === 'dt_visa' || t.name.toLowerCase().includes('visa'));
    }
    if (lower.includes('mulkiya') || lower.includes('registration') || lower.includes('bike')) {
      return availableTypes.find((t) => t.id === 'dt_mulkiya' || t.name.toLowerCase().includes('mulkiya'));
    }
    if (lower.includes('license') || lower.includes('dl')) {
      return availableTypes.find((t) => t.id === 'dt_dl' || t.name.toLowerCase().includes('driving'));
    }
    return availableTypes[0];
  };

  const handleFilesAdded = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const newItems: BulkUploadItem[] = [];
    Array.from(fileList).forEach((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) return; // Ignore files > 10MB

      const detected = detectDocumentType(file.name, docTypes);
      const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      newItems.push({
        id,
        file,
        entityType: targetEntityType,
        entityId: targetEntityId || 'emp_bulk',
        entityName: targetEntityName || 'Unassigned Document Batch',
        documentTypeId: detected?.id || docTypes[0]?.id || 'dt_misc',
        documentTypeName: detected?.name || 'General Document',
        documentNumber: `DOC-${Date.now().toString().slice(-6)}`,
        status: 'Queued',
        progress: 0,
      });
    });

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesAdded(e.dataTransfer.files);
  };

  const removeItem = (id: string) => {
    if (isProcessing) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, updates: Partial<BulkUploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  // Start Batch Upload Process
  const startBulkUpload = async () => {
    if (items.length === 0 || isProcessing) return;

    setIsProcessing(true);
    await clientStorageService.processBulkQueue(items, 3, (updated) => {
      setItems((prev) => {
        const next = prev.map((item) => (item.id === updated.id ? updated : item));
        const completed = next.filter((i) => i.status === 'Uploaded').length;
        setOverallProgress(Math.round((completed / next.length) * 100));
        return next;
      });
    });

    setIsProcessing(false);
    onSuccess();
  };

  // Retry only failed items
  const retryFailed = async () => {
    const failedItems = items.filter((i) => i.status === 'Failed');
    if (failedItems.length === 0) return;

    // Reset status to Queued
    setItems((prev) =>
      prev.map((i) => (i.status === 'Failed' ? { ...i, status: 'Queued', progress: 0, error: undefined } : i))
    );

    setIsProcessing(true);
    await clientStorageService.processBulkQueue(
      items.filter((i) => i.status === 'Failed' || i.status === 'Queued'),
      3,
      (updated) => {
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
    );
    setIsProcessing(false);
    onSuccess();
  };

  const completedCount = items.filter((i) => i.status === 'Uploaded').length;
  const failedCount = items.filter((i) => i.status === 'Failed').length;
  const queuedCount = items.filter((i) => i.status === 'Queued' || i.status === 'Uploading').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center border border-orange-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Bulk Document Upload
                </h3>
                <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 font-bold text-[10px] rounded-md border border-orange-200 dark:border-orange-800">
                  Concurrency: 3 Parallel
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload and save multiple documents securely
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Entity Assignment Bar */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Default Target Assignment (Optional - applies to newly added files)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <select
                  value={targetEntityType}
                  onChange={(e) => {
                    setTargetEntityType(e.target.value as any);
                    setTargetEntityId('');
                    setTargetEntityName('');
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  <option value="Employee">Assign to Employee</option>
                  <option value="Vehicle">Assign to Fleet Vehicle</option>
                  <option value="Company">Assign to Company / HQ</option>
                </select>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder={`Search ${targetEntityType} name or ID...`}
                  value={targetEntityName || searchQuery}
                  onChange={(e) => {
                    setTargetEntityName('');
                    setSearchQuery(e.target.value);
                  }}
                  className="w-full text-xs font-semibold px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                />

                {searchResults.length > 0 && !targetEntityName && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-40 overflow-y-auto p-1">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setTargetEntityId(r.id);
                          setTargetEntityName(r.label || r.name);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{r.label || r.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{r.code || r.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              isDragging
                ? 'border-orange-500 bg-orange-50/20 dark:bg-orange-950/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-orange-400'
            }`}
          >
            <Upload className="w-8 h-8 text-orange-500 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Drag & Drop PDF or Image documents here
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Supports simultaneous multiple selection • 10MB maximum per file
            </p>
            <label className="mt-3 inline-block px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs transition-colors">
              Browse Files
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => handleFilesAdded(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {/* Queue Items Table */}
          {items.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>Upload Queue ({items.length} files)</span>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-emerald-600 font-semibold">{completedCount} uploaded</span>
                  {failedCount > 0 && <span className="text-red-600 font-semibold">{failedCount} failed</span>}
                  <span className="text-slate-500">{queuedCount} remaining</span>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="p-3 bg-white dark:bg-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.file.name}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {(item.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <select
                          value={item.documentTypeId}
                          disabled={item.status === 'Uploaded' || item.status === 'Uploading'}
                          onChange={(e) => {
                            const found = docTypes.find((t) => t.id === e.target.value);
                            updateItem(item.id, {
                              documentTypeId: e.target.value,
                              documentTypeName: found?.name || 'Document',
                            });
                          }}
                          className="text-[11px] px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg truncate"
                        >
                          {docTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>

                        <span className="text-[11px] text-slate-500 truncate py-1 px-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          {item.entityName}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      {item.status === 'Uploading' && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                          <div
                            className="bg-orange-500 h-full rounded-full transition-all"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      )}

                      {item.error && (
                        <p className="text-[10px] text-red-600 dark:text-red-400 mt-1">{item.error}</p>
                      )}
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 flex items-center gap-2">
                      {item.status === 'Uploaded' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Done
                        </span>
                      )}
                      {item.status === 'Uploading' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-2 py-1 rounded-lg border border-orange-200 dark:border-orange-800">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          {item.progress}%
                        </span>
                      )}
                      {item.status === 'Failed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-lg border border-red-200 dark:border-red-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Failed
                        </span>
                      )}
                      {item.status === 'Queued' && (
                        <span className="text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                          Queued
                        </span>
                      )}

                      {!isProcessing && item.status !== 'Uploaded' && (
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Files are saved securely</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {failedCount > 0 && (
              <button
                onClick={retryFailed}
                disabled={isProcessing}
                className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800 transition-colors"
              >
                Retry Failed ({failedCount})
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn-confirm-bulk-upload"
              onClick={startBulkUpload}
              disabled={items.length === 0 || isProcessing || items.every((i) => i.status === 'Uploaded')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Uploading Batch...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Upload All Documents ({items.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
