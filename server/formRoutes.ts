import { normalizeOfficeFormDepositFields, searchOfficeFormsEmployees } from './officeFormsService';
import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { resolveAuthenticatedActor, logUniversalAudit } from './auditActorHelper';
import { getSupabaseClient } from './supabaseDb';
import { normalizeEmployeeName, normalizeEmployeeRecord } from './authoritativeEmployees';
import { searchAuthoritativeEmployees, getAuthoritativeEmployees } from './globalEmployeeSearchService';

import {
  type FormTemplateTypeRecord,
  type FormTemplateRecord,
  type GeneratedFormRecord,
  sanitizeTemplateHtml,
  initialFormTemplateTypes,
  initialFormTemplates,
  isEmployeeFormTemplate,
  initialGeneratedForms,
} from './officeFormsTemplates';

export type {
  FormTemplateTypeRecord,
  FormTemplateRecord,
  GeneratedFormRecord,
};

export {
  sanitizeTemplateHtml,
  initialFormTemplateTypes,
  initialFormTemplates,
  initialGeneratedForms,
};

export function createFormRouter(db: any, getGeminiClient?: () => GoogleGenAI) {
  const router = Router();

  if (!db.formTemplateTypes || db.formTemplateTypes.length === 0) {
    db.formTemplateTypes = [...initialFormTemplateTypes];
  }
  if (!db.formTemplates || db.formTemplates.length === 0) {
    db.formTemplates = [...initialFormTemplates];
  } else {
    // Ensure authoritative Bike Undertaking LT0016 template is present and up to date
    const bikeIdx = db.formTemplates.findIndex((t: any) => t.id === 'tmpl_bike_undertaking');
    if (bikeIdx >= 0) {
      db.formTemplates[bikeIdx] = {
        ...initialFormTemplates[0],
        ...db.formTemplates[bikeIdx],
        content: initialFormTemplates[0].content,
        version: initialFormTemplates[0].version,
        placeholders: initialFormTemplates[0].placeholders,
        description: initialFormTemplates[0].description,
      };
    } else {
      db.formTemplates.unshift(initialFormTemplates[0]);
    }
    const depositTemplate = initialFormTemplates.find((t) => t.id === 'tmpl_deposit_trust');
    if (depositTemplate) {
      const depositIdx = db.formTemplates.findIndex((t: any) => t.id === 'tmpl_deposit_trust');
      if (depositIdx >= 0) {
        db.formTemplates[depositIdx] = { ...db.formTemplates[depositIdx], content: depositTemplate.content, version: depositTemplate.version, placeholders: depositTemplate.placeholders, description: depositTemplate.description };
      } else {
        db.formTemplates.push(depositTemplate);
      }
    }
  }

  const attendanceTemplate = initialFormTemplates.find((t) => t.id === 'tmpl_attendance_leave');
  if (attendanceTemplate) {
    const idx = db.formTemplates.findIndex((t: any) => t.id === attendanceTemplate.id);
    if (idx >= 0) db.formTemplates[idx] = { ...db.formTemplates[idx], ...attendanceTemplate };
    else db.formTemplates.push(attendanceTemplate);
  }

  const commitmentTemplate = initialFormTemplates.find((t) => t.id === 'tmpl_commitment_letter');
  if (commitmentTemplate) {
    const idx = db.formTemplates.findIndex((t: any) => t.id === commitmentTemplate.id);
    if (idx >= 0) db.formTemplates[idx] = { ...db.formTemplates[idx], ...commitmentTemplate };
    else db.formTemplates.push(commitmentTemplate);
  }

  const employmentAgreement = initialFormTemplates.find((t) => t.id === 'tmpl_employment_agreement');
  if (employmentAgreement) {
    const employmentIdx = db.formTemplates.findIndex((t: any) => t.id === employmentAgreement.id);
    if (employmentIdx === -1) {
      db.formTemplates.push(employmentAgreement);
    } else if (Number(db.formTemplates[employmentIdx].version || 0) < employmentAgreement.version) {
      // Apply the versioned print-layout update once while preserving template state such as activation.
      const existing = db.formTemplates[employmentIdx];
      db.formTemplates[employmentIdx] = {
        ...existing,
        ...employmentAgreement,
        is_active: existing.is_active,
      };
    }
  }

  if (!db.generatedForms) {
    db.generatedForms = [];
  }

  function extractTenantContext(req: Request) {
    const actor = resolveAuthenticatedActor(req, db);
    const headerTenant = req.headers['x-tenant-id'] as string;
    let tenantId = headerTenant || actor.tenantId;
    if (!tenantId || tenantId === 'company_demo') {
      tenantId = 'company_pixel_syntax';
    }
    return {
      tenantId,
      userId: actor.userId,
      userRole: actor.userRole,
      userName: actor.userName,
      employeeId: actor.employeeId,
      employeeCode: actor.employeeCode,
      actor,
    };
  }

  function generateFormNumber(tenantId: string): string {
    const year = new Date().getFullYear();
    const forms = (db.generatedForms || []).filter((f: any) => f.tenant_id === tenantId);
    const count = forms.length + 1;
    return `OF-${year}-${String(count).padStart(4, '0')}`;
  }

  function getCompanyBranches(tenantId: string) {
    if (db.branches && db.branches.length > 0) {
      const bList = db.branches.filter((b: any) => b.tenant_id === tenantId || !b.tenant_id);
      if (bList.length > 0) {
        return bList.map((b: any) => ({
          id: b.id || b.branch_id,
          name: b.name || b.branch_name || b.branch,
          city: b.city || 'Dubai',
        }));
      }
    }
    return [
      { id: 'b_dxb', name: 'Dubai Head Office & Logistics Center', city: 'Dubai' },
      { id: 'b_auh', name: 'Abu Dhabi Operations Branch', city: 'Abu Dhabi' },
      { id: 'b_shj', name: 'Sharjah Distribution Center', city: 'Sharjah' },
      { id: 'b_aln', name: 'Al Ain Regional Depot', city: 'Al Ain' },
    ];
  }

  // Authoritative Live Auto-Fill Assignment Resolver for Employee Identity, Vehicle, SIM, and Project
  function resolveEmployeeAssignments(emp: any, dbContext: any) {
    if (!emp) {
      return {
        vehiclePlate: 'No Bike Assigned',
        simNumber: 'Not Assigned',
        projectName: 'Unassigned',
        passportNumber: 'Not Available',
        arabicName: '',
        fullName: 'Unnamed Employee',
        nameDisplay: 'Unnamed Employee',
        companyMobile: 'Not Available',
        emiratesId: 'Not Available',
        vehicleDetails: null,
        simDetails: null,
      };
    }

    // 1. Resolve Assigned Vehicle (Live check in emp, fleetAssignments, fleetVehicles, riders)
    let vehiclePlate = '';
    let vehicleDetails: any = null;

    if (emp.current_bike_plate && emp.current_bike_plate !== 'None' && emp.current_bike_plate !== 'Not Assigned') {
      vehiclePlate = emp.current_bike_plate;
    } else if (emp.assigned_vehicle_plate && emp.assigned_vehicle_plate !== 'None' && emp.assigned_vehicle_plate !== 'Not Assigned') {
      vehiclePlate = emp.assigned_vehicle_plate;
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

    if (!vehiclePlate && dbContext.riders && Array.isArray(dbContext.riders)) {
      const matchedRider = dbContext.riders.find(
        (r: any) => r.id === emp.id || r.employee_id === emp.id || r.employee_code === emp.employee_code
      );
      if (matchedRider) {
        vehiclePlate = matchedRider.assigned_vehicle_plate || matchedRider.assigned_bike || matchedRider.bike_plate || '';
      }
    }

    if (vehiclePlate && !vehicleDetails && dbContext.fleetVehicles && Array.isArray(dbContext.fleetVehicles)) {
      const foundV = dbContext.fleetVehicles.find(
        (v: any) => v.plate_number === vehiclePlate || v.id === vehiclePlate
      );
      if (foundV) {
        vehiclePlate = foundV.plate_number || foundV.plate || vehiclePlate;
        vehicleDetails = foundV;
      }
    }

    // Clean up plate or set strictly to 'No Bike Assigned'
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

    // 2. Resolve Assigned SIM (Live check in simAssignments, simCardsMaster, emp, simCards)
    let simNumber = emp.current_sim_number || emp.assigned_sim_number || '';
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

    if (!simNumber && dbContext.simCards && Array.isArray(dbContext.simCards)) {
      const assignedSim = dbContext.simCards.find(
        (s: any) =>
          (s.assigned_employee_id === emp.id ||
            s.assigned_employee_code === emp.employee_code ||
            s.assigned_to_id === emp.id ||
            s.assigned_to === emp.full_name) &&
          (s.status === 'Assigned' || s.status === 'ASSIGNED' || s.status === 'Active')
      );
      if (assignedSim) {
        simNumber = assignedSim.sim_number || assignedSim.phone_number || '';
        simDetails = assignedSim;
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

    if (!projectName && dbContext.riders && Array.isArray(dbContext.riders)) {
      const r = dbContext.riders.find(
        (rd: any) => rd.id === emp.id || rd.employee_id === emp.id || rd.employee_code === emp.employee_code
      );
      if (r && (r.project || r.project_name)) {
        projectName = r.project || r.project_name;
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
    if (!passportNumber && dbContext.riders && Array.isArray(dbContext.riders)) {
      const r = dbContext.riders.find(
        (rd: any) => rd.id === emp.id || rd.employee_id === emp.id || rd.employee_code === emp.employee_code
      );
      if (r && r.passport_number) {
        passportNumber = r.passport_number;
      }
    }
    if (!passportNumber || passportNumber === 'P0000000' || passportNumber === 'N/A' || passportNumber === 'None') {
      passportNumber = 'Not Available';
    } else {
      passportNumber = passportNumber.trim();
    }

    // 5. Resolve Arabic Name
    const arabicName = (emp.arabic_name || emp.name_ar || emp.arabicName || emp.full_name_ar || '').trim();

    // 6. Resolve Full Name & Name Display (Authoritative Normalized Name)
    const fullName = normalizeEmployeeName(emp.first_name, emp.last_name, emp.full_name || emp.name || emp.display_name) || 'Unnamed Employee';
    const nameDisplay = arabicName ? `${fullName} / ${arabicName}` : fullName;

    // 7. Resolve Company Mobile
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

  function findTemplate(templateId: string, tenantId: string) {
    return (db.formTemplates || []).find((t: any) =>
      (t.id === templateId ||
       (templateId === 'tmpl_deposit_form' && t.id === 'tmpl_deposit_trust') ||
       (templateId === 'tmpl_deposit_trust' && t.id === 'tmpl_deposit_form') ||
       (templateId === 'tmpl_asset_handover' && t.id === 'tmpl_asset_acknowledgment') ||
       (templateId === 'tmpl_asset_acknowledgment' && t.id === 'tmpl_asset_handover')) &&
      (t.tenant_id === tenantId || t.tenant_id === 'company_pixel_syntax')
    );
  }

  // 1. GET /api/erp/forms/template-types
  router.get('/template-types', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const list = (db.formTemplateTypes || []).filter(
        (t: any) => t.tenant_id === tenantId || t.tenant_id === 'company_pixel_syntax'
      );
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 1b. POST /api/erp/forms/template-types (Create or Update Template Type)
  router.post('/template-types', (req: Request, res: Response) => {
    try {
      const { tenantId, userId, userName } = extractTenantContext(req);
      const { id, code, name, description, category, color, is_active } = req.body;

      if (!name || !code) {
        return res.status(400).json({ error: 'Name and Code are required for Template Type.' });
      }

      if (id) {
        const existing = (db.formTemplateTypes || []).find((t: any) => t.id === id && t.tenant_id === tenantId);
        if (existing) {
          existing.name = name;
          existing.code = code.toUpperCase();
          if (description !== undefined) existing.description = description;
          if (category !== undefined) existing.category = category;
          if (color !== undefined) existing.color = color;
          if (is_active !== undefined) existing.is_active = is_active;
          existing.updated_at = new Date().toISOString();
          return res.json({ success: true, templateType: existing });
        }
      }

      const newType: FormTemplateTypeRecord = {
        id: id || `type_${Date.now()}`,
        tenant_id: tenantId,
        code: code.toUpperCase(),
        name,
        description: description || '',
        category: category || 'GENERAL',
        color: color || '#2563eb',
        is_active: is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.formTemplateTypes.unshift(newType);
      return res.status(201).json({ success: true, templateType: newType });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 1c. DELETE /api/erp/forms/template-types/:id
  router.delete('/template-types/:id', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;
      const idx = (db.formTemplateTypes || []).findIndex((t: any) => t.id === id && t.tenant_id === tenantId);
      if (idx === -1) {
        return res.status(404).json({ error: `Template type ${id} not found.` });
      }
      db.formTemplateTypes.splice(idx, 1);
      return res.json({ success: true, message: 'Template type deleted.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/erp/forms/templates
  router.get('/templates', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const list = (db.formTemplates || []).filter(
        (t: any) => isEmployeeFormTemplate(t.id) && (t.tenant_id === tenantId || t.tenant_id === 'company_pixel_syntax')
      );
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2b. POST /api/erp/forms/templates (Create or Update Template)
  router.post('/templates', (req: Request, res: Response) => {
    try {
      const { tenantId, actor } = extractTenantContext(req);
      const { id, name, template_type, description, category, content, placeholders, is_active } = req.body;

      if (!name || !content) {
        return res.status(400).json({ error: 'Template name and content are required.' });
      }

      const sanitizedContent = sanitizeTemplateHtml(content);

      if (id) {
        const existing = (db.formTemplates || []).find((t: any) => t.id === id && (t.tenant_id === tenantId || t.tenant_id === 'company_pixel_syntax'));
        if (existing) {
          existing.name = name;
          if (template_type) existing.template_type = template_type;
          if (description !== undefined) existing.description = description;
          if (category !== undefined) existing.category = category;
          existing.content = sanitizedContent;
          if (placeholders) existing.placeholders = placeholders;
          if (is_active !== undefined) existing.is_active = is_active;
          existing.version = (existing.version || 1) + 1;
          existing.updated_at = new Date().toISOString();
          existing.updated_by = actor.userName;
          existing.updated_by_id = actor.userId;
          return res.json({ success: true, template: existing });
        }
      }

      const newTmpl: FormTemplateRecord = {
        id: id || `tmpl_${Date.now()}`,
        tenant_id: tenantId,
        name,
        template_type: template_type || 'CUSTOM',
        description: description || '',
        category: category || 'GENERAL',
        content: sanitizedContent,
        placeholders: placeholders || ['employee_name', 'employee_code', 'company_name', 'date', 'reference_no'],
        version: 1,
        is_active: is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      db.formTemplates.unshift(newTmpl);
      return res.status(201).json({ success: true, template: newTmpl });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2c. DELETE /api/erp/forms/templates/:id
  router.delete('/templates/:id', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;
      const idx = (db.formTemplates || []).findIndex((t: any) => t.id === id && t.tenant_id === tenantId);
      if (idx === -1) {
        return res.status(404).json({ error: `Template ${id} not found.` });
      }
      db.formTemplates.splice(idx, 1);
      return res.json({ success: true, message: 'Template removed.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/erp/forms/branches
  router.get('/branches', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const branches = getCompanyBranches(tenantId);
      return res.json(branches);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /api/erp/forms/employees (Authoritative Quick Searchable Picker)
  router.get('/employees', (req: Request, res: Response) => {
    try {
      const { tenantId, isSuperAdmin } = extractTenantContext(req) as any;
      const search = (req.query.search || req.query.q || req.query.term || '') as string;

      const mapped = searchOfficeFormsEmployees(db.masterEmployees || [], {
        query: search, tenantId, limit: 100, dbContext: db,
      });

      return res.json(mapped);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. GET /api/erp/forms/employee-context/:employeeId
  // Single optimized endpoint resolving all assignments in one call to prevent N+1 frontend calls
  router.get('/employee-context/:employeeId', (req: Request, res: Response) => {
    try {
      const { tenantId, isSuperAdmin } = extractTenantContext(req) as any;
      const { employeeId } = req.params;

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === employeeId ||
            e.employee_id === employeeId ||
            (e.employee_code && e.employee_code.toLowerCase() === String(employeeId).toLowerCase())) &&
          (isSuperAdmin || e.tenant_id === tenantId)
      );

      if (!emp) {
        return res.status(404).json({ error: `Employee ${employeeId} not found.` });
      }

      // Live Assignments Resolution
      const assignments = resolveEmployeeAssignments(emp, db);
      const vehiclePlate = assignments.vehiclePlate;
      const vehicleDetails = assignments.vehicleDetails;
      const simNumber = assignments.simNumber;
      const simDetails = assignments.simDetails;
      const projectName = assignments.projectName;

      // Default Branch & Company Branches
      const defaultBranch = emp.branch || emp.branch_name || 'Dubai Head Office & Logistics Center';
      const companyBranches = getCompanyBranches(tenantId);
      const tenant = (db.tenants || []).find((t: any) => t.id === tenantId) || { name: 'Pixel Syntax Delivery Software' };

      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const empIdentifier = emp.emirates_id || emp.emirates_id_number || emp.passport_number || emp.employee_code || '';

      const isEmploymentAgreement = String(req.query.template_id || req.query.templateId || '') === 'tmpl_employment_agreement';

      // Build complete, normalized placeholder values dictionary
      const resolvedPlaceholders: Record<string, string> = {
        // Employee Master
        EmployeeName: emp.full_name || 'N/A',
        employee_name: emp.full_name || 'N/A',
        EmployeeCode: emp.employee_code || emp.id,
        employee_code: emp.employee_code || emp.id,
        EmployeeID: emp.employee_code || emp.id,
        employee_id: emp.employee_code || emp.id,
        EmiratesID: emp.emirates_id || emp.emirates_id_number || '784-XXXX-XXXXXXX-X',
        emirates_id: emp.emirates_id || emp.emirates_id_number || '784-XXXX-XXXXXXX-X',
        employee_identifier: empIdentifier,
        EmployeeIdentifier: empIdentifier,
        PassportNumber: emp.passport_number || 'P0000000',
        passport_number: emp.passport_number || 'P0000000',
        PassportExpiry: isEmploymentAgreement ? (emp.passport_expiry || '—') : (emp.passport_expiry || '2028-12-31'),
        passport_expiry: isEmploymentAgreement ? (emp.passport_expiry || '—') : (emp.passport_expiry || '2028-12-31'),
        MobileNumber: emp.mobile_number || emp.personal_mobile || emp.company_mobile || '0500000000',
        mobile_number: emp.mobile_number || emp.personal_mobile || emp.company_mobile || '0500000000',
        mobile: emp.mobile_number || emp.personal_mobile || emp.company_mobile || '0500000000',
        Designation: isEmploymentAgreement ? (emp.designation || emp.job_title || '—') : (emp.designation || 'Delivery Captain'),
        designation: isEmploymentAgreement ? (emp.designation || emp.job_title || '—') : (emp.designation || 'Delivery Captain'),
        Salary: String(emp.basic_salary || 3500),
        salary: String(emp.basic_salary || 3500),
        basic_salary: String(emp.basic_salary || 3500),
        gross_salary: String(emp.basic_salary || 3500),
        Nationality: isEmploymentAgreement ? (emp.nationality || '—') : (emp.nationality || 'United Arab Emirates'),
        nationality: isEmploymentAgreement ? (emp.nationality || '—') : (emp.nationality || 'United Arab Emirates'),
        JoiningDate: isEmploymentAgreement ? (emp.joining_date || 'To be completed before signing') : (emp.joining_date || '2025-01-01'),
        joining_date: isEmploymentAgreement ? (emp.joining_date || 'To be completed before signing') : (emp.joining_date || '2025-01-01'),

        // Operational Assignments
        AssignedVehiclePlateNo: vehiclePlate || 'Not Assigned',
        current_bike: vehiclePlate || 'Not Assigned',
        vehicle_plate: vehiclePlate || 'Not Assigned',
        assigned_vehicle: vehiclePlate || 'Not Assigned',

        AssignedSimNumber: simNumber || 'Not Assigned',
        current_sim: simNumber || 'Not Assigned',
        sim_number: simNumber || 'Not Assigned',
        assigned_sim: simNumber || 'Not Assigned',

        AssignedProject: projectName,
        project: projectName,
        project_name: projectName,

        // Branch & Meta
        IssuanceBranch: defaultBranch,
        branch: defaultBranch,
        branch_name: defaultBranch,

        CompanyName: tenant.name || 'Pixel Syntax Delivery Software',
        company_name: tenant.name || 'Pixel Syntax Delivery Software',

        Date: today,
        date: today,
        today: today,
        ReferenceNo: 'PREVIEW',
        reference_no: 'PREVIEW',
      };

      return res.json({
        employee: {
          id: emp.id || emp.employee_id,
          employee_code: emp.employee_code || emp.id,
          full_name: emp.full_name || 'N/A',
          emirates_id: emp.emirates_id || emp.emirates_id_number || '784-XXXX-XXXXXXX-X',
          passport_number: emp.passport_number || 'N/A',
          passport_expiry: emp.passport_expiry || '2028-12-31',
          mobile_number: emp.mobile_number || emp.personal_mobile || emp.company_mobile || 'N/A',
          email: emp.email || '',
          nationality: emp.nationality || 'N/A',
          designation: emp.designation || 'Delivery Captain',
          basic_salary: emp.basic_salary || 3500,
          joining_date: emp.joining_date || '2025-01-01',
          work_status: emp.current_status || emp.work_status || 'Active',
          branch: defaultBranch,
        },
        assigned_vehicle: {
          plate_number: vehiclePlate || null,
          is_assigned: Boolean(vehiclePlate && vehiclePlate !== 'None' && vehiclePlate !== 'Not Assigned'),
          make_model: vehicleDetails ? `${vehicleDetails.make} ${vehicleDetails.model}` : 'Standard Fleet Motorcycle',
        },
        assigned_sim: {
          sim_number: (simNumber && simNumber !== 'None' && simNumber !== 'Not Assigned') ? simNumber : null,
          is_assigned: Boolean(simNumber && simNumber !== 'None' && simNumber !== 'Not Assigned'),
          operator: simDetails?.operator || simDetails?.provider || 'Du Telecom',
        },
        assigned_project: {
          name: projectName,
          is_assigned: Boolean(projectName && projectName !== 'Unassigned'),
        },
        default_branch: defaultBranch,
        company_branches: companyBranches,
        resolved_placeholders: resolvedPlaceholders,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  function cleanDisplayString(val: any): string {
    if (val === null || val === undefined) return '—';
    const str = String(val).trim();
    if (
      !str ||
      str === '—' ||
      str === '-' ||
      str === 'None' ||
      str === 'null' ||
      str === 'undefined' ||
      str === 'Not Assigned' ||
      str === 'No Bike Assigned' ||
      str === 'Unassigned' ||
      str === 'Unassigned / Depot Pool' ||
      str === 'Not Available' ||
      str === 'N/A' ||
      str === 'P0000000'
    ) {
      return '—';
    }
    return str;
  }

  function resolveCompanyLogoHtml(tenantId: string, dbContext: any): string {
    const tenant = (dbContext.tenants || []).find((t: any) => t.id === tenantId);
    const logoUrl = tenantId === 'company_pixel_syntax'
      ? '/allied-logo-original.png'
      : (tenant?.headerLogoUrl || tenant?.logoUrl || tenant?.sidebarLogoUrl || '');
    const safeLogoUrl = String(logoUrl).trim().replace(/"/g, '&quot;');
    return safeLogoUrl
      ? `<img src="${safeLogoUrl}" alt="Company logo" style="display:block;width:125px;max-width:100%;max-height:78px;height:auto;object-fit:contain;margin:0 auto;" />`
      : '';
  }

  // 6. POST /api/erp/forms/render-preview & /resolve-preview
  const renderPreviewHandler = (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { template_id, templateId, employee_id, employeeId, issuance_branch, issuanceBranch, custom_placeholders, customPlaceholders } = req.body;

      const tId = template_id || templateId;
      const eId = employee_id || employeeId;

      if (!tId || !eId) {
        return res.status(400).json({ error: 'Template ID and Employee ID are required for rendering.' });
      }

      const template = findTemplate(tId, tenantId);
      if (!template) {
        return res.status(404).json({ error: `Template ${tId} not found.` });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === eId || e.employee_id === eId || e.employee_code === eId) &&
          e.tenant_id === tenantId
      );
      if (!emp) {
        return res.status(404).json({ error: `Employee ${eId} not found.` });
      }

      // Live Assignments Resolution
      const assignments = resolveEmployeeAssignments(emp, db);
      const vehiclePlate = assignments.vehiclePlate;
      const simNumber = assignments.simNumber;
      const projectName = assignments.projectName;

      // Validation for SIM Undertaking: Employee must have assigned SIM
      if (tId === 'tmpl_sim_undertaking' || template.template_type === 'SIM_UNDERTAKING') {
        if (!simNumber || simNumber === 'Not Assigned' || simNumber === 'None' || !simNumber.trim()) {
          return res.status(400).json({ error: 'No SIM is currently assigned to this employee.' });
        }
      }

      const tenant = (db.tenants || []).find((t: any) => t.id === tenantId) || { name: 'Pixel Syntax Delivery Software' };
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const refNo = `PREV-${Date.now().toString().slice(-4)}`;
      const branchVal = issuance_branch || issuanceBranch || emp.branch || 'Dubai Head Office & Logistics Center';
      const empIdentifier = emp.emirates_id || emp.emirates_id_number || emp.passport_number || emp.employee_code || '';

      const customP = { ...(custom_placeholders || customPlaceholders || {}) };
      if (tId === 'tmpl_deposit_trust' || tId === 'tmpl_deposit_form') {
        Object.assign(customP, normalizeOfficeFormDepositFields(customP));
      }
      const rawIssueDate = req.body.issue_date || req.body.date || customP.issue_date || customP.date;
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

      const isEmploymentAgreement = tId === 'tmpl_employment_agreement';
      const bikeIssueDate = tId === 'tmpl_bike_undertaking' && /^\d{4}-\d{2}-\d{2}$/.test(String(rawIssueDate || ''))
        ? String(rawIssueDate)
        : issueDateFormatted;
      const logoSvgHtml = resolveCompanyLogoHtml(tenantId, db);

      const bikeClean = cleanDisplayString(assignments.vehiclePlate);
      const projectClean = cleanDisplayString(assignments.projectName);
      const mobileClean = cleanDisplayString(assignments.companyMobile);
      const passportClean = cleanDisplayString(assignments.passportNumber);
      const eidClean = cleanDisplayString(assignments.emiratesId);
      const nameClean = tId === 'tmpl_bike_undertaking' && assignments.arabicName
        ? `${assignments.fullName} - ${assignments.arabicName}`
        : (assignments.nameDisplay || assignments.fullName || '—');

      // Build dictionary
      const values: Record<string, string> = {
        EmployeeName: nameClean,
        employee_name: nameClean,
        employee_full_name: assignments.fullName || nameClean,
        arabic_name: assignments.arabicName || '',
        EmployeeCode: emp.employee_code || emp.id,
        employee_code: emp.employee_code || emp.id,
        EmployeeID: emp.employee_code || emp.id,
        employee_id: emp.employee_code || emp.id,
        EmiratesID: eidClean,
        emirates_id: eidClean,
        eid_number: eidClean,
        employee_identifier: empIdentifier,
        EmployeeIdentifier: empIdentifier,
        PassportNumber: passportClean,
        passport_number: passportClean,
        passport_num: passportClean,
        PassportExpiry: emp.passport_expiry || '2028-12-31',
        passport_expiry: emp.passport_expiry || '2028-12-31',
        MobileNumber: mobileClean,
        mobile_number: mobileClean,
        company_mobile: mobileClean,
        company_mbl: mobileClean,
        mobile: mobileClean,
        Designation: emp.designation || 'Delivery Captain',
        designation: emp.designation || 'Delivery Captain',
        Salary: String(emp.basic_salary || 3500),
        salary: String(emp.basic_salary || 3500),
        basic_salary: String(emp.basic_salary || 3500),
        gross_salary: String(emp.basic_salary || 3500),
        Nationality: emp.nationality || 'United Arab Emirates',
        nationality: emp.nationality || 'United Arab Emirates',
        JoiningDate: emp.joining_date || '2025-01-01',
        joining_date: emp.joining_date || '2025-01-01',
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
        CompanyName: tenant.name || 'Pixel Syntax Delivery Software',
        company_name: tenant.name || 'Pixel Syntax Delivery Software',
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

      return res.json({
        template,
        employee: {
          id: emp.id,
          name: assignments.fullName,
          code: emp.employee_code,
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
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/render-preview', renderPreviewHandler);
  router.post('/resolve-preview', renderPreviewHandler);

  // 7. POST /api/erp/forms/generate (Save Immutable Generated Form Instance)
  router.post('/generate', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, actor } = extractTenantContext(req);
      const {
        template_id,
        templateId,
        employee_id,
        employeeId,
        issuance_branch,
        issuanceBranch,
        rendered_content,
        renderedContent,
        custom_fields,
        custom_placeholders,
        notes,
      } = req.body;

      const tId = template_id || templateId;
      const eId = employee_id || employeeId;

      const template = findTemplate(tId, tenantId);
      if (!template) {
        return res.status(404).json({ error: `Template ${tId} not found.` });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === eId || e.employee_id === eId || e.employee_code === eId) &&
          e.tenant_id === tenantId
      );
      if (!emp) {
        return res.status(404).json({ error: `Employee ${eId} not found.` });
      }

      // Live assignments resolution for immutable snapshot
      const assignments = resolveEmployeeAssignments(emp, db);
      const vehiclePlate = assignments.vehiclePlate;
      const simNumber = assignments.simNumber;
      const projectName = assignments.projectName;

      // Validation for SIM Undertaking: Employee must have assigned SIM
      if (tId === 'tmpl_sim_undertaking' || template.template_type === 'SIM_UNDERTAKING') {
        if (!simNumber || simNumber === 'Not Assigned' || simNumber === 'None' || !simNumber.trim()) {
          return res.status(400).json({ error: 'No SIM is currently assigned to this employee.' });
        }
      }

      const formNumber = generateFormNumber(tenantId);
      const now = new Date().toISOString();
      const tenant = (db.tenants || []).find((t: any) => t.id === tenantId) || { name: 'Pixel Syntax Delivery Software' };
      const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const branchVal = issuance_branch || issuanceBranch || emp.branch || 'Dubai Head Office & Logistics Center';
      const empIdentifier = emp.emirates_id || emp.emirates_id_number || emp.passport_number || emp.employee_code || '';

      const customP = { ...(custom_fields || custom_placeholders || {}) };
      if (tId === 'tmpl_deposit_trust' || tId === 'tmpl_deposit_form') {
        Object.assign(customP, normalizeOfficeFormDepositFields(customP));
      }
      const rawIssueDate = req.body.issue_date || req.body.date || customP.issue_date || customP.date;
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

      const logoSvgHtml = resolveCompanyLogoHtml(tenantId, db);

      const bikeClean = cleanDisplayString(assignments.vehiclePlate);
      const projectClean = cleanDisplayString(assignments.projectName);
      const mobileClean = cleanDisplayString(assignments.companyMobile);
      const passportClean = cleanDisplayString(assignments.passportNumber);
      const eidClean = cleanDisplayString(assignments.emiratesId);
      const nameClean = assignments.nameDisplay || assignments.fullName || '—';

      const snapshotValues: Record<string, string> = {
        EmployeeName: nameClean,
        employee_name: nameClean,
        employee_full_name: assignments.fullName || nameClean,
        arabic_name: assignments.arabicName || '',
        EmployeeCode: emp.employee_code || emp.id,
        employee_code: emp.employee_code || emp.id,
        EmployeeID: emp.employee_code || emp.id,
        employee_id: emp.employee_code || emp.id,
        EmiratesID: eidClean,
        emirates_id: eidClean,
        eid_number: eidClean,
        employee_identifier: empIdentifier,
        EmployeeIdentifier: empIdentifier,
        PassportNumber: passportClean,
        passport_number: passportClean,
        passport_num: passportClean,
        PassportExpiry: emp.passport_expiry || '2028-12-31',
        passport_expiry: emp.passport_expiry || '2028-12-31',
        MobileNumber: mobileClean,
        mobile_number: mobileClean,
        company_mobile: mobileClean,
        company_mbl: mobileClean,
        mobile: mobileClean,
        Designation: emp.designation || 'Delivery Captain',
        designation: emp.designation || 'Delivery Captain',
        Salary: String(emp.basic_salary || 3500),
        salary: String(emp.basic_salary || 3500),
        basic_salary: String(emp.basic_salary || 3500),
        gross_salary: String(emp.basic_salary || 3500),
        Nationality: emp.nationality || 'United Arab Emirates',
        nationality: emp.nationality || 'United Arab Emirates',
        JoiningDate: emp.joining_date || '2025-01-01',
        joining_date: emp.joining_date || '2025-01-01',
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
        CompanyName: tenant.name || 'Pixel Syntax Delivery Software',
        company_name: tenant.name || 'Pixel Syntax Delivery Software',
        Date: issueDateFormatted,
        date: issueDateFormatted,
        today: today,
        issue_date: issueDateFormatted,
        ReferenceNo: formNumber,
        reference_no: formNumber,
        company_logo_html: logoSvgHtml,
        ...customP,
      };

      let finalContent = rendered_content || renderedContent;
      if (!finalContent) {
        finalContent = template.content;
        for (const [key, val] of Object.entries(snapshotValues)) {
          const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
          finalContent = finalContent.replace(regex, String(val));
        }
        finalContent = finalContent.replace(/\[BIKE NUMBER\]/gi, bikeClean);
        finalContent = finalContent.replace(/\[DATE\]/gi, issueDateFormatted);
      }

      const sanitizedFinalContent = sanitizeTemplateHtml(finalContent || 'Generated form instance');

      const newForm: GeneratedFormRecord = {
        id: `gform_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenant_id: tenantId,
        form_number: formNumber,
        document_serial: formNumber,
        form_title: template.name,
        template_id: template.id,
        template_name: template.name,
        template_type: template.template_type,
        template_version: template.version || 1,
        category: template.category,
        employee_id: emp.id,
        employee_name: assignments.nameDisplay,
        employee_code: emp.employee_code,
        emirates_id: assignments.emiratesId !== 'Not Available' ? assignments.emiratesId : undefined,
        passport_number: assignments.passportNumber !== 'Not Available' ? assignments.passportNumber : undefined,
        vehicle_plate: vehiclePlate !== 'No Bike Assigned' && vehiclePlate !== 'Not Assigned' ? vehiclePlate : undefined,
        sim_number: simNumber !== 'Not Assigned' ? simNumber : undefined,
        project_name: projectName,
        issuance_branch: branchVal,
        rendered_content: sanitizedFinalContent,
        snapshot_data: snapshotValues,
        status: 'GENERATED',
        generated_by: actor.userName || userName,
        generated_by_id: actor.userId || userId,
        generated_at: now,
        notes: notes || `Generated for ${assignments.fullName}`,
      };

      db.generatedForms.unshift(newForm);

      // Add to Employee Timeline
      if (db.employeeTimelineEvents) {
        db.employeeTimelineEvents.push({
          id: `ete_${Date.now()}`,
          tenant_id: tenantId,
          employee_id: emp.id,
          event_type: 'FORM_GENERATED',
          event_category: 'DOCUMENT',
          title: `Document Generated (${formNumber})`,
          description: `${template.name} generated by ${actor.userName || userName}.`,
          performed_by: actor.userName || userName,
          performed_by_role: 'Operations / Admin',
          created_at: now,
        });
      }

      // Add Audit Log
      logUniversalAudit(db, actor, {
        action: 'GENERATE_OFFICE_FORM',
        actionType: 'CREATE',
        module: 'Office Forms',
        entityType: 'OFFICE_FORM',
        entityId: newForm.id,
        details: `Generated immutable form ${template.name} (${formNumber}) for ${emp.full_name} (${emp.employee_code}) at branch: ${branchVal}`,
        ipAddress: req.ip || '127.0.0.1',
      });

      return res.status(201).json({
        success: true,
        message: `Form ${formNumber} successfully generated for ${emp.full_name}.`,
        form: newForm,
        generated_form: newForm,
        record: newForm,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. GET /api/erp/forms/history & /generated (List all generated forms)
  const getHistoryHandler = (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { employeeId, employee_id, templateType, category, status, branch, search } = req.query;

      let list = (db.generatedForms || []).filter((f: any) => f.tenant_id === tenantId);

      const targetEmp = employeeId || employee_id;
      if (targetEmp && targetEmp !== 'ALL') {
        list = list.filter((f: any) => f.employee_id === targetEmp || f.employee_code === targetEmp);
      }
      if (templateType && templateType !== 'ALL') {
        list = list.filter((f: any) => f.template_type === templateType);
      }
      if (category && category !== 'ALL') {
        list = list.filter((f: any) => f.category === category);
      }
      if (status && status !== 'ALL') {
        list = list.filter((f: any) => f.status === status);
      }
      if (branch && branch !== 'ALL') {
        list = list.filter((f: any) => f.issuance_branch === branch);
      }
      if (search) {
        const q = (search as string).toLowerCase().trim();
        list = list.filter(
          (f: any) =>
            f.form_number?.toLowerCase().includes(q) ||
            f.employee_name?.toLowerCase().includes(q) ||
            f.employee_code?.toLowerCase().includes(q) ||
            f.template_name?.toLowerCase().includes(q) ||
            f.vehicle_plate?.toLowerCase().includes(q) ||
            f.issuance_branch?.toLowerCase().includes(q)
        );
      }

      list.sort((a: any, b: any) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.get('/history', getHistoryHandler);
  router.get('/generated', getHistoryHandler);

  // 9. GET /api/erp/forms/history/:employeeId
  router.get('/history/:employeeId', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { employeeId } = req.params;

      const list = (db.generatedForms || []).filter(
        (f: any) => f.tenant_id === tenantId && (f.employee_id === employeeId || f.employee_code === employeeId)
      );

      list.sort((a: any, b: any) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime());
      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 10. POST /api/erp/forms/generated/:id/upload-signed (Attach signed document copy)
  const uploadSignedHandler = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const { signed_file_url, signed_file_name, signed_by, notes } = req.body;

      const form = (db.generatedForms || []).find(
        (f: any) => (f.id === id || f.form_number === id) && (f.tenant_id === tenantId || f.tenant_id === 'company_pixel_syntax')
      );
      if (!form) {
        return res.status(404).json({ error: `Form ${id} not found.` });
      }

      form.status = 'SIGNED';
      form.signed_file_url = signed_file_url || 'https://images.unsplash.com/photo-1568667256549-094345857637?w=600';
      form.signed_file_name = signed_file_name || `Signed_${form.form_number}.pdf`;
      form.signed_at = new Date().toISOString();
      form.signed_by = signed_by || actor.userName || userName;
      form.signed_uploaded_by = actor.userName || userName;
      form.signed_uploaded_by_id = actor.userId || userId;
      if (notes) form.notes = `${form.notes ? form.notes + ' | ' : ''}${notes}`;

      // Add to Employee Timeline
      if (db.employeeTimelineEvents) {
        db.employeeTimelineEvents.push({
          id: `ete_${Date.now()}`,
          tenant_id: tenantId,
          employee_id: form.employee_id,
          event_type: 'DOCUMENT_SIGNED',
          event_category: 'DOCUMENT',
          title: `Signed Document Uploaded (${form.form_number})`,
          description: `Signed copy of ${form.form_title} uploaded by ${actor.userName || userName}.`,
          performed_by: actor.userName || userName,
          performed_by_role: 'Operations / Admin',
          created_at: form.signed_at,
        });
      }

      logUniversalAudit(db, actor, {
        action: 'UPLOAD_SIGNED_FORM',
        actionType: 'UPDATE',
        module: 'Office Forms',
        entityType: 'OFFICE_FORM',
        entityId: form.id,
        details: `Signed copy uploaded for ${form.form_number} (${form.employee_name}) by ${actor.userName || userName}`,
        ipAddress: req.ip || '127.0.0.1',
      });

      // Synchronize signed document metadata with Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const docId = `doc_form_${form.id}`;
          const fileId = `file_form_${form.id}`;
          const verId = `ver_form_${form.id}`;
          const storagePath = `tenant/${tenantId}/forms/${form.id}/${form.signed_file_name}`;
          await supabase.from('entity_documents').upsert({
            id: docId,
            tenant_id: tenantId,
            entity_type: 'OfficeForm',
            entity_id: form.id,
            entity_name: form.employee_name || form.form_title,
            document_type_id: 'dt_office_form',
            document_type_name: form.form_title || 'Signed Office Form',
            document_number: form.form_number,
            status: 'VALID',
            description: `Signed copy for form ${form.form_number} (${form.employee_name})`,
            current_version_id: verId,
            current_version_number: 1,
            current_file_id: fileId,
            current_file_name: form.signed_file_name,
            is_archived: false,
            created_at: form.signed_at,
            updated_at: form.signed_at,
          });
          await supabase.from('document_files').upsert({
            id: fileId,
            tenant_id: tenantId,
            document_id: docId,
            version_id: verId,
            file_name: form.signed_file_name,
            mime_type: 'application/pdf',
            file_size: 256000,
            storage_path: storagePath,
            storage_provider: 'CLOUDFLARE_R2',
            checksum: `sha256_${Date.now()}`,
            uploaded_by: actor.userName || userName,
            uploaded_at: form.signed_at,
          });
        } catch (dbErr: any) {
          console.warn('Form document register notice:', dbErr.message);
        }
      }

      return res.json({ success: true, message: `Form ${form.form_number} marked as SIGNED.`, form });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/generated/:id/upload-signed', uploadSignedHandler);
  router.post('/:id/upload-signed', uploadSignedHandler);
  router.post('/:id/sign', uploadSignedHandler);

  // 11. GET /api/erp/forms/generated/:id & /:id (Get single snapshot)
  const getSingleFormHandler = (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;

      const form = (db.generatedForms || []).find(
        (f: any) => (f.id === id || f.form_number === id) && (f.tenant_id === tenantId || f.tenant_id === 'company_pixel_syntax')
      );
      if (!form) {
        return res.status(404).json({ error: `Form ${id} not found.` });
      }

      return res.json(form);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.get('/generated/:id', getSingleFormHandler);
  router.get('/:id', getSingleFormHandler);

  // 12. VOID / ARCHIVE FORM (Never physically delete: preserves generated snapshot, signed copy & audit history)
  const voidFormHandler = (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId, actor } = extractTenantContext(req);
      const { id } = req.params;
      const { reason, void_reason, notes } = req.body || {};

      const finalReason = reason || void_reason || notes || req.query.reason;
      if (!finalReason || typeof finalReason !== 'string' || !finalReason.trim()) {
        return res.status(400).json({
          error: 'A non-empty void reason is required to void and archive an issued office form.',
        });
      }

      const form = (db.generatedForms || []).find(
        (f: any) => (f.id === id || f.form_number === id) && (f.tenant_id === tenantId || f.tenant_id === 'company_pixel_syntax')
      );
      if (!form) {
        return res.status(404).json({ error: `Form ${id} not found.` });
      }

      const now = new Date().toISOString();
      const reasonClean = finalReason.trim();

      // Soft void: keep snapshot, signed copy, and all fields completely intact
      form.status = 'VOID';
      form.void_reason = reasonClean;
      form.voided_at = now;
      form.voided_by = actor.userName || userName;
      form.voided_by_id = actor.userId || userId;

      // Add to Employee Timeline
      if (db.employeeTimelineEvents) {
        db.employeeTimelineEvents.push({
          id: `ete_${Date.now()}`,
          tenant_id: tenantId,
          employee_id: form.employee_id,
          event_type: 'FORM_VOIDED',
          event_category: 'DOCUMENT',
          title: `Document Voided (${form.form_number})`,
          description: `${form.form_title} voided by ${actor.userName || userName}. Reason: ${reasonClean}`,
          performed_by: actor.userName || userName,
          performed_by_role: 'Operations / Admin',
          created_at: now,
        });
      }

      // Add Universal Audit Log
      logUniversalAudit(db, actor, {
        action: 'VOID_OFFICE_FORM',
        actionType: 'ARCHIVE',
        module: 'Office Forms',
        entityType: 'OFFICE_FORM',
        entityId: form.id,
        details: `Voided and archived form ${form.form_number} (${form.employee_name}) by ${actor.userName || userName}. Reason: ${reasonClean}`,
        ipAddress: req.ip || '127.0.0.1',
      });

      return res.json({
        success: true,
        message: `Form ${form.form_number} has been voided and permanently archived with full audit history.`,
        form,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  // Dedicated VOID endpoints
  router.post('/generated/:id/void', voidFormHandler);
  router.post('/:id/void', voidFormHandler);

  // Deprecate hard DELETE: intercept DELETE and redirect to non-destructive void archiving
  router.delete('/generated/:id', voidFormHandler);
  router.delete('/:id', voidFormHandler);

  return router;
}
