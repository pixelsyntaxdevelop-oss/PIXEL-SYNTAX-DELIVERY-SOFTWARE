import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  Search,
  Plus,
  Printer,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  Building2,
  User,
  Layers,
  FileCheck,
  Download,
  Filter,
  Maximize2,
  Minimize2,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  X,
  FileSignature,
  FilePlus,
  FolderKanban,
  Edit3,
  Ban,
  Archive,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { isEmployeeFormTemplate } from '../../../server/officeFormsTemplates';
import { OfficeFormPage, officeFormDocument, OFFICE_FORM_WIDTH } from '../common/OfficeFormPage';
import { apiClient } from '../../services/apiClient';

export interface FormTemplateType {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  description: string;
  category: string;
  color: string;
  is_active: boolean;
}

export interface FormTemplate {
  id: string;
  name: string;
  template_type: string;
  description: string;
  category: string;
  content: string;
  placeholders: string[];
  version: number;
  is_active?: boolean;
}

export interface GeneratedForm {
  id: string;
  form_number: string;
  document_serial: string;
  form_title: string;
  template_id: string;
  template_name: string;
  template_type: string;
  template_version?: number;
  category: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  emirates_id?: string;
  passport_number?: string;
  vehicle_plate?: string;
  sim_number?: string;
  project_name?: string;
  issuance_branch: string;
  rendered_content: string;
  snapshot_data?: Record<string, any>;
  status: 'GENERATED' | 'SIGNED' | 'APPROVED' | 'ARCHIVED' | 'VOID';
  void_reason?: string;
  voided_at?: string;
  voided_by?: string;
  voided_by_id?: string;
  signed_file_url?: string;
  signed_file_name?: string;
  signed_at?: string;
  signed_by?: string;
  signed_uploaded_by?: string;
  signed_uploaded_by_id?: string;
  generated_by: string;
  generated_at: string;
  notes?: string;
}

export interface EmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
  designation?: string;
  department?: string;
  emirates_id?: string;
  passport_number?: string;
  mobile_number?: string;
  current_project_name?: string;
  project_name?: string;
  external_rider_id?: string;
  assigned_vehicle_plate?: string;
  assigned_sim_number?: string;
  current_bike_plate?: string;
  current_sim_number?: string;
  basic_salary?: number;
  salary?: number;
  joining_date?: string;
  nationality?: string;
  current_status?: string;
  branch?: string;
  branch_name?: string;
}

export interface BranchOption {
  id: string;
  name: string;
  city?: string;
}

interface OfficeFormsViewProps {
  lang: 'EN' | 'AR';
  initialSubView?: 'create' | 'list' | 'template_types' | 'templates';
  onNavigateModule?: (module: string) => void;
}

export const OfficeFormsView: React.FC<OfficeFormsViewProps> = ({
  lang,
  initialSubView = 'create',
  onNavigateModule,
}) => {
  const [subView, setSubView] = useState<'create' | 'list' | 'template_types' | 'templates'>(
    initialSubView
  );

  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  // Data collections
  const [templateTypes, setTemplateTypes] = useState<FormTemplateType[]>([]);
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [generatedForms, setGeneratedForms] = useState<GeneratedForm[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(true);

  // -------------------------------------------------------------
  // VIEW 1: CREATE EMPLOYEE FORM STATE
  // Workflow: Employee -> Branch -> Template -> Auto-Fill -> Preview -> Generate -> Print / PDF / Signed Copy
  // -------------------------------------------------------------
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeObj, setSelectedEmployeeObj] = useState<EmployeeOption | null>(null);
  const [selectedBranchName, setSelectedBranchName] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tmpl_bike_undertaking');
  const [selectedIssueDate, setSelectedIssueDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState<string>('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [searchedEmployees, setSearchedEmployees] = useState<EmployeeOption[]>([]);
  const [isSearchingEmployees, setIsSearchingEmployees] = useState(false);

  // Resolved Employee Context & Preview
  const [resolvedContext, setResolvedContext] = useState<Record<string, any> | null>(null);
  const [renderedPreviewHtml, setRenderedPreviewHtml] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const previewRequestId = useRef(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedForm | null>(null);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);

  // -------------------------------------------------------------
  // VIEW 2: EMPLOYEE FORMS LIST STATE
  // -------------------------------------------------------------
  const [listSearch, setListSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'GENERATED' | 'SIGNED' | 'VOID'>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [selectedFormForView, setSelectedFormForView] = useState<GeneratedForm | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Upload Signed Copy Modal State
  const [isUploadSignedModalOpen, setIsUploadSignedModalOpen] = useState(false);
  const [formForSignedUpload, setFormForSignedUpload] = useState<GeneratedForm | null>(null);
  const [signedFileName, setSignedFileName] = useState('');
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signedNotes, setSignedNotes] = useState('');
  const [isUploadingSigned, setIsUploadingSigned] = useState(false);

  const signedCopyCache = useRef(new Map<string, { url: string; token: string }>());
  useEffect(() => () => {
    signedCopyCache.current.forEach(copy => URL.revokeObjectURL(copy.url));
    signedCopyCache.current.clear();
  }, []);
  const cacheSignedCopy = (form: GeneratedForm, blob: Blob, token: string) => {
    const key = form.id + ':' + (form.signed_at || '');
    const cache = signedCopyCache.current;
    const old = cache.get(key);
    if (old) URL.revokeObjectURL(old.url);
    const url = URL.createObjectURL(blob);
    cache.set(key, { url, token });
    while (cache.size > 3) {
      const oldest = cache.keys().next().value!;
      URL.revokeObjectURL(cache.get(oldest)!.url); cache.delete(oldest);
    }
    return url;
  };

  // Void Form Modal State (Safe Void / Archive - Never Hard Delete)
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [formForVoid, setFormForVoid] = useState<GeneratedForm | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  // -------------------------------------------------------------
  // VIEW 3 & 4: TEMPLATE TYPES & TEMPLATES MANAGEMENT
  // -------------------------------------------------------------
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [typeFormId, setTypeFormId] = useState<string | null>(null);
  const [typeFormCode, setTypeFormCode] = useState('');
  const [typeFormName, setTypeFormName] = useState('');
  const [typeFormCategory, setTypeFormCategory] = useState('HR');
  const [typeFormColor, setTypeFormColor] = useState('#2563eb');
  const [typeFormDesc, setTypeFormDesc] = useState('');
  const [typeFormActive, setTypeFormActive] = useState(true);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateFormId, setTemplateFormId] = useState<string | null>(null);
  const [templateFormName, setTemplateFormName] = useState('');
  const [templateFormType, setTemplateFormType] = useState('');
  const [templateFormCategory, setTemplateFormCategory] = useState('HR');
  const [templateFormDesc, setTemplateFormDesc] = useState('');
  const [templateFormContent, setTemplateFormContent] = useState('');
  const [templateFormActive, setTemplateFormActive] = useState(true);
  const [templateModalPreviewTab, setTemplateModalPreviewTab] = useState<'editor' | 'preview'>('editor');

  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // -------------------------------------------------------------
  // DATA FETCHING
  // -------------------------------------------------------------
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const activeTenant = apiClient.getActiveTenantId() || 'company_pixel_syntax';
      const token = localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token');
      const tenantHeaders = { 'x-tenant-id': activeTenant, ...(token ? { Authorization: 'Bearer ' + token } : {}) };

      const [typesRes, tmplsRes, formsRes, branchesRes] = await Promise.all([
        fetch('/api/erp/forms/template-types', { headers: tenantHeaders }),
        fetch('/api/erp/forms/templates', { headers: tenantHeaders }),
        fetch('/api/erp/forms/generated', { headers: tenantHeaders }),
        fetch('/api/erp/forms/branches', { headers: tenantHeaders }),
      ]);

      if (typesRes.ok) {
        const typesData = await typesRes.json();
        setTemplateTypes(typesData.filter((type: FormTemplateType) => ['FLEET_HANDOVER', 'HR_UNDERTAKING', 'ASSET_LIABILITY'].includes(type.code)));
      }
      if (tmplsRes.ok) {
        const tmplsData = (await tmplsRes.json()).filter((t: FormTemplate) => isEmployeeFormTemplate(t.id));
        setTemplates(tmplsData);
        if (tmplsData.length > 0) {
          const bikeTmpl = tmplsData.find((t: any) => t.id === 'tmpl_bike_undertaking' || t.template_type === 'BIKE_UNDERTAKING');
          setSelectedTemplateId(bikeTmpl ? bikeTmpl.id : tmplsData[0].id);
        }
      }
      if (!formsRes.ok) {
        const error = await formsRes.json().catch(() => ({}));
        throw new Error(error.error || 'Could not load saved employee forms.');
      }
      if (formsRes.ok) {
        const formsData = await formsRes.json();
        setGeneratedForms(formsData);
      }
      if (branchesRes.ok) {
        const branchesData = await branchesRes.json();
        setBranches(branchesData);
        if (branchesData.length > 0 && !selectedBranchName) {
          setSelectedBranchName(branchesData[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to load Office Forms data:', err);
      alert(err instanceof Error ? err.message : 'Could not load saved employee forms. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Keep company-wide history current when another staff member generates a form.
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const reloadCompanyForms = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const token = localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token');
        const res = await fetch('/api/erp/forms/generated', {
          headers: { 'x-tenant-id': apiClient.getActiveTenantId() || 'company_pixel_syntax',
            ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          cache: 'no-store', signal: controller.signal,
        });
        if (!res.ok) throw new Error('Could not refresh company employee forms.');
        const forms = await res.json();
        if (!controller.signal.aborted && Array.isArray(forms)) setGeneratedForms(forms);
      } catch (error) {
        if (!controller.signal.aborted) console.error('Employee Forms refresh failed:', error);
      } finally { busy = false; }
    };
    void reloadCompanyForms();
    const interval = window.setInterval(reloadCompanyForms, 30000);
    window.addEventListener('focus', reloadCompanyForms);
    document.addEventListener('visibilitychange', reloadCompanyForms);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', reloadCompanyForms);
      document.removeEventListener('visibilitychange', reloadCompanyForms);
    };
  }, [subView]);

  // Selected Employee Details (Resolved across selectedEmployeeObj, loaded employees, and searched employees)
  const currentEmployee = useMemo(() => {
    if (selectedEmployeeObj && (selectedEmployeeObj.id === selectedEmployeeId || selectedEmployeeObj.employee_code === selectedEmployeeId)) {
      return selectedEmployeeObj;
    }
    const fromLoaded = employees.find((e) => e.id === selectedEmployeeId || e.employee_code === selectedEmployeeId);
    if (fromLoaded) return fromLoaded;
    return searchedEmployees.find((e) => e.id === selectedEmployeeId || e.employee_code === selectedEmployeeId);
  }, [selectedEmployeeObj, employees, searchedEmployees, selectedEmployeeId]);

  // -------------------------------------------------------------
  // LIVE AUTO-FILL RESOLUTION ENGINE
  // Whenever selectedEmployeeId, selectedBranchName, selectedTemplateId, or selectedIssueDate changes,
  // resolve preview immediately!
  // -------------------------------------------------------------
  const resolveLivePreview = async (empOverride?: EmployeeOption) => {
    const requestId = ++previewRequestId.current;
    const empToUse = empOverride || currentEmployee;
    const empIdToUse = empToUse?.id || selectedEmployeeId;
    if (!empIdToUse || !selectedTemplateId) {
      setIsResolving(false);
      setRenderedPreviewHtml('');
      setResolvedContext(null);
      setPreviewError(null);
      return;
    }

    setIsResolving(true);
    setPreviewError(null);
    setRenderedPreviewHtml('');
    try {
      const activeTenant = apiClient.getActiveTenantId() || 'company_pixel_syntax';
      const res = await fetch('/api/erp/forms/resolve-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
          Authorization: 'Bearer ' + (localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token') || ''),
        },
        body: JSON.stringify({
          employee_id: empIdToUse,
          employee: empToUse,
          template_id: selectedTemplateId,
          issuance_branch: selectedBranchName,
          issue_date: selectedIssueDate,
          custom_placeholders: {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (requestId !== previewRequestId.current) return;
        setRenderedPreviewHtml(data.rendered_html);
        setResolvedContext(data.context);
        setPreviewError(null);
      } else {
        const errData = await res.json().catch(() => ({ error: 'Failed to resolve preview.' }));
        if (requestId !== previewRequestId.current) return;
        setPreviewError(errData.error || 'Failed to resolve preview.');
        setRenderedPreviewHtml('');
      }
    } catch (err: any) {
      console.error('Failed to resolve preview:', err);
      if (requestId !== previewRequestId.current) return;
      setPreviewError(err.message || 'Error resolving preview.');
      setRenderedPreviewHtml('');
    } finally {
      if (requestId === previewRequestId.current) setIsResolving(false);
    }
  };

  useEffect(() => {
    resolveLivePreview(currentEmployee);
  }, [selectedEmployeeId, currentEmployee, selectedBranchName, selectedTemplateId, selectedIssueDate]);

  // Live Backend Employee Search (Name, Code, Emirates ID, Passport, Mobile, Project/Rider ID)
  useEffect(() => {
    let active = true;
    const query = employeeSearchTerm.trim();
    setSearchedEmployees([]);
    if (query.length < 3 || !isEmployeeDropdownOpen) {
      setSearchedEmployees([]);
      setIsSearchingEmployees(false);
      return;
    }

    const fetchSearch = async () => {
      setIsSearchingEmployees(true);
      try {
        const activeTenant = apiClient.getActiveTenantId() || 'company_pixel_syntax';
        const url = `/api/erp/forms/employees?search=${encodeURIComponent(query)}&tenant_id=${encodeURIComponent(activeTenant)}`;
        const res = await fetch(url, {
          headers: {
            'x-tenant-id': activeTenant,
          },
        });
        if (res.ok && active) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setSearchedEmployees(data);
          }
        }
      } catch (err) {
        console.error('Failed to search employees:', err);
      } finally {
        if (active) setIsSearchingEmployees(false);
      }
    };

    const timer = setTimeout(fetchSearch, 150);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [employeeSearchTerm, isEmployeeDropdownOpen]);

  // Never expose the directory before the user enters a search.
  const filteredEmployees = employeeSearchTerm.trim().length >= 3 ? searchedEmployees : [];

  // Selected template
  const currentTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId);
  }, [templates, selectedTemplateId]);

  // -------------------------------------------------------------
  // GENERATE FORM ACTION
  // -------------------------------------------------------------
  const handleGenerateForm = async () => {
    if (!selectedEmployeeId || !selectedTemplateId) {
      alert('Please select an Employee and a Form Template.');
      return;
    }

    if (previewError) {
      alert(`Cannot generate document: ${previewError}`);
      return;
    }

    setIsGenerating(true);
    try {
      const activeTenant = apiClient.getActiveTenantId() || 'company_pixel_syntax';
      const res = await fetch('/api/erp/forms/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': activeTenant,
        },
        body: JSON.stringify({
          employee_id: selectedEmployeeId,
          employee: currentEmployee,
          template_id: selectedTemplateId,
          issuance_branch: selectedBranchName,
          issue_date: selectedIssueDate,
          custom_placeholders: {},
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.form) {
          setGeneratedResult(data.form);
          setGeneratedForms((prev) => [data.form, ...prev]);
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setPreviewError(err.error || 'Could not generate form. Please try again.');
      }
    } catch (err: any) {
      setPreviewError(err.message || 'Could not generate form. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // -------------------------------------------------------------
  // PRINT / EXPORT PDF ACTION (A4 Fit, Clean Letterhead, No App Shell)
  // -------------------------------------------------------------
  const handlePrint = (htmlContent?: string, docTitle?: string) => {
    const content = htmlContent || renderedPreviewHtml;
    if (!content) return;
    const title = docTitle || currentTemplate?.name || 'Employee Form';
    const documentHtml = officeFormDocument(content, title, window.location.href);
    let frame = document.getElementById('office-form-print-frame') as HTMLIFrameElement | null;
    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = 'office-form-print-frame';
      // A real page viewport keeps Safari from reflowing text in a zero-width frame.
      Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: OFFICE_FORM_WIDTH + 'px', height: '1100px', border: '0' });
      document.body.appendChild(frame);
    }
    const printFrame = frame;
    printFrame.onload = async () => {
      const doc = printFrame.contentDocument;
      if (!doc) return;
      await Promise.all(Array.from(doc.images).map(img => img.complete ? Promise.resolve() : new Promise<void>(resolve => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      })));
      await doc.fonts.ready;
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    };
    printFrame.srcdoc = documentHtml;
  };

  // -------------------------------------------------------------
  // SIGNED COPY UPLOAD ACTION
  // -------------------------------------------------------------
  const handleFileSelectForSigned = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 15 * 1024 * 1024 || !file.size) {
      setSignedFile(null); setSignedFileName('');
      alert('Choose a PDF, JPG or PNG up to 15 MB.'); return;
    }
    setSignedFile(file); setSignedFileName(file.name);
  };

  const handleOpenSignedCopy = async (form: GeneratedForm, download = false) => {
    if (!form.signed_file_url) return;
    const popup = download ? null : window.open('about:blank', '_blank');
    if (popup) { popup.opener = null; popup.document.title = 'Signed Form'; popup.document.body.textContent = 'Opening signed form…'; }
    try {
      const token = localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token') || '';
      if (!token) throw new Error('Please sign in to view the signed form.');
      const key = form.id + ':' + (form.signed_at || '');
      const cached = signedCopyCache.current.get(key);
      let url = cached?.token === token ? cached.url : '';
      if (!url) {
        const res = await fetch(form.signed_file_url, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
        if (!res.ok) throw new Error('Could not open the signed copy. Please retry.');
        url = cacheSignedCopy(form, await res.blob(), token);
      }
      if (download) {
        const link = document.createElement('a'); link.href = url;
        link.download = form.signed_file_name || 'Signed_Form'; document.body.appendChild(link);
        link.click(); link.remove();
      } else if (popup) { popup.location.href = url; }
      else { throw new Error('Please allow this document to open in a new tab.'); }
    } catch (error: any) { popup?.close(); alert(error.message); }
  };

  const handleUploadSignedSubmit = async () => {
    if (!formForSignedUpload || !signedFile) {
      alert('Please choose a signed scan document (PDF or Image).');
      return;
    }

    setIsUploadingSigned(true);
    try {
      const upload = new FormData();
      upload.append('form_id', formForSignedUpload.id);
      upload.append('file', signedFile);
      upload.append('notes', signedNotes);
      const token = localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token');
      const res = await fetch('/api/erp/forms/upload-signed', {
        method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {}, body: upload,
      });

      if (res.ok) {
        const data = await res.json();
        cacheSignedCopy(data.form, signedFile, token || '');
        setGeneratedForms((prev) =>
          prev.map((f) => (f.id === formForSignedUpload.id ? data.form : f))
        );
        if (generatedResult?.id === formForSignedUpload.id) {
          setGeneratedResult(data.form);
        }
        if (selectedFormForView?.id === data.form.id) setSelectedFormForView(data.form);
        setIsUploadSignedModalOpen(false);
        setFormForSignedUpload(null);
        setSignedFileName('');
        setSignedFile(null);
        setSignedNotes('');
      } else {
        const err = await res.json();
        alert(`Failed to save signed copy: ${err.error}`);
      }
    } catch (err: any) {
      alert(`Error uploading signed copy: ${err.message}`);
    } finally {
      setIsUploadingSigned(false);
    }
  };

  // -------------------------------------------------------------
  // VOID / ARCHIVE FORM (Non-destructive: snapshot, signed copy & audit preserved)
  // -------------------------------------------------------------
  const handleOpenVoidModal = (form: GeneratedForm) => {
    setFormForVoid(form);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleVoidFormSubmit = async () => {
    if (!formForVoid) return;
    if (!voidReason.trim()) {
      alert('Please provide a mandatory reason for voiding and archiving this document.');
      return;
    }

    setIsVoiding(true);
    try {
      const res = await fetch(`/api/erp/forms/generated/${formForVoid.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        // Update local state in place: preserves record in history with VOID status
        setGeneratedForms((prev) =>
          prev.map((f) => (f.id === data.form.id ? data.form : f))
        );
        if (selectedFormForView?.id === data.form.id) {
          setSelectedFormForView(data.form);
        }
        if (generatedResult?.id === data.form.id) {
          setGeneratedResult(data.form);
        }
        setIsVoidModalOpen(false);
        setFormForVoid(null);
        setVoidReason('');
      } else {
        const err = await res.json();
        alert(`Failed to void form: ${err.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error voiding form: ${err.message}`);
    } finally {
      setIsVoiding(false);
    }
  };

  // -------------------------------------------------------------
  // FILTERED GENERATED FORMS
  // -------------------------------------------------------------
  const filteredForms = useMemo(() => {
    return generatedForms.filter((f) => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      // Duplicate forms are soft-voided for audit, then hidden from the normal list.
      // Users can still find them by switching the status filter to VOID.
      if (statusFilter === 'ALL' && f.status === 'VOID' && /\bduplicate\b/i.test(f.void_reason || '')) return false;
      if (branchFilter !== 'ALL' && f.issuance_branch !== branchFilter) return false;
      if (listSearch) {
        const q = listSearch.toLowerCase();
        const matchesNumber = f.form_number?.toLowerCase().includes(q);
        const matchesEmpName = f.employee_name?.toLowerCase().includes(q);
        const matchesEmpCode = f.employee_code?.toLowerCase().includes(q);
        const matchesTmpl = f.template_name?.toLowerCase().includes(q);
        const matchesBranch = f.issuance_branch?.toLowerCase().includes(q);
        return matchesNumber || matchesEmpName || matchesEmpCode || matchesTmpl || matchesBranch;
      }
      return true;
    });
  }, [generatedForms, statusFilter, branchFilter, listSearch]);

  // Quick insert placeholder into template editor
  const insertPlaceholderIntoTemplate = (ph: string) => {
    if (!contentTextareaRef.current) return;
    const textarea = contentTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textToInsert = `{{${ph}}}`;
    const newContent =
      templateFormContent.substring(0, start) +
      textToInsert +
      templateFormContent.substring(end);
    setTemplateFormContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 50);
  };

  // Save Template Type
  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/erp/forms/template-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: typeFormId || undefined,
          code: typeFormCode,
          name: typeFormName,
          category: typeFormCategory,
          color: typeFormColor,
          description: typeFormDesc,
          is_active: typeFormActive,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeFormId) {
          setTemplateTypes((prev) =>
            prev.map((t) => (t.id === typeFormId ? data.templateType : t))
          );
        } else {
          setTemplateTypes((prev) => [data.templateType, ...prev]);
        }
        setIsTypeModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving template type:', err);
    }
  };

  // Save Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/erp/forms/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: templateFormId || undefined,
          name: templateFormName,
          template_type: templateFormType,
          category: templateFormCategory,
          description: templateFormDesc,
          content: templateFormContent,
          is_active: templateFormActive,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (templateFormId) {
          setTemplates((prev) =>
            prev.map((t) => (t.id === templateFormId ? data.template : t))
          );
        } else {
          setTemplates((prev) => [data.template, ...prev]);
        }
        setIsTemplateModalOpen(false);
      }
    } catch (err) {
      console.error('Error saving template:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ========================================================= */}
      {/* TOP HEADER & SECTION NAVIGATION */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              Operations Office Forms Hub
            </span>
            <span className="text-xs text-slate-400">• High-Fidelity Auto-Fill Engine</span>
          </div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">
            Office Forms &amp; Undertakings
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single streamlined operational workflow: Select Employee → Choose Issuance Branch → Pick Template → Auto-Fill → Generate &amp; Print.
          </p>
        </div>

        {/* 4 Child Module Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setSubView('create')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              subView === 'create'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>Create Employee Forms</span>
          </button>

          <button
            onClick={() => setSubView('list')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              subView === 'list'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FolderKanban className="w-3.5 h-3.5" />
            <span>Employee Forms</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-[10px]">
              {generatedForms.length}
            </span>
          </button>

          <button
            onClick={() => setSubView('template_types')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              subView === 'template_types'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Form Template Types</span>
          </button>

          <button
            onClick={() => setSubView('templates')}
            className={`px-3 py-2 rounded-lg flex items-center gap-2 whitespace-nowrap transition-all ${
              subView === 'templates'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Form Templates</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBVIEW 1: CREATE EMPLOYEE FORMS (RouteMate Reference Layout) */}
      {/* Top selection: EMPLOYEE | LETTER ISSUANCE BRANCH | TEMPLATE */}
      {/* ========================================================= */}
      {subView === 'create' && (
        <div className="space-y-5">
          {/* Card: Create Form for User */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FilePlus className="w-5 h-5 text-emerald-600" />
                  Create Form for User
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select employee, issuance branch, and template. Form auto-fills instantly with full enterprise snapshot.
                </p>
              </div>

              {resolvedContext && (
                <div className="hidden sm:flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-bold text-emerald-600">Auto-Fill Ready</span>
                </div>
              )}
            </div>

            {/* TOP SELECTION ROW: 4 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. EMPLOYEE SELECTOR */}
              <div className="relative">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Employee *
                </label>

                <div
                  onClick={() => setIsEmployeeDropdownOpen(!isEmployeeDropdownOpen)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer flex items-center justify-between text-xs hover:border-blue-500 transition-colors"
                >
                  <div className="truncate">
                    {currentEmployee ? (
                      <span className="font-bold text-slate-900 dark:text-white">
                        [{currentEmployee.employee_code}] {currentEmployee.full_name}
                      </span>
                    ) : (
                      <span className="text-slate-400">Select an employee...</span>
                    )}
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isEmployeeDropdownOpen ? 'rotate-90' : ''
                    }`}
                  />
                </div>

                {/* Dropdown Menu with Live Backend Search */}
                {isEmployeeDropdownOpen && (
                  <div className="absolute z-30 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-80 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          autoFocus
                          placeholder="Search Name, Code, EID, Passport, Mobile, Rider ID..."
                          value={employeeSearchTerm}
                          onChange={(e) => {
                            ++previewRequestId.current;
                            setEmployeeSearchTerm(e.target.value);
                            setSearchedEmployees([]);
                            setSelectedEmployeeId('');
                            setSelectedEmployeeObj(null);
                            setGeneratedResult(null);
                            setRenderedPreviewHtml('');
                            setResolvedContext(null);
                          }}
                          className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                        {isSearchingEmployees && (
                          <RefreshCw className="w-3 h-3 absolute right-2.5 top-2.5 text-blue-500 animate-spin" />
                        )}
                      </div>
                    </div>

                    <div className="overflow-y-auto p-1 text-xs divide-y divide-slate-50 dark:divide-slate-800/50">
                      {filteredEmployees.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs">
                          {employeeSearchTerm.trim().length < 3 ? 'Type at least 3 characters to search employees.' : isSearchingEmployees ? 'Searching live directory...' : 'No matching employees found.'}
                        </div>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <div
                            key={emp.id}
                            onClick={() => {
                              setSelectedEmployeeId(emp.id);
                              setSelectedEmployeeObj(emp);
                              setEmployees((prev) => {
                                if (prev.some((e) => e.id === emp.id)) return prev;
                                return [emp, ...prev];
                              });
                              setIsEmployeeDropdownOpen(false);
                            }}
                            className={`p-2.5 rounded-lg cursor-pointer flex flex-col gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors ${
                              selectedEmployeeId === emp.id ? 'bg-blue-50/80 dark:bg-blue-950/60 font-bold' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-slate-900 dark:text-white font-bold">
                                {emp.full_name}
                              </span>
                              <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                                {emp.employee_code}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                              <span>Project: <b>{emp.current_project_name || emp.project_name || 'General Operations'}</b></span>
                              {emp.external_rider_id && (
                                <>
                                  <span>•</span>
                                  <span>Rider ID: <b className="text-slate-700 dark:text-slate-300">{emp.external_rider_id}</b></span>
                                </>
                              )}
                              {emp.emirates_id && (
                                <>
                                  <span>•</span>
                                  <span>EID: {emp.emirates_id}</span>
                                </>
                              )}
                              {emp.passport_number && (
                                <>
                                  <span>•</span>
                                  <span>Pass: {emp.passport_number}</span>
                                </>
                              )}
                              {emp.mobile_number && (
                                <>
                                  <span>•</span>
                                  <span>Mob: {emp.mobile_number}</span>
                                </>
                              )}
                              {(emp.assigned_vehicle_plate || emp.current_bike_plate) && (
                                <>
                                  <span>•</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    Bike: {emp.assigned_vehicle_plate || emp.current_bike_plate}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. LETTER ISSUANCE BRANCH */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  Letter Issuance Branch *
                </label>
                <select
                  value={selectedBranchName}
                  onChange={(e) => setSelectedBranchName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Controls document header only; employee master assignment remains unchanged.
                </p>
              </div>

              {/* 3. TEMPLATE SELECTOR */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-600" />
                  Template *
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {templates
                    .filter((t) => t.is_active !== false)
                    .map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({tmpl.category})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  {currentTemplate?.description || 'Select legal undertaking or official letter template.'}
                </p>
              </div>

              {/* 4. ISSUE DATE */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Issue Date *
                </label>
                <input
                  type="date"
                  value={selectedIssueDate}
                  onChange={(e) => setSelectedIssueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Auto-fills as document Issue Date (selected/current date).
                </p>
              </div>
            </div>


            {/* QUICK EMPLOYEE CONTEXT SUMMARY CHIPS */}
            {resolvedContext && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
                <span className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">
                  Auto-Filled Snapshot:
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium">
                  Name: <b>{resolvedContext.employee_name || '—'}</b>
                </span>
                {resolvedContext.arabic_name && resolvedContext.arabic_name !== '—' && resolvedContext.arabic_name !== 'N/A' && (
                  <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-medium" dir="rtl">
                    الاسم: <b>{resolvedContext.arabic_name}</b>
                  </span>
                )}
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  Company Mobile: <b>{resolvedContext.mobile_number || resolvedContext.company_mobile || '—'}</b>
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  Passport: <b>{resolvedContext.passport_number || '—'}</b>
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  EID: <b>{resolvedContext.emirates_id || '—'}</b>
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  Assigned Bike:{' '}
                  <b className={!resolvedContext.current_bike || resolvedContext.current_bike === '—' || resolvedContext.current_bike === 'No Bike Assigned' ? 'text-amber-600' : 'text-emerald-600 font-bold'}>
                    {resolvedContext.current_bike && resolvedContext.current_bike !== 'No Bike Assigned' ? resolvedContext.current_bike : '—'}
                  </b>
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  Project: <b>{resolvedContext.project && resolvedContext.project !== 'Unassigned' ? resolvedContext.project : '—'}</b>
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  Issue Date: <b>{resolvedContext.date || selectedIssueDate}</b>
                </span>
              </div>
            )}
          </div>

          {/* ======================================================= */}
          {/* LIVE LETTERHEAD PREVIEW & ACTIONS */}
          {/* ======================================================= */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Live Rendered Document Preview
                </h3>
                {isResolving && (
                  <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                )}
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreenPreview(!fullscreenPreview)}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  {fullscreenPreview ? (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" /> Collapse
                    </>
                  ) : (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" /> Fullscreen View
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(renderedPreviewHtml, currentTemplate?.name)}
                  disabled={!renderedPreviewHtml}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  Print / Export PDF
                </button>

                <button
                  type="button"
                  onClick={handleGenerateForm}
                  disabled={isGenerating || !selectedEmployeeId || !selectedTemplateId || Boolean(previewError) || !renderedPreviewHtml}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-2 transition-colors"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Generate Form
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Generated Success Toast Banner */}
            {generatedResult && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                      Successfully Generated {generatedResult.form_number}
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      Immutable record snapshot created for {generatedResult.employee_name} ({generatedResult.employee_code}). Historical copies will never alter.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSignedFile(null); setSignedFileName(''); setSignedNotes('');
                      setFormForSignedUpload(generatedResult);
                      setIsUploadSignedModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Signed Copy
                  </button>
                  <button
                    onClick={() => setGeneratedResult(null)}
                    className="text-emerald-700 hover:text-emerald-900 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* HIGH FIDELITY LETTERHEAD CANVAS */}
            <div
              className={`bg-slate-100 dark:bg-slate-950 p-2 sm:p-6 rounded-xl overflow-auto flex justify-center items-start transition-all ${
                fullscreenPreview ? 'fixed inset-0 z-50 px-2 sm:px-8 pt-16 pb-4 bg-slate-900/90 backdrop-blur-sm' : ''
              }`}
            >
              {fullscreenPreview && (
                <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
                  <button
                    onClick={() => handlePrint(renderedPreviewHtml, currentTemplate?.name)}
                    disabled={!renderedPreviewHtml}
                    className="px-4 py-2 bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" /> Print PDF
                  </button>
                  <button
                    onClick={() => setFullscreenPreview(false)}
                    className="p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl shadow-md"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="w-full min-w-0 bg-white text-slate-900 rounded-sm relative" style={{ maxWidth: OFFICE_FORM_WIDTH }}>
                {previewError ? (
                  <div className="py-24 text-center max-w-lg mx-auto">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-50 text-rose-600 mb-4 border border-rose-200 shadow-xs">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h4 className="text-base font-black text-slate-900 mb-2">Unable to Generate Document</h4>
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-bold text-sm">
                      {previewError}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      {previewError.includes('No SIM is currently assigned')
                        ? 'This employee has no active SIM assigned. Undertaking generation is strictly disallowed until a SIM is assigned.'
                        : 'Please resolve the requirement above before generating the document.'}
                    </p>
                  </div>
                ) : renderedPreviewHtml ? (
                  <div className="w-full min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-500 px-3 py-3 text-white rounded-t-lg">
                      <span className="text-xs font-bold">{currentTemplate?.name}</span>
                      <button type="button" onClick={() => handlePrint(renderedPreviewHtml, currentTemplate?.name)} className="flex items-center gap-1.5 text-xs font-bold disabled:opacity-50">
                        <Printer className="w-4 h-4" /> Print / Save PDF
                      </button>
                    </div>
                    <OfficeFormPage content={renderedPreviewHtml} title={currentTemplate?.name || 'Employee Form'} />
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-400">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold">Select an Employee and Template to view auto-filled letterhead.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 2: EMPLOYEE FORMS (LISTING VIEW) */}
      {/* ========================================================= */}
      {subView === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-blue-600" />
                Employee Forms Archive
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Search, print, view immutable snapshots, and attach signed scans.
              </p>
            </div>

            <button
              onClick={() => setSubView('create')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Create New Form
            </button>
          </div>

          {/* FILTERS & SEARCH */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Form Number, Employee Code, Name, Template, Branch..."
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="ALL">All Statuses</option>
                <option value="GENERATED">Generated (Unsigned)</option>
                <option value="SIGNED">Signed Copy Attached</option>
                <option value="VOID">Void / Archived</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="ALL">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TABLE */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Form Number</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Template Name</th>
                  <th className="p-3">Issuance Branch</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredForms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No employee forms match the current search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredForms.map((form) => (
                    <tr
                      key={form.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        form.status === 'VOID' ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {form.form_number}
                      </td>
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {form.generated_at ? form.generated_at.split('T')[0] : '—'}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {form.employee_name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {form.employee_code}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                        {form.template_name}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">
                        {form.issuance_branch}
                      </td>
                      <td className="p-3">
                        {form.status === 'VOID' ? (
                          <span
                            title={`Voided by ${form.voided_by || 'Admin'}: ${form.void_reason || 'No reason specified'}`}
                            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 flex items-center gap-1 w-fit"
                          >
                            <Ban className="w-3 h-3" /> VOID
                          </span>
                        ) : form.status === 'SIGNED' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1 w-fit">
                            <FileSignature className="w-3 h-3" /> Signed
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3" /> Generated
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedFormForView(form);
                              setIsViewModalOpen(true);
                            }}
                            title="View Document Snapshot"
                            className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handlePrint(form.rendered_content, form.form_title || form.form_number)}
                            title="Print Form"
                            className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {form.status !== 'VOID' && (
                            <button
                              onClick={() => {
                                setSignedFile(null); setSignedFileName(''); setSignedNotes('');
                                setFormForSignedUpload(form);
                                setIsUploadSignedModalOpen(true);
                              }}
                              title="Upload Signed Copy"
                              className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <Upload className="w-4 h-4" /><span className="text-[10px] font-bold ml-1">Upload Signed</span>
                            </button>
                          )}

                          {form.signed_file_url && (
                            <button
                              type="button"
                              onClick={() => handleOpenSignedCopy(form)}
                              title="View Uploaded Signed Form"
                              aria-label={'View signed form for ' + form.employee_name}
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 rounded-lg hover:bg-emerald-50 flex items-center gap-1"
                            >
                              <Eye className="w-4 h-4" /><span className="text-[10px] font-bold">Signed</span>
                            </button>
                          )}

                          {form.status !== 'VOID' ? (
                            <button
                              onClick={() => handleOpenVoidModal(form)}
                              title="Void / Archive Form (Audited & Non-destructive)"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          ) : (
                            <span
                              title={`Voided: ${form.void_reason || 'Archived'}`}
                              className="p-1.5 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                            >
                              <Ban className="w-4 h-4 opacity-40" />
                            </span>
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
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 3: FORM TEMPLATE TYPES */}
      {/* ========================================================= */}
      {subView === 'template_types' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                Form Template Types
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage high-level template categories, compliance classifications, and operational groupings.
              </p>
            </div>

            <button
              onClick={() => {
                setTypeFormId(null);
                setTypeFormCode('');
                setTypeFormName('');
                setTypeFormCategory('HR');
                setTypeFormColor('#2563eb');
                setTypeFormDesc('');
                setTypeFormActive(true);
                setIsTypeModalOpen(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Template Type
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templateTypes.map((type) => (
              <div
                key={type.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2 relative group"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white uppercase tracking-wider"
                    style={{ backgroundColor: type.color || '#2563eb' }}
                  >
                    {type.code}
                  </span>
                  <button
                    onClick={() => {
                      setTypeFormId(type.id);
                      setTypeFormCode(type.code);
                      setTypeFormName(type.name);
                      setTypeFormCategory(type.category);
                      setTypeFormColor(type.color);
                      setTypeFormDesc(type.description);
                      setTypeFormActive(type.is_active);
                      setIsTypeModalOpen(true);
                    }}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {type.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {type.description}
                </p>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Category: <b>{type.category}</b></span>
                  <span className={type.is_active ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                    {type.is_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SUBVIEW 4: FORM TEMPLATES */}
      {/* ========================================================= */}
      {subView === 'templates' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Form Templates Library
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Letterhead formats with exact legal clauses and dynamic <code>{'{{placeholder}}'}</code> tags.
              </p>
            </div>

            <button
              onClick={() => {
                setTemplateFormId(null);
                setTemplateFormName('Bike Undertaking');
                setTemplateFormType('BIKE_UNDERTAKING');
                setTemplateFormCategory('FLEET');
                setTemplateFormDesc('Forms Number: LT0016 - Allied Delivery Services official Bike Undertaking for food/grocery delivery vehicle handover.');
                setTemplateFormContent(`
<div class="bike-undertaking-document" style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px 24px; color: #000000; background: #ffffff; box-sizing: border-box;">
  <!-- HEADER -->
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-bottom: 22px;">
    <tr>
      <td style="width: 32%; border: 1px solid #000000; padding: 12px 10px; text-align: center; vertical-align: middle;">
        {{company_logo_html}}
      </td>
      <td style="width: 68%; border: 1px solid #000000; padding: 12px 16px; text-align: center; vertical-align: middle;">
        <div style="font-size: 19px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; color: #000000; letter-spacing: 0.5px;">Bike Undertaking</div>
        <div style="font-size: 14.5px; font-weight: bold; margin-bottom: 3px; color: #000000;">Pixel Syntax Delivery Software</div>
        <div style="font-size: 13px; font-weight: normal; margin-bottom: 3px; color: #000000;">Dubai</div>
        <div style="font-size: 12.5px; font-weight: bold; color: #000000;">Forms Number: LT0016</div>
      </td>
    </tr>
  </table>

  <!-- EMPLOYEE INFORMATION TABLE -->
  <table style="width: 100%; border-collapse: collapse; border: 1px solid #000000; margin-bottom: 24px;">
    <tr>
      <td style="width: 28%; border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Name:</td>
      <td style="width: 72%; border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000; font-weight: 600;">{{employee_name}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Company Mbl:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000;">{{mobile_number}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Passport Num:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000;">{{passport_number}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">EID Number:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000;">{{emirates_id}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Bike Number:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000; font-weight: bold;">{{current_bike}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Project:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000;">{{project}}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-weight: bold; font-size: 13px; color: #000000;">Issue Date:</td>
      <td style="border: 1px solid #000000; padding: 8px 12px; font-size: 13px; color: #000000;">{{date}}</td>
    </tr>
  </table>

  <!-- DECLARATION -->
  <div style="margin: 24px 0 32px 0; font-size: 13.5px; line-height: 1.8; color: #000000; text-align: justify;">
    <p style="margin: 0;">
      I am writing to confirm that I am utilizing the assigned Bike <strong>{{current_bike}}</strong>, strictly for food/grocery delivery purposes. I fully understand the importance of adhering to the designated purpose for this vehicle, and I assure you that it will not be used for any other activities outside of this scope.
    </p>
  </div>

  <!-- BOTTOM -->
  <div style="margin-top: 48px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="width: 50%; vertical-align: top; padding-right: 30px;">
          <div style="font-weight: bold; font-size: 14px; color: #000000; margin-bottom: 70px;">
            Employee Sign
          </div>
          <div style="border-bottom: 1.5px solid #000000; width: 85%;"></div>
        </td>
        <td style="width: 50%; vertical-align: top; padding-left: 30px;">
          <div style="font-weight: bold; font-size: 14px; color: #000000; margin-bottom: 12px;">
            Employee Thumb
          </div>
          <div style="width: 110px; height: 125px; border: 1.5px dashed #475569; border-radius: 4px; display: flex; align-items: center; justify-content: center; text-align: center; color: #64748b; font-size: 11px; padding: 6px; box-sizing: border-box;">
            Right Thumb Impression
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
                `.trim());
                setTemplateFormActive(true);
                setTemplateModalPreviewTab('editor');
                setIsTemplateModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Form Template
            </button>
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {tmpl.category} • {tmpl.template_type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">v{tmpl.version || 1}</span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {tmpl.name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {tmpl.description}
                  </p>

                  {/* Placeholders preview */}
                  {tmpl.placeholders && tmpl.placeholders.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {tmpl.placeholders.slice(0, 5).map((ph) => (
                        <span
                          key={ph}
                          className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-mono"
                        >
                          {`{{${ph}}}`}
                        </span>
                      ))}
                      {tmpl.placeholders.length > 5 && (
                        <span className="text-[10px] text-slate-400 font-mono self-center">
                          +{tmpl.placeholders.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setSelectedTemplateId(tmpl.id);
                      setSubView('create');
                    }}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <FilePlus className="w-3.5 h-3.5" /> Use in Form
                  </button>

                  <button
                    onClick={() => {
                      setTemplateFormId(tmpl.id);
                      setTemplateFormName(tmpl.name);
                      setTemplateFormType(tmpl.template_type);
                      setTemplateFormCategory(tmpl.category);
                      setTemplateFormDesc(tmpl.description);
                      setTemplateFormContent(tmpl.content);
                      setTemplateFormActive(tmpl.is_active !== false);
                      setTemplateModalPreviewTab('editor');
                      setIsTemplateModalOpen(true);
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: VIEW IMMUTABLE FORM SNAPSHOT */}
      {/* ========================================================= */}
      {selectedFormForView && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => {
            setIsViewModalOpen(false);
            setSelectedFormForView(null);
          }}
          title={`Document Snapshot: ${selectedFormForView.form_number} — ${selectedFormForView.employee_name}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-800 dark:text-white block">
                  {selectedFormForView.template_name}
                </span>
                <span className="text-slate-400">
                  Issued by: {selectedFormForView.issuance_branch} • Date: {selectedFormForView.generated_at?.split('T')[0]}
                </span>
              </div>
              <Badge variant={selectedFormForView.status === 'VOID' ? 'danger' : selectedFormForView.status === 'SIGNED' ? 'success' : 'info'}>
                {selectedFormForView.status}
              </Badge>
            </div>

            {selectedFormForView.status === 'VOID' && (
              <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl space-y-1 text-xs">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black uppercase tracking-wider text-[11px]">
                  <Ban className="w-4 h-4 text-rose-600" />
                  <span>Voided &amp; Archived Office Form</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  <b>Reason:</b> {selectedFormForView.void_reason || 'Administrative void'}
                </p>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-rose-200/60 dark:border-rose-800/60 flex items-center justify-between">
                  <span>Voided by: <b>{selectedFormForView.voided_by || 'Admin'}</b></span>
                  <span>{selectedFormForView.voided_at ? new Date(selectedFormForView.voided_at).toLocaleString() : ''}</span>
                </div>
              </div>
            )}

            {selectedFormForView.signed_file_url && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4" /> Signed Copy Attached: {selectedFormForView.signed_file_name || 'Signed_Scan.pdf'}
                </span>
                <div className="flex gap-3">
                  <button type="button" onClick={() => handleOpenSignedCopy(selectedFormForView)} className="text-emerald-700 font-bold">View</button>
                  <button type="button" onClick={() => handleOpenSignedCopy(selectedFormForView, true)} className="text-emerald-700 font-bold">Download</button>
                </div>
              </div>
            )}

            <OfficeFormPage content={selectedFormForView.rendered_content} title={selectedFormForView.form_title || selectedFormForView.form_number} />

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Generated by {selectedFormForView.generated_by}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handlePrint(selectedFormForView.rendered_content, selectedFormForView.form_number)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print Document
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: UPLOAD SIGNED DOCUMENT COPY */}
      {/* ========================================================= */}
      {formForSignedUpload && (
        <Modal
          isOpen={isUploadSignedModalOpen}
          onClose={() => {
            setIsUploadSignedModalOpen(false);
            setFormForSignedUpload(null);
          }}
          title={`Upload Signed Copy: ${formForSignedUpload.form_number}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Attach the physically signed scan or PDF for employee <b>{formForSignedUpload.employee_name}</b> ({formForSignedUpload.employee_code}).
            </p>

            <div className="p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center space-y-3 bg-slate-50 dark:bg-slate-800/50">
              <Upload className="w-8 h-8 mx-auto text-emerald-600" />
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-200">
                  {signedFileName ? signedFileName : 'Choose signed document scan (PDF, PNG, JPG)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Supports high-resolution scans up to 15MB</p>
              </div>

              <label className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors">
                Browse Files
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileSelectForSigned}
                  className="hidden"
                />
              </label>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Archival Notes (Optional)
              </label>
              <textarea
                value={signedNotes}
                onChange={(e) => setSignedNotes(e.target.value)}
                placeholder="e.g. Physical signed copy stored in Branch HR binder..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsUploadSignedModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUploadSignedSubmit}
                disabled={!signedFile || isUploadingSigned}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                {isUploadingSigned ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Confirm &amp; Attach
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD/EDIT TEMPLATE TYPE */}
      {/* ========================================================= */}
      <Modal
        isOpen={isTypeModalOpen}
        onClose={() => setIsTypeModalOpen(false)}
        title={typeFormId ? 'Edit Form Template Type' : 'Add New Template Type'}
      >
        <form onSubmit={handleSaveType} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Type Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. FLEET_UNDERTAKING"
                value={typeFormCode}
                onChange={(e) => setTypeFormCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl uppercase font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Display Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Fleet Undertakings"
                value={typeFormName}
                onChange={(e) => setTypeFormName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={typeFormCategory}
                onChange={(e) => setTypeFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="HR">HR</option>
                <option value="FLEET">FLEET</option>
                <option value="TELECOM">TELECOM</option>
                <option value="LEGAL">LEGAL</option>
                <option value="ASSETS">ASSETS</option>
                <option value="GENERAL">GENERAL</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Badge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={typeFormColor}
                  onChange={(e) => setTypeFormColor(e.target.value)}
                  className="w-8 h-8 rounded border-none cursor-pointer"
                />
                <input
                  type="text"
                  value={typeFormColor}
                  onChange={(e) => setTypeFormColor(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              value={typeFormDesc}
              onChange={(e) => setTypeFormDesc(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              placeholder="What types of documents belong in this category?"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="typeActive"
              checked={typeFormActive}
              onChange={(e) => setTypeFormActive(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="typeActive" className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Active Template Type
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTypeModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold"
            >
              Save Type
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 4: ADD/EDIT FORM TEMPLATE WITH PLACEHOLDER INJECTOR */}
      {/* ========================================================= */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={templateFormId ? 'Edit Form Template' : 'Add New Form Template'}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={templateFormName}
                onChange={(e) => setTemplateFormName(e.target.value)}
                placeholder="e.g. SIM Card Handover & Compliance"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Category
              </label>
              <select
                value={templateFormCategory}
                onChange={(e) => setTemplateFormCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
              >
                <option value="HR">HR</option>
                <option value="FLEET">FLEET</option>
                <option value="TELECOM">TELECOM</option>
                <option value="LEGAL">LEGAL</option>
                <option value="ASSETS">ASSETS</option>
                <option value="GENERAL">GENERAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <input
              type="text"
              value={templateFormDesc}
              onChange={(e) => setTemplateFormDesc(e.target.value)}
              placeholder="Short description of purpose..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* QUICK INSERT PLACEHOLDER TAGS */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <span className="font-bold text-[11px] text-slate-500 uppercase tracking-wider block">
              Quick Insert Placeholders (Click to insert into template):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'employee_name',
                'employee_code',
                'emirates_id',
                'passport_number',
                'passport_expiry',
                'mobile_number',
                'designation',
                'salary',
                'nationality',
                'joining_date',
                'current_bike',
                'current_sim',
                'project',
                'branch',
                'company_name',
                'date',
                'reference_no',
              ].map((ph) => (
                <button
                  type="button"
                  key={ph}
                  onClick={() => insertPlaceholderIntoTemplate(ph)}
                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-300 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold transition-colors"
                >
                  + {`{{${ph}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* CONTENT EDITOR OR PREVIEW */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                HTML Content Template *
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setTemplateModalPreviewTab('editor')}
                  className={`px-2 py-0.5 rounded font-bold ${
                    templateModalPreviewTab === 'editor'
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                      : 'text-slate-400'
                  }`}
                >
                  HTML Code
                </button>
                <button
                  type="button"
                  onClick={() => setTemplateModalPreviewTab('preview')}
                  className={`px-2 py-0.5 rounded font-bold ${
                    templateModalPreviewTab === 'preview'
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
                      : 'text-slate-400'
                  }`}
                >
                  Live Preview
                </button>
              </div>
            </div>

            {templateModalPreviewTab === 'editor' ? (
              <textarea
                ref={contentTextareaRef}
                required
                rows={10}
                value={templateFormContent}
                onChange={(e) => setTemplateFormContent(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 rounded-xl border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            ) : (
              <div
                className="p-4 bg-white text-slate-900 rounded-xl border border-slate-300 max-h-60 overflow-y-auto text-xs"
                dangerouslySetInnerHTML={{ __html: templateFormContent }}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTemplateModalOpen(false)}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold"
            >
              Save Template
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* MODAL 5: VOID / ARCHIVE OFFICE FORM */}
      {/* Never physically delete: retains snapshot, signed copy, audit */}
      {/* ========================================================= */}
      {formForVoid && (
        <Modal
          isOpen={isVoidModalOpen}
          onClose={() => {
            setIsVoidModalOpen(false);
            setFormForVoid(null);
            setVoidReason('');
          }}
          title={/\bduplicate\b/i.test(voidReason)
            ? `Remove Duplicate Form: ${formForVoid.form_number}`
            : `Void & Archive Form: ${formForVoid.form_number}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" /> Non-Destructive Archival Policy
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                Under enterprise document compliance rules, issued forms are never deleted. Voiding will update the status to <b>VOID</b>, permanently record your reason, authenticated actor credentials, and timestamp, while keeping the generated snapshot and any signed copy intact in history.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 text-slate-700 dark:text-slate-300">
              <div>Employee: <b>{formForVoid.employee_name}</b> ({formForVoid.employee_code})</div>
              <div>Form Title: <b>{formForVoid.form_title}</b></div>
              <div>Branch: <b>{formForVoid.issuance_branch}</b></div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Reason for Voiding * (Mandatory for universal audit trail)
              </label>
              <textarea
                required
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Duplicate — form generated twice"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Enter “Duplicate” to remove this form from the normal list. It will remain in the VOID archive for audit.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={isVoiding}
                onClick={() => {
                  setIsVoidModalOpen(false);
                  setFormForVoid(null);
                  setVoidReason('');
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-slate-600 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || isVoiding}
                onClick={handleVoidFormSubmit}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center gap-1.5"
              >
                {isVoiding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {/\bduplicate\b/i.test(voidReason) ? 'Remove Duplicate Form' : 'Confirm Void & Archive'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
