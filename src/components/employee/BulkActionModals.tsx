import React, { useState } from 'react';
import { X, Building, Briefcase, Layers, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { DbBranch, DbProject, DbVisaContractorType, DbVendorCompany } from '../../types/database';
import { AUTHORITATIVE_BRANCHES, AUTHORITATIVE_CONTRACTOR_CATEGORIES } from '../../lib/branches';

interface BulkUpdateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  branches: DbBranch[];
  onSuccess: (count: number) => void;
}

export const BulkUpdateBranchModal: React.FC<BulkUpdateBranchModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  branches,
  onSuccess,
}) => {
  const safeBranches = Array.isArray(branches) ? branches : [];
  const [branchId, setBranchId] = useState(safeBranches[0]?.id || 'b_dxb');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const selectedBranch = safeBranches.find(b => b.id === branchId);
      const res = await masterEmployeeService.bulkUpdateBranch(selectedIds, branchId, selectedBranch?.name);
      if (res.success) {
        onSuccess(res.updatedCount);
        onClose();
      } else {
        setError(res.error || 'Failed to update branch');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update branch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <Building className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">Bulk Update Branch</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Assign <strong className="text-slate-900 dark:text-white">{selectedIds.length}</strong> selected employees to a new operations branch:
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {(safeBranches.length > 0 ? safeBranches : AUTHORITATIVE_BRANCHES).map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Updating...' : `Update ${selectedIds.length} Employees`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BulkUpdateContractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  visaTypes?: DbVisaContractorType[];
  vendorCompanies?: DbVendorCompany[];
  onSuccess: (count: number) => void;
}

export const BulkUpdateContractorModal: React.FC<BulkUpdateContractorModalProps> = ({
  isOpen,
  onClose,
  selectedIds,
  visaTypes = [],
  vendorCompanies = [],
  onSuccess,
}) => {
  const [contractor, setContractor] = useState('Own');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await masterEmployeeService.bulkUpdateContractor(
        selectedIds,
        contractor
      );
      if (res.success) {
        onSuccess(res.updatedCount);
        onClose();
      } else {
        setError(res.error || 'Failed to update category');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white">Bulk Update Contract / Visa Category</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Assign <strong className="text-slate-900 dark:text-white">{selectedIds.length}</strong> selected employees to category:
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Contract / Visa Category</label>
            <select
              value={contractor}
              onChange={(e) => setContractor(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {AUTHORITATIVE_CONTRACTOR_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors"
            >
              {submitting ? 'Updating...' : `Update Category`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface BulkUpdateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  projects: DbProject[];
  onSuccess: (count: number) => void;
}

export const BulkUpdateProjectModal: React.FC<BulkUpdateProjectModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-rose-50 dark:bg-rose-950/40">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <h3 className="font-bold text-rose-900 dark:text-rose-200">Bulk Project Reassignment Blocked</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 rounded-xl text-rose-900 dark:text-rose-200 space-y-2">
            <p className="font-bold">
              Direct destructive bulk project reassignment is strictly blocked for operational safety.
            </p>
            <p className="text-[11px] leading-relaxed">
              Project movement must use the canonical explicit <strong>Move / Transfer Project</strong> workflow to prevent historical data loss.
            </p>
          </div>

          <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            <p className="font-bold text-slate-700 dark:text-slate-300">The canonical workflow ensures:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Select employee and verify active assignment</li>
              <li>End old assignment historically with closure reason</li>
              <li>Capture destination External Rider ID (Courier ID / NIM ID)</li>
              <li>Audit effective date and mandatory reason</li>
              <li>Preserve ProjectRiderMapping history</li>
            </ul>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl"
            >
              Understood, Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
