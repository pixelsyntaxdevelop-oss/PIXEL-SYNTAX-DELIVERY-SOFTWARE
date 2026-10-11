import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  Clock,
  FileText,
  ShieldCheck,
  Save,
  AlertCircle,
  Smartphone,
} from 'lucide-react';
import { simService, SimHistoryStaffUser } from '../../services/simService';

interface EditSimAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any | null;
  employee?: any | null;
  onSuccess: () => void;
}

export const EditSimAssignmentModal: React.FC<EditSimAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  employee,
  onSuccess,
}) => {
  const [assignedDate, setAssignedDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [returnedBy, setReturnedBy] = useState('');
  const [staffUsers, setStaffUsers] = useState<SimHistoryStaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [assignedByUserId, setAssignedByUserId] = useState('');
  const [returnedByUserId, setReturnedByUserId] = useState('');
  const [assignedByTouched, setAssignedByTouched] = useState(false);
  const [returnedByTouched, setReturnedByTouched] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSimActive =
    assignment &&
    (assignment.status === 'ACTIVE' ||
      assignment.status === 'ASSIGNED' ||
      assignment.assignment_status === 'ACTIVE' ||
      assignment.assignment_status === 'ASSIGNED' ||
      assignment.assignment_status === 'Assigned');

  useEffect(() => {
    if (isOpen && assignment) {
      setError(null);
      // Prefill fields
      const aDate = assignment.assigned_date
        ? assignment.assigned_date.includes('T')
          ? assignment.assigned_date.split('T')[0]
          : assignment.assigned_date
        : assignment.assigned_at
        ? assignment.assigned_at.split('T')[0]
        : '';
      setAssignedDate(aDate);

      const rDate = assignment.return_date
        ? assignment.return_date.includes('T')
          ? assignment.return_date.split('T')[0]
          : assignment.return_date
        : assignment.returned_date
        ? assignment.returned_date.includes('T')
          ? assignment.returned_date.split('T')[0]
          : assignment.returned_date
        : assignment.returned_at
        ? assignment.returned_at.split('T')[0]
        : '';
      setReturnDate(rDate);

      setAssignedBy(assignment.assigned_by || '');
      setReturnedBy(assignment.returned_by || assignment.returned_to || '');
      setAssignedByUserId('');
      setReturnedByUserId('');
      setAssignedByTouched(false);
      setReturnedByTouched(false);
      setReturnReason(
        assignment.return_reason ||
          assignment.return_remark ||
          assignment.reason ||
          ''
      );
      setRemarks(
        assignment.notes ||
          assignment.remarks ||
          assignment.handover_notes ||
          ''
      );
      setCorrectionReason('');
    }
  }, [isOpen, assignment]);

  // Actual tenant staff only. An old UUID or generic User is never guessed.
  useEffect(() => {
    if (!isOpen || !assignment) return;
    let cancelled = false;
    setStaffUsers([]);
    setStaffError(null);
    setStaffLoading(true);
    simService.getHistoryStaffUsers()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setStaffError(result.error || 'Staff list unavailable.');
          return;
        }
        setStaffUsers(result.users);
        const findVerified = (recorded: unknown): string => {
          const value = String(recorded || '').trim();
          if (!value) return '';
          const matching = result.users.filter((user) =>
            user.id === value || user.full_name.toLocaleLowerCase() === value.toLocaleLowerCase()
          );
          return matching.length === 1 ? matching[0].id : '';
        };
        setAssignedByUserId(findVerified(assignment.assigned_by));
        setReturnedByUserId(findVerified(assignment.returned_by || assignment.returned_to));
      })
      .catch(() => {
        if (!cancelled) setStaffError('Staff list could not be loaded. Try reopening this form.');
      })
      .finally(() => {
        if (!cancelled) setStaffLoading(false);
      });
    return () => { cancelled = true; };
  }, [isOpen, assignment]);

  const formatStaffLabel = (user: SimHistoryStaffUser): string => {
    const duplicates = staffUsers.filter((item) => item.full_name.toLocaleLowerCase() === user.full_name.toLocaleLowerCase());
    const suffix = duplicates.length > 1 ? ' · User ' + user.id.slice(-6) : '';
    const role = user.is_owner ? ' (Owner)' : user.designation ? ' — ' + user.designation : '';
    const inactive = user.status && user.status.toUpperCase() !== 'ACTIVE' ? ' (Inactive)' : '';
    return user.full_name + role + suffix + inactive;
  };

  if (!isOpen || !assignment) return null;

  const mobileNumber =
    assignment.mobile_number && assignment.mobile_number !== '—'
      ? assignment.mobile_number
      : assignment.sim_number && assignment.sim_number !== '—'
      ? assignment.sim_number
      : 'Not recorded';

  const provider = assignment.provider || assignment.vendor || 'ETISALAT';
  const iccid =
    assignment.iccid && assignment.iccid !== '—'
      ? assignment.iccid
      : assignment.sim_serial_number && assignment.sim_serial_number !== '—'
      ? assignment.sim_serial_number
      : 'Not recorded';

  const employeeName =
    assignment.employee_name || employee?.full_name || employee?.name || 'Rider';
  const employeeCode =
    assignment.employee_code ||
    (assignment.employee_id ? String(assignment.employee_id).replace(/^emp_/, '') : '') ||
    employee?.employee_code ||
    '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validation
    if (!assignedDate.trim()) {
      setError('Assignment date is required.');
      return;
    }
    if (assignment.is_synthetic || !assignment.id || /^(asgn_live_|asgn_last_|asgn_sim_)/.test(String(assignment.id))) {
      setError('Only saved assignment history records can be edited; please use SIM Management to reconcile an unsaved handover.');
      return;
    }

    if (!isSimActive && returnDate.trim()) {
      const aTime = new Date(assignedDate).getTime();
      const rTime = new Date(returnDate).getTime();
      if (!isNaN(aTime) && !isNaN(rTime) && rTime < aTime) {
        setError(`Return date (${returnDate}) cannot be earlier than assignment date (${assignedDate}).`);
        return;
      }
    }

    if (!correctionReason.trim()) {
      setError('Correction reason / justification is required for immutable audit logging.');
      return;
    }

    setLoading(true);

    try {
      const updatesPayload: any = {
        assigned_date: assignedDate.trim(),
        // Send only an explicitly selected, server-verified staff profile ID.
        // If not changed, preserve the original recorded operator.
        ...(assignedByTouched && assignedByUserId ? { assigned_by: assignedByUserId } : {}),
        notes: remarks.trim() || undefined,
        remarks: remarks.trim() || undefined,
        editReason: correctionReason.trim(),
        reason: correctionReason.trim(),
      };

      if (!isSimActive) {
        if (returnDate.trim()) {
          updatesPayload.return_date = returnDate.trim();
          updatesPayload.returned_date = returnDate.trim();
        }
        if (returnedByTouched && returnedByUserId) {
          updatesPayload.returned_by = returnedByUserId;
        }
        if (returnReason.trim()) {
          updatesPayload.return_reason = returnReason.trim();
          updatesPayload.return_remark = returnReason.trim();
        }
      }

      const res = await simService.updateAssignmentHistory(
        assignment.id,
        updatesPayload
      );

      if (res.success) {
        // Broadcast event to refresh SIM Management tab/views if open
        window.dispatchEvent(new CustomEvent('erp:sims-updated'));
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to update SIM assignment record.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating SIM assignment record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header matching EditVehicleAssignmentModal */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Edit SIM Assignment History Record
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Correct recorded dates, custodians, or remarks with permanent audit trace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {staffError && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              Staff user list unavailable: {staffError}. Existing operator names will remain unchanged. Reopen to retry.
            </div>
          )}

          {/* Context Banner */}
          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                SIM Mobile Number
              </span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-300">
                {mobileNumber} ({provider})
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                ICCID / Serial
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate block">
                {iccid}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Employee
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {employeeName} {employeeCode ? `(${employeeCode})` : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">
                Cycle Status
              </span>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                  isSimActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {isSimActive ? 'ACTIVE HANDOVER' : 'RETURNED'}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800">
            Note: Editing corrects historical documentation and dates. It does not reassign, unassign, or transfer the line to another employee.
          </div>

          {/* Assignment Details */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 space-y-3 bg-slate-50/30 dark:bg-slate-800/10">
            <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              1. Assignment Details
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assignment Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={assignedDate}
                    onChange={(e) => setAssignedDate(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned By
                </label>
                <select
                  aria-label="Select the verified staff user who originally assigned the SIM"
                  value={assignedByUserId}
                  onChange={(e) => { setAssignedByUserId(e.target.value); setAssignedByTouched(true); }}
                  disabled={staffLoading || Boolean(staffError) || staffUsers.length === 0}
                  className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  <option value="">{staffLoading ? 'Loading staff users...' : 'Keep recorded staff / Select user'}</option>
                  {staffUsers.map((user) => (
                    <option key={user.id} value={user.id}>{formatStaffLabel(user)}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  Recorded: {assignedBy || 'Not recorded'}. Select the actual staff user to correct this history.
                </p>
              </div>
            </div>
          </div>

          {/* Return Details (Shown for Returned cycles or allow recording return date if returned) */}
          {!isSimActive && (
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3.5 space-y-3 bg-slate-50/30 dark:bg-slate-800/10">
              <h4 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                2. Return Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Return Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full px-3 py-1.5 pl-8 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                    <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Returned By / Received By
                  </label>
                  <select
                    aria-label="Select the verified staff user who received the returned SIM"
                    value={returnedByUserId}
                    onChange={(e) => { setReturnedByUserId(e.target.value); setReturnedByTouched(true); }}
                    disabled={staffLoading || Boolean(staffError) || staffUsers.length === 0}
                    className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-sky-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    <option value="">{staffLoading ? 'Loading staff users...' : 'Keep recorded staff / Select user'}</option>
                    {staffUsers.map((user) => (
                      <option key={user.id} value={user.id}>{formatStaffLabel(user)}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Recorded: {returnedBy || 'Not recorded'}. Choose who actually received the SIM.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Return Reason
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Rider returned SIM card to depot inventory"
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-1.5 pl-8 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                  />
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>
          )}

          {/* Remarks / Handover Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Remarks &amp; Handover Notes
            </label>
            <textarea
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Additional handover details or condition notes..."
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
            />
          </div>

          {/* Mandatory Correction Justification */}
          <div className="border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 rounded-xl space-y-1.5">
            <label className="block text-xs font-bold text-amber-900 dark:text-amber-300">
              Correction Justification (Mandatory Audit Trail) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Reason for modifying this historical record (e.g. Correcting clerical date typo)..."
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
            <p className="text-[10px] text-amber-800/80 dark:text-amber-400/80">
              Original values, your editor identity, and timestamp will be permanently preserved in the immutable audit log.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Immutable Audit Trail Active</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Authoritative Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
