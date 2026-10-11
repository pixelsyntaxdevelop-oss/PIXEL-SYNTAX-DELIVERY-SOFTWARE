import React from 'react';
import {
  Eye,
  Edit,
  Download,
  Trash2,
  FileText,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Square,
  Building2,
  User,
  Truck,
} from 'lucide-react';
import { DbEntityDocument } from '../../types/database';

interface DocumentTableProps {
  documents: DbEntityDocument[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  selectedDocIds: string[];
  onToggleSelectDoc: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewDocDetails: (doc: DbEntityDocument) => void;
  onEditDoc: (doc: DbEntityDocument) => void;
  onDownloadDoc: (doc: DbEntityDocument) => void;
  onInvalidateDoc: (doc: DbEntityDocument) => void;
  isLoading?: boolean;
}

export const DocumentTable: React.FC<DocumentTableProps> = ({
  documents,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectedDocIds,
  onToggleSelectDoc,
  onToggleSelectAll,
  onViewDocDetails,
  onEditDoc,
  onDownloadDoc,
  onInvalidateDoc,
  isLoading = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const isAllSelected = documents.length > 0 && selectedDocIds.length === documents.length;

  const startRecord = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(totalCount, currentPage * pageSize);

  // Helper to format days remaining
  const renderDaysRemainingBadge = (doc: DbEntityDocument) => {
    const days = doc.days_remaining;
    if (days === undefined || days === null) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          No Expiry
        </span>
      );
    }

    if (days < 0) {
      const positiveDays = Math.abs(days);
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Expired {positiveDays} {positiveDays === 1 ? 'day' : 'days'} ago</span>
        </span>
      );
    }

    if (days === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
          Expires Today
        </span>
      );
    }

    if (days <= 15) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          {days} {days === 1 ? 'day' : 'days'} remaining
        </span>
      );
    }

    if (days <= 40) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          {days} days remaining
        </span>
      );
    }

    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        {days} days remaining
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      {/* Table Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Total Records: <span className="text-emerald-600 dark:text-emerald-400">{totalCount}</span>
          </span>
          {selectedDocIds.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-md">
              {selectedDocIds.length} Selected
            </span>
          )}
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs py-1 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden font-medium"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Operational Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 border-collapse">
          <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
              </th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Entity Type</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Entity</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Working Status</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Branch</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">State</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Document Type</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Document Number</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Expiry Date</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Days Remaining</th>
              <th className="px-3 py-3 font-bold whitespace-nowrap">Description</th>
              <th className="px-3 py-3 font-bold text-center whitespace-nowrap">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-3 py-3.5 text-center">
                    <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" />
                  </td>
                  <td className="px-3 py-3.5"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-28 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded font-mono" /></td>
                  <td className="px-3 py-3.5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5"><div className="w-20 h-4 bg-slate-200 dark:bg-slate-700 rounded" /></td>
                  <td className="px-3 py-3.5 text-center"><div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" /></td>
                </tr>
              ))
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No document records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try adjusting the filter criteria or click + Create New to upload.</p>
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const isSelected = selectedDocIds.includes(doc.id);
                const isExpired = doc.days_remaining !== undefined && doc.days_remaining < 0;

                return (
                  <tr
                    key={doc.id}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                      isExpired
                        ? 'bg-rose-50/40 dark:bg-rose-950/20'
                        : isSelected
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                        : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectDoc(doc.id)}
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>

                    {/* Entity Type */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          doc.entity_type === 'Employee'
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : doc.entity_type === 'Vehicle'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {doc.entity_type === 'Employee' && <User className="w-3 h-3" />}
                        {doc.entity_type === 'Vehicle' && <Truck className="w-3 h-3" />}
                        {doc.entity_type === 'Company' && <Building2 className="w-3 h-3" />}
                        <span>{doc.entity_type}</span>
                      </span>
                    </td>

                    {/* Entity (Name + Identification) */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {doc.entity_name || doc.entity_id}
                      </div>
                      {doc.entity_type === 'Employee' && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {doc.entityDetails?.employee_code || doc.entity_id}
                        </div>
                      )}
                      {doc.entity_type === 'Vehicle' && doc.entityDetails?.plate_code && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          Code: {doc.entityDetails.plate_code}
                        </div>
                      )}
                    </td>

                    {/* Working Status */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {doc.employeeStatus || (doc.entity_type === 'Employee' ? 'Active' : 'Operational')}
                      </span>
                    </td>

                    {/* Branch */}
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <span className="truncate max-w-[150px] inline-block" title={doc.branch || doc.branch_name}>
                        {doc.branch || doc.branch_name || 'Dubai Main'}
                      </span>
                    </td>

                    {/* State */}
                    <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {doc.state || 'Dubai'}
                    </td>

                    {/* Document Type */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {doc.document_type_name}
                      </span>
                    </td>

                    {/* Document Number */}
                    <td className="px-3 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {doc.document_number || '—'}
                    </td>

                    {/* Expiry Date */}
                    <td className="px-3 py-3 whitespace-nowrap font-mono text-[11px] text-slate-700 dark:text-slate-300">
                      {doc.expiry_date || 'N/A'}
                    </td>

                    {/* Days Remaining Badge */}
                    <td className="px-3 py-3 whitespace-nowrap">
                      {renderDaysRemainingBadge(doc)}
                    </td>

                    {/* Description */}
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={doc.description || ''}>
                      {doc.description || '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Details */}
                        <button
                          type="button"
                          onClick={() => onViewDocDetails(doc)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors"
                          title="View Document Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit / Renew */}
                        <button
                          type="button"
                          onClick={() => onEditDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
                          title="Edit / Renew Document"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Download */}
                        <button
                          type="button"
                          onClick={() => onDownloadDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors"
                          title="Download Document"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* Invalidate / Archive */}
                        <button
                          type="button"
                          onClick={() => onInvalidateDoc(doc)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                          title="Archive / Invalidate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
        <div className="text-slate-500 dark:text-slate-400">
          Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{startRecord}</span> to{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{endRecord}</span> of{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{totalCount}</span> records
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1 || isLoading}
            onClick={() => onPageChange(currentPage - 1)}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <span className="px-3 py-1.5 font-bold text-slate-800 dark:text-slate-200">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={currentPage >= totalPages || isLoading}
            onClick={() => onPageChange(currentPage + 1)}
            className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
