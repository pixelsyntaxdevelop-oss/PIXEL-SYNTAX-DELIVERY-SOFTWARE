import React, { useState, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Calendar,
  History,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Building,
  ArrowRightLeft,
} from 'lucide-react';
import {
  labourBuildingService,
  LabourBuilding,
  LabourBuildingAssignment,
} from '../../services/labourBuildingService';

interface LabourBuildingAssignmentSectionProps {
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  isLabourEmployee: boolean;
  initialActiveAssignment?: LabourBuildingAssignment | null;
  initialHistory?: LabourBuildingAssignment[];
  onAssignmentUpdated?: () => void;
  showHistoryTable?: boolean;
}

export const LabourBuildingAssignmentSection: React.FC<LabourBuildingAssignmentSectionProps> = ({
  employeeId,
  employeeCode,
  employeeName,
  isLabourEmployee,
  initialActiveAssignment,
  initialHistory,
  onAssignmentUpdated,
  showHistoryTable = true,
}) => {
  const [activeAssignment, setActiveAssignment] = useState<LabourBuildingAssignment | null>(
    initialActiveAssignment || null
  );
  const [history, setHistory] = useState<LabourBuildingAssignment[]>(initialHistory || []);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'ASSIGN' | 'CHANGE'>('ASSIGN');

  // Modal form state
  const [activeBuildings, setActiveBuildings] = useState<LabourBuilding[]>([]);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState<LabourBuilding | null>(null);
  const [assignmentDate, setAssignmentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Synchronize when props change
  useEffect(() => {
    if (initialActiveAssignment !== undefined) {
      setActiveAssignment(initialActiveAssignment);
    }
  }, [initialActiveAssignment]);

  useEffect(() => {
    if (initialHistory !== undefined) {
      setHistory(initialHistory);
    }
  }, [initialHistory]);

  const loadAssignments = async () => {
    if (!employeeId || !isLabourEmployee) return;
    setLoading(true);
    try {
      const res = await labourBuildingService.getEmployeeBuildingAssignments(employeeId);
      if (res.success) {
        setActiveAssignment(res.activeAssignment);
        setHistory(res.history);
      }
    } catch (err) {
      console.error('Failed to load building assignments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLabourEmployee && employeeId) {
      loadAssignments();
    }
  }, [employeeId, isLabourEmployee]);

  // If not a labour employee, strictly DO NOT render work location building controls
  if (!isLabourEmployee) {
    return null;
  }

  const handleOpenModal = async (mode: 'ASSIGN' | 'CHANGE') => {
    setModalMode(mode);
    setSelectedBuilding(null);
    setBuildingSearch('');
    setNotes('');
    setAssignmentDate(new Date().toISOString().split('T')[0]);
    setModalError(null);
    setIsModalOpen(true);
    setLoadingBuildings(true);

    try {
      const res = await labourBuildingService.getActiveBuildings();
      if (res.success) {
        setActiveBuildings(res.data);
      } else {
        setModalError(res.error || 'Failed to load active buildings.');
      }
    } catch (err: any) {
      setModalError(err.message || 'Error loading buildings.');
    } finally {
      setLoadingBuildings(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuilding) {
      setModalError('Please select an active building from the list.');
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      const input = {
        employee_id: employeeId,
        building_id: selectedBuilding.id,
        assignment_date: assignmentDate,
        notes: notes.trim() || undefined,
      };

      const res =
        modalMode === 'CHANGE'
          ? await labourBuildingService.transferBuilding(input)
          : await labourBuildingService.assignBuilding(input);

      if (res.success) {
        setIsModalOpen(false);
        setFeedback(
          modalMode === 'CHANGE'
            ? `Building successfully changed to ${selectedBuilding.name}.`
            : `Building ${selectedBuilding.name} assigned successfully.`
        );
        setTimeout(() => setFeedback(null), 4000);
        await loadAssignments();
        if (onAssignmentUpdated) onAssignmentUpdated();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('erp:labour-building-assigned', {
              detail: { employeeId, building: selectedBuilding },
            })
          );
          window.dispatchEvent(new CustomEvent('erp:master-employees-updated'));
        }
      } else {
        setModalError(res.error || 'Failed to assign building.');
      }
    } catch (err: any) {
      setModalError(err?.message || 'Failed to assign building.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBuildings = activeBuildings.filter((b) => {
    if (!buildingSearch.trim()) return true;
    const term = buildingSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(term) ||
      (b.area_location || '').toLowerCase().includes(term) ||
      (b.emirate || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div className="flex items-center gap-2 p-3 text-xs font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* COMPACT WORK LOCATION / BUILDING CARD */}
      {/* ========================================================================= */}
      <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  WORK LOCATION / BUILDING
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Labour Site
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Authoritative site assignment for Labour workforce</p>
            </div>
          </div>

          <div>
            {activeAssignment ? (
              <button
                type="button"
                id="btn-change-building"
                onClick={() => handleOpenModal('CHANGE')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Change Building
              </button>
            ) : (
              <button
                type="button"
                id="btn-assign-building"
                onClick={() => handleOpenModal('ASSIGN')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Building
              </button>
            )}
          </div>
        </div>

        {activeAssignment ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                Building Name
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-white text-sm truncate">
                  {activeAssignment.building_name}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                Area / Location
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {activeAssignment.area_location || 'Not specified'}
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                Emirate
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 block mt-1">
                {activeAssignment.emirate || 'Dubai'}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                Assignment Date
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {activeAssignment.assignment_date}
                </span>
                <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  ACTIVE
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 bg-white dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No Work Location / Building Assigned
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
              Assign this Labour employee to an active building work location.
            </p>
            <button
              type="button"
              onClick={() => handleOpenModal('ASSIGN')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign Building
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BUILDING ASSIGNMENT HISTORY TABLE */}
      {/* ========================================================================= */}
      {showHistoryTable && history && history.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Building Assignment History
              </h5>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                {history.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">Preserved chronological site history</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-slate-500 text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Building</th>
                  <th className="py-2.5 px-4 font-semibold">Area</th>
                  <th className="py-2.5 px-4 font-semibold">Start Date</th>
                  <th className="py-2.5 px-4 font-semibold">End Date</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>{item.building_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400">
                      {item.area_location || '-'}
                      {item.emirate ? ` (${item.emirate})` : ''}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                      {item.assignment_date}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">
                      {item.end_date || (item.status === 'ACTIVE' ? 'Present' : '-')}
                    </td>
                    <td className="py-2.5 px-4">
                      {item.status === 'ACTIVE' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          Active
                        </span>
                      ) : item.status === 'TRANSFERRED' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Transferred
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400">
                          {item.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ASSIGN / CHANGE BUILDING MODAL */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {modalMode === 'CHANGE' ? 'Change Work Location / Building' : 'Assign Work Location / Building'}
                </h3>
                <p className="text-xs text-slate-500">
                  {employeeName ? `${employeeName} ` : ''}
                  {employeeCode ? `(${employeeCode})` : ''} • Labour Workforce
                </p>
              </div>
            </div>

            {modalMode === 'CHANGE' && activeAssignment && (
              <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-1.5 font-bold">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  Moving from current building: {activeAssignment.building_name}
                </div>
                <p className="text-[11px] mt-1 text-amber-700 dark:text-amber-400">
                  Previous building assignment will be concluded on the effective date and preserved in history. Employee Project, Status, Bike, and SIM will remain completely untouched.
                </p>
              </div>
            )}

            {modalError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto mt-4 space-y-4 pr-1">
              {/* Searchable Building Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Select Active Building / Site <span className="text-rose-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={buildingSearch}
                    onChange={(e) => setBuildingSearch(e.target.value)}
                    placeholder="Search active buildings by name, area, emirate..."
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {loadingBuildings ? (
                  <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    Loading active buildings from Master...
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {filteredBuildings.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No active buildings found matching "{buildingSearch}".
                      </div>
                    ) : (
                      filteredBuildings.map((b) => {
                        const isSelected = selectedBuilding?.id === b.id;
                        const isCurrent = activeAssignment?.building_id === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBuilding(b)}
                            className={`p-3 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-l-4 border-indigo-600'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                                <span>{b.name}</span>
                                {isCurrent && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>{b.area_location || 'Area not specified'}</span>
                                <span>•</span>
                                <span>{b.emirate}</span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              <input
                                type="radio"
                                name="selectedBuilding"
                                checked={isSelected}
                                onChange={() => setSelectedBuilding(b)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  Only verified Active buildings from the Labour Building Master can be selected. Free-text names are strictly prohibited.
                </p>
              </div>

              {/* Effective / Assignment Date */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Effective / Assignment Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={assignmentDate}
                  onChange={(e) => setAssignmentDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional site notes, supervisor, or shift details..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedBuilding}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : modalMode === 'CHANGE' ? (
                    'Confirm Change'
                  ) : (
                    'Confirm Assignment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
