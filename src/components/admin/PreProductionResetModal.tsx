import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Lock,
  Layers,
  FileText,
  UserCheck,
  Building2,
  Car,
  CreditCard,
  Banknote,
  Cpu,
  X,
} from 'lucide-react';
import { Badge } from '../common/Badge';

interface PreProductionResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'EN' | 'AR';
}

export const PreProductionResetModal: React.FC<PreProductionResetModalProps> = ({
  isOpen,
  onClose,
  lang = 'EN',
}) => {
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'CHECKLIST' | 'DIAGNOSTIC'>('PREVIEW');
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [resetting, setResetting] = useState<boolean>(false);
  const [postResetReport, setPostResetReport] = useState<any>(null);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);

  // Diagnostic state
  const [diagInput, setDiagInput] = useState<string>('emp_01');
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState<boolean>(false);

  // Checklist state
  const [checklist, setChecklist] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
      loadChecklist();
    }
  }, [isOpen]);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/erp/pre-production/preview');
      const data = await res.json();
      setPreview(data);
    } catch (e) {
      console.error('Failed to load reset preview:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadChecklist = async () => {
    try {
      const res = await fetch('/api/erp/pre-production/qa-checklist');
      const data = await res.json();
      setChecklist(data.checklist || []);
    } catch (e) {
      console.error('Failed to load QA checklist:', e);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/erp/pre-production/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'manual_pre_qa_backup' }),
      });
      const data = await res.json();
      setBackupSuccess(`Snapshot created: ${data.filePath}`);
    } catch (e) {
      console.error('Failed to backup:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReset = async () => {
    if (confirmInput !== 'CONFIRM_RESET') return;
    setResetting(true);
    try {
      const res = await fetch('/api/erp/pre-production/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationToken: 'CONFIRM_PRE_PRODUCTION_RESET',
          operatorName: 'System Administrator',
        }),
      });
      const data = await res.json();
      setPostResetReport(data);
      loadPreview();
      loadChecklist();
    } catch (e) {
      console.error('Failed to execute reset:', e);
    } finally {
      setResetting(false);
    }
  };

  const handleRunDiagnostic = async () => {
    if (!diagInput.trim()) return;
    setDiagLoading(true);
    try {
      const res = await fetch(`/api/erp/pre-production/diagnostics/consistency/${encodeURIComponent(diagInput.trim())}`);
      const data = await res.json();
      setDiagnosticReport(data);
    } catch (e) {
      console.error('Diagnostic error:', e);
    } finally {
      setDiagLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                ERP Pre-Production Reset & QA Preparation
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 font-bold">
                  Admin Safe Mode
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Purge temporary operational data • Preserve system configuration & legal master profiles • Zero fake data QA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Banner */}
        <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Payroll & Banking Safety:</strong> Real fund transfers are strictly disconnected during QA. SIF/WPS outputs are simulations only.
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            <span>Git Checkpoint: <strong>0d13810</strong></span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">Build: PASS</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 flex gap-2 pt-3">
          <button
            onClick={() => setActiveTab('PREVIEW')}
            className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'PREVIEW'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Database className="w-4 h-4" /> Reset Preview & Controlled Purge
          </button>
          <button
            onClick={() => setActiveTab('CHECKLIST')}
            className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'CHECKLIST'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Pre-Production QA Checklist ({checklist.length})
          </button>
          <button
            onClick={() => setActiveTab('DIAGNOSTIC')}
            className={`pb-3 px-4 text-xs font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'DIAGNOSTIC'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" /> Cross-Module Consistency Diagnostic
          </button>
        </div>

        {/* Tab 1: Reset Preview & Controlled Purge */}
        {activeTab === 'PREVIEW' && (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Backup Action Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-600" /> Database Safety Snapshot
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Export full state as restorable JSON before performing destructive operations.
                </p>
                {backupSuccess && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    {backupSuccess}
                  </p>
                )}
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={loading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors shadow-2xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Create Snapshot Now
              </button>
            </div>

            {/* Counts Grid Comparison */}
            {preview && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Operational Records to Clear */}
                <div className="p-4 rounded-2xl bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-red-700 dark:text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" /> Operational Records To Purge (Count &rarr; 0)
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300">
                      Destructive
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Employees:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.employees}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Candidates:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.candidates}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Vehicles (Fleet):</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.vehicles}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Assignments:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.vehicleAssignments}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Traffic Fines:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.trafficFines}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Salik Tolls:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.salikRecords}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Loans/Advances:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.loans}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-red-100 dark:border-red-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Generated Forms:</span>
                      <strong className="text-red-600 dark:text-red-400">{preview.operationalCounts.generatedForms}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Dependencies cleared in safe topological order: Leaves &rarr; Transactions &rarr; Masters. Zero orphan records created.
                  </div>
                </div>

                {/* Master Configuration to Preserve */}
                <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Preserved Master Configuration (100% Intact)
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                      Protected
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Tenants/Companies:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.tenants}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Branches:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.branches}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Departments:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.departments}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Projects:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.projects}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Document Types:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.documentTypes}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Legal Form Templates:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.formTemplates}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Payroll Profiles:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.preservedMasterCounts.projectImportProfiles}</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/30 flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Admin Accounts:</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{preview.authAccounts.preservedAdmins.length}</strong>
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Administrator and Company Admin auth identities are preserved. No auth identity will be orphaned.
                  </div>
                </div>
              </div>
            )}

            {/* Post-Reset Result Callout (if executed) */}
            {postResetReport && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-5 h-5" /> Operational Reset Successfully Executed
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  Real Database Counts: <strong>Employees: {postResetReport.operationalCounts.employees}</strong> •{' '}
                  <strong>Vehicles: {postResetReport.operationalCounts.vehicleOperationalRecords}</strong> •{' '}
                  <strong>Fines: {postResetReport.operationalCounts.trafficFines}</strong> •{' '}
                  <strong>Salik: {postResetReport.operationalCounts.salikTransactions}</strong> •{' '}
                  <strong>Orphans Detected: {postResetReport.orphansDetected.totalOrphans}</strong>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Safety snapshot archived to: {postResetReport.backupFile}
                </div>
              </div>
            )}

            {/* Execution Confirmation Form */}
            <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4 border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
                <Lock className="w-4 h-4" /> Operator Confirmation Gate
              </div>
              <p className="text-xs text-slate-400">
                To execute the pre-production reset, type <span className="font-mono text-amber-300 font-bold">CONFIRM_RESET</span> below. This action is recorded in the immutable audit log.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="Type CONFIRM_RESET"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 font-mono text-xs focus:outline-hidden focus:border-amber-400"
                />
                <button
                  onClick={handleExecuteReset}
                  disabled={confirmInput !== 'CONFIRM_RESET' || resetting}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    confirmInput === 'CONFIRM_RESET' && !resetting
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
                  {resetting ? 'Executing Dependency-Safe Purge...' : 'Execute Operational Reset'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: QA Checklist */}
        {activeTab === 'CHECKLIST' && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  Real Data Verification Protocol
                </h3>
                <p className="text-[11px] text-slate-500">
                  Verify each operational area with genuine data as you add records. No automated fake data seeding.
                </p>
              </div>
              <button
                onClick={loadChecklist}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {checklist.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                        {item.category}
                      </span>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h4>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 pl-7">
                      {item.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'READY_FOR_VERIFICATION' || item.status === 'ACTIVE' || item.status === 'ENFORCED'
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {item.status}
                    </span>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      Count: {item.currentCount}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Consistency Diagnostic */}
        {activeTab === 'DIAGNOSTIC' && (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                Cross-Module Employee Consistency Diagnostic
              </h3>
              <p className="text-[11px] text-slate-500">
                Examines Employee Master, Active Projects, Vehicle, SIM, Documents, Passports, Loans, Fines, and Salik. Highlights inconsistencies without silently altering records.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={diagInput}
                onChange={(e) => setDiagInput(e.target.value)}
                placeholder="Enter Employee ID (e.g. emp_01) or Code (e.g. EMP-1001)"
                className="flex-1 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono focus:outline-hidden"
              />
              <button
                onClick={handleRunDiagnostic}
                disabled={diagLoading}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {diagLoading ? 'Diagnosing...' : 'Run Diagnostic'}
              </button>
            </div>

            {diagnosticReport && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white">
                      {diagnosticReport.fullName} ({diagnosticReport.employeeCode})
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Target ID: {diagnosticReport.employeeId}
                    </p>
                  </div>
                  <Badge variant={diagnosticReport.overallConsistent ? 'emerald' : 'amber'}>
                    {diagnosticReport.overallConsistent ? 'CONSISTENT' : 'INCONSISTENCIES DETECTED'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(diagnosticReport?.checks) ? diagnosticReport.checks : []).map((c: any, i: number) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {c.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            c.status === 'PASS'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                              : c.status === 'WARNING'
                              ? 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300'
                              : c.status === 'FAIL'
                              ? 'bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {c.status}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">{c.summary}</p>
                      {c.details && (
                        <details className="mt-2 text-[11px] text-slate-500 font-mono bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                          <summary className="cursor-pointer text-blue-600 dark:text-blue-400 font-sans">
                            View Diagnostic Payload
                          </summary>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
                            {JSON.stringify(c.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono text-[11px]">
            System Operational State: PRE-PRODUCTION QA READINESS
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
};
