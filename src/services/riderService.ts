/**
 * Rider & Driver Fleet Management Service with Tenant Isolation
 */

import { apiClient } from './apiClient';
import { RiderDriver, RiderStatus } from '../types/erp';
import { DbRider } from '../types/database';

class RiderService {
  public async getRiders(branchId?: string): Promise<RiderDriver[]> {
    const query = branchId && branchId !== 'ALL' ? `?branchId=${branchId}` : '';
    const res = await apiClient.get<RiderDriver[]>(`/api/riders${query}`);
    return res.data || [];
  }

  public async getRiderById(id: string): Promise<RiderDriver | null> {
    const res = await apiClient.get<RiderDriver>(`/api/riders/${id}`);
    return res.data || null;
  }

  public async createRider(data: Partial<RiderDriver>): Promise<{ success: boolean; rider?: RiderDriver; error?: string }> {
    const res = await apiClient.post<RiderDriver>('/api/riders', data);
    if (res.data && !res.error) {
      return { success: true, rider: res.data };
    }
    return { success: false, error: res.error || 'Failed to create rider' };
  }

  public async updateRider(id: string, updates: Partial<RiderDriver>): Promise<{ success: boolean; rider?: RiderDriver; error?: string }> {
    const res = await apiClient.put<RiderDriver>(`/api/riders/${id}`, updates);
    if (res.data && !res.error) {
      return { success: true, rider: res.data };
    }
    return { success: false, error: res.error || 'Failed to update rider' };
  }

  public async updateRiderStatus(id: string, status: RiderStatus): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/riders/${id}/status`, { status });
    return { success: !res.error, error: res.error };
  }

  public async deleteRider(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/riders/${id}`);
    return { success: !res.error, error: res.error };
  }
}

export const riderService = new RiderService();
