import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from './supabaseDb';
import { AUTHORITATIVE_COMPANY_ALLIED_PROJECTS } from './authoritativeProjects';

export interface LabourBuilding {
  id: string;
  tenant_id: string;
  name: string;
  area_location: string;
  emirate: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface LabourBuildingAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  building_id: string;
  building_name: string;
  area_location?: string;
  emirate?: string;
  assignment_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  status: 'ACTIVE' | 'TRANSFERRED' | 'ENDED';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

const PERSISTENT_BUILDINGS_FILE = path.join(process.cwd(), 'data', 'persistent_labour_buildings.json');
const PERSISTENT_BUILDING_ASSIGNMENTS_FILE = path.join(
  process.cwd(),
  'data',
  'persistent_labour_building_assignments.json'
);

export function loadPersistentLabourBuildings(): LabourBuilding[] {
  try {
    if (fs.existsSync(PERSISTENT_BUILDINGS_FILE)) {
      const content = fs.readFileSync(PERSISTENT_BUILDINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read persistent_labour_buildings.json:', err);
  }
  return [];
}

export function savePersistentLabourBuildings(buildings: LabourBuilding[]): void {
  try {
    const dir = path.dirname(PERSISTENT_BUILDINGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PERSISTENT_BUILDINGS_FILE, JSON.stringify(buildings, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write persistent_labour_buildings.json:', err);
  }
}

export function loadPersistentLabourBuildingAssignments(): LabourBuildingAssignment[] {
  try {
    if (fs.existsSync(PERSISTENT_BUILDING_ASSIGNMENTS_FILE)) {
      const content = fs.readFileSync(PERSISTENT_BUILDING_ASSIGNMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read persistent_labour_building_assignments.json:', err);
  }
  return [];
}

export function savePersistentLabourBuildingAssignments(
  assignments: LabourBuildingAssignment[]
): void {
  try {
    const dir = path.dirname(PERSISTENT_BUILDING_ASSIGNMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      PERSISTENT_BUILDING_ASSIGNMENTS_FILE,
      JSON.stringify(assignments, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to write persistent_labour_building_assignments.json:', err);
  }
}

/**
 * Strict verification: returns true ONLY if the employee's CURRENT active project is a Labour project.
 * Explicitly rejects Noon Minutes, Keeta, Talabat, Deliveroo, Amazon, Careem, Office, or unassigned.
 */
export function isEmployeeOnLabourProject(
  employeeId: string,
  db: any
): { isLabour: boolean; activeProject?: any; reason?: string } {
  // 1. Check active project assignments
  const assignments = (db.employeeProjectAssignments || []).filter(
    (a: any) => a && (a.employee_id === employeeId || a.employeeId === employeeId)
  );

  const activeAsg =
    assignments.find((a: any) => a.status === 'ACTIVE' && a.is_primary) ||
    assignments.find((a: any) => a.status === 'ACTIVE') ||
    assignments.find((a: any) => !a.assignment_end_date && a.status !== 'ENDED');

  // Also check masterEmployee record directly
  const emp = (db.masterEmployees || []).find(
    (e: any) => e.id === employeeId || e.employee_code === employeeId
  );

  const projectId = activeAsg?.project_id || activeAsg?.projectId || emp?.project_id;
  const projectName = (activeAsg?.project_name || activeAsg?.projectName || emp?.project_name || '').trim();

  if (!activeAsg && !emp?.project_id) {
    return {
      isLabour: false,
      reason: 'Employee does not have any active project assignment.',
    };
  }

  // Look up project definition
  let project = (db.projects || []).find((p: any) => p && p.id === projectId);
  if (!project && projectId) {
    project = AUTHORITATIVE_COMPANY_ALLIED_PROJECTS.find((p: any) => p.id === projectId);
  }

  const pType = String(project?.project_type || activeAsg?.project_type || '').toUpperCase();
  const pName = String(project?.name || projectName || '').toLowerCase();
  const pClient = String(project?.client_name || '').toLowerCase();
  const pId = String(projectId || '').toLowerCase();

  const isLabour =
    pType === 'LABOR' ||
    pType === 'LABOUR' ||
    pId === 'proj_labour_1' ||
    pName.includes('labour') ||
    pName.includes('labor') ||
    pClient.includes('labour') ||
    pClient.includes('labor');

  if (!isLabour) {
    return {
      isLabour: false,
      activeProject: project || { id: projectId, name: projectName },
      reason: `Current active project (${projectName || project?.name || 'Non-Labour'}) is not a Labour project. Building assignments are permitted ONLY for Labour employees.`,
    };
  }

  return {
    isLabour: true,
    activeProject: project || { id: projectId, name: projectName, project_type: 'LABOR' },
  };
}

export async function executeBuildingAssignment({
  db,
  tenantId = 'company_pixel_syntax',
  employeeId,
  buildingId,
  assignmentDate,
  notes,
  actorName = 'admin',
}: {
  db: any;
  tenantId?: string;
  employeeId: string;
  buildingId: string;
  assignmentDate?: string;
  notes?: string;
  actorName?: string;
}): Promise<{ success: boolean; assignment: LabourBuildingAssignment; message: string }> {
  if (!employeeId) {
    const err: any = new Error('Employee ID is required.');
    err.statusCode = 400;
    throw err;
  }
  if (!buildingId) {
    const err: any = new Error('Building selection is required. Please select an active building from the Building Master.');
    err.statusCode = 400;
    throw err;
  }

  // 1. LABOUR EMPLOYEES ONLY: Verify employee's CURRENT active project is a Labour project
  const labourVerification = isEmployeeOnLabourProject(employeeId, db);
  if (!labourVerification.isLabour) {
    const err: any = new Error(
      labourVerification.reason ||
        'Building assignment is permitted ONLY for employees whose current active project is a Labour project.'
    );
    err.statusCode = 400;
    throw err;
  }

  // 2. ASSIGN BUILDING: Load ONLY Active buildings from existing Labour Building Master (no free-text)
  if (!db.labourBuildings) db.labourBuildings = loadPersistentLabourBuildings();
  const building = db.labourBuildings.find(
    (b: LabourBuilding) => b.id === buildingId && b.tenant_id === tenantId
  );

  if (!building) {
    const err: any = new Error('Selected building does not exist in the Labour Building Master.');
    err.statusCode = 400;
    throw err;
  }

  if (building.status !== 'ACTIVE') {
    const err: any = new Error(`Building "${building.name}" is currently Inactive. You can only assign Active buildings.`);
    err.statusCode = 400;
    throw err;
  }

  const effectiveDate = assignmentDate && String(assignmentDate).trim()
    ? String(assignmentDate).trim()
    : new Date().toISOString().split('T')[0];

  const now = new Date().toISOString();

  if (!db.labourBuildingAssignments) {
    db.labourBuildingAssignments = loadPersistentLabourBuildingAssignments();
  }

  // 3. TRANSFER / ONE ACTIVE BUILDING PER EMPLOYEE:
  // End previous active building assignment (if any), preserving full history
  const previousActiveAssignments = db.labourBuildingAssignments.filter(
    (a: LabourBuildingAssignment) => a.employee_id === employeeId && a.status === 'ACTIVE'
  );

  const supabase = getSupabaseClient();

  for (const prev of previousActiveAssignments) {
    prev.status = 'TRANSFERRED';
    prev.end_date = effectiveDate;
    prev.updated_at = now;
    prev.updated_by = actorName;

    if (supabase) {
      try {
        await supabase
          .from('labour_building_assignments')
          .update({
            status: 'TRANSFERRED',
            end_date: effectiveDate,
            updated_at: now,
            updated_by: actorName,
          })
          .eq('id', prev.id);
      } catch (sbEx) {
        console.warn('Supabase update previous assignment exception:', sbEx);
      }
    }
  }

  // 4. Create new active assignment
  const newAssignmentId = `lba_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newAssignment: LabourBuildingAssignment = {
    id: newAssignmentId,
    tenant_id: tenantId,
    employee_id: employeeId,
    building_id: building.id,
    building_name: building.name,
    area_location: building.area_location || '',
    emirate: building.emirate || '',
    assignment_date: effectiveDate,
    end_date: null,
    status: 'ACTIVE',
    notes: notes ? String(notes).trim() : undefined,
    created_at: now,
    updated_at: now,
    created_by: actorName,
    updated_by: actorName,
  };

  db.labourBuildingAssignments.unshift(newAssignment);
  savePersistentLabourBuildingAssignments(db.labourBuildingAssignments);

  // Persist to Supabase
  if (supabase) {
    try {
      await supabase.from('labour_building_assignments').insert([
        {
          id: newAssignment.id,
          tenant_id: newAssignment.tenant_id,
          employee_id: newAssignment.employee_id,
          building_id: newAssignment.building_id,
          building_name: newAssignment.building_name,
          area_location: newAssignment.area_location,
          emirate: newAssignment.emirate,
          assignment_date: newAssignment.assignment_date,
          end_date: newAssignment.end_date,
          status: newAssignment.status,
          notes: newAssignment.notes || null,
          created_at: newAssignment.created_at,
          updated_at: newAssignment.updated_at,
          created_by: newAssignment.created_by,
          updated_by: newAssignment.updated_by,
        },
      ]);
    } catch (sbEx) {
      console.warn('Supabase insert new assignment exception:', sbEx);
    }
  }

  return {
    success: true,
    assignment: newAssignment,
    message: `Building "${building.name}" assigned successfully.`,
  };
}

export function createLabourBuildingRouter(db: any) {
  const router = express.Router();

  // Initialize in-memory arrays if not present
  if (!db.labourBuildings) {
    db.labourBuildings = loadPersistentLabourBuildings();
  }
  if (!db.labourBuildingAssignments) {
    db.labourBuildingAssignments = loadPersistentLabourBuildingAssignments();
  }

  // ==============================================================================
  // 1. BUILDING MASTER (READ / SEARCH)
  // ==============================================================================

  // GET: list buildings with optional search and status filter
  router.get('/', async (req: Request, res: Response) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const statusFilter = String(req.query.status || '').trim().toUpperCase();

      // Sync from Supabase if client is available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase
            .from('labour_buildings')
            .select('*')
            .eq('tenant_id', 'company_pixel_syntax')
            .order('created_at', { ascending: false });

          if (!sbErr && Array.isArray(sbData)) {
            const existingMap = new Map<string, LabourBuilding>();
            db.labourBuildings.forEach((b: LabourBuilding) => existingMap.set(b.id, b));
            sbData.forEach((row: any) => {
              existingMap.set(row.id, {
                id: row.id,
                tenant_id: row.tenant_id || 'company_pixel_syntax',
                name: row.name,
                area_location: row.area_location || '',
                emirate: row.emirate || '',
                status: row.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                notes: row.notes || undefined,
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
                updated_by: row.updated_by,
              });
            });
            db.labourBuildings = Array.from(existingMap.values());
            savePersistentLabourBuildings(db.labourBuildings);
          }
        } catch (sbEx) {
          console.warn('Supabase sync warning for labour_buildings:', sbEx);
        }
      }

      let list = [...(db.labourBuildings || [])];

      if (statusFilter === 'ACTIVE' || statusFilter === 'INACTIVE') {
        list = list.filter((b: LabourBuilding) => b.status === statusFilter);
      }

      if (search) {
        list = list.filter((b: LabourBuilding) => {
          const name = (b.name || '').toLowerCase();
          const area = (b.area_location || '').toLowerCase();
          const emirate = (b.emirate || '').toLowerCase();
          const notes = (b.notes || '').toLowerCase();
          return (
            name.includes(search) ||
            area.includes(search) ||
            emirate.includes(search) ||
            notes.includes(search)
          );
        });
      }

      return res.json({
        success: true,
        data: list,
        total: list.length,
      });
    } catch (err: any) {
      console.error('Error in GET /api/erp/labour-buildings:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // GET: active buildings only (for searchable selector)
  router.get('/active', async (_req: Request, res: Response) => {
    try {
      if (!db.labourBuildings) db.labourBuildings = loadPersistentLabourBuildings();
      const activeList = db.labourBuildings.filter((b: LabourBuilding) => b.status === 'ACTIVE');
      return res.json({
        success: true,
        data: activeList,
        total: activeList.length,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // ==============================================================================
  // 2. BUILDING MASTER (CREATE / EDIT / TOGGLE)
  // ==============================================================================

  // POST: create building
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, area_location, emirate, status, notes } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Building / Site Name is required.' });
      }

      const trimmedName = String(name).trim();
      const normalizedName = trimmedName.toLowerCase();

      if (!db.labourBuildings) db.labourBuildings = loadPersistentLabourBuildings();

      // Duplicate prevention: check normalized building name within company_pixel_syntax
      const duplicate = db.labourBuildings.find(
        (b: LabourBuilding) =>
          b.tenant_id === 'company_pixel_syntax' && b.name.trim().toLowerCase() === normalizedName
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: `A building with the name "${trimmedName}" already exists in Company Allied.`,
        });
      }

      const now = new Date().toISOString();
      const buildingId = `bld_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const actorName = (req as any).user?.name || (req as any).user?.username || 'admin';

      const newBuilding: LabourBuilding = {
        id: buildingId,
        tenant_id: 'company_pixel_syntax',
        name: trimmedName,
        area_location: area_location ? String(area_location).trim() : '',
        emirate: emirate ? String(emirate).trim() : 'Dubai',
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        notes: notes ? String(notes).trim() : undefined,
        created_at: now,
        updated_at: now,
        created_by: actorName,
        updated_by: actorName,
      };

      db.labourBuildings.unshift(newBuilding);
      savePersistentLabourBuildings(db.labourBuildings);

      // Persist to Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.from('labour_buildings').insert([
            {
              id: newBuilding.id,
              tenant_id: newBuilding.tenant_id,
              name: newBuilding.name,
              area_location: newBuilding.area_location,
              emirate: newBuilding.emirate,
              status: newBuilding.status,
              notes: newBuilding.notes || null,
              created_at: newBuilding.created_at,
              updated_at: newBuilding.updated_at,
              created_by: newBuilding.created_by,
              updated_by: newBuilding.updated_by,
            },
          ]);
        } catch (sbEx) {
          console.warn('Supabase insert exception:', sbEx);
        }
      }

      return res.status(201).json({
        success: true,
        building: newBuilding,
      });
    } catch (err: any) {
      console.error('Error in POST /api/erp/labour-buildings:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // PUT: update building
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, area_location, emirate, status, notes } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, error: 'Building / Site Name is required.' });
      }

      const trimmedName = String(name).trim();
      const normalizedName = trimmedName.toLowerCase();

      if (!db.labourBuildings) db.labourBuildings = loadPersistentLabourBuildings();

      const existingIndex = db.labourBuildings.findIndex(
        (b: LabourBuilding) => b.id === id && b.tenant_id === 'company_pixel_syntax'
      );

      if (existingIndex === -1) {
        return res.status(404).json({ success: false, error: 'Building not found.' });
      }

      // Check duplicate name on rename (excluding current building)
      const duplicate = db.labourBuildings.find(
        (b: LabourBuilding) =>
          b.id !== id &&
          b.tenant_id === 'company_pixel_syntax' &&
          b.name.trim().toLowerCase() === normalizedName
      );

      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: `Another building with the name "${trimmedName}" already exists.`,
        });
      }

      const now = new Date().toISOString();
      const updatedBuilding: LabourBuilding = {
        ...db.labourBuildings[existingIndex],
        name: trimmedName,
        area_location: area_location !== undefined ? String(area_location).trim() : db.labourBuildings[existingIndex].area_location,
        emirate: emirate !== undefined ? String(emirate).trim() : db.labourBuildings[existingIndex].emirate,
        status: status === 'INACTIVE' ? 'INACTIVE' : status === 'ACTIVE' ? 'ACTIVE' : db.labourBuildings[existingIndex].status,
        notes: notes !== undefined ? String(notes).trim() : db.labourBuildings[existingIndex].notes,
        updated_at: now,
        updated_by: (req as any).user?.name || (req as any).user?.username || 'admin',
      };

      db.labourBuildings[existingIndex] = updatedBuilding;
      savePersistentLabourBuildings(db.labourBuildings);

      // Persist update to Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('labour_buildings')
            .update({
              name: updatedBuilding.name,
              area_location: updatedBuilding.area_location,
              emirate: updatedBuilding.emirate,
              status: updatedBuilding.status,
              notes: updatedBuilding.notes || null,
              updated_at: now,
              updated_by: updatedBuilding.updated_by,
            })
            .eq('id', id);
        } catch (sbEx) {
          console.warn('Supabase update exception:', sbEx);
        }
      }

      return res.json({
        success: true,
        building: updatedBuilding,
      });
    } catch (err: any) {
      console.error('Error in PUT /api/erp/labour-buildings/:id:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // PATCH: toggle active/inactive status
  router.patch('/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!db.labourBuildings) db.labourBuildings = loadPersistentLabourBuildings();

      const existingIndex = db.labourBuildings.findIndex(
        (b: LabourBuilding) => b.id === id && b.tenant_id === 'company_pixel_syntax'
      );

      if (existingIndex === -1) {
        return res.status(404).json({ success: false, error: 'Building not found.' });
      }

      const targetStatus: 'ACTIVE' | 'INACTIVE' =
        status === 'INACTIVE'
          ? 'INACTIVE'
          : status === 'ACTIVE'
          ? 'ACTIVE'
          : db.labourBuildings[existingIndex].status === 'ACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE';

      const now = new Date().toISOString();
      const updatedBuilding: LabourBuilding = {
        ...db.labourBuildings[existingIndex],
        status: targetStatus,
        updated_at: now,
        updated_by: (req as any).user?.name || (req as any).user?.username || 'admin',
      };

      db.labourBuildings[existingIndex] = updatedBuilding;
      savePersistentLabourBuildings(db.labourBuildings);

      // Persist status to Supabase
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase
            .from('labour_buildings')
            .update({
              status: targetStatus,
              updated_at: now,
              updated_by: updatedBuilding.updated_by,
            })
            .eq('id', id);
        } catch (sbEx) {
          console.warn('Supabase patch status exception:', sbEx);
        }
      }

      return res.json({
        success: true,
        building: updatedBuilding,
      });
    } catch (err: any) {
      console.error('Error in PATCH /api/erp/labour-buildings/:id/status:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // ==============================================================================
  // 3. STEP 2 & 3: LABOUR EMPLOYEE ↔ BUILDING ASSIGNMENTS & HISTORY
  // ==============================================================================

  // GET: fetch all active building assignments across employees
  router.get('/assignments/active', async (_req: Request, res: Response) => {
    try {
      if (!db.labourBuildingAssignments) {
        db.labourBuildingAssignments = loadPersistentLabourBuildingAssignments();
      }

      // Sync from Supabase if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase
            .from('labour_building_assignments')
            .select('*')
            .eq('status', 'ACTIVE')
            .eq('tenant_id', 'company_pixel_syntax');

          if (!sbErr && Array.isArray(sbData)) {
            const asgMap = new Map<string, LabourBuildingAssignment>();
            db.labourBuildingAssignments.forEach((a: LabourBuildingAssignment) => asgMap.set(a.id, a));
            sbData.forEach((row: any) => {
              asgMap.set(row.id, {
                id: row.id,
                tenant_id: row.tenant_id || 'company_pixel_syntax',
                employee_id: row.employee_id,
                building_id: row.building_id,
                building_name: row.building_name,
                area_location: row.area_location || '',
                emirate: row.emirate || '',
                assignment_date: row.assignment_date,
                end_date: row.end_date || null,
                status: row.status,
                notes: row.notes || undefined,
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
                updated_by: row.updated_by,
              });
            });
            db.labourBuildingAssignments = Array.from(asgMap.values());
            savePersistentLabourBuildingAssignments(db.labourBuildingAssignments);
          }
        } catch (sbEx) {
          console.warn('Supabase sync warning for active labour_building_assignments:', sbEx);
        }
      }

      const activeAssignments = (db.labourBuildingAssignments || []).filter(
        (a: LabourBuildingAssignment) => a.status === 'ACTIVE'
      );

      return res.json({
        success: true,
        data: activeAssignments,
      });
    } catch (err: any) {
      console.error('Error in GET /api/erp/labour-buildings/assignments/active:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // GET: fetch active building assignment and history for a specific employee
  router.get('/assignments/employee/:employeeId', async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      if (!employeeId) {
        return res.status(400).json({ success: false, error: 'Employee ID is required.' });
      }

      if (!db.labourBuildingAssignments) {
        db.labourBuildingAssignments = loadPersistentLabourBuildingAssignments();
      }

      // Sync from Supabase if available
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: sbData, error: sbErr } = await supabase
            .from('labour_building_assignments')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('tenant_id', 'company_pixel_syntax')
            .order('assignment_date', { ascending: false });

          if (!sbErr && Array.isArray(sbData)) {
            const asgMap = new Map<string, LabourBuildingAssignment>();
            db.labourBuildingAssignments.forEach((a: LabourBuildingAssignment) => asgMap.set(a.id, a));
            sbData.forEach((row: any) => {
              asgMap.set(row.id, {
                id: row.id,
                tenant_id: row.tenant_id || 'company_pixel_syntax',
                employee_id: row.employee_id,
                building_id: row.building_id,
                building_name: row.building_name,
                area_location: row.area_location || '',
                emirate: row.emirate || '',
                assignment_date: row.assignment_date,
                end_date: row.end_date || null,
                status: row.status,
                notes: row.notes || undefined,
                created_at: row.created_at,
                updated_at: row.updated_at,
                created_by: row.created_by,
                updated_by: row.updated_by,
              });
            });
            db.labourBuildingAssignments = Array.from(asgMap.values());
            savePersistentLabourBuildingAssignments(db.labourBuildingAssignments);
          }
        } catch (sbEx) {
          console.warn('Supabase sync warning for labour_building_assignments:', sbEx);
        }
      }

      const employeeAssignments = (db.labourBuildingAssignments || [])
        .filter((a: LabourBuildingAssignment) => a.employee_id === employeeId)
        .sort((a: LabourBuildingAssignment, b: LabourBuildingAssignment) => {
          const dateDiff = new Date(b.assignment_date).getTime() - new Date(a.assignment_date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });

      const activeAssignment = employeeAssignments.find(
        (a: LabourBuildingAssignment) => a.status === 'ACTIVE'
      ) || null;

      const labourCheck = isEmployeeOnLabourProject(employeeId, db);

      return res.json({
        success: true,
        activeAssignment,
        history: employeeAssignments,
        isLabourEmployee: labourCheck.isLabour,
        activeProject: labourCheck.activeProject,
      });
    } catch (err: any) {
      console.error('Error in GET /api/erp/labour-buildings/assignments/employee/:employeeId:', err);
      return res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  // POST: assign building or transfer/change building
  const handleBuildingAssignmentRoute = async (req: Request, res: Response) => {
    try {
      const { employee_id, building_id, assignment_date, notes } = req.body;
      const actorName = (req as any).user?.name || (req as any).user?.username || 'admin';

      const result = await executeBuildingAssignment({
        db,
        tenantId: 'company_pixel_syntax',
        employeeId: employee_id,
        buildingId: building_id,
        assignmentDate: assignment_date,
        notes,
        actorName,
      });

      return res.status(201).json(result);
    } catch (err: any) {
      console.error('Error in building assignment route:', err);
      const status = err.statusCode || 500;
      return res.status(status).json({ success: false, error: err.message || 'Internal server error' });
    }
  };

  // POST: assign building
  router.post('/assign', handleBuildingAssignmentRoute);

  // POST: transfer / change building
  router.post('/transfer', handleBuildingAssignmentRoute);
  router.post('/change', handleBuildingAssignmentRoute);

  return router;
}
