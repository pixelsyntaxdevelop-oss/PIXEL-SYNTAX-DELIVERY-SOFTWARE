/**
 * Authoritative Projects Service for Company Allied ERP
 * Maintains the single source of truth for company_allied active projects (rider & labor).
 * Ensures consistency across Node.js server.ts and Cloudflare Worker production environments.
 */

import fs from 'fs';
import path from 'path';

export interface AuthoritativeProject {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  client_name: string;
  branch_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  rate_per_order: number;
  external_id_label: string;
  requires_external_id?: boolean;
  project_type?: 'RIDER' | 'LABOR' | 'LOGISTICS';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const AUTHORITATIVE_COMPANY_ALLIED_PROJECTS: AuthoritativeProject[] = [];

/**
 * Resolves a project from an ID, alias, code, or name.
 * Handles aliases such as `proj_noon` -> `proj_noon_1`, `proj_keeta` -> `proj_keeta_1`.
 */
export function resolveAuthoritativeProject(
  idOrCodeOrAlias?: string,
  existingList: AuthoritativeProject[] = AUTHORITATIVE_COMPANY_ALLIED_PROJECTS
): AuthoritativeProject | undefined {
  if (!idOrCodeOrAlias) return undefined;
  const clean = String(idOrCodeOrAlias).trim().toLowerCase();

  // 1. Direct ID match
  const direct = existingList.find((p) => p.id.toLowerCase() === clean);
  if (direct) return direct;

  // 2. Base ID alias match (e.g. 'proj_noon' matches 'proj_noon_1' or vice versa)
  const aliasMatch = existingList.find((p) => {
    const baseId = p.id.replace(/_\d+$/, '').toLowerCase();
    const inputBaseId = clean.replace(/_\d+$/, '');
    return baseId === inputBaseId;
  });
  if (aliasMatch) return aliasMatch;

  // 3. Project code match
  const codeMatch = existingList.find((p) => p.code.toLowerCase() === clean);
  if (codeMatch) return codeMatch;

  // 4. Project name match
  const nameMatch = existingList.find((p) => p.name.toLowerCase() === clean);
  if (nameMatch) return nameMatch;

  // 5. Keyword match
  if (clean.includes('noon')) return existingList.find((p) => p.id.includes('noon'));
  if (clean.includes('keeta')) return existingList.find((p) => p.id.includes('keeta'));
  if (clean.includes('talabat')) return existingList.find((p) => p.id.includes('talabat'));
  if (clean.includes('deliveroo')) return existingList.find((p) => p.id.includes('deliveroo'));
  if (clean.includes('careem')) return existingList.find((p) => p.id.includes('careem'));
  if (clean.includes('labour') || clean.includes('labor')) return existingList.find((p) => p.id.includes('labour'));
  if (clean.includes('amazon')) return existingList.find((p) => p.id.includes('amazon'));

  return undefined;
}

const PERSISTENT_PROJECT_ASSIGNMENTS_FILE = path.join(process.cwd(), 'data', 'persistent_project_assignments.json');

/**
 * Load persistent project assignments from disk if available
 */
export function loadPersistentProjectAssignments(): any[] {
  try {
    if (fs.existsSync(PERSISTENT_PROJECT_ASSIGNMENTS_FILE)) {
      const data = fs.readFileSync(PERSISTENT_PROJECT_ASSIGNMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read persistent_project_assignments.json:', err);
  }
  return [];
}

/**
 * Save project assignments to disk for persistence across server restarts
 */
export function savePersistentProjectAssignments(assignments: any[]): void {
  try {
    const dir = path.dirname(PERSISTENT_PROJECT_ASSIGNMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PERSISTENT_PROJECT_ASSIGNMENTS_FILE, JSON.stringify(assignments, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write persistent_project_assignments.json:', err);
  }
}
