import React from 'react';
import {
  X,
  Smartphone,
  Calendar,
  User,
  FileText,
  ShieldCheck,
  Edit2,
  Clock,
  History,
  Info,
} from 'lucide-react';

interface ViewSimAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any | null;
  employee?: any | null;
  onEdit?: (assignment: any) => void;
}

export const ViewSimAssignmentModal: React.FC<ViewSimAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  employee,
  onEdit,
}) => {
  if (!isOpen || !assignment) return null;

  const isSimActive =
    assignment.status === 'ACTIVE' ||
    assignment.status === 'ASSIGNED' ||
    assignment.assignment_status === 'ACTIVE' ||
    assignment.assignment_status === 'ASSIGNED' ||
    assignment.assignment_status === 'Assigned';

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
    assignment.employee_name || employee?.full_name || employee?.name || 'Not recorded';

  const employeeCode =
    assignment.employee_code ||
    (assignment.employee_id ? String(assignment.employee_id).replace(/^emp_/, '') : '') ||
    employee?.employee_code ||
    employee?.id ||
    'Not recorded';

  const assignedDate =
    assignment.assigned_date ||
    (assignment.assigned_at
      ? assignment.assigned_at.includes('T')
        ? assignment.assigned_at.split('T')[0]
        : assignment.assigned_at
      : 'Not recorded');

  const returnedDate = isSimActive
    ? 'Active Handover / In Use'
    : assignment.return_date ||
      assignment.returned_date ||
      (assignment.returned_at
        ? assignment.returned_at.includes('T')
          ? assignment.returned_at.split('T')[0]
          : assignment.returned_at
        : 'Not recorded');

  const assignedBy = assignment.assigned_by || 'Operations Team';
  const returnedBy = isSimActive
    ? '—'
    : assignment.returned_by || assignment.returned_to || 'Operations Admin';

  const returnReason = isSimActive
    ? '—'
    : assignment.return_reason ||
      assignment.return_remark ||
      assignment.reason ||
      'Not recorded';

  const remarks =
    assignment.notes ||
    assignment.remarks ||
    assignment.handover_notes ||
    'No additional remarks recorded.';

  const correctionHistory = Array.isArray(assignment.correction_history)
    ? assignment.correction_history
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  SIM Assignment & Return Details
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSimActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isSimActive ? 'ACTIVE / ASSIGNED' : 'RETURNED TO DEPOT'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Authoritative lifecycle record for company_pixel_syntax
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

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Top Summary Card */}
          <div className="p-3.5 bg-sky-50/60 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/40 rounded-xl grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Mobile Number
              </span>
              <span className="font-mono font-bold text-sky-700 dark:text-sky-300 text-sm">
                {mobileNumber}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Provider / Network
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {provider}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                ICCID / Serial
              </span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {iccid}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Assigned Employee
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {employeeName}
              </span>
              <span className="text-[10px] font-mono text-slate-400 ml-1">
                ({employeeCode})
              </span>
            </div>
          </div>

          {/* Detailed Assignment & Return Data */}
          <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="p-3 bg-slate-50/50 dark:bg-slate-800/20 font-bold uppercase tracking-wider text-[10px] text-slate-500">
              Lifecycle Metadata
            </div>

            <div className="p-3 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">
                  Assignment Date
                </span>
                <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>{assignedDate}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">
                  Assigned By
                </span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{assignedBy}</span>
                </div>
              </div>
            </div>

            <div className="p-3 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">
                  Return Date
                </span>
                <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{returnedDate}</span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">
                  Returned By
                </span>
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>{returnedBy}</span>
                </div>
              </div>
            </div>

            <div className="p-3">
              <span className="text-slate-400 block text-[10px] uppercase">
                Return Reason
              </span>
              <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium">
                {returnReason}
              </p>
            </div>

            <div className="p-3">
              <span className="text-slate-400 block text-[10px] uppercase">
                Remarks / Handover Notes
              </span>
              <p className="text-slate-600 dark:text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed">
                {remarks}
              </p>
            </div>
          </div>

          {/* Immutable Correction Audit Log Section */}
          {correctionHistory.length > 0 && (
            <div className="border border-amber-200 dark:border-amber-800/60 bg-amber-50/40 dark:bg-amber-950/20 rounded-xl p-3.5 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <History className="w-3.5 h-3.5" />
                <span>Correction Audit Trail ({correctionHistory.length} edits)</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto divide-y divide-amber-200/50 dark:divide-amber-800/40 pr-1">
                {correctionHistory.map((entry: any, idx: number) => (
                  <div key={idx} className="pt-2 first:pt-0 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                      <span>By: <strong className="text-slate-800 dark:text-slate-200">{entry.edited_by || 'Staff'}</strong></span>
                      <span>{entry.edited_at ? new Date(entry.edited_at).toLocaleString() : 'Recent'}</span>
                    </div>
                    {entry.reason && (
                      <p className="text-slate-700 dark:text-slate-300 italic">
                        &quot;{entry.reason}&quot;
                      </p>
                    )}
                    {entry.original_values && (
                      <div className="text-[10px] text-slate-500 font-mono bg-white/70 dark:bg-slate-900/60 p-1.5 rounded border border-amber-100 dark:border-amber-900/30">
                        Prior: Assigned {entry.original_values.assigned_date || '—'} | Returned {entry.original_values.return_date || '—'} | Reason: {entry.original_values.return_reason || '—'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Authoritative record verified</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(assignment);
                }}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs inline-flex items-center gap-1.5 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Record
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
