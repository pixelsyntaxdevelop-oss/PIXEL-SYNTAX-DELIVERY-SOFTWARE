/**
 * Vehicle & Asset Fleet Management Service with Tenant Isolation
 */

import { apiClient } from './apiClient';
import { Vehicle, VehicleStatus } from '../types/erp';
import { DbVehicle } from '../types/database';

class VehicleService {
  public async getVehicles(branchId?: string): Promise<Vehicle[]> {
    const query = branchId && branchId !== 'ALL' ? `?branchId=${branchId}` : '';
    const res = await apiClient.get<Vehicle[]>(`/api/vehicles${query}`);
    return res.data || [];
  }

  public async getVehicleById(id: string): Promise<Vehicle | null> {
    const res = await apiClient.get<Vehicle>(`/api/vehicles/${id}`);
    return res.data || null;
  }

  public async createVehicle(data: Partial<Vehicle>): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    const res = await apiClient.post<Vehicle>('/api/vehicles', data);
    if (res.data && !res.error) {
      return { success: true, vehicle: res.data };
    }
    return { success: false, error: res.error || 'Failed to create vehicle' };
  }

  public async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<{ success: boolean; vehicle?: Vehicle; error?: string }> {
    const res = await apiClient.put<Vehicle>(`/api/vehicles/${id}`, updates);
    if (res.data && !res.error) {
      return { success: true, vehicle: res.data };
    }
    return { success: false, error: res.error || 'Failed to update vehicle' };
  }

  public async updateVehicleStatus(id: string, status: VehicleStatus): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/vehicles/${id}/status`, { status });
    return { success: !res.error, error: res.error };
  }

  public async deleteVehicle(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/vehicles/${id}`);
    return { success: !res.error, error: res.error };
  }
}

export const vehicleService = new VehicleService();
