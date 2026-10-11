import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { getSupabaseClient } from './supabaseDb';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const uploadHandler: RequestHandler = async (req, res) => {
  try {
    const file = req.file;
    // We expect tenantId to come from params, but RequestHandler doesn't know about params.
    // However, req.params *will* be populated when mounted on /api/platform-admin/tenants/:tenantId/branding
    const tenantId = (req as any).params.tenantId;
    const { assetType } = req.body;
    
    if (!file || !tenantId || !assetType) {
      return res.status(400).json({ success: false, error: 'Missing file, tenantId, or assetType' });
    }

    const client = getSupabaseClient();
    if (!client) {
      return res.status(500).json({ success: false, error: 'Supabase not configured' });
    }

    // Generate unique filename
    const filename = `${tenantId}/${assetType}-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    // Upload to Supabase 'branding' bucket
    const { data, error } = await client.storage
      .from('branding')
      .upload(filename, file.buffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ success: false, error: 'Failed to upload to storage' });
    }

    // Get public URL
    const { data: publicUrlData } = client.storage
      .from('branding')
      .getPublicUrl(filename);

    res.json({ success: true, assetUrl: publicUrlData.publicUrl });
  } catch (err) {
    console.error('Upload endpoint error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

router.post('/upload', upload.single('file') as any, uploadHandler);

export const brandingUploadRouter = router;
