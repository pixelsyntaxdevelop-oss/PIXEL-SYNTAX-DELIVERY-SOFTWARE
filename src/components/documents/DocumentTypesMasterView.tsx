import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { DbDocumentType, DocumentEntityType } from '../../types/database';
import { documentService } from '../../services/documentService';

interface DocumentTypesMasterViewProps {
  onBackToListing?: () => void;
}

export const DocumentTypesMasterView: React.FC<DocumentTypesMasterViewProps> = ({
  onBackToListing,
}) => {
  const [docTypes, setDocTypes] = useState<DbDocumentType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<DbDocumentType | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [allowedEntity, setAllowedEntity] = useState<string>('EMPLOYEE');
  const [requiresExpiry, setRequiresExpiry] = useState(true);
  const [requiresDocNumber, setRequiresDocNumber] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load document types from live backend
  const loadDocTypes = async () => {
    setIsLoading(true);
    try {
      const data = await documentService.getDocumentTypes();
      setDocTypes(data);
    } catch (err) {
      console.error('Failed to load document types:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocTypes();
  }, []);

  const handleOpenCreateModal = () => {
    setEditingType(null);
    setTitle('');
    setDescription('');
    setAllowedEntity('EMPLOYEE');
    setRequiresExpiry(true);
    setRequiresDocNumber(true);
    setIsActive(true);
    setShowAdvanced(false);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dt: DbDocumentType) => {
    setEditingType(dt);
    setTitle(dt.name);
    setDescription(dt.description || '');
    setAllowedEntity(dt.category || 'EMPLOYEE');
    setRequiresExpiry(dt.requires_expiry ?? true);
    setRequiresDocNumber(dt.requires_document_number ?? true);
    setIsActive(dt.is_active ?? true);
    setShowAdvanced(false);
    setErrorMsg(null);
    setIsModalOpen(true);
  };

  const handleSaveDocType = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('Document type title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingType) {
        // Update document type
        await documentService.updateDocumentType(editingType.id, {
          name: title.trim(),
          description: description.trim(),
          category: allowedEntity as any,
          requires_expiry: requiresExpiry,
          requires_document_number: requiresDocNumber,
          is_active: isActive,
        });
      } else {
        // Create document type
        await documentService.createDocumentType({
          name: title.trim(),
          description: description.trim(),
          category: allowedEntity as any,
          requires_expiry: requiresExpiry,
          requires_document_number: requiresDocNumber,
          is_active: isActive,
        });
      }
      setIsModalOpen(false);
      await loadDocTypes();
    } catch (err: any) {
      console.error('Save document type failed:', err);
      setErrorMsg(err.message || 'Failed to save document type.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveOrDelete = async (dt: DbDocumentType) => {
    if (confirm(`Are you sure you want to archive or disable "${dt.name}"? Existing historical documents will be preserved.`)) {
      try {
        await documentService.deleteDocumentType(dt.id);
        await loadDocTypes();
      } catch (err) {
        console.error('Archive document type failed:', err);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Document Types
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure system document categories, renewal tracking parameters, and validation rules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onBackToListing && (
            <button
              type="button"
              onClick={onBackToListing}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              ← Back to Expiry Listing
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create New</span>
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 border-collapse">
            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-4 py-3 font-bold">Title</th>
                <th className="px-4 py-3 font-bold">Description</th>
                <th className="px-4 py-3 font-bold">Category / Allowed Entity</th>
                <th className="px-4 py-3 font-bold text-center">Requires Expiry</th>
                <th className="px-4 py-3 font-bold text-center">Status</th>
                <th className="px-4 py-3 font-bold text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3.5"><div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="w-48 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3.5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="w-12 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" /></td>
                    <td className="px-4 py-3.5 text-center"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" /></td>
                  </tr>
                ))
              ) : docTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">No document types found</p>
                    <p className="text-xs text-slate-400 mt-0.5">Click + Create New above to add your first document type.</p>
                  </td>
                </tr>
              ) : (
                docTypes.map((dt) => (
                  <tr key={dt.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    {/* Title */}
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                      {dt.name}
                    </td>

                    {/* Description */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 max-w-md">
                      {dt.description || '—'}
                    </td>

                    {/* Allowed Entity */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {dt.category || 'EMPLOYEE'}
                      </span>
                    </td>

                    {/* Requires Expiry */}
                    <td className="px-4 py-3 text-center">
                      {dt.requires_expiry !== false ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          dt.is_active !== false
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {dt.is_active !== false ? 'Active' : 'Archived'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(dt)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
                          title="Edit Document Type"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleArchiveOrDelete(dt)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                          title="Archive / Disable"
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

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingType ? 'Edit Document Type' : 'Create Document Type'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveDocType} className="p-5 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Title * */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Labor Card, Emirates ID, Mulkiya..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional description or statutory notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium resize-none"
                />
              </div>

              {/* Collapsible Advanced Settings */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span>Advanced Settings</span>
                  {showAdvanced ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-3.5 bg-white dark:bg-slate-900 space-y-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                    {/* Allowed Entity Type */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Allowed Entity Type
                      </label>
                      <select
                        value={allowedEntity}
                        onChange={(e) => setAllowedEntity(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700"
                      >
                        <option value="EMPLOYEE">Employee Only</option>
                        <option value="VEHICLE">Vehicle Only</option>
                        <option value="COMPANY">Company Only</option>
                        <option value="MULTIPLE">Multiple / Universal</option>
                      </select>
                    </div>

                    {/* Requires Expiry */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Requires Expiry Date Tracking
                      </span>
                      <input
                        type="checkbox"
                        checked={requiresExpiry}
                        onChange={(e) => setRequiresExpiry(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Requires Document Number */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Requires Document Number
                      </span>
                      <input
                        type="checkbox"
                        checked={requiresDocNumber}
                        onChange={(e) => setRequiresDocNumber(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Active */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        Active Status
                      </span>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                >
                  {isSubmitting ? 'Saving...' : editingType ? 'Save Changes' : 'Create Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
