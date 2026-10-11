import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Search,
} from 'lucide-react';
import { DbDocumentType, DbEntityDocument, DocumentEntityType } from '../../types/database';
import { documentService, EntitySearchResult } from '../../services/documentService';

interface DocumentUploadFormProps {
  onBack: () => void;
  onSuccess: () => void;
  initialDoc?: DbEntityDocument | null;
  docTypes: DbDocumentType[];
}

export const DocumentUploadForm: React.FC<DocumentUploadFormProps> = ({
  onBack,
  onSuccess,
  initialDoc,
  docTypes,
}) => {
  const isEditMode = !!initialDoc;

  // Form Fields - Strictly Employee document upload
  const [entityType] = useState<DocumentEntityType>('Employee');
  const [selectedEntity, setSelectedEntity] = useState<EntitySearchResult | null>(
    initialDoc
      ? {
          id: initialDoc.entity_id,
          entityId: initialDoc.entity_id,
          name: initialDoc.entity_name || initialDoc.entity_id,
          type: 'Employee',
          code: (initialDoc as any).reference_number || initialDoc.document_number || '',
          branchName: initialDoc.branch || initialDoc.branch_name,
        }
      : null
  );
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [isSearchingEntity, setIsSearchingEntity] = useState(false);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter docTypes to ONLY employee document types
  const employeeDocTypes = docTypes.filter(
    (t) =>
      t.category === 'EMPLOYEE' ||
      t.category === 'OTHER' ||
      !t.category ||
      (t.category as string) === 'IDENTITY'
  );

  const [documentTypeId, setDocumentTypeId] = useState(
    initialDoc?.document_type_id || (employeeDocTypes.length > 0 ? employeeDocTypes[0].id : 'dt_eid')
  );
  const [branch, setBranch] = useState(
    initialDoc?.branch || initialDoc?.branch_name || 'Dubai Head Office'
  );
  const [state, setState] = useState(initialDoc?.state || 'Dubai');
  const [documentNumber, setDocumentNumber] = useState(initialDoc?.document_number || '');
  const [issueDate, setIssueDate] = useState(initialDoc?.issue_date || '');
  const [expiryDate, setExpiryDate] = useState(initialDoc?.expiry_date || '');
  const [issuingAuthority, setIssuingAuthority] = useState(initialDoc?.issuing_authority || '');
  const [description, setDescription] = useState(initialDoc?.description || '');

  // Files
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; size?: number; type?: string; dataUrl?: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Debounced search for Employee (min 3 chars)
  useEffect(() => {
    if (isEditMode || selectedEntity) {
      setSearchResults([]);
      return;
    }

    const trimmed = entitySearchQuery.trim();
    if (trimmed.length < 3) {
      setSearchResults([]);
      setIsSearchingEntity(false);
      return;
    }

    setIsSearchingEntity(true);
    const timer = setTimeout(async () => {
      try {
        const results = await documentService.searchEntities(trimmed, 'Employee');
        setSearchResults(results.slice(0, 20));
        setHighlightedIndex(-1);
      } catch (err) {
        console.error('Failed to search employees:', err);
      } finally {
        setIsSearchingEntity(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [entitySearchQuery, selectedEntity, isEditMode]);

  // Click outside to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowEntityDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle entity selection
  const handleSelectEntity = (entity: EntitySearchResult) => {
    setSelectedEntity(entity);
    setEntitySearchQuery('');
    setShowEntityDropdown(false);
    if (entity.branchName) {
      setBranch(entity.branchName);
    }
    setErrorMsg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showEntityDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setShowEntityDropdown(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
        handleSelectEntity(searchResults[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowEntityDropdown(false);
    }
  };

  // Adaptive label and placeholder based on selected document type
  const selectedDocType = employeeDocTypes.find((t) => t.id === documentTypeId);
  const getDocNumberConfig = () => {
    const nameLower = (selectedDocType?.name || '').toLowerCase();
    const code = selectedDocType?.code || '';

    if (code === 'DOC_PASSPORT' || nameLower.includes('passport')) {
      return { label: 'Passport Number', placeholder: 'e.g. A12345678' };
    }
    if (code === 'DOC_EID' || nameLower.includes('emirates id')) {
      return { label: 'Emirates ID Number', placeholder: 'e.g. XXX-XXXX-XXXXXXX-X' };
    }
    if (code === 'DOC_DL' || nameLower.includes('driving license')) {
      return { label: 'Driving License Number', placeholder: 'e.g. 1234567' };
    }
    if (code === 'DOC_VISA' || nameLower.includes('visa')) {
      return { label: 'Residence Visa / File Number', placeholder: 'e.g. 201/2024/1234567' };
    }
    if (code === 'DOC_LABOR' || nameLower.includes('labour')) {
      return { label: 'Labour Card / Work Permit Number', placeholder: 'e.g. 12345678' };
    }
    return { label: 'Document Number', placeholder: 'e.g. Document or Reference Number' };
  };

  const docNumConfig = getDocNumberConfig();

  // Handle local file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files: File[] = Array.from(e.target.files);

    files.forEach((file: File) => {
      if (file.size > 25 * 1024 * 1024) {
        setErrorMsg('File size exceeds maximum allowable limit of 25MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedFiles((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: event.target?.result as string,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Form Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedEntity) {
      setErrorMsg('Please select an employee.');
      return;
    }
    if (!documentTypeId) {
      setErrorMsg('Please select a document type.');
      return;
    }
    if (!documentNumber.trim()) {
      setErrorMsg(`${docNumConfig.label} is required.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        entity_type: 'Employee',
        entity_id: selectedEntity.id || selectedEntity.entityId,
        entity_name: selectedEntity.name,
        document_type_id: documentTypeId,
        document_number: documentNumber.trim(),
        branch: branch,
        state: state,
        issue_date: issueDate || undefined,
        expiry_date: expiryDate || undefined,
        issuing_authority: issuingAuthority || undefined,
        description: description || undefined,
      };

      if (attachedFiles.length > 0) {
        payload.file_data_url = attachedFiles[0].dataUrl;
        payload.file_name = attachedFiles[0].name;
        payload.original_file_name = attachedFiles[0].name;
        payload.file_size = attachedFiles[0].size || 524288;
        payload.mime_type = attachedFiles[0].type || 'application/pdf';
      }

      if (isEditMode && initialDoc) {
        await documentService.updateDocument(initialDoc.id, payload);
      } else {
        await documentService.uploadDocument(payload);
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb / Return */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Document Expiry Listing</span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-3 text-xs text-rose-700 dark:text-rose-400 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Form Container */}
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-5"
      >
        {/* ROW 1: EMPLOYEE SEARCHABLE DROPDOWN & DOCUMENT TYPE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* EMPLOYEE SEARCHABLE DROPDOWN */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Employee <span className="text-rose-500">*</span>
            </label>

            {selectedEntity ? (
              /* Selected Employee Summary Line */
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {selectedEntity.name}
                    </span>
                    {selectedEntity.code && (
                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold rounded">
                        {selectedEntity.code}
                      </span>
                    )}
                    {selectedEntity.status && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        • {selectedEntity.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Branch:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedEntity.branchName || branch || 'Dubai Head Office'}
                    </span>{' '}
                    • Current Project:{' '}
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {selectedEntity.projectName || 'Unassigned'}
                    </span>
                  </p>
                </div>

                {!isEditMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntity(null);
                      setEntitySearchQuery('');
                      setTimeout(() => {
                        setShowEntityDropdown(true);
                        searchInputRef.current?.focus();
                      }, 50);
                    }}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold px-2 py-1"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              /* Search Input */
              <div ref={dropdownRef} className="relative">
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Select Employee"
                    value={entitySearchQuery}
                    onFocus={() => setShowEntityDropdown(true)}
                    onChange={(e) => {
                      setEntitySearchQuery(e.target.value);
                      setShowEntityDropdown(true);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  {isSearchingEntity && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {entitySearchQuery && !isSearchingEntity && (
                    <button
                      type="button"
                      onClick={() => {
                        setEntitySearchQuery('');
                        setSearchResults([]);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showEntityDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {entitySearchQuery.trim().length < 3 ? (
                      <div className="p-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>Type at least 3 characters to search</span>
                      </div>
                    ) : isSearchingEntity ? (
                      <div className="p-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <span>Searching employees...</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
                        No employees found matching &quot;{entitySearchQuery}&quot;
                      </div>
                    ) : (
                      searchResults.map((emp, index) => (
                        <button
                          key={emp.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectEntity(emp);
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            index === highlightedIndex
                              ? 'bg-emerald-50 dark:bg-emerald-950/40'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {emp.name}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">
                              {emp.code || 'EMP'}
                              {emp.phone
                                ? ` • ${emp.phone}`
                                : emp.emiratesId
                                ? ` • ${emp.emiratesId}`
                                : ''}
                            </p>
                          </div>
                          <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {emp.status || 'Active'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DOCUMENT TYPE * */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              DOCUMENT TYPE <span className="text-rose-500">*</span>
            </label>
            <select
              value={documentTypeId}
              onChange={(e) => setDocumentTypeId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2.5 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            >
              {employeeDocTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {employeeDocTypes.length === 0 && (
                <>
                  <option value="dt_eid">Emirates ID</option>
                  <option value="dt_passport">Passport Copy</option>
                  <option value="dt_dl">Driving License</option>
                  <option value="dt_visa">Visa Copy</option>
                  <option value="dt_labor">Labour Card</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* ROW 2: DOCUMENT NUMBER, BRANCH, STATE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* DOCUMENT NUMBER */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {docNumConfig.label} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={docNumConfig.placeholder}
              value={documentNumber}
              onChange={(e) => setDocumentNumber(e.target.value)}
              required
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium font-mono"
            />
          </div>

          {/* BRANCH */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              BRANCH <span className="text-rose-500">*</span>
            </label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            >
              <option value="ALLIED DELIVERY SERVICES L.L.C">ALLIED DELIVERY SERVICES L.L.C</option>
              <option value="Dubai Head Office">Dubai Head Office</option>
              <option value="Abu Dhabi Central Branch">Abu Dhabi Central Branch</option>
              <option value="Sharjah Logistics Hub">Sharjah Logistics Hub</option>
            </select>
          </div>

          {/* STATE / EMIRATE */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              STATE / EMIRATE <span className="text-rose-500">*</span>
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            >
              <option value="Dubai">Dubai</option>
              <option value="Abu Dhabi Emirate">Abu Dhabi Emirate</option>
              <option value="Sharjah">Sharjah</option>
              <option value="Ajman">Ajman</option>
              <option value="Ras Al Khaimah">Ras Al Khaimah</option>
              <option value="Fujairah">Fujairah</option>
              <option value="Umm Al Quwain">Umm Al Quwain</option>
            </select>
          </div>
        </div>

        {/* ROW 3: ISSUE DATE, EXPIRY DATE, ISSUING AUTHORITY */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ISSUE DATE */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ISSUE DATE (OPTIONAL)
            </label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>

          {/* EXPIRY DATE */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              EXPIRY DATE {selectedDocType?.requires_expiry ? <span className="text-rose-500">*</span> : <span className="text-slate-400 font-normal">(OPTIONAL)</span>}
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>

          {/* ISSUING AUTHORITY */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ISSUING AUTHORITY (OPTIONAL)
            </label>
            <input
              type="text"
              placeholder="e.g. ICP UAE / RTA / MOHRE"
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
            />
          </div>
        </div>

        {/* ROW 4: DESCRIPTION / NOTES */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            NOTES (OPTIONAL)
          </label>
          <input
            type="text"
            placeholder="Additional notes or remarks..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 font-medium"
          />
        </div>

        {/* ROW 5: FILE ATTACHMENT */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            ATTACH DOCUMENT FILE {!isEditMode && <span className="text-rose-500">*</span>}
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer border border-slate-300 dark:border-slate-700 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Browse File (PDF, JPG, PNG)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-[11px] text-slate-400">Max size 25MB</span>
          </div>

          {/* List of Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachedFiles.map((f, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                    {f.size && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({(f.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM BUTTONS: Upload Document, Cancel */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            {isSubmitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Document...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>{isEditMode ? 'Update Document' : 'Upload Document'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
