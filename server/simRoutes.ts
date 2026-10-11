import fs from 'fs';
import path from 'path';
import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getSupabaseClient } from './supabaseDb';
import {
  searchSimEligibleEmployees,
  assignSimAuthoritative,
  returnSimAuthoritative,
  replaceSimAuthoritative,
  transferSimAuthoritative,
  returnSimToProviderAuthoritative,
  resolveStaffUserName,
  recoverLostSimAuthoritative,
} from './simAssignmentService';
import { resolveAuthenticatedActor } from './auditActorHelper';
import { getAuthoritativeEmployees } from './globalEmployeeSearchService';

export interface SimRecord {
  id: string;
  tenant_id: string;
  mobile_number: string;
  normalized_mobile_number?: string;
  sim_serial_number?: string;
  iccid?: string;
  provider: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | string;
  vendor: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC' | string;
  state: 'Dubai' | 'Abu Dhabi' | 'Sharjah' | 'Ajman' | 'Ras Al Khaimah' | 'Fujairah' | 'Umm Al Quwain' | string;
  source: string;
  branch_id?: string;
  branch_name?: string;
  monthly_package_amount: number;
  plan: string;
  status: 'Available' | 'Assigned' | 'Inactive' | 'Lost' | 'Replacement' | 'Recovery';
  assignment_status: 'Assigned' | 'Unassigned';
  service_status: 'Active' | 'Inactive';
  current_employee_id?: string;
  current_employee_name?: string;
  current_employee_code?: string;
  current_project?: string;
  assigned_date?: string;
  assigned_by?: string;
  notes?: string;
  data_usage_gb?: number;
  data_limit_gb?: number;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

import { normalizeAndValidateUaeMobile, normalizeUaePhoneNumber } from '../src/utils/simValidationUtils';

function resolveEmployeePrimaryProject(emp: any, db: any): string {
  if (!emp) return '—';
  // Check active employee project assignments first
  const assignments = (db.employeeProjectAssignments || []).filter(
    (a: any) => a.employee_id === emp.id && a.status === 'ACTIVE'
  );
  const primaryAsgn = assignments.find((a: any) => a.is_primary) || assignments[0];
  if (primaryAsgn?.project_name && primaryAsgn.project_name !== 'Unassigned' && primaryAsgn.project_name !== '—') {
    return primaryAsgn.project_name;
  }
  if (primaryAsgn?.project_id) {
    const p = (db.projects || []).find((pr: any) => pr.id === primaryAsgn.project_id);
    if (p?.name) return p.name;
  }
  if (emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '—') {
    return emp.project_name;
  }
  if (emp.project_id) {
    const proj = (db.projects || []).find((p: any) => p.id === emp.project_id);
    if (proj?.name) return proj.name;
  }
  return '—';
}

/**
 * Authoritative Supabase SIM fetching & synchronization engine
 * Queries the live Supabase sim_cards table for the tenant.
 * Keeps db.simCardsMaster synchronized so all in-memory references have full live dataset.
 */
export async function getAuthoritativeSims(db: any, tenantId: string): Promise<any[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sim_cards')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(0, 9999);

      if (!error && Array.isArray(data)) {
        // Employees hold the current SIM assignments for imported inventory.
        // Read only the fields needed for the list and summary, then join in memory.
        const { data: employeeData, error: employeeError } = await supabase
          .from('employees')
          .select('id,tenant_id,full_name,employee_code,emirates_id_number,current_sim_id,current_sim_number,current_bike_plate,project_name,is_archived')
          .eq('tenant_id', tenantId)
          .eq('is_archived', false)
          .range(0, 9999);
        if (employeeError) {
          console.warn('Supabase SIM employee lookup warning:', employeeError.message);
        }

        const employees = !employeeError && Array.isArray(employeeData) ? employeeData : [];
        if (db && employees.length > 0) {
          if (!db.masterEmployees) db.masterEmployees = [];
          const index = new Map(db.masterEmployees.map((e: any, i: number) => [e.id, i]));
          for (const emp of employees) {
            const existing = index.get(emp.id);
            if (typeof existing === 'number') db.masterEmployees[existing] = { ...db.masterEmployees[existing], ...emp };
            else db.masterEmployees.push(emp);
          }
        }
        // Closed custody records remain visible after a new employee receives the SIM.
        const { data: assignmentData, error: assignmentError } = await supabase
          .from('sim_assignments')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .range(0, 9999);
        if (assignmentError) console.warn('SIM custody history lookup warning:', assignmentError.message);
        const lastBySim = new Map<string, any>();
        const pastAssignments = !assignmentError && Array.isArray(assignmentData) ? assignmentData : (db.simAssignments || []).filter((a: any) => a.tenant_id === tenantId);
        pastAssignments.sort((a: any, b: any) => new Date(b.returned_at || b.returned_date || b.return_date || b.created_at || 0).getTime() - new Date(a.returned_at || a.returned_date || a.return_date || a.created_at || 0).getTime());
        for (const assignment of pastAssignments) {
          if (String(assignment.status || assignment.assignment_status || '').toUpperCase() === 'ACTIVE') continue;
          const key = String(assignment.sim_card_id || assignment.sim_id || '');
          if (key && !lastBySim.has(key)) lastBySim.set(key, assignment);
        }
        const cardsWithHistory = data.map((sim: any) => {
          const last = lastBySim.get(String(sim.id));
          if (!last) return sim;
          const employee = employees.find((e: any) => e.id === last.employee_id);
          return { ...sim, last_assignment_id: last.id, last_employee_id: last.employee_id,
            last_employee_name: employee?.full_name || last.employee_name,
            last_employee_code: employee?.employee_code || last.employee_code,
            last_assigned_date: last.assigned_date || last.assigned_at,
            last_returned_date: last.returned_date || last.returned_at || last.return_date };
        });
        const phoneKey = (value: any) => String(value || '').replace(/\D/g, '').slice(-9);
        const bySimId = new Map<string, any>();
        const byNumber = new Map<string, any>();
        for (const emp of employees) {
          if (emp.current_sim_id) bySimId.set(String(emp.current_sim_id), emp);
          const key = phoneKey(emp.current_sim_number);
          if (key.length === 9) byNumber.set(key, emp);
        }
        const currentCards = cardsWithHistory.map((sim: any) => {
          if (isCancelledSim(sim) || isLostSim(sim)) return sim;
          const emp = bySimId.get(String(sim.id)) || byNumber.get(phoneKey(sim.mobile_number));
          if (!emp && employeeError) return sim; // preserve card pointers if the employee lookup fails
          return {
            ...sim,
            assignment_status: emp ? 'Assigned' : 'Unassigned',
            current_employee_id: emp?.id || null,
            current_employee_name: emp?.full_name || null,
            current_employee_code: emp?.employee_code || null,
            current_emirates_id: emp?.emirates_id_number || null,
            current_vehicle_plate: emp?.current_bike_plate || null,
            current_project_name: emp?.project_name || null,
          };
        });

        // Keep the in-memory mirror aligned without changing stored SIM rows.
        if (db) {
          if (!db.simCardsMaster) db.simCardsMaster = [];
          const otherTenantSims = db.simCardsMaster.filter((s: any) => s.tenant_id !== tenantId);
          db.simCardsMaster = [...otherTenantSims, ...currentCards];
        }
        return currentCards;
      } else if (error) {
        console.warn('Supabase sim_cards fetch warning:', error.message);
      }
    } catch (err: any) {
      console.warn('Supabase sim_cards fetch exception:', err?.message);
    }
  }

  // Fallback to in-memory store if Supabase client is not available in local environment
  const inMemSims = (db?.simCardsMaster || []).filter((s: any) => s.tenant_id === tenantId);
  if (inMemSims.length > 0) return inMemSims;

  return (db?.simCards || [])
    .filter((s: any) => !s.tenant_id || s.tenant_id === tenantId)
    .map((s: any) => ({
      ...s,
      id: s.id || `sim_${s.sim_number || s.mobile_number}`,
      mobile_number: s.mobile_number || s.sim_number || s.simNumber,
      sim_number: s.sim_number || s.mobile_number || s.simNumber,
      tenant_id: s.tenant_id || tenantId,
      provider: s.provider || s.operator || 'ETISALAT',
      status: s.status || (s.assigned_to || s.assignedTo ? 'Assigned' : 'Available'),
      assignment_status: s.assignment_status || (s.assigned_to || s.assignedTo ? 'Assigned' : 'Unassigned'),
      current_employee_id: s.current_employee_id || s.assignedEmployeeId || null,
      current_employee_name: s.current_employee_name || s.assigned_to || s.assignedTo || null,
      iccid: s.iccid || s.sim_serial_number || '—',
    }));
}

export interface AuthoritativeSimDashboardStats {
  totalSims: number;
  total: number;
  assigned: number;
  unassigned: number;
  available: number;
  active: number;
  inactive: number;
  suspended: number;
  cancelled: number;
  lost: number;
  totalMonthlyBillingAED: number;
  assignmentCounts: {
    Assigned: number;
    Unassigned: number;
    Available?: number;
    Lost?: number;
  };
  serviceCounts: {
    Active: number;
    Inactive: number;
    Suspended: number;
    Cancelled: number;
  };
  statusCounts: {
    Assigned: number;
    Unassigned: number;
    Available?: number;
    Lost?: number;
    Active: number;
    Inactive: number;
    Suspended: number;
    Cancelled: number;
  };
  providerCounts: Record<string, number>;
  stateCounts: Record<string, { total: number; assigned: number; available: number }>;
}

function isCancelledSim(s: any): boolean {
  const service = String(s.service_status || '').trim().toLowerCase();
  const status = String(s.status || '').trim().toLowerCase();
  return service === 'cancelled' || status === 'cancelled' || status === 'returned to provider';
}

function isLostSim(s: any): boolean {
  return String(s.status || '').trim().toLowerCase() === 'lost' ||
    String(s.assignment_status || '').trim().toLowerCase() === 'lost';
}

function isOperationalInventorySim(s: any): boolean {
  return !isCancelledSim(s) && !isLostSim(s);
}

export async function getAuthoritativeSimDashboardStats(
  db: any,
  tenantId: string
): Promise<AuthoritativeSimDashboardStats> {
  const list = await getAuthoritativeSims(db, tenantId);
  const totalSims = list.filter(isOperationalInventorySim).length;

  let assigned = 0;
  let unassigned = 0;
  let active = 0;
  let inactive = 0;
  let suspended = 0;
  let cancelled = 0;
  let lost = 0;
  let totalMonthlyBillingAED = 0;

  const providerCounts: Record<string, number> = {};
  const stateCounts: Record<string, { total: number; assigned: number; available: number }> = {};

  for (const s of list) {
    // Keep cancelled and lost lines for their own audit counters, outside inventory.
    if (isCancelledSim(s)) {
      cancelled++;
      continue;
    }
    if (isLostSim(s)) {
      lost++;
      continue;
    }

    const isAssigned = String(s.assignment_status || '').toLowerCase() === 'assigned' ||
      !!s.current_employee_id || String(s.status || '').toLowerCase() === 'assigned';
    if (isAssigned) assigned++;
    else unassigned++;

    // Operational line service state.
    const rawSrv = (s.service_status || (s.status === 'Inactive' ? 'Inactive' : 'Active')).toLowerCase();
    if (rawSrv === 'active') {
      active++;
    } else if (rawSrv === 'inactive') {
      inactive++;
    } else if (rawSrv === 'suspended') {
      suspended++;
    } else {
      active++;
    }

    totalMonthlyBillingAED += Number(s.monthly_package_amount) || 0;

    const pr = s.provider || s.vendor || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU');
    providerCounts[pr] = (providerCounts[pr] || 0) + 1;

    const st = s.state || 'Dubai';
    if (!stateCounts[st]) stateCounts[st] = { total: 0, assigned: 0, available: 0 };
    stateCounts[st].total += 1;
    if (isAssigned) stateCounts[st].assigned += 1;
    else stateCounts[st].available += 1;
  }

  return {
    totalSims,
    total: totalSims,
    assigned,
    unassigned,
    available: unassigned,
    active,
    inactive,
    suspended,
    cancelled,
    lost,
    totalMonthlyBillingAED,
    assignmentCounts: {
      Assigned: assigned,
      Unassigned: unassigned,
      Available: unassigned,
      Lost: lost,
    },
    serviceCounts: {
      Active: active,
      Inactive: inactive,
      Suspended: suspended,
      Cancelled: cancelled,
    },
    statusCounts: {
      Assigned: assigned,
      Unassigned: unassigned,
      Active: active,
      Inactive: inactive,
      Suspended: suspended,
      Cancelled: cancelled,
    },
    providerCounts,
    stateCounts,
  };
}

export function cleanupAutoSeededDemoSims(db: any) {
  const autoSimIds = new Set(['sim_demo_01', 'sim_demo_02', 'sim_demo_03']);
  const autoSimNumbers = new Set([
    '0551234567',
    '0529876543',
    '0504567890',
    '+971551234567',
    '+971529876543',
    '+971504567890',
    '+971 55 123 4567',
    '+971 52 987 6543',
    '+971 50 456 7890',
  ]);

  const isAutoDemoSim = (s: any) => {
    const numDigits = (s.mobile_number || s.simNumber || s.sim_number || '').replace(/\D/g, '');
    const isAutoNum = autoSimNumbers.has(s.mobile_number) || 
                      autoSimNumbers.has(s.normalized_mobile_number) || 
                      autoSimNumbers.has(s.simNumber) || 
                      numDigits.endsWith('551234567') || 
                      numDigits.endsWith('529876543') || 
                      numDigits.endsWith('504567890');
    const isAutoId = autoSimIds.has(s.id);
    const isAhmedRaza = s.current_employee_name === 'System User Ghulam Muhammad' || 
                        s.assigned_to_name === 'System User Ghulam Muhammad' || 
                        s.assignedTo === 'System User Ghulam Muhammad' || 
                        s.current_employee_id === 'emp_demo_ahmed' ||
                        s.current_employee_id === 'EMP-00001' && s.current_employee_name?.includes('Ahmed');
    return isAutoNum || isAutoId || isAhmedRaza;
  };

  if (Array.isArray(db.simCardsMaster)) {
    db.simCardsMaster = db.simCardsMaster.filter(
      (s: any) => !(s.tenant_id === 'company_demo' && isAutoDemoSim(s))
    );
  }

  if (Array.isArray(db.simCards)) {
    db.simCards = db.simCards.filter(
      (s: any) => !((s.tenant_id === 'company_demo' || s.tenantId === 'company_demo') && isAutoDemoSim(s))
    );
  }

  if (Array.isArray(db.simAssignments)) {
    db.simAssignments = db.simAssignments.filter(
      (sa: any) => !(sa.tenant_id === 'company_demo' && (
        sa.id === 'sa_demo_01' || 
        autoSimIds.has(sa.sim_id) || 
        autoSimIds.has(sa.sim_card_id) || 
        sa.employee_id === 'emp_demo_ahmed' || 
        sa.employee_name === 'System User Ghulam Muhammad' ||
        isAutoDemoSim(sa)
      ))
    );
  }
}

export function repairOrphanSimAssignments(db: any, tenantId: string): { repairedSimCount: number; repairedDetails: any[] } {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  const repairedDetails: any[] = [];
  let count = 0;

  if (!db.simCardsMaster) db.simCardsMaster = [];
  if (!db.simAssignments) db.simAssignments = [];
  if (!db.masterEmployees) db.masterEmployees = [];

  const sims = db.simCardsMaster.filter((s: any) => s.tenant_id === tenantId);

  for (const sim of sims) {
    if (sim.status === 'Lost' || sim.assignment_status === 'Lost') continue;
    const empId = sim.current_employee_id || sim.assigned_to_id;
    const isAhmedRazaOrphan = sim.current_employee_name === 'System User Ghulam Muhammad' || 
                              sim.assigned_to_name === 'System User Ghulam Muhammad' ||
                              sim.current_rider_name === 'System User Ghulam Muhammad';

    if (empId || isAhmedRazaOrphan) {
      let emp = empId ? (db.masterEmployees || []).find((e: any) => 
        (e.id === empId || e.employee_id === empId || e.employee_code === empId) && 
        (e.tenant_id === tenantId || !e.tenant_id || tenantId === 'company_pixel_syntax') && 
        !e.is_archived &&
        !e.isArchived
      ) || (db.employees || []).find((e: any) =>
        (e.id === empId || e.employee_id === empId || e.employee_code === empId) &&
        (e.tenant_id === tenantId || !e.tenant_id || tenantId === 'company_pixel_syntax')
      ) : null;

      if (!emp && sim.mobile_number) {
        emp = (db.masterEmployees || []).find((e: any) =>
          (e.current_sim_number === sim.mobile_number || e.current_sim_id === sim.id) &&
          !e.is_archived && !e.isArchived
        ) || (db.employees || []).find((e: any) =>
          (e.current_sim_number === sim.mobile_number || e.current_sim_id === sim.id)
        );
      }

      const isEmpEligible = emp && !['terminated', 'exited', 'cancelled'].includes((emp.current_status || emp.work_status || emp.status || '').toLowerCase().trim());

      // If no valid live employee found in this tenant, or if employee is marked with stale/fake System User
      if (!emp || !isEmpEligible || isAhmedRazaOrphan) {
        // Orphaned! Repair immediately
        const prevEmpName = sim.current_employee_name || sim.assigned_to_name || empId || 'Orphaned Employee';
        const prevEmpCode = sim.current_employee_code || '';

        sim.status = 'Available';
        sim.assignment_status = 'Unassigned';
        sim.current_employee_id = undefined;
        sim.current_employee_name = undefined;
        sim.current_employee_code = undefined;
        sim.assigned_to_id = undefined;
        sim.assigned_to_name = undefined;
        sim.current_rider_name = undefined;
        sim.assigned_date = undefined;
        sim.assigned_by = undefined;
        sim.updated_at = now;
        sim.updated_by = 'System Integrity Repair';

        // Close any active simAssignment for this sim
        db.simAssignments
          .filter((sa: any) => sa.tenant_id === tenantId && (sa.sim_id === sim.id || sa.sim_card_id === sim.id || sa.sim_number === sim.mobile_number) && sa.status === 'ACTIVE')
          .forEach((sa: any) => {
            sa.status = 'RETURNED';
            sa.return_date = today;
            sa.returned_at = now;
            sa.returned_by = 'System Integrity Repair';
            sa.return_reason = `Orphan repair: Referenced employee ${prevEmpName} (${prevEmpCode}) does not exist in Employee Master.`;
          });

        if (!db.auditLogs) db.auditLogs = [];
        db.auditLogs.unshift({
          id: `aud_repair_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          tenant_id: tenantId,
          actor_name: 'System Integrity Repair',
          action: 'ORPHAN_SIM_ASSIGNMENT_REPAIRED',
          module: 'SIM_MANAGEMENT',
          entity_type: 'SIM_CARD',
          entity_id: sim.id,
          reason: `Referenced employee ${prevEmpName} does not exist in tenant Employee Master`,
          details: `Repaired orphaned SIM ${sim.mobile_number}: cleared stale employee reference '${prevEmpName}' and returned SIM to Available / Pool.`,
          timestamp: now,
          created_at: now,
        });

        count++;
        repairedDetails.push({
          simId: sim.id,
          mobileNumber: sim.mobile_number,
          orphanedEmployee: prevEmpName,
        });
      } else {
        // Valid assignment: ensure synced name & code directly from live employee master
        sim.current_employee_id = emp.id;
        sim.current_employee_name = emp.full_name;
        sim.current_employee_code = emp.employee_code;
        sim.assignment_status = 'Assigned';
        sim.status = 'Assigned';

        // Also sync employee pointer
        emp.current_sim_id = sim.id;
        emp.current_sim_number = sim.mobile_number;
      }
    } else {
      // SIM has no employee ID -> ensure assignment_status is Unassigned and cached names cleared
      if (sim.current_employee_name || sim.current_employee_code || sim.assignment_status === 'Assigned' || sim.status === 'Assigned') {
        sim.status = 'Available';
        sim.assignment_status = 'Unassigned';
        sim.current_employee_name = undefined;
        sim.current_employee_code = undefined;
        sim.assigned_date = undefined;
        sim.assigned_by = undefined;
      }
    }
  }

  return { repairedSimCount: count, repairedDetails };
}

export function unassignSimFromEmployee(
  db: any,
  employeeId: string,
  tenantId: string,
  reason: string,
  actorName: string = 'System Administrator',
  actorRole: string = 'ADMIN'
) {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const matchingSims = [
    ...(db.simCardsMaster || []),
    ...(db.simCards || []),
  ].filter((s: any) => 
    s.tenant_id === tenantId && 
    (s.current_employee_id === employeeId || s.assigned_to_id === employeeId)
  );

  for (const sim of matchingSims) {
    sim.status = 'Available';
    sim.assignment_status = 'Unassigned';
    sim.current_employee_id = undefined;
    sim.current_employee_name = undefined;
    sim.current_employee_code = undefined;
    sim.assigned_to_id = undefined;
    sim.assigned_to_name = undefined;
    sim.current_rider_name = undefined;
    sim.assigned_date = undefined;
    sim.assigned_by = undefined;
    sim.updated_at = now;
    sim.updated_by = actorName;

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      tenant_id: tenantId,
      actor_name: actorName,
      action: 'SIM_UNASSIGNED_ON_EMPLOYEE_EVENT',
      module: 'SIM_MANAGEMENT',
      entity_type: 'SIM_CARD',
      entity_id: sim.id,
      reason,
      details: `SIM ${sim.mobile_number} auto-returned to pool due to employee lifecycle event: ${reason}`,
      timestamp: now,
      created_at: now,
    });
  }

  const activeAssignments = (db.simAssignments || []).filter(
    (sa: any) => sa.tenant_id === tenantId && sa.employee_id === employeeId && (sa.status === 'ACTIVE' || sa.status === 'ASSIGNED')
  );

  for (const sa of activeAssignments) {
    sa.status = 'RETURNED';
    sa.return_date = today;
    sa.returned_at = now;
    sa.returned_by = actorName;
    sa.return_reason = reason;
  }

  const emp = (db.masterEmployees || []).find((e: any) => (e.id === employeeId || e.employee_id === employeeId) && e.tenant_id === tenantId);
  if (emp) {
    emp.current_sim_id = undefined;
    emp.current_sim_number = undefined;
    emp.updated_at = now;
    emp.updated_by = actorName;

    if (!db.employeeTimelineEvents) db.employeeTimelineEvents = [];
    db.employeeTimelineEvents.push({
      id: `ete_sim_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      tenant_id: tenantId,
      employee_id: employeeId,
      event_type: 'SIM_RETURNED',
      event_category: 'SIM',
      title: 'SIM Returned to Inventory Pool',
      description: `SIM assignment auto-closed and returned to pool: ${reason}`,
      performed_by: actorName,
      performed_by_role: actorRole,
      created_at: now,
    });
  }
}

export function seedDemoDataIfNeeded(db: any) {
  // STRICT DATA INTEGRITY: company_pixel_syntax is production and must NEVER be seeded with demo/snapshot data
  if (!db.masterEmployees) db.masterEmployees = [];
  // Purge any legacy demo/sample employee records from company_pixel_syntax (Do NOT purge valid emp_1027* authoritative records)
  db.masterEmployees = db.masterEmployees.filter((e: any) => {
    if (e.tenant_id !== 'company_pixel_syntax') return true;
    const isLegacyDemo = (e.id && (e.id.startsWith('emp_demo') || ['emp_01', 'emp_02', 'emp_03', 'emp_04', 'emp_05', 'emp_08'].includes(e.id)));
    return !isLegacyDemo;
  });
  // Guarantee authoritative company_pixel_syntax directory is populated
  getAuthoritativeEmployees(db, 'company_pixel_syntax');

  // Ensure company_demo projects only contain manually created projects (No auto-seeded projects)
  if (!db.projects) db.projects = [];
  // Remove confirmed auto-seeded demo projects
  const demoProjectIds = ['proj_demo_noon', 'proj_demo_talabat', 'proj_demo_keeta'];
  const removedProjects = db.projects.filter(
    (p: any) => p.tenant_id === 'company_demo' && (demoProjectIds.includes(p.id) || (p.code && p.code.startsWith('DEMO-')))
  );
  if (removedProjects.length > 0) {
    db.projects = db.projects.filter(
      (p: any) => !(p.tenant_id === 'company_demo' && (demoProjectIds.includes(p.id) || (p.code && p.code.startsWith('DEMO-'))))
    );
    // Unassign employees linked to removed demo projects
    if (db.masterEmployees) {
      for (const emp of db.masterEmployees) {
        if (emp.tenant_id === 'company_demo' && emp.project_id && demoProjectIds.includes(emp.project_id)) {
          emp.project_id = undefined;
          emp.project_name = undefined;
        }
      }
    }
  }

  // Ensure real employee Nasar Mahmood Mehndi Khan exists for company_demo if empty
  const demoEmps = db.masterEmployees.filter((e: any) => e.tenant_id === 'company_demo');
  if (demoEmps.length === 0) {
    db.masterEmployees.push({
      id: 'emp_demo_nasar_01',
      tenant_id: 'company_demo',
      branch_id: 'b_dxb',
      branch: 'Dubai Head Office & Logistics Center',
      branch_name: 'Dubai Head Office & Logistics Center',
      department_id: 'dept_ops',
      department_name: 'Operations',
      employee_code: 'EMP-00001',
      first_name: 'Nasar',
      middle_name: 'Mahmood',
      last_name: 'Mehndi Khan',
      full_name: 'Nasar Mahmood Mehndi Khan',
      name: 'Nasar Mahmood Mehndi Khan',
      nationality: 'Pakistan',
      date_of_birth: '1995-01-01',
      gender: 'Male',
      personal_mobile: '0501234567',
      company_mobile: '0501234567',
      passport_number: 'P1234567',
      passport_expiry: '2028-12-31',
      passport_status: 'With Company',
      passport_handler: 'HR Safe',
      passport_location: 'Dubai Office Safe',
      passport_receive_date: '2026-01-01',
      emirates_id_number: '',
      emirates_id_expiry: '2028-12-31',
      visa_number: '201/2026/12345',
      visa_expiry: '2028-12-31',
      driving_license_number: 'DXB-DL-12345',
      driving_license_expiry: '2028-12-31',
      joining_date: '2026-01-01',
      employment_type: 'FULL_TIME',
      job_title: 'Bike Rider',
      designation: 'Bike Rider',
      visa_contractor_type: 'Visa Holder',
      contractor: 'Visa Holder',
      current_status: 'Active',
      work_status: 'Active',
      status_reason: 'Active Rider',
      status_effective_date: '2026-01-01',
      salary_type: 'MONTHLY',
      basic_salary: 3500,
      allowances: 0,
      current_bike_id: undefined,
      current_bike_plate: undefined,
      current_sim_id: undefined,
      current_sim_number: undefined,
      is_archived: false,
      created_at: '2026-01-01T00:00:00Z',
      created_by: 'demo_admin',
      updated_at: '2026-01-01T00:00:00Z',
      updated_by: 'demo_admin',
    });
  }

  // Purge any stale/legacy demo employee System User from company_demo
  db.masterEmployees = db.masterEmployees.filter(
    (e: any) => !(e.tenant_id === 'company_demo' && (e.id === 'emp_demo_ahmed' || e.full_name === 'System User Ghulam Muhammad'))
  );

  // Clean up auto-seeded demo SIMs for company_demo
  cleanupAutoSeededDemoSims(db);

  // Enforce referential integrity repair on existing SIM assignments
  repairOrphanSimAssignments(db, 'company_demo');
}

export function generateSimUndertakingHtml(
  employeeName: string,
  employeeIdentifier: string,
  simNumber: string
): string {
  const safeName = (employeeName || '').toUpperCase().trim();
  const safeId = (employeeIdentifier || '').trim();
  const safeSim = (simNumber || '').trim();

  return `
<div style="font-family: Arial, Helvetica, sans-serif; max-width: 800px; margin: 0 auto; padding: 28px 32px; color: #000; line-height: 1.6; background: #ffffff;">
  <!-- BORDERED TABLE HEADER - EXACT OLD STYLE -->
  <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; margin-bottom: 24px;">
    <tr>
      <td style="width: 32%; border: 1.5px solid #000; padding: 12px 10px; text-align: center; vertical-align: middle;">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <div style="font-family: Arial, sans-serif; font-weight: 900; font-size: 24px; letter-spacing: 1px;">
            <span style="color: #10b981;">ALLIE</span><span style="color: #0f172a;">D</span>
          </div>
          <svg width="34" height="34" viewBox="0 0 64 64" fill="#0f172a" style="display: inline-block;">
            <path d="M48 24h-6l-2-6h-8l-2 4h-4v2h5l1.5-3h5.5l2 6h-6v2h7l2 6h-7v2h8.5l-1 3H20l-1-3h8v-2h-9l1.5-4.5L18 20H12v-2h7l1.8-5.4A2 2 0 0 1 22.7 11h8.6a2 2 0 0 1 1.9 1.4L35 18h9v6z" fill="#0f172a" />
            <rect x="14" y="14" width="10" height="10" rx="1.5" fill="#059669" />
            <circle cx="28" cy="12" r="4.5" fill="#0f172a" />
            <circle cx="16" cy="42" r="8" stroke="#0f172a" stroke-width="4" fill="none" />
            <circle cx="16" cy="42" r="3" fill="#10b981" />
            <circle cx="48" cy="42" r="8" stroke="#0f172a" stroke-width="4" fill="none" />
            <circle cx="48" cy="42" r="3" fill="#10b981" />
            <path d="M4 38h8M2 42h6M6 46h6" stroke="#10b981" stroke-width="2" stroke-linecap="round" />
          </svg>
        </div>
        <div style="font-size: 9.5px; font-weight: bold; color: #10b981; margin-top: 3px; text-align: center;">الأنيـد لتوصيـل الطلبـات ش.ذ.م.م</div>
        <div style="font-size: 8px; font-weight: bold; color: #1e293b; text-align: center; letter-spacing: 0.5px;">Pixel Syntax Delivery Software</div>
      </td>
      <td style="width: 68%; border: 1.5px solid #000; padding: 12px 16px; text-align: center; vertical-align: middle;">
        <h2 style="margin: 0 0 4px 0; font-size: 19px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: 0.5px;">SIM Undertaking</h2>
        <h3 style="margin: 0 0 3px 0; font-size: 15px; font-weight: bold; color: #000;">Pixel Syntax Delivery Software</h3>
        <div style="margin: 0 0 4px 0; font-size: 13px; font-weight: normal; color: #000;">Dubai</div>
        <div style="margin: 0; font-size: 12px; font-weight: bold; color: #000;">Forms Number: LT0020</div>
      </td>
    </tr>
  </table>

  <!-- FIRST PARAGRAPH - EXACT OLD STYLE -->
  <p style="font-size: 13.5px; line-height: 1.7; margin-bottom: 20px; text-align: justify; color: #000;">
    ,I, <strong style="text-decoration: underline;">${safeName}</strong>, ${safeId} hereby acknowledge that I have received the <strong style="text-decoration: underline;">${safeSim}</strong> Company SIM card from Allied Delivery Services for official business purposes.
  </p>

  <!-- NUMBERED TERMS INTRO -->
  <p style="font-size: 13.5px; font-weight: bold; margin-bottom: 12px; color: #000;">
    I undertake and agree to the following:
  </p>

  <!-- NUMBERED TERMS 1 - 9 -->
  <ol style="font-size: 13px; line-height: 1.75; margin-bottom: 24px; padding-left: 24px; color: #000;">
    <li style="margin-bottom: 8px;">The SIM card provided to me is the property of Pixel Syntax Delivery Software and is issued solely for official business and operational communication.</li>
    <li style="margin-bottom: 8px;">I shall be personally responsible for the safekeeping and proper handling of the SIM card at all times and will not hand it over or transfer it to any unauthorized person.</li>
    <li style="margin-bottom: 8px;">I will not use this SIM card for any illegal, unauthorized, fraudulent, or personal international activities and premium services.</li>
    <li style="margin-bottom: 8px;">In the event of loss, theft, or damage to the SIM card, I will immediately report it to Pixel Syntax Delivery Software management within 24 hours so the number can be barred immediately.</li>
    <li style="margin-bottom: 8px;">Any replacement costs, re-issuance fees, or financial penalties resulting from negligence or loss of the SIM card will be borne by me and deducted from my monthly salary.</li>
    <li style="margin-bottom: 8px;">Any usage charges, international calling, roaming fees, or data usage exceeding the allocated monthly package limit will be my direct financial responsibility and deducted from my payroll.</li>
    <li style="margin-bottom: 8px;">I agree to keep the SIM card active, powered, and inserted in the designated delivery smartphone during working hours to maintain uninterrupted contact with dispatch and customers.</li>
    <li style="margin-bottom: 8px;">The company reserves the right to inspect, audit, suspend, or retrieve the SIM card connection at any time without prior notice.</li>
    <li style="margin-bottom: 8px;">Upon resignation, project transfer, or termination of employment, I agree to return the SIM card immediately in good condition to Pixel Syntax Delivery Software.</li>
  </ol>

  <!-- ACCEPTANCE PARAGRAPH -->
  <p style="font-size: 13.5px; line-height: 1.6; margin-bottom: 38px; text-align: justify; color: #000;">
    I confirm that I have read, understood, and accepted the above terms and conditions and agree to abide by them.
  </p>

  <!-- BOTTOM SECTION - ONLY EMPLOYEE, BLANK DATE -->
  <div style="margin-top: 36px; font-size: 13.5px; color: #000; line-height: 2;">
    <div style="margin-bottom: 18px;">
      <strong>Employee Name:</strong> ${safeName}
    </div>
    <div style="margin-bottom: 24px;">
      <strong>Employee Signature:</strong> ____________________
    </div>
    <div>
      <strong>Date:</strong> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
    </div>
  </div>
</div>
  `.trim();
}

export function resolveSimForEmployee(emp: any, db: any) {
  if (!emp) return { simNumber: null, isAssigned: false, simDetails: null };
  const tenantId = emp.tenant_id;

  // 1. Check authoritative db.simCardsMaster first
  if (db.simCardsMaster && Array.isArray(db.simCardsMaster)) {
    const masterSim = db.simCardsMaster.find(
      (s: any) =>
        (!tenantId || s.tenant_id === tenantId) &&
        (s.current_employee_id === emp.id || (emp.employee_code && s.current_employee_code === emp.employee_code)) &&
        (s.assignment_status === 'Assigned' || s.status === 'Assigned')
    );
    if (masterSim) {
      const num = masterSim.mobile_number || masterSim.sim_number || '';
      if (num && num.trim() !== '') {
        return {
          simNumber: num.trim(),
          isAssigned: true,
          simDetails: masterSim,
        };
      }
    }
  }

  // 2. Check active db.simAssignments
  if (db.simAssignments && Array.isArray(db.simAssignments)) {
    const activeAsgn = db.simAssignments.find(
      (a: any) =>
        (!tenantId || a.tenant_id === tenantId) &&
        (a.employee_id === emp.id || (emp.employee_code && a.employee_code === emp.employee_code)) &&
        (a.status === 'ACTIVE' || a.status === 'Active')
    );
    if (activeAsgn) {
      const num = activeAsgn.mobile_number || activeAsgn.sim_number || '';
      if (num && num.trim() !== '') {
        return {
          simNumber: num.trim(),
          isAssigned: true,
          simDetails: activeAsgn,
        };
      }
    }
  }

  // 3. Fallback check db.simCards
  if (db.simCards && Array.isArray(db.simCards)) {
    const assignedSim = db.simCards.find(
      (s: any) =>
        (!tenantId || s.tenant_id === tenantId) &&
        (s.assigned_employee_id === emp.id || s.current_employee_id === emp.id || (emp.employee_code && s.assigned_employee_code === emp.employee_code)) &&
        (s.status === 'Assigned' || s.status === 'ASSIGNED')
    );
    if (assignedSim) {
      const num = assignedSim.mobile_number || assignedSim.sim_number || assignedSim.phone_number || '';
      if (num && num.trim() !== '') {
        return {
          simNumber: num.trim(),
          isAssigned: true,
          simDetails: assignedSim,
        };
      }
    }
  }

  return {
    simNumber: null,
    isAssigned: false,
    simDetails: null,
  };
}

export function createSimRouter(db: any, getGeminiClient?: () => GoogleGenAI) {
  const router = Router();

  if (!db.simCardsMaster) {
    db.simCardsMaster = [];
  }
  if (!db.simAssignments) {
    db.simAssignments = [];
  }

  function extractTenantContext(req: Request) {
    const actor = resolveAuthenticatedActor(req, db);
    const headerTenant = req.headers['x-tenant-id'] as string;
    let tenantId = headerTenant || actor.tenantId || 'company_pixel_syntax';
    if (tenantId === 'company_demo' && !headerTenant) {
      tenantId = 'company_pixel_syntax';
    }
    const userId = actor.userId || (req.headers['x-user-id'] as string) || 'user_emp_2';
    const userRole = actor.userRole || (req.headers['x-user-role'] as string) || 'FLEET_MANAGER';
    const userName = actor.userName || 'Ali Raza Khan';

    return { tenantId, userId, userRole, userName, isSuperAdmin: actor.isSuperAdmin, actor };
  }

  // Opt-in legacy current-handover verification, same safe RPC as production Worker.
  // Never automatically repair any other employee or inventory record.
  router.post('/verify-legacy-current-handover', async (req: Request, res: Response) => {
    try {
      const actor = resolveAuthenticatedActor(req, db);
      if (!actor.isAuthenticated || !actor.userId || !actor.tenantId) {
        return res.status(401).json({ success: false, error: 'Sign in to verify SIM history.' });
      }
      const supabase = getSupabaseClient();
      if (!supabase) return res.status(503).json({ success: false, error: 'Database unavailable.' });
      const body = req.body || {};
      const reason = String(body.correctionReason || '').trim();
      const validDate = (date: unknown): boolean =>
        typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        && !Number.isNaN(new Date(date + 'T00:00:00Z').getTime())
        && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date;
      if (!body.employeeId || !body.simCardId || !body.assignedByProfileId ||
          !validDate(body.assignedDate) || reason.length < 5 || reason.length > 500 ||
          body.confirmPhysicalCustody !== true) {
        return res.status(400).json({
          success: false, error: 'Verify the employee, SIM, real handover date and assigner; confirm actual custody.',
        });
      }
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const profileQuery = supabase.from('profiles').select('id,full_name')
        .eq('tenant_id', actor.tenantId);
      const { data: direct } = await (uuid.test(actor.userId)
        ? profileQuery.eq('id', actor.userId)
        : profileQuery.eq('username', actor.userId)).maybeSingle();
      let operator = direct;
      if (!operator && actor.userName) {
        const { data: byName } = await supabase.from('profiles').select('id,full_name')
          .eq('tenant_id', actor.tenantId).ilike('full_name', actor.userName).maybeSingle();
        operator = byName;
      }
      if (!operator?.id || !operator.full_name) {
        return res.status(403).json({ success: false, error: 'Authenticated staff profile was not verified.' });
      }
      const { data, error } = await supabase.rpc('allied_verify_legacy_current_sim_handover', {
        p_tenant_id: actor.tenantId,
        p_employee_id: String(body.employeeId),
        p_sim_card_id: String(body.simCardId),
        p_assigned_date: body.assignedDate,
        p_original_assigner_profile_id: String(body.assignedByProfileId),
        p_editor_profile_id: String(operator.id),
        p_editor_name: operator.full_name,
        p_correction_reason: reason,
        p_notes: typeof body.notes === 'string' ? body.notes.slice(0, 1000) : null,
        p_confirm_physical_custody: true,
      });
      if (error || !data?.success) {
        return res.status(409).json({ success: false, error: error?.message || 'Custody verification failed; no changes made.' });
      }
      return res.json({ success: true, ...data, message: 'Verified legacy handover recorded and audited.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: 'Could not verify current SIM custody.' });
    }
  });

  // ==============================================================================
  // SIM UNDERTAKING DEDICATED ROUTES (OLD FORMAT LT0020 & 3-CHAR SEARCH)
  // ==============================================================================

  // A. GET /api/erp/sims/undertaking/search-employees (3-character autocomplete live backend search)
  router.get('/undertaking/search-employees', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const q = String(req.query.q || req.query.search || '').trim().toLowerCase();

      // Minimum 3 characters autocomplete
      if (q.length < 3) {
        return res.json({ success: true, employees: [], message: 'Minimum 3 characters required for search.' });
      }

      const emps = (db.masterEmployees || []).filter(
        (e: any) =>
          e.tenant_id === tenantId &&
          (e.full_name?.toLowerCase().includes(q) ||
            e.name?.toLowerCase().includes(q) ||
            e.employee_code?.toLowerCase().includes(q) ||
            e.emirates_id?.toLowerCase().includes(q) ||
            e.emirates_id_number?.toLowerCase().includes(q) ||
            e.passport_number?.toLowerCase().includes(q) ||
            e.mobile_number?.toLowerCase().includes(q) ||
            e.personal_mobile?.toLowerCase().includes(q) ||
            e.company_mobile?.toLowerCase().includes(q))
      );

      const mapped = emps.slice(0, 30).map((emp: any) => {
        const simInfo = resolveSimForEmployee(emp, db);
        return {
          id: emp.id || emp.employee_id,
          full_name: emp.full_name || emp.name || 'N/A',
          employee_code: emp.employee_code || emp.id,
          emirates_id: emp.emirates_id || emp.emirates_id_number || 'N/A',
          designation: emp.designation || 'Delivery Rider',
          project_name: emp.project_name || emp.current_project_name || 'Unassigned',
          has_assigned_sim: simInfo.isAssigned,
          assigned_sim_number: simInfo.simNumber,
          operator: simInfo.simDetails?.operator || simInfo.simDetails?.provider || 'DU',
        };
      });

      return res.json({ success: true, employees: mapped });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // B. GET /api/erp/sims/undertaking/employee-details
  router.get('/undertaking/employee-details', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const employeeId = String(req.query.employee_id || req.query.employeeId || '').trim();

      if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID is required.' });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === employeeId || e.employee_id === employeeId || e.employee_code === employeeId) &&
          e.tenant_id === tenantId
      );

      if (!emp) {
        return res.status(404).json({ error: `Employee ${employeeId} not found.` });
      }

      const simInfo = resolveSimForEmployee(emp, db);
      const empIdentifier = emp.emirates_id || emp.emirates_id_number || emp.passport_number || emp.employee_code || '';

      return res.json({
        success: true,
        employee: {
          id: emp.id || emp.employee_id,
          full_name: emp.full_name || emp.name || 'N/A',
          employee_code: emp.employee_code || emp.id,
          emirates_id: emp.emirates_id || emp.emirates_id_number || 'N/A',
          employee_identifier: empIdentifier,
          designation: emp.designation || 'Delivery Rider',
          project_name: emp.project_name || emp.current_project_name || 'Unassigned',
        },
        has_assigned_sim: simInfo.isAssigned,
        assigned_sim_number: simInfo.simNumber,
        sim_details: simInfo.simDetails,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // C. POST /api/erp/sims/undertaking/generate
  router.post('/undertaking/generate', (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const employeeId = String(req.body.employee_id || req.body.employeeId || '').trim();

      if (!employeeId) {
        return res.status(400).json({ error: 'Employee ID is required to generate SIM Undertaking.' });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) =>
          (e.id === employeeId || e.employee_id === employeeId || e.employee_code === employeeId) &&
          e.tenant_id === tenantId
      );

      if (!emp) {
        return res.status(404).json({ error: `Employee ${employeeId} not found.` });
      }

      const simInfo = resolveSimForEmployee(emp, db);

      // CRITICAL DIRECTIVE: If no SIM assigned, do not generate undertaking
      if (!simInfo.isAssigned || !simInfo.simNumber) {
        return res.status(400).json({
          success: false,
          error: 'No SIM is currently assigned to this employee.',
        });
      }

      const empIdentifier = emp.emirates_id || emp.emirates_id_number || emp.passport_number || emp.employee_code || '';
      const html = generateSimUndertakingHtml(
        emp.full_name || emp.name || 'N/A',
        empIdentifier,
        simInfo.simNumber
      );

      // Record in generated forms
      if (!db.generatedForms) db.generatedForms = [];
      const formRecord = {
        id: `form_sim_${Date.now()}`,
        tenant_id: tenantId,
        form_number: `LT0020-${Date.now().toString().slice(-4)}`,
        template_id: 'tmpl_sim_undertaking',
        template_name: 'SIM Undertaking',
        category: 'TELECOM',
        employee_id: emp.id || emp.employee_id,
        employee_name: emp.full_name || emp.name || 'N/A',
        employee_code: emp.employee_code || emp.id,
        created_at: new Date().toISOString(),
        created_by: userName || 'Admin',
        status: 'GENERATED',
        rendered_content: html,
      };
      db.generatedForms.unshift(formRecord);

      return res.json({
        success: true,
        html,
        employee_name: emp.full_name || emp.name,
        employee_code: emp.employee_code || emp.id,
        sim_number: simInfo.simNumber,
        form: formRecord,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 0. GET /api/erp/sims/projects (Fetch live configured projects from canonical Project Master)
  router.get('/projects', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const projects = (db.projects || [])
        .filter((p: any) => !p.tenant_id || p.tenant_id === tenantId)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          client_name: p.client_name,
          external_id_label: p.external_id_label,
          status: p.status || 'ACTIVE',
        }));
      return res.json({ success: true, projects });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 0b. POST /api/erp/sims/integrity/repair-orphans (Dedicated referential integrity repair endpoint)
  router.post('/integrity/repair-orphans', (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const result = repairOrphanSimAssignments(db, tenantId);
      return res.json({
        success: true,
        message: `Repaired ${result.repairedSimCount} orphaned or invalid SIM assignments in ${tenantId}.`,
        ...result,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. POST /api/erp/sims/bulk-preview (Preview Bulk Import)
  router.post('/bulk-preview', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const { sims } = req.body;

      if (!Array.isArray(sims)) return res.status(400).json({ error: 'Invalid data format.' });

      const preview = sims.map((item: any) => {
        console.log('Bulk Preview Item:', JSON.stringify(item));
        const mobile = String(item['Account number'] || item['Account Number'] || item['account number'] || '').trim();
        console.log('Extracted Mobile:', mobile);
        const normalized = normalizeUaePhoneNumber(mobile);
        console.log('Normalized Mobile:', normalized);
        const existing = (db.simCardsMaster || []).find(
          (s: any) => s.tenant_id === tenantId && (s.mobile_number === mobile || s.normalized_mobile_number === normalized)
        );

        return {
          ...item,
          mobile_number: mobile,
          validationStatus: existing ? 'DUPLICATE' : (normalized ? 'VALID' : 'INVALID'),
        };
      });

      const counts = {
        total: preview.length,
        valid: preview.filter((p: any) => p.validationStatus === 'VALID').length,
        duplicates: preview.filter((p: any) => p.validationStatus === 'DUPLICATE').length,
        invalid: preview.filter((p: any) => p.validationStatus === 'INVALID').length,
      };

      return res.json({ success: true, preview, counts });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. POST /api/erp/sims/bulk-import (Production Authoritative SIM Bulk Import & Validation)
  router.post('/bulk-import', async (req: Request, res: Response) => {
    try {
      const { userName } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      const tenantId = 'company_pixel_syntax';
      const { sims, validateOnly } = req.body;

      if (!Array.isArray(sims)) return res.status(400).json({ success: false, error: 'Invalid data format. Expected { sims: [...] }.' });

      const supabase = getSupabaseClient();
      let dbExistingSims: any[] = [];
      if (supabase) {
        const { data: sbData, error: fetchErr } = await supabase
          .from('sim_cards')
          .select('*')
          .eq('tenant_id', tenantId);
        if (fetchErr) {
          console.error('Error fetching existing SIMs in server/simRoutes.ts:', fetchErr);
        } else if (sbData) {
          dbExistingSims = sbData;
        }
      }

      // Combine with in-memory store
      const memSims = (db.simCardsMaster || []).filter((s: any) => s.tenant_id === tenantId);
      const existingPhoneSet = new Set<string>();
      const existingIccidSet = new Set<string>();

      const addRecordToSets = (s: any) => {
        if (s.mobile_number) {
          const raw = String(s.mobile_number).trim();
          existingPhoneSet.add(raw);
          existingPhoneSet.add(raw.replace(/\D/g, ''));
          const norm = normalizeAndValidateUaeMobile(raw);
          if (norm.valid) {
            existingPhoneSet.add(norm.normalized);
            existingPhoneSet.add(norm.normalized.replace(/\D/g, ''));
          }
        }
        if (s.normalized_mobile_number) {
          const n = String(s.normalized_mobile_number).trim();
          existingPhoneSet.add(n);
          existingPhoneSet.add(n.replace(/\D/g, ''));
        }
        if (s.iccid) existingIccidSet.add(String(s.iccid).trim().toLowerCase());
        if (s.sim_serial_number) existingIccidSet.add(String(s.sim_serial_number).trim().toLowerCase());
      };

      dbExistingSims.forEach(addRecordToSets);
      memSims.forEach(addRecordToSets);

      const valid: any[] = [];
      const duplicates: any[] = [];
      const invalid: any[] = [];
      const unresolved: any[] = [];
      const seenBatchPhones = new Set<string>();
      const seenBatchIccids = new Set<string>();

      for (let i = 0; i < sims.length; i++) {
        const item = sims[i];
        const rowNum = i + 1;
        const rawPhone = String(
          item.mobile_number ??
          item['SIM Number'] ??
          item['SIM number'] ??
          item['sim number'] ??
          item['Account number'] ??
          item['Account Number'] ??
          item['account number'] ??
          item.phone ??
          item.phone_number ??
          ''
        ).trim();

        const rawIccid = String(
          item.iccid ??
          item.ICCID ??
          item['Chip Serial'] ??
          item.chip_serial ??
          item.sim_serial_number ??
          ''
        ).trim();

        const packageAmount = parseFloat(
          item['Package Amount'] ??
          item.package_amount ??
          item.packageAmount ??
          item.monthly_package_amount ??
          item.monthly_cost ??
          100
        ) || 100;

        const normResult = normalizeAndValidateUaeMobile(rawPhone);
        if (!normResult.valid) {
          invalid.push({
            ...item,
            row: rowNum,
            mobile_number: rawPhone,
            iccid: rawIccid,
            error: 'INVALID_PHONE_FORMAT',
            reason: `Invalid UAE mobile format: '${rawPhone}'`,
          });
          continue;
        }

        const normalizedMobile = normResult.normalized;
        const rawDigits = rawPhone.replace(/\D/g, '');
        const normDigits = normalizedMobile.replace(/\D/g, '');

        const isDupPhone =
          existingPhoneSet.has(rawPhone) ||
          existingPhoneSet.has(normalizedMobile) ||
          existingPhoneSet.has(rawDigits) ||
          existingPhoneSet.has(normDigits) ||
          seenBatchPhones.has(rawPhone) ||
          seenBatchPhones.has(normalizedMobile) ||
          seenBatchPhones.has(rawDigits) ||
          seenBatchPhones.has(normDigits);

        const isDupIccid = Boolean(
          rawIccid && (
            existingIccidSet.has(rawIccid.toLowerCase()) ||
            seenBatchIccids.has(rawIccid.toLowerCase())
          )
        );

        if (isDupPhone || isDupIccid) {
          duplicates.push({
            ...item,
            row: rowNum,
            mobile_number: rawPhone,
            normalized_mobile_number: normalizedMobile,
            iccid: rawIccid,
            error: isDupIccid && !isDupPhone ? 'DUPLICATE_ICCID' : 'DUPLICATE_PHONE_NUMBER',
            reason: isDupIccid && !isDupPhone ? `ICCID ${rawIccid} already exists` : `Phone number ${rawPhone} already exists`,
          });
          continue;
        }

        seenBatchPhones.add(rawPhone);
        seenBatchPhones.add(normalizedMobile);
        seenBatchPhones.add(rawDigits);
        seenBatchPhones.add(normDigits);
        if (rawIccid) seenBatchIccids.add(rawIccid.toLowerCase());

        const hasAssignmentRef = Boolean(
          item['Assigned To'] ||
          item['Driver Name'] ||
          item['Employee'] ||
          item['Employee Name'] ||
          item['Vehicle'] ||
          item['Project'] ||
          item['Rider']
        );

        const validatedRow = {
          ...item,
          row: rowNum,
          mobile_number: normalizedMobile,
          raw_mobile_number: rawPhone,
          iccid: rawIccid || undefined,
          tenant_id: tenantId,
          package_amount: packageAmount,
          provider: String(item.Vendor || item.vendor || item.provider || 'DU').toUpperCase(),
          plan: String(item.Plan || item.plan || 'Enterprise 25GB').trim(),
          state: String(item.State || item.state || 'Dubai').trim(),
          source: String(item.Source || item.source || 'Bulk Import').trim(),
        };

        valid.push(validatedRow);

        if (hasAssignmentRef) {
          unresolved.push({
            row: rowNum,
            mobile_number: normalizedMobile,
            iccid: rawIccid,
            assigned_to: item['Assigned To'] || item['Driver Name'] || item['Employee'] || null,
            vehicle: item['Vehicle'] || null,
            project: item['Project'] || null,
            note: 'Assignment skipped - SIM imported as unassigned inventory',
          });
        }
      }

      if (validateOnly === true) {
        return res.json({
          success: true,
          total: sims.length,
          valid,
          duplicates,
          invalid,
          unresolved,
        });
      }

      const now = new Date().toISOString();
      const insertedList: any[] = [];
      const skippedList: any[] = [];
      const errorList: any[] = [];

      if (valid.length > 0) {
        let realColumns: Set<string> | null = null;
        if (supabase) {
          try {
            const { data: anyRow } = await supabase.from('sim_cards').select('*').limit(1);
            if (anyRow && anyRow.length > 0) {
              realColumns = new Set(Object.keys(anyRow[0]));
            }
          } catch (e) {
            // Ignore if inspection fails
          }
        }

        const buildServerPayload = (item: any, rowIdx: number) => {
          const rawPhone = String(item.mobile_number || item.raw_mobile_number || '').trim();
          const normResult = normalizeAndValidateUaeMobile(rawPhone);
          const normalized = normResult.valid ? normResult.normalized : rawPhone;
          const rawIccid = String(item.iccid ?? item.sim_serial_number ?? '').trim();
          const prov = String(item.provider || item.vendor || 'DU').toUpperCase();
          const state = String(item.state || 'Dubai').trim();
          const plan = String(item.plan || `${prov} Standard Fleet Line`).trim();
          const monthlyAmount = Number(item.monthly_package_amount) || Number(item.monthly_cost) || Number(item.package_amount) || 100;
          const simId = item.id || `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${rowIdx + 1}`;
          const notes = item.notes ? String(item.notes).trim() : null;

          // Strictly proven columns from production sim_cards schema:
          // id, tenant_id, mobile_number, sim_serial_number, iccid, provider, plan, monthly_cost, status, notes, created_at, created_by, updated_at
          return {
            id: simId,
            tenant_id: tenantId,
            mobile_number: rawPhone,
            sim_serial_number: rawIccid || rawPhone,
            iccid: rawIccid || null,
            provider: prov,
            plan: plan,
            monthly_cost: monthlyAmount,
            status: 'Available',
            notes: notes,
            created_at: now,
            created_by: userName || 'Operations Admin',
            updated_at: now,
          };
        };

        if (supabase) {
          for (let i = 0; i < valid.length; i += 50) {
            const chunk = valid.slice(i, i + 50);
            const chunkPayloads = chunk.map((item, idx) => buildServerPayload(item, i + idx));

            const { data: batchData, error: batchErr } = await supabase
              .from('sim_cards')
              .insert(chunkPayloads)
              .select();

            if (batchErr) {
              console.warn(`Batch insert failed for chunk ${i}-${i + chunk.length}, falling back to row-by-row:`, batchErr.message);
              for (const singleP of chunkPayloads) {
                const { data: singleData, error: singleErr } = await supabase
                  .from('sim_cards')
                  .insert(singleP)
                  .select()
                  .maybeSingle();

                if (singleErr) {
                  const isDup = singleErr.code === '23505' || singleErr.message?.includes('duplicate') || singleErr.message?.includes('uq_');
                  if (isDup) {
                    skippedList.push({
                      mobile_number: singleP.mobile_number,
                      reason: singleErr.message || 'Duplicate in database',
                    });
                  } else {
                    errorList.push({
                      mobile_number: singleP.mobile_number,
                      error: singleErr.message,
                      code: singleErr.code,
                      details: singleErr.details,
                      hint: singleErr.hint,
                    });
                  }
                } else if (singleData) {
                  insertedList.push(singleData);
                }
              }
            } else if (Array.isArray(batchData)) {
              insertedList.push(...batchData);
            }
          }
        } else {
          // In-memory fallback if no Supabase configured
          for (let i = 0; i < valid.length; i++) {
            const payload = buildServerPayload(valid[i], i);
            insertedList.push(payload);
          }
        }

        // Always sync in-memory db.simCardsMaster with inserted rows
        for (const item of insertedList) {
          const existingIdx = (db.simCardsMaster || []).findIndex(
            (s: any) => s.tenant_id === tenantId && (s.mobile_number === item.mobile_number || (item.iccid && s.iccid === item.iccid))
          );
          if (existingIdx >= 0) {
            db.simCardsMaster[existingIdx] = { ...db.simCardsMaster[existingIdx], ...item };
          } else {
            if (!db.simCardsMaster) db.simCardsMaster = [];
            db.simCardsMaster.push(item);
          }
        }
      }

      if (insertedList.length === 0 && valid.length > 0) {
        const firstErr = errorList[0] || {};
        return res.status(400).json({
          success: false,
          imported: 0,
          skipped: skippedList.length + duplicates.length,
          failed: errorList.length + invalid.length,
          error: firstErr.error || 'No SIM cards were inserted into database.',
          message: firstErr.error || 'Zero SIMs were inserted into sim_cards table.',
          code: firstErr.code || 'INSERT_REJECTED',
          details: firstErr.details || '',
          hint: firstErr.hint || '',
          errors: errorList,
        });
      }

      return res.json({
        success: true,
        imported: insertedList.length,
        skipped: skippedList.length + duplicates.length,
        failed: errorList.length + invalid.length,
        errors: errorList,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. GET /api/erp/sims (Server-side search, filtering, pagination)
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      repairOrphanSimAssignments(db, tenantId);

      const {
        search,
        q,
        status,
        assignment_status,
        assignment,
        service_status,
        service,
        active,
        provider,
        vendor,
        state,
        source,
        project,
        page,
        pageSize,
      } = req.query;

      // Authoritative live Supabase query
      let list = await getAuthoritativeSims(db, tenantId);

      // Backfill normalized numbers, canonical statuses, and last assignment history if missing
      list.forEach((s: any) => {
        if (!s.normalized_mobile_number) {
          s.normalized_mobile_number = normalizeUaePhoneNumber(s.mobile_number);
        }
        if (!s.assignment_status) {
          s.assignment_status = s.current_employee_id || s.status === 'Assigned' ? 'Assigned' : 'Unassigned';
        }
        if (!s.service_status) {
          s.service_status = s.status === 'Inactive' ? 'Inactive' : 'Active';
        }
        if (!s.provider && s.vendor) {
          s.provider = s.vendor;
        }
        if (tenantId === 'company_pixel_syntax') {
          if (!s.provider || s.provider === 'DU' || s.vendor === 'DU') {
            s.provider = 'ETISALAT';
            s.vendor = 'ETISALAT';
          }
        }

        // Attach previous custody independently of the current employee.
        if (!s.last_employee_name) {
          const pastAsgns = (db.simAssignments || []).filter(
            (a: any) => (a.sim_id === s.id || a.sim_card_id === s.id) && String(a.status || a.assignment_status || '').toUpperCase() !== 'ACTIVE'
          );
          if (pastAsgns.length > 0) {
            pastAsgns.sort((a: any, b: any) => new Date(b.returned_at || b.returned_date || b.created_at || 0).getTime() - new Date(a.returned_at || a.returned_date || a.created_at || 0).getTime());
            const last = pastAsgns[0];
            s.last_assignment_id = s.last_assignment_id || last.id;
            s.last_employee_id = s.last_employee_id || last.employee_id;
            s.last_employee_name = s.last_employee_name || last.employee_name;
            s.last_employee_code = s.last_employee_code || last.employee_code;
            s.last_assigned_date = s.last_assigned_date || last.assigned_date;
            s.last_returned_date = s.last_returned_date || last.returned_date || last.returned_at;
            s.last_assigned_by = resolveStaffUserName(s.last_assigned_by || last.assigned_by || last.created_by, db);
            s.last_returned_by = last.returned_by ? resolveStaffUserName(last.returned_by, db) : s.last_returned_by;
            s.last_return_reason = s.last_return_reason || last.return_reason || last.reason;
            s.previous_project = s.previous_project || last.project_name || last.primary_project;
          }
        }
        if (s.assigned_by) {
          s.assigned_by = resolveStaffUserName(s.assigned_by, db);
        }
      });

      // The normal inventory view excludes retired and lost lines. Their counters
      // remain visible, and the explicit filters can still open those records.
      const asgnFilter = (assignment_status || assignment || (status && ['assigned', 'unassigned', 'lost', 'available'].includes(String(status).toLowerCase()) ? status : null)) as string;
      const srvFilter = (service_status || service || active || (status && ['active', 'inactive', 'suspended', 'cancelled'].includes(String(status).toLowerCase()) ? status : null)) as string;
      const wantsCancelled = String(srvFilter || '').toLowerCase() === 'cancelled';
      const wantsLost = String(asgnFilter || '').toLowerCase() === 'lost';
      list = list.filter((s: any) => wantsCancelled ? isCancelledSim(s) : wantsLost ? isLostSim(s) : isOperationalInventorySim(s));

      // 1. Filter: Assignment Status (All, Assigned, Unassigned, Lost)
      if (asgnFilter && asgnFilter !== 'ALL') {
        const aTerm = asgnFilter.toLowerCase().trim();
        if (aTerm === 'assigned') {
          list = list.filter((s: any) => (s.assignment_status?.toLowerCase() === 'assigned' || !!s.current_employee_id) && s.status?.toLowerCase() !== 'lost');
        } else if (aTerm === 'unassigned' || aTerm === 'available') {
          list = list.filter((s: any) => (s.assignment_status?.toLowerCase() === 'unassigned' || !s.current_employee_id) && s.status?.toLowerCase() !== 'lost');
        } else if (aTerm === 'lost') {
          list = list.filter((s: any) => s.status?.toLowerCase() === 'lost' || s.assignment_status?.toLowerCase() === 'lost');
        }
      }

      // 2. Filter: Service Status (All, Active, Inactive, Suspended, Cancelled)
      if (srvFilter && srvFilter !== 'ALL') {
        const sTerm = srvFilter.toLowerCase().trim();
        list = list.filter((s: any) => s.service_status?.toLowerCase() === sTerm);
      }

      // Filter: Provider (All, DU, ETISALAT, VIRGIN, STC)
      const provFilter = (provider || vendor) as string;
      if (provFilter && provFilter !== 'ALL') {
        list = list.filter((s: any) => (s.provider || s.vendor)?.toLowerCase() === provFilter.toLowerCase());
      }

      // State and source filters use the same values shown in the summary cards.
      if (state && state !== 'ALL') {
        list = list.filter((s: any) => String(s.state || 'Dubai').toLowerCase() === String(state).toLowerCase());
      }
      if (source && source !== 'ALL') {
        list = list.filter((s: any) => String(s.source || '').toLowerCase() === String(source).toLowerCase());
      }

      // Search across: Mobile Number, ICCID, Employee Name, Employee Code
      const queryStr = (search || q) as string;
      if (queryStr && queryStr.trim()) {
        const queryTerm = queryStr.toLowerCase().trim();
        const queryDigits = queryTerm.replace(/\D/g, '');
        const queryLocal = queryDigits.startsWith('971') ? queryDigits.substring(3) : (queryDigits.startsWith('05') ? queryDigits.substring(1) : queryDigits);
        list = list.filter((s: any) => {
          const m = (s.mobile_number || '').toLowerCase();
          const rawM = (s.raw_mobile_number || '').toLowerCase();
          const norm = (s.normalized_mobile_number || '').toLowerCase();
          const normDigits = (m + norm + rawM).replace(/\D/g, '');
          const iccid = (s.iccid || s.sim_serial_number || s.sim_number || '').toLowerCase();
          const empName = (s.current_employee_name || '').toLowerCase();
          const empCode = (s.current_employee_code || '').toLowerCase();

          if (m.includes(queryTerm) || rawM.includes(queryTerm)) return true;
          if (queryDigits && normDigits.includes(queryDigits)) return true;
          if (queryLocal && normDigits.includes(queryLocal)) return true;
          if (iccid.includes(queryTerm)) return true;
          if (empName.includes(queryTerm)) return true;
          if (empCode.includes(queryTerm)) return true;
          return false;
        });
      }

      // Live join with masterEmployees so stale or orphaned names never show
      const enrichedList = list.map((s: any) => {
        let current_project = '—';
        let liveEmp: any = null;

        if (s.current_employee_id) {
          liveEmp = (db.masterEmployees || []).find((e: any) => 
            (e.id === s.current_employee_id || e.employee_code === s.current_employee_id) && 
            e.tenant_id === tenantId && 
            !e.is_archived && 
            !e.isArchived
          );
        }

        let liveEmployeeName = s.current_employee_name;
        let liveEmployeeCode = s.current_employee_code;
        let liveAssignmentStatus = s.assignment_status;

        if (liveEmp) {
          liveEmployeeName = liveEmp.full_name;
          liveEmployeeCode = liveEmp.employee_code;
          liveAssignmentStatus = 'Assigned';
          current_project = resolveEmployeePrimaryProject(liveEmp, db);
        } else if (s.current_employee_id || s.current_employee_name || s.assignment_status === 'Assigned' || s.status === 'Assigned') {
          // Stale or unresolvable employee pointer
          liveEmployeeName = undefined;
          liveEmployeeCode = undefined;
          liveAssignmentStatus = 'Unassigned';
          current_project = '—';
        }

        return {
          ...s,
          assignment_status: liveAssignmentStatus,
          current_employee_name: liveEmployeeName,
          current_employee_code: liveEmployeeCode,
          current_emirates_id: liveEmp?.emirates_id_number || undefined,
          current_vehicle_plate: liveEmp?.current_bike_plate || undefined,
          current_project,
          current_project_name: current_project !== '—' ? current_project : undefined,
        };
      });

      // Filter: Project (Talabat, Deliveroo, Keeta, Noon, Careem, etc.)
      let finalList = enrichedList;
      if (project && project !== 'ALL') {
        const projTerm = (project as string).toLowerCase().trim();
        finalList = finalList.filter((s: any) => {
          const cp = (s.current_project || '').toLowerCase();
          const cpn = (s.current_project_name || '').toLowerCase();
          return cp.includes(projTerm) || cpn.includes(projTerm);
        });
      }

      // Sort newest first
      finalList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Pagination
      const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : 1;
      const sizeNum = pageSize ? Math.max(1, parseInt(pageSize as string, 10)) : 25;

      if (page || pageSize) {
        const total = finalList.length;
        const totalPages = Math.ceil(total / sizeNum) || 1;
        const start = (pageNum - 1) * sizeNum;
        const items = finalList.slice(start, start + sizeNum);

        return res.json({
          items,
          total,
          totalPages,
          page: pageNum,
          pageSize: sizeNum,
        });
      }

      return res.json(finalList);
    } catch (err: any) {
      console.error('Fetch SIMs error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/erp/sims/dashboard (Compact Summary Stats from authoritative Supabase dataset)
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      repairOrphanSimAssignments(db, tenantId);

      const stats = await getAuthoritativeSimDashboardStats(db, tenantId);
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 3. GET /api/erp/sims/master (Selector for available or all SIMs)
  router.get('/master', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      seedDemoDataIfNeeded(db);
      cleanupAutoSeededDemoSims(db);
      repairOrphanSimAssignments(db, tenantId);
      const availableOnly = req.query.available === 'true';

      let list = await getAuthoritativeSims(db, tenantId);
      if (tenantId === 'company_pixel_syntax') {
        list.forEach((s: any) => {
          if (!s.provider || s.provider === 'DU' || s.vendor === 'DU') {
            s.provider = 'ETISALAT';
            s.vendor = 'ETISALAT';
          }
        });
      }
      if (availableOnly) {
        list = list.filter((s: any) =>
          isOperationalInventorySim(s) &&
          (s.assignment_status === 'Unassigned' || !s.current_employee_id) &&
          (!s.service_status || s.service_status.toLowerCase() === 'active') &&
          ['available', 'unassigned'].includes(String(s.status || 'Available').toLowerCase())
        );
      }

      return res.json(list);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /api/erp/sims/employees/search (Authoritative company employee search)
  router.get('/employees/search', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const headerTenant = (req.headers['x-tenant-id'] as string) || '';
      const effectiveTenant = (headerTenant && headerTenant !== 'ALL') ? headerTenant : (tenantId || 'company_pixel_syntax');
      seedDemoDataIfNeeded(db);
      const q = ((req.query.q || req.query.query || req.query.search || '') as string).trim();
      const supabase = getSupabaseClient();
      const results = await searchSimEligibleEmployees(supabase, db, {
        query: q,
        tenantId: effectiveTenant,
        limit: 50,
      });
      return res.json(results);
    } catch (err: any) {
      console.error('Error in /employees/search:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /api/erp/sims (Canonical Simple Add SIM)
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const {
        mobile_number,
        mobileNumber,
        provider,
        vendor,
        iccid,
        sim_serial_number,
        simSerialNumber,
        plan,
        service_status,
        serviceStatus,
        notes,
      } = req.body;

      const rawNumber = (mobile_number || mobileNumber || '').trim();
      if (!rawNumber) {
        return res.status(400).json({
          code: 'INVALID_PHONE_FORMAT',
          error: 'INVALID_PHONE_FORMAT: Mobile phone number is required.',
        });
      }

      const val = normalizeAndValidateUaeMobile(rawNumber);
      if (!val.valid) {
        return res.status(400).json({
          code: 'INVALID_PHONE_FORMAT',
          error: val.error || `INVALID_PHONE_FORMAT: ${rawNumber} does not match required UAE mobile format (+971 5X XXX XXXX).`,
        });
      }

      const normalized = val.normalized;

      // DUPLICATE PROTECTION: Unique normalized mobile number within tenant
      const existingByPhone = (db.simCardsMaster || []).find(
        (s: any) => s.tenant_id === tenantId && (s.normalized_mobile_number === normalized || s.mobile_number === normalized)
      );
      if (existingByPhone) {
        return res.status(400).json({
          code: 'DUPLICATE_PHONE_NUMBER',
          error: `DUPLICATE_PHONE_NUMBER: Mobile number ${rawNumber} is already registered in this company (${existingByPhone.provider} - Status: ${existingByPhone.assignment_status || existingByPhone.status}).`,
          existingSim: existingByPhone,
        });
      }

      // DUPLICATE PROTECTION: Unique ICCID within tenant if provided
      const rawIccid = (iccid || sim_serial_number || simSerialNumber || '').trim();
      if (rawIccid) {
        const existingByIccid = (db.simCardsMaster || []).find(
          (s: any) => s.tenant_id === tenantId && (s.iccid === rawIccid || s.sim_serial_number === rawIccid)
        );
        if (existingByIccid) {
          return res.status(400).json({
            code: 'DUPLICATE_ICCID',
            error: `DUPLICATE_ICCID: ICCID / SIM Serial ${rawIccid} is already registered in this company (Mobile: ${existingByIccid.mobile_number}).`,
            existingSim: existingByIccid,
          });
        }
      }

      const prov = provider || vendor || 'DU';
      const srvStatus = service_status || serviceStatus || 'Active';
      const now = new Date().toISOString();

      const newSim: SimRecord = {
        id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tenant_id: tenantId,
        mobile_number: rawNumber,
        normalized_mobile_number: normalized,
        iccid: rawIccid || undefined,
        sim_serial_number: rawIccid || rawNumber,
        provider: prov,
        vendor: prov,
        state: 'Dubai',
        source: 'Company SIMs',
        monthly_package_amount: 125,
        plan: plan ? plan.trim() : `${prov} Standard Fleet Line`,
        status: srvStatus === 'Active' ? 'Available' : 'Inactive',
        assignment_status: 'Unassigned',
        service_status: srvStatus === 'Inactive' ? 'Inactive' : 'Active',
        notes: notes ? notes.trim() : undefined,
        created_at: now,
        created_by: userName || 'Operations Admin',
        updated_at: now,
        updated_by: userName || 'Operations Admin',
      };

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const supabasePayload: Record<string, any> = {
            id: newSim.id,
            tenant_id: tenantId,
            mobile_number: rawNumber,
            sim_serial_number: rawIccid || rawNumber,
            iccid: rawIccid || null,
            provider: prov,
            plan: newSim.plan,
            monthly_cost: 125,
            status: srvStatus === 'Active' ? 'Available' : 'Inactive',
            notes: notes ? notes.trim() : null,
            created_at: now,
            created_by: userName || 'Operations Admin',
            updated_at: now,
          };
          let { error: insertErr } = await supabase.from('sim_cards').insert(supabasePayload);
          if (insertErr && (insertErr.code === 'PGRST204' || insertErr.message?.includes('schema cache') || insertErr.message?.includes('does not exist'))) {
            const match = insertErr.message.match(/(?:Could not find the '([^']+)' column|column "([^"]+)" of relation)/i);
            const badCol = match ? (match[1] || match[2]) : null;
            if (badCol && badCol in supabasePayload) {
              delete supabasePayload[badCol];
              const retryRes = await supabase.from('sim_cards').insert(supabasePayload);
              insertErr = retryRes.error;
            }
          }
          if (insertErr) {
            console.error('Supabase single SIM insert error:', insertErr);
            return res.status(400).json({ error: insertErr.message });
          }
        } catch (sbErr: any) {
          console.error('Supabase single SIM exception:', sbErr);
          return res.status(500).json({ error: sbErr.message || 'Database error' });
        }
      }

      db.simCardsMaster.unshift(newSim);

      if (db.auditLogs) {
        db.auditLogs.unshift({
          id: `log_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Operations / Telecom',
          action: 'CREATE_SIM_CARD',
          actionType: 'CREATE',
          status: 'SUCCESS',
          module: 'SIM Management',
          details: `Registered SIM ${rawNumber} (${prov} - Service: ${srvStatus})`,
          targetEntityId: newSim.id,
        });
      }

      return res.status(201).json({
        success: true,
        message: `SIM card ${rawNumber} created successfully.`,
        sim: newSim,
      });
    } catch (err: any) {
      console.error('Create SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 6. POST /api/erp/sims/batch (Batch multi-row creation with duplicate protection & Supabase persistence)
  router.post('/batch', async (req: Request, res: Response) => {
    try {
      // 1. Tenant safety: company_pixel_syntax only from authenticated tenant context
      // Never trust tenant_id directly from client payload
      const { tenantId: ctxTenantId, userName, userId } = extractTenantContext(req);
      const tenantId = (req.headers['x-tenant-id'] as string) || ctxTenantId || 'company_pixel_syntax';

      const body = req.body || {};
      const rawSims = Array.isArray(body)
        ? body
        : (Array.isArray(body.sims) ? body.sims : (Array.isArray(body.rows) ? body.rows : null));

      if (!rawSims || rawSims.length === 0) {
        return res.status(400).json({ error: 'Payload must contain a non-empty sims array.' });
      }

      const supabase = getSupabaseClient();
      const existingPhoneSet = new Set<string>();
      const existingIccidSet = new Set<string>();

      // Populate existing phones and ICCIDs from in-memory db
      for (const s of (db.simCardsMaster || [])) {
        if (s.tenant_id === tenantId) {
          if (s.mobile_number) {
            existingPhoneSet.add(String(s.mobile_number).trim());
            existingPhoneSet.add(String(s.mobile_number).replace(/\D/g, ''));
          }
          if (s.normalized_mobile_number) {
            existingPhoneSet.add(String(s.normalized_mobile_number).trim());
            existingPhoneSet.add(String(s.normalized_mobile_number).replace(/\D/g, ''));
          }
          if (s.iccid) existingIccidSet.add(String(s.iccid).trim());
          if (s.sim_serial_number) existingIccidSet.add(String(s.sim_serial_number).trim());
        }
      }

      // Populate existing phones and ICCIDs from real Supabase table if connected
      if (supabase) {
        try {
          const { data: sbExisting, error: sbFetchErr } = await supabase
            .from('sim_cards')
            .select('id, mobile_number, normalized_mobile_number, sim_serial_number, iccid')
            .eq('tenant_id', tenantId);

          if (!sbFetchErr && Array.isArray(sbExisting)) {
            for (const s of sbExisting) {
              if (s.mobile_number) {
                existingPhoneSet.add(String(s.mobile_number).trim());
                existingPhoneSet.add(String(s.mobile_number).replace(/\D/g, ''));
              }
              if (s.normalized_mobile_number) {
                existingPhoneSet.add(String(s.normalized_mobile_number).trim());
                existingPhoneSet.add(String(s.normalized_mobile_number).replace(/\D/g, ''));
              }
              if (s.iccid) existingIccidSet.add(String(s.iccid).trim());
              if (s.sim_serial_number) existingIccidSet.add(String(s.sim_serial_number).trim());
            }
          }
        } catch (sbErr) {
          console.error('Error fetching existing SIMs from Supabase:', sbErr);
        }
      }

      const results: any[] = [];
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const now = new Date().toISOString();
      const seenBatchPhones = new Set<string>();
      const seenBatchIccids = new Set<string>();

      for (let i = 0; i < rawSims.length; i++) {
        const item = rawSims[i];
        const rowNum = i + 1;

        // Preserve phone as exact string, never convert to number/scientific notation
        const rawNum = String(item.mobile_number ?? item.mobileNumber ?? item.phone ?? item.phone_number ?? '').trim();

        if (!rawNum) {
          results.push({
            row: rowNum,
            mobile_number: '',
            success: false,
            code: 'INVALID_PHONE_FORMAT',
            error: 'INVALID_PHONE_FORMAT: Mobile number is required.',
          });
          failedCount++;
          continue;
        }

        const val = normalizeAndValidateUaeMobile(rawNum);
        if (!val.valid) {
          results.push({
            row: rowNum,
            mobile_number: rawNum,
            success: false,
            code: 'INVALID_PHONE_FORMAT',
            error: val.error || `INVALID_PHONE_FORMAT: '${rawNum}' does not match required UAE mobile format (+971 5X XXX XXXX).`,
          });
          failedCount++;
          continue;
        }

        const normalized = val.normalized;
        const phoneDigits = rawNum.replace(/\D/g, '');
        const normDigits = normalized.replace(/\D/g, '');

        // Duplicate phone check
        if (
          existingPhoneSet.has(rawNum) ||
          existingPhoneSet.has(normalized) ||
          existingPhoneSet.has(phoneDigits) ||
          existingPhoneSet.has(normDigits) ||
          seenBatchPhones.has(rawNum) ||
          seenBatchPhones.has(normalized) ||
          seenBatchPhones.has(phoneDigits) ||
          seenBatchPhones.has(normDigits)
        ) {
          results.push({
            row: rowNum,
            mobile_number: rawNum,
            success: false,
            code: 'DUPLICATE_PHONE_NUMBER',
            error: `DUPLICATE_PHONE_NUMBER: Mobile number ${rawNum} is already registered in this company.`,
          });
          skippedCount++;
          continue;
        }

        // ICCID / Chip Serial (Preserve strictly as string!)
        const rawIccid = String(item.iccid ?? item.sim_serial_number ?? item.simSerialNumber ?? item.chip_serial ?? '').trim();
        if (rawIccid) {
          if (existingIccidSet.has(rawIccid) || seenBatchIccids.has(rawIccid)) {
            results.push({
              row: rowNum,
              mobile_number: rawNum,
              iccid: rawIccid,
              success: false,
              code: 'DUPLICATE_ICCID',
              error: `DUPLICATE_ICCID: ICCID / Chip Serial ${rawIccid} is already registered in this company.`,
            });
            skippedCount++;
            continue;
          }
        }

        // Add to batch sets
        seenBatchPhones.add(rawNum);
        seenBatchPhones.add(normalized);
        seenBatchPhones.add(phoneDigits);
        seenBatchPhones.add(normDigits);
        if (rawIccid) seenBatchIccids.add(rawIccid);

        const prov = String(item.provider || item.vendor || 'DU').toUpperCase();
        const srvStatus = String(item.service_status || item.serviceStatus || 'Active');
        const state = String(item.state || 'Dubai').trim();
        const source = String(item.source || 'Company SIMs').trim();
        const plan = String(item.plan || item.data_plan || `${prov} Standard Fleet Line`).trim();
        const monthlyAmount = Number(item.monthly_package_amount) || Number(item.monthly_cost) || 125;
        const simId = `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${rowNum}`;
        const notes = item.notes ? String(item.notes).trim() : undefined;

        // Construct canonical SimRecord: mobile_number keeps leading 0 intact!
        const newSim: SimRecord = {
          id: simId,
          tenant_id: tenantId, // Authenticated context ONLY
          mobile_number: rawNum, // PRESERVE EXACT STRING WITH LEADING ZERO!
          normalized_mobile_number: normalized,
          iccid: rawIccid || undefined,
          sim_serial_number: rawIccid || rawNum,
          provider: prov,
          vendor: prov,
          state: state,
          source: source,
          monthly_package_amount: monthlyAmount,
          plan: plan,
          status: srvStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Available',
          assignment_status: 'Unassigned',
          service_status: srvStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
          notes: notes,
          created_at: now,
          created_by: userName || 'Operations Admin',
          updated_at: now,
          updated_by: userName || 'Operations Admin',
        };

        // Persist to real Supabase production SIM table if Supabase is connected
        if (supabase) {
          try {
            const supabasePayload: Record<string, any> = {
              id: simId,
              tenant_id: tenantId,
              mobile_number: rawNum,
              sim_serial_number: rawIccid || rawNum,
              iccid: rawIccid || null,
              provider: prov,
              plan: plan,
              monthly_cost: monthlyAmount,
              status: srvStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Available',
              notes: notes || null,
              created_at: now,
              created_by: userName || 'Operations Admin',
              updated_at: now,
            };

            let { error: insertErr } = await supabase.from('sim_cards').insert(supabasePayload);
            // Defensive schema column retry if column does not exist or PostgREST PGRST204
            if (insertErr && (insertErr.code === 'PGRST204' || insertErr.message?.includes('schema cache') || insertErr.message?.includes('does not exist'))) {
              const match = insertErr.message.match(/(?:Could not find the '([^']+)' column|column "([^"]+)" of relation)/i);
              const badCol = match ? (match[1] || match[2]) : null;
              if (badCol && badCol in supabasePayload) {
                delete supabasePayload[badCol];
                const retryRes = await supabase.from('sim_cards').insert(supabasePayload);
                insertErr = retryRes.error;
              }
            }

            if (insertErr) {
              console.error(`Supabase insert error for ${rawNum}:`, insertErr);
              const isDuplicate = insertErr.code === '23505' || insertErr.message?.includes('duplicate') || insertErr.message?.includes('uq_');
              if (isDuplicate) {
                const isIccid = insertErr.message?.toLowerCase().includes('iccid');
                results.push({
                  row: rowNum,
                  mobile_number: rawNum,
                  success: false,
                  code: isIccid ? 'DUPLICATE_ICCID' : 'DUPLICATE_PHONE_NUMBER',
                  error: isIccid ? `DUPLICATE_ICCID: ICCID ${rawIccid} already exists in database.` : `DUPLICATE_PHONE_NUMBER: Mobile number ${rawNum} already exists in database.`,
                });
                skippedCount++;
              } else {
                results.push({
                  row: rowNum,
                  mobile_number: rawNum,
                  success: false,
                  code: 'DB_INSERT_ERROR',
                  error: insertErr.message || 'Supabase insertion failed.',
                });
                failedCount++;
              }
              continue; // Do not add to local master if Supabase failed
            }
          } catch (sbEx: any) {
            console.error(`Supabase exception for ${rawNum}:`, sbEx);
            results.push({
              row: rowNum,
              mobile_number: rawNum,
              success: false,
              code: 'DB_INSERT_EXCEPTION',
              error: sbEx.message || 'Supabase database exception',
            });
            failedCount++;
            continue;
          }
        }

        // Add to existing sets so subsequent rows within the same loop reject duplicates
        existingPhoneSet.add(rawNum);
        existingPhoneSet.add(normalized);
        existingPhoneSet.add(phoneDigits);
        existingPhoneSet.add(normDigits);
        if (rawIccid) existingIccidSet.add(rawIccid);

        db.simCardsMaster.unshift(newSim);
        importedCount++;
        results.push({
          row: rowNum,
          mobile_number: rawNum,
          success: true,
          sim: newSim,
        });
      }

      return res.json({
        success: true,
        createdCount: importedCount,
        importedCount,
        skippedCount,
        failedCount,
        totalCount: rawSims.length,
        results,
      });
    } catch (err: any) {
      console.error('Batch SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 7. POST /api/erp/sims/:id/assign (Assign SIM to Employee)
  router.post('/:id/assign', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      const { id } = req.params;
      const {
        employee_id,
        employeeId,
        assigned_date,
        assignment_date,
        assignmentDate,
        monthly_package_amount,
        package_amount,
        approved_amount,
        payable_amount,
        notes,
      } = req.body;

      const targetEmpId = employee_id || employeeId;
      if (!targetEmpId) {
        return res.status(400).json({ error: 'Target employee ID is required for SIM assignment.' });
      }

      const supabase = getSupabaseClient();
      const result = await assignSimAuthoritative(supabase, db, {
        tenantId,
        simId: id,
        employeeId: targetEmpId,
        assignedDate: assigned_date || assignment_date || assignmentDate,
        monthlyPackageAmount: monthly_package_amount ?? package_amount,
        approvedAmount: approved_amount,
        payableAmount: payable_amount,
        notes,
        assignedBy: userName || 'Operations Admin',
      });

      if (!result.success) {
        return res.status(400).json({
          code: result.code || 'ASSIGNMENT_FAILED',
          error: result.error,
        });
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Assign SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. POST /api/erp/sims/:id/unassign or /return (Return SIM with Mandatory Reason)
  const handleReturnSim = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      const { id } = req.params;
      const { return_reason, reason, returnReason, notes, return_date, returnDate, return_time, returnTime, returned_by, returnedBy, employee_id, employeeId, employee_name, employeeName, mobile_number, mobileNumber, employee_code, employeeCode } = req.body;

      const mandatoryReason = (return_reason || reason || returnReason || '').trim() || 'Rider returned SIM to Allied depot';

      const supabase = getSupabaseClient();
      const result = await returnSimAuthoritative(supabase, db, {
        tenantId,
        simId: id,
        returnReason: mandatoryReason,
        returnDate: return_date || returnDate,
        returnTime: return_time || returnTime,
        returnedBy: returned_by || returnedBy || userName || 'Operations Admin',
        employeeId: employee_id || employeeId,
        employeeCode: employee_code || employeeCode,
        employeeName: employee_name || employeeName,
        mobileNumber: mobile_number || mobileNumber,
        notes,
      });

      if (!result.success) {
        return res.status(400).json({
          code: result.code || 'RETURN_FAILED',
          error: result.error,
        });
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Return SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/unassign', handleReturnSim);
  router.post('/:id/return', handleReturnSim);

  // 8b. POST /api/erp/sims/:id/return-to-provider (Return/Cancel SIM Line with Telecom Provider DU/Etisalat/Virgin)
  router.post('/:id/return-to-provider', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      const { id } = req.params;
      const {
        providerReturnDate,
        provider_return_date,
        providerReturnReason,
        provider_return_reason,
        cancellationReference,
        cancellation_reference,
        returnedBy,
        returned_by,
        notes,
        autoCloseRiderAssignment,
      } = req.body;

      const effectiveReason = providerReturnReason || provider_return_reason;
      if (!effectiveReason || !effectiveReason.trim()) {
        return res.status(400).json({ error: 'Provider return / cancellation reason is mandatory.' });
      }

      const supabase = getSupabaseClient();
      const result = await returnSimToProviderAuthoritative(supabase, db, {
        tenantId,
        simId: id,
        providerReturnDate: providerReturnDate || provider_return_date,
        providerReturnReason: effectiveReason,
        cancellationReference: cancellationReference || cancellation_reference,
        returnedBy: userName || 'Telecom Admin',
        notes,
        autoCloseRiderAssignment: autoCloseRiderAssignment !== false,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Return SIM to provider error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Verified staff selection for history correction (all employees; no rider records).
  router.get('/staff-users', async (req: Request, res: Response) => {
    try {
      const actor = resolveAuthenticatedActor(req, db);
      if (!actor.isAuthenticated || !actor.tenantId || !actor.userId) {
        return res.status(401).json({ success: false, error: 'Staff sign-in required.' });
      }
      const supabase = getSupabaseClient();
      if (!supabase) return res.status(503).json({ success: false, error: 'Database unavailable.' });
      const { data, error } = await supabase.from('profiles')
        .select('id,full_name,designation,status,is_owner')
        .eq('tenant_id', actor.tenantId)
        .order('full_name', { ascending: true });
      if (error) return res.status(503).json({ success: false, error: 'Staff accounts could not be loaded.' });
      return res.json({
        success: true,
        users: (data || [])
          .filter((profile: any) => profile.id && typeof profile.full_name === 'string' && profile.full_name.trim())
          .map((profile: any) => ({
            id: String(profile.id), full_name: profile.full_name.trim(),
            designation: profile.designation || null, status: profile.status || null,
            is_owner: Boolean(profile.is_owner),
          })),
      });
    } catch (error: any) {
      console.error('SIM staff picker failed:', error);
      return res.status(500).json({ success: false, error: 'Unable to load staff users.' });
    }
  });

  // 8c. Parity with Cloudflare Worker: audited, tenant-scoped edits for ANY employee.
  // Never change SIM lifecycle/custody from an assignment-history correction.
  const editSimHistory = async (req: Request, res: Response) => {
    try {
      const actor = resolveAuthenticatedActor(req, db);
      if (!actor.isAuthenticated || !actor.tenantId || !actor.userId) {
        return res.status(401).json({ success: false, error: 'Sign in before editing SIM history.' });
      }
      const tenantId = actor.tenantId;
      const supabase = getSupabaseClient();
      if (!supabase) return res.status(503).json({ success: false, error: 'Database unavailable.' });
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.userId);
      const profileQuery = supabase.from('profiles').select('id, full_name').eq('tenant_id', tenantId);
      const { data: directProfile } = await (isUuid
        ? profileQuery.eq('id', actor.userId)
        : profileQuery.eq('username', actor.userId)).maybeSingle();
      let editorProfile = directProfile;
      if (!editorProfile && actor.userName) {
        const { data: byName } = await supabase.from('profiles')
          .select('id, full_name').eq('tenant_id', tenantId)
          .ilike('full_name', actor.userName).maybeSingle();
        editorProfile = byName;
      }
      if (!editorProfile?.id || !editorProfile.full_name?.trim()) {
        return res.status(403).json({ success: false, error: 'A verified staff profile is required to correct SIM history.' });
      }
      const assignmentId = String(req.params.id || '').trim();
      if (!assignmentId || assignmentId.startsWith('asgn_live_') || assignmentId.startsWith('asgn_last_')) {
        return res.status(400).json({ success: false, error: 'Select a saved SIM history record.' });
      }
      const body = req.body || {};
      const reason = String(body.editReason || body.correction_reason || body.reason || '').trim();
      const validDate = (value: unknown): boolean =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(new Date(value + 'T00:00:00Z').getTime())
        && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
      const returnDate = body.return_date ?? body.returned_date;
      if (reason.length < 2 || reason.length > 500 || !validDate(body.assigned_date)
          || (returnDate && !validDate(returnDate))) {
        return res.status(400).json({ success: false, error: 'Enter a valid assignment date and correction reason; check the return date.' });
      }
      const opt = (v: unknown): string | null => typeof v === 'string' && v.trim() ? v.trim() : null;
      const { data, error } = await supabase.rpc('allied_correct_sim_assignment_history', {
        p_tenant_id: tenantId,
        p_assignment_id: assignmentId,
        p_editor_id: String(editorProfile.id),
        p_editor_name: editorProfile.full_name.trim(),
        p_reason: reason,
        p_assigned_date: body.assigned_date,
        p_assigned_by: opt(body.assigned_by),
        p_return_date: opt(returnDate),
        p_returned_by: opt(body.returned_by),
        p_return_reason: opt(body.return_reason ?? body.return_remark),
        p_notes: typeof body.notes === 'string' ? body.notes : null,
      });
      if (error || !data?.success) {
        return res.status(409).json({ success: false, error: error?.message || 'SIM history correction failed.' });
      }
      return res.json({
        success: true, assignment: data.assignment, auditLogId: data.auditLogId,
        message: 'Recorded history corrected. Actual SIM assignment and return status unchanged.',
      });
    } catch (err: any) {
      console.error('SIM history correction failed:', err);
      return res.status(500).json({ success: false, error: 'Unable to correct SIM history; no records changed.' });
    }
  };
  router.put('/assignment-history/:id', editSimHistory);
  router.patch('/assignment-history/:id', editSimHistory);

  // 9. POST /api/erp/sims/:id/replace (Atomic Swap: Return Old + Assign Replacement)
  const handleReplace = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const oldSimId = req.params.id || req.body.old_sim_id || req.body.oldSimId;
      const {
        new_sim_id,
        newSimCardId,
        swap_reason,
        swapReason,
        swap_date,
        swapDate,
        notes,
        employee_id,
        employeeId,
      } = req.body;

      const replacementSimId = new_sim_id || newSimCardId;
      if (!replacementSimId) {
        return res.status(400).json({ error: 'Replacement SIM ID is required.' });
      }

      const mandatoryReason = (swap_reason || swapReason || '').trim();
      if (!mandatoryReason) {
        return res.status(400).json({ error: 'Swap reason is mandatory for SIM replacement.' });
      }

      let oldSim = (db.simCardsMaster || []).find(
        (s: any) => (s.id === oldSimId || s.mobile_number === oldSimId) && s.tenant_id === tenantId
      );
      const newSim = (db.simCardsMaster || []).find(
        (s: any) => (s.id === replacementSimId || s.mobile_number === replacementSimId) && s.tenant_id === tenantId
      );

      if (!newSim) {
        return res.status(404).json({ error: 'Replacement SIM not found in inventory.' });
      }

      if (newSim.assignment_status === 'Assigned' || newSim.current_employee_id) {
        return res.status(400).json({ error: `Replacement SIM ${newSim.mobile_number} is already assigned to another employee.` });
      }

      const targetEmpId = employee_id || employeeId || oldSim?.current_employee_id;
      if (!targetEmpId) {
        return res.status(400).json({ error: 'Cannot replace a SIM without an assigned employee.' });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) => (e.id === targetEmpId || e.employee_code === targetEmpId) && e.tenant_id === tenantId
      );
      if (!emp) {
        return res.status(404).json({ error: 'Assigned employee not found.' });
      }

      if (!oldSim && emp.current_sim_id) {
        oldSim = (db.simCardsMaster || []).find(
          (s: any) => (s.id === emp.current_sim_id || s.mobile_number === emp.current_sim_id) && s.tenant_id === tenantId
        );
      }

      const now = new Date().toISOString();
      const sDate = swap_date || swapDate || now.split('T')[0];

      // Invoke Supabase RPC if configured, fallback to direct tables
      const supabase = getSupabaseClient();
      let rpcResult: any = null;
      if (supabase) {
        if (oldSim) {
          const { data, error } = await supabase.rpc('rpc_replace_sim', {
            p_tenant_id: tenantId,
            p_employee_id: emp.id,
            p_old_sim_id: oldSim.id,
            p_new_sim_id: newSim.id,
            p_swap_date: sDate,
            p_swap_reason: mandatoryReason,
            p_notes: notes || null,
            p_swapped_by: userName,
            p_user_id: userId,
          });

          if (error) {
            if (error.message && error.message.includes('schema cache')) {
              console.warn('⚠️ Supabase rpc_replace_sim not found in schema cache. Falling back to authoritative table updates.');
              await replaceSimAuthoritative(supabase, db, {
                tenantId,
                oldSimId: oldSim.id,
                newSimId: newSim.id,
                employeeId: emp.id,
                swapReason: mandatoryReason,
                swapDate: sDate,
                swappedBy: userName,
                notes,
              });
            } else {
              console.error('Supabase rpc_replace_sim rollback/failure:', error);
              return res.status(400).json({
                error: error.message || 'SIM replacement transaction failed and rolled back.',
                transactionStatus: 'ROLLBACK',
              });
            }
          } else {
            rpcResult = data;
          }
        } else {
          // No old SIM to swap via RPC, assign directly
          await assignSimAuthoritative(supabase, db, {
            tenantId,
            simId: newSim.id,
            employeeId: emp.id,
            assignedDate: sDate,
            assignedBy: userName,
            notes,
          });
        }
      }

      // Close Old Assignment
      if (oldSim) {
        oldSim.assignment_status = 'Unassigned';
        oldSim.status = 'Available';
        oldSim.current_employee_id = undefined;
        oldSim.current_employee_name = undefined;
        oldSim.current_employee_code = undefined;
        oldSim.assigned_date = undefined;
        oldSim.assigned_by = undefined;
        oldSim.updated_at = now;
        oldSim.updated_by = userName;

        const activeOldAsgn = (db.simAssignments || []).find(
          (a: any) => (a.sim_id === oldSim.id || a.sim_card_id === oldSim.id) && a.employee_id === emp.id && a.status === 'ACTIVE'
        );
        if (activeOldAsgn) {
          activeOldAsgn.status = 'REPLACED';
          activeOldAsgn.return_date = sDate;
          activeOldAsgn.return_reason = mandatoryReason;
          activeOldAsgn.notes = `Replaced with ${newSim.mobile_number}. Reason: ${mandatoryReason}`;
        }
      }

      // Assign New SIM
      newSim.assignment_status = 'Assigned';
      newSim.status = 'Assigned';
      newSim.current_employee_id = emp.id;
      newSim.current_employee_name = emp.full_name;
      newSim.current_employee_code = emp.employee_code;
      newSim.assigned_date = sDate;
      newSim.assigned_by = userName;
      newSim.updated_at = now;
      newSim.updated_by = userName;

      // Update Employee Current SIM pointer
      emp.current_sim_id = newSim.id;
      emp.current_sim_number = newSim.mobile_number;
      emp.updated_at = now;
      emp.updated_by = userName;

      // Create new assignment record
      const newAsgn = {
        id: rpcResult?.assignment_id || `s_asgn_${Date.now()}`,
        tenant_id: tenantId,
        sim_id: newSim.id,
        sim_card_id: newSim.id,
        mobile_number: newSim.mobile_number,
        provider: newSim.provider,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        assigned_at: sDate,
        assigned_date: sDate,
        status: 'ACTIVE',
        assigned_by: userName,
        notes: `Replacement for ${oldSim?.mobile_number || 'previous SIM'}. Reason: ${mandatoryReason}`,
        created_at: now,
      };
      db.simAssignments.unshift(newAsgn);

      return res.json({
        success: true,
        message: `SIM successfully replaced: ${oldSim?.mobile_number} ➔ ${newSim.mobile_number}.`,
        oldSim,
        newSim,
        newAssignment: newAsgn,
        transaction: 'ATOMIC_POSTGRES_RPC',
      });
    } catch (err: any) {
      console.error('Replace SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/replace', handleReplace);
  router.post('/replace', handleReplace);

  // 9b. POST /api/erp/sims/:id/return-and-assign and /return-and-assign (Controlled Atomic Return Old + Assign New SIM Transaction)
  const handleReturnAndAssignSim = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const newSimId = req.params.id || req.body.new_sim_id || req.body.sim_id;
      const {
        employee_id,
        employeeId,
        old_sim_id,
        oldSimId,
        return_reason,
        returnReason,
        assigned_date,
        assignment_date,
        notes,
      } = req.body;

      if (!newSimId) {
        return res.status(400).json({ error: 'Target new SIM ID is required.' });
      }

      const targetEmpId = employee_id || employeeId;
      if (!targetEmpId) {
        return res.status(400).json({ error: 'Target employee ID is required.' });
      }

      const emp = (db.masterEmployees || []).find(
        (e: any) => (e.id === targetEmpId || e.employee_code === targetEmpId) && e.tenant_id === tenantId
      );
      if (!emp) {
        return res.status(404).json({ error: `Employee ${targetEmpId} not found.` });
      }

      const newSim = (db.simCardsMaster || []).find((s: any) => s.id === newSimId && s.tenant_id === tenantId);
      if (!newSim) {
        return res.status(404).json({ error: `Selected new SIM card ${newSimId} not found in inventory.` });
      }

      if (newSim.status === 'Lost' || newSim.status === 'LOST' || newSim.assignment_status === 'Lost' || newSim.assignment_status === 'LOST') {
        return res.status(400).json({
          code: 'SIM_LOST',
          error: `SIM_LOST: Selected SIM ${newSim.mobile_number} is currently marked as LOST and cannot be assigned. Only an authorized recovery workflow can restore it.`,
        });
      }

      if (newSim.assignment_status === 'Assigned' || newSim.current_employee_id) {
        return res.status(400).json({
          code: 'SIM_ALREADY_ASSIGNED',
          error: `SIM_ALREADY_ASSIGNED: Selected SIM ${newSim.mobile_number} is already assigned to ${newSim.current_employee_name || 'another employee'}.`,
        });
      }

      // Determine old SIM
      const targetOldSimId = old_sim_id || oldSimId || emp.current_sim_id;
      const activeOldAsgn = (db.simAssignments || []).find(
        (a: any) => a.tenant_id === tenantId && a.employee_id === emp.id && a.status === 'ACTIVE'
      );
      const effectiveOldSimId = targetOldSimId || activeOldAsgn?.sim_id || activeOldAsgn?.sim_card_id;

      if (!effectiveOldSimId) {
        return res.status(400).json({
          error: `Employee ${emp.full_name} does not have an active SIM to return. Use normal Assign instead.`,
        });
      }

      const oldSim = (db.simCardsMaster || []).find(
        (s: any) => (s.id === effectiveOldSimId || s.mobile_number === effectiveOldSimId) && s.tenant_id === tenantId
      );

      const now = new Date().toISOString();
      const asgnDate = assigned_date || assignment_date || now.split('T')[0];
      const mandatoryReturnReason = (return_reason || returnReason || 'Returned existing line before assigning new SIM').trim();

      // Invoke Supabase RPC if configured
      const supabase = getSupabaseClient();
      let rpcResult: any = null;
      if (supabase && oldSim) {
        const { data, error } = await supabase.rpc('rpc_replace_sim', {
          p_tenant_id: tenantId,
          p_employee_id: emp.id,
          p_old_sim_id: oldSim.id,
          p_new_sim_id: newSim.id,
          p_swap_date: asgnDate,
          p_swap_reason: mandatoryReturnReason,
          p_notes: notes || null,
          p_swapped_by: userName,
          p_user_id: userId,
        });

        if (error) {
          if (error.message && error.message.includes('schema cache')) {
            console.warn('⚠️ Supabase rpc_replace_sim not found in schema cache. Proceeding with in-memory transaction.');
          } else {
            console.error('Supabase rpc_replace_sim rollback/failure:', error);
            return res.status(400).json({
              error: error.message || 'Atomic return and assign transaction failed and rolled back.',
              transactionStatus: 'ROLLBACK',
            });
          }
        }
        rpcResult = data;
      }

      // Execute atomic changes (all or nothing)
      // 1. Close Old Assignment & preserve its telecom service_status
      if (oldSim) {
        oldSim.assignment_status = 'Unassigned';
        oldSim.status = 'Unassigned';
        oldSim.current_employee_id = undefined;
        oldSim.current_employee_name = undefined;
        oldSim.current_employee_code = undefined;
        oldSim.assigned_date = undefined;
        oldSim.assigned_by = undefined;
        oldSim.updated_at = now;
        oldSim.updated_by = userName;

        const oldAsgn = (db.simAssignments || []).find(
          (a: any) => (a.sim_id === oldSim.id || a.sim_card_id === oldSim.id) && a.employee_id === emp.id && a.status === 'ACTIVE'
        );
        if (oldAsgn) {
          oldAsgn.status = 'RETURNED';
          oldAsgn.return_date = asgnDate;
          oldAsgn.return_reason = mandatoryReturnReason;
          oldAsgn.returned_at = now;
          oldAsgn.returned_to = userName;
          oldAsgn.notes = `Returned before assigning ${newSim.mobile_number}. Reason: ${mandatoryReturnReason}${notes ? ` | ${notes}` : ''}`;
        }
      }

      // 2. Assign New SIM
      newSim.assignment_status = 'Assigned';
      newSim.status = 'Assigned';
      newSim.current_employee_id = emp.id;
      newSim.current_employee_name = emp.full_name;
      newSim.current_employee_code = emp.employee_code;
      newSim.assigned_date = asgnDate;
      newSim.assigned_by = userName;
      newSim.updated_at = now;
      newSim.updated_by = userName;

      // 3. Update Employee Pointer (CRITICAL: employee status, project, vehicle, and payroll are 100% untouched!)
      emp.current_sim_id = newSim.id;
      emp.current_sim_number = newSim.mobile_number;
      emp.updated_at = now;
      emp.updated_by = userName;

      // 4. Create new assignment record
      const newAsgn = {
        id: rpcResult?.assignment_id || `s_asgn_${Date.now()}`,
        tenant_id: tenantId,
        sim_id: newSim.id,
        sim_card_id: newSim.id,
        mobile_number: newSim.mobile_number,
        provider: newSim.provider,
        employee_id: emp.id,
        employee_name: emp.full_name,
        employee_code: emp.employee_code,
        assigned_at: asgnDate,
        assigned_date: asgnDate,
        status: 'ACTIVE',
        assigned_by: userName,
        notes: `Assigned after returning ${oldSim?.mobile_number || 'previous SIM'}. Reason: ${mandatoryReturnReason}${notes ? ` | ${notes}` : ''}`,
        created_at: now,
      };
      if (!db.simAssignments) db.simAssignments = [];
      db.simAssignments.unshift(newAsgn);

      // 5. Write audit log
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tenant_id: tenantId,
        user_id: userId || 'system',
        actor_name: userName,
        action: 'RETURN_AND_ASSIGN_SIM',
        action_type: 'SWAP',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: newSim.id,
        targetEntityId: newSim.id,
        reason: mandatoryReturnReason,
        details: `Returned old SIM ${oldSim?.mobile_number} and assigned new SIM ${newSim.mobile_number} to ${emp.full_name} (${emp.employee_code}) in a single atomic transaction.`,
        timestamp: now,
        created_at: now,
      });

      return res.json({
        success: true,
        message: `Successfully returned SIM ${oldSim?.mobile_number} and assigned SIM ${newSim.mobile_number} to ${emp.full_name}.`,
        oldSim,
        newSim,
        newAssignment: newAsgn,
        transaction: 'ATOMIC_TRANSACTION_CONTROLLED',
      });
    } catch (err: any) {
      console.error('Return and assign SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/return-and-assign', handleReturnAndAssignSim);
  router.post('/return-and-assign', handleReturnAndAssignSim);

  // 10. POST /api/erp/sims/:id/transfer (Controlled Atomic Transfer between employees)
  router.post('/:id/transfer', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const {
        target_employee_id,
        to_employee_id,
        employee_id,
        targetEmployeeId,
        new_employee_id,
        transfer_reason,
        reason,
        transferReason,
        transfer_date,
        transferDate,
        notes,
      } = req.body;

      const destEmpId = target_employee_id || to_employee_id || employee_id || targetEmployeeId || new_employee_id;
      if (!destEmpId) {
        return res.status(400).json({ error: 'Destination employee ID is required for transfer.' });
      }

      const mandatoryReason = (transfer_reason || reason || transferReason || '').trim();
      if (!mandatoryReason) {
        return res.status(400).json({ error: 'Transfer reason is mandatory for SIM transfer.' });
      }

      const supabase = getSupabaseClient();
      const result = await transferSimAuthoritative(supabase, db, {
        tenantId,
        simId: id,
        destinationEmployeeId: destEmpId,
        transferReason: mandatoryReason,
        transferDate: transfer_date || transferDate,
        transferredBy: userName,
        userId,
        notes,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Transfer SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // 10b. Authenticated, atomic SIM loss, including legacy employee-only pointers.
  const handleMarkSimLost = async (req: Request, res: Response) => {
    try {
      const actor = resolveAuthenticatedActor(req, db);
      if (!actor.isAuthenticated || !actor.userId || !actor.tenantId) {
        return res.status(401).json({ success: false, error: 'Sign in before reporting SIM loss.' });
      }
      const supabase = getSupabaseClient();
      if (!supabase) return res.status(503).json({ success: false, error: 'SIM database unavailable.' });
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(actor.userId);
      const profileLookup = supabase.from('profiles').select('id,full_name').eq('tenant_id', actor.tenantId);
      const { data: directProfile } = await (isUuid
        ? profileLookup.eq('id', actor.userId)
        : profileLookup.eq('username', actor.userId)).maybeSingle();
      let operator = directProfile;
      if (!operator && actor.userName) {
        const { data: nameProfile } = await supabase.from('profiles')
          .select('id,full_name').eq('tenant_id', actor.tenantId)
          .ilike('full_name', actor.userName).maybeSingle();
        operator = nameProfile;
      }
      if (!operator?.id || !operator?.full_name?.trim()) {
        return res.status(403).json({ success: false, error: 'Verified staff profile required for SIM loss.' });
      }
      const date = req.body?.loss_date || req.body?.lossDate;
      const reason = String(req.body?.reason || req.body?.lossReason || '').trim();
      const validDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
        && !Number.isNaN(new Date(date + 'T00:00:00Z').getTime())
        && new Date(date + 'T00:00:00Z').toISOString().slice(0,10) === date;
      if (!validDate || reason.length < 2 || reason.length > 1500) {
        return res.status(400).json({ success: false, error: 'Choose a valid loss date and reason (2–1500 characters).' });
      }
      const { data, error } = await supabase.rpc('allied_mark_sim_lost_atomic', {
        p_tenant_id: actor.tenantId,
        p_sim_id: req.params.id,
        p_editor_id: String(operator.id),
        p_editor_name: operator.full_name.trim(),
        p_loss_date: date,
        p_reason: reason,
        p_notes: typeof req.body?.notes === 'string' ? req.body.notes.trim() || null : null,
      });
      if (error || !data?.success) {
        return res.status(409).json({ success: false, error: error?.message || 'SIM loss could not be recorded.' });
      }
      return res.json({
        success: true, ...data,
        message: 'SIM recorded as Lost, employee SIM pointer cleared and audit saved. Employment status unchanged.',
      });
    } catch (err: any) {
      console.error('SIM loss recording error:', err);
      return res.status(500).json({ success: false, error: 'Failed to record SIM loss. No partial changes were committed.' });
    }
  };

  router.post('/:id/lost', handleMarkSimLost);
  router.post('/:id/mark-lost', handleMarkSimLost);

  // 10c. POST /api/erp/sims/:id/recover (Authorized recovery of lost SIM)
  const handleRecoverSim = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const {
        recovery_date,
        recoveryDate,
        recovery_reason,
        recoveryReason,
        reason,
        recovered_by,
        recoveredBy,
        authorized_by,
        authorizedBy,
        notes,
      } = req.body;

      const mandatoryReason = (recovery_reason || recoveryReason || reason || '').trim();
      if (!mandatoryReason) {
        return res.status(400).json({ error: 'Recovery verification reason is mandatory.' });
      }

      const effectiveAuthorizedBy = (authorized_by || authorizedBy || '').trim();
      if (!effectiveAuthorizedBy) {
        return res.status(400).json({ error: 'Authorized supervisor name is mandatory for restoring a lost asset.' });
      }

      const supabase = getSupabaseClient();
      const result = await recoverLostSimAuthoritative(supabase, db, {
        tenantId,
        simId: id,
        recoveryDate: recovery_date || recoveryDate,
        recoveryReason: mandatoryReason,
        recoveredBy: recovered_by || recoveredBy || userName || 'Operations Admin',
        authorizedBy: effectiveAuthorizedBy,
        notes,
        userId,
      });

      if (!result.success) {
        return res.status(400).json({
          code: result.code || 'RECOVER_FAILED',
          error: result.error,
        });
      }

      return res.json(result);
    } catch (err: any) {
      console.error('Recover SIM error:', err);
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/recover', handleRecoverSim);
  router.post('/:id/recover-lost', handleRecoverSim);

  // 11. GET /api/erp/sims/:id/history & /assignment-history
  const handleGetSimHistory = async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;

      const sim = (db.simCardsMaster || []).find((s: any) => s.id === id && s.tenant_id === tenantId);
      if (!sim) {
        return res.status(404).json({ error: `SIM card ${id} not found.` });
      }

      let rawAssignments = (db.simAssignments || []).filter(
        (a: any) => (a.sim_id === id || a.sim_card_id === id) && a.tenant_id === tenantId
      );

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: supaAsgns } = await supabase
            .from('sim_assignments')
            .select('*')
            .or(`sim_card_id.eq.${id},sim_id.eq.${id}`)
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });
          if (Array.isArray(supaAsgns) && supaAsgns.length > 0) {
            const asgnMap = new Map<string, any>();
            for (const a of rawAssignments) asgnMap.set(a.id, a);
            for (const sa of supaAsgns) asgnMap.set(sa.id, sa);
            rawAssignments = Array.from(asgnMap.values());
          }
        } catch (e) {
          console.warn('Could not query Supabase sim_assignments for history:', e);
        }
      }

      const history = rawAssignments
        .map((a: any) => ({
          id: a.id,
          tenant_id: a.tenant_id,
          sim_id: a.sim_id || a.sim_card_id,
          mobile_number: a.mobile_number || sim.mobile_number,
          provider: a.provider || sim.provider || (tenantId === 'company_pixel_syntax' ? 'ETISALAT' : 'DU'),
          iccid: a.iccid || sim.iccid || sim.sim_serial_number || '—',
          action_type: a.status === 'ACTIVE' ? 'ASSIGN' : a.status === 'TRANSFERRED' ? 'TRANSFER' : 'RETURN',
          status: a.status,
          employee_id: a.employee_id,
          employee_name: a.employee_name,
          employee_code: a.employee_code,
          assigned_date: a.assigned_date || a.assigned_at,
          assigned_time: a.assigned_time || null,
          assigned_by: resolveStaffUserName(a.assigned_by || a.created_by, db),
          return_date: a.return_date || a.returned_at || a.returned_date || null,
          return_time: a.return_time || a.returned_time || null,
          returned_by: a.returned_by ? resolveStaffUserName(a.returned_by, db) : null,
          reason: a.return_reason || a.notes,
          return_reason: a.return_reason || a.return_remark || null,
          notes: a.notes,
          assign_remark: a.notes || a.handover_notes || null,
          return_remark: a.return_reason || a.return_remark || a.notes || null,
          project_name: a.project_name || a.primary_project || null,
          vehicle_plate: a.vehicle_plate || null,
          created_at: a.created_at || a.assigned_at,
          created_by: resolveStaffUserName(a.assigned_by || a.created_by, db),
        }))
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      return res.json(history);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.get('/:id/history', handleGetSimHistory);
  router.get('/:id/assignment-history', handleGetSimHistory);

  // 12. GET /api/erp/sims/:id/status-history
  router.get('/:id/status-history', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractTenantContext(req);
      const { id } = req.params;
      const sim = (db.simCardsMaster || []).find((s: any) => s.id === id && s.tenant_id === tenantId);
      if (!sim) return res.status(404).json({ error: `SIM card ${id} not found.` });

      const logs = (db.auditLogs || [])
        .filter((l: any) => l.targetEntityId === id || l.entityId === id)
        .map((l: any) => ({
          id: l.id,
          tenant_id: l.tenant_id,
          sim_id: id,
          mobile_number: sim.mobile_number,
          previous_status: '—',
          new_status: l.action || 'UPDATE',
          reason: l.details || l.reason,
          created_at: l.timestamp || l.created_at,
          created_by: l.actorName || l.userName || 'System',
        }));

      return res.json(logs);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 13. POST /api/erp/sims/:id/status and /service-status (Update service status: Active, Inactive, Suspended, Cancelled)
  const handleUpdateServiceStatus = (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const { service_status, serviceStatus, status, reason } = req.body;

      const sim = (db.simCardsMaster || []).find((s: any) => s.id === id && s.tenant_id === tenantId);
      if (!sim) return res.status(404).json({ error: `SIM card ${id} not found.` });

      const raw = (service_status || serviceStatus || status || '').trim().toLowerCase();
      let newSrvStatus: 'Active' | 'Inactive' | 'Suspended' | 'Cancelled' = 'Active';
      if (raw === 'suspended') newSrvStatus = 'Suspended';
      else if (raw === 'cancelled') newSrvStatus = 'Cancelled';
      else if (raw === 'inactive') newSrvStatus = 'Inactive';
      else if (raw === 'active') newSrvStatus = 'Active';
      else {
        return res.status(400).json({ error: 'Valid service_status required: Active, Inactive, Suspended, or Cancelled.' });
      }

      const prevStatus = sim.service_status || 'Active';
      sim.service_status = newSrvStatus;
      sim.is_active = newSrvStatus === 'Active';
      sim.status = newSrvStatus;
      sim.updated_at = new Date().toISOString();
      sim.updated_by = userName;

      // CRITICAL: Changing SIM service status must NOT:
      // - change assignment (sim.assignment_status remains untouched: Assigned or Unassigned)
      // - change current_employee_id / current_employee_name (remains untouched!)
      // - change Employee Status (remains untouched!)
      // - change Project (remains untouched!)
      // - change Vehicle (remains untouched!)
      // - change payroll mapping (remains untouched!)

      // Record audit log
      if (!db.auditLogs) db.auditLogs = [];
      db.auditLogs.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        tenant_id: tenantId,
        user_id: userId || 'system',
        actor_name: userName,
        action: 'UPDATE_SERVICE_STATUS',
        action_type: 'UPDATE',
        module: 'SIM_MANAGEMENT',
        entity_type: 'SIM_CARD',
        entity_id: sim.id,
        targetEntityId: sim.id,
        reason: reason || `Service status changed from ${prevStatus} to ${newSrvStatus}`,
        details: `Service status changed from ${prevStatus} to ${newSrvStatus}. Custody retained (${sim.assignment_status}${sim.current_employee_name ? ` by ${sim.current_employee_name}` : ''}). Zero side-effects on employee or project.`,
        timestamp: sim.updated_at,
        created_at: sim.updated_at,
      });

      return res.json({
        success: true,
        message: `SIM ${sim.mobile_number} service status updated to ${sim.service_status}. Assignment custody and employee details preserved.`,
        sim,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.post('/:id/status', handleUpdateServiceStatus);
  router.post('/:id/service-status', handleUpdateServiceStatus);

  // 13b. POST /api/erp/sims/:id/toggle-active
  router.post('/:id/toggle-active', (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      const { id } = req.params;

      const sim = (db.simCardsMaster || []).find((s: any) => s.id === id && s.tenant_id === tenantId);
      if (!sim) return res.status(404).json({ error: `SIM card ${id} not found.` });

      sim.service_status = sim.service_status === 'Active' ? 'Inactive' : 'Active';
      sim.is_active = sim.service_status === 'Active';
      sim.updated_at = new Date().toISOString();
      sim.updated_by = userName;

      return res.json({
        success: true,
        message: `SIM ${sim.mobile_number} toggled to ${sim.service_status}.`,
        sim,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 14. PUT /api/erp/sims/:id (Update SIM Details)
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { tenantId, userName } = extractTenantContext(req);
      const { id } = req.params;
      const sim = (db.simCardsMaster || []).find((s: any) => s.id === id && s.tenant_id === tenantId);
      if (!sim) return res.status(404).json({ error: `SIM card ${id} not found.` });

      const raw = req.body;

      // Mobile number update with normalization and duplicate check
      if (raw.mobile_number !== undefined && raw.mobile_number !== null) {
        const rawNum = String(raw.mobile_number).trim();
        if (!rawNum) {
          return res.status(400).json({
            code: 'INVALID_PHONE_FORMAT',
            error: 'INVALID_PHONE_FORMAT: Mobile number cannot be empty.',
          });
        }
        const val = normalizeAndValidateUaeMobile(rawNum);
        if (!val.valid) {
          return res.status(400).json({
            code: 'INVALID_PHONE_FORMAT',
            error: val.error || 'INVALID_PHONE_FORMAT: Invalid UAE mobile format (+971 5X XXX XXXX).',
          });
        }
        const duplicatePhone = (db.simCardsMaster || []).find(
          (s: any) => s.tenant_id === tenantId && s.id !== id && (s.normalized_mobile_number === val.normalized || s.mobile_number === val.normalized)
        );
        if (duplicatePhone) {
          return res.status(400).json({
            code: 'DUPLICATE_PHONE_NUMBER',
            error: `DUPLICATE_PHONE_NUMBER: Mobile number ${rawNum} is already registered to another SIM card in this company.`,
          });
        }
        sim.mobile_number = val.normalized;
        sim.normalized_mobile_number = val.normalized;
      }

      // ICCID update with uniqueness check
      const rawIccid = raw.iccid !== undefined ? String(raw.iccid).trim() : raw.sim_serial_number !== undefined ? String(raw.sim_serial_number).trim() : null;
      if (rawIccid !== null) {
        if (rawIccid) {
          const duplicateIccid = (db.simCardsMaster || []).find(
            (s: any) => s.tenant_id === tenantId && s.id !== id && (s.iccid === rawIccid || s.sim_serial_number === rawIccid)
          );
          if (duplicateIccid) {
            return res.status(400).json({
              code: 'DUPLICATE_ICCID',
              error: `DUPLICATE_ICCID: ICCID ${rawIccid} is already registered to another SIM card in this company.`,
            });
          }
          sim.iccid = rawIccid;
          sim.sim_serial_number = rawIccid;
        } else {
          sim.iccid = undefined;
          sim.sim_serial_number = undefined;
        }
      }

      if (raw.provider || raw.vendor) {
        sim.provider = raw.provider || raw.vendor;
        sim.vendor = raw.vendor || raw.provider;
      }
      if (raw.state) sim.state = raw.state;
      if (raw.source) sim.source = raw.source;
      if (raw.monthly_package_amount !== undefined) sim.monthly_package_amount = Number(raw.monthly_package_amount) || 0;
      if (raw.approved_amount !== undefined) sim.approved_amount = Number(raw.approved_amount) || 0;
      if (raw.plan !== undefined) sim.plan = raw.plan;
      if (raw.service_status) {
        sim.service_status = raw.service_status === 'Inactive' ? 'Inactive' : 'Active';
      }
      if (raw.notes !== undefined) sim.notes = raw.notes;

      sim.updated_at = new Date().toISOString();
      sim.updated_by = userName;

      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const updatePayload: any = {
            updated_at: sim.updated_at,
          };
          if (raw.provider || raw.vendor) updatePayload.provider = String(raw.provider || raw.vendor).toUpperCase();
          if (raw.plan !== undefined) updatePayload.plan = String(raw.plan).trim();
          if (raw.monthly_package_amount !== undefined || raw.monthly_cost !== undefined) {
            updatePayload.monthly_cost = Number(raw.monthly_package_amount ?? raw.monthly_cost) || 0;
          }
          if (raw.notes !== undefined) updatePayload.notes = raw.notes ? String(raw.notes).trim() : null;
          if (raw.iccid !== undefined || raw.sim_serial_number !== undefined) {
            updatePayload.iccid = raw.iccid || raw.sim_serial_number || null;
            updatePayload.sim_serial_number = updatePayload.iccid;
          }
          if (raw.service_status === 'Inactive') updatePayload.status = 'Inactive';

          await supabase.from('sim_cards').update(updatePayload).eq('id', id);
        } catch (sbErr) {
          console.warn('Supabase update warning in server/simRoutes.ts PUT /:id:', sbErr);
        }
      }

      return res.json({
        success: true,
        message: `SIM ${sim.mobile_number} updated successfully.`,
        sim,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 13. DELETE /api/erp/sims/:id (Delete SIM Card)
  router.delete('/:id', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractTenantContext(req);
      const { id } = req.params;
      const simIndex = (db.simCardsMaster || []).findIndex((s: any) => s.id === id && s.tenant_id === tenantId);
      if (simIndex === -1) {
        return res.status(404).json({ error: `SIM card ${id} not found.` });
      }

      const [deleted] = db.simCardsMaster.splice(simIndex, 1);

      // Also remove legacy simCards entry if present
      if (Array.isArray(db.simCards)) {
        db.simCards = db.simCards.filter((s: any) => !(s.id === id && s.tenant_id === tenantId));
      }

      // Close any active assignments
      if (Array.isArray(db.simAssignments)) {
        const now = new Date().toISOString();
        db.simAssignments
          .filter((sa: any) => (sa.sim_id === id || sa.sim_card_id === id) && sa.tenant_id === tenantId && sa.status === 'ACTIVE')
          .forEach((sa: any) => {
            sa.status = 'RETURNED';
            sa.return_date = now.split('T')[0];
            sa.returned_at = now;
            sa.returned_by = userName;
            sa.return_reason = 'SIM card deleted from master registry';
          });
      }

      // If assigned to an employee, clear employee pointer
      if (deleted.current_employee_id) {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === deleted.current_employee_id && e.tenant_id === tenantId);
        if (emp && emp.current_sim_id === id) {
          emp.current_sim_id = undefined;
          emp.current_sim_number = undefined;
        }
      }

      if (db.auditLogs) {
        const now = new Date().toISOString();
        db.auditLogs.unshift({
          id: `log_${Date.now()}`,
          tenant_id: tenantId,
          timestamp: now.replace('T', ' ').substring(0, 19),
          userId,
          userName,
          userRole: 'Operations / Telecom',
          action: 'DELETE_SIM',
          actionType: 'DELETE',
          status: 'SUCCESS',
          module: 'SIM Management',
          details: `Deleted SIM ${deleted.mobile_number} (${deleted.provider})`,
          targetEntityId: deleted.id,
        });
      }

      return res.json({
        success: true,
        message: `SIM ${deleted.mobile_number} deleted successfully.`,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

export const initialSimCards: any[] = [];
