import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserCheck,
  AlertTriangle,
  FileText,
  DollarSign,
  Calendar,
  History,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Upload,
  Download,
  Car,
  Tag,
  Building,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SalikRecord, SalikHistoryEntry, SalikBatchRow, SalikBatchValidationResult } from '../../../types/salik';
import { apiClient } from '../../../services/apiClient';

// -------------------------------------------------------------
// 1. ASSIGN / REASSIGN SALIK MODAL
// -------------------------------------------------------------
interface SalikAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalikRecord | null;
  employees: any[];
  onSuccess: () => void;
}

export const SalikAssignModal: React.FC<SalikAssignModalProps> = ({
  isOpen,
  onClose,
  record,
  employees,
  onSuccess,
}) => {
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [liabilityType, setLiabilityType] = useState<'EMPLOYEE' | 'COMPANY'>('EMPLOYEE');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setSelectedEmpId(record.assigned_employee_id || '');
      setLiabilityType(record.charge_status === 'COMPANY_LIABILITY' ? 'COMPANY' : 'EMPLOYEE');
      setReason('');
      setNotes('');
      setError(null);
    }
  }, [record]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId && liabilityType === 'EMPLOYEE') {
      setError('Please select an employee to allocate this Salik toll crossing.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/erp/salik/${record.id}/assign`, {
        employee_id: liabilityType === 'EMPLOYEE' ? selectedEmpId : undefined,
        liability_type: liabilityType,
        reason: reason.trim() || 'Manual assignment by fleet operations',
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to assign Salik toll.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Assign Salik Crossing</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transaction: {record.transaction_id} | Plate: {record.plate_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Crossing Summary Pill */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-slate-500 block">Toll Gate & Time:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {record.toll_gate} ({record.transaction_date} {record.transaction_time})
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Crossing Amount:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                AED {record.amount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Liability Type Choice */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Liability Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLiabilityType('EMPLOYEE')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                  liabilityType === 'EMPLOYEE'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                Employee Liability
              </button>
              <button
                type="button"
                onClick={() => setLiabilityType('COMPANY')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-2 transition-all ${
                  liabilityType === 'COMPANY'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building className="w-4 h-4" />
                Company Fleet Expense
              </button>
            </div>
          </div>

          {liabilityType === 'EMPLOYEE' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Assign to Driver / Rider <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                required={liabilityType === 'EMPLOYEE'}
              >
                <option value="">-- Select Rider / Employee --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || emp.employee_id}) - {emp.project_name || 'Fleet'}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Assignment Reason
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed driver duty roster / shift verification"
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Internal Operations Note
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add optional internal context..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. BULK ASSIGN SALIK MODAL
// -------------------------------------------------------------
interface SalikBulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRecords: SalikRecord[];
  employees: any[];
  onSuccess: () => void;
}

export const SalikBulkAssignModal: React.FC<SalikBulkAssignModalProps> = ({
  isOpen,
  onClose,
  selectedRecords,
  employees,
  onSuccess,
}) => {
  const [assignMode, setAssignMode] = useState<'AUTO_RESOLVE' | 'SINGLE_RIDER' | 'COMPANY'>('AUTO_RESOLVE');
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || selectedRecords.length === 0) return null;

  const totalAmount = selectedRecords.reduce((acc, r) => acc + r.amount, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/api/erp/salik/bulk-assign', {
        record_ids: selectedRecords.map((r) => r.id),
        auto_resolve: assignMode === 'AUTO_RESOLVE',
        liability_type: assignMode === 'COMPANY' ? 'COMPANY' : 'EMPLOYEE',
        employee_id: assignMode === 'SINGLE_RIDER' ? selectedEmpId : undefined,
        reason: reason.trim() || `Bulk assignment (${selectedRecords.length} records)`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Bulk assignment failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bulk Assign Salik Records</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedRecords.length} crossings selected | Total: AED {totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Bulk Assignment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAssignMode('AUTO_RESOLVE')}
                className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignMode === 'AUTO_RESOLVE'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Auto-Resolve Custody
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('SINGLE_RIDER')}
                className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignMode === 'SINGLE_RIDER'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Specific Employee
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('COMPANY')}
                className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                  assignMode === 'COMPANY'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                Company Expense
              </button>
            </div>
          </div>

          {assignMode === 'AUTO_RESOLVE' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                System will evaluate each selected toll's exact crossing timestamp against the vehicle assignment history log. Any vehicle with an active rider will automatically be allocated; unassigned records will remain pending.
              </span>
            </div>
          )}

          {assignMode === 'SINGLE_RIDER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Employee <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                required
              >
                <option value="">-- Choose Employee for all {selectedRecords.length} tolls --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || emp.employee_id})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason / Memo
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Operations shift verification batch"
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          {/* Selected Records Preview List */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Selected Crossings Preview ({selectedRecords.length})
            </label>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {selectedRecords.map((r) => (
                <div key={r.id} className="p-2 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <div>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 mr-2">{r.plate_number}</span>
                    <span className="text-slate-500">{r.toll_gate} ({r.transaction_date})</span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white">AED {r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Apply Bulk Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. LINK TO PAYROLL MODAL
// -------------------------------------------------------------
interface SalikLinkPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalikRecord | null;
  currentMonth: string;
  onSuccess: () => void;
}

export const SalikLinkPayrollModal: React.FC<SalikLinkPayrollModalProps> = ({
  isOpen,
  onClose,
  record,
  currentMonth,
  onSuccess,
}) => {
  const [payrollPeriod, setPayrollPeriod] = useState(currentMonth || '2026-08');
  const [amount, setAmount] = useState(4);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setPayrollPeriod(currentMonth || '2026-08');
      setAmount(record.employee_liability || record.amount);
      setNotes('');
      setError(null);
    }
  }, [record, currentMonth]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiClient.post(`/api/erp/salik/${record.id}/link-payroll`, {
        payroll_period: payrollPeriod,
        amount: Number(amount),
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to link Salik to payroll.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Link to Rider Payroll</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Driver: {record.assigned_employee_name || 'Unassigned'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs space-y-1.5 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Crossing:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{record.transaction_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gate / Date:</span>
              <span className="text-slate-800 dark:text-slate-200">{record.toll_gate} ({record.transaction_date})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Employee Liability:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">AED {record.amount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Payroll Deduction Period <span className="text-rose-500">*</span>
            </label>
            <input
              type="month"
              value={payrollPeriod}
              onChange={(e) => setPayrollPeriod(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Deduction Amount (AED) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Payroll Officer Memo
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Deducted under UAE Salik toll deduction policy"
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Confirm Payroll Deduction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 4. PRE-PAID SALIK TOP-UP MODAL
// -------------------------------------------------------------
interface SalikPrepaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalikPrepaidModal: React.FC<SalikPrepaidModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [plateNumber, setPlateNumber] = useState('');
  const [plateCode, setPlateCode] = useState('');
  const [amount, setAmount] = useState(50);
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('Salik Account Recharge / Top-Up');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plateNumber) {
      setError('Please provide a vehicle plate number.');
      return;
    }
    if (amount <= 0) {
      setError('Amount must be greater than 0 AED.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient.post('/api/erp/salik/prepaid', {
        plate_number: plateNumber.trim(),
        plate_code: plateCode.trim(),
        amount: Number(amount),
        transaction_date: transactionDate,
        reference: reference.trim(),
        reason: reason.trim(),
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to add pre-paid Salik.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Pre-Paid Salik</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manual toll account top-up or prepaid tag balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Plate Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={plateNumber}
                onChange={(e) => setPlateNumber(e.target.value)}
                placeholder="e.g. 72154"
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Plate Code
              </label>
              <input
                type="text"
                value={plateCode}
                onChange={(e) => setPlateCode(e.target.value)}
                placeholder="e.g. T"
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Amount (AED) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Receipt / Recharge Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. RTA-SLK-REC-88910"
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional transaction context..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create Pre-Paid Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 5. TIMELINE / AUDIT TRAIL MODAL
// -------------------------------------------------------------
interface SalikTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SalikRecord | null;
}

export const SalikTimelineModal: React.FC<SalikTimelineModalProps> = ({
  isOpen,
  onClose,
  record,
}) => {
  if (!isOpen || !record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Salik Audit Trail</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Transaction: {record.transaction_id} | Plate: {record.plate_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-xs space-y-1 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Toll Gate:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{record.toll_gate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date & Time:</span>
              <span className="text-slate-900 dark:text-white">{record.transaction_date} {record.transaction_time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Current Assigned Driver:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {record.assigned_employee_name || 'Unassigned'} ({record.assigned_employee_code || '-'})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Charge Status:</span>
              <span className="font-semibold text-slate-900 dark:text-white">{record.charge_status}</span>
            </div>
          </div>

          <div className="relative pl-6 border-l-2 border-emerald-300 dark:border-emerald-800 space-y-4">
            {record.history && record.history.length > 0 ? (
              record.history.map((h, idx) => (
                <div key={h.id || idx} className="relative group">
                  <div className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-white dark:ring-slate-900" />
                  <div className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        {h.event_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-400 text-[10px]">
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 mt-1">
                      By: <span className="font-semibold">{h.actor_name}</span> {h.actor_role && `(${h.actor_role})`}
                    </p>
                    {h.reason && (
                      <p className="text-slate-500 dark:text-slate-400 italic mt-0.5">
                        Reason: {h.reason}
                      </p>
                    )}
                    {h.notes && (
                      <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                        Note: {h.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No historical audit logs recorded.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 6. UPLOAD & BATCH VALIDATION MODAL
// -------------------------------------------------------------
interface SalikUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const SalikUploadModal: React.FC<SalikUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<'SELECT' | 'VALIDATE_PREVIEW' | 'COMMITTED'>('SELECT');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<SalikBatchValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent =
      'Transaction ID,Trip Date,Trip Time,Toll Gate,Direction,Tag Number,Plate Number,Plate Code,Amount\n' +
      'SLK-2026-08-1001,2026-08-10,08:30:00,Al Barsha,Southbound,0010992451,72154,T,4.00\n' +
      'SLK-2026-08-1002,2026-08-10,14:20:00,Al Safa,Northbound,0010992451,72154,T,4.00\n' +
      'SLK-2026-08-1003,2026-08-11,09:15:00,Airport Tunnel,Eastbound,0010992452,49102,A,4.00\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'salik_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processSelectedFile(selected);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!jsonRows || jsonRows.length === 0) {
          throw new Error('Spreadsheet appears to be empty or has no recognizable data rows.');
        }

        // Map column variations
        const mapped = jsonRows.map((r, idx) => {
          return {
            row_id: `row_${Date.now()}_${idx}`,
            transaction_id: r['Transaction ID'] || r['TransactionID'] || r['transaction_id'] || r['TxID'] || '',
            transaction_date: r['Trip Date'] || r['TripDate'] || r['transaction_date'] || r['Date'] || '',
            transaction_time: r['Trip Time'] || r['TripTime'] || r['transaction_time'] || r['Time'] || '12:00:00',
            toll_gate: r['Toll Gate'] || r['TollGate'] || r['Gate'] || r['toll_gate'] || 'Al Barsha',
            direction: r['Direction'] || r['direction'] || 'Southbound',
            tag_number: r['Tag Number'] || r['Tag'] || r['tag_number'] || '',
            plate_number: String(r['Plate Number'] || r['PlateNumber'] || r['Plate'] || r['plate_number'] || '').trim(),
            plate_code: String(r['Plate Code'] || r['PlateCode'] || r['Code'] || r['plate_code'] || '').trim(),
            amount: parseFloat(r['Amount'] || r['amount'] || '4.00') || 4.00,
          };
        });

        setParsedRows(mapped);

        // Run validation with backend
        const valRes = await apiClient.post<SalikBatchValidationResult>(
          '/api/erp/salik/validate-batch',
          { rows: mapped }
        );

        setValidationResult(valRes.data);
        setStep('VALIDATE_PREVIEW');
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to parse file.');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsBinaryString(selectedFile);
  };

  const handleCommitBatch = async () => {
    if (!validationResult || validationResult.ready_count === 0) return;

    setLoading(true);
    setError(null);
    try {
      const readyRows = validationResult.results.filter((r) => r.status === 'READY');
      const res = await apiClient.post<any>('/api/erp/salik/batch', {
        rows: readyRows,
      });

      if (res.data?.success) {
        setStep('COMMITTED');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        throw new Error(res.data?.message || 'Batch commit failed.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to commit Salik batch.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Import Salik Toll Crossings</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload CSV / Excel with automated duplicate protection & historical rider custody auto-matching
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'SELECT' && (
            <div className="space-y-6">
              {/* Drag and Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30 flex flex-col items-center justify-center gap-3"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full">
                  <FileSpreadsheet className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Click to select or drag and drop Salik file
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Supports CSV, XLSX, and XLS formats exported from Dubai RTA / Salik portal
                  </p>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold mt-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Parsing & Validating against Fleet Database...
                  </div>
                )}
              </div>

              {/* Template Helper */}
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                    Need the standard Salik import spreadsheet?
                  </span>
                  <span className="text-slate-500">
                    Download the official CSV template with sample toll gate and plate headers.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 flex items-center gap-1.5 font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Template
                </button>
              </div>
            </div>
          )}

          {step === 'VALIDATE_PREVIEW' && validationResult && (
            <div className="space-y-4">
              {/* Validation Summary Bar */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600 dark:text-slate-300">
                    Total Rows: <strong className="text-slate-900 dark:text-white">{validationResult.total_rows}</strong>
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready for Import: <strong>{validationResult.ready_count}</strong>
                  </span>
                  {validationResult.failed_count > 0 && (
                    <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Blocked / Issues: <strong>{validationResult.failed_count}</strong>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setStep('SELECT')}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white underline"
                >
                  Choose Different File
                </button>
              </div>

              {/* Preview Table */}
              <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Tx ID</th>
                      <th className="p-2.5">Plate</th>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Toll Gate</th>
                      <th className="p-2.5">Amount</th>
                      <th className="p-2.5">Auto-Resolved Rider</th>
                      <th className="p-2.5">Validation Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {validationResult.results.map((row, idx) => {
                      const isReady = row.status === 'READY';
                      return (
                        <tr
                          key={row.row_id || idx}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                            !isReady ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="p-2.5">
                            {isReady ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                                <AlertCircle className="w-3 h-3" /> {row.status}
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {row.transaction_id}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                            {row.plate_number} {row.plate_code && `(${row.plate_code})`}
                          </td>
                          <td className="p-2.5 text-slate-600 dark:text-slate-400">
                            {row.transaction_date} {row.transaction_time}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">
                            {row.toll_gate}
                          </td>
                          <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                            AED {row.amount.toFixed(2)}
                          </td>
                          <td className="p-2.5">
                            {row.resolved_rider ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                <UserCheck className="w-3 h-3" />
                                {row.resolved_rider.rider_name} ({row.resolved_rider.rider_code})
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Unassigned (Pending)</span>
                            )}
                          </td>
                          <td className="p-2.5 text-slate-500 dark:text-slate-400 text-[11px]">
                            {row.status_message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'COMMITTED' && (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Salik Toll Batch Successfully Imported!
              </h4>
              <p className="text-xs text-slate-500">
                Updating live ledger, financial KPI cards, and employee 360 balances...
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
          >
            Cancel
          </button>

          {step === 'VALIDATE_PREVIEW' && (
            <button
              type="button"
              onClick={handleCommitBatch}
              disabled={loading || !validationResult || validationResult.ready_count === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Import {validationResult?.ready_count || 0} Validated Crossings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
