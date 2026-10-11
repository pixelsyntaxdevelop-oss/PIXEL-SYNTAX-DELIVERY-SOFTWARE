import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { getSupabaseClient } from './supabaseDb';
import {
  validateVehicleBulkImport,
  commitVehicleBulkImport,
  generateVehicleXlsxTemplate,
  generateVehicleCsvTemplate,
} from './vehicleBulkImportService';

const upload = multer({ storage: multer.memoryStorage() });

export {
  validateVehicleBulkImport,
  commitVehicleBulkImport,
  generateVehicleXlsxTemplate,
  generateVehicleCsvTemplate,
};

export function createBulkImportRouter(db: any, getGeminiClient: () => GoogleGenAI) {
  const router = Router();

  /**
   * POST /validate
   * Pre-import Validation Only (No Database Writes)
   * Supports BOTH XLSX and CSV formats.
   * Scans rows, detects duplicate plates, duplicate chassis, production conflicts, and missing required.
   * Strictly ignores rider and project assignments.
   */
  router.post('/validate', upload.single('file') as any, async (req: Request, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'No file uploaded. Please provide an XLSX or CSV file.' });
      }

      const result = await validateVehicleBulkImport(req.file.buffer, {
        supabase: getSupabaseClient(),
        db,
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Vehicle bulk import validate error:', err);
      return res.status(400).json({ error: err.message || 'Error validating file' });
    }
  });

  /**
   * POST /commit
   * Final Safe Commit Step for Vehicle Bulk Import
   * - company_pixel_syntax only
   * - Persists to real Supabase production vehicles table & updates in-memory fleet master
   * - Commits ONLY rows marked READY / VALID
   * - Strictly NO auto-assignment of riders or projects
   * - No deletes, resets, or overwrites
   */
  router.post('/commit', async (req: Request, res: Response) => {
    try {
      const { rows, dryRun } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No vehicle rows provided for commit' });
      }

      const result = await commitVehicleBulkImport(rows, {
        supabase: getSupabaseClient(),
        db,
        dryRun: Boolean(dryRun),
      });

      return res.json(result);
    } catch (err: any) {
      console.error('Vehicle bulk import commit exception:', err);
      return res.status(500).json({ error: err.message || 'Server error during commit' });
    }
  });

  return router;
}
