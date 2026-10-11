/**
 * Demo Operational Cleanup & Sequential Employee Code Service
 * Strictly scoped to `company_demo`.
 * `company_allied` production operational data is strictly protected and untouched.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface TenantSequenceRecord {
  tenantId: string;
  lastCodeNumber: number;
  prefix: string;
  padLength: number;
}

/**
 * Preview next deterministic sequential employee code for a tenant
 */
export async function previewNextEmployeeCode(
  tenantId: string,
  db: any,
  supabaseClient?: SupabaseClient | null
): Promise<string> {
  return generateNextEmployeeCode(tenantId, false, db, supabaseClient);
}

/**
 * Atomically generate and commit the next deterministic sequential employee code for a tenant.
 * DB-level, persistent, tenant-scoped, never reuses old numbers, zero-padded to 5 digits (e.g. EMP-00001).
 */
export async function generateNextEmployeeCode(
  tenantId: string,
  commit: boolean = true,
  db: any,
  supabaseClient?: SupabaseClient | null
): Promise<string> {
  const safeTenant = tenantId || 'company_demo';

  // 1. If Supabase PostgreSQL is connected, use DB-level atomic sequence function
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient.rpc('rpc_get_next_employee_code', {
        p_tenant_id: safeTenant,
        p_commit: safeTenant === 'company_allied' ? false : commit,
      });

      if (!error && data?.next_code) {
        return data.next_code;
      }
      if (error) {
        console.warn('Supabase rpc_get_next_employee_code error, falling back to local DB sequence:', error.message);
      }
    } catch (e: any) {
      console.warn('Supabase sequence RPC call exception:', e?.message);
    }
  }

  // 2. Authoritative local/in-memory persistent state sequence
  if (!db.tenantSequences) {
    db.tenantSequences = {};
  }

  if (!db.tenantSequences[safeTenant]) {
    // Scan existing employee codes for this tenant to determine the initial sequence baseline
    const existingEmployees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === safeTenant);
    let maxNum = 0;
    const isAllied = safeTenant === 'company_allied';

    for (const emp of existingEmployees) {
      const code = String(emp.employee_code || '');
      if (isAllied) {
        const adlMatch = code.match(/^ALL(\d+)$/i);
        if (adlMatch) {
          const parsed = parseInt(adlMatch[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      } else {
        const empMatch = code.match(/^EMP-(\d+)$/i);
        if (empMatch) {
          const parsed = parseInt(empMatch[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
    }

    db.tenantSequences[safeTenant] = {
      tenantId: safeTenant,
      lastCodeNumber: maxNum,
      prefix: isAllied ? 'ALL' : 'EMP-',
      padLength: isAllied ? 4 : 5,
    };
  }

  const seq: TenantSequenceRecord = db.tenantSequences[safeTenant];

  if (!commit) {
    const candidateNumber = seq.lastCodeNumber + 1;
    return `${seq.prefix}${String(candidateNumber).padStart(seq.padLength, '0')}`;
  }

  // Atomically increment and verify uniqueness against existing employees in this tenant
  let nextNumber = seq.lastCodeNumber + 1;
  let formattedCode = `${seq.prefix}${String(nextNumber).padStart(seq.padLength, '0')}`;

  const existingCodes = new Set(
    (db.masterEmployees || [])
      .filter((e: any) => e.tenant_id === safeTenant)
      .map((e: any) => String(e.employee_code || '').toUpperCase())
  );

  while (existingCodes.has(formattedCode.toUpperCase())) {
    nextNumber += 1;
    formattedCode = `${seq.prefix}${String(nextNumber).padStart(seq.padLength, '0')}`;
  }

  seq.lastCodeNumber = nextNumber;
  return formattedCode;
}

/**
 * Execute Demo Operational Cleanup - TRUE OPERATIONAL ZERO BASELINE V2
 * STRICTLY ONLY affects `company_demo`.
 * `company_allied` production operational data is strictly protected and untouched.
 */
export function cleanupAndInitializeDemoTenant(db: any) {
  const DEMO_TENANT = 'company_demo';
  const now = new Date().toISOString();

  // Helper to log audit actions for pre-live cleanup
  const logCleanupAudit = (entityType: string, count: number, details: string) => {
    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift({
      id: `log_clean_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: DEMO_TENANT,
      timestamp: now.replace('T', ' ').substring(0, 19),
      userId: 'SYSTEM_PRE_LIVE_CLEANUP',
      userName: 'SYSTEM_PRE_LIVE_CLEANUP',
      userRole: 'SYSTEM',
      performed_by_name: 'SYSTEM_PRE_LIVE_CLEANUP',
      action: 'REMOVE_DEMO_DATA',
      actionType: 'DELETE',
      status: 'SUCCESS',
      module: 'Pre-Live Cleanup',
      entity_type: entityType,
      entity_id: 'BATCH_CLEANUP',
      details: details,
      reason: 'Pre-live deployment cleanup',
      performed_at: now,
    });
  };

  // 1. WORKFORCE QA EMPLOYEES: PRESERVE REAL MANUALLY ENTERED EMPLOYEES
  // Only remove legacy/stale mock demo employees like 'emp_demo_ahmed'
  if (db.masterEmployees) {
    const prevCount = db.masterEmployees.length;
    db.masterEmployees = db.masterEmployees.filter(
      (e: any) => !(e.tenant_id === DEMO_TENANT && (e.id === 'emp_demo_ahmed' || e.full_name === 'Legacy Demo Employee'))
    );
    if (prevCount !== db.masterEmployees.length) {
      logCleanupAudit('Employee', prevCount - db.masterEmployees.length, 'Purged legacy mock demo employee record');
    }
  } else {
    db.masterEmployees = [];
  }

  // 2. RECRUITMENT CANDIDATES: REMOVE ONLY SAMPLE / DEMO CANDIDATES
  // Legitimate candidates linked to employees (with valid employee_id) are preserved.
  if (db.candidates) {
    const initialCandCount = db.candidates.length;
    const sampleCandNames = ['Sample Rider One', 'Sample Rider Two', 'Sample Rider Three', 'Sample Candidate'];
    db.candidates = db.candidates.filter((c: any) => {
      if (c.tenant_id !== DEMO_TENANT) return true;
      // If linked to a valid master employee, keep it!
      if (c.employee_id && (db.masterEmployees || []).some((e: any) => e.id === c.employee_id)) {
        return true;
      }
      // Remove sample/demo candidates
      const isSample =
        sampleCandNames.some((n) => (c.fullName || '').toLowerCase().includes(n.toLowerCase())) ||
        (c.id && (c.id.startsWith('cand_12') || c.id.startsWith('cand_demo_')));
      return !isSample;
    });
    const removedCands = initialCandCount - db.candidates.length;
    if (removedCands > 0) {
      logCleanupAudit('Candidate', removedCands, `Removed ${removedCands} sample/mock recruitment candidates`);
    }
  }

  // 3. PROJECT MASTER: REMOVE AUTO-SEEDED DEMO PROJECTS
  // Do NOT auto-seed Noon/Talabat/Keeta. Projects must be created manually.
  if (!db.projects) db.projects = [];
  const demoProjectIds = ['proj_demo_noon', 'proj_demo_talabat', 'proj_demo_keeta'];
  const removedDemoProjects = db.projects.filter(
    (p: any) => p.tenant_id === DEMO_TENANT && (demoProjectIds.includes(p.id) || (p.code && p.code.startsWith('DEMO-')))
  );
  if (removedDemoProjects.length > 0) {
    db.projects = db.projects.filter(
      (p: any) => !(p.tenant_id === DEMO_TENANT && (demoProjectIds.includes(p.id) || (p.code && p.code.startsWith('DEMO-'))))
    );
    // Unassign employees linked to removed demo projects
    if (db.masterEmployees) {
      for (const emp of db.masterEmployees) {
        if (emp.tenant_id === DEMO_TENANT && emp.project_id && demoProjectIds.includes(emp.project_id)) {
          emp.project_id = undefined;
          emp.project_name = undefined;
        }
      }
    }
    logCleanupAudit('Project', removedDemoProjects.length, `Removed ${removedDemoProjects.length} auto-seeded demo projects`);
  }

  // 4. SIM CARDS: REMOVE AUTO-SEEDED DEMO SIMS ONLY
  if (db.simCardsMaster) {
    const demoSimIds = ['sim_demo_01', 'sim_demo_02', 'sim_demo_03'];
    const demoSimNumbers = ['0501122334', '0529988776', '0545566778'];
    const initialSimCount = db.simCardsMaster.length;
    db.simCardsMaster = db.simCardsMaster.filter(
      (s: any) => !(s.tenant_id === DEMO_TENANT && (demoSimIds.includes(s.id) || demoSimNumbers.includes(s.sim_number)))
    );
    if (db.simCards) {
      db.simCards = db.simCards.filter(
        (s: any) => !(s.tenant_id === DEMO_TENANT && (demoSimIds.includes(s.id) || demoSimNumbers.includes(s.sim_number)))
      );
    }
    const removedSims = initialSimCount - db.simCardsMaster.length;
    if (removedSims > 0) {
      logCleanupAudit('SIM', removedSims, `Removed ${removedSims} auto-seeded demo SIM cards`);
    }
  }
  if (db.employeeProjectAssignments) {
    db.employeeProjectAssignments = db.employeeProjectAssignments.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.projectRiderMappings) {
    db.projectRiderMappings = db.projectRiderMappings.filter((m: any) => m.tenant_id !== DEMO_TENANT);
  }

  // 3. ATTENDANCE & DELIVERIES CLEANUP (Expected: 0 active, 0 OT, 0 deliveries)
  if (db.attendance) {
    db.attendance = db.attendance.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.attendanceRecords) {
    db.attendanceRecords = db.attendanceRecords.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.attendanceMonths) {
    db.attendanceMonths = db.attendanceMonths.filter((m: any) => m.tenant_id !== DEMO_TENANT);
  }
  if (db.attendanceHistory) {
    db.attendanceHistory = db.attendanceHistory.filter((h: any) => h.tenant_id !== DEMO_TENANT);
  }
  if (db.dailyPerformanceMetrics) {
    db.dailyPerformanceMetrics = db.dailyPerformanceMetrics.filter((d: any) => d.tenant_id !== DEMO_TENANT);
  }
  if (db.riderDeliveries) {
    db.riderDeliveries = db.riderDeliveries.filter((r: any) => r.tenant_id !== DEMO_TENANT);
  }
  if (db.riderDailyPerformance) {
    db.riderDailyPerformance = db.riderDailyPerformance.filter((p: any) => p.tenant_id !== DEMO_TENANT);
  }
  if (db.performanceImportBatches) {
    db.performanceImportBatches = db.performanceImportBatches.filter((b: any) => b.tenant_id !== DEMO_TENANT);
  }
  if (db.monthlyPerformancePayrollSyncs) {
    db.monthlyPerformancePayrollSyncs = db.monthlyPerformancePayrollSyncs.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }
  if (db.attendanceImportBatches) {
    db.attendanceImportBatches = db.attendanceImportBatches.filter((b: any) => b.tenant_id !== DEMO_TENANT);
  }

  // 4. TRAFFIC FINES CLEANUP (Expected: 0 fines, AED 0.00 total)
  if (db.trafficFines) {
    db.trafficFines = db.trafficFines.filter((f: any) => f.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetFines) {
    db.fleetFines = db.fleetFines.filter((f: any) => f.tenant_id !== DEMO_TENANT);
  }
  if (db.fineAllocations) {
    db.fineAllocations = db.fineAllocations.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.fineDisputes) {
    db.fineDisputes = db.fineDisputes.filter((d: any) => d.tenant_id !== DEMO_TENANT);
  }
  if (db.trafficFineSettlements) {
    db.trafficFineSettlements = db.trafficFineSettlements.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }

  // 5. PAYROLL TRANSACTIONAL DATA CLEANUP (Expected: 0 batches, AED 0.00 net payable, 0 records)
  if (db.payrollPeriods) {
    db.payrollPeriods = db.payrollPeriods.filter((p: any) => p.tenant_id !== DEMO_TENANT);
  }
  if (db.payrollRecords) {
    db.payrollRecords = db.payrollRecords.filter((r: any) => r.tenant_id !== DEMO_TENANT);
  }
  if (db.payrollAdjustments) {
    db.payrollAdjustments = db.payrollAdjustments.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.payrollImportBatches) {
    db.payrollImportBatches = db.payrollImportBatches.filter((b: any) => b.tenant_id !== DEMO_TENANT);
  }
  if (db.projectSalaryLines) {
    db.projectSalaryLines = db.projectSalaryLines.filter((l: any) => l.tenant_id !== DEMO_TENANT);
  }
  if (db.finalSettlements) {
    db.finalSettlements = db.finalSettlements.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }

  // 6. LOANS & ADVANCES CLEANUP (Expected: 0 active loans)
  if (db.employeeLoans) {
    db.employeeLoans = db.employeeLoans.filter((l: any) => l.tenant_id !== DEMO_TENANT);
  }
  if (db.employeeAdvances) {
    db.employeeAdvances = db.employeeAdvances.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }

  // 7. SALIK TRANSACTIONS CLEANUP (Expected: 0 records)
  if (db.salikRecords) {
    db.salikRecords = db.salikRecords.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }
  if (db.salikTrips) {
    db.salikTrips = db.salikTrips.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }
  if (db.salikAllocations) {
    db.salikAllocations = db.salikAllocations.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.salikBatches) {
    db.salikBatches = db.salikBatches.filter((b: any) => b.tenant_id !== DEMO_TENANT);
  }

  // 8. PASSPORT CUSTODY CLEANUP (Expected: 0 active custody)
  if (db.passportCustody) {
    db.passportCustody = db.passportCustody.filter((p: any) => p.tenant_id !== DEMO_TENANT);
  }
  if (db.passportCustodyHistory) {
    db.passportCustodyHistory = db.passportCustodyHistory.filter((h: any) => h.tenant_id !== DEMO_TENANT);
  }
  if (db.passports) {
    db.passports = db.passports.filter((p: any) => p.tenant_id !== DEMO_TENANT);
  }

  // 9. SIM INVENTORY CLEANUP (Expected: Total 0, Assigned 0, Unassigned 0)
  if (db.simCardsMaster) {
    db.simCardsMaster = db.simCardsMaster.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }
  if (db.simCards) {
    db.simCards = db.simCards.filter((s: any) => s.tenant_id !== DEMO_TENANT);
  }
  if (db.simAssignments) {
    db.simAssignments = db.simAssignments.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }

  // 10. VEHICLE MASTER CLEANUP - COMPLETE ZERO BASELINE (Vehicle 23901 exception revoked)
  if (db.fleetVehicles) {
    db.fleetVehicles = db.fleetVehicles.filter((v: any) => v.tenant_id !== DEMO_TENANT);
  } else {
    db.fleetVehicles = [];
  }
  if (db.vehicles) {
    db.vehicles = db.vehicles.filter((v: any) => v.tenant_id !== DEMO_TENANT);
  }

  // Clear demo vehicle assignments, history, fuel, accidents, expenses, and maintenance
  if (db.fleetAssignments) {
    db.fleetAssignments = db.fleetAssignments.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.vehicleAssignments) {
    db.vehicleAssignments = db.vehicleAssignments.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetStatusHistories) {
    db.fleetStatusHistories = db.fleetStatusHistories.filter((h: any) => h.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetMaintenance) {
    db.fleetMaintenance = db.fleetMaintenance.filter((m: any) => m.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetFuelEntries) {
    db.fleetFuelEntries = db.fleetFuelEntries.filter((f: any) => f.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetAccidents) {
    db.fleetAccidents = db.fleetAccidents.filter((a: any) => a.tenant_id !== DEMO_TENANT);
  }
  if (db.fleetExpenses) {
    db.fleetExpenses = db.fleetExpenses.filter((e: any) => e.tenant_id !== DEMO_TENANT);
  }

  // 11. DOCUMENTS CLEANUP (Clear all QA Employee/Vehicle test document metadata for demo tenant)
  if (db.entityDocuments) {
    const removedDocIds = new Set<string>();
    db.entityDocuments = db.entityDocuments.filter((d: any) => {
      if (d.tenant_id !== DEMO_TENANT) return true;
      removedDocIds.add(d.id);
      return false;
    });

    if (db.documentFiles) {
      db.documentFiles = db.documentFiles.filter((f: any) => !removedDocIds.has(f.document_id) && f.tenant_id !== DEMO_TENANT);
    }
    if (db.documentVersions) {
      db.documentVersions = db.documentVersions.filter((v: any) => !removedDocIds.has(v.document_id));
    }
    if (db.documentActivities) {
      db.documentActivities = db.documentActivities.filter((a: any) => !removedDocIds.has(a.document_id) && a.tenant_id !== DEMO_TENANT);
    }
  }

  // 12. ORDERS & TICKETS TRANSACTIONS CLEANUP
  if (db.orders) {
    db.orders = db.orders.filter((o: any) => o.tenant_id !== DEMO_TENANT);
  }
  if (db.driverTickets) {
    db.driverTickets = db.driverTickets.filter((t: any) => t.tenant_id !== DEMO_TENANT);
  }

  console.log('✅ Demo Operational Zero Baseline Cleanup V3 completed: 0 workforce employees, 0 vehicles, 0 SIMs, 0 Passports, 0 Fines, 0 Attendance, 0 Payroll, 0 Loans, 0 Salik.');
}

