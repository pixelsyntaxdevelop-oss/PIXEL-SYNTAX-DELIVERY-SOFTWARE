import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  ArrowRightLeft,
  Calendar,
  Tag,
  CheckCircle2,
  Clock,
  AlertCircle,
  FolderKanban,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  User,
  Power,
  X,
  Check,
  Building,
  ShieldCheck
} from 'lucide-react';
import {
  riderProjectService,
  DirectoryAssignmentItem,
  ProjectMasterItem
} from '../../services/riderProjectService';

interface ProjectAssignmentsDirectoryViewProps {
  onNavigate: (module: string, params?: any) => void;
  onOpenEmployee360?: (empId: string) => void;
}

export const ProjectAssignmentsDirectoryView: React.FC<ProjectAssignmentsDirectoryViewProps> = ({
  onNavigate,
  onOpenEmployee360,
}) => {
  const [assignments, setAssignments] = useState<DirectoryAssignmentItem[]>([]);
  const [projects, setProjects] = useState<ProjectMasterItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedVisaContractor, setSelectedVisaContractor] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'ACTIVE' | 'ENDED'>('ACTIVE');
  const [selectedPrimaryFilter, setSelectedPrimaryFilter] = useState<'ALL' | 'PRIMARY' | 'ADDITIONAL'>('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // End Assignment Modal State
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [selectedAssignmentForEnd, setSelectedAssignmentForEnd] = useState<DirectoryAssignmentItem | null>(null);
  const [endDateValue, setEndDateValue] = useState(() => new Date().toISOString().split('T')[0]);
  const [endReason, setEndReason] = useState('Project Rotation');
  const [endNotes, setEndNotes] = useState('');
  const [endingLoading, setEndingLoading] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Notification Banners
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Load projects list for dropdown filter
  useEffect(() => {
    const loadProjectsList = async () => {
      try {
        const list = await riderProjectService.getProjectsMaster();
        setProjects(list);
      } catch (err) {
        console.error('Failed to load project list:', err);
      }
    };
    loadProjectsList();
  }, []);

  // Fetch paginated assignments from backend
  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await riderProjectService.getAssignmentsDirectory({
        page,
        limit,
        search: search.trim() || undefined,
        projectId: selectedProjectId || undefined,
        visaContractor: selectedVisaContractor || undefined,
        status: selectedStatus,
        primaryAdditional: selectedPrimaryFilter,
      });

      setAssignments(res.assignments || []);
      setTotalCount(res.pagination?.totalCount ?? 0);
      setTotalPages(res.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to load assignments directory');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, selectedProjectId, selectedVisaContractor, selectedStatus, selectedPrimaryFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleOpenEndModal = (item: DirectoryAssignmentItem) => {
    setSelectedAssignmentForEnd(item);
    setEndDateValue(new Date().toISOString().split('T')[0]);
    setEndReason('Project Rotation');
    setEndNotes('');
    setEndError(null);
    setEndModalOpen(true);
  };

  const handleConfirmEndAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignmentForEnd) return;

    if (!endDateValue) {
      setEndError('End Date is mandatory.');
      return;
    }
    if (!endReason.trim()) {
      setEndError('Mandatory reason is required to end project assignment.');
      return;
    }

    setEndingLoading(true);
    setEndError(null);
    try {
      const res = await riderProjectService.endAssignment({
        assignment_id: selectedAssignmentForEnd.id,
        end_date: endDateValue,
        end_reason: endReason,
        notes: endNotes.trim() || undefined,
      });

      if (!res.success) {
        setEndError(res.error || 'Failed to end project assignment');
        return;
      }

      setSuccessBanner(
        `Assignment for ${selectedAssignmentForEnd.employee_name} on ${selectedAssignmentForEnd.project_name} successfully ended.`
      );
      setEndModalOpen(false);
      fetchAssignments();
    } catch (err: any) {
      setEndError(err.message || 'Error occurred while ending assignment.');
    } finally {
      setEndingLoading(false);
    }
  };

  return (
    <div id="project_assignments_directory_view" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Users className="w-3.5 h-3.5" />
                Workforce Deployment
              </span>
              <span className="text-xs text-slate-400 font-medium">Deterministic Payroll Binding</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Assignments Directory</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Live registry of all employee project assignments and external platform identities.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              id="btn_dir_to_projects_mgmt"
              onClick={() => onNavigate('projects_list')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <FolderKanban className="w-4 h-4 text-slate-500" />
              Project Management
            </button>
            <button
              id="btn_dir_transfer_project"
              onClick={() => onNavigate('projects_transfer')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              <ArrowRightLeft className="w-4 h-4 text-slate-500" />
              Transfer Project
            </button>
            <button
              id="btn_dir_assign_project"
              onClick={() => onNavigate('projects_assign')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              + Assign Project
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Alerts */}
        {successBanner && (
          <div
            id="banner_dir_success"
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button
              onClick={() => setSuccessBanner(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorBanner && (
          <div
            id="banner_dir_error"
            className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-sm flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button
              onClick={() => setErrorBanner(null)}
              className="text-rose-700 hover:text-rose-900 p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filters Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="input_search_assignments_dir"
                type="text"
                placeholder="Search by Employee Name, Code, or External ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Project Filter */}
              <select
                id="filter_dir_project"
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>

              {/* Visa / Contractor Filter */}
              <select
                id="filter_dir_visa"
                value={selectedVisaContractor}
                onChange={(e) => {
                  setSelectedVisaContractor(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Contract Types</option>
                <option value="Own Visa">Own Visa</option>
                <option value="Contractor / Vendor">Contractor / Vendor</option>
                <option value="Freelancer">Freelancer</option>
                <option value="Direct Hire">Direct Hire</option>
              </select>

              {/* Status Segment */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  id="filter_dir_status_active"
                  onClick={() => {
                    setSelectedStatus('ACTIVE');
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedStatus === 'ACTIVE'
                      ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active
                </button>
                <button
                  id="filter_dir_status_ended"
                  onClick={() => {
                    setSelectedStatus('ENDED');
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedStatus === 'ENDED'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ended
                </button>
                <button
                  id="filter_dir_status_all"
                  onClick={() => {
                    setSelectedStatus('ALL');
                    setPage(1);
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedStatus === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Status
                </button>
              </div>

              {/* Primary / Additional Segment */}
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  id="filter_dir_primary_all"
                  onClick={() => {
                    setSelectedPrimaryFilter('ALL');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedPrimaryFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  id="filter_dir_primary_only"
                  onClick={() => {
                    setSelectedPrimaryFilter('PRIMARY');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedPrimaryFilter === 'PRIMARY'
                      ? 'bg-white text-blue-700 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Primary Only
                </button>
                <button
                  id="filter_dir_additional_only"
                  onClick={() => {
                    setSelectedPrimaryFilter('ADDITIONAL');
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    selectedPrimaryFilter === 'ADDITIONAL'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Additional
                </button>
              </div>

              <button
                id="btn_refresh_assignments_dir"
                onClick={fetchAssignments}
                title="Refresh assignments"
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-4 py-3.5">Visa / Type</th>
                  <th className="px-5 py-3.5">Project</th>
                  <th className="px-4 py-3.5">External Rider ID</th>
                  <th className="px-4 py-3.5">ID Label</th>
                  <th className="px-4 py-3.5">Dates</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5">Hierarchy</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm">Loading project assignments...</span>
                      </div>
                    </td>
                  </tr>
                ) : assignments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-16 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                          <Users className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">No assignments found</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {search || selectedProjectId || selectedVisaContractor || selectedStatus !== 'ACTIVE'
                            ? 'No assignments match the selected filters or search keyword.'
                            : 'No workforce employees have been assigned to projects yet.'}
                        </p>
                        <button
                          id="btn_dir_empty_assign"
                          onClick={() => onNavigate('projects_assign')}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Assign First Rider
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  assignments.map((item) => (
                    <tr
                      key={item.id}
                      id={`assignment_row_${item.id}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Employee Info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {item.employee_name?.charAt(0) || 'E'}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-tight">
                              {item.employee_name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {item.employee_code}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Visa / Contractor Type */}
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{item.visa_contractor_type || 'Own Visa'}</div>
                        {item.vendor_name && (
                          <div className="text-[11px] text-slate-500 truncate max-w-[120px]">{item.vendor_name}</div>
                        )}
                      </td>

                      {/* Project Name & Code */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900">{item.project_name}</div>
                        <div className="font-mono text-xs text-slate-500">{item.project_code}</div>
                      </td>

                      {/* External Rider ID */}
                      <td className="px-4 py-3.5">
                        {item.external_rider_id ? (
                          <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            {item.external_rider_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Not set</span>
                        )}
                      </td>

                      {/* External ID Label */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Tag className="w-3 h-3 text-amber-600 shrink-0" />
                          {item.external_id_label || 'External Rider ID'}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-3.5 text-xs text-slate-600">
                        <div>
                          <span className="text-slate-400">Start:</span>{' '}
                          <span className="font-medium text-slate-700">{item.start_date || '—'}</span>
                        </div>
                        {item.end_date ? (
                          <div className="text-[11px] text-rose-600">
                            <span className="text-slate-400">End:</span> {item.end_date}
                          </div>
                        ) : (
                          <div className="text-[11px] text-emerald-600 font-medium">Ongoing</div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3.5">
                        {item.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            ENDED
                          </span>
                        )}
                      </td>

                      {/* Hierarchy: Primary / Additional */}
                      <td className="px-3 py-3.5">
                        {item.is_primary ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            PRIMARY
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            ADDITIONAL
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {onOpenEmployee360 && (
                            <button
                              id={`btn_view_emp360_${item.id}`}
                              onClick={() => onOpenEmployee360(item.employee_id)}
                              title="Open Employee 360"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            >
                              <User className="w-4 h-4" />
                            </button>
                          )}

                          {item.status === 'ACTIVE' && (
                            <>
                              <button
                                id={`btn_transfer_assign_${item.id}`}
                                onClick={() =>
                                  onNavigate('projects_transfer', {
                                    employeeId: item.employee_id,
                                    currentAssignmentId: item.id,
                                  })
                                }
                                title="Transfer to Another Project"
                                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              >
                                <ArrowRightLeft className="w-4 h-4" />
                              </button>

                              <button
                                id={`btn_end_assign_${item.id}`}
                                onClick={() => handleOpenEndModal(item)}
                                title="End Project Assignment"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              >
                                <Power className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-semibold text-slate-900">{assignments.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{totalCount}</span> project assignments
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn_dir_prev_page"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="px-2 font-medium">
                Page {page} of {totalPages}
              </span>

              <button
                id="btn_dir_next_page"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* End Assignment Modal */}
      {endModalOpen && selectedAssignmentForEnd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Power className="w-4 h-4 text-rose-600" />
                <h3 className="font-bold text-slate-900 text-base">End Project Assignment</h3>
              </div>
              <button
                onClick={() => setEndModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEndAssignment} className="p-6 space-y-4">
              {endError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{endError}</span>
                </div>
              )}

              {/* Assignment Overview */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Employee:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedAssignmentForEnd.employee_name} ({selectedAssignmentForEnd.employee_code})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Project:</span>
                  <span className="font-semibold text-slate-900">{selectedAssignmentForEnd.project_name}</span>
                </div>
                {selectedAssignmentForEnd.external_rider_id && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {selectedAssignmentForEnd.external_id_label || 'External ID'}:
                    </span>
                    <span className="font-mono font-semibold text-blue-700">
                      {selectedAssignmentForEnd.external_rider_id}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">Type:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedAssignmentForEnd.is_primary ? 'Primary Project' : 'Additional Project'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  End Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_end_assignment_date"
                  type="date"
                  required
                  value={endDateValue}
                  onChange={(e) => setEndDateValue(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mandatory Reason <span className="text-rose-500">*</span>
                </label>
                <select
                  id="select_end_assignment_reason"
                  required
                  value={endReason}
                  onChange={(e) => setEndReason(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  <option value="Project Rotation">Project Rotation</option>
                  <option value="Client Demand Reduction">Client Demand Reduction</option>
                  <option value="Contract Termination">Contract Termination</option>
                  <option value="Transferred to Other Client">Transferred to Other Client</option>
                  <option value="Visa Transfer / Resignation">Visa Transfer / Resignation</option>
                  <option value="Disciplinary / Client Request">Disciplinary / Client Request</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  id="input_end_assignment_notes"
                  rows={2}
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Additional audit details..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEndModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn_confirm_end_assignment_submit"
                  type="submit"
                  disabled={endingLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  {endingLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                  End Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
