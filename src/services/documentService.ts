import { apiClient } from './apiClient';
import {
  DbDocumentType,
  DbEntityDocument,
  DbDocumentVersion,
  DbDocumentFile,
  DbDocumentActivity,
  DbRequiredDocumentRule,
  DbDocumentExpiryAlert,
  DocumentEntityType,
  DocumentStatus,
  DocumentCompletenessReport,
  DocumentExpiryDashboardSummary,
} from '../types/database';
import JSZip from 'jszip';

export interface DocumentFilterParams {
  search?: string;
  entityType?: DocumentEntityType | 'ALL' | '';
  entityId?: string;
  documentTypeId?: string;
  status?: DocumentStatus | 'ALL' | '';
  branchId?: string;
  branch?: string;
  state?: string;
  employeeStatus?: string;
  projectId?: string;
  expiryRange?: string;
  expiryBucket?: '0_15' | '16_30' | '31_40' | 'DUE_40' | 'EXPIRED' | 'VALID' | 'ALL' | string;
  page?: number;
  pageSize?: number;
  sortBy?: 'expiryDate' | 'createdAt' | 'entityName' | 'docType';
  sortOrder?: 'asc' | 'desc';
}

export interface ExpiryDashboardStats {
  totalDocuments: number;
  expired: number;
  expiresToday: number;
  expiring_0_15: number;
  expiring_16_30: number;
  expiring_31_40: number;
  dueIn40Days: number;
  expiring7Days?: number;
  expiring15Days?: number;
  expiring30Days?: number;
  expiring60Days?: number;
  expiring90Days?: number;
  valid: number;
  noExpiry: number;
  byDocumentType: {
    id: string;
    typeName: string;
    code?: string;
    category?: string;
    count: number;
    expired: number;
    dueIn40Days: number;
    expiring_0_15?: number;
    expiring_16_30?: number;
    expiring_31_40?: number;
    expiringSoon?: number;
  }[];
  byEntityType: { entityType: string; count: number; expired: number; expiringSoon: number }[];
  byBranch: { branchName: string; count: number; expired: number }[];
}

export interface DocumentCompletenessResult {
  entityType: DocumentEntityType;
  entityId: string;
  entityName: string;
  targetRoleOrType: string;
  totalRequired: number;
  totalUploaded: number;
  completionPercentage: number;
  isComplete: boolean;
  uploadedDocuments: {
    documentTypeId: string;
    documentTypeName: string;
    documentNumber: string;
    expiryDate?: string;
    daysRemaining?: number;
    status: DocumentStatus;
  }[];
  missingDocumentTypes: string[];
}

export interface EntitySearchResult {
  id: string;
  entityId: string;
  name: string;
  type: DocumentEntityType;
  code?: string;
  branchName?: string;
  projectName?: string;
  phone?: string;
  emiratesId?: string;
  status?: string;
  photo?: string;
}

export const documentService = {
  // 1. Document Types
  async getDocumentTypes(category?: string): Promise<DbDocumentType[]> {
    const url = category ? `/api/erp/documents/types?category=${category}` : '/api/erp/documents/types';
    const res = await apiClient.get<DbDocumentType[]>(url);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async createDocumentType(data: Partial<DbDocumentType>): Promise<DbDocumentType> {
    const res = await apiClient.post<DbDocumentType>('/api/erp/documents/types', data);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async updateDocumentType(id: string, data: Partial<DbDocumentType>): Promise<DbDocumentType> {
    const res = await apiClient.put<DbDocumentType>(`/api/erp/documents/types/${id}`, data);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async deleteDocumentType(id: string): Promise<{ success: boolean }> {
    const res = await apiClient.delete<{ success: boolean }>(`/api/erp/documents/types/${id}`);
    if (res.error) throw new Error(res.error);
    return res.data || { success: true };
  },

  // 2. Generic Entity Documents Listing & Search
  async getDocuments(params: DocumentFilterParams = {}): Promise<{
    documents: DbEntityDocument[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.entityType) query.append('entityType', params.entityType);
    if (params.entityId) query.append('entityId', params.entityId);
    if (params.documentTypeId) query.append('documentTypeId', params.documentTypeId);
    if (params.status) query.append('status', params.status);
    if (params.branchId) query.append('branchId', params.branchId);
    if (params.branch) query.append('branch', params.branch);
    if (params.state) query.append('state', params.state);
    if (params.employeeStatus) query.append('employeeStatus', params.employeeStatus);
    if (params.projectId) query.append('projectId', params.projectId);
    if (params.expiryRange) query.append('expiryRange', params.expiryRange);
    if (params.expiryBucket) query.append('expiryBucket', params.expiryBucket);
    if (params.page) query.append('page', String(params.page));
    if (params.pageSize) query.append('pageSize', String(params.pageSize));
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    const res = await apiClient.get<{
      documents: DbEntityDocument[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    }>(`/api/erp/documents?${query.toString()}`);

    if (res.error) throw new Error(res.error);
    return res.data || { documents: [], total: 0, page: 1, pageSize: 50, totalPages: 1 };
  },

  // 3. Document Details & Versions
  async getDocumentDetails(documentId: string): Promise<DbEntityDocument> {
    const res = await apiClient.get<DbEntityDocument>(`/api/erp/documents/${documentId}`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async getDocumentVersions(documentId: string): Promise<DbDocumentVersion[]> {
    const res = await apiClient.get<DbDocumentVersion[]>(`/api/erp/documents/${documentId}/versions`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  async getDocumentActivity(documentId: string): Promise<DbDocumentActivity[]> {
    const res = await apiClient.get<DbDocumentActivity[]>(`/api/erp/documents/${documentId}/activity`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  // 4. Upload New Document
  async uploadDocument(formData: {
    entity_type: DocumentEntityType;
    entity_id: string;
    entity_name?: string;
    document_type_id: string;
    document_number: string;
    issue_date?: string;
    expiry_date?: string;
    issuing_authority?: string;
    issuing_country?: string;
    description?: string;
    notes?: string;
    branch_id?: string;
    file_name: string;
    original_file_name?: string;
    mime_type?: string;
    file_size?: number;
    file_data_url?: string;
  }): Promise<DbEntityDocument> {
    const res = await apiClient.post<DbEntityDocument>('/api/erp/documents', formData);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  // 5. Replace Document (New Version)
  async replaceDocument(
    documentId: string,
    data: {
      document_number?: string;
      issue_date?: string;
      expiry_date?: string;
      replacement_reason: string;
      file_name: string;
      original_file_name?: string;
      mime_type?: string;
      file_size?: number;
      file_data_url?: string;
    }
  ): Promise<DbEntityDocument> {
    const res = await apiClient.post<DbEntityDocument>(`/api/erp/documents/${documentId}/replace`, data);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  // 5b. Add Document Version alias
  async addDocumentVersion(
    documentId: string,
    data: {
      document_number?: string;
      issue_date?: string;
      expiry_date?: string;
      replacement_reason?: string;
      file_name: string;
      original_file_name?: string;
      mime_type?: string;
      file_size?: number;
      file_data_url?: string;
    }
  ): Promise<DbEntityDocument> {
    return this.replaceDocument(documentId, {
      ...data,
      replacement_reason: data.replacement_reason || 'Document renewal / update',
    });
  },

  // 5c. Download Document File directly
  async downloadDocumentFile(documentId: string, fileId?: string, fileName?: string): Promise<void> {
    try {
      const tokenRes = await this.getDownloadToken(documentId, fileId);
      if (tokenRes.dataUrl && typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = tokenRes.dataUrl;
        link.download = fileName || tokenRes.fileName || 'document.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (tokenRes.downloadUrl && typeof window !== 'undefined') {
        window.open(tokenRes.downloadUrl, '_blank');
      }
    } catch (e) {
      console.error('Download file failed, using fallback:', e);
    }
  },

  // 5d. Download All Files as ZIP alias
  async downloadAllDocumentFilesAsZip(documentId: string, zipName?: string): Promise<Blob> {
    return this.bulkDownloadZip([documentId], zipName);
  },

  // 6. Edit Document Metadata
  async updateDocument(documentId: string, updates: Partial<DbEntityDocument>): Promise<DbEntityDocument> {
    const res = await apiClient.put<DbEntityDocument>(`/api/erp/documents/${documentId}`, updates);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  // 7. Archive / Invalidate Document
  async archiveDocument(documentId: string, _reason?: string): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.delete<{ success: boolean; message: string }>(`/api/erp/storage/document-archive/${encodeURIComponent(documentId)}`);
    if (res.error) throw new Error(res.error);
    return res.data || { success: true, message: 'Document removed' };
  },

  async invalidateDocument(documentId: string, reason?: string): Promise<{ success: boolean; message: string }> {
    return this.archiveDocument(documentId, reason);
  },

  // 8. Authorized Secure Download / View Token
  async getDownloadToken(documentId: string, versionId?: string): Promise<{
    downloadUrl: string;
    token: string;
    expiresInSeconds: number;
    fileName: string;
    mimeType: string;
    dataUrl?: string;
  }> {
    const query = versionId ? `?versionId=${versionId}` : '';
    const res = await apiClient.get<{
      downloadUrl: string;
      token: string;
      expiresInSeconds: number;
      fileName: string;
      mimeType: string;
      dataUrl?: string;
    }>(`/api/erp/documents/${documentId}/download${query}`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  async getDocumentDownloadUrl(documentId: string, versionId?: string): Promise<{
    downloadUrl: string;
    token: string;
    expiresInSeconds: number;
    fileName: string;
    mimeType: string;
    dataUrl?: string;
  }> {
    return this.getDownloadToken(documentId, versionId);
  },

  // 9. Bulk Download Documents as ZIP
  async bulkDownloadZip(documentIds: string[], zipName?: string): Promise<Blob> {
    const response = await apiClient.post<{
      files: {
        documentId: string;
        fileName: string;
        dataUrl: string;
        docType: string;
        entityName: string;
      }[];
    }>('/api/erp/documents/bulk-download', { documentIds });

    if (response.error) throw new Error(response.error);

    const zip = new JSZip();
    const files = response.data?.files || [];

    for (const file of files) {
      if (file.dataUrl && file.dataUrl.includes('base64,')) {
        const base64Data = file.dataUrl.split('base64,')[1];
        const folderName = (file.entityName || 'General').replace(/[/\\?%*:|"<>]/g, '_');
        zip.folder(folderName)?.file(file.fileName, base64Data, { base64: true });
      } else {
        throw new Error('Actual file bytes were not returned for ' + (file.fileName || file.documentId) +
          '. ZIP export cancelled rather than creating a fake attachment.');
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    if (zipName && typeof window !== 'undefined') {
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return zipBlob;
  },

  // 10. Expiry Dashboard Analytics
  async getExpiryDashboard(params?: { entityType?: string; branchId?: string; state?: string }): Promise<ExpiryDashboardStats> {
    const query = new URLSearchParams();
    if (params?.entityType) query.append('entityType', params.entityType);
    if (params?.branchId) query.append('branchId', params.branchId);
    if (params?.state) query.append('state', params.state);
    const qs = query.toString();
    const res = await apiClient.get<ExpiryDashboardStats>(`/api/erp/documents/expiry-dashboard${qs ? `?${qs}` : ''}`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  // 11. Document Completeness Check
  async getDocumentCompleteness(entityType: DocumentEntityType, entityId: string): Promise<DocumentCompletenessReport> {
    const res = await apiClient.get<DocumentCompletenessReport>(`/api/erp/documents/completeness/${entityType}/${entityId}`);
    if (res.error) throw new Error(res.error);
    return res.data!;
  },

  // 12. RouteMate-style Search Entities Resolver
  async searchEntities(query: string, entityType?: DocumentEntityType): Promise<EntitySearchResult[]> {
    const typeParam = entityType ? `&entityType=${entityType}` : '';
    const res = await apiClient.get<EntitySearchResult[]>(`/api/erp/documents/search-entities?q=${encodeURIComponent(query)}${typeParam}`);
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  // 13. Expiry Notifications
  async getExpiryNotifications(): Promise<DbDocumentExpiryAlert[]> {
    const res = await apiClient.get<DbDocumentExpiryAlert[]>('/api/erp/documents/notifications');
    if (res.error) throw new Error(res.error);
    return res.data || [];
  },

  // 14. Helper AI Copilot Tools Interface
  async resolveEmployee(query: string) {
    return this.searchEntities(query, 'Employee');
  },

  async listEmployeeDocuments(employeeId: string) {
    return this.getDocuments({ entityType: 'Employee', entityId: employeeId });
  },

  async getDocumentMetadata(documentId: string) {
    return this.getDocumentDetails(documentId);
  },

  async getAuthorizedDocumentDownload(documentId: string) {
    return this.getDownloadToken(documentId);
  },

  async getExpiringDocuments(expiryRange: '7_DAYS' | '15_DAYS' | '30_DAYS' | '60_DAYS' | '90_DAYS' = '30_DAYS') {
    return this.getDocuments({ expiryRange });
  },

  async getMissingDocuments(entityType: DocumentEntityType, entityId: string) {
    return this.getDocumentCompleteness(entityType, entityId);
  },
};
