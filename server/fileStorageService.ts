import dotenv from 'dotenv';
dotenv.config();
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getSupabaseClient } from './supabaseDb';

// ==============================================================================
// 1. ENVIRONMENT CONFIGURATION & R2 CLIENT
// ==============================================================================

export function checkIsR2Configured(): boolean {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
  return Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    !accountId.includes('placeholder') &&
    !accessKeyId.includes('placeholder')
  );
}

export const isR2Configured = checkIsR2Configured();

export function getR2BucketName(): string {
  return process.env.R2_BUCKET_NAME || 'allied-erp-documents';
}

let r2S3Client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (!checkIsR2Configured()) return null;
  if (!r2S3Client) {
    try {
      const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
      const accessKeyId = process.env.R2_ACCESS_KEY_ID || '';
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || '';
      const bucketName = getR2BucketName();

      r2S3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log('✅ Cloudflare R2 S3 Client initialized for bucket:', bucketName);
    } catch (err) {
      console.error('❌ Failed to initialize Cloudflare R2 client:', err);
      return null;
    }
  }
  return r2S3Client;
}

// In-memory fallback binary/token store for preview/dev sessions when R2 credentials are not set
const localUploadTokens = new Map<string, {
  token: string;
  r2ObjectKey: string;
  documentId: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  documentTypeId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  expiresAt: number;
  dataBuffer?: Buffer;
}>();

// ==============================================================================
// 2. TYPES & INTERFACES
// ==============================================================================

export type StorageEntityType = 'Employee' | 'Vehicle' | 'Company' | 'OfficeForm' | 'Import' | 'Branch' | 'Project' | 'Asset';

export interface StorageUploadRequest {
  tenantId: string;
  entityType: StorageEntityType;
  entityId: string;
  documentTypeId: string;
  documentTypeName?: string;
  documentNumber?: string;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSize: number;
  checksum?: string;
  documentId?: string;
  versionNumber?: number;
  replacementReason?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  description?: string;
  notes?: string;
  actorName: string;
  actorRole?: string;
}

export interface StorageUploadResponse {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  r2ObjectKey: string;
  documentId: string;
  versionNumber: number;
  token: string;
  expiresInSeconds: number;
  directToR2: boolean;
  headers?: Record<string, string>;
  checksumVerified?: boolean;
}

export interface ConfirmUploadRequest {
  token?: string;
  tenantId: string;
  documentId: string;
  r2ObjectKey: string;
  fileName: string;
  originalFileName?: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  entityType: StorageEntityType;
  entityId: string;
  entityName?: string;
  documentTypeId: string;
  documentTypeName?: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate?: string;
  issuingAuthority?: string;
  issuingCountry?: string;
  description?: string;
  notes?: string;
  replacementReason?: string;
  actorName: string;
  actorRole?: string;
  fileDataUrl?: string; // Optional temporary preview data URL if available
}

export interface StorageReadResponse {
  readUrl: string;
  r2ObjectKey: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  expiresInSeconds: number;
  token?: string;
  isDirectR2: boolean;
  dataUrl?: string;
}

export interface StorageUsageMetrics {
  isConfigured: boolean;
  bucketName: string;
  totalFiles: number;
  r2UsedStorageBytes: number;
  r2UsedStorageFormatted: string;
  softLimitBytes: number;
  softLimitFormatted: string;
  percentageUsed: number;
  warningLevel: 'NORMAL' | 'WARNING_70' | 'WARNING_80' | 'CRITICAL_90';
  warningMessage?: string;
  employeeDocsCount: number;
  employeeDocsBytes: number;
  employeeDocsFormatted: string;
  vehicleDocsCount: number;
  vehicleDocsBytes: number;
  vehicleDocsFormatted: string;
  officeFormsCount: number;
  officeFormsBytes: number;
  officeFormsFormatted: string;
  importFilesCount: number;
  importFilesBytes: number;
  importFilesFormatted: string;
  autoDeleteActive: boolean;
  isEstimated: boolean;
}

// 10 GB Free Tier in Bytes
const TEN_GB_BYTES = 10 * 1024 * 1024 * 1024;
// Maximum single file size allowed (10 MB default)
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

// Allowed mime types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
]);

// Helper for formatting file size
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper to sanitize filename
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

// ==============================================================================
// 3. FILE STORAGE SERVICE IMPLEMENTATION
// ==============================================================================

export class FileStorageService {
  /**
   * Generates canonical Cloudflare R2 object key with strict Demo / Production isolation:
   * - Demo: demo/{tenant_id}/...
   * - Production: production/{tenant_id}/...
   */
  static buildObjectKey(params: {
    tenantId: string;
    entityType: StorageEntityType;
    entityId: string;
    documentId: string;
    versionNumber?: number;
    fileName: string;
  }): string {
    const { tenantId, entityType, entityId, documentId, versionNumber = 1, fileName } = params;
    const cleanFileName = sanitizeFileName(fileName);
    const prefix = (tenantId === 'company_demo' || tenantId.startsWith('demo'))
      ? `demo/${tenantId}`
      : `production/${tenantId}`;

    switch (entityType) {
      case 'Employee':
        return `${prefix}/employees/${entityId}/documents/${documentId}/${versionNumber}/${cleanFileName}`;
      case 'Vehicle':
        return `${prefix}/vehicles/${entityId}/documents/${documentId}/${versionNumber}/${cleanFileName}`;
      case 'OfficeForm':
        return `${prefix}/office-forms/${entityId}/${documentId}/${cleanFileName}`;
      case 'Import':
        return `${prefix}/imports/${entityId || 'general'}/${documentId}/${cleanFileName}`;
      default:
        return `${prefix}/company/documents/${documentId}/${versionNumber}/${cleanFileName}`;
    }
  }

  /**
   * Calculate SHA-256 Checksum
   */
  static calculateChecksum(data: Buffer | string): string {
    const hash = crypto.createHash('sha256');
    if (typeof data === 'string') {
      if (data.startsWith('data:') && data.includes('base64,')) {
        const base64Data = data.split('base64,')[1];
        hash.update(Buffer.from(base64Data, 'base64'));
      } else {
        hash.update(data);
      }
    } else {
      hash.update(data);
    }
    return hash.digest('hex');
  }

  /**
   * 1. CREATE UPLOAD URL
   * Validates request and returns pre-signed PUT URL to Cloudflare R2 (or authorized fallback token route).
   */
  static async createUploadUrl(req: StorageUploadRequest, dbContext?: any): Promise<StorageUploadResponse> {
    const tenantId = req.tenantId || 'company_pixel_syntax';

    // 1. File Size Validation
    if (req.fileSize > MAX_UPLOAD_SIZE_BYTES) {
      throw new Error(`File size (${formatBytes(req.fileSize)}) exceeds maximum allowed limit of ${formatBytes(MAX_UPLOAD_SIZE_BYTES)}.`);
    }

    // 2. MIME Type Validation
    const cleanMime = (req.mimeType || 'application/pdf').toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
      throw new Error(`MIME type '${req.mimeType}' is not supported. Allowed formats: PDF, JPEG, PNG, WEBP, Word, Excel.`);
    }

    // 3. Document ID and Version allocation
    const documentId = req.documentId || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const versionNumber = req.versionNumber || 1;

    // 4. Canonical R2 Object Key
    const r2ObjectKey = this.buildObjectKey({
      tenantId,
      entityType: req.entityType,
      entityId: req.entityId,
      documentId,
      versionNumber,
      fileName: req.fileName,
    });

    // 5. Checksum duplicate prevention check
    if (req.checksum && dbContext) {
      const isDuplicate = this.checkDuplicateChecksum({
        tenantId,
        entityId: req.entityId,
        documentTypeId: req.documentTypeId,
        checksum: req.checksum,
        excludeDocumentId: req.documentId,
        dbContext,
      });
      if (isDuplicate) {
        throw new Error(`Duplicate file detected: An identical document with the same content hash already exists for this record.`);
      }
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresInSeconds = 900; // 15 minutes

    const client = getR2Client();
    const r2Configured = checkIsR2Configured();
    const bucketName = getR2BucketName();

    if (client && r2Configured) {
      // Real Cloudflare R2 Pre-Signed PUT URL
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: r2ObjectKey,
        ContentType: cleanMime,
        ContentLength: req.fileSize > 0 ? req.fileSize : undefined,
        Metadata: {
          tenant_id: tenantId,
          entity_type: req.entityType,
          entity_id: req.entityId,
          document_id: documentId,
          version: String(versionNumber),
          checksum: req.checksum || '',
          uploaded_by: req.actorName,
        },
      });

      const presignedUrl = await getSignedUrl(client, putCommand, { expiresIn: expiresInSeconds });

      return {
        uploadUrl: presignedUrl,
        method: 'PUT',
        r2ObjectKey,
        documentId,
        versionNumber,
        token,
        expiresInSeconds,
        directToR2: true,
        headers: {
          'Content-Type': cleanMime,
        },
      };
    }

    // Fallback: Register token for authorized backend upload route
    localUploadTokens.set(token, {
      token,
      r2ObjectKey,
      documentId,
      tenantId,
      entityType: req.entityType,
      entityId: req.entityId,
      documentTypeId: req.documentTypeId,
      fileName: req.fileName,
      mimeType: cleanMime,
      fileSize: req.fileSize,
      checksum: req.checksum,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    return {
      uploadUrl: `/api/erp/storage/upload/${token}`,
      method: 'PUT',
      r2ObjectKey,
      documentId,
      versionNumber,
      token,
      expiresInSeconds,
      directToR2: false,
    };
  }

  /**
   * Check for duplicate checksum
   */
  static checkDuplicateChecksum(params: {
    tenantId: string;
    entityId: string;
    documentTypeId: string;
    checksum: string;
    excludeDocumentId?: string;
    dbContext: any;
  }): boolean {
    const { tenantId, entityId, documentTypeId, checksum, excludeDocumentId, dbContext } = params;
    if (!checksum) return false;

    // Check in-memory documentFiles
    const files = dbContext.documentFiles || [];
    const docs = dbContext.entityDocuments || [];

    const existingFile = files.find((f: any) => {
      if (f.checksum !== checksum || f.tenant_id !== tenantId) return false;
      const parentDoc = docs.find((d: any) => d.id === f.document_id);
      if (!parentDoc || parentDoc.is_archived) return false;
      if (parentDoc.entity_id === entityId && parentDoc.document_type_id === documentTypeId) {
        if (excludeDocumentId && parentDoc.id === excludeDocumentId) return false;
        return true;
      }
      return false;
    });

    return Boolean(existingFile);
  }

  /**
   * 2. CONFIRM UPLOAD & PERSIST METADATA IN SUPABASE POSTGRESQL
   */
  static async confirmUpload(params: ConfirmUploadRequest, dbContext: any): Promise<{
    document: any;
    file: any;
    version: any;
  }> {
    const {
      token,
      tenantId,
      documentId,
      r2ObjectKey,
      fileName,
      originalFileName,
      mimeType,
      fileSize,
      checksum,
      entityType,
      entityId,
      entityName = 'Entity Record',
      documentTypeId,
      documentTypeName = 'Document',
      documentNumber,
      issueDate,
      expiryDate,
      issuingAuthority = 'UAE Authority',
      issuingCountry = 'United Arab Emirates',
      description,
      notes,
      replacementReason,
      actorName,
      fileDataUrl,
    } = params;

    // Clean up local token if used
    if (token) {
      localUploadTokens.delete(token);
    }

    const now = new Date().toISOString();
    const versionId = `ver_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Determine document status based on expiry
    let status = 'VALID';
    let daysRemaining: number | undefined;

    if (expiryDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exp = new Date(expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diffTime = exp.getTime() - today.getTime();
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (daysRemaining < 0) {
        status = 'EXPIRED';
      } else if (daysRemaining === 0) {
        status = 'EXPIRES_TODAY';
      } else if (daysRemaining <= 30) {
        status = 'EXPIRING_SOON';
      } else {
        status = 'VALID';
      }
    } else {
      status = 'NO_EXPIRY';
    }

    // Check if document already exists (e.g. version replacement)
    let existingDoc = (dbContext.entityDocuments || []).find(
      (d: any) => d.id === documentId && d.tenant_id === tenantId
    );

    let currentVersionNumber = 1;

    if (existingDoc) {
      currentVersionNumber = (existingDoc.current_version_number || 1) + 1;
      existingDoc.current_version_number = currentVersionNumber;
      existingDoc.current_version_id = versionId;
      existingDoc.current_file_id = fileId;
      existingDoc.current_file_name = fileName;
      existingDoc.document_number = documentNumber || existingDoc.document_number;
      if (issueDate) existingDoc.issue_date = issueDate;
      if (expiryDate) existingDoc.expiry_date = expiryDate;
      if (issuingAuthority) existingDoc.issuing_authority = issuingAuthority;
      if (issuingCountry) existingDoc.issuing_country = issuingCountry;
      if (description) existingDoc.description = description;
      if (notes) existingDoc.notes = notes;
      existingDoc.status = status;
      existingDoc.days_remaining = daysRemaining;
      existingDoc.updated_by = actorName;
      existingDoc.updated_at = now;
      existingDoc.r2_object_key = r2ObjectKey;
      existingDoc.file_size = fileSize;
    } else {
      existingDoc = {
        id: documentId,
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        document_type_id: documentTypeId,
        document_type_name: documentTypeName,
        document_number: documentNumber || `DOC-${Date.now().toString().slice(-6)}`,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        issuing_authority: issuingAuthority,
        issuing_country: issuingCountry,
        status,
        days_remaining: daysRemaining,
        description: description || null,
        notes: notes || null,
        current_version_id: versionId,
        current_version_number: 1,
        current_file_id: fileId,
        current_file_name: fileName,
        created_by: actorName,
        created_at: now,
        updated_by: actorName,
        updated_at: now,
        is_archived: false,
        r2_object_key: r2ObjectKey,
        file_size: fileSize,
      };
      if (!dbContext.entityDocuments) dbContext.entityDocuments = [];
      dbContext.entityDocuments.unshift(existingDoc);
    }

    // Create Document Version
    const versionRecord = {
      id: versionId,
      tenant_id: tenantId,
      document_id: documentId,
      version_number: currentVersionNumber,
      document_number: documentNumber || existingDoc.document_number,
      issue_date: issueDate || null,
      expiry_date: expiryDate || null,
      file_id: fileId,
      file_name: fileName,
      file_size: formatBytes(fileSize),
      mime_type: mimeType,
      storage_path: r2ObjectKey,
      replacement_reason: replacementReason || (currentVersionNumber === 1 ? 'Initial upload' : 'Document renewed/replaced'),
      is_current: true,
      uploaded_by: actorName,
      uploaded_at: now,
    };
    if (!dbContext.documentVersions) dbContext.documentVersions = [];
    // Mark previous versions as non-current
    dbContext.documentVersions.forEach((v: any) => {
      if (v.document_id === documentId) v.is_current = false;
    });
    dbContext.documentVersions.unshift(versionRecord);

    // Create Document File Record
    const fileRecord = {
      id: fileId,
      tenant_id: tenantId,
      document_id: documentId,
      version_id: versionId,
      file_name: fileName,
      original_file_name: originalFileName || fileName,
      mime_type: mimeType,
      file_size: fileSize,
      file_size_formatted: formatBytes(fileSize),
      storage_path: r2ObjectKey,
      storage_provider: 'CLOUDFLARE_R2',
      checksum: checksum || '',
      uploaded_by: actorName,
      uploaded_at: now,
      data_url: fileDataUrl, // Only temporary preview helper if needed
    };
    if (!dbContext.documentFiles) dbContext.documentFiles = [];
    dbContext.documentFiles.unshift(fileRecord);

    // Audit activity log
    if (!dbContext.documentActivities) dbContext.documentActivities = [];
    dbContext.documentActivities.unshift({
      id: `act_${Date.now()}`,
      tenant_id: tenantId,
      document_id: documentId,
      entity_type: entityType,
      entity_id: entityId,
      action: currentVersionNumber === 1 ? 'UPLOAD' : 'REPLACE',
      performed_by: actorName,
      performed_by_role: 'Operations Admin',
      details: `${currentVersionNumber === 1 ? 'Uploaded' : 'Replaced with version ' + currentVersionNumber} ${documentTypeName} (${documentNumber}) - Stored in Cloudflare R2`,
      version_number: currentVersionNumber,
      ip_address: '127.0.0.1',
      timestamp: now.replace('T', ' ').substring(0, 19),
    });

    // --------------------------------------------------------------------------
    // PERSIST PURE METADATA TO SUPABASE POSTGRESQL (NO BLOBS!)
    // --------------------------------------------------------------------------
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        // 1. entity_documents
        await supabase.from('entity_documents').upsert({
          id: existingDoc.id,
          tenant_id: existingDoc.tenant_id,
          entity_type: existingDoc.entity_type,
          entity_id: existingDoc.entity_id,
          entity_name: existingDoc.entity_name,
          document_type_id: existingDoc.document_type_id,
          document_type_name: existingDoc.document_type_name,
          document_number: existingDoc.document_number,
          issue_date: existingDoc.issue_date,
          expiry_date: existingDoc.expiry_date,
          issuing_authority: existingDoc.issuing_authority,
          issuing_country: existingDoc.issuing_country,
          status: existingDoc.status,
          days_remaining: existingDoc.days_remaining,
          description: existingDoc.description,
          notes: existingDoc.notes,
          current_version_number: existingDoc.current_version_number,
          created_by: existingDoc.created_by,
          created_at: existingDoc.created_at,
          updated_by: existingDoc.updated_by,
          updated_at: existingDoc.updated_at,
          is_archived: existingDoc.is_archived || false,
        });

        // 2. document_versions
        await supabase.from('document_versions').insert({
          id: versionRecord.id,
          tenant_id: versionRecord.tenant_id,
          document_id: versionRecord.document_id,
          version_number: versionRecord.version_number,
          document_number: versionRecord.document_number,
          issue_date: versionRecord.issue_date,
          expiry_date: versionRecord.expiry_date,
          file_id: versionRecord.file_id,
          file_name: versionRecord.file_name,
          file_size: versionRecord.file_size,
          mime_type: versionRecord.mime_type,
          storage_path: versionRecord.storage_path,
          replacement_reason: versionRecord.replacement_reason,
          is_current: versionRecord.is_current,
          uploaded_by: versionRecord.uploaded_by,
          uploaded_at: versionRecord.uploaded_at,
        });

        // 3. document_files
        await supabase.from('document_files').insert({
          id: fileRecord.id,
          tenant_id: fileRecord.tenant_id,
          document_id: fileRecord.document_id,
          version_id: fileRecord.version_id,
          file_name: fileRecord.file_name,
          original_file_name: fileRecord.original_file_name,
          mime_type: fileRecord.mime_type,
          file_size: fileRecord.file_size,
          file_size_formatted: fileRecord.file_size_formatted,
          storage_path: fileRecord.storage_path,
          storage_provider: 'CLOUDFLARE_R2',
          checksum: fileRecord.checksum,
          uploaded_by: fileRecord.uploaded_by,
          uploaded_at: fileRecord.uploaded_at,
        });

        // 4. Audit Log
        await supabase.from('audit_logs').insert({
          id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          tenant_id: tenantId,
          actor_name: actorName,
          actor_role: 'Operations Admin',
          action: currentVersionNumber === 1 ? 'DOCUMENT_UPLOAD' : 'DOCUMENT_REPLACE',
          action_type: currentVersionNumber === 1 ? 'CREATE' : 'UPDATE',
          module: 'Document Vault',
          entity_type: entityType,
          entity_id: entityId,
          details: `Confirmed R2 document upload: ${documentTypeName} (${documentNumber}) - Key: ${r2ObjectKey}`,
          status: 'SUCCESS',
          created_at: now,
        });

        console.log(`✅ Document metadata persisted to Supabase: ${documentId} (R2 key: ${r2ObjectKey})`);
      } catch (dbErr: any) {
        console.error('⚠️ Supabase persistence warning for document metadata:', dbErr.message || dbErr);
      }
    }

    return {
      document: existingDoc,
      file: fileRecord,
      version: versionRecord,
    };
  }

  /**
   * 3. CREATE READ URL (Authorized Short-Lived Signed URL)
   */
  static async createReadUrl(params: {
    documentId: string;
    versionId?: string;
    tenantId: string;
    actorName?: string;
    dbContext: any;
  }): Promise<StorageReadResponse> {
    const { documentId, versionId, tenantId, actorName = 'User', dbContext } = params;

    const doc = (dbContext.entityDocuments || []).find(
      (d: any) => d.id === documentId && (d.tenant_id === tenantId || tenantId === 'company_pixel_syntax')
    );

    if (!doc) {
      throw new Error(`Document record '${documentId}' not found or access denied.`);
    }

    const version = versionId
      ? (dbContext.documentVersions || []).find((v: any) => v.id === versionId && v.document_id === doc.id)
      : (dbContext.documentVersions || []).find((v: any) => v.id === doc.current_version_id) ||
        (dbContext.documentVersions || []).find((v: any) => v.document_id === doc.id);

    const file = version
      ? (dbContext.documentFiles || []).find((f: any) => f.id === version.file_id) || (dbContext.documentFiles || []).find((f: any) => f.storage_path === version.storage_path)
      : (dbContext.documentFiles || []).find((f: any) => f.document_id === doc.id);

    const r2ObjectKey = file?.storage_path || doc.r2_object_key || this.buildObjectKey({
      tenantId: doc.tenant_id,
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      documentId: doc.id,
      versionNumber: doc.current_version_number,
      fileName: file?.file_name || `${doc.document_type_name}_${doc.document_number}.pdf`,
    });

    const fileName = file?.file_name || `${doc.document_type_name}_${doc.document_number}.pdf`;
    const mimeType = file?.mime_type || 'application/pdf';
    const fileSize = file?.file_size || 0;
    const expiresInSeconds = 900; // 15 minutes

    const client = getR2Client();
    const r2Configured = checkIsR2Configured();
    const bucketName = getR2BucketName();

    if (client && r2Configured) {
      // Real Cloudflare R2 Pre-Signed GET URL
      const getCommand = new GetObjectCommand({
        Bucket: bucketName,
        Key: r2ObjectKey,
        ResponseContentDisposition: `inline; filename="${fileName}"`,
      });

      const readUrl = await getSignedUrl(client, getCommand, { expiresIn: expiresInSeconds });

      return {
        readUrl,
        r2ObjectKey,
        fileName,
        mimeType,
        fileSize,
        expiresInSeconds,
        isDirectR2: true,
      };
    }

    // Fallback: Generate cryptographic token for authorized streaming route
    const readToken = crypto.randomBytes(24).toString('hex');
    localUploadTokens.set(readToken, {
      token: readToken,
      r2ObjectKey,
      documentId,
      tenantId: doc.tenant_id,
      entityType: doc.entity_type,
      entityId: doc.entity_id,
      documentTypeId: doc.document_type_id,
      fileName,
      mimeType,
      fileSize,
      expiresAt: Date.now() + expiresInSeconds * 1000,
    });

    return {
      readUrl: `/api/erp/storage/read/${readToken}`,
      token: readToken,
      r2ObjectKey,
      fileName,
      mimeType,
      fileSize,
      expiresInSeconds,
      isDirectR2: false,
      dataUrl: file?.data_url,
    };
  }

  /**
   * 4. GET STORAGE USAGE & MONITORING (10GB Free Tier Guard)
   */
  static async getStorageUsage(tenantId: string = 'company_pixel_syntax', dbContext?: any): Promise<StorageUsageMetrics> {
    const files = (dbContext?.documentFiles || []).filter(
      (f: any) => !tenantId || f.tenant_id === tenantId || tenantId === 'company_pixel_syntax'
    );
    const docs = dbContext?.entityDocuments || [];
    const forms = dbContext?.generatedForms || [];

    let totalBytes = 0;
    let employeeDocsCount = 0;
    let employeeDocsBytes = 0;
    let vehicleDocsCount = 0;
    let vehicleDocsBytes = 0;
    let officeFormsCount = 0;
    let officeFormsBytes = 0;
    let importFilesCount = 0;
    let importFilesBytes = 0;

    for (const file of files) {
      const size = Number(file.file_size) || 0;
      totalBytes += size;

      const parentDoc = docs.find((d: any) => d.id === file.document_id);
      const entityType = parentDoc?.entity_type || '';

      if (entityType === 'Employee' || file.storage_path?.includes('/employees/')) {
        employeeDocsCount++;
        employeeDocsBytes += size;
      } else if (entityType === 'Vehicle' || file.storage_path?.includes('/vehicles/')) {
        vehicleDocsCount++;
        vehicleDocsBytes += size;
      } else if (entityType === 'OfficeForm' || file.storage_path?.includes('/office-forms/')) {
        officeFormsCount++;
        officeFormsBytes += size;
      } else if (file.storage_path?.includes('/imports/')) {
        importFilesCount++;
        importFilesBytes += size;
      } else {
        employeeDocsCount++;
        employeeDocsBytes += size;
      }
    }

    // Account for signed office forms
    for (const form of forms) {
      if (form.signed_file_url || form.r2_object_key) {
        officeFormsCount++;
        const estimatedSize = form.file_size || 250 * 1024; // ~250KB average signed form
        officeFormsBytes += estimatedSize;
        totalBytes += estimatedSize;
      }
    }

    const percentageUsed = Math.min(100, parseFloat(((totalBytes / TEN_GB_BYTES) * 100).toFixed(2)));

    let warningLevel: 'NORMAL' | 'WARNING_70' | 'WARNING_80' | 'CRITICAL_90' = 'NORMAL';
    let warningMessage: string | undefined;

    if (percentageUsed >= 90) {
      warningLevel = 'CRITICAL_90';
      warningMessage = `CRITICAL: Cloudflare R2 storage has reached ${percentageUsed}% (9GB+). You are approaching the 10GB free tier threshold. Standard R2 storage charges of $0.015/GB-month will apply beyond 10GB.`;
    } else if (percentageUsed >= 80) {
      warningLevel = 'WARNING_80';
      warningMessage = `WARNING: Cloudflare R2 storage has reached ${percentageUsed}% (8GB+). Plan accordingly to maintain optimal storage limits.`;
    } else if (percentageUsed >= 70) {
      warningLevel = 'WARNING_70';
      warningMessage = `NOTICE: Cloudflare R2 storage is at ${percentageUsed}% (7GB+). Capacity is in healthy range.`;
    }

    return {
      isConfigured: checkIsR2Configured(),
      bucketName: getR2BucketName(),
      totalFiles: files.length + (officeFormsCount > 0 ? officeFormsCount : 0),
      r2UsedStorageBytes: totalBytes,
      r2UsedStorageFormatted: formatBytes(totalBytes),
      softLimitBytes: TEN_GB_BYTES,
      softLimitFormatted: '10.00 GB',
      percentageUsed,
      warningLevel,
      warningMessage,
      employeeDocsCount,
      employeeDocsBytes,
      employeeDocsFormatted: formatBytes(employeeDocsBytes),
      vehicleDocsCount,
      vehicleDocsBytes,
      vehicleDocsFormatted: formatBytes(vehicleDocsBytes),
      officeFormsCount,
      officeFormsBytes,
      officeFormsFormatted: formatBytes(officeFormsBytes),
      importFilesCount,
      importFilesBytes,
      importFilesFormatted: formatBytes(importFilesBytes),
      autoDeleteActive: false, // Strict safety guarantee: never automatically delete employee compliance files
      isEstimated: !isR2Configured,
    };
  }

  /**
   * 5. ARCHIVE FILE (Soft delete only)
   */
  static async archiveFile(params: {
    documentId: string;
    reason?: string;
    actorName: string;
    tenantId: string;
    dbContext: any;
  }): Promise<boolean> {
    const { documentId, reason = 'Document archived', actorName, tenantId, dbContext } = params;
    const doc = (dbContext.entityDocuments || []).find(
      (d: any) => d.id === documentId && (d.tenant_id === tenantId || tenantId === 'company_pixel_syntax')
    );

    if (!doc) {
      throw new Error(`Document '${documentId}' not found.`);
    }

    const now = new Date().toISOString();
    doc.is_archived = true;
    doc.archived_at = now;
    doc.archived_by = actorName;
    doc.status = 'ARCHIVED';
    doc.updated_at = now;

    // Log activity
    if (!dbContext.documentActivities) dbContext.documentActivities = [];
    dbContext.documentActivities.unshift({
      id: `act_${Date.now()}`,
      tenant_id: tenantId,
      document_id: doc.id,
      entity_type: doc.entity_type,
      entity_id: doc.entity_id,
      action: 'ARCHIVE',
      performed_by: actorName,
      performed_by_role: 'Operations Admin',
      details: `Archived document: ${reason}`,
      version_number: doc.current_version_number,
      ip_address: '127.0.0.1',
      timestamp: now.replace('T', ' ').substring(0, 19),
    });

    // Sync to Supabase
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase
          .from('entity_documents')
          .update({
            is_archived: true,
            status: 'ARCHIVED',
            updated_at: now,
          })
          .eq('id', doc.id);
      } catch (err: any) {
        console.error('Supabase archive update failed:', err.message);
      }
    }

    return true;
  }

  /**
   * 6. DELETE PHYSICAL FILE IF ALLOWED (Guarded reference check)
   */
  static async deleteFileIfAllowed(params: {
    documentId: string;
    fileId?: string;
    reason: string;
    actorName: string;
    tenantId: string;
    dbContext: any;
  }): Promise<{ success: boolean; message: string; deletedKey?: string }> {
    const { documentId, fileId, reason, actorName, tenantId, dbContext } = params;

    const doc = (dbContext.entityDocuments || []).find((d: any) => d.id === documentId);
    if (!doc) {
      throw new Error(`Document '${documentId}' not found.`);
    }

    // Safety rule 13: check if any active document version references this file
    const file = fileId
      ? (dbContext.documentFiles || []).find((f: any) => f.id === fileId)
      : (dbContext.documentFiles || []).find((f: any) => f.document_id === documentId);

    if (!file) {
      throw new Error('File record not found.');
    }

    const objectKey = file.storage_path;

    // Check references
    const referencingVersions = (dbContext.documentVersions || []).filter(
      (v: any) => v.storage_path === objectKey && v.is_current
    );

    if (!doc.is_archived && referencingVersions.length > 0) {
      return {
        success: false,
        message: 'Cannot delete physical file: it is currently attached to an active, non-archived document version. Please archive the document first.',
      };
    }

    // Physical deletion on Cloudflare R2 if configured
    const client = getR2Client();
    const r2Configured = checkIsR2Configured();
    const bucketName = getR2BucketName();
    if (client && r2Configured && objectKey) {
      try {
        await client.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          })
        );
        console.log(`🗑️ Physical object deleted from Cloudflare R2: ${objectKey}`);
      } catch (r2Err: any) {
        console.error('Failed to delete object from R2:', r2Err.message);
      }
    }

    // Remove file record from in-memory DB
    dbContext.documentFiles = (dbContext.documentFiles || []).filter((f: any) => f.id !== file.id);

    // Audit the deletion
    const now = new Date().toISOString();
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('audit_logs').insert({
          id: `audit_${Date.now()}_del`,
          tenant_id: tenantId,
          actor_name: actorName,
          actor_role: 'Operations Admin',
          action: 'PHYSICAL_FILE_DELETE',
          action_type: 'DELETE',
          module: 'Cloudflare R2 Storage',
          entity_type: doc.entity_type,
          entity_id: doc.entity_id,
          details: `Physically deleted R2 object key: ${objectKey} for document ${documentId}. Reason: ${reason}`,
          status: 'SUCCESS',
          created_at: now,
        });
      } catch (err: any) {
        console.error('Audit log write failed for file delete:', err.message);
      }
    }

    return {
      success: true,
      message: `Physical file successfully deleted from Cloudflare R2 storage.`,
      deletedKey: objectKey,
    };
  }
}
