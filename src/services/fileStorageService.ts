import { apiClient } from './apiClient';
import { DbEntityDocument } from '../types/database';

export interface StorageUploadUrlResponse {
  uploadUrl: string;
  method: 'PUT' | 'POST';
  r2ObjectKey: string;
  documentId: string;
  versionNumber: number;
  token: string;
  expiresInSeconds: number;
  directToR2: boolean;
  headers?: Record<string, string>;
}

export interface StorageUsageData {
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

export interface UploadOptions {
  tenantId?: string;
  entityType?: 'Employee' | 'Vehicle' | 'Company' | 'OfficeForm' | 'Import' | 'Branch' | 'Project' | 'Asset';
  entity_type?: 'Employee' | 'Vehicle' | 'Company' | 'OfficeForm' | 'Import' | 'Branch' | 'Project' | 'Asset';
  entityId?: string;
  entity_id?: string;
  entityName?: string;
  entity_name?: string;
  documentTypeId?: string;
  document_type_id?: string;
  documentTypeName?: string;
  document_type_name?: string;
  documentNumber?: string;
  document_number?: string;
  issueDate?: string;
  issue_date?: string;
  expiryDate?: string;
  expiry_date?: string;
  issuingAuthority?: string;
  issuing_authority?: string;
  issuingCountry?: string;
  issuing_country?: string;
  description?: string;
  notes?: string;
  replacementReason?: string;
  replacement_reason?: string;
  documentId?: string; // Optional if replacing existing document
  versionNumber?: number;
  is_replacement?: boolean;
  parent_document_id?: string;
  onProgress?: (percent: number) => void;
}

export interface BulkUploadItem {
  id: string;
  file: File;
  entityType: 'Employee' | 'Vehicle' | 'Company' | 'OfficeForm' | 'Import';
  entityId: string;
  entityName: string;
  documentTypeId: string;
  documentTypeName: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  status: 'Queued' | 'Uploading' | 'Uploaded' | 'Failed';
  progress: number;
  error?: string;
  resultDoc?: DbEntityDocument;
}

// 10 MB maximum upload limit
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Computes SHA-256 Checksum using Web Crypto API in browser
 */
export async function computeFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Optimizes image scans while preserving high-contrast text for official identity documents.
 * PDFs are strictly untouched.
 */
export async function optimizeDocumentFile(
  file: File,
  isOfficialIdentityDoc: boolean = false
): Promise<{ file: File; wasOptimized: boolean; originalSize: number; optimizedSize: number }> {
  const originalSize = file.size;

  // Never alter or compress PDF files
  if (file.type === 'application/pdf') {
    return { file, wasOptimized: false, originalSize, optimizedSize: originalSize };
  }

  // Only compress images if they are reasonably large (> 1.2 MB)
  if (!file.type.startsWith('image/') || originalSize < 1.2 * 1024 * 1024) {
    return { file, wasOptimized: false, originalSize, optimizedSize: originalSize };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        // Cap dimensions (keep high-res 2048px for official IDs/Passport/Mulkiya, 1920px for general)
        const maxDimension = isOfficialIdentityDoc ? 2048 : 1920;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ file, wasOptimized: false, originalSize, optimizedSize: originalSize });
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Quality: 0.90 for official docs to ensure text readability, 0.82 for general
        const quality = isOfficialIdentityDoc ? 0.90 : 0.82;
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < originalSize) {
              const optimizedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve({
                file: optimizedFile,
                wasOptimized: true,
                originalSize,
                optimizedSize: optimizedFile.size,
              });
            } else {
              resolve({ file, wasOptimized: false, originalSize, optimizedSize: originalSize });
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve({ file, wasOptimized: false, originalSize, optimizedSize: originalSize });
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve({ file, wasOptimized: false, originalSize, optimizedSize: originalSize });
    reader.readAsDataURL(file);
  });
}

/**
 * Client-side FileStorageService
 */
export const clientStorageService = {
  /**
   * Request authorized upload URL from backend
   */
  async requestUploadUrl(options: {
    tenantId?: string;
    entityType: string;
    entityId: string;
    documentTypeId: string;
    documentTypeName?: string;
    documentNumber?: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksum: string;
    documentId?: string;
    versionNumber?: number;
    replacementReason?: string;
    issueDate?: string;
    expiryDate?: string;
  }): Promise<StorageUploadUrlResponse> {
    const res = await apiClient.post<StorageUploadUrlResponse>('/api/erp/storage/upload-url', options);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Upload binary directly to Cloudflare R2 (or authorized fallback) with progress monitoring
   */
  async uploadBinary(
    url: string,
    file: File,
    headers?: Record<string, string>,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);

      if (headers) {
        Object.entries(headers).forEach(([k, v]) => {
          try {
            xhr.setRequestHeader(k, v);
          } catch (e) {
            // Ignore restricted headers
          }
        });
      } else {
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      }

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          reject(new Error(`Direct storage upload failed with HTTP status ${xhr.status}: ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload to Cloudflare storage.'));
      xhr.ontimeout = () => reject(new Error('Connection timed out during file upload.'));

      xhr.send(file);
    });
  },

  /**
   * Confirm upload and finalize metadata in Supabase
   */
  async confirmUpload(payload: {
    token?: string;
    tenantId?: string;
    documentId: string;
    r2ObjectKey: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    checksum: string;
    entityType: string;
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
  }): Promise<DbEntityDocument> {
    const res = await apiClient.post<{ document: DbEntityDocument }>('/api/erp/storage/confirm-upload', payload);
    if (res.error) throw new Error(res.error);
    return res.data!.document;
  },

  /**
   * Complete End-to-End Direct Upload Flow:
   * 1. Check size limit
   * 2. Compute SHA-256
   * 3. Optimize image if applicable
   * 4. Request signed R2 upload URL
   * 5. Upload binary directly
   * 6. Finalize metadata in Supabase
   */
  async updateDocumentExpiry(documentId: string, expiryDate: string): Promise<DbEntityDocument> {
    const res = await apiClient.patch<DbEntityDocument>(`/api/erp/storage/document-expiry/${encodeURIComponent(documentId)}`, { expiryDate });
    if (res.error || !res.data) throw new Error(res.error || 'Document expiry could not be saved');
    return res.data;
  },

  async uploadDocumentDirectly(
    rawFile: File,
    options: UploadOptions,
    onProgressCallback?: (percent: number) => void
  ): Promise<{ document: DbEntityDocument; r2ObjectKey: string }> {
    const progressHandler = onProgressCallback || options.onProgress;
    if (rawFile.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File size (${(rawFile.size / (1024 * 1024)).toFixed(1)} MB) exceeds maximum allowed 10 MB limit.`);
    }

    // Employee documents use the authenticated Worker/R2 endpoint on production.
    // It atomically registers the file metadata after the object reaches R2.
    if (options.entity_type === 'Employee' || options.entityType === 'Employee') {
      const form = new FormData();
      form.append('file', rawFile);
      form.append('employeeId', options.entity_id || options.entityId || '');
      form.append('documentTypeId', options.document_type_id || options.documentTypeId || '');
      if (options.documentId) form.append('documentId', options.documentId);
      const response = await apiClient.post<{ document: DbEntityDocument }>(
        '/api/erp/storage/document-upload', form
      );
      if (response.error || !response.data?.document) {
        throw new Error(response.error || 'Document was not saved');
      }
      onProgressCallback?.(100);
      return { document: response.data.document, r2ObjectKey: '' };
    }

    if (options.entity_type === 'Vehicle' || options.entityType === 'Vehicle') {
      const form = new FormData();
      form.append('file', rawFile);
      form.append('vehicleId', options.entity_id || options.entityId || '');
      form.append('documentTypeId', options.document_type_id || options.documentTypeId || '');
      if (options.documentId) form.append('documentId', options.documentId);
      const response = await apiClient.post<{ document: DbEntityDocument }>(
        '/api/erp/storage/vehicle-document-upload', form
      );
      if (response.error || !response.data?.document) {
        throw new Error(response.error || 'Vehicle document was not saved');
      }
      progressHandler?.(100);
      return { document: response.data.document, r2ObjectKey: '' };
    }

    // 1. Image optimization (preserves high-res on IDs)
    const isOfficial = ['Emirates ID', 'Passport Copy', 'Visa Copy', 'Driving License', 'Vehicle Mulkiya'].some(
      (name) => (options.documentTypeName || options.document_type_name)?.toLowerCase().includes(name.toLowerCase())
    );
    const { file: processedFile } = await optimizeDocumentFile(rawFile, isOfficial);

    const resolvedEntityType = (options.entityType || options.entity_type || 'Employee') as 'Employee' | 'Vehicle' | 'Company' | 'OfficeForm' | 'Import' | 'Branch' | 'Project' | 'Asset';
    const resolvedEntityId = options.entityId || options.entity_id || 'unknown';
    const resolvedEntityName = options.entityName || options.entity_name;
    const resolvedDocTypeId = options.documentTypeId || options.document_type_id || 'dt_misc';
    const resolvedDocTypeName = options.documentTypeName || options.document_type_name;
    const resolvedDocNumber = options.documentNumber || options.document_number;
    const resolvedIssueDate = options.issueDate || options.issue_date;
    const resolvedExpiryDate = options.expiryDate || options.expiry_date;
    const resolvedAuthority = options.issuingAuthority || options.issuing_authority;
    const resolvedCountry = options.issuingCountry || options.issuing_country;
    const resolvedReason = options.replacementReason || options.replacement_reason;

    // 2. Compute SHA-256 hash
    const checksum = await computeFileChecksum(processedFile);

    // 3. Request authorized upload URL
    const uploadMeta = await this.requestUploadUrl({
      tenantId: options.tenantId,
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      documentTypeId: resolvedDocTypeId,
      documentTypeName: resolvedDocTypeName,
      documentNumber: resolvedDocNumber,
      fileName: processedFile.name,
      mimeType: processedFile.type || 'application/pdf',
      fileSize: processedFile.size,
      checksum,
      documentId: options.documentId || options.parent_document_id,
      versionNumber: options.versionNumber,
      replacementReason: resolvedReason,
      issueDate: resolvedIssueDate,
      expiryDate: resolvedExpiryDate,
    });

    // 4. Direct Upload
    await this.uploadBinary(
      uploadMeta.uploadUrl,
      processedFile,
      uploadMeta.headers,
      progressHandler
    );

    // 5. Confirm Upload in Supabase PostgreSQL
    const doc = await this.confirmUpload({
      token: uploadMeta.token,
      tenantId: options.tenantId,
      documentId: uploadMeta.documentId,
      r2ObjectKey: uploadMeta.r2ObjectKey,
      fileName: processedFile.name,
      mimeType: processedFile.type || 'application/pdf',
      fileSize: processedFile.size,
      checksum,
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      entityName: resolvedEntityName,
      documentTypeId: resolvedDocTypeId,
      documentTypeName: resolvedDocTypeName,
      documentNumber: resolvedDocNumber || `DOC-${Date.now().toString().slice(-6)}`,
      issueDate: resolvedIssueDate,
      expiryDate: resolvedExpiryDate,
      issuingAuthority: resolvedAuthority,
      issuingCountry: resolvedCountry,
      description: options.description,
      notes: options.notes,
      replacementReason: resolvedReason,
    });

    return {
      document: doc,
      r2ObjectKey: uploadMeta.r2ObjectKey,
    };
  },

  /**
   * Request authorized short-lived read URL
   */
  async getAuthorizedReadUrl(documentId: string, versionId?: string): Promise<{
    readUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    expiresInSeconds: number;
    token?: string;
  }> {
    const qs = versionId ? `?versionId=${versionId}` : '';
    const res = await apiClient.get<{
      readUrl: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      expiresInSeconds: number;
      token?: string;
    }>(`/api/erp/storage/read-url/${documentId}${qs}`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Trigger direct secure file download
   */
  async triggerFileDownload(documentId: string, versionId?: string, fallbackFileName?: string): Promise<void> {
    const auth = await this.getAuthorizedReadUrl(documentId, versionId);
    if (!auth.readUrl || typeof window === 'undefined') {
      throw new Error('Saved file is unavailable for download.');
    }
    // A same-origin blob URL forces a download instead of opening a data URL in a tab.
    const response = await fetch(auth.readUrl);
    if (!response.ok) throw new Error('Saved file could not be downloaded.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = auth.fileName || fallbackFileName || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
  },

  /**
   * Get R2 Storage Monitoring Metrics
   */
  async getStorageDiagnostics(): Promise<StorageUsageData> {
    const res = await apiClient.get<StorageUsageData>('/api/erp/storage/diagnostics');
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Check for duplicate checksum before upload
   */
  async checkDuplicate(params: {
    entityId: string;
    documentTypeId: string;
    checksum: string;
    excludeDocumentId?: string;
  }): Promise<{ isDuplicate: boolean; message?: string }> {
    const res = await apiClient.post<{ isDuplicate: boolean; message?: string }>('/api/erp/storage/check-duplicate', params);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Soft archive document
   */
  async archiveDocument(documentId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/api/erp/documents/${documentId}`, {
      body: JSON.stringify({ reason }),
    });
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Guarded physical file deletion
   */
  async deleteFilePermanently(documentId: string, fileId?: string, reason: string = 'User requested purge'): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>('/api/erp/storage/delete-file', {
      body: JSON.stringify({ documentId, fileId, reason }),
    });
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  /**
   * Bulk upload with controlled concurrency (default 3 concurrent uploads)
   */
  async processBulkQueue(
    items: BulkUploadItem[],
    concurrency: number = 3,
    onItemUpdate: (updated: BulkUploadItem) => void
  ): Promise<void> {
    const queue = [...items];
    let active = 0;

    return new Promise((resolve) => {
      const processNext = async () => {
        if (queue.length === 0 && active === 0) {
          return resolve();
        }

        while (active < concurrency && queue.length > 0) {
          const item = queue.shift()!;
          if (item.status === 'Uploaded') {
            continue; // Skip already completed
          }

          active++;
          item.status = 'Uploading';
          item.progress = 10;
          onItemUpdate({ ...item });

          this.uploadDocumentDirectly(item.file, {
            entityType: item.entityType,
            entityId: item.entityId,
            entityName: item.entityName,
            documentTypeId: item.documentTypeId,
            documentTypeName: item.documentTypeName,
            documentNumber: item.documentNumber,
            issueDate: item.issueDate,
            expiryDate: item.expiryDate,
            onProgress: (pct) => {
              item.progress = Math.min(95, Math.max(10, pct));
              onItemUpdate({ ...item });
            },
          })
            .then((res) => {
              item.status = 'Uploaded';
              item.progress = 100;
              item.resultDoc = res.document;
              onItemUpdate({ ...item });
            })
            .catch((err) => {
              item.status = 'Failed';
              item.error = err.message || 'Upload failed';
              onItemUpdate({ ...item });
            })
            .finally(() => {
              active--;
              processNext();
            });
        }
      };

      processNext();
    });
  },
};
