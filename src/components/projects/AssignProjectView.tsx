import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Bike,
  Smartphone,
  Building,
  Tag,
  Calendar,
  MapPin,
  FileText,
  Plus,
  RefreshCw,
  X,
  Check,
  ShieldCheck,
  ArrowRight,
  FolderKanban,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  riderProjectService,
  ProjectMasterItem
} from '../../services/riderProjectService';

interface AssignProjectViewProps {
  initialProjectId?: string;
  initialEmployeeId?: string;
  onNavigate: (module: string, params?: any) => void;
  onOpenEmployee360?: (empId: string) => void;
}

const EMIRATES_LIST = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
];

export const AssignProjectView: React.FC<AssignProjectViewProps> = ({
  initialProjectId,
  initialEmployeeId,
  onNavigate,
  onOpenEmployee360,
}) => {
  // Master Data
  const [activeProjects, setActiveProjects] = useState<ProjectMasterItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Section A: Employee Search & Selection
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Section B: Target Project
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || '');
  const [selectedProject, setSelectedProject] = useState<ProjectMasterItem | null>(null);

  // Section C: External Rider ID & Live Conflict Validation
  const [externalRiderId, setExternalRiderId] = useState('');
  const [validatingId, setValidatingId] = useState(false);
  const [idValidationResult, setIdValidationResult] = useState<{
    valid: boolean;
    status: 'Available' | 'Already Assigned' | 'Historical ID' | 'Conflict';
    message?: string;
    conflictingAssignment?: any;
  } | null>(null);

  // Section D: Dates
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');

  // Section E: Primary / Additional
  const [isPrimary, setIsPrimary] = useState(true);

  // Section F: Location & Notes
  const [reportingEmirate, setReportingEmirate] = useState('Dubai');
  const [locationZone, setLocationZone] = useState('');
  const [notes, setNotes] = useState('');

  // Submission & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [assignmentSuccess, setAssignmentSuccess] = useState<any | null>(null);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const extIdDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch live active projects
  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const list = await riderProjectService.getProjectsMaster({ status: 'Active' });
        setActiveProjects(list);

        if (initialProjectId) {
          const match = list.find((p) => p.id === initialProjectId);
          if (match) {
            setSelectedProjectId(match.id);
            setSelectedProject(match);
          }
        }
      } catch (err: any) {
        console.error('Failed to load active projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, [initialProjectId]);

  // If initialEmployeeId provided, fetch employee
  useEffect(() => {
    if (initialEmployeeId) {
      const loadInitialEmp = async () => {
        try {
          const res = await riderProjectService.searchEmployees(initialEmployeeId);
          if (res && res.length > 0) {
            handleSelectEmployee(res[0]);
          }
        } catch (err) {
          console.error('Error fetching initial employee:', err);
        }
      };
      loadInitialEmp();
    }
  }, [initialEmployeeId]);

  // 2. Debounced employee search
  const handleSearchChange = (q: string) => {
    setEmployeeSearchQuery(q);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = q.trim();
    if (!trimmed || trimmed.length < 3) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearchLoading(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await riderProjectService.searchEmployees(trimmed);
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

    // Primary project default rule:
    // If no active assignments exist -> Primary = YES
    // If active assignments exist -> Primary = false (Additional)
    const activeCount = emp.active_assignments_count || (emp.active_assignments ? emp.active_assignments.length : 0);
    setIsPrimary(activeCount === 0);
  };

  const handleClearEmployee = () => {
    setSelectedEmployee(null);
    setEmployeeSearchQuery('');
    setSearchResults([]);
  };

  // 3. Handle project selection
  const handleProjectSelect = (projId: string) => {
    setSelectedProjectId(projId);
    const found = activeProjects.find((p) => p.id === projId) || null;
    setSelectedProject(found);
    setExternalRiderId('');
    setIdValidationResult(null);
  };

  // 4. Debounced live external ID conflict check
  useEffect(() => {
    if (extIdDebounceRef.current) clearTimeout(extIdDebounceRef.current);

    if (!selectedProjectId || !externalRiderId.trim()) {
      setIdValidationResult(null);
      return;
    }

    extIdDebounceRef.current = setTimeout(async () => {
      setValidatingId(true);
      try {
        const result = await riderProjectService.validateExternalId({
          projectId: selectedProjectId,
          externalRiderId: externalRiderId.trim(),
          employeeId: selectedEmployee?.id,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setIdValidationResult(result);
      } catch (err) {
        console.error('Validation error:', err);
      } finally {
        setValidatingId(false);
      }
    }, 300);
  }, [selectedProjectId, externalRiderId, selectedEmployee?.id, startDate, endDate]);

  // 5. Form submission
  const handleConfirmAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedEmployee) {
      setErrorMessage('Please search and select an employee first.');
      return;
    }

    const empStatus = (selectedEmployee.current_status || selectedEmployee.status || '').toLowerCase();
    const isIneligible = ['on leave', 'on hold', 'absconding', 'terminated', 'exited', 'cancelled', 'inactive'].some((k: string) => empStatus.includes(k));
    if (isIneligible) {
      setErrorMessage(`Employee ${selectedEmployee.full_name} is currently in "${selectedEmployee.current_status || 'inactive'}" status and is not eligible for project assignment. Please update status first.`);
      return;
    }

    if (!selectedProjectId) {
      setErrorMessage('Please select a target delivery project.');
      return;
    }

    if (idValidationResult && !idValidationResult.valid) {
      setErrorMessage(
        idValidationResult.message ||
          'The external rider ID has a conflicting active assignment. Please resolve before assigning.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: selectedEmployee.id,
        project_id: selectedProjectId,
        assignment_start_date: startDate,
        external_rider_id: externalRiderId.trim() || undefined,
        location_state: reportingEmirate,
        is_primary: isPrimary,
        notes: notes.trim()
          ? `${notes.trim()}${locationZone ? ` | Zone: ${locationZone.trim()}` : ''}`
          : locationZone
          ? `Zone: ${locationZone.trim()}`
          : undefined,
      };

      const res = await riderProjectService.assignProject(payload);

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to complete project assignment.');
        return;
      }

      setAssignmentSuccess({
        assignment: res.assignment,
        employee: selectedEmployee,
        project: selectedProject,
        externalRiderId: externalRiderId.trim(),
        externalIdLabel: selectedProject?.external_id_label || 'External Rider ID',
        isPrimary,
        startDate,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during project assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setAssignmentSuccess(null);
    setSelectedEmployee(null);
    setSelectedProjectId('');
    setSelectedProject(null);
    setExternalRiderId('');
    setIdValidationResult(null);
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setIsPrimary(true);
    setLocationZone('');
    setNotes('');
    setErrorMessage(null);
  };

  // SUCCESS SCREEN
  if (assignmentSuccess) {
    return (
      <div id="assign_project_success_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-200 px-6 py-6 shadow-xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              id="btn_back_to_mgmt_from_success"
              onClick={() => onNavigate('projects_list')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project Management
            </button>
            <span className="text-xs text-slate-500 font-medium">Assignment Confirmed</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 mt-8">
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="p-8 text-center bg-gradient-to-b from-emerald-50/60 to-white border-b border-emerald-100">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Project Assigned Successfully</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                <strong>{assignmentSuccess.employee.full_name}</strong> is now assigned to{' '}
                <strong>{assignmentSuccess.project?.name}</strong>.
              </p>
            </div>

            {/* Assignment Details */}
            <div className="p-6 bg-slate-50/50 border-b border-slate-200 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Confirmed Assignment Summary
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Assigned Employee</span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {assignmentSuccess.employee.full_name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {assignmentSuccess.employee.employee_code}
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Delivery Project</span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {assignmentSuccess.project?.name}
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {assignmentSuccess.project?.code}
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">
                    {assignmentSuccess.externalIdLabel}
                  </span>
                  <div className="font-mono font-semibold text-blue-700 mt-0.5">
                    {assignmentSuccess.externalRiderId || 'Not Configured'}
                  </div>
                </div>

                <div className="p-3.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Assignment Type & Date</span>
                  <div className="font-semibold text-slate-900 mt-0.5 flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        assignmentSuccess.isPrimary
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {assignmentSuccess.isPrimary ? 'Primary Project' : 'Additional Project'}
                    </span>
                    <span className="text-xs text-slate-500">From {assignmentSuccess.startDate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="p-6 bg-white space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2.5">
                  Recommended Next Onboarding Steps:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    id="btn_success_view_employee"
                    onClick={() => {
                      if (onOpenEmployee360) onOpenEmployee360(assignmentSuccess.employee.id);
                    }}
                    className="inline-flex items-center justify-center gap-2 p-3 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <User className="w-4 h-4 text-blue-600" />
                    View Employee 360
                  </button>

                  <button
                    id="btn_success_assign_bike"
                    onClick={() => onNavigate('fleet_operations', { employeeId: assignmentSuccess.employee.id })}
                    className="inline-flex items-center justify-center gap-2 p-3 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <Bike className="w-4 h-4 text-emerald-600" />
                    Assign Bike
                  </button>

                  <button
                    id="btn_success_assign_sim"
                    onClick={() => onNavigate('sim_cards', { employeeId: assignmentSuccess.employee.id })}
                    className="inline-flex items-center justify-center gap-2 p-3 text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    Assign SIM Card
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <button
                  id="btn_assign_another_project"
                  onClick={handleResetForAnother}
                  className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  + Assign Another Project / Rider
                </button>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    id="btn_go_to_directory"
                    onClick={() => onNavigate('projects_assignments')}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Assignments Directory
                  </button>
                  <button
                    id="btn_go_to_projects_master"
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
      </div>
    );
  }

  return (
    <div id="assign_project_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-20 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              id="btn_back_to_projects"
              onClick={() => onNavigate('projects_list')}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Back to Project Management"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Workforce Assignment
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">Dedicated Full Page</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Assign Project</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Assign a workforce employee to a delivery project with identity and payroll safety.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn_cancel_assign_top"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              id="btn_submit_assign_top"
              type="button"
              disabled={submitting || !selectedEmployee || !selectedProjectId}
              onClick={handleConfirmAssignment}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Assignment
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Form */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        <form onSubmit={handleConfirmAssignment} className="space-y-6">
          {errorMessage && (
            <div
              id="banner_assign_error"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold">Assignment Blocked</h4>
                <p className="text-xs mt-0.5 text-rose-700">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Section A: Employee Selection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Section A — Employee
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search workforce employee by Name, Employee Code, Emirates ID, or Mobile number.
                </p>
              </div>
              {selectedEmployee && (
                <button
                  type="button"
                  onClick={handleClearEmployee}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  Change Employee
                </button>
              )}
            </div>

            {!selectedEmployee ? (
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="input_search_employee_for_assign"
                    type="text"
                    value={employeeSearchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Type at least 3 characters to search by name, code (e.g. DEMO-101), Emirates ID..."
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                  {searchLoading && (
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  )}
                </div>

                {employeeSearchQuery.trim().length > 0 && employeeSearchQuery.trim().length < 3 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Type at least 3 characters to search ({employeeSearchQuery.trim().length}/3 entered)...</span>
                  </p>
                )}

                {/* Dropdown Results */}
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
                          id={`search_emp_result_${emp.id}`}
                          onClick={() => handleSelectEmployee(emp)}
                          className="p-3 hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-between"
                        >
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{emp.full_name}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-mono font-medium text-slate-700">{emp.employee_code}</span>
                              <span>•</span>
                              <span>{emp.visa_contractor_type}</span>
                              <span>•</span>
                              <span>{emp.branch || 'Dubai Main'}</span>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                emp.current_status === 'Assigned / Active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}
                            >
                              {emp.current_status}
                            </span>
                            <div className="text-[11px] text-slate-600 mt-0.5 font-medium">
                              Primary: {emp.current_primary_project || 'None'}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Compact Selected Employee Summary Card */
              <div
                id="selected_employee_summary_card"
                className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm ring-2 ring-white">
                      {selectedEmployee.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                        {selectedEmployee.full_name}
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                          {selectedEmployee.employee_code}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>{selectedEmployee.visa_contractor_type}</span>
                        <span>•</span>
                        <span>{selectedEmployee.branch || 'Dubai Main'}</span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold ${
                      selectedEmployee.current_status === 'Assigned / Active'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-200/60 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {selectedEmployee.current_status}
                  </span>
                </div>

                {/* Status Ineligibility Alert */}
                {['on leave', 'on hold', 'absconding', 'terminated', 'exited', 'cancelled', 'inactive'].some((k: string) => (selectedEmployee.current_status || '').toLowerCase().includes(k)) && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <div className="font-bold">Not Eligible for Project Assignment</div>
                      <div>This employee is currently in <strong>{selectedEmployee.current_status}</strong> status. Only employees in Available or Assigned status may be assigned to projects.</div>
                    </div>
                  </div>
                )}

                {/* 6 Grid Specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 block text-[11px] font-medium">Primary Project</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block truncate">
                      {selectedEmployee.current_primary_project || 'None (Unassigned)'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 block text-[11px] font-medium">Current Bike</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1">
                      <Bike className="w-3.5 h-3.5 text-slate-600" />
                      {selectedEmployee.current_bike_plate || 'Not Assigned'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 block text-[11px] font-medium">Current SIM</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block flex items-center gap-1">
                      <Smartphone className="w-3.5 h-3.5 text-slate-600" />
                      {selectedEmployee.current_sim_number || 'Not Assigned'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                    <span className="text-slate-600 block text-[11px] font-medium">Emirates ID</span>
                    <span className="font-semibold text-slate-900 mt-0.5 block font-mono">
                      {selectedEmployee.emirates_id || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Existing active assignments if any */}
                {selectedEmployee.active_assignments && selectedEmployee.active_assignments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200/70 text-xs">
                    <span className="font-medium text-slate-600 block mb-1">
                      Current Active Project Assignments ({selectedEmployee.active_assignments.length}):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmployee.active_assignments.map((a: any) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800"
                        >
                          <FolderKanban className="w-3 h-3 text-blue-600" />
                          <strong>{a.project_name}</strong>
                          {a.external_rider_id && (
                            <span className="font-mono text-slate-500 text-[11px]">
                              ({a.external_rider_id})
                            </span>
                          )}
                          {a.is_primary && (
                            <span className="ml-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1 rounded">
                              PRIMARY
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section B: Target Project Selection */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                Section B — Target Project
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select from the live active Project Master. No hardcoded or mock project options.
              </p>
            </div>

            {loadingProjects ? (
              <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                Loading live active projects...
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-xl text-center space-y-3">
                <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-900">No active projects configured</h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  There are currently no active delivery projects configured for this tenant. Create a project first to assign riders.
                </p>
                <button
                  id="btn_manage_projects_from_empty_assign"
                  type="button"
                  onClick={() => onNavigate('projects_create')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manage Projects
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Delivery / Client Project <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select_target_project"
                  required
                  value={selectedProjectId}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-slate-900"
                >
                  <option value="">-- Choose an active project --</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) — {p.external_id_label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-slate-500 mt-1.5 block">
                  Only Active projects appear in this selector. Inactive/Archived projects are locked from new assignments.
                </span>
              </div>
            )}
          </div>

          {/* Section C: External Rider ID with Dynamic Label (Only if configured by Project Master) */}
          {selectedProject &&
            selectedProject.requires_external_id !== false &&
            selectedProject.external_id_label &&
            selectedProject.external_id_label.toLowerCase() !== 'none' &&
            selectedProject.external_id_label.toLowerCase() !== 'n/a' &&
            selectedProject.external_id_label.trim() !== '' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-amber-600" />
                  Section C — {selectedProject.external_id_label || 'External Rider ID'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Operator-configured identity label for {selectedProject.name}. Validated in real-time against database records.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    {selectedProject.external_id_label || 'External Rider ID'} Value
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
                    id="input_external_rider_id"
                    type="text"
                    value={externalRiderId}
                    onChange={(e) => setExternalRiderId(e.target.value)}
                    placeholder={`Enter ${selectedProject.external_id_label || 'External Rider ID'}...`}
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
                      {idValidationResult.status === 'Historical ID' && (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-semibold border border-amber-200">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          Historical ID
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
                <span className="text-xs text-slate-600 mt-1 block font-medium">
                  This identity is deterministically bound to the employee for accurate monthly client salary file resolution.
                </span>
              </div>
            </div>
          )}

          {/* Section D: Dates & Primary Project Toggle */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Section D — Dates & Hierarchy
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set assignment effective start date and Primary / Additional project classification.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assignment Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_assignment_start_date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Optional End Date (Historical Records Only)
                </label>
                <input
                  id="input_assignment_end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Leave blank for normal ongoing active project assignments.
                </span>
              </div>
            </div>

            {/* Primary vs Additional Project Selection */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/60">
                <input
                  id="checkbox_is_primary"
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="w-4 h-4 mt-1 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <div>
                  <label
                    htmlFor="checkbox_is_primary"
                    className="text-sm font-bold text-slate-900 cursor-pointer flex items-center gap-2"
                  >
                    Set as Primary Project
                    {isPrimary ? (
                      <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                        YES — PRIMARY
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                        NO — ADDITIONAL
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    An employee can be active on multiple delivery projects simultaneously. The Primary project serves as
                    the main operational account for supervisor tracking and core payroll. Designating this project as Primary
                    will <strong>NOT</strong> cancel or end the rider's other active projects.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section E: Location & Zone (Secondary & Optional) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-slate-600" />
                Section E — Optional Location & Notes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Reporting Emirate, operational hub/zone, and internal notes.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reporting Emirate / State
                </label>
                <select
                  id="select_reporting_emirate"
                  value={reportingEmirate}
                  onChange={(e) => setReportingEmirate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {EMIRATES_LIST.map((em) => (
                    <option key={em} value={em}>
                      {em}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Delivery Zone / Hub (Optional)
                </label>
                <input
                  id="input_location_zone"
                  type="text"
                  value={locationZone}
                  onChange={(e) => setLocationZone(e.target.value)}
                  placeholder="e.g. Al Barsha Hub, Business Bay, Downtown"
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assignment Notes (Optional)
                </label>
                <textarea
                  id="input_assignment_notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Assigned per client demand request, onboarding batch #4..."
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section F: Final Confirmation Summary Box */}
          {selectedEmployee && selectedProject && (
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Pre-Submission Verification
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">Employee:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedEmployee.full_name} ({selectedEmployee.employee_code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Target Project:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedProject.name} ({selectedProject.code})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">
                    {selectedProject.external_id_label || 'External Rider ID'}:
                  </span>
                  <span className="font-mono font-semibold text-blue-800">
                    {externalRiderId.trim() || '(None entered)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              id="btn_cancel_assign_bottom"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn_confirm_assignment_submit"
              type="submit"
              disabled={submitting || !selectedEmployee || !selectedProjectId}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirm Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
