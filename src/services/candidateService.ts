/**
 * Candidate Procurement & 6-Stage Visa/License Workflow Service
 * Multi-Tenant PostgreSQL isolation
 */

import { apiClient } from './apiClient';
import { CandidateRecord } from '../types/erp';
import { DbCandidate } from '../types/database';

class CandidateService {
  public async getCandidates(): Promise<CandidateRecord[]> {
    const res = await apiClient.get<CandidateRecord[]>('/api/candidates');
    return res.data || [];
  }

  public async getCandidateById(id: string): Promise<CandidateRecord | null> {
    const res = await apiClient.get<CandidateRecord>(`/api/candidates/${id}`);
    return res.data || null;
  }

  public async getCandidateByEmployeeId(employeeId: string): Promise<CandidateRecord | null> {
    const res = await apiClient.get<CandidateRecord>(`/api/candidates/by-employee/${employeeId}`);
    return res.data || null;
  }

  public async createCandidate(data: Partial<CandidateRecord>): Promise<{ success: boolean; candidate?: CandidateRecord; error?: string }> {
    const res = await apiClient.post<CandidateRecord>('/api/candidates', data);
    if (res.data && !res.error) {
      return { success: true, candidate: res.data };
    }
    return { success: false, error: res.error || 'Failed to create candidate' };
  }

  public async updateCandidate(
    id: string,
    updates: Partial<CandidateRecord>
  ): Promise<{ success: boolean; candidate?: CandidateRecord; error?: string }> {
    const res = await apiClient.put<CandidateRecord>(`/api/candidates/${id}`, updates);
    if (res.data && !res.error) {
      return { success: true, candidate: res.data };
    }
    return { success: false, error: res.error || 'Failed to update candidate' };
  }

  public async updateCandidateStage(
    id: string,
    stageCode: CandidateRecord['currentStageCode'],
    stageName: string,
    stageStatus: CandidateRecord['stageStatus'],
    stageData?: Record<string, any>
  ): Promise<{ success: boolean; candidate?: CandidateRecord; error?: string }> {
    const res = await apiClient.put<CandidateRecord>(`/api/candidates/${id}/stage`, {
      stageCode,
      stageName,
      stageStatus,
      stageData,
    });
    if (res.data && !res.error) {
      return { success: true, candidate: res.data };
    }
    return { success: false, error: res.error || 'Failed to update candidate stage' };
  }

  public async deleteCandidate(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/candidates/${id}`);
    return { success: !res.error, error: res.error };
  }
}

export const candidateService = new CandidateService();
