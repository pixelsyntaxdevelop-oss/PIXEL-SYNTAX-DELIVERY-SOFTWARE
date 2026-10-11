import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Eye,
  Edit2,
  Power,
  RotateCcw,
  ArrowRight,
  ShieldCheck,
  Tag,
  Hash,
  FileText,
  Calendar,
  Building,
  RefreshCw,
  X,
  ChevronRight,
  Check,
  Filter
} from 'lucide-react';
import { riderProjectService, ProjectMasterItem } from '../../services/riderProjectService';

interface ProjectMasterViewProps {
  onNavigate: (module: string, params?: any) => void;
  onOpenEmployee360?: (empId: string) => void;
}

export const ProjectMasterView: React.FC<ProjectMasterViewProps> = ({
  onNavigate,
  onOpenEmployee360
}) => {
  const [projects, setProjects] = useState<ProjectMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive / Archived'>('ALL');
  const [selectedProject, setSelectedProject] = useState<ProjectMasterItem | null>(null);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editExternalIdLabel, setEditExternalIdLabel] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive / Archived'>('Active');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const isProjectActive = (status?: string): boolean => {
    if (!status) return true;
    const s = String(status).trim().toUpperCase();
    return s === 'ACTIVE';
  };

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await riderProjectService.getProjectsMaster({
        status: statusFilter,
        search: search.trim() || undefined
      });
      setProjects(data);
    } catch (err: any) {
      setErrorBanner(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleOpenView = (p: ProjectMasterItem) => {
    setSelectedProject(p);
    setViewDrawerOpen(true);
  };

  const handleOpenEdit = (p: ProjectMasterItem) => {
    setSelectedProject(p);
    setEditName(p.name);
    setEditCode(p.code);
    setEditExternalIdLabel(p.external_id_label || '');
    setEditStatus(isProjectActive(p.status) ? 'Active' : 'Inactive / Archived');
    setEditNotes(p.notes || '');
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    if (!editName.trim()) {
      setEditError('Project Name is required.');
      return;
    }
    if (!editCode.trim()) {
      setEditError('Project Code is required.');
      return;
    }

    setActionLoading(true);
    setEditError(null);
    try {
      const res = await riderProjectService.updateProject(selectedProject.id, {
        name: editName.trim(),
        code: editCode.trim().toUpperCase(),
        external_id_label: editExternalIdLabel.trim() || 'External Rider ID',
        status: editStatus,
        notes: editNotes.trim()
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update project');
        return;
      }

      setSuccessBanner(`Project "${editName}" updated successfully.`);
      setEditModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      setEditError(err.message || 'Error updating project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenDisable = (p: ProjectMasterItem) => {
    setSelectedProject(p);
    setDisableModalOpen(true);
  };

  const handleConfirmToggleStatus = async () => {
    if (!selectedProject) return;
    setActionLoading(true);
    try {
      const isCurrentActive = isProjectActive(selectedProject.status);
      const newStatus = isCurrentActive ? 'Inactive / Archived' : 'Active';
      const res = await riderProjectService.toggleProjectStatus(selectedProject.id, newStatus);
      if (!res.success) {
        setErrorBanner(res.error || 'Failed to update project status');
        return;
      }
      setSuccessBanner(
        `Project "${selectedProject.name}" status changed to ${newStatus}. Historical data is preserved.`
      );
      setDisableModalOpen(false);
      fetchProjects();
    } catch (err: any) {
      setErrorBanner(err.message || 'Error updating status');
    } finally {
      setActionLoading(false);
    }
  };

  // Metrics
  const totalCount = projects.length;
  const activeCount = projects.filter(p => isProjectActive(p.status)).length;
  const inactiveCount = projects.filter(p => !isProjectActive(p.status)).length;
  const totalRidersAssigned = projects.reduce((sum, p) => sum + (p.active_count || 0), 0);

  return (
    <div id="project_master_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <FolderKanban className="w-3.5 h-3.5" />
                Delivery & Fleet Master
              </span>
              <span className="text-xs text-slate-600 font-medium">Single Workforce Master</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Management</h1>
            <p className="text-sm text-slate-700 mt-0.5">
              Manage delivery/client projects and rider identity configuration.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              id="btn_nav_assignments_directory"
              onClick={() => onNavigate('projects_assignments')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            >
              <Users className="w-4 h-4 text-slate-600" />
              Assignments Directory
            </button>
            <button
              id="btn_nav_assign_project"
              onClick={() => onNavigate('projects_assign')}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
            >
              <ArrowRight className="w-4 h-4 text-slate-600" />
              Assign Project
            </button>
            <button
              id="btn_create_project_primary"
              onClick={() => onNavigate('projects_create')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              + Create Project
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 space-y-6">
        {/* Alert Banners */}
        {successBanner && (
          <div
            id="banner_project_success"
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
            id="banner_project_error"
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Total Projects</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalCount}</div>
            <div className="text-xs text-slate-600 mt-1">Configured client delivery platforms</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Active Projects</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{activeCount}</div>
            <div className="text-xs text-slate-600 mt-1">Eligible for assignments & payroll</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Inactive / Archived</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{inactiveCount}</div>
            <div className="text-xs text-slate-600 mt-1">Preserved historically, assignment locked</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Active Riders</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{totalRidersAssigned}</div>
            <div className="text-xs text-slate-600 mt-1">Workforce deployed across all projects</div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input_search_projects"
              type="text"
              placeholder="Search projects by name, code, or identity label..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              <button
                id="filter_status_all"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status
              </button>
              <button
                id="filter_status_active"
                onClick={() => setStatusFilter('Active')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'Active'
                    ? 'bg-white text-emerald-700 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                id="filter_status_inactive"
                onClick={() => setStatusFilter('Inactive / Archived')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'Inactive / Archived'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Inactive / Archived
              </button>
            </div>

            <button
              id="btn_refresh_projects"
              onClick={fetchProjects}
              title="Refresh project list"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Main Projects Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Project Name</th>
                  <th className="px-6 py-3.5">Project Code</th>
                  <th className="px-6 py-3.5">External ID Label</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Active Riders</th>
                  <th className="px-6 py-3.5">Created At</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-sm">Loading projects master...</span>
                      </div>
                    </td>
                  </tr>
                ) : projects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="max-w-sm mx-auto flex flex-col items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
                          <FolderKanban className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-semibold text-slate-900">No projects found</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          {search || statusFilter !== 'ALL'
                            ? 'No projects match your search criteria or status filter.'
                            : 'No delivery projects configured in this tenant yet.'}
                        </p>
                        <button
                          id="btn_empty_create_project"
                          onClick={() => onNavigate('projects_create')}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          Create First Project
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  projects.map((project) => (
                    <tr
                      key={project.id}
                      id={`project_row_${project.id}`}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{project.name}</div>
                        {project.notes && (
                          <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                            {project.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200">
                          {project.code}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Tag className="w-3 h-3 text-amber-600" />
                          {project.external_id_label || 'External Rider ID'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {isProjectActive(project.status) ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            Inactive / Archived
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>{project.active_count || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {project.created_at ? new Date(project.created_at).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`btn_view_project_${project.id}`}
                            onClick={() => handleOpenView(project)}
                            title="View Project Details"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn_edit_project_${project.id}`}
                            onClick={() => handleOpenEdit(project)}
                            title="Edit Project"
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`btn_toggle_status_${project.id}`}
                            onClick={() => handleOpenDisable(project)}
                            title={isProjectActive(project.status) ? 'Disable Project' : 'Activate Project'}
                            className={`p-1.5 rounded-md transition-colors ${
                              isProjectActive(project.status)
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* View Project Details Drawer */}
      {viewDrawerOpen && selectedProject && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setViewDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-xl flex flex-col">
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{selectedProject.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{selectedProject.code}</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium">Status</span>
                    <div className="mt-1">
                      {isProjectActive(selectedProject.status) ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                          Inactive / Archived
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500 font-medium">Active Riders</span>
                    <div className="mt-1 text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-slate-400" />
                      {selectedProject.active_count || 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 text-sm">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      External Rider ID Configuration
                    </label>
                    <div className="mt-1.5 p-3.5 bg-amber-50/50 rounded-lg border border-amber-200 flex items-start gap-3">
                      <Tag className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-900">
                          {selectedProject.external_id_label || 'External Rider ID'}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          When assigning riders to this project, the identity field is labeled as "
                          {selectedProject.external_id_label || 'External Rider ID'}".
                        </p>
                      </div>
                    </div>
                  </div>

                  {selectedProject.notes && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Operational Notes
                      </label>
                      <div className="mt-1 p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 text-xs leading-relaxed">
                        {selectedProject.notes}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 space-y-2 text-xs text-slate-500">
                    <div className="flex justify-between py-1">
                      <span>Created At</span>
                      <span className="font-medium text-slate-700">
                        {selectedProject.created_at
                          ? new Date(selectedProject.created_at).toLocaleString('en-GB')
                          : '—'}
                      </span>
                    </div>
                    {selectedProject.updated_at && (
                      <div className="flex justify-between py-1">
                        <span>Last Updated</span>
                        <span className="font-medium text-slate-700">
                          {new Date(selectedProject.updated_at).toLocaleString('en-GB')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setViewDrawerOpen(false);
                    handleOpenEdit(selectedProject);
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Edit Project
                </button>
                <button
                  onClick={() => {
                    setViewDrawerOpen(false);
                    onNavigate('projects_assign', { projectId: selectedProject.id });
                  }}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  Assign Rider
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-base">Edit Project</h3>
              </div>
              <button
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_edit_project_name"
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Keeta Delivery, Noon Minutes"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Project Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_edit_project_code"
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. KEETA, NOON, LABOUR"
                  className="w-full px-3.5 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Unique identifier used in system mappings and payroll files.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  External Rider ID Label <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_edit_external_id_label"
                  type="text"
                  required
                  value={editExternalIdLabel}
                  onChange={(e) => setEditExternalIdLabel(e.target.value)}
                  placeholder="e.g. Courier ID, NIM ID, Person Code, Rider ID"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-slate-500 mt-1 block">
                  Configured label for rider identifiers on this delivery platform.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  id="select_edit_status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'Active' | 'Inactive / Archived')}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive / Archived">Inactive / Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  id="input_edit_notes"
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Additional client details or operational notes..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  id="btn_submit_edit_project"
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Disable / Toggle Status Confirmation Dialog (NO HARD DELETE) */}
      {disableModalOpen && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  selectedProject.status === 'Active' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedProject.status === 'Active' ? 'Disable Project?' : 'Activate Project?'}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedProject.status === 'Active' ? (
                    <>
                      Disabling <strong>{selectedProject.name}</strong> will prevent new rider assignments and new
                      payroll imports. Historical assignments and records will remain completely intact.
                    </>
                  ) : (
                    <>
                      Activating <strong>{selectedProject.name}</strong> will allow riders to be assigned to this project
                      again.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500 space-y-1">
              <div className="flex justify-between">
                <span>Project Code:</span>
                <span className="font-mono font-medium text-slate-800">{selectedProject.code}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Assigned Riders:</span>
                <span className="font-semibold text-slate-800">{selectedProject.active_count || 0}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDisableModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="btn_confirm_toggle_status"
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmToggleStatus}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-xs ${
                  selectedProject.status === 'Active'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                } disabled:opacity-50`}
              >
                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {selectedProject.status === 'Active' ? 'Confirm Disable' : 'Confirm Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
