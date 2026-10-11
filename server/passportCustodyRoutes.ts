import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { resolveAuthenticatedActor } from './auditActorHelper';
import { getSupabaseClient } from './supabaseDb';
import {
  purgeTombstonedPassports,
  deletePassportAuthoritative,
  getAuthoritativePassportCustody,
  getAuthoritativePassportHistory,
  calculatePassportStats,
  receivePassportAuthoritative,
  returnPassportAuthoritative,
} from './authoritativePassportCustody';

export interface PassportCustodyRecord {
  id: string;
  serial_number: string; // e.g. PP-000001
  passport_serial?: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  emirates_id: string;
  passport_number: string;
  passport_expiry: string;
  expiry_date?: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER';
  current_location: string; // 'Main Office Safe', 'Branch Office', 'With Rider', etc.
  safe_location?: string;
  storage_detail?: string;
  current_handler: string;
  handler_name?: string;
  current_handler_id?: string;
  receive_date: string;
  receiving_date?: string;
  received_date?: string;
  return_date?: string;
  returned_date?: string;
  release_date?: string;
  returned_by?: string;
  return_reason?: string;
  reason: string;
  notes?: string;
  branch_id?: string;
  branch_name: string;
  branch?: string;
  guarantor_name?: string;
  guarantor_id?: string;
  guarantor_unique_id?: string;
  receiver_acknowledged?: boolean;
  receiver_name?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface PassportCustodyHistoryRecord {
  id: string;
  custody_id: string;
  serial_number: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  event_type: 'RECEIVED' | 'RETURNED_TO_RIDER' | 'EDIT_CORRECTION' | 'LOCATION_TRANSFER';
  from_status?: string;
  to_status?: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER';
  actor_name: string;
  actor_id?: string;
  handler_name?: string;
  returned_by?: string;
  event_date: string;
  receive_date?: string;
  return_date?: string;
  received_from?: string;
  returned_to?: string;
  receiver_name?: string;
  location: string;
  storage_location?: string;
  return_reason?: string;
  reason: string;
  notes?: string;
  guarantor_name?: string;
  guarantor_unique_id?: string;
  correction_reason?: string;
  previous_values?: Record<string, any>;
  new_values?: Record<string, any>;
  timestamp: string;
  created_at: string;
}

export const ROUTEMATE_RETURN_REASONS = [
  'Annual Leave / Vacation (Travel)',
  'Company Return (No Process Needed / Rider Requested Back)',
  'Passport Renewal (Submission to Consulate / Typing Center)',
  'Sick Leave / Medical Emergency',
  'Other (Specify in Notes)',
] as const;

export const initialPassportCustody: PassportCustodyRecord[] = [];
export const initialPassportHistory: PassportCustodyHistoryRecord[] = [];

const PERSISTENT_CUSTODY_FILE = path.join(process.cwd(), 'data', 'persistent_passport_custody.json');
const PERSISTENT_HISTORY_FILE = path.join(process.cwd(), 'data', 'persistent_passport_custody_history.json');

export function loadPersistentPassportCustody(db: any) {
  try {
    if (!db.passportCustody) db.passportCustody = [];
    if (!db.passportCustodyHistory) db.passportCustodyHistory = [];

    if (fs.existsSync(PERSISTENT_CUSTODY_FILE)) {
      const data = JSON.parse(fs.readFileSync(PERSISTENT_CUSTODY_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        db.passportCustody = purgeTombstonedPassports(data);
      }
    }
    if (fs.existsSync(PERSISTENT_HISTORY_FILE)) {
      const hist = JSON.parse(fs.readFileSync(PERSISTENT_HISTORY_FILE, 'utf-8'));
      if (Array.isArray(hist) && hist.length > 0) {
        db.passportCustodyHistory = hist;
      }
    }
  } catch (err) {
    console.warn('Could not read persistent passport custody files:', err);
  }
}

export function savePersistentPassportCustody(db: any) {
  try {
    const dir = path.dirname(PERSISTENT_CUSTODY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db.passportCustody = purgeTombstonedPassports(db.passportCustody || []);
    fs.writeFileSync(PERSISTENT_CUSTODY_FILE, JSON.stringify(db.passportCustody || [], null, 2), 'utf-8');
    fs.writeFileSync(PERSISTENT_HISTORY_FILE, JSON.stringify(db.passportCustodyHistory || [], null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write persistent passport custody files:', err);
  }
}

export function createPassportRouter(db: any, getGeminiClient?: () => GoogleGenAI) {
  const router = Router();

  // Ensure arrays exist and load disk state
  loadPersistentPassportCustody(db);

  function extractContext(req: Request) {
    let tenantId = (req.headers['x-tenant-id'] as string) || 'company_pixel_syntax';
    const actor = resolveAuthenticatedActor(req, db);
    let userId = actor.userId || (req.headers['x-user-id'] as string) || 'user_emp_1';
    let userRole = actor.userRole || (req.headers['x-user-role'] as string) || 'COMPANY_ADMIN';
    let userName = actor.userName;

    if (!userName || userName === 'Unauthenticated Guest') {
      userName = (req.headers['x-user-name'] as string) || 'System User';
    }

    if (actor.tenantId && actor.tenantId !== 'company_demo') {
      tenantId = actor.tenantId;
    }

    return { tenantId, userId, userRole, userName };
  }

  function generateNextSerial(tenantId: string): string {
    const tenantPassports = (db.passportCustody || []).filter((p: any) => p.tenant_id === tenantId);
    let maxNum = 0;
    for (const p of tenantPassports) {
      if (p.serial_number && p.serial_number.startsWith('PP-')) {
        const num = parseInt(p.serial_number.replace('PP-', ''), 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    return `PP-${String(maxNum + 1).padStart(6, '0')}`;
  }

  // 1. GET /api/erp/passports/custody
  router.get('/custody', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractContext(req);
      const supabase = getSupabaseClient();
      const records = await getAuthoritativePassportCustody(tenantId, supabase, db);
      const { status, location, branch, return_reason, search } = req.query;

      let filtered = records;

      if (status && status !== 'ALL') {
        filtered = filtered.filter((p: any) => p.status === status);
      }
      if (location && location !== 'ALL') {
        filtered = filtered.filter((p: any) =>
          (p.current_location && p.current_location.toLowerCase().includes((location as string).toLowerCase())) ||
          (p.safe_location && p.safe_location.toLowerCase().includes((location as string).toLowerCase()))
        );
      }
      if (branch && branch !== 'ALL') {
        filtered = filtered.filter((p: any) => p.branch_name === branch || p.branch_id === branch || p.branch === branch);
      }
      if (return_reason && return_reason !== 'ALL') {
        filtered = filtered.filter((p: any) => p.return_reason === return_reason || p.reason === return_reason);
      }
      if (search) {
        const q = (search as string).toLowerCase().trim();
        filtered = filtered.filter(
          (p: any) =>
            p.employee_name?.toLowerCase().includes(q) ||
            p.employee_code?.toLowerCase().includes(q) ||
            p.emirates_id?.toLowerCase().includes(q) ||
            p.passport_number?.toLowerCase().includes(q) ||
            p.serial_number?.toLowerCase().includes(q) ||
            p.current_location?.toLowerCase().includes(q) ||
            p.current_handler?.toLowerCase().includes(q) ||
            p.guarantor_name?.toLowerCase().includes(q)
        );
      }

      // Sort newest first
      filtered.sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

      return res.json(filtered);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 2. GET /api/erp/passports/dashboard & /stats
  const handleDashboardStats = async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractContext(req);
      const supabase = getSupabaseClient();
      const records = await getAuthoritativePassportCustody(tenantId, supabase, db);
      const history = await getAuthoritativePassportHistory(tenantId, undefined, supabase);

      // Retrieve authoritative master employees for this tenant
      let masterEmployees: any[] = [];
      if (supabase) {
        try {
          const { data: sbEmps } = await supabase
            .from('employees')
            .select('*')
            .eq('tenant_id', tenantId);
          if (Array.isArray(sbEmps) && sbEmps.length > 0) {
            masterEmployees = sbEmps.filter((e: any) => !e.is_archived);
          }
        } catch {}
      }
      if (masterEmployees.length === 0 && db && Array.isArray(db.masterEmployees)) {
        masterEmployees = db.masterEmployees.filter(
          (e: any) => (e.tenant_id === tenantId || !e.tenant_id) && !e.is_archived
        );
      }

      const stats = calculatePassportStats(records, history, masterEmployees);
      return res.json(stats);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  router.get('/dashboard', handleDashboardStats);
  router.get('/stats', handleDashboardStats);

  // 3. GET /autocomplete-employee
  router.get('/autocomplete-employee', (req: Request, res: Response) => {
    try {
      const { tenantId } = extractContext(req);
      const q = ((req.query.q as string) || '').toLowerCase().trim();
      const emps = (db.masterEmployees || [])
        .filter((e: any) => e.tenant_id === tenantId)
        .filter(
          (e: any) =>
            !q ||
            e.full_name?.toLowerCase().includes(q) ||
            e.employee_code?.toLowerCase().includes(q) ||
            e.emirates_id_number?.toLowerCase().includes(q) ||
            e.emirates_id?.toLowerCase().includes(q) ||
            e.passport_number?.toLowerCase().includes(q)
        );
      return res.json(emps);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 4. GET /with-company (Employees whose passport is currently with company)
  router.get('/with-company', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractContext(req);
      const supabase = getSupabaseClient();
      const records = await getAuthoritativePassportCustody(tenantId, supabase, db);
      const withCompanyRecords = records.filter(
        (p: any) => p.tenant_id === tenantId && p.status === 'WITH_COMPANY'
      );
      return res.json(withCompanyRecords);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 5. POST /receive & POST /receive-from-rider
  const handleReceiveFromRider = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractContext(req);
      const supabase = getSupabaseClient();
      const result = await receivePassportAuthoritative(
        {
          ...req.body,
          tenant_id: tenantId,
          user_name: userName,
          user_id: userId,
        },
        supabase
      );

      // Keep db in sync if present
      if (db.passportCustody) {
        const idx = db.passportCustody.findIndex((p: any) => p.id === result.record.id);
        if (idx >= 0) {
          db.passportCustody[idx] = result.record;
        } else {
          db.passportCustody.unshift(result.record);
        }
      }
      if (db.passportCustodyHistory) {
        db.passportCustodyHistory.unshift(result.history);
      }
      savePersistentPassportCustody(db);

      return res.status(201).json({
        success: true,
        message: result.isReReceive
          ? `Passport (${result.record.serial_number}) for ${result.record.employee_name} re-received into safe custody.`
          : `Passport for ${result.record.employee_name} (${result.record.serial_number}) successfully received into company custody.`,
        record: result.record,
        custody: result.record,
        history: result.history,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to receive passport' });
    }
  };

  router.post('/receive', handleReceiveFromRider);
  router.post('/receive-from-rider', handleReceiveFromRider);

  // 6. POST /:id/return & POST /return-to-rider
  const handleReturnToRider = async (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractContext(req);
      const supabase = getSupabaseClient();
      const id = req.params.id || req.body.id || req.body.custody_id || req.body.employee_id || req.body.serial_number;

      if (!id) {
        return res.status(400).json({ error: 'Passport record or employee selection is required to return passport.' });
      }

      const result = await returnPassportAuthoritative(
        id,
        {
          ...req.body,
          id,
          tenant_id: tenantId,
          user_name: userName,
          user_id: userId,
        },
        supabase
      );

      // Keep db in sync if present
      if (db.passportCustody) {
        const idx = db.passportCustody.findIndex((p: any) => p.id === result.record.id);
        if (idx >= 0) {
          db.passportCustody[idx] = result.record;
        } else {
          db.passportCustody.unshift(result.record);
        }
      }
      if (db.passportCustodyHistory) {
        const exists = db.passportCustodyHistory.some((h: any) => h.id === result.history.id);
        if (!exists) {
          db.passportCustodyHistory.unshift(result.history);
        }
      }
      savePersistentPassportCustody(db);

      return res.json({
        success: true,
        message: `Passport (${result.record.serial_number}) successfully returned to rider ${result.record.employee_name}.`,
        record: result.record,
        custody: result.record,
        history: result.history,
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to return passport.' });
    }
  };

  router.post('/:id/return', handleReturnToRider);
  router.post('/:id/return-to-rider', handleReturnToRider);
  router.post('/return', handleReturnToRider);
  router.post('/return-to-rider', handleReturnToRider);

  // 7. PUT /:id (Edit with Audit Trail)
  router.put('/:id', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractContext(req);
      const { id } = req.params;
      const {
        passport_number,
        passport_expiry,
        expiry_date,
        branch_name,
        storage_location,
        receive_date,
        return_date,
        return_reason,
        notes,
        guarantor_name,
        guarantor_unique_id,
        correction_reason,
      } = req.body;

      if (!correction_reason || !correction_reason.trim()) {
        return res.status(400).json({
          error: 'A correction reason is required for administrative audit compliance.',
        });
      }

      const custody = (db.passportCustody || []).find(
        (p: any) => (p.id === id || p.serial_number === id) && p.tenant_id === tenantId
      );

      if (!custody) {
        return res.status(404).json({ error: `Passport custody record ${id} not found.` });
      }

      const now = new Date().toISOString();
      const previousValues: Record<string, any> = {
        passport_number: custody.passport_number,
        passport_expiry: custody.passport_expiry,
        branch_name: custody.branch_name,
        current_location: custody.current_location,
        receive_date: custody.receive_date,
        return_date: custody.return_date,
        return_reason: custody.return_reason,
        notes: custody.notes,
        guarantor_name: custody.guarantor_name,
        guarantor_unique_id: custody.guarantor_unique_id,
      };

      if (passport_number) custody.passport_number = passport_number.trim();
      const pExp = passport_expiry || expiry_date;
      if (pExp) {
        custody.passport_expiry = pExp;
        custody.expiry_date = pExp;
      }
      if (branch_name) {
        custody.branch_name = branch_name;
        custody.branch = branch_name;
      }
      if (storage_location && custody.status === 'WITH_COMPANY') {
        custody.current_location = storage_location;
        custody.safe_location = storage_location;
      }
      if (receive_date) {
        custody.receive_date = receive_date;
        custody.receiving_date = receive_date;
      }
      if (return_date) {
        custody.return_date = return_date;
        custody.returned_date = return_date;
      }
      if (return_reason) {
        custody.return_reason = return_reason;
        custody.reason = return_reason;
      }
      if (notes !== undefined) custody.notes = notes;
      if (guarantor_name !== undefined) custody.guarantor_name = guarantor_name;
      if (guarantor_unique_id !== undefined) custody.guarantor_unique_id = guarantor_unique_id;

      custody.updated_at = now;
      custody.updated_by = userName;

      // Update Employee Master
      const emp = (db.masterEmployees || []).find((e: any) => e.id === custody.employee_id && e.tenant_id === tenantId);
      if (emp) {
        if (passport_number) emp.passport_number = passport_number.trim();
        if (pExp) emp.passport_expiry = pExp;
        if (branch_name) emp.branch_name = branch_name;
        if (storage_location && custody.status === 'WITH_COMPANY') emp.passport_location = storage_location;
        emp.updated_at = now;
      }

      // Add Audit Trail to History
      const auditEvent: PassportCustodyHistoryRecord = {
        id: `pch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        custody_id: custody.id,
        serial_number: custody.serial_number,
        tenant_id: tenantId,
        employee_id: custody.employee_id,
        employee_name: custody.employee_name,
        employee_code: custody.employee_code,
        event_type: 'EDIT_CORRECTION',
        status: custody.status,
        actor_name: userName,
        actor_id: userId,
        event_date: now.split('T')[0],
        location: custody.current_location,
        reason: correction_reason,
        correction_reason,
        previous_values: previousValues,
        new_values: {
          passport_number: custody.passport_number,
          passport_expiry: custody.passport_expiry,
          branch_name: custody.branch_name,
          current_location: custody.current_location,
          receive_date: custody.receive_date,
          return_date: custody.return_date,
          return_reason: custody.return_reason,
          notes: custody.notes,
        },
        notes: `Record corrected by ${userName}. Compliance Reason: ${correction_reason}`,
        timestamp: now,
        created_at: now,
      };
      db.passportCustodyHistory.unshift(auditEvent);

      // Save to persistent storage
      savePersistentPassportCustody(db);

      return res.json({
        success: true,
        message: `Passport record (${custody.serial_number}) updated with audit log.`,
        record: custody,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 8. GET /:id/history
  router.get('/:id/history', async (req: Request, res: Response) => {
    try {
      const { tenantId } = extractContext(req);
      const { id } = req.params;
      const supabase = getSupabaseClient();

      const history = await getAuthoritativePassportHistory(tenantId, id, supabase);

      return res.json({ success: true, history });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // 9. POST /bulk-receive
  router.post('/bulk-receive', (req: Request, res: Response) => {
    try {
      const { tenantId, userName, userId } = extractContext(req);
      const { items } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Please provide an array of items to bulk receive.' });
      }

      const results: any[] = [];
      const errors: any[] = [];
      const now = new Date().toISOString();

      for (const item of items) {
        const empCode = item.employee_code || item.employeeCode || item.code;
        const empName = item.employee_name || item.fullName;
        const emp = (db.masterEmployees || []).find(
          (e: any) =>
            ((empCode && (e.employee_code === empCode || e.id === empCode)) ||
              (empName && e.full_name?.toLowerCase() === empName.toLowerCase())) &&
            e.tenant_id === tenantId
        );

        if (!emp) {
          errors.push({
            item,
            error: `Employee ${empCode || empName || 'unknown'} does not exist in Allied Employee Master.`,
          });
          continue;
        }

        const existing = (db.passportCustody || []).find(
          (p: any) => (p.employee_id === emp.id || p.employee_code === emp.employee_code) && p.tenant_id === tenantId
        );

        if (existing && existing.status === 'WITH_COMPANY') {
          errors.push({
            item,
            error: `Passport for ${emp.full_name} (${emp.employee_code}) is already in company custody (${existing.serial_number}).`,
          });
          continue;
        }

        const pNum = item.passport_number || item.passportNumber || emp.passport_number || 'P0000000';
        const pExp = item.expiry_date || item.passport_expiry || emp.passport_expiry || '2028-12-31';
        const loc = item.storage_location || item.location || 'Dubai Head Office Safe';
        const rDate = item.receive_date || item.receiving_date || now.split('T')[0];
        const branchName = item.branch_name || emp.branch_name || 'Pixel Syntax Delivery Software';

        let custodyRecord: PassportCustodyRecord;
        if (existing) {
          existing.status = 'WITH_COMPANY';
          existing.passport_number = pNum;
          existing.passport_expiry = pExp;
          existing.expiry_date = pExp;
          existing.current_location = loc;
          existing.safe_location = loc;
          existing.current_handler = userName;
          existing.receive_date = rDate;
          existing.branch_name = branchName;
          existing.notes = item.notes || 'Bulk Received into Company Custody';
          existing.updated_at = now;
          existing.updated_by = userName;
          custodyRecord = existing;
        } else {
          const serialNumber = generateNextSerial(tenantId);
          custodyRecord = {
            id: `pc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            serial_number: serialNumber,
            passport_serial: serialNumber,
            tenant_id: tenantId,
            employee_id: emp.id,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            emirates_id: emp.emirates_id_number || emp.emirates_id || 'N/A',
            passport_number: pNum,
            passport_expiry: pExp,
            expiry_date: pExp,
            status: 'WITH_COMPANY',
            current_location: loc,
            safe_location: loc,
            current_handler: userName,
            receive_date: rDate,
            reason: 'Received from Rider into Safe Custody',
            notes: item.notes || 'Bulk Upload Receive',
            branch_id: emp.branch_id || 'b_dxb',
            branch_name: branchName,
            created_at: now,
            created_by: userName,
            updated_at: now,
            updated_by: userName,
          };
          db.passportCustody.unshift(custodyRecord);
        }

        // Update employee
        emp.passport_number = pNum;
        emp.passport_expiry = pExp;
        emp.passport_status = 'With Company';
        emp.passport_location = loc;
        emp.passport_handler = userName;
        emp.updated_at = now;

        // Log history
        db.passportCustodyHistory.unshift({
          id: `pch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          custody_id: custodyRecord.id,
          serial_number: custodyRecord.serial_number,
          tenant_id: tenantId,
          employee_id: emp.id,
          employee_name: emp.full_name,
          employee_code: emp.employee_code,
          event_type: 'RECEIVED',
          from_status: existing ? 'WITH_RIDER' : 'NONE',
          to_status: 'WITH_COMPANY',
          status: 'WITH_COMPANY',
          actor_name: userName,
          actor_id: userId,
          handler_name: userName,
          event_date: rDate,
          received_from: `${emp.full_name} (${emp.employee_code})`,
          location: loc,
          reason: 'Bulk Upload Receive',
          notes: item.notes || 'Bulk Received',
          timestamp: now,
          created_at: now,
        });

        results.push(custodyRecord);
      }

      savePersistentPassportCustody(db);

      return res.json({
        success: true,
        receivedCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { tenantId, userId, userRole, userName } = extractContext(req);
      const body = req.body || {};
      const result = await deletePassportAuthoritative(
        {
          custodyId: req.params.id,
          tenantId,
          actor: {
            userId: userId || 'admin',
            userName: userName || 'Admin',
            userRole: userRole || 'SUPER_ADMIN',
          },
          reason: body.reason || 'Admin deletion via ERP passport route',
          confirmationPhrase: body.confirmationPhrase || body.confirmation_phrase || 'CONFIRM DELETE',
        },
        getSupabaseClient(),
        db
      );

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      savePersistentPassportCustody(db);
      return res.json(result);
    } catch (err: any) {
      console.error('Error deleting passport custody record:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  return router;
}
