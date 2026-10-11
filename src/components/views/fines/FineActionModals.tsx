import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { TrafficFineRecord, FineHistoryEntry } from '../../../types/trafficFines';
import { apiClient } from '../../../services/apiClient';

// -------------------------------------------------------------
// 1. ALLOCATE FINE MODAL
// -------------------------------------------------------------
interface AllocateFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
  employees: any[];
  onSuccess: () => void;
}

export const AllocateFineModal: React.FC<AllocateFineModalProps> = ({
  isOpen,
  onClose,
  fine,
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
    if (fine) {
      setSelectedEmpId(fine.rider_id || '');
      setReason('');
      setNotes('');
      setError(null);
    }
  }, [fine]);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId && liabilityType === 'EMPLOYEE') {
      setError('Please select an employee to allocate this fine responsibility.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/erp/fines/${fine.id}/allocate`, {
        employee_id: selectedEmpId,
        liability_type: liabilityType,
        reason: reason || 'Manual operational fine allocation',
        notes,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to allocate fine');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <UserCheck className="w-4 h-4 text-red-600" />
            <span>Allocate Fine: {fine.reference_number}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Ticket Summary Box */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-500 text-[11px]">Plate Number:</span>
              <div className="font-bold text-slate-800 font-mono">
                {fine.plate_number} {fine.plate_code && `(${fine.plate_code})`}
              </div>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Violation Date:</span>
              <div className="font-semibold text-slate-800">
                {fine.transaction_date} {fine.transaction_time}
              </div>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Authority:</span>
              <div className="font-semibold text-slate-800">{fine.vendor}</div>
            </div>
            <div>
              <span className="text-slate-500 text-[11px]">Total Fine:</span>
              <div className="font-bold text-red-600 font-mono">AED {fine.total_amount.toFixed(2)}</div>
            </div>
          </div>

          {/* Liability Mode */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Liability Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLiabilityType('EMPLOYEE')}
                className={`p-2 rounded border text-left font-medium transition-colors ${
                  liabilityType === 'EMPLOYEE'
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                100% Employee Liability
                <div className="text-[10px] text-slate-500 font-normal">Deductible via payroll</div>
              </button>

              <button
                type="button"
                onClick={() => setLiabilityType('COMPANY')}
                className={`p-2 rounded border text-left font-medium transition-colors ${
                  liabilityType === 'COMPANY'
                    ? 'border-red-600 bg-red-50 text-red-900 font-semibold'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                100% Company Liability
                <div className="text-[10px] text-slate-500 font-normal">Fleet maintenance fault</div>
              </button>
            </div>
          </div>

          {/* Select Employee */}
          {liabilityType === 'EMPLOYEE' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Select Responsible Employee *
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              >
                <option value="">-- Choose Rider / Driver --</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || emp.id}) - {emp.project_name || emp.department || 'Delivery'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Allocation Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reason / Note</label>
            <input
              type="text"
              value={reason}
              placeholder="e.g. Schedule verified with Talabat hub captain"
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Confirm Allocation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 2. CORRECT RESPONSIBILITY MODAL
// -------------------------------------------------------------
interface CorrectResponsibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
  employees: any[];
  onSuccess: () => void;
}

export const CorrectResponsibilityModal: React.FC<CorrectResponsibilityModalProps> = ({
  isOpen,
  onClose,
  fine,
  employees,
  onSuccess,
}) => {
  const [newRiderId, setNewRiderId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fine) {
      setNewRiderId('');
      setReason('');
      setNotes('');
      setError(null);
    }
  }, [fine]);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRiderId) {
      setError('Please select the correct employee.');
      return;
    }
    if (!reason.trim()) {
      setError('A mandatory operational reason is required for responsibility correction.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/erp/fines/${fine.id}/correct-responsibility`, {
        new_rider_id: newRiderId,
        reason: reason.trim(),
        notes,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to correct responsibility');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Correct Responsibility: {fine.reference_number}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current vs New Rider Details */}
          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Current Assigned Rider:</span>
              <span className="font-bold text-slate-900 font-mono">
                {fine.rider_name || 'None'} ({fine.rider_code || 'N/A'})
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Fine Amount:</span>
              <span className="font-bold text-red-600 font-mono">
                AED {fine.total_amount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Violation Date:</span>
              <span className="font-semibold text-slate-800">
                {fine.transaction_date} {fine.transaction_time}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-amber-800 bg-amber-50 p-2.5 rounded border border-amber-200">
            ⚠️ <strong>Audit Trail Notice:</strong> Reassigning responsibility preserves the original rider in the audit history. The correction reason will be permanently recorded in compliance logs.
          </div>

          {/* New Rider */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Select Correct Employee *
            </label>
            <select
              value={newRiderId}
              onChange={(e) => setNewRiderId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
              required
            >
              <option value="">-- Choose New Rider --</option>
              {employees
                .filter((e) => e.id !== fine.rider_id)
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code || emp.id}) - {emp.project_name || 'Delivery'}
                  </option>
                ))}
            </select>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Correction Reason (Mandatory) *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500 mb-1.5"
              required
            >
              <option value="">-- Select Reason --</option>
              <option value="Rider on leave; vehicle assigned to reliever">Rider on leave; vehicle assigned to reliever</option>
              <option value="Incorrect shift handover recorded in log">Incorrect shift handover recorded in log</option>
              <option value="Vehicle in maintenance workshop during violation">Vehicle in maintenance workshop during violation</option>
              <option value="Platform delivery trip timestamp verification confirmed alternate captain">Platform delivery trip timestamp verification confirmed alternate captain</option>
              <option value="Other verified operational adjustment">Other verified operational adjustment</option>
            </select>
            {reason.includes('Other') && (
              <input
                type="text"
                placeholder="Specify specific operational details..."
                onChange={(e) => setReason(`Other: ${e.target.value}`)}
                className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
                required
              />
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              placeholder="Additional internal compliance notes..."
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-red-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Responsibility Correction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. LINK PAYROLL MODAL
// -------------------------------------------------------------
interface LinkPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
  onSuccess: () => void;
}

export const LinkPayrollModal: React.FC<LinkPayrollModalProps> = ({
  isOpen,
  onClose,
  fine,
  onSuccess,
}) => {
  const [payrollPeriod, setPayrollPeriod] = useState(
    fine?.payroll_period_key || new Date().toISOString().substring(0, 7)
  );
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fine) {
      setPayrollPeriod(fine.payroll_period_key || fine.month || new Date().toISOString().substring(0, 7));
      setNotes('');
      setError(null);
    }
  }, [fine]);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fine.deducted_from_payroll) {
      setError(`Double deduction blocked! Fine has already been deducted in ${fine.payroll_period_key}.`);
      return;
    }
    if (fine.employee_liability <= 0) {
      setError('This fine has 0 employee liability and cannot be linked to payroll.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/erp/fines/${fine.id}/link-payroll`, {
        payroll_period: payrollPeriod,
        notes,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to link payroll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Link Fine to Monthly Payroll</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Employee:</span>
              <span className="font-bold text-slate-900">
                {fine.rider_name} ({fine.rider_code})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Reference Number:</span>
              <span className="font-mono text-slate-800">{fine.reference_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Employee Deduction Amount:</span>
              <span className="font-bold text-emerald-700 font-mono text-sm">
                AED {fine.employee_liability.toFixed(2)}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Target Payroll Period *
            </label>
            <input
              type="month"
              value={payrollPeriod}
              onChange={(e) => setPayrollPeriod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Approved for salary batch deduction"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || fine.deducted_from_payroll}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Schedule Deduction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 4. SETTLE FINE MODAL
// -------------------------------------------------------------
interface SettleFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
  onSuccess: () => void;
}

export const SettleFineModal: React.FC<SettleFineModalProps> = ({
  isOpen,
  onClose,
  fine,
  onSuccess,
}) => {
  const [settleType, setSettleType] = useState<'COMPANY' | 'EMPLOYEE'>('COMPANY');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('Corporate Card / Bank Transfer');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fine) {
      const initialAmt = fine.outstanding_balance > 0 ? fine.outstanding_balance : fine.total_amount;
      setAmount(initialAmt);
      setSettleType(fine.company_liability > 0 ? 'COMPANY' : 'EMPLOYEE');
      setError(null);
    }
  }, [fine]);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/erp/fines/${fine.id}/settle`, {
        settlement_type: settleType,
        amount,
        payment_method: paymentMethod,
        notes,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Settlement failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <CheckCircle2 className="w-4 h-4 text-red-600" />
            <span>Record Fine Settlement: {fine.reference_number}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded p-2.5 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding Balance:</span>
              <span className="font-bold text-rose-600 font-mono">
                AED {fine.outstanding_balance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Company Liability:</span>
              <span className="font-mono text-slate-800">AED {fine.company_liability.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Settlement Paid By</label>
            <select
              value={settleType}
              onChange={(e) => setSettleType(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="COMPANY">Company Direct Account</option>
              <option value="EMPLOYEE">Rider / Cash Collection</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Amount (AED) *</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold"
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
            <input
              type="text"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Record Settlement</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 5. DISPUTE FINE MODAL
// -------------------------------------------------------------
interface DisputeFineModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
  onSuccess: () => void;
}

export const DisputeFineModal: React.FC<DisputeFineModalProps> = ({
  isOpen,
  onClose,
  fine,
  onSuccess,
}) => {
  const [reason, setReason] = useState('Camera radar malfunction / erroneous vehicle plate capture');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`/api/erp/fines/${fine.id}/dispute`, {
        dispute_reason: reason,
        notes,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Dispute failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>File Fine Dispute: {fine.reference_number}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Dispute Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
              required
            >
              <option value="Camera radar malfunction / erroneous vehicle plate capture">
                Camera radar malfunction / erroneous vehicle plate capture
              </option>
              <option value="Vehicle was parked inside depot / garage during timestamp">
                Vehicle was parked inside depot / garage during timestamp
              </option>
              <option value="Duplicate ticketing by same authority within 5 minutes">
                Duplicate ticketing by same authority within 5 minutes
              </option>
              <option value="RTA permit for loading/unloading active">
                RTA permit for loading/unloading active
              </option>
              <option value="Other authority dispute">Other authority dispute</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Evidence / Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide GPS logs or trip reference numbers..."
              className="w-full bg-slate-50 border border-slate-300 rounded px-2.5 py-1.5 text-xs text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium shadow-sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Submit Dispute</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 6. FINE TIMELINE / AUDIT HISTORY MODAL
// -------------------------------------------------------------
interface FineTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  fine: TrafficFineRecord | null;
}

export const FineTimelineModal: React.FC<FineTimelineModalProps> = ({
  isOpen,
  onClose,
  fine,
}) => {
  if (!isOpen || !fine) return null;

  const history = fine.history || [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-xl w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <History className="w-4 h-4 text-red-600" />
            <span>Audit & Responsibility Timeline: {fine.reference_number}</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto space-y-3 text-xs">
          {/* Summary */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500">Plate:</span>
              <div className="font-bold text-slate-800 font-mono">{fine.plate_number}</div>
            </div>
            <div>
              <span className="text-slate-500">Amount:</span>
              <div className="font-bold text-red-600 font-mono">AED {fine.total_amount.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-slate-500">Assigned Rider:</span>
              <div className="font-bold text-slate-800">{fine.rider_name || 'Unallocated'}</div>
            </div>
          </div>

          {/* Timeline Events */}
          {history.length === 0 ? (
            <div className="text-center py-6 text-slate-400">No timeline events recorded yet.</div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-3 space-y-4 py-1">
              {history.map((event) => (
                <div key={event.id} className="relative pl-5">
                  {/* Timeline dot */}
                  <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-red-600 border-2 border-white shadow-xs" />

                  <div className="bg-white border border-slate-200 rounded p-2.5 shadow-2xs">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span className="text-xs font-mono uppercase text-red-700">{event.event_type.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                      </span>
                    </div>

                    <div className="text-slate-600 mt-1">
                      Actor: <strong className="text-slate-800">{event.actor_name}</strong>
                      {event.actor_role && <span className="text-slate-400"> ({event.actor_role})</span>}
                    </div>

                    {event.reason && (
                      <div className="text-slate-700 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 font-medium">
                        Reason: {event.reason}
                      </div>
                    )}

                    {event.notes && (
                      <div className="text-slate-500 mt-1 text-[11px] italic">
                        {event.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 7. BULK ALLOCATE MODAL
// -------------------------------------------------------------
interface BulkAllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  unallocatedFines: TrafficFineRecord[];
  onSuccess: () => void;
}

export const BulkAllocateModal: React.FC<BulkAllocateModalProps> = ({
  isOpen,
  onClose,
  unallocatedFines,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBulkAllocate = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await apiClient.post<any>('/api/erp/fines/bulk-allocate', {
        fine_ids: unallocatedFines.map((f) => f.id),
      });

      if (res.data && res.data.success) {
        setFeedback(res.data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setFeedback(res.error || 'Bulk allocation completed with some unallocated fines.');
      }
    } catch (err: any) {
      setFeedback(err.message || 'Bulk allocation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Bulk Allocate Unallocated Fines ({unallocatedFines.length})</span>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {feedback && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 text-slate-800 rounded">
              {feedback}
            </div>
          )}

          <p className="text-slate-600">
            The system will scan the Vehicle Assignment History at each fine's exact date and time, and automatically allocate responsibility to verified active riders.
          </p>

          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
            {unallocatedFines.map((f) => (
              <div key={f.id} className="p-2 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800 font-mono">{f.plate_number}</span>
                  <span className="text-slate-400 text-[11px] ml-2">({f.reference_number})</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-600 text-[11px] block">{f.transaction_date}</span>
                  <span className="font-bold text-red-600 font-mono">AED {f.total_amount.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkAllocate}
              disabled={loading || unallocatedFines.length === 0}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Execute Bulk Allocation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
