import React, { useState, useEffect } from 'react';
import {
  FolderCheck,
  Search,
  Plus,
  Download,
  FileText,
  Lock,
  ShieldCheck,
  CheckCircle,
  Clock,
  User,
  Send,
  Printer,
  History,
  Building,
  Sparkles,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

interface PassportCustodyItem {
  id: string;
  tenant_id: string;
  serial_number: string;
  passport_number: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  nationality: string;
  expiry_date: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER' | 'VISA_PROCESSING' | 'EMBASSY_CONSULATE' | 'POLICE_COURT' | 'LOST_DAMAGED';
  current_location: string;
  box_number?: string;
  locker_number?: string;
  receive_date?: string;
  received_by?: string;
  last_transfer_date?: string;
  notes?: string;
}

interface FormTemplateItem {
  id: string;
  name: string;
  code: string;
  category: string;
  description: string;
  template_html: string;
}

interface GeneratedFormItem {
  id: string;
  form_number: string;
  template_name: string;
  employee_name: string;
  employee_code: string;
  status: string;
  created_at: string;
  rendered_content: string;
}

export interface OfficeFormsPassportViewProps {
  lang: 'EN' | 'AR';
  initialTab?: 'passports' | 'forms' | 'templates';
  autoOpenCreate?: boolean;
}

export const OfficeFormsPassportView: React.FC<OfficeFormsPassportViewProps> = ({
  lang,
  initialTab = 'passports',
  autoOpenCreate = false,
}) => {
  const [passports, setPassports] = useState<PassportCustodyItem[]>([]);
  const [templates, setTemplates] = useState<FormTemplateItem[]>([]);
  const [generatedForms, setGeneratedForms] = useState<GeneratedFormItem[]>([]);
  const [activeTab, setActiveTab] = useState<'passports' | 'forms' | 'templates'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isGenerateFormModalOpen, setIsGenerateFormModalOpen] = useState(autoOpenCreate);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (autoOpenCreate) {
      setIsGenerateFormModalOpen(true);
    }
  }, [initialTab, autoOpenCreate]);
  const [selectedPassport, setSelectedPassport] = useState<PassportCustodyItem | null>(null);
  const [passportHistory, setPassportHistory] = useState<any[]>([]);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewTitle, setPreviewTitle] = useState<string>('');

  // Receive Form State
  const [recEmpName, setRecEmpName] = useState('');
  const [recEmpCode, setRecEmpCode] = useState('');
  const [recPassNo, setRecPassNo] = useState('');
  const [recNationality, setRecNationality] = useState('Pakistan');
  const [recExpiry, setRecExpiry] = useState('2028-12-31');
  const [recLocation, setRecLocation] = useState('Dubai Head Office Safe');
  const [recHandler, setRecHandler] = useState('System User (HR Lead)');
  const [recNotes, setRecNotes] = useState('Onboarding custody deposit');

  // Return Form State
  const [retReason, setRetReason] = useState('Annual Vacation Travel');
  const [retExpectedReturn, setRetExpectedReturn] = useState('');
  const [retReceiverName, setRetReceiverName] = useState('');
  const [retHandler, setRetHandler] = useState('System User (HR Lead)');

  // Form Generator State
  const [genSelectedTemplate, setGenSelectedTemplate] = useState('');
  const [genEmpSearch, setGenEmpSearch] = useState('');
  const [genEmpCode, setGenEmpCode] = useState('');
  const [genDesignation, setGenDesignation] = useState('Bike Delivery Rider');
  const [genSalary, setGenSalary] = useState('3500');
  const [genBankName, setGenBankName] = useState('Emirates NBD');
  const [genCustomNotes, setGenCustomNotes] = useState('');

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [passRes, tmplRes, genRes] = await Promise.all([
        fetch('/api/erp/passports/custody', { headers: { 'x-tenant-id': 'tenant_allied' } }),
        fetch('/api/erp/forms/templates', { headers: { 'x-tenant-id': 'tenant_allied' } }),
        fetch('/api/erp/forms/history', { headers: { 'x-tenant-id': 'tenant_allied' } }),
      ]);

      if (passRes.ok) {
        const passData = await passRes.json();
        setPassports(passData);
      }
      if (tmplRes.ok) {
        const tmplData = await tmplRes.json();
        setTemplates(tmplData);
        if (tmplData.length > 0 && !genSelectedTemplate) {
          setGenSelectedTemplate(tmplData[0].id);
        }
      }
      if (genRes.ok) {
        const genData = await genRes.json();
        setGeneratedForms(genData);
      }
    } catch (err) {
      console.error('Failed to fetch passport/forms data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleReceivePassport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recEmpName || !recPassNo) return;

    try {
      const res = await fetch('/api/erp/passports/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant_allied',
        },
        body: JSON.stringify({
          employee_name: recEmpName,
          employee_code: recEmpCode || 'EMP-NEW',
          passport_number: recPassNo,
          nationality: recNationality,
          expiry_date: recExpiry,
          location: recLocation,
          handler: recHandler,
          notes: recNotes,
        }),
      });

      if (res.ok) {
        setIsReceiveModalOpen(false);
        setRecEmpName('');
        setRecPassNo('');
        fetchAllData();
      }
    } catch (e) {
      console.error('Receive error:', e);
    }
  };

  const handleReturnPassport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPassport) return;

    try {
      const res = await fetch(`/api/erp/passports/${selectedPassport.id}/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant_allied',
        },
        body: JSON.stringify({
          reason: retReason,
          expected_return_date: retExpectedReturn || undefined,
          received_by_person: retReceiverName || selectedPassport.employee_name,
          handler: retHandler,
        }),
      });

      if (res.ok) {
        setIsReturnModalOpen(false);
        fetchAllData();
      }
    } catch (e) {
      console.error('Return error:', e);
    }
  };

  const handleOpenHistory = async (passport: PassportCustodyItem) => {
    setSelectedPassport(passport);
    setIsHistoryModalOpen(true);
    try {
      const res = await fetch(`/api/erp/passports/${passport.id}/history`, {
        headers: { 'x-tenant-id': 'tenant_allied' },
      });
      if (res.ok) {
        const hist = await res.json();
        setPassportHistory(Array.isArray(hist) ? hist : (hist.history || []));
      }
    } catch (e) {
      console.error('History error:', e);
    }
  };

  const handleGenerateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genEmpSearch || !genSelectedTemplate) return;

    try {
      const res = await fetch('/api/erp/forms/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'tenant_allied',
        },
        body: JSON.stringify({
          template_id: genSelectedTemplate,
          employee_name: genEmpSearch,
          employee_code: genEmpCode || 'EMP-2026',
          designation: genDesignation,
          basic_salary: Number(genSalary),
          bank_name: genBankName,
          notes: genCustomNotes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setIsGenerateFormModalOpen(false);
        fetchAllData();
        setPreviewTitle(data.form?.template_name || 'Generated Document');
        setPreviewContent(data.form?.rendered_content || 'Document ready.');
        setIsPreviewModalOpen(true);
      }
    } catch (e) {
      console.error('Generate form error:', e);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${previewTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>
            ${previewContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  const filteredPassports = passports.filter((p) => {
    const matchQuery =
      p.employee_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.passport_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchLocation = locationFilter === 'ALL' || p.current_location === locationFilter;
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;

    return matchQuery && matchLocation && matchStatus;
  });

  const withCompanyCount = passports.filter((p) => p.status === 'WITH_COMPANY').length;
  const withRiderCount = passports.filter((p) => p.status === 'WITH_RIDER').length;
  const inProcessingCount = passports.filter((p) => p.status === 'VISA_PROCESSING').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderCheck className="w-6 h-6 text-blue-600" />
            {lang === 'EN' ? 'Office Forms & Physical Passport Custody' : 'إدارة النماذج الإدارية وأمانة الجوازات'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {lang === 'EN'
              ? 'Audited physical passport vault tracking, auto-generated serial tracking (PP-000001), handover history, NOC requests, and salary certificates.'
              : 'متابعة أمانة الجوازات بالسجلات التسلسلية وأماكن الخزائن وتوليد شهادات الراتب وعدم الممانعة.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsReceiveModalOpen(true)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ShieldCheck className="w-4 h-4" /> Deposit Passport
          </button>
          <button
            onClick={() => setIsGenerateFormModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> Generate Office Form
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Registered Passports</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <FolderCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {passports.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Under enterprise custody</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">In Safe Vault (With Company)</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {withCompanyCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Secured in verified lockers</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Released / With Rider</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <User className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {withRiderCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Leave travel / temporary release</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400">Visa / Immigration Process</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {inProcessingCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">PRO submission / Consulate</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-xs font-bold">
        {[
          { id: 'passports', label: 'Passport Custody Registry' },
          { id: 'forms', label: `Generated Office Documents (${generatedForms.length})` },
          { id: 'templates', label: `Document Templates Library (${templates.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Passports Registry */}
      {activeTab === 'passports' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by serial #, passport #, employee name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                <option value="ALL">All Custody Statuses</option>
                <option value="WITH_COMPANY">With Company (Safe)</option>
                <option value="WITH_RIDER">With Rider (Released)</option>
                <option value="VISA_PROCESSING">Visa Processing</option>
                <option value="EMBASSY_CONSULATE">Embassy / Consulate</option>
              </select>

              <button
                onClick={fetchAllData}
                className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs"
                title="Refresh Registry"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Passports Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold">
                  <tr>
                    <th className="py-3 px-4">Serial #</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Passport No</th>
                    <th className="py-3 px-4">Nationality</th>
                    <th className="py-3 px-4">Vault Location</th>
                    <th className="py-3 px-4">Custody Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Loading passport vault registry...
                      </td>
                    </tr>
                  ) : filteredPassports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No passport custody records found.
                      </td>
                    </tr>
                  ) : (
                    filteredPassports.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {p.serial_number}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{p.employee_name}</div>
                          <div className="text-[10px] text-slate-400">{p.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                          {p.passport_number}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                          {p.nationality}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Building className="w-3 h-3 text-slate-400" />
                            {p.current_location}
                          </div>
                          {p.box_number && (
                            <div className="text-[10px] text-slate-400">Box: {p.box_number}</div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'WITH_COMPANY'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : p.status === 'WITH_RIDER'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            }`}
                          >
                            {p.status === 'WITH_COMPANY'
                              ? 'With Company (Vault)'
                              : p.status === 'WITH_RIDER'
                              ? 'Released to Rider'
                              : p.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenHistory(p)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded font-medium text-[11px] flex items-center gap-1"
                            >
                              <History className="w-3 h-3" /> Logs
                            </button>
                            {p.status === 'WITH_COMPANY' ? (
                              <button
                                onClick={() => {
                                  setSelectedPassport(p);
                                  setIsReturnModalOpen(true);
                                }}
                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[11px]"
                              >
                                Release
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setRecEmpName(p.employee_name);
                                  setRecEmpCode(p.employee_code);
                                  setRecPassNo(p.passport_number);
                                  setRecNationality(p.nationality);
                                  setIsReceiveModalOpen(true);
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium text-[11px]"
                              >
                                Re-Deposit
                              </button>
                            )}
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
      )}

      {/* Tab 2: Generated Forms History */}
      {activeTab === 'forms' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-bold">
                  <tr>
                    <th className="py-3 px-4">Form #</th>
                    <th className="py-3 px-4">Document Type</th>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Generated Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {generatedForms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No generated forms yet. Click "Generate Office Form" to create one.
                      </td>
                    </tr>
                  ) : (
                    generatedForms.map((gf) => (
                      <tr key={gf.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {gf.form_number}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {gf.template_name}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{gf.employee_name}</div>
                          <div className="text-[10px] text-slate-400">{gf.employee_code}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {gf.created_at?.split('T')[0]}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                            {gf.status || 'GENERATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setPreviewTitle(gf.template_name);
                              setPreviewContent(gf.rendered_content);
                              setIsPreviewModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 rounded text-xs font-semibold"
                          >
                            View & Print
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Template Library */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60">
                    {tpl.category}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{tpl.code}</span>
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white mt-2 text-sm">
                  {tpl.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {tpl.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => {
                    setGenSelectedTemplate(tpl.id);
                    setIsGenerateFormModalOpen(true);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold"
                >
                  Use Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Receive / Deposit Passport Modal */}
      <Modal
        isOpen={isReceiveModalOpen}
        onClose={() => setIsReceiveModalOpen(false)}
        title="Physical Passport Custody Deposit"
      >
        <form onSubmit={handleReceivePassport} className="space-y-3 text-xs">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900/60">
            A permanent serial number (e.g. <b>PP-00000X</b>) will be automatically assigned and logged into the physical vault registry.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. System User Ghulam Muhammad"
                value={recEmpName}
                onChange={(e) => setRecEmpName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee Code / ID
              </label>
              <input
                type="text"
                placeholder="e.g. EMP-1001"
                value={recEmpCode}
                onChange={(e) => setRecEmpCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Passport Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. P1234567"
                value={recPassNo}
                onChange={(e) => setRecPassNo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nationality
              </label>
              <input
                type="text"
                value={recNationality}
                onChange={(e) => setRecNationality(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Custody Vault Location *
              </label>
              <select
                value={recLocation}
                onChange={(e) => setRecLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              >
                <option value="Dubai Head Office Safe">Dubai Head Office Safe</option>
                <option value="Abu Dhabi Branch Vault">Abu Dhabi Branch Vault</option>
                <option value="Sharjah Branch Locker">Sharjah Branch Locker</option>
                <option value="HR Director Safe Box">HR Director Safe Box</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Received / Handled By *
              </label>
              <input
                type="text"
                required
                value={recHandler}
                onChange={(e) => setRecHandler(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Deposit Notes & Purpose
            </label>
            <input
              type="text"
              value={recNotes}
              onChange={(e) => setRecNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsReceiveModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded"
            >
              Deposit & Generate Serial
            </button>
          </div>
        </form>
      </Modal>

      {/* Return / Release Modal */}
      {selectedPassport && (
        <Modal
          isOpen={isReturnModalOpen}
          onClose={() => setIsReturnModalOpen(false)}
          title={`Release Passport: ${selectedPassport.serial_number} (${selectedPassport.employee_name})`}
        >
          <form onSubmit={handleReturnPassport} className="space-y-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Release Purpose / Reason *
              </label>
              <select
                value={retReason}
                onChange={(e) => setRetReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              >
                <option value="Annual Vacation Travel">Annual Vacation Travel</option>
                <option value="Visa Renewal / Processing">Visa Renewal / Processing</option>
                <option value="Embassy / Consulate Renewal">Embassy / Consulate Renewal</option>
                <option value="Final Exit / Resignation">Final Exit / Resignation</option>
                <option value="Official Police / Court Request">Official Police / Court Request</option>
                <option value="Rider Personal Requirement">Rider Personal Requirement</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  value={retExpectedReturn}
                  onChange={(e) => setRetExpectedReturn(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Handed Over By (HR Lead) *
                </label>
                <input
                  type="text"
                  required
                  value={retHandler}
                  onChange={(e) => setRetHandler(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded"
              >
                Confirm Release
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* History Modal */}
      {selectedPassport && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`Custody Audit Trail: ${selectedPassport.serial_number}`}
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">{selectedPassport.employee_name}</span>
                <span className="text-slate-400">{selectedPassport.passport_number} • {selectedPassport.nationality}</span>
              </div>
              <span className="font-mono font-bold text-blue-600">{selectedPassport.serial_number}</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {passportHistory.length === 0 ? (
                <div className="text-center py-4 text-slate-400">No transfer history recorded yet.</div>
              ) : (
                passportHistory.map((h, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-200">
                      <span>{h.action_type || 'TRANSFER'}</span>
                      <span className="text-[10px] text-slate-400">{h.created_at?.replace('T', ' ').slice(0, 16)}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 mt-1">
                      {h.from_location} → <b>{h.to_location}</b>
                    </div>
                    {h.notes && <div className="text-[11px] text-slate-500 mt-0.5">{h.notes}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">Handled by: {h.handled_by || 'HR Admin'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Generate Form Modal */}
      <Modal
        isOpen={isGenerateFormModalOpen}
        onClose={() => setIsGenerateFormModalOpen(false)}
        title="Generate Official Company Form"
      >
        <form onSubmit={handleGenerateForm} className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Form Template *
            </label>
            <select
              value={genSelectedTemplate}
              onChange={(e) => setGenSelectedTemplate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.category})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Tariq Mansoor"
                value={genEmpSearch}
                onChange={(e) => setGenEmpSearch(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Employee Code
              </label>
              <input
                type="text"
                placeholder="e.g. EMP-1001"
                value={genEmpCode}
                onChange={(e) => setGenEmpCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Designation / Job Title
              </label>
              <input
                type="text"
                value={genDesignation}
                onChange={(e) => setGenDesignation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Monthly Salary (AED)
              </label>
              <input
                type="number"
                value={genSalary}
                onChange={(e) => setGenSalary(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Addressed Authority / Bank Name
            </label>
            <input
              type="text"
              value={genBankName}
              onChange={(e) => setGenBankName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsGenerateFormModalOpen(false)}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded"
            >
              Generate Form
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Print / Preview Modal */}
      <Modal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={previewTitle}
      >
        <div className="space-y-4">
          <div
            className="p-6 bg-white text-slate-900 border border-slate-200 rounded-lg max-h-96 overflow-y-auto font-sans leading-relaxed text-xs shadow-inner"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">Ready for official corporate export</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Export PDF
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
