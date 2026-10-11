import React, { useState } from 'react';
import {
  ArrowLeft,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  Tag,
  Hash,
  FileText,
  Building,
  Check,
  RefreshCw,
  Plus,
  Users,
  ShieldCheck
} from 'lucide-react';
import { riderProjectService, ProjectMasterItem } from '../../services/riderProjectService';

interface CreateProjectViewProps {
  onNavigate: (module: string, params?: any) => void;
}

const COMMON_LABEL_PRESETS = [
  { label: 'Courier ID', hint: 'Keeta / Express courier platforms' },
  { label: 'NIM ID', hint: 'Noon Minutes / Quick commerce platforms' },
  { label: 'Person Code', hint: 'Labour supply & corporate contracts' },
  { label: 'Captain ID', hint: 'Careem / Ride-hailing platforms' },
  { label: 'Rider ID', hint: 'Talabat, Deliveroo & standard food delivery' },
  { label: 'Driver Code', hint: 'Fleet logistics & cargo distribution' },
];

export const CreateProjectView: React.FC<CreateProjectViewProps> = ({ onNavigate }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [externalIdLabel, setExternalIdLabel] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive / Archived'>('Active');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdProject, setCreatedProject] = useState<ProjectMasterItem | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-suggest uppercase code if user hasn't manually altered code
    if (!code || code === name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 10)) {
      const suggestedCode = val
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 15);
      setCode(suggestedCode);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '_');
    const cleanLabel = externalIdLabel.trim();

    if (!cleanName) {
      setError('Project Name is required.');
      return;
    }
    if (!cleanCode) {
      setError('Project Code is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await riderProjectService.createProject({
        name: cleanName,
        code: cleanCode,
        external_id_label: cleanLabel || 'External Rider ID',
        status,
        notes: notes.trim()
      });

      if (!res.success || !res.project) {
        setError(res.error || 'Failed to create project. Please verify inputs.');
        return;
      }

      setCreatedProject(res.project);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setCode('');
    setExternalIdLabel('');
    setStatus('Active');
    setNotes('');
    setCreatedProject(null);
    setError(null);
  };

  if (createdProject) {
    return (
      <div id="create_project_success_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-6 shadow-xs">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              id="btn_back_to_projects_from_success"
              onClick={() => onNavigate('projects_list')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Project Management
            </button>
            <span className="text-xs text-slate-500">Step 2 of 2: Confirmed</span>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 mt-8">
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
            <div className="p-8 text-center bg-gradient-to-b from-emerald-50/50 to-white border-b border-emerald-100">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 ring-8 ring-emerald-50">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Project Created Successfully</h2>
              <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">
                Project <strong>{createdProject.name}</strong> ({createdProject.code}) is now registered in the live Project Master.
              </p>
            </div>

            <div className="p-6 bg-slate-50/50 border-b border-slate-200 space-y-4">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Configuration Summary</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Project Name</span>
                  <div className="font-semibold text-slate-900 mt-0.5">{createdProject.name}</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Project Code</span>
                  <div className="font-mono font-semibold text-slate-900 mt-0.5">{createdProject.code}</div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">External Rider ID Label</span>
                  <div className="font-semibold text-amber-900 mt-0.5 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-600" />
                    {createdProject.external_id_label}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Initial Status</span>
                  <div className="font-semibold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    {createdProject.status}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                id="btn_create_another_project"
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                + Create Another Project
              </button>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  id="btn_view_projects_list"
                  onClick={() => onNavigate('projects_list')}
                  className="flex-1 sm:flex-initial px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  View All Projects
                </button>
                <button
                  id="btn_assign_riders_to_new_project"
                  onClick={() => onNavigate('projects_assign', { projectId: createdProject.id })}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-xs"
                >
                  <Users className="w-4 h-4" />
                  Assign Riders to This Project
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="create_project_form_workspace" className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Header Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-6 sticky top-0 z-10 shadow-xs">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              id="btn_back_to_projects_header"
              onClick={() => onNavigate('projects_list')}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
              title="Return to Project Management"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                  Project Master
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500">Dedicated Full-Page Form</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Project</h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Configure delivery/client projects and operator-defined rider identity labels.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn_cancel_create_project_top"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            >
              Cancel
            </button>
            <button
              id="btn_submit_create_project_top"
              type="button"
              disabled={loading}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Project
            </button>
          </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="max-w-4xl mx-auto px-6 mt-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div
              id="banner_create_project_error"
              className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold">Creation Error</h4>
                <p className="text-xs mt-0.5 text-rose-700">{error}</p>
              </div>
            </div>
          )}

          {/* Section 1: Project Identity */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-5 h-5 text-blue-600" />
                1. Project Identity
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Define the project name and unique code used for internal tracking and contract attribution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Project Name <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_project_name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Keeta Delivery, Noon Minutes, Labour Contract"
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 mt-1.5 block">
                  The official delivery service or client company name.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Project Code <span className="text-rose-500">*</span>
                </label>
                <input
                  id="input_project_code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                  placeholder="e.g. KEETA, NOON, LABOUR_AUH"
                  className="w-full px-4 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 mt-1.5 block">
                  Unique within this organization. Used in database mappings and payroll files.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: External Rider ID Label Configuration */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                2. Rider Identity Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure how delivery rider credentials on this platform are labeled. Do NOT rely on hardcoded project names — the operator explicitly configures the correct label.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                External Rider ID Label <span className="text-rose-500">*</span>
              </label>
              <input
                id="input_external_id_label"
                type="text"
                required
                value={externalIdLabel}
                onChange={(e) => setExternalIdLabel(e.target.value)}
                placeholder="e.g. Courier ID, NIM ID, Person Code, Captain ID"
                className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
              />
              <span className="text-xs text-slate-500 mt-1.5 block">
                This exact label will be displayed whenever operators assign riders, view assignments, or match payroll.
              </span>
            </div>

            {/* Quick helper presets */}
            <div>
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block mb-2">
                Common Platform Conventions (Click to Apply):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {COMMON_LABEL_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setExternalIdLabel(preset.label)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      externalIdLabel.toLowerCase() === preset.label.toLowerCase()
                        ? 'border-blue-500 bg-blue-50/70 ring-1 ring-blue-500'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                      <span>{preset.label}</span>
                      {externalIdLabel.toLowerCase() === preset.label.toLowerCase() && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{preset.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 3: Status & Operational Notes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-600" />
                3. Lifecycle & Notes
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure initial status and optional contract notes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Initial Status
                </label>
                <select
                  id="select_project_status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive / Archived')}
                  className="w-full px-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Active">Active (Ready for Assignments & Payroll)</option>
                  <option value="Inactive / Archived">Inactive / Archived (Locked)</option>
                </select>
                <span className="text-xs text-slate-500 mt-1.5 block">
                  Inactive projects cannot receive new assignments or be chosen for new payroll imports.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  id="input_project_notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Rate card specifics, operational contact, SLA details..."
                  className="w-full px-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Footer Submit Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              id="btn_cancel_create_project_bottom"
              type="button"
              onClick={() => onNavigate('projects_list')}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn_submit_create_project_bottom"
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
