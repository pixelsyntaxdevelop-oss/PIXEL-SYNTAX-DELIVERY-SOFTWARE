import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  FileWarning,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Upload,
  Filter,
  Search,
  Download,
  Eye,
  RefreshCw,
  History,
  Trash2,
  Building2,
  User,
  Truck,
  Plus,
  FileArchive,
  ArrowUpDown,
  CheckSquare,
  Square,
  Sparkles,
  Cloud,
  Layers,
} from 'lucide-react';
import { documentService, EntitySearchResult } from '../../services/documentService';
import { clientStorageService } from '../../services/fileStorageService';
import {
  DbEntityDocument,
  DbDocumentType,
  DocumentExpiryDashboardSummary,
} from '../../types/database';
import { DocumentUploadModal } from '../documents/DocumentUploadModal';
import { DocumentReplaceModal } from '../documents/DocumentReplaceModal';
import { DocumentVersionHistoryModal } from '../documents/DocumentVersionHistoryModal';
import { DocumentPreviewModal } from '../documents/DocumentPreviewModal';
import { StorageDiagnosticsCard } from '../documents/StorageDiagnosticsCard';
import { BulkDocumentUploadModal } from '../documents/BulkDocumentUploadModal';

interface DocumentsVaultViewProps {
  lang?: 'EN' | 'AR';
}

export const DocumentsVaultView: React.FC<DocumentsVaultViewProps> = ({ lang = 'EN' }) => {
  const [documents, setDocuments] = useState<DbEntityDocument[]>([]);
  const [docTypes, setDocTypes] = useState<DbDocumentType[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savedPreviews, setSavedPreviews] = useState<Record<string, string>>({});
  const loadSequence = useRef(0);

  // Filters State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadedSearch, setLoadedSearch] = useState('');
  const [employeeResults, setEmployeeResults] = useState<EntitySearchResult[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EntitySearchResult | null>(null);
  const [searchEntityType, setSearchEntityType] = useState<'Employee' | 'Vehicle'>('Employee');
  const [uploadMode, setUploadMode] = useState<'Employee' | 'Vehicle'>('Employee');
  const previewCache = useRef(new Map<string, string>());
  const [entityType, setEntityType] = useState<string>('');
  const [documentTypeId, setDocumentTypeId] = useState<string>('');
  const [expiryRange, setExpiryRange] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<'entityName' | 'expiryDate' | 'createdAt' | 'docType'>('expiryDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Selected Documents for Bulk Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [showStorageDiagnostics, setShowStorageDiagnostics] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<DbEntityDocument | null>(null);
  const [historyDoc, setHistoryDoc] = useState<DbEntityDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DbEntityDocument | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(selectedEmployee ? search.trim() : ''), 350);
    return () => window.clearTimeout(timer);
  }, [search, selectedEmployee?.id, searchEntityType]);

  useEffect(() => {
    const q = search.trim();
    if (selectedEmployee || q.length < 2) { setEmployeeResults([]); return; }
    let current = true;
    const timer = window.setTimeout(() => {
      documentService.searchEntities(q, searchEntityType)
        .then((results) => { if (current) setEmployeeResults(results.slice(0, 8)); })
        .catch(() => { if (current) setEmployeeResults([]); });
    }, 300);
    return () => { current = false; window.clearTimeout(timer); };
  }, [search, selectedEmployee?.id]);

  // Types and analytics are page metadata: request them once, independently of search.
  useEffect(() => {
    let current = true;
    documentService.getDocumentTypes()
      .then((types) => { if (current) setDocTypes(types); })
      .catch(() => {});
    documentService.getExpiryDashboard()
      .then((data) => { if (current) setSummary(data); })
      .catch(() => {});
    return () => { current = false; };
  }, []);

  const loadVaultData = async () => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await documentService.getDocuments({
        entityType: selectedEmployee ? selectedEmployee.type : (entityType as any) || undefined,
        entityId: selectedEmployee?.id,
        documentTypeId: documentTypeId || undefined,
        expiryRange: expiryRange !== 'ALL' ? expiryRange : undefined,
        status: (status as any) || undefined,
        sortBy,
        sortOrder,
        pageSize: 100,
      });
      if (sequence === loadSequence.current) {
        setDocuments(result.documents);
        setLoadedSearch(debouncedSearch);
      }
    } catch (err: any) {
      if (sequence === loadSequence.current) {
        setDocuments([]);
        setLoadError(err?.message || 'Documents could not load');
      }
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, [selectedEmployee?.id, entityType, documentTypeId, expiryRange, status, sortBy, sortOrder]);

  useEffect(() => {
    if (!selectedEmployee || !documents.length) {
      setSavedPreviews({});
      return;
    }
    let current = true;
    const files = documents.filter((doc) => doc.current_file_name).slice(0, 12);
    const cached = Object.fromEntries(files
      .filter((doc) => previewCache.current.has(doc.id))
      .map((doc) => [doc.id, previewCache.current.get(doc.id)!]));
    setSavedPreviews(cached);
    // Avoid a burst of large PDF/image transfers while the user searches.
    const missing = files.filter((doc) => !previewCache.current.has(doc.id));
    const load = async () => {
      for (let index = 0; index < missing.length && current; index += 2) {
        const results = await Promise.allSettled(missing.slice(index, index + 2).map(async (doc) => ({
          id: doc.id,
          url: (await clientStorageService.getAuthorizedReadUrl(doc.id)).readUrl,
        })));
        if (!current) return;
        const next: Record<string, string> = {};
        for (const result of results) {
          if (result.status !== 'fulfilled') continue;
          next[result.value.id] = result.value.url;
          previewCache.current.set(result.value.id, result.value.url);
        }
        // Bound in-memory previews so browsing many employees does not slow the ERP.
        while (previewCache.current.size > 12) {
          const first = previewCache.current.keys().next().value;
          if (first === undefined) break;
          previewCache.current.delete(first);
        }
        setSavedPreviews((previous) => ({ ...previous, ...next }));
      }
    };
    void load();
    return () => { current = false; };
  }, [selectedEmployee?.id, documents]);

  const viewSavedFile = async (doc: DbEntityDocument) => {
    try {
      const file = await clientStorageService.getAuthorizedReadUrl(doc.id);
      const blob = await (await fetch(file.readUrl)).blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      setLoadError(err?.message || 'Document could not open');
    }
  };

  const downloadSavedFile = async (doc: DbEntityDocument) => {
    try {
      await clientStorageService.triggerFileDownload(doc.id, undefined, doc.current_file_name);
    } catch (err: any) {
      setLoadError(err?.message || 'Download failed');
    }
  };

  const grouped = new Map<string, DbEntityDocument[]>();
  for (const doc of documents) {
    const sided = ['dt_eid', 'dt_dl', 'dt_mulkiya'].includes(doc.document_type_id);
    const key = sided ? [doc.entity_type, doc.entity_id, doc.document_type_id].join(':') : doc.id;
    grouped.set(key, [...(grouped.get(key) || []), doc]);
  }
  const documentGroups = Array.from(grouped.values()).map((members) => {
    const front = members.find((item) => !/^back__/i.test(item.current_file_name || '') && !/\.pdf$/i.test(item.current_file_name || ''));
    const pdf = members.find((item) => /\.pdf$/i.test(item.current_file_name || ''));
    const primary = front || pdf || members[0];
    const back = front ? members.find((item) => /^back__/i.test(item.current_file_name || '')) : undefined;
    return { primary, back, members };
  });
  const visibleDocuments = documentGroups.map(({ primary }) => primary);
  const membersFor = (id: string) => documentGroups.find(({ primary }) => primary.id === id)?.members || [];
  const backFor = (id: string) => documentGroups.find(({ primary }) => primary.id === id)?.back;

  const handleSelectAll = () => {
    if (documents.length > 0 && documents.every((item) => selectedIds.includes(item.id))) {
      setSelectedIds([]);
    } else {
      setSelectedIds(documents.map((d) => d.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    const ids = membersFor(id).map((item) => item.id);
    setSelectedIds((prev) => ids.every((item) => prev.includes(item))
      ? prev.filter((item) => !ids.includes(item))
      : Array.from(new Set([...prev, ...ids])));
  };

  const handleBulkDownload = async () => {
    if (selectedIds.length === 0) return;
    setDownloadingZip(true);
    try {
      await documentService.bulkDownloadZip(
        selectedIds,
        `ApexFleet_Document_Vault_Export_${Date.now()}.zip`
      );
      setFeedback(`Successfully bundled & downloaded ${selectedIds.length} documents as encrypted ZIP.`);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      alert(err?.message || 'Bulk download failed');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleArchive = async (doc: DbEntityDocument) => {
    const files = membersFor(doc.id);
    if (!window.confirm(`Archive ${doc.document_type_name} (${files.length} file${files.length === 1 ? '' : 's'}) for ${doc.entity_name}?`)) {
      return;
    }
    try {
      for (const file of files) {
        await documentService.archiveDocument(file.id, 'Archived from enterprise document vault workspace');
      }
      setFeedback('Document moved to compliance archive');
      setTimeout(() => setFeedback(null), 3000);
      loadVaultData();
    } catch (err: any) {
      alert(err?.message || 'Failed to archive document');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300 font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              {lang === 'EN' ? 'Enterprise Document Vault & Government Compliance' : 'خزينة المستندات والامتثال الحكومي'}
            </h2>
            <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-extrabold text-[10px] rounded-md uppercase tracking-wider">
              Step 3 System
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Multi-Tenant isolated document vault with Supabase Private Storage, automated expiry alerts, version tracking, and bulk export.'
              : 'خزينة مستندات موحدة ومعزولة متعددة المستأجرين مع تتبع الصلاحيات والنسخ السابقة والتحميل المجمع.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-r2-storage"
            onClick={() => setShowStorageDiagnostics(!showStorageDiagnostics)}
            className={`px-3.5 py-2.5 font-bold rounded-xl text-xs flex items-center gap-2 border transition-all ${
              showStorageDiagnostics
                ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <Cloud className="w-4 h-4 text-orange-500" />
            <span>Document Storage</span>
          </button>

          <button
            id="btn-open-bulk-r2-upload"
            onClick={() => setIsBulkUploadOpen(true)}
            className="px-3.5 py-2.5 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <Layers className="w-4 h-4 text-orange-400" />
            <span>Bulk Upload</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              onClick={handleBulkDownload}
              disabled={downloadingZip}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-500/20 transition-all"
            >
              <FileArchive className="w-4 h-4" />
              {downloadingZip ? 'Packaging ZIP...' : `Download ${documentGroups.filter(({ members }) => members.every((item) => selectedIds.includes(item.id))).length} Selected (.ZIP)`}
            </button>
          )}

          <button
            onClick={() => { setUploadMode('Employee'); setIsUploadOpen(true); }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all shrink-0"
          >
            <Upload className="w-4 h-4" />
            {lang === 'EN' ? 'Employee Document Boxes' : 'ملفات الموظف'}
          </button>
          <button
            onClick={() => { setUploadMode('Vehicle'); setIsUploadOpen(true); }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm shrink-0"
          >
            <Truck className="w-4 h-4" /> Vehicle Document Boxes
          </button>
        </div>
      </div>

      {/* Cloudflare R2 Storage Diagnostics & Monitor */}
      {showStorageDiagnostics && (
        <StorageDiagnosticsCard onRefresh={loadVaultData} className="animate-in fade-in duration-200" />
      )}

      {/* Analytics KPI Metric Tiles */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => { setExpiryRange('ALL'); setStatus(''); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === 'ALL' && !status
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === 'ALL' && !status ? 'text-blue-100' : 'text-slate-500'}`}>
              Total Vaulted
            </p>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === 'ALL' && !status ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
              {summary.totalDocuments}
            </h3>
          </div>

          <div
            onClick={() => { setExpiryRange('EXPIRED'); setStatus(''); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === 'EXPIRED'
                ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === 'EXPIRED' ? 'text-rose-100' : 'text-rose-600'}`}>
                Expired
              </p>
              <AlertTriangle className={`w-3.5 h-3.5 ${expiryRange === 'EXPIRED' ? 'text-rose-100' : 'text-rose-600'}`} />
            </div>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === 'EXPIRED' ? 'text-white' : 'text-rose-600'}`}>
              {summary.expired}
            </h3>
          </div>

          <div
            onClick={() => { setExpiryRange('7_DAYS'); setStatus(''); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === '7_DAYS'
                ? 'bg-orange-600 text-white border-orange-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-200'
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === '7_DAYS' ? 'text-orange-100' : 'text-orange-600'}`}>
              ≤ 7 Days Critical
            </p>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === '7_DAYS' ? 'text-white' : 'text-orange-600'}`}>
              {summary.expiring7Days}
            </h3>
          </div>

          <div
            onClick={() => { setExpiryRange('15_DAYS'); setStatus(''); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === '15_DAYS'
                ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-200'
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === '15_DAYS' ? 'text-amber-100' : 'text-amber-600'}`}>
              ≤ 15 Days Warning
            </p>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === '15_DAYS' ? 'text-white' : 'text-amber-600'}`}>
              {summary.expiring15Days}
            </h3>
          </div>

          <div
            onClick={() => { setExpiryRange('30_DAYS'); setStatus(''); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === '30_DAYS'
                ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-200'
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === '30_DAYS' ? 'text-amber-100' : 'text-amber-600'}`}>
              ≤ 30 Days Notice
            </p>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === '30_DAYS' ? 'text-white' : 'text-amber-600'}`}>
              {summary.expiring30Days}
            </h3>
          </div>

          <div
            onClick={() => { setExpiryRange('VALID'); setStatus('VALID'); }}
            className={`p-4 rounded-2xl border transition-all cursor-pointer ${
              expiryRange === 'VALID'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-200'
            }`}
          >
            <p className={`text-[11px] font-bold uppercase tracking-wider ${expiryRange === 'VALID' ? 'text-emerald-100' : 'text-emerald-600'}`}>
              Valid / Healthy
            </p>
            <h3 className={`text-2xl font-black mt-1 ${expiryRange === 'VALID' ? 'text-white' : 'text-emerald-600'}`}>
              {summary.valid}
            </h3>
          </div>
        </div>
      )}

      {loadError && <div role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{loadError}</div>}

      {/* Advanced Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Box */}
          <div className="relative">
            <div className="flex gap-1 mb-2">
              {(['Employee', 'Vehicle'] as const).map((kind) => (
                <button key={kind} type="button" onClick={() => {
                  setSearchEntityType(kind); setSelectedEmployee(null); setSearch(''); setEmployeeResults([]);
                  setEntityType(kind); setDocumentTypeId('');
                }} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${searchEntityType === kind ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {kind === 'Employee' ? 'Employee name' : 'Vehicle plate'}
                </button>
              ))}
            </div>
            <Search className="w-4 h-4 absolute left-3.5 bottom-3 text-slate-400" />
            <input
              type="text"
              placeholder={searchEntityType === 'Vehicle' ? 'Search bike plate number...' : 'Search employee name...'}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedEmployee(null); }}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
            {employeeResults.length > 0 && !selectedEmployee && (
              <div className="absolute z-30 left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl divide-y divide-slate-100 dark:divide-slate-700">
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{searchEntityType} document boxes</p>
                {employeeResults.map((person) => (
                  <button key={person.id} type="button" onClick={() => { setSelectedEmployee(person); setSearch(person.name); setEmployeeResults([]); setIsUploadOpen(false); }} className="w-full px-3 py-3 text-left hover:bg-blue-50 dark:hover:bg-slate-800 min-h-12">
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">{person.name}</span>
                    <span className="block text-[11px] text-slate-500">{person.code || searchEntityType}{person.branchName ? ` · ${person.branchName}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Entity Type Filter */}
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="">All Entities (Employees, Vehicles, Company)</option>
            <option value="Employee">Employees & Riders</option>
            <option value="Vehicle">Vehicles & Bikes</option>
            <option value="Company">Company Corporate</option>
          </select>

          {/* Document Type Filter */}
          <select
            value={documentTypeId}
            onChange={(e) => setDocumentTypeId(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="">All Document Categories</option>
            {docTypes.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name}
              </option>
            ))}
          </select>

          {/* Expiry Window Filter */}
          <select
            value={expiryRange}
            onChange={(e) => setExpiryRange(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-hidden"
          >
            <option value="ALL">All Expiry Windows</option>
            <option value="EXPIRED">Expired Only</option>
            <option value="7_DAYS">Expires in 7 Days</option>
            <option value="15_DAYS">Expires in 15 Days</option>
            <option value="30_DAYS">Expires in 30 Days</option>
            <option value="60_DAYS">Expires in 60 Days</option>
            <option value="90_DAYS">Expires in 90 Days</option>
            <option value="VALID">Valid (No Immediate Alert)</option>
          </select>
        </div>
      </div>

      {selectedEmployee && !loading && documents.length > 0 && (
        <section aria-label="Matching entity documents" className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{selectedEmployee ? selectedEmployee.name + ' — Saved Documents' : 'Saved documents matching “' + search.trim() + '”'}</h3>
              {selectedEmployee && <p className="text-xs text-slate-500 mt-1">Uploaded documents appear here. Use the button to add missing documents.</p>}
            </div>
            {selectedEmployee && <button type="button" onClick={() => { setUploadMode(selectedEmployee.type === 'Vehicle' ? 'Vehicle' : 'Employee'); setIsUploadOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"><Upload className="w-4 h-4"/> Upload / Manage Documents</button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {documentGroups.map(({ primary: doc, back, members }) => {
              const preview = savedPreviews[doc.id];
              const backPreview = back ? savedPreviews[back.id] : '';
              const isPdf = /\.pdf$/i.test(doc.current_file_name || '');
              return <article key={doc.id} className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <p className="font-bold text-sm text-slate-900 dark:text-white">{doc.document_type_name}{back ? ' (Front + Back)' : ''}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 break-words">{doc.entity_name}</p>
                </div>
                <div className="h-44 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                  {preview ? (isPdf
                    ? <iframe title={`${doc.document_type_name} preview`} src={preview + '#toolbar=0&navpanes=0&scrollbar=0'} className="w-full h-full border-0 pointer-events-none"/>
                    : <div className="flex w-full h-full gap-1"><img src={preview} alt={`${doc.document_type_name} front`} className="min-w-0 flex-1 w-1/2 h-full object-contain"/>{back && (backPreview ? <img src={backPreview} alt={`${doc.document_type_name} back`} className="min-w-0 flex-1 w-1/2 h-full object-contain"/> : <span className="flex-1 self-center text-center text-xs text-slate-500">Back loading...</span>)}</div>) :
                    <FileWarning className="w-10 h-10 text-slate-400"/>}
                </div>
                <div className="p-4 space-y-3">
                  <p title={doc.current_file_name} className="text-xs text-slate-500 truncate">{doc.current_file_name || 'Saved file'}</p>
                  <p className="text-xs text-slate-600">Expiry: {doc.expiry_date || 'Not set'}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPreviewDoc(doc)} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs"><Eye className="w-4 h-4"/> View</button>
                    <button type="button" onClick={() => back ? setPreviewDoc(doc) : downloadSavedFile(doc)} className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 text-white font-bold text-xs"><Download className="w-4 h-4"/> Download</button>
                    <button type="button" onClick={() => handleArchive(doc)} aria-label={`Delete ${doc.document_type_name}`} className="inline-flex items-center justify-center px-3 rounded-lg bg-rose-50 text-rose-700" title="Delete document"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>
              </article>;
            })}
          </div>
        </section>
      )}


      {/* Main Documents Table */}
      {!selectedEmployee && !search.trim() && <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              {documents.length > 0 && documents.every((item) => selectedIds.includes(item.id)) ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              Select All ({visibleDocuments.length})
            </button>
            {selectedIds.length > 0 && (
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-lg">
                {selectedIds.length} Selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Sort by:</span>
            <button
              onClick={() => {
                if (sortBy === 'expiryDate') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                else { setSortBy('expiryDate'); setSortOrder('asc'); }
              }}
              className={`flex items-center gap-1 font-bold ${sortBy === 'expiryDate' ? 'text-blue-600' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Expiry Date <ArrowUpDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-bold">Querying Enterprise Document Vault...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <ShieldCheck className="w-10 h-10 mx-auto opacity-30 text-blue-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching document records found</p>
            <p className="text-xs text-slate-500">Try adjusting your filters or upload a new document to the vault.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold text-[11px] bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="p-3.5 w-8"></th>
                  <th className="p-3.5">Entity / Owner</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Document Details</th>
                  <th className="p-3.5">Version</th>
                  <th className="p-3.5">Expiry Date</th>
                  <th className="p-3.5">Days Left & Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documentGroups.map(({ primary: doc, back, members }) => {
                  const isSelected = members.every((item) => selectedIds.includes(item.id));
                  const isExpired = Boolean(doc.expiry_date) && doc.days_remaining != null && doc.days_remaining < 0;
                  const isExpiringSoon = Boolean(doc.expiry_date) && doc.days_remaining != null && doc.days_remaining >= 0 && doc.days_remaining <= 30;

                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleSelect(doc.id)}
                          className="text-slate-400 hover:text-blue-600"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Entity Name & Branch */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {doc.entity_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {doc.branch_name || 'Dubai Head Office'}
                        </div>
                      </td>

                      {/* Entity Type Badge */}
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] inline-flex items-center gap-1 ${
                            doc.entity_type === 'Employee'
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                              : doc.entity_type === 'Vehicle'
                              ? 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                              : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          }`}
                        >
                          {doc.entity_type === 'Employee' && <User className="w-3 h-3" />}
                          {doc.entity_type === 'Vehicle' && <Truck className="w-3 h-3" />}
                          {doc.entity_type === 'Company' && <Building2 className="w-3 h-3" />}
                          {doc.entity_type}
                        </span>
                      </td>

                      {/* Document Type & Number */}
                      <td className="p-3.5">
                        <div className="font-black text-slate-900 dark:text-white">
                          {doc.document_type_name}{back ? ' (Front + Back)' : ''}
                        </div>
                        <div className="text-[11px] font-mono font-bold text-slate-500">
                          {doc.document_number}
                        </div>
                      </td>

                      {/* Version Pill */}
                      <td className="p-3.5">
                        <button
                          onClick={() => setHistoryDoc(doc)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono font-black text-[10px] rounded-md border border-slate-200 dark:border-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          v{doc.current_version_number || 1}
                          <History className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      </td>

                      {/* Expiry Date */}
                      <td className="p-3.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {doc.expiry_date || 'Indefinite'}
                      </td>

                      {/* Days Left & Status Badge */}
                      <td className="p-3.5">
                        {isExpired ? (
                          <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Expired ({Math.abs(doc.days_remaining || 0)}d ago)
                          </span>
                        ) : isExpiringSoon ? (
                          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {doc.days_remaining} days left
                          </span>
                        ) : !doc.expiry_date ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-600 font-extrabold text-[10px] rounded-lg">Expiry not set</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10px] rounded-lg inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Valid
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            title="Preview Document & Audit Trail"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors font-bold text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => back ? setPreviewDoc(doc) : downloadSavedFile(doc)}
                            title={back ? 'Open both sides to download' : 'Download File'}
                            className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setReplacingDoc(doc)}
                            title="Renew / Replace with New Version"
                            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold rounded-lg text-[11px] transition-colors inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" /> Renew
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
        )}
      </div>}

      {!loading && selectedEmployee && documents.length === 0 && !loadError && <div className="p-8 text-center text-sm text-slate-500">
        {selectedEmployee ? <><p className="font-bold text-slate-700 dark:text-slate-300">{selectedEmployee.name} has no uploaded documents yet.</p><button type="button" onClick={() => setIsUploadOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white"><Upload className="w-4 h-4"/> Open Document Boxes</button></> : 'No saved documents match this search.'}
      </div>}

      {/* Modals */}
      <DocumentUploadModal
        isOpen={isUploadOpen}
        mode={uploadMode}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={() => {
          setFeedback('Document vaulted and synced with operational records');
          setTimeout(() => setFeedback(null), 3000);
          loadVaultData();
        }}
        lang={lang}
        preselectedEntityId={selectedEmployee?.type === uploadMode ? selectedEmployee.id : undefined}
        preselectedEntityName={selectedEmployee?.type === uploadMode ? selectedEmployee.name : undefined}
        preselectedEntityReferenceNumber={selectedEmployee?.type === uploadMode ? selectedEmployee.code : undefined}
      />

      <DocumentReplaceModal
        isOpen={Boolean(replacingDoc)}
        onClose={() => setReplacingDoc(null)}
        document={replacingDoc}
        onSuccess={() => {
          setFeedback('New document version committed to the vault');
          setTimeout(() => setFeedback(null), 3000);
          loadVaultData();
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
        pairedDocument={previewDoc ? backFor(previewDoc.id) : undefined}
        onReplace={(doc) => setReplacingDoc(doc)}
        lang={lang}
      />

      <BulkDocumentUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={() => {
          setIsBulkUploadOpen(false);
          setFeedback('Documents uploaded successfully');
          setTimeout(() => setFeedback(null), 4000);
          loadVaultData();
        }}
        lang={lang}
      />
    </div>
  );
};
