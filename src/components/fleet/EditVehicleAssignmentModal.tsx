import React, { useState, useEffect } from 'react';
import {
  X,
  Edit3,
  Calendar,
  Clock,
  Gauge,
  User,
  FileText,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { fleetService } from '../../services/fleetService';
import { authService } from '../../services/authService';

interface EditVehicleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: any | null;
  vehiclePlate?: string;
  onSuccess: () => void;
}

export const EditVehicleAssignmentModal: React.FC<EditVehicleAssignmentModalProps> = ({
  isOpen,
  onClose,
  assignment,
  vehiclePlate,
  onSuccess,
}) => {
  const [assignmentDate, setAssignmentDate] = useState('');
  const [assignmentTime, setAssignmentTime] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [startingOdometer, setStartingOdometer] = useState<number | ''>('');
  const [returnOdometer, setReturnOdometer] = useState<number | ''>('');
  const [returnReason, setReturnReason] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [assignedBy, setAssignedBy] = useState('');
  const [returnedBy, setReturnedBy] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && assignment) {
      setError(null);
      setAssignmentDate(assignment.assignment_date ? assignment.assignment_date.split('T')[0] : '');
      setAssignmentTime(assignment.assignment_time || (assignment.assignment_date && assignment.assignment_date.includes('T') ? assignment.assignment_date.split('T')[1].slice(0, 5) : ''));
      setReturnDate(assignment.return_date ? assignment.return_date.split('T')[0] : '');
      setReturnTime(assignment.return_time || (assignment.return_date && assignment.return_date.includes('T') ? assignment.return_date.split('T')[1].slice(0, 5) : ''));
      setStartingOdometer(assignment.starting_odometer ?? assignment.start_odometer ?? '');
      setReturnOdometer(assignment.return_odometer ?? assignment.end_odometer ?? '');
      setReturnReason(assignment.return_reason || '');
      setReturnNotes(assignment.return_notes || '');
      setAssignedBy(assignment.assigned_by || '');
      setReturnedBy(assignment.returned_by || '');
      setHandoverNotes(assignment.handover_notes || assignment.notes || '');
    }
  }, [isOpen, assignment]);

  if (!isOpen || !assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fleetService.updateAssignmentHistory(assignment.id, {
        assignment_date: assignmentDate || undefined,
        assignment_time: assignmentTime || undefined,
        return_date: returnDate || undefined,
        return_time: returnTime || undefined,
        starting_odometer: startingOdometer !== '' ? Number(startingOdometer) : undefined,
        return_odometer: returnOdometer !== '' ? Number(returnOdometer) : undefined,
        return_reason: returnReason || undefined,
        return_notes: returnNotes || undefined,
        assigned_by: assignedBy || undefined,
        returned_by: returnedBy || undefined,
        handover_notes: handoverNotes || undefined,
      });

      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to update assignment record.');
      }
    } catch (err: any) {
      setError(err.message || 'Error updating assignment record.');
    } finally {
      setLoading(false);
    }
  };

  const riderName = assignment.employee_name || assignment.rider_name || assignment.employee?.name || 'Rider';
  const riderCode = assignment.employee_code || assignment.rider_id || assignment.employee_id || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Edit Vehicle Assignment History Record
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Correct recorded dates, odometers, or remarks with permanent audit trace
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

        <div className="px-6 py-2.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-200 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Editing for: <strong>{riderName} {riderCode ? `(${riderCode})` : ''}</strong> {vehiclePlate ? `• Vehicle: ${vehiclePlate}` : ''}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl font-medium">
              {error}
            </div>
          )}

          {/* Assignment Date & Time */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <span className="font-bold text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">
              1. Issue / Assignment Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Assigned Date
                </label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Assigned Time
                </label>
                <input
                  type="time"
                  value={assignmentTime}
                  onChange={(e) => setAssignmentTime(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Start Odometer (KM)
                </label>
                <input
                  type="number"
                  value={startingOdometer}
                  onChange={(e) => setStartingOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                Assigned By (User Name)
              </label>
              <input
                type="text"
                value={assignedBy}
                onChange={(e) => setAssignedBy(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Return Date, Time & Odometer */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-3">
            <span className="font-bold text-slate-900 dark:text-white block text-[11px] uppercase tracking-wider">
              2. Return / Handover Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Returned Date
                </label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Returned Time
                </label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Return Odometer (KM)
                </label>
                <input
                  type="number"
                  value={returnOdometer}
                  onChange={(e) => setReturnOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-mono font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Return Reason / Remark
                </label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. RETURN, REPLACEMENT, DAMAGED..."
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                  Returned By (User Name)
                </label>
                <input
                  type="text"
                  value={returnedBy}
                  onChange={(e) => setReturnedBy(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                />
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px] mb-1">
                Return Notes / Condition Summary
              </label>
              <input
                type="text"
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                placeholder="e.g. Returned in good condition, helmet received"
                className="w-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-2 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
              />
            </div>
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer"
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
