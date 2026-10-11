import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  User,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { simService } from '../../../services/simService';

interface EditSimAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any | null;
  simNumber?: string;
  simMobileNumber?: string;
  onSuccess: () => void;
}

export const EditSimAssignmentModal: React.FC<EditSimAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  simNumber,
  simMobileNumber,
  onSuccess,
}) => {
  const [assignedDate, setAssignedDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [returnedBy, setReturnedBy] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assignment) {
      setError(null);
      setAssignedDate(assignment.assigned_date ? assignment.assigned_date.split('T')[0] : (assignment.assigned_at ? assignment.assigned_at.split('T')[0] : ''));
      setReturnDate(assignment.return_date ? assignment.return_date.split('T')[0] : (assignment.returned_at ? assignment.returned_at.split('T')[0] : ''));
      setAssignedBy(assignment.assigned_by || '');
      setReturnedBy(assignment.returned_by || '');
      setReturnReason(assignment.return_reason || assignment.reason || '');
      setNotes(assignment.notes || assignment.handover_notes || '');
    }
  }, [isOpen, assignment]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await simService.updateAssignmentHistory(assignment.id, {
        assigned_date: assignedDate || undefined,
        return_date: returnDate || undefined,
        returned_date: returnDate || undefined,
        assigned_by: assignedBy || undefined,
        returned_by: returnedBy || undefined,
        return_reason: returnReason || undefined,
        notes: notes || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to update SIM assignment record.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating SIM assignment log.');
    } finally {
      setLoading(false);
    }
  };

  const employeeName = assignment.employee_name || assignment.rider_name || assignment.name || 'Rider';
  const employeeCode = assignment.employee_code || assignment.employee_id || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Edit SIM Assignment History Record
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Correct recorded dates, assigner, returner, or remarks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 bg-indigo-50 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Editing for: <strong>{employeeName} {employeeCode ? `(${employeeCode})` : ''}</strong> {(simNumber || simMobileNumber) ? `• SIM: ${simNumber || simMobileNumber}` : ''}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Assigned Date</span>
              </label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Assigned By</span>
              </label>
              <input
                type="text"
                value={assignedBy}
                onChange={(e) => setAssignedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-500" /> Returned Date</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-500" /> Returned By</span>
              </label>
              <input
                type="text"
                value={returnedBy}
                onChange={(e) => setReturnedBy(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              Return Reason / Remark
            </label>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Return to Stock, Resigned, Damaged SIM"
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-medium"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Handover confirmed in good working order"
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-normal"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
