import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  FileText,
  Layers,
  Sparkles,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';
import {
  DbDocumentType,
  DbEntityDocument,
  DocumentEntityType,
} from '../../types/database';
import {
  documentService,
  ExpiryDashboardStats,
  EntitySearchResult,
} from '../../services/documentService';
import { DocumentFilters } from '../documents/DocumentFilters';
import { DocumentKpiCards } from '../documents/DocumentKpiCards';
import { DocumentTypeSummaryCards } from '../documents/DocumentTypeSummaryCards';
import { DocumentTable } from '../documents/DocumentTable';
import { DocumentUploadForm } from '../documents/DocumentUploadForm';
import { DocumentTypesMasterView } from '../documents/DocumentTypesMasterView';
import { DocumentPreviewModal } from '../documents/DocumentPreviewModal';

interface DocumentExpiryListingViewProps {
  activeTab?: 'LISTING' | 'TYPES';
  onNavigateModule?: (module: string) => void;
  lang?: 'EN' | 'AR';
}

export const DocumentExpiryListingView: React.FC<DocumentExpiryListingViewProps> = ({
  activeTab = 'LISTING',
  onNavigateModule,
  lang = 'EN',
}) => {
  // Navigation & Sub-views: 'LIST' | 'UPLOAD_NEW' | 'TYPES'
  const [currentView, setCurrentView] = useState<'LIST' | 'UPLOAD_NEW' | 'TYPES'>(
    activeTab === 'TYPES' ? 'TYPES' : 'LIST'
  );

  // Filter States
  const [entityType, setEntityType] = useState<string>('');
  const [selectedEntity, setSelectedEntity] = useState<EntitySearchResult | null>(null);
  const [entitySearchQuery, setEntitySearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<EntitySearchResult[]>([]);
  const [isSearchingEntity, setIsSearchingEntity] = useState(false);
  const [showEntityDropdown, setShowEntityDropdown] = useState(false);

  const [documentTypeId, setDocumentTypeId] = useState<string>('ALL');
  const [state, setState] = useState<string>('');
  const [branch, setBranch] = useState<string>('');
  const [workingStatus, setWorkingStatus] = useState<string>('');
  const [expiryBucket, setExpiryBucket] = useState<string>('ALL');

  // Pagination & Data
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [documents, setDocuments] = useState<DbEntityDocument[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [stats, setStats] = useState<ExpiryDashboardStats | null>(null);
  const [docTypes, setDocTypes] = useState<DbDocumentType[]>([]);

  // Selection & Loading
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Modals & Inspection
  const [previewDoc, setPreviewDoc] = useState<DbEntityDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<DbEntityDocument | null>(null);

  // Prevent duplicate concurrent requests
  const isFetchingRef = useRef(false);

  // 1. Initial Master Data Load (Doc Types)
  useEffect(() => {
    documentService
      .getDocumentTypes()
      .then((types) => setDocTypes(types))
      .catch((err) => console.error('Failed to load document types:', err));
  }, []);

  // 2. Load Stats (Aggregated KPI & Summary from live backend)
  const loadDashboardStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const data = await documentService.getExpiryDashboard({
        entityType: entityType || undefined,
        branchId: branch || undefined,
        state: state || undefined,
      });
      setStats(data);
    } catch (err) {
      console.error('Failed to load document expiry stats:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, [entityType, branch, state]);

  // 3. Load Paginated Documents
  const loadDocuments = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsLoading(true);

    try {
      const res = await documentService.getDocuments({
        entityType: (entityType as DocumentEntityType) || undefined,
        entityId: selectedEntity ? selectedEntity.entityId || selectedEntity.id : undefined,
        documentTypeId: documentTypeId !== 'ALL' ? documentTypeId : undefined,
        branch: branch || undefined,
        state: state || undefined,
        employeeStatus: workingStatus || undefined,
        expiryBucket: expiryBucket !== 'ALL' ? expiryBucket : undefined,
        page: currentPage,
        pageSize: pageSize,
        sortBy: 'expiryDate',
        sortOrder: 'asc',
      });

      setDocuments(res.documents || []);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error('Failed to load document list:', err);
      setDocuments([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [
    entityType,
    selectedEntity,
    documentTypeId,
    branch,
    state,
    workingStatus,
    expiryBucket,
    currentPage,
    pageSize,
  ]);

  // Fetch stats and documents when filters or pagination change
  useEffect(() => {
    if (currentView === 'LIST') {
      loadDashboardStats();
      loadDocuments();
    }
  }, [currentView, loadDashboardStats, loadDocuments]);

  // Debounced Entity Search (~300ms)
  useEffect(() => {
    if (!entityType || !entitySearchQuery || selectedEntity) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingEntity(true);
      try {
        const results = await documentService.searchEntities(
          entitySearchQuery,
          entityType as DocumentEntityType
        );
        setSearchResults(results);
      } catch (err) {
        console.error('Failed to autocomplete entity:', err);
      } finally {
        setIsSearchingEntity(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [entitySearchQuery, entityType, selectedEntity]);

  // Entity Type change handler resets entity selection
  const handleEntityTypeChange = (typeVal: string) => {
    setEntityType(typeVal);
    setSelectedEntity(null);
    setEntitySearchQuery('');
    setCurrentPage(1);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setEntityType('');
    setSelectedEntity(null);
    setEntitySearchQuery('');
    setDocumentTypeId('ALL');
    setState('');
    setBranch('');
    setWorkingStatus('');
    setExpiryBucket('ALL');
    setCurrentPage(1);
  };

  // Trigger search
  const handleSearch = () => {
    setCurrentPage(1);
    loadDashboardStats();
    loadDocuments();
  };

  // Export to Excel / CSV
  const handleExportExcel = () => {
    if (documents.length === 0) {
      alert('No documents to export for the current filters.');
      return;
    }

    const headers = [
      'Entity Type',
      'Entity Name',
      'Identifier/Code',
      'Working Status',
      'Branch',
      'State',
      'Document Type',
      'Document Number',
      'Expiry Date',
      'Days Remaining',
      'Description',
    ];

    const rows = documents.map((d) => [
      d.entity_type,
      d.entity_name || d.entity_id,
      d.entityDetails?.employee_code || d.entityDetails?.plate_code || d.entity_id,
      d.employeeStatus || 'Active',
      d.branch || d.branch_name || 'Dubai Main',
      d.state || 'Dubai',
      d.document_type_name,
      d.document_number || 'N/A',
      d.expiry_date || 'N/A',
      d.days_remaining !== undefined ? d.days_remaining : 'No Expiry',
      `"${(d.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `document_expiries_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Selection Checkboxes
  const handleToggleSelectDoc = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map((d) => d.id));
    }
  };

  // Document Actions
  const handleViewDocDetails = (doc: DbEntityDocument) => {
    setPreviewDoc(doc);
    setIsPreviewOpen(true);
  };

  const handleEditDoc = (doc: DbEntityDocument) => {
    setEditingDoc(doc);
    setCurrentView('UPLOAD_NEW');
  };

  const handleDownloadDoc = async (doc: DbEntityDocument) => {
    try {
      await documentService.downloadDocumentFile(doc.id, undefined, `${doc.document_type_name}_${doc.document_number}.pdf`);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleInvalidateDoc = async (doc: DbEntityDocument) => {
    if (confirm(`Are you sure you want to archive / invalidate "${doc.document_type_name}" (${doc.document_number})?`)) {
      try {
        await documentService.invalidateDocument(doc.id, 'Archived by Compliance Officer');
        await loadDocuments();
        await loadDashboardStats();
      } catch (err) {
        console.error('Invalidation failed:', err);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Tab Switcher / Navigation Pill (Document Expiry Listing vs Document Types) */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCurrentView('LIST');
              setEditingDoc(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              currentView === 'LIST' || currentView === 'UPLOAD_NEW'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Document Expiry Listing</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentView('TYPES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              currentView === 'TYPES'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Document Types</span>
          </button>
        </div>

        {/* Top Right Actions */}
        {currentView === 'LIST' && (
          <button
            type="button"
            onClick={() => {
              setEditingDoc(null);
              setCurrentView('UPLOAD_NEW');
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Create New</span>
          </button>
        )}
      </div>

      {/* VIEW 1: UPLOAD / RENEW FORM */}
      {currentView === 'UPLOAD_NEW' && (
        <DocumentUploadForm
          initialDoc={editingDoc}
          docTypes={docTypes}
          onBack={() => {
            setCurrentView('LIST');
            setEditingDoc(null);
          }}
          onSuccess={() => {
            setCurrentView('LIST');
            setEditingDoc(null);
            loadDashboardStats();
            loadDocuments();
          }}
        />
      )}

      {/* VIEW 2: DOCUMENT TYPES MASTER */}
      {currentView === 'TYPES' && (
        <DocumentTypesMasterView
          onBackToListing={() => setCurrentView('LIST')}
        />
      )}

      {/* VIEW 3: REAL ROUTEMATE HIERARCHY DOCUMENT EXPIRY LISTING */}
      {currentView === 'LIST' && (
        <>
          {/* 1. Header & Title */}
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Document Expiry Listing
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              View document expiries, attachments and renewal history
            </p>
          </div>

          {/* 2. Filter / Search Panel (Placed BEFORE KPI Cards) */}
          <DocumentFilters
            entityType={entityType}
            onEntityTypeChange={handleEntityTypeChange}
            selectedEntity={selectedEntity}
            entitySearchQuery={entitySearchQuery}
            onEntitySearchQueryChange={setEntitySearchQuery}
            onSelectEntity={(entity) => {
              setSelectedEntity(entity);
              if (entity) setEntitySearchQuery(entity.name);
              setCurrentPage(1);
            }}
            searchResults={searchResults}
            isSearchingEntity={isSearchingEntity}
            showEntityDropdown={showEntityDropdown}
            setShowEntityDropdown={setShowEntityDropdown}
            documentTypeId={documentTypeId}
            onDocumentTypeChange={(val) => {
              setDocumentTypeId(val);
              setCurrentPage(1);
            }}
            docTypes={docTypes}
            state={state}
            onStateChange={(val) => {
              setState(val);
              setCurrentPage(1);
            }}
            branch={branch}
            onBranchChange={(val) => {
              setBranch(val);
              setCurrentPage(1);
            }}
            workingStatus={workingStatus}
            onWorkingStatusChange={(val) => {
              setWorkingStatus(val);
              setCurrentPage(1);
            }}
            onSearch={handleSearch}
            onReset={handleResetFilters}
            onCreateNew={() => {
              setEditingDoc(null);
              setCurrentView('UPLOAD_NEW');
            }}
            onBulkUpload={() => {
              setEditingDoc(null);
              setCurrentView('UPLOAD_NEW');
            }}
            onExportExcel={handleExportExcel}
          />

          {/* 3. Expiry KPI Cards (Placed AFTER Filter Panel) */}
          <DocumentKpiCards
            stats={stats}
            activeBucket={expiryBucket}
            onSelectBucket={(bucket) => {
              setExpiryBucket(bucket);
              setCurrentPage(1);
            }}
            isLoading={isStatsLoading}
          />

          {/* 4. Document Type Expiry Summary (Horizontal Compact Cards) */}
          <DocumentTypeSummaryCards
            stats={stats}
            docTypes={docTypes}
            selectedDocTypeId={documentTypeId}
            onSelectDocType={(typeId) => {
              setDocumentTypeId(typeId);
              setCurrentPage(1);
            }}
            isLoading={isStatsLoading}
          />

          {/* 5. Documents Table (Dense Desktop Table) */}
          <DocumentTable
            documents={documents}
            totalCount={totalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            selectedDocIds={selectedDocIds}
            onToggleSelectDoc={handleToggleSelectDoc}
            onToggleSelectAll={handleToggleSelectAll}
            onViewDocDetails={handleViewDocDetails}
            onEditDoc={handleEditDoc}
            onDownloadDoc={handleDownloadDoc}
            onInvalidateDoc={handleInvalidateDoc}
            isLoading={isLoading}
          />
        </>
      )}

      {/* Document Detail / Version History Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewDoc(null);
          }}
          document={previewDoc}
          onReplace={(doc) => {
            setIsPreviewOpen(false);
            setEditingDoc(doc);
            setCurrentView('UPLOAD_NEW');
          }}
          lang={lang}
        />
      )}
    </div>
  );
};
