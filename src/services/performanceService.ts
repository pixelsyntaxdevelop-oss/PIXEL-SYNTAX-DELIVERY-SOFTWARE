/**
 * Performance Service - API Client
 * Multi-Tenant Delivery Operations ERP
 */

import { apiClient } from './apiClient';
import {
  DbProjectPerformanceConfig,
  DbRiderDailyPerformance,
  RiderPerformanceSummary,
  PerformanceException,
  DbPerformanceImportBatch,
  PerformanceImportPreviewRow,
  MonthlyPerformancePayrollSync,
  PerformanceCorrectionAuditLog,
  PerformanceAiDiagnostic,
} from '../types/performance';

export class PerformanceService {
  /**
   * Fetch All Project Performance Configurations
   */
  static async getProjectConfigs(): Promise<DbProjectPerformanceConfig[]> {
    try {
      const res = await apiClient.get<DbProjectPerformanceConfig[]>('/api/erp/performance/configs');
      return res.data || [];
    } catch (error) {
      console.warn('API getProjectConfigs failed, using fallback:', error);
      return [];
    }
  }

  static async getConfigs(): Promise<DbProjectPerformanceConfig[]> {
    return this.getProjectConfigs();
  }

  /**
   * Save / Update Project Performance Config
   */
  static async saveProjectConfig(
    config: Partial<DbProjectPerformanceConfig>
  ): Promise<DbProjectPerformanceConfig | null> {
    const res = await apiClient.post<DbProjectPerformanceConfig>('/api/erp/performance/configs', config);
    return res.data || null;
  }

  static async saveConfig(
    config: Partial<DbProjectPerformanceConfig>
  ): Promise<DbProjectPerformanceConfig | null> {
    return this.saveProjectConfig(config);
  }

  /**
   * Fetch Daily Performance Records
   */
  static async getDailyPerformance(params?: {
    projectId?: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    platform?: string;
  }): Promise<DbRiderDailyPerformance[]> {
    try {
      const query = new URLSearchParams();
      if (params?.projectId) query.append('projectId', params.projectId);
      if (params?.employeeId) query.append('employeeId', params.employeeId);
      if (params?.startDate) query.append('startDate', params.startDate);
      if (params?.endDate) query.append('endDate', params.endDate);
      if (params?.platform) query.append('platform', params.platform);

      const res = await apiClient.get<DbRiderDailyPerformance[]>(`/api/erp/performance/daily?${query.toString()}`);
      return res.data || [];
    } catch (error) {
      console.warn('API getDailyPerformance failed, using fallback:', error);
      return [];
    }
  }

  /**
   * Fetch Aggregated Summaries for all Riders (with exceptions and scores)
   */
  static async getRiderSummaries(params?: {
    projectId?: string;
    search?: string;
    scoreCategory?: string;
    hasExceptions?: boolean;
    period?: string;
  }): Promise<RiderPerformanceSummary[]> {
    try {
      const query = new URLSearchParams();
      if (params?.projectId) query.append('projectId', params.projectId);
      if (params?.search) query.append('search', params.search);
      if (params?.scoreCategory) query.append('scoreCategory', params.scoreCategory);
      if (params?.hasExceptions !== undefined) query.append('hasExceptions', String(params.hasExceptions));
      if (params?.period) query.append('period', params.period);

      const res = await apiClient.get<RiderPerformanceSummary[]>(`/api/erp/performance/summaries?${query.toString()}`);
      return res.data || [];
    } catch (error) {
      console.warn('API getRiderSummaries failed, using fallback:', error);
      return [];
    }
  }

  static async getSummaries(params?: any): Promise<RiderPerformanceSummary[]> {
    return this.getRiderSummaries(params);
  }

  /**
   * Fetch 360 Performance details for a single Rider (Profile Tab view)
   */
  static async getRider360Performance(employeeId: string): Promise<RiderPerformanceSummary | null> {
    try {
      const res = await apiClient.get<RiderPerformanceSummary>(`/api/erp/performance/rider/${employeeId}`);
      return res.data || null;
    } catch (error) {
      console.warn('API getRider360Performance failed:', error);
      return null;
    }
  }

  static async getRider360(employeeId: string): Promise<RiderPerformanceSummary | null> {
    return this.getRider360Performance(employeeId);
  }

  /**
   * Preview and Parse Performance CSV/Excel Import
   */
  static async previewImportData(
    payload: {
      projectId?: string;
      platform?: string;
      fileName: string;
      csvContent?: string;
      rows?: any[];
    }
  ): Promise<{
    batch?: Partial<DbPerformanceImportBatch>;
    rows: PerformanceImportPreviewRow[];
    summary: {
      totalRows: number;
      validRows: number;
      conflictRows: number;
      matchedRiders: number;
    };
    error?: string;
  }> {
    const res = await apiClient.post('/api/erp/performance/import/preview', payload);
    if (res.data) {
      return res.data;
    }
    return {
      rows: [],
      summary: { totalRows: 0, validRows: 0, conflictRows: 0, matchedRiders: 0 },
      error: res.error || 'Failed to parse preview',
    };
  }

  static async previewImport(payload: any): Promise<any> {
    return this.previewImportData(payload);
  }

  /**
   * Commit and Apply Performance Import Batch
   */
  static async commitImportBatch(
    payload: {
      projectId?: string;
      platform?: string;
      fileName: string;
      rows: PerformanceImportPreviewRow[];
      overwriteDuplicates?: boolean;
    }
  ): Promise<{
    success: boolean;
    importedCount: number;
    updatedCount: number;
    batchId: string;
    error?: string;
  }> {
    const res = await apiClient.post('/api/erp/performance/import/commit', payload);
    if (res.data) {
      return res.data;
    }
    return {
      success: false,
      importedCount: 0,
      updatedCount: 0,
      batchId: '',
      error: res.error || 'Failed to commit import batch',
    };
  }

  static async commitImport(payload: any): Promise<any> {
    return this.commitImportBatch(payload);
  }

  /**
   * Correct Performance Metric (Manual Data Correction with Audit Trail)
   */
  static async correctPerformanceRecord(
    recordIdOrPayload: string | { recordId: string; updates: Partial<DbRiderDailyPerformance>; reason: string },
    updatesParam?: Partial<DbRiderDailyPerformance>,
    reasonParam?: string
  ): Promise<{
    success: boolean;
    record?: DbRiderDailyPerformance;
    auditLog?: PerformanceCorrectionAuditLog;
    error?: string;
  }> {
    const recordId = typeof recordIdOrPayload === 'object' ? recordIdOrPayload.recordId : recordIdOrPayload;
    const updates = typeof recordIdOrPayload === 'object' ? recordIdOrPayload.updates : updatesParam;
    const reason = typeof recordIdOrPayload === 'object' ? recordIdOrPayload.reason : (reasonParam || '');

    const res = await apiClient.post(`/api/erp/performance/daily/${recordId}/correct`, {
      updates,
      reason,
    });
    if (res.data) {
      return res.data;
    }
    return {
      success: false,
      error: res.error || 'Failed to correct record',
    };
  }

  static async correctDailyMetric(
    recordIdOrPayload: any,
    updates?: any,
    reason?: any
  ): Promise<any> {
    return this.correctPerformanceRecord(recordIdOrPayload, updates, reason);
  }

  /**
   * Fetch Operational Exceptions / Attention Required Queue
   */
  static async getOperationalExceptions(params?: {
    projectId?: string;
    severity?: string;
    type?: string;
  }): Promise<PerformanceException[]> {
    try {
      const query = new URLSearchParams();
      if (params?.projectId) query.append('projectId', params.projectId);
      if (params?.severity) query.append('severity', params.severity);
      if (params?.type) query.append('type', params.type);

      const res = await apiClient.get<PerformanceException[]>(`/api/erp/performance/exceptions?${query.toString()}`);
      return res.data || [];
    } catch (error) {
      console.warn('API getOperationalExceptions failed:', error);
      return [];
    }
  }

  static async getExceptions(params?: any): Promise<PerformanceException[]> {
    return this.getOperationalExceptions(params);
  }

  /**
   * Sync Monthly Performance Metrics & Calculated Incentives to Automated Payroll
   */
  static async syncToPayroll(monthKey: string): Promise<MonthlyPerformancePayrollSync | null> {
    const res = await apiClient.post<MonthlyPerformancePayrollSync>('/api/erp/performance/payroll-sync', {
      monthKey,
    });
    return res.data || null;
  }

  /**
   * AI Copilot Performance Root Cause Diagnostic
   */
  static async runAiRootCauseAnalysis(employeeId: string): Promise<PerformanceAiDiagnostic> {
    const res = await apiClient.post<PerformanceAiDiagnostic>('/api/erp/performance/ai-diagnose', { employeeId });
    if (res.data) {
      return res.data;
    }
    return {
      analysis: 'Diagnostic currently unavailable.',
      contributingFactors: [],
      actionableSuggestions: [],
    };
  }

  static async runAiDiagnostic(employeeId: string): Promise<PerformanceAiDiagnostic> {
    return this.runAiRootCauseAnalysis(employeeId);
  }
}

export const performanceService = PerformanceService;
