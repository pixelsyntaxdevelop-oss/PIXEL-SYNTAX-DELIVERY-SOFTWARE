import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Edit2, Loader2, Smartphone, X } from 'lucide-react';
import { simService, SimHistoryStaffUser } from '../../services/simService';

interface VerifyLegacySimHandoverModalProps {
  assignment: any | null;
  employee?: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * A historical summary is NOT a stored SIM handover. Do not pretend it can be edited.
 * For a still-held legacy SIM the operator may verify actual custody and explicitly
 * record the original date and assigner. The backend refuses contradictory inventory.
 */
export const VerifyLegacySimHandoverModal: React.FC<VerifyLegacySimHandoverModalProps> = ({
  assignment, employee, onClose, onSuccess,
}) => {
  const [staff, setStaff] = useState<SimHistoryStaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [assignedDate, setAssignedDate] = useState('');
  const [assignedByProfileId, setAssignedByProfileId] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!assignment) return;
    let cancelled = false;
    setAssignedDate(String(assignment.assigned_date || '').slice(0, 10));
    setAssignedByProfileId('');
    setReason('');
    setNotes('');
    setConfirmed(false);
    setError('');
    setStaff([]);
    setStaffError('');
    setStaffLoading(true);
    simService.getHistoryStaffUsers()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setStaffError(result.error || 'Staff list is unavailable.');
          return;
        }
        setStaff(result.users);
        // Prefill only if the saved legacy actor uniquely matches a verified staff profile.
        const recorded = String(assignment.assigned_by || '').trim().toLowerCase();
        const matches = result.users.filter(user =>
          recorded && (user.id.toLowerCase() === recorded || user.full_name.toLowerCase() === recorded)
        );
        if (matches.length === 1) setAssignedByProfileId(matches[0].id);
      })
      .catch(() => { if (!cancelled) setStaffError('Cannot load verified staff profiles. Reopen and try again.'); })
      .finally(() => { if (!cancelled) setStaffLoading(false); });
    return () => { cancelled = true; };
  }, [assignment]);

  if (!assignment) return null;
  const isCurrent = ['ACTIVE', 'ASSIGNED'].includes(
    String(assignment.assignment_status || assignment.status || '').toUpperCase()
  );
  const employeeId = assignment.employee_id || employee?.id;
  const cardId = assignment.sim_card_id || assignment.sim_id;
  const number = assignment.mobile_number || assignment.sim_number || 'SIM number not recorded';

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!isCurrent) {
      setError('A returned legacy summary has no verified return record. Please review it in SIM Management.');
      return;
    }
    if (!employeeId || !cardId) {
      setError('Employee or SIM could not be identified. Close this window and reopen the employee SIM record.');
      return;
    }
    if (staffError) { setError(staffError); return; }
    if (!assignedDate) { setError('Enter the actual original assignment date before recording this handover.'); return; }
    if (!assignedByProfileId) { setError('Select the staff member who originally assigned this SIM.'); return; }
    if (reason.trim().length < 5) { setError('Explain why the handover was missing (at least 5 characters). For example: Imported without history.'); return; }
    if (!confirmed) { setError('Tick the confirmation that this SIM is physically with this employee.'); return; }
    setSaving(true);
    try {
      const result = await simService.verifyLegacyCurrentHandover({
        employeeId: String(employeeId),
        simCardId: String(cardId),
        assignedDate,
        assignedByProfileId,
        correctionReason: reason.trim(),
        notes: notes.trim() || undefined,
        confirmPhysicalCustody: true,
      });
      if (!result.success) {
        setError(result.error || 'Cannot verify this handover. No changes were made.');
        return;
      }
      window.dispatchEvent(new CustomEvent('erp:sims-updated'));
      onClose();
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Verification failed; inventory was not changed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/65 p-3 sm:p-6">
      <div
        role="dialog" aria-modal="true" aria-label="Review legacy SIM assignment"
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-700">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
              <Edit2 className="h-5 w-5 text-amber-600" /> Review SIM Assignment
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {employee?.full_name || assignment.employee_name || 'Employee'} · {number}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-5">
          <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Historical handover not recorded
            </div>
            <p className="mt-2">
              The employee profile references this SIM, but there is no saved assignment transaction
              for this employee. Its actual inventory custody must be verified before any date or
              original assigner can be recorded. Other employees and SIMs will not be changed.
            </p>
          </div>

          {!isCurrent ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              This is a previous/returned card summary, not a verified return record. Its date and
              return operator cannot be invented. Please review the original SIM history and evidence
              in SIM Management before a historical correction.
            </div>
          ) : (
            <form onSubmit={save} noValidate className="space-y-4">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Confirm the SIM is currently with this employee
              </p>
              <div>
                <label htmlFor="legacy-sim-date" className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Actual original assignment date *
                </label>
                <input id="legacy-sim-date" type="date" required value={assignedDate}
                  onChange={event => setAssignedDate(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              <div>
                <label htmlFor="legacy-sim-operator" className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Actual person who originally assigned the SIM *
                </label>
                <select id="legacy-sim-operator" required value={assignedByProfileId}
                  onChange={event => setAssignedByProfileId(event.target.value)}
                  disabled={staffLoading || Boolean(staffError)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">Choose verified staff (do not guess)</option>
                  {staff.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}{user.is_owner ? ' (Owner)' : user.designation ? ' — ' + user.designation : ''}
                    </option>
                  ))}
                </select>
                {staffLoading && <p className="mt-1 text-xs text-slate-500">Loading verified staff...</p>}
                {staffError && <p role="alert" className="mt-1 text-xs text-rose-700">{staffError}</p>}
              </div>
              <div>
                <label htmlFor="legacy-sim-reason" className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Why was the original handover missing? *
                </label>
                <textarea id="legacy-sim-reason" required minLength={5} maxLength={500} rows={2}
                  value={reason} onChange={event => setReason(event.target.value)}
                  placeholder="e.g., Original handover imported without a history record"
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              <div>
                <label htmlFor="legacy-sim-notes" className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-300">Notes (optional)</label>
                <textarea id="legacy-sim-notes" maxLength={1000} rows={2} value={notes}
                  onChange={event => setNotes(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              <label className="flex cursor-pointer gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0" />
                <span><Check className="mr-1 inline h-4 w-4" /> I have verified this SIM is physically with this employee. Recording it will mark the SIM assigned in inventory and create a real, audited handover.</span>
              </label>
              {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter the actual date, select the original assigner, give a reason of at least 5 characters,
                and confirm custody. After saving, you can return this SIM to inventory.
              </p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button type="button" onClick={onClose} disabled={saving}
                  className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">Cancel</button>
                <button type="submit" disabled={saving || staffLoading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 text-sm font-bold text-white disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                  {saving ? 'Verifying...' : 'Verify & Record Handover'}
                </button>
              </div>
            </form>
          )}
          {!isCurrent && <div className="mt-4 flex justify-end">
            <button type="button" onClick={onClose} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">Close</button>
          </div>}
        </div>
      </div>
    </div>
  );
};
