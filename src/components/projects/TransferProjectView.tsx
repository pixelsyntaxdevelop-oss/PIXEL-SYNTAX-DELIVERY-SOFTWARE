import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Building,
  Tag,
  Calendar,
  FileText,
  RefreshCw,
  X,
  Check,
  ShieldCheck,
  FolderKanban,
  AlertTriangle
} from 'lucide-react';
import {
  riderProjectService,
  ProjectMasterItem,
  ActiveAssignmentItem
} from '../../services/riderProjectService';

interface TransferProjectViewProps {
  initialEmployeeId?: string;
  initialAssignmentId?: string;
  onNavigate: (module: string, params?: any) => void;
  onOpenEmployee360?: (empId: string) => void;
}

const TRANSFER_REASONS = [
  'Client Transfer Request',
  'Fleet Reallocation',
  'Contract Transition',
  'Operational Performance Reassignment',
  'Rider Request / Preference',
  'Hub / Zone Consolidation',
  'Other',
];

export const TransferProjectView: React.FC<TransferProjectViewProps> = ({
  initialEmployeeId,
  initialAssignmentId,
  onNavigate,
  onOpenEmployee360,
}) => {
  // Master Data
  const [activeProjects, setActiveProjects] = useState<ProjectMasterItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Employee Selection
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Current Assignment to End
  const [selectedCurrentAssignmentId, setSelectedCurrentAssignmentId] = useState<string>(
    initialAssignmentId || ''
  );

  // Destination Project Selection
  const [destinationProjectId, setDestinationProjectId] = useState<string>('');
  const [destinationProject, setDestinationProject] = useState<ProjectMasterItem | null>(null);

  // New External Rider ID & Conflict Validation
  const [newExternalRiderId, setNewExternalRiderId] = useState('');
  const [validatingId, setValidatingId] = useState(false);
  const [idValidationResult, setIdValidationResult] = useState<{
    valid: boolean;
    status: 'Available' | 'Already Assigned' | 'Historical ID' | 'Conflict';
    message?: string;
  } | null>(null);

  // Transfer Date & Reason
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferReason, setTransferReason] = useState('Client Transfer Request');
  const [isPrimaryNew, setIsPrimaryNew] = useState(true);
  const [transferNotes, setTransferNotes] = useState('');

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<any | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const extIdDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load Projects Master
  useEffect(() => {
    const load = async () => {
      setLoadingProjects(true);
      try {
        const list = await riderProjectService.getProjectsMaster({ status: 'Active' });
        setActiveProjects(list);
      } catch (err) {
        console.error('Error loading projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    load();
  }, []);

  // Preload initial employee if given
  useEffect(() => {
    if (initialEmployeeId) {
      const loadEmp = async () => {
        try {
          const res = await riderProjectService.searchEmployees(initialEmployeeId);
          if (res && res.length > 0) {
            handleSelectEmployee(res[0]);
          }
        } catch (err) {
          console.error('Error fetching employee:', err);
        }
      };
      loadEmp();
    }
  }, [initialEmployeeId]);

  // Handle Employee Search
  const handleSearchChange = (q: string) => {
    setEmployeeSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!q.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await riderProjectService.searchEmployees(q.trim());
        setSearchResults(results);
        setShowDropdown(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
  };

  const handleSelectEmployee = (emp: any) => {
    setSelectedEmployee(emp);
    setShowDropdown(false);
    setEmployeeSearchQuery('');

    // Pre-select first active assignment if available
    const activeAssignments = emp.active_assignments || [];
    if (activeAssignments.length > 0) {
      const current = initialAssignmentId
        ? activeAssignments.find((a: any) => a.id === initialAssignmentId) || activeAssignments[0]
        : activeAssignments[0];
      setSelectedCurrentAssignmentId(current.id);
      setIsPrimaryNew(current.is_primary);
    } else {
      setSelectedCurrentAssignmentId('');
    }
  };

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    setEmployeeSearchQuery('');
    setSearchResults([]);
    setSelectedCurrentAssignmentId('');
  };

  const currentAssignment = selectedEmployee?.active_assignments?.find(
    (a: any) => a.id === selectedCurrentAssignmentId
  );

  // Handle Destination Project Selection
  const handleDestinationProjectSelect = (projId: string) => {
    setDestinationProjectId(projId);
    const found = activeProjects.find((p) => p.id === projId) || null;
    setDestinationProject(found);
    setNewExternalRiderId('');
    setIdValidationResult(null);
  };

  // Live conflict validation for New External Rider ID
  useEffect(() => {
    if (extIdDebounceRef.current) clearTimeout(extIdDebounceRef.current);

    if (!destinationProjectId || !newExternalRiderId.trim()) {
      setIdValidationResult(null);
      return;
    }

    extIdDebounceRef.current = setTimeout(async () => {
      setValidatingId(true);
      try {
        const result = await riderProjectService.validateExternalId({
          projectId: destinationProjectId,
          externalRiderId: newExternalRiderId.trim(),
          employeeId: selectedEmployee?.id,
          startDate: transferDate,
        });
        setIdValidationResult(result);
      } catch (err) {
        console.error('Conflict check error:', err);
      } finally {
        setValidatingId(false);
      }
    }, 300);
  }, [destinationProjectId, newExternalRiderId, selectedEmployee?.id, transferDate]);

  // Submit Project Transfer
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployee) {
      setErrorMessage('Please search and select an employee first.');
      return;
    }
    if (!currentAssignment) {
      setErrorMessage('Please select the current active project assignment to transfer from.');
      return;
    }
    if (!destinationProjectId) {
      setErrorMessage('Please select the new destination project.');
      return;
    }
    if (destinationProjectId === currentAssignment.project_id) {
      setErrorMessage('Destination project cannot be the same as the current project.');
      return;
    }
    if (!transferDate) {
      setErrorMessage('Transfer effective date is required.');
      return;
    }
    if (!transferReason.trim()) {
      setErrorMessage('Transfer reason is mandatory.');
      return;
    }

    if (idValidationResult && !idValidationResult.valid) {
      setErrorMessage(
        idValidationResult.message ||
          'The external rider ID has a conflicting active assignment on the destination project.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: selectedEmployee.id,
        current_assignment_id: currentAssignment.id,
        new_project_id: destinationProjectId,
        new_external_rider_id: newExternalRiderId.trim() || undefined,
        move_date: transferDate,
        reason: transferReason,
        is_primary: isPrimaryNew,
        notes: transferNotes.trim() || undefined,
      };

      const res = await riderProjectService.moveProject(payload);

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to complete project transfer.');
        return;
      }

      setTransferSuccess({
        employee: selectedEmployee,
        fromProject: currentAssignment.project_name,
        fromExternalId: currentAssignment.external_rider_id,
        toProject: destinationProject?.name,
        toCode: destinationProject?.code,
        toExternalId: newExternalRiderId.trim(),
        toExternalIdLabel: destinationProject?.external_id_label || 'External Rider ID',
        transferDate,
        reason: transferReason,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during project transfer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setTransferSuccess(null);
    setSelectedEmployee(null);
    setSelectedCurrentAssignmentId('');
    setDestinationProjectId('');
    setDestinationProject(null);
    setNewExternalRiderId('');
    setIdValidationResult(null);
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferReason('Client Transfer Request');
    setTransferNotes('');
    setErrorMessage(null);
  };

  // SUCCESS SCREEN
  if (transferSuccess) {
    return (
      <div id="transfer_success_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
        <div className="bg-white border-b border-slate-200 px-6 py-6 shadow-xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              id="btn_back_to_mgmt_from_transfer_success"
              onClick={() => onNavigate('projects_list')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project Management
            </button>
            <span className="text-xs text-slate-500 font-medium">Transfer Completed</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 mt-8">
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="p-8 text-center bg-gradient-to-b from-emerald-50/60 to-white border-b border-emerald-100">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Project Transfer Completed</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                <strong>{transferSuccess.employee.full_name}</strong> transferred from{' '}
                <strong>{transferSuccess.fromProject}</strong> to <strong>{transferSuccess.toProject}</strong>.
              </p>
            </div>

            <div className="p-6 bg-slate-50/50 border-b border-slate-200 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Transfer Audit Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Previous Assignment (Closed)</span>
                  <div className="font-semibold text-slate-800 mt-0.5">{transferSuccess.fromProject}</div>
                  {transferSuccess.fromExternalId && (
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      ID: {transferSuccess.fromExternalId} (Preserved in History)
                    </div>
                  )}
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">New Assignment (Active)</span>
                  <div className="font-semibold text-blue-700 mt-0.5">
                    {transferSuccess.toProject} ({transferSuccess.toCode})
                  </div>
                  <div className="text-xs text-slate-700 mt-0.5">
                    {transferSuccess.toExternalIdLabel}:{' '}
                    <span className="font-mono font-semibold">
                      {transferSuccess.toExternalId || 'Not Configured'}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Effective Date</span>
                  <div className="font-semibold text-slate-900 mt-0.5">{transferSuccess.transferDate}</div>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Transfer Reason</span>
                  <div className="font-semibold text-slate-900 mt-0.5">{transferSuccess.reason}</div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                id="btn_transfer_another_project"
                onClick={handleResetForAnother}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                + Transfer Another Rider
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn_go_to_directory_from_transfer"
                  onClick={() => onNavigate('projects_assignments')}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Assignments Directory
                </button>
                <button
                  id="btn_go_to_projects_from_transfer"
                  onClick={() => onNavigate('projects_list')}
                  className="flex-1 sm:flex-initial px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Project Management
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="transfer_project_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              id="btn_back_from_transfer"
              onClick={() => onNavigate('projects_list')}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Return to Project Management"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Workforce Transition
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">Dedicated Full Page</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transfer Project Assignment</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Transition an employee to a new client project while preserving historical IDs and audit records.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn_cancel_transfer_top"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              id="btn_submit_transfer_top"
              type="button"
              disabled={submitting || !selectedEmployee || !currentAssignment || !destinationProjectId}
              onClick={handleConfirmTransfer}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Confirm Transfer
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 mt-8">
        <form onSubmit={handleConfirmTransfer} className="space-y-6">
          {errorMessage && (
            <div
              id="banner_transfer_error"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold">Transfer Blocked</h4>
                <p className="text-xs mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Step 1: Employee Selection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Step 1 — Select Employee
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search workforce employee to transfer between projects.
                </p>
              </div>
              {selectedEmployee && (
                <button
                  type="button"
                  onClick={handleClearEmployee}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Change Employee
                </button>
              )}
            </div>

            {!selectedEmployee ? (
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="input_search_emp_transfer"
                  type="text"
                  value={employeeSearchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Type employee name, code, Emirates ID, or mobile..."
                  className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                {searchLoading && (
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                )}

                {showDropdown && (
                  <div className="absolute z-30 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {searchResults.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No employees found matching "{employeeSearchQuery}".
                      </div>
                    ) : (
                      searchResults.map((emp) => (
                        <div
                          key={emp.id}
                          id={`transfer_search_emp_${emp.id}`}
                          onClick={() => handleSelectEmployee(emp)}
                          className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{emp.full_name}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-mono font-medium text-slate-700">{emp.employee_code}</span>
                              <span>•</span>
                              <span>{emp.visa_contractor_type}</span>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <span className="font-semibold text-blue-700">
                              Active Projects: {emp.active_assignments?.length || 0}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                    {selectedEmployee.full_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-base">
                      {selectedEmployee.full_name}
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 ml-2 rounded bg-white text-slate-700 border border-slate-200">
                        {selectedEmployee.employee_code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedEmployee.visa_contractor_type} • {selectedEmployee.branch || 'Dubai Main'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Select Current Assignment to End */}
          {selectedEmployee && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-rose-600" />
                  Step 2 — Current Project to End
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select which active project assignment is being concluded in this transfer.
                </p>
              </div>

              {!selectedEmployee.active_assignments || selectedEmployee.active_assignments.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                  This employee currently has NO active project assignments to transfer from. Use{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('projects_assign', { employeeId: selectedEmployee.id })}
                    className="font-bold underline text-amber-900"
                  >
                    Assign Project
                  </button>{' '}
                  instead.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEmployee.active_assignments.map((assignment: ActiveAssignmentItem) => (
                    <label
                      key={assignment.id}
                      className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                        selectedCurrentAssignmentId === assignment.id
                          ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="current_assignment"
                          checked={selectedCurrentAssignmentId === assignment.id}
                          onChange={() => setSelectedCurrentAssignmentId(assignment.id)}
                          className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            {assignment.project_name}
                            <span className="font-mono text-xs text-slate-500 font-semibold">
                              ({assignment.project_code})
                            </span>
                            {assignment.is_primary && (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                                PRIMARY
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>Start: {assignment.assignment_start_date || assignment.start_date || 'N/A'}</span>
                            {assignment.external_rider_id && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-blue-700 font-medium">
                                  {assignment.external_id_label || assignment.external_id_type || 'External ID'}:{' '}
                                  {assignment.external_rider_id}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        Will be ENDED on Transfer Date
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Destination Project */}
          {currentAssignment && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building className="w-5 h-5 text-blue-600" />
                  Step 3 — New Destination Project
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select the active project the rider is transitioning into.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Destination Project <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select_dest_project"
                  required
                  value={destinationProjectId}
                  onChange={(e) => handleDestinationProjectSelect(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="">-- Choose destination project --</option>
                  {activeProjects
                    .filter((p) => p.id !== currentAssignment.project_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) — {p.external_id_label}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 4: New External Rider ID */}
          {destinationProject && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-600" />
                  Step 4 — New {destinationProject.external_id_label || 'External Rider ID'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Identity credential on the new {destinationProject.name} platform.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {destinationProject.external_id_label || 'External Rider ID'} Value
                  </label>
                  {validatingId && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      Checking conflict...
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="input_transfer_new_external_id"
                    type="text"
                    value={newExternalRiderId}
                    onChange={(e) => setNewExternalRiderId(e.target.value)}
                    placeholder={`Enter new ${destinationProject.external_id_label || 'External Rider ID'}...`}
                    className={`w-full px-4 py-2.5 text-sm font-mono bg-white border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                      idValidationResult
                        ? idValidationResult.valid
                          ? 'border-emerald-300 focus:ring-emerald-500'
                          : 'border-rose-300 focus:ring-rose-500'
                        : 'border-slate-300 focus:ring-blue-500'
                    }`}
                  />
                  {idValidationResult && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs">
                      {idValidationResult.status === 'Available' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Available
                        </span>
                      )}
                      {(idValidationResult.status === 'Already Assigned' || idValidationResult.status === 'Conflict') && (
                        <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-semibold border border-rose-200">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          {idValidationResult.status}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {idValidationResult && idValidationResult.message && (
                  <p
                    className={`text-xs mt-1.5 ${
                      idValidationResult.valid ? 'text-emerald-700' : 'text-rose-700 font-medium'
                    }`}
                  >
                    {idValidationResult.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 5 & 6: Transfer Date & Mandatory Reason */}
          {currentAssignment && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Step 5 & 6 — Effective Date & Mandatory Reason
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Audit tracking for when the transfer takes place and why.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Transfer Effective Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="input_transfer_effective_date"
                    type="date"
                    required
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-500 mt-1 block">
                    Old assignment will end on this date; new assignment begins on this date.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Mandatory Reason <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="select_transfer_reason"
                    required
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    {TRANSFER_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Set as Primary */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    id="checkbox_transfer_is_primary"
                    type="checkbox"
                    checked={isPrimaryNew}
                    onChange={(e) => setIsPrimaryNew(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-900">
                    Set new project assignment as Primary Project
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Transfer Notes (Optional)
                </label>
                <textarea
                  id="input_transfer_notes"
                  rows={2}
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="Additional supervisor or client remarks..."
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              id="btn_cancel_transfer_bottom"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn_confirm_transfer_submit"
              type="submit"
              disabled={submitting || !selectedEmployee || !currentAssignment || !destinationProjectId}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Confirm Transfer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
