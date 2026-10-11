import React from 'react';
import { Search, RotateCcw, Plus, Upload, FileSpreadsheet, X } from 'lucide-react';
import { DbDocumentType, DocumentEntityType } from '../../types/database';
import { EntitySearchResult } from '../../services/documentService';

interface DocumentFiltersProps {
  entityType: string;
  onEntityTypeChange: (val: string) => void;
  selectedEntity: EntitySearchResult | null;
  entitySearchQuery: string;
  onEntitySearchQueryChange: (val: string) => void;
  onSelectEntity: (entity: EntitySearchResult | null) => void;
  searchResults: EntitySearchResult[];
  isSearchingEntity: boolean;
  showEntityDropdown: boolean;
  setShowEntityDropdown: (show: boolean) => void;
  documentTypeId: string;
  onDocumentTypeChange: (val: string) => void;
  docTypes: DbDocumentType[];
  state: string;
  onStateChange: (val: string) => void;
  branch: string;
  onBranchChange: (val: string) => void;
  workingStatus: string;
  onWorkingStatusChange: (val: string) => void;
  onSearch: () => void;
  onReset: () => void;
  onCreateNew: () => void;
  onBulkUpload: () => void;
  onExportExcel: () => void;
}

export const DocumentFilters: React.FC<DocumentFiltersProps> = ({
  entityType,
  onEntityTypeChange,
  selectedEntity,
  entitySearchQuery,
  onEntitySearchQueryChange,
  onSelectEntity,
  searchResults,
  isSearchingEntity,
  showEntityDropdown,
  setShowEntityDropdown,
  documentTypeId,
  onDocumentTypeChange,
  docTypes,
  state,
  onStateChange,
  branch,
  onBranchChange,
  workingStatus,
  onWorkingStatusChange,
  onSearch,
  onReset,
  onCreateNew,
  onBulkUpload,
  onExportExcel,
}) => {
  const isEntityDisabled = !entityType;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-5 mb-5">
      {/* Row 1: ENTITY TYPE, ENTITY, DOCUMENT TYPE, STATE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* 1. ENTITY TYPE */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Entity Type
          </label>
          <select
            value={entityType}
            onChange={(e) => onEntityTypeChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
          >
            <option value="">-- All Entity Types --</option>
            <option value="Employee">Employee</option>
            <option value="Vehicle">Vehicle</option>
            <option value="Company">Company</option>
          </select>
        </div>

        {/* 2. ENTITY (Search Autocomplete) */}
        <div className="relative">
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Entity
          </label>
          <div className="relative">
            <input
              type="text"
              disabled={isEntityDisabled}
              placeholder={
                isEntityDisabled
                  ? '-- Select Entity Type First --'
                  : entityType === 'Vehicle'
                  ? 'Search Plate No / Code...'
                  : entityType === 'Employee'
                  ? 'Search Name / ID / Emirates ID...'
                  : 'Search Entity...'
              }
              value={selectedEntity ? selectedEntity.name : entitySearchQuery}
              onFocus={() => !isEntityDisabled && setShowEntityDropdown(true)}
              onChange={(e) => {
                if (selectedEntity) onSelectEntity(null);
                onEntitySearchQueryChange(e.target.value);
                setShowEntityDropdown(true);
              }}
              className={`w-full text-xs py-2 px-3 rounded-lg border font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                isEntityDisabled
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700'
              }`}
            />
            {selectedEntity ? (
              <button
                type="button"
                onClick={() => {
                  onSelectEntity(null);
                  onEntitySearchQueryChange('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                title="Clear selected entity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : isSearchingEntity ? (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : null}
          </div>

          {/* Autocomplete Dropdown */}
          {showEntityDropdown && !isEntityDisabled && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectEntity(item);
                    setShowEntityDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-800 dark:text-slate-200 flex items-center justify-between transition-colors"
                >
                  <div className="truncate">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {item.code ? `Code: ${item.code} • ` : ''}
                      {item.branchName || 'Dubai Branch'}
                    </p>
                  </div>
                  <span className="shrink-0 ml-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium rounded">
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. DOCUMENT TYPE */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Document Type
          </label>
          <select
            value={documentTypeId}
            onChange={(e) => onDocumentTypeChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
          >
            <option value="ALL">-- All Document Types --</option>
            {docTypes
              .filter((t) => {
                if (!entityType) return true;
                if (entityType === 'Employee') return t.category === 'EMPLOYEE' || t.category === 'OTHER';
                if (entityType === 'Vehicle') return t.category === 'VEHICLE';
                if (entityType === 'Company') return t.category === 'COMPANY';
                return true;
              })
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            {docTypes.length === 0 && (
              <>
                <option value="dt_eid">Emirates ID</option>
                <option value="dt_passport">Passport Copy</option>
                <option value="dt_license">Driving License</option>
                <option value="dt_mulkiya">Mulkiya</option>
                <option value="dt_labor">Labor Card</option>
                <option value="dt_residency">E-Residency</option>
                <option value="dt_visa">Visa</option>
              </>
            )}
          </select>
        </div>

        {/* 4. STATE */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            State
          </label>
          <select
            value={state}
            onChange={(e) => onStateChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
          >
            <option value="">-- All States --</option>
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

      {/* Row 2: BRANCH, WORKING STATUS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* 5. BRANCH */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Branch
          </label>
          <select
            value={branch}
            onChange={(e) => onBranchChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
          >
            <option value="">-- All Branches --</option>
            <option value="Pixel Syntax Delivery Software">Pixel Syntax Delivery Software</option>
            <option value="Pixel Syntax Delivery Software">Pixel Syntax Delivery Software</option>
            <option value="Dubai Head Office">Dubai Head Office</option>
            <option value="Abu Dhabi Central Branch">Abu Dhabi Central Branch</option>
            <option value="Sharjah Logistics Hub">Sharjah Logistics Hub</option>
          </select>
        </div>

        {/* 6. WORKING STATUS */}
        <div>
          <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-1.5">
            Working Status
          </label>
          <select
            value={workingStatus}
            onChange={(e) => onWorkingStatusChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs py-2 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
          >
            <option value="">-- All Working Statuses --</option>
            <option value="Assigned / Active">Assigned / Active</option>
            <option value="Available / Unassigned">Available / Unassigned</option>
            <option value="On Leave">On Leave</option>
            <option value="On Hold">On Hold</option>
            <option value="Absconding">Absconding</option>
            <option value="Terminated">Terminated</option>
            <option value="Exited">Exited</option>
          </select>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
            Employee uses Employee Working Status; Vehicle uses Vehicle Working Status.
          </p>
        </div>
      </div>

      {/* Action Buttons: Search, Reset, + Create New, Bulk Upload, Export Excel */}
      <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onSearch}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Create New</span>
        </button>

        <button
          type="button"
          onClick={onBulkUpload}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <Upload className="w-3.5 h-3.5 text-slate-500" />
          <span>Bulk Upload</span>
        </button>

        <button
          type="button"
          onClick={onExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold shadow-xs transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Export Excel</span>
        </button>
      </div>
    </div>
  );
};
