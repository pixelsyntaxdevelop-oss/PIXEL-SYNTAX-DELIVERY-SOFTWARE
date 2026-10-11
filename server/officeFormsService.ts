/**
 * Authoritative Office Forms Service
 * Shared between Cloudflare Worker (worker.ts) and Express backend (server/formRoutes.ts).
 * 
 * Reuses existing authoritative employee normalizers and search services:
 * - searchAuthoritativeEmployees
 * - normalizeEmployeeRecord
 * - normalizeEmployeeName
 * - AUTHORITATIVE_MASTER_EMPLOYEES
 */

import {
  normalizeEmployeeName,
  normalizeEmployeeRecord,
  AUTHORITATIVE_MASTER_EMPLOYEES,
} from './authoritativeEmployees';
import { searchAuthoritativeEmployees } from './globalEmployeeSearchService';
import {
  DEPOSIT_TRUST_REFERENCE_DEFAULTS,
  initialFormTemplateTypes,
  initialFormTemplates,
  initialGeneratedForms,
  sanitizeTemplateHtml,
  FormTemplateTypeRecord,
  FormTemplateRecord,
  GeneratedFormRecord,
} from './officeFormsTemplates';

export interface OfficeFormsEmployeeRecord {
  id: string;
  employee_code: string;
  full_name: string;
  name_display: string;
  display_name: string;
  arabic_name: string;
  first_name: string;
  last_name: string;
  emirates_id: string;
  emirates_id_number: string;
  passport_number: string;
  mobile_number: string;
  personal_mobile: string;
  company_mobile: string;
  project_name: string;
  current_project_name: string;
  current_bike_plate: string;
  bike_number: string;
  current_sim_number: string;
  branch: string;
  branch_name: string;
  designation: string;
  status: string;
  current_status: string;
  external_rider_id: string;
  rider_id: string;
  is_archived: boolean;
  tenant_id: string;
  [key: string]: any;
}

export interface OfficeFormsBranchRecord {
  id: string;
  name: string;
  code: string;
  emirate?: string;
}

export const AUTHORITATIVE_OFFICE_BRANCHES: OfficeFormsBranchRecord[] = [
  { id: 'b_dxb', name: 'Dubai Head Office & Logistics Center', code: 'DXB-HQ', emirate: 'Dubai' },
  { id: 'b_auh', name: 'Abu Dhabi Operations Branch', code: 'AUH-OPS', emirate: 'Abu Dhabi' },
  { id: 'b_shj', name: 'Sharjah Logistics Branch', code: 'SHJ-LOG', emirate: 'Sharjah' },
  { id: 'b_ajm', name: 'Ajman Distribution Center', code: 'AJM-DIST', emirate: 'Ajman' },
];

export function cleanDisplayString(val?: string | null): string {
  if (!val || val === 'null' || val === 'undefined' || val === 'N/A' || val === 'None' || val === 'Unassigned') {
    return '—';
  }
  return String(val).trim();
}

/**
 * Resolves vehicle, SIM, project, passport, mobile, Arabic name, etc.
 * for an employee from available DB context or record itself.
 */
export function resolveEmployeeAssignments(emp: any, dbContext: any = {}) {
  // 1. Resolve Assigned Vehicle Plate
  let vehiclePlate = '';
  let vehicleDetails: any = null;

  if (emp.current_bike_plate && emp.current_bike_plate !== 'None' && emp.current_bike_plate !== 'Not Assigned') {
    vehiclePlate = emp.current_bike_plate;
  } else if (emp.assigned_vehicle_plate && emp.assigned_vehicle_plate !== 'None' && emp.assigned_vehicle_plate !== 'Not Assigned') {
    vehiclePlate = emp.assigned_vehicle_plate;
  } else if (emp.bike_number && emp.bike_number !== 'None' && emp.bike_number !== 'Not Assigned') {
    vehiclePlate = emp.bike_number;
  } else if (emp.vehicle_plate && emp.vehicle_plate !== 'None' && emp.vehicle_plate !== 'Not Assigned') {
    vehiclePlate = emp.vehicle_plate;
  }

  if (!vehiclePlate && dbContext.fleetAssignments && Array.isArray(dbContext.fleetAssignments)) {
    const activeAssignment = dbContext.fleetAssignments.find(
      (fa: any) =>
        (fa.employee_id === emp.id ||
          fa.rider_id === emp.id ||
          fa.employee_code === emp.employee_code ||
          fa.employee_id === emp.employee_id) &&
        (fa.assignment_status === 'ACTIVE' ||
          fa.assignment_status === 'Active' ||
          fa.status === 'ACTIVE' ||
          fa.status === 'Active' ||
          fa.status === 'ASSIGNED')
    );
    if (activeAssignment) {
      vehiclePlate =
        activeAssignment.plate_number ||
        activeAssignment.vehicle_plate ||
        activeAssignment.vehicle_id ||
        activeAssignment.registration_number ||
        '';
    }
  }

  if (!vehiclePlate && dbContext.fleetVehicles && Array.isArray(dbContext.fleetVehicles)) {
    const assignedVeh = dbContext.fleetVehicles.find(
      (v: any) =>
        v.assigned_employee_id === emp.id ||
        v.assigned_rider_id === emp.id ||
        v.assigned_employee_code === emp.employee_code ||
        v.assigned_to_id === emp.id
    );
    if (assignedVeh) {
      vehiclePlate = assignedVeh.plate_number || assignedVeh.plate || assignedVeh.registration_number || '';
      vehicleDetails = assignedVeh;
    }
  }

  if (
    !vehiclePlate ||
    vehiclePlate === 'None' ||
    vehiclePlate === 'Not Assigned' ||
    vehiclePlate === 'null' ||
    vehiclePlate === 'undefined'
  ) {
    vehiclePlate = 'No Bike Assigned';
  } else {
    vehiclePlate = vehiclePlate.trim();
  }

  // 2. Resolve Assigned SIM
  let simNumber = emp.current_sim_number || emp.assigned_sim_number || emp.sim_number || '';
  let simDetails: any = null;

  if (!simNumber && dbContext.simAssignments && Array.isArray(dbContext.simAssignments)) {
    const activeAsgn = dbContext.simAssignments.find(
      (a: any) =>
        (a.employee_id === emp.id || a.employee_code === emp.employee_code) &&
        (a.status === 'ACTIVE' || a.status === 'Active' || a.status === 'Assigned')
    );
    if (activeAsgn) {
      simNumber = activeAsgn.sim_number || activeAsgn.mobile_number || activeAsgn.phone_number || '';
    }
  }

  if (!simNumber && dbContext.simCardsMaster && Array.isArray(dbContext.simCardsMaster)) {
    const masterSim = dbContext.simCardsMaster.find(
      (s: any) =>
        (s.current_employee_id === emp.id || s.current_employee_code === emp.employee_code) &&
        (s.assignment_status === 'Assigned' || s.status === 'Assigned' || s.assignment_status === 'ACTIVE')
    );
    if (masterSim) {
      simNumber = masterSim.mobile_number || masterSim.sim_number || '';
      simDetails = masterSim;
    }
  }

  if (!simNumber || simNumber === 'None' || simNumber === 'Not Assigned') {
    simNumber = 'Not Assigned';
  }

  // 3. Resolve Project
  let projectName =
    emp.project_name ||
    emp.current_project_name ||
    emp.project ||
    '';

  if (!projectName && dbContext.employeeProjectAssignments && Array.isArray(dbContext.employeeProjectAssignments)) {
    const activeProj = dbContext.employeeProjectAssignments.find(
      (a: any) =>
        (a.employee_id === emp.id || a.employee_code === emp.employee_code) &&
        (a.status === 'ACTIVE' || a.status === 'Active')
    );
    if (activeProj) {
      projectName = activeProj.project_name || activeProj.name || '';
    }
  }

  if (!projectName || projectName === 'Unassigned / Depot Pool' || projectName === 'None') {
    projectName = 'Unassigned';
  }

  // 4. Resolve Passport
  let passportNumber = emp.passport_number || emp.passport_no || emp.passport || '';
  if (!passportNumber && dbContext.passportCustody && Array.isArray(dbContext.passportCustody)) {
    const pc = dbContext.passportCustody.find(
      (p: any) =>
        (p.employee_id === emp.id || p.employee_code === emp.employee_code || (emp.emirates_id && p.emirates_id === emp.emirates_id)) &&
        p.passport_number
    );
    if (pc) {
      passportNumber = pc.passport_number;
    }
  }
  if (!passportNumber || passportNumber === 'P0000000' || passportNumber === 'N/A' || passportNumber === 'None') {
    passportNumber = 'Not Available';
  } else {
    passportNumber = passportNumber.trim();
  }

  // 5. Resolve Arabic Name
  const arabicName = (emp.arabic_name || emp.name_ar || emp.arabicName || emp.full_name_ar || '').trim();

  // 6. Resolve Full Name & Display Name
  const fullName = normalizeEmployeeName(emp.first_name, emp.last_name, emp.full_name || emp.name || emp.display_name) || 'Unnamed Employee';
  const nameDisplay = arabicName ? `${fullName} / ${arabicName}` : fullName;

  // 7. Resolve Mobile
  const companyMobile = (emp.company_mobile || emp.mobile_number || emp.personal_mobile || emp.mobile || 'Not Available').trim();

  // 8. Resolve Emirates ID
  const emiratesId = (emp.emirates_id || emp.emirates_id_number || 'Not Available').trim();

  return {
    vehiclePlate,
    simNumber,
    projectName,
    passportNumber,
    arabicName,
    fullName,
    nameDisplay,
    companyMobile,
    emiratesId,
    vehicleDetails,
    simDetails,
  };
}

/**
 * Searches authoritative employees for Office Forms:
 * - Same authoritative source as Employee Management
 * - Searches case-insensitively and partially across:
 *   - First Name
 *   - Last Name
 *   - Full Name / Display Name
 *   - Employee Code
 *   - Emirates ID (and extracted digits)
 *   - Mobile Number (and extracted digits)
 *   - Passport Number
 * - Empty query returns available employees (not empty)
 * - Includes all statuses (Active, Inactive, On Leave, On Hold, Terminated, Exited)
 * - Returns normalized and complete employee objects for form autofill
 */
export function searchOfficeFormsEmployees(
  rawEmployees: any[],
  options: {
    query?: string;
    tenantId?: string;
    limit?: number;
    dbContext?: any;
  }
): OfficeFormsEmployeeRecord[] {
  const tenantId = options.tenantId || 'company_pixel_syntax';
  const query = (options.query || '').trim();
  const limit = options.limit && options.limit > 0 ? options.limit : 100;

  // Search only records supplied by Employee Management. Never inject seed employees.
  const employeesPool: any[] = [];
  const seen = new Set<string>();
  for (const employee of Array.isArray(rawEmployees) ? rawEmployees : []) {
    if (employee.tenant_id && employee.tenant_id !== tenantId) continue;
    // Employee Management's stable ID is the identity. A placeholder Emirates ID
    // can be shared by many new hires before their real card is issued; treating
    // that value as a duplicate hides valid employees from the form picker.
    const key = employee.id
      ? 'id:' + String(employee.id).toLowerCase()
      : employee.employee_code ? 'code:' + String(employee.employee_code).trim().toLowerCase() : '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    employeesPool.push({ ...employee });
  }
  const dbStub = { ...(options.dbContext || {}), masterEmployees: employeesPool };

  const matched = searchAuthoritativeEmployees(dbStub, {
    query,
    tenantId,
    limit,
    includeArchived: true, // Active, cancelled and other real Employee Management statuses
    includeSeedEmployees: false,
  });

  return matched.map((e: any) => {
    const norm = normalizeEmployeeRecord(e);
    const assignments = resolveEmployeeAssignments(norm, dbStub);

    return {
      ...norm,
      id: norm.id || norm.employee_id,
      employee_code: norm.employee_code || norm.id,
      full_name: assignments.fullName,
      name_display: assignments.nameDisplay,
      display_name: assignments.nameDisplay,
      arabic_name: assignments.arabicName,
      first_name: norm.first_name || '',
      last_name: norm.last_name || '',
      emirates_id: assignments.emiratesId,
      emirates_id_number: assignments.emiratesId,
      passport_number: assignments.passportNumber,
      mobile_number: assignments.companyMobile,
      personal_mobile: norm.personal_mobile || norm.mobile_number || '',
      company_mobile: assignments.companyMobile,
      project_name: assignments.projectName,
      current_project_name: assignments.projectName,
      current_bike_plate: assignments.vehiclePlate,
      bike_number: assignments.vehiclePlate,
      current_sim_number: assignments.simNumber,
      branch: norm.branch || norm.branch_name || 'Dubai Head Office & Logistics Center',
      branch_name: norm.branch_name || norm.branch || 'Dubai Head Office & Logistics Center',
      designation: norm.designation || 'Delivery Captain',
      status: norm.current_status || norm.status || 'Active',
      current_status: norm.current_status || norm.status || 'Active',
      external_rider_id: norm.external_rider_id || norm.rider_id || '',
      rider_id: norm.external_rider_id || norm.rider_id || '',
      is_archived: Boolean(norm.is_archived),
      tenant_id: norm.tenant_id || tenantId,
    };
  });
}

/**
 * Returns branches list for Office Forms
 */
export function getOfficeFormsBranches(tenantId: string = 'company_pixel_syntax'): OfficeFormsBranchRecord[] {
  return AUTHORITATIVE_OFFICE_BRANCHES;
}

/**
 * Resolves Company Logo HTML
 */
export function resolveCompanyLogoHtml(tenantId: string = 'company_pixel_syntax'): string {
  return '<img src="/allied-logo-original.png" alt="Pixel Syntax Delivery Software" style="display: block; width: 125px; max-width: 100%; height: auto; max-height: 78px; object-fit: contain; margin: 0 auto;" />';
}

/**
 * Live HTML Template Preview Renderer
 */

/** Use the user-approved reference particulars when no per-form override is supplied. */
export function normalizeOfficeFormDepositFields(fields: Record<string, any>): Record<string, string> {
  const amount = String(fields.deposit_amount || DEPOSIT_TRUST_REFERENCE_DEFAULTS.deposit_amount).trim();
  if (amount && (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0)) {
    throw new Error('Enter a valid positive AED deposit amount.');
  }
  return Object.fromEntries(['deposit_address', 'creditor_name', 'creditor_emirates_id', 'deposit_amount'].map(key => [
    key, (String(fields[key] || '').trim() || DEPOSIT_TRUST_REFERENCE_DEFAULTS[key as keyof typeof DEPOSIT_TRUST_REFERENCE_DEFAULTS]).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char] || char)),
  ]));
}

export function renderOfficeFormPreview(params: {
  templateId: string;
  employeeId?: string;
  employeeObj?: any;
  employeesList: any[];
  tenantId?: string;
  issuanceBranch?: string;
  issueDate?: string;
  customPlaceholders?: Record<string, any>;
  tenantName?: string;
  dbContext?: any;
}) {
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const tId = params.templateId;
  const eId = params.employeeId;

  if (!tId) {
    throw new Error('Template ID is required for rendering.');
  }

  // Find template
  const template = (initialFormTemplates || []).find((t: any) =>
    (t.id === tId ||
      (tId === 'tmpl_deposit_form' && t.id === 'tmpl_deposit_trust') ||
      (tId === 'tmpl_deposit_trust' && t.id === 'tmpl_deposit_form') ||
      (tId === 'tmpl_asset_handover' && t.id === 'tmpl_asset_acknowledgment') ||
      (tId === 'tmpl_asset_acknowledgment' && t.id === 'tmpl_asset_handover')) &&
    (t.tenant_id === tenantId || t.tenant_id === 'company_pixel_syntax')
  );

  if (!template) {
    throw new Error(`Template ${tId} not found.`);
  }

  // A supplied directory is authoritative, including an empty directory.
  const selectedId = eId || params.employeeObj?.id || params.employeeObj?.employee_code;
  let emp = params.employeeObj;
  if (Array.isArray(params.employeesList)) {
    emp = params.employeesList.find((e: any) =>
      (e.id === selectedId || e.employee_id === selectedId || e.employee_code === selectedId) &&
      (!e.tenant_id || e.tenant_id === tenantId)
    );
  }

  if (!emp) {
    throw new Error(`Employee ${eId || 'unknown'} not found.`);
  }

  const normalizedEmp = normalizeEmployeeRecord(emp);
  const assignments = resolveEmployeeAssignments(normalizedEmp, params.dbContext || {});

  const tenantName = params.tenantName || 'Pixel Syntax Delivery Software';
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const isEmploymentAgreement = tId === 'tmpl_employment_agreement';
  const refNo = `PREV-${Date.now().toString().slice(-4)}`;
  const branchVal = params.issuanceBranch || normalizedEmp.branch || 'Dubai Head Office & Logistics Center';
  const empIdentifier = normalizedEmp.emirates_id || normalizedEmp.emirates_id_number || normalizedEmp.passport_number || normalizedEmp.employee_code || '';

  const customP = { ...(params.customPlaceholders || {}) };
  if (tId === 'tmpl_deposit_trust' || tId === 'tmpl_deposit_form') {
    Object.assign(customP, normalizeOfficeFormDepositFields({ ...customP, deposit_address: customP.deposit_address || normalizedEmp.address || DEPOSIT_TRUST_REFERENCE_DEFAULTS.deposit_address }));
  }
  const rawIssueDate = params.issueDate || customP.issue_date || customP.date;
  let issueDateFormatted = today;
  if (rawIssueDate) {
    try {
      const d = new Date(rawIssueDate);
      if (!isNaN(d.getTime())) {
        issueDateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } else {
        issueDateFormatted = String(rawIssueDate);
      }
    } catch {
      issueDateFormatted = String(rawIssueDate);
    }
  }

  const bikeIssueDate = tId === 'tmpl_bike_undertaking' && /^\d{4}-\d{2}-\d{2}$/.test(String(rawIssueDate || ''))
    ? String(rawIssueDate)
    : issueDateFormatted;
  const logoSvgHtml = resolveCompanyLogoHtml(tenantId);
  const bikeClean = cleanDisplayString(assignments.vehiclePlate);
  const projectClean = cleanDisplayString(assignments.projectName);
  const mobileClean = cleanDisplayString(assignments.companyMobile);
  const passportClean = cleanDisplayString(assignments.passportNumber);
  const eidClean = cleanDisplayString(assignments.emiratesId);
  const nameClean = tId === 'tmpl_bike_undertaking' && assignments.arabicName
    ? `${assignments.fullName} - ${assignments.arabicName}`
    : (assignments.nameDisplay || assignments.fullName || '—');

  // Build placeholder replacement dictionary
  const values: Record<string, string> = {
    EmployeeName: nameClean,
    employee_name: nameClean,
    employee_full_name: assignments.fullName || nameClean,
    arabic_name: assignments.arabicName || ((tId === 'tmpl_deposit_trust' || tId === 'tmpl_deposit_form') ? assignments.fullName : ''),
    EmployeeCode: normalizedEmp.employee_code || normalizedEmp.id,
    employee_code: normalizedEmp.employee_code || normalizedEmp.id,
    EmployeeID: normalizedEmp.employee_code || normalizedEmp.id,
    employee_id: normalizedEmp.employee_code || normalizedEmp.id,
    EmiratesID: eidClean,
    emirates_id: eidClean,
    eid_number: eidClean,
    employee_identifier: empIdentifier,
    EmployeeIdentifier: empIdentifier,
    PassportNumber: passportClean,
    passport_number: passportClean,
    passport_num: passportClean,
    PassportExpiry: isEmploymentAgreement ? (normalizedEmp.passport_expiry || '—') : (normalizedEmp.passport_expiry || '2028-12-31'),
    passport_expiry: isEmploymentAgreement ? (normalizedEmp.passport_expiry || '—') : (normalizedEmp.passport_expiry || '2028-12-31'),
    MobileNumber: mobileClean,
    mobile_number: mobileClean,
    company_mobile: mobileClean,
    company_mbl: mobileClean,
    mobile: mobileClean,
    Designation: isEmploymentAgreement ? (normalizedEmp.designation || normalizedEmp.job_title || '—') : (normalizedEmp.designation || 'Delivery Captain'),
    designation: isEmploymentAgreement ? (normalizedEmp.designation || normalizedEmp.job_title || '—') : (normalizedEmp.designation || 'Delivery Captain'),
    Salary: String(normalizedEmp.basic_salary || 3500),
    salary: String(normalizedEmp.basic_salary || 3500),
    basic_salary: String(normalizedEmp.basic_salary || 3500),
    gross_salary: String(normalizedEmp.basic_salary || 3500),
    Nationality: isEmploymentAgreement ? (normalizedEmp.nationality || '—') : (normalizedEmp.nationality || 'United Arab Emirates'),
    nationality: isEmploymentAgreement ? (normalizedEmp.nationality || '—') : (normalizedEmp.nationality || 'United Arab Emirates'),
    JoiningDate: isEmploymentAgreement ? (normalizedEmp.joining_date || 'To be completed before signing') : (normalizedEmp.joining_date || '2025-01-01'),
    joining_date: isEmploymentAgreement ? (normalizedEmp.joining_date || 'To be completed before signing') : (normalizedEmp.joining_date || '2025-01-01'),
    AssignedVehiclePlateNo: bikeClean,
    current_bike: bikeClean,
    bike_number: bikeClean,
    vehicle_plate: bikeClean,
    AssignedSimNumber: assignments.simNumber,
    current_sim: assignments.simNumber,
    sim_number: assignments.simNumber,
    AssignedProject: projectClean,
    project: projectClean,
    project_name: projectClean,
    IssuanceBranch: branchVal,
    branch: branchVal,
    branch_name: branchVal,
    CompanyName: tenantName,
    company_name: tenantName,
    Date: bikeIssueDate,
    date: bikeIssueDate,
    today: today,
    issue_date: bikeIssueDate,
    ReferenceNo: refNo,
    reference_no: refNo,
    company_logo_html: logoSvgHtml,
    ...customP,
  };

  let rendered = template.content;
  for (const [key, val] of Object.entries(values)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
    rendered = rendered.replace(regex, String(val));
  }
  rendered = rendered.replace(/\[BIKE NUMBER\]/gi, bikeClean);
  rendered = rendered.replace(/\[DATE\]/gi, issueDateFormatted);

  const sanitizedRendered = sanitizeTemplateHtml(rendered);

  return {
    template,
    employee: {
      id: normalizedEmp.id,
      name: assignments.fullName,
      code: normalizedEmp.employee_code,
      project: projectClean,
      bike: bikeClean,
      sim: assignments.simNumber,
      arabic_name: assignments.arabicName,
      company_mobile: mobileClean,
      emirates_id: eidClean,
      passport_number: passportClean,
    },
    populatedValues: values,
    context: values,
    renderedHtml: sanitizedRendered,
    rendered_html: sanitizedRendered,
  };
}

/**
 * Generate Office Form Record
 */
export function generateOfficeFormRecord(params: {
  templateId: string;
  employeeId?: string;
  employeeObj?: any;
  employeesList: any[];
  tenantId?: string;
  issuanceBranch?: string;
  issueDate?: string;
  customPlaceholders?: Record<string, any>;
  userId?: string;
  userName?: string;
  tenantName?: string;
  dbContext?: any;
}): GeneratedFormRecord {
  const preview = renderOfficeFormPreview(params);
  const tenantId = params.tenantId || 'company_pixel_syntax';
  const serialNo = Math.floor(1000 + Math.random() * 9000);
  const formNumber = `OF-2026-${serialNo}`;
  const now = new Date().toISOString();

  return {
    id: `form_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    tenant_id: tenantId,
    form_number: formNumber,
    document_serial: `DOC-${serialNo}`,
    form_title: preview.template.name,
    template_id: preview.template.id,
    template_name: preview.template.name,
    template_type: preview.template.template_type,
    category: preview.template.category,
    template_version: preview.template.version,
    employee_id: preview.employee.id,
    employee_name: preview.employee.name,
    employee_code: preview.employee.code,
    emirates_id: preview.employee.emirates_id,
    passport_number: preview.employee.passport_number,
    vehicle_plate: preview.employee.bike,
    sim_number: preview.employee.sim,
    project_name: preview.employee.project,
    issuance_branch: params.issuanceBranch || 'Dubai Head Office & Logistics Center',
    rendered_content: preview.rendered_html,
    snapshot_data: preview.populatedValues,
    status: 'GENERATED',
    created_at: now,
    updated_at: now,
    generated_at: now,
    generated_by: params.userName || 'Authorized Signatory',
    generated_by_id: params.userId || 'admin',
    generated_by_name: params.userName || 'Authorized Signatory',
  };
}


// Persist the rendered snapshot, not a live template reference, so saved forms remain reproducible.
export function savedOfficeForm(row: any): any {
  return { ...row, template_id: row.template_id || row.snapshot_data?._template_id,
    generated_at: row.created_at, generated_by: row.created_by,
    generated_by_id: row.created_by_id, generated_by_name: row.created_by,
    signed_file_name: row.snapshot_data?._signed_copy?.file_name,
    signed_at: row.signed_file_uploaded_at };
}

export async function listSavedOfficeForms(db: any, tenantId: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('office_generated_forms').select('*')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).order('id')
      .range(offset, offset + 999);
    if (error) throw new Error('Could not load saved employee forms. Please retry.');
    rows.push(...(data || []).map(savedOfficeForm));
    if (!data || data.length < 1000) return rows;
  }
}

export async function saveOfficeForm(db: any, form: any, user: { userId: string; role?: string }): Promise<any> {
  const { data: template, error: templateError } = await db.from('office_form_templates')
    .select('id').eq('id', form.template_id).eq('tenant_id', form.tenant_id).maybeSingle();
  if (templateError) throw new Error('Could not save employee form. Please retry.');
  const { updated_at, generated_at, generated_by, generated_by_id, generated_by_name, ...fields } = form;
  const row = { ...fields, template_id: template?.id || null,
    snapshot_data: { ...form.snapshot_data, _template_id: form.template_id },
    created_by: generated_by, created_by_id: user.userId, created_by_role: user.role || null };
  const { data, error } = await db.from('office_generated_forms').insert(row).select('*').single();
  if (error || !data) throw new Error('Could not save employee form. Nothing was saved; please retry.');
  return savedOfficeForm(data);
}


export async function attachSignedOfficeForm(db: any, bucket: any, params: {
  tenantId: string; formId: string; userId: string; file: File; objectId: string; notes?: string;
}): Promise<any> {
  const { data: existing, error: lookupError } = await db.from('office_generated_forms').select('id,status,snapshot_data,signed_file_uploaded_at')
    .eq('id', params.formId).eq('tenant_id', params.tenantId).maybeSingle();
  if (lookupError) throw new Error('Could not load the saved form.');
  if (!existing) throw new Error('Saved form not found for this company.');
  if (existing.status === 'VOID' || existing.status === 'ARCHIVED') throw new Error('Archived forms cannot be changed.');
  if (!bucket) throw new Error('Document storage is unavailable. Please retry.');
  const file = params.file;
  if (!file || !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) ||
      file.size <= 0 || file.size > 15 * 1024 * 1024) {
    throw new Error('Choose a PDF, JPG or PNG up to 15 MB.');
  }
  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes).slice(0, 8);
  const valid = file.type === 'application/pdf' ? String.fromCharCode(...head.slice(0, 5)) === '%PDF-'
    : file.type === 'image/jpeg' ? head[0] === 255 && head[1] === 216 && head[2] === 255
    : [137,80,78,71,13,10,26,10].every((value, index) => head[index] === value);
  if (!valid) throw new Error('The selected file is not a valid PDF, JPG or PNG.');
  const fileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'signed-form';
  const key = 'forms/' + params.tenantId + '/' + existing.id + '/' + params.objectId + '/' + fileName;
  const copy = { storage_path: key, file_name: fileName, mime_type: file.type,
    file_size: file.size, uploaded_at: new Date().toISOString(), uploaded_by: params.userId,
    notes: (params.notes || '').slice(0, 2000) };
  await bucket.put(key, bytes, { httpMetadata: { contentType: file.type } });
  try {
    const oldCopies = existing.snapshot_data?._signed_copies || (existing.snapshot_data?._signed_copy ? [existing.snapshot_data._signed_copy] : []);
    let update = db.from('office_generated_forms').update({
      signed_file_url: '/api/erp/forms/generated/' + existing.id + '/signed-file',
      signed_file_uploaded_at: copy.uploaded_at, signed_file_uploaded_by: params.userId,
      status: 'SIGNED', snapshot_data: { ...existing.snapshot_data, _signed_copy: copy, _signed_copies: [...oldCopies, copy] },
    }).eq('id', existing.id).eq('tenant_id', params.tenantId);
    update = existing.signed_file_uploaded_at ? update.eq('signed_file_uploaded_at', existing.signed_file_uploaded_at) : update.is('signed_file_uploaded_at', null);
    const { data, error } = await update.select('*').single();
    if (error || !data) throw new Error('Could not save the signed copy. Please retry.');
    return savedOfficeForm(data);
  } catch (error) {
    await bucket.delete(key).catch(() => {});
    throw error;
  }
}

export async function readSignedOfficeForm(db: any, bucket: any, tenantId: string, formId: string): Promise<any> {
  const { data: form, error } = await db.from('office_generated_forms').select('snapshot_data')
    .eq('id', formId).eq('tenant_id', tenantId).maybeSingle();
  if (error) throw new Error('Could not load the signed copy.');
  const copy = form?.snapshot_data?._signed_copy;
  if (!copy?.storage_path || !copy.storage_path.startsWith('forms/' + tenantId + '/' + formId + '/')) return null;
  const object = bucket ? await bucket.get(copy.storage_path) : null;
  return object ? { object, copy } : null;
}

