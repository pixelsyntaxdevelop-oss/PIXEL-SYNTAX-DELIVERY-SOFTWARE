/**
 * Tenant & Multi-Company Management Service
 * Global Super Admin operations & Company Admin settings
 */

import { apiClient } from './apiClient';
import { TenantCompany, TenantStatus, PlanTier } from '../types/erp';
import { DbTenant, DbTenantSettings } from '../types/database';

class TenantService {
  public async getTenants(): Promise<TenantCompany[]> {
    const res = await apiClient.get<TenantCompany[]>('/api/tenants');
    if (res.data) {
      return res.data;
    }
    return [];
  }

  public async getTenantById(tenantId: string): Promise<TenantCompany | null> {
    const res = await apiClient.get<TenantCompany>(`/api/tenants/${tenantId}`);
    return res.data || null;
  }

  public async createTenant(tenantData: Partial<TenantCompany>): Promise<{ success: boolean; tenant?: TenantCompany; error?: string }> {
    const res = await apiClient.post<TenantCompany>('/api/tenants', tenantData);
    if (res.data && !res.error) {
      return { success: true, tenant: res.data };
    }
    return { success: false, error: res.error || 'Failed to create tenant company' };
  }

  public async updateTenant(tenantId: string, updates: Partial<TenantCompany>): Promise<{ success: boolean; tenant?: TenantCompany; error?: string }> {
    const res = await apiClient.put<TenantCompany>(`/api/tenants/${tenantId}`, updates);
    if (res.data && !res.error) {
      return { success: true, tenant: res.data };
    }
    return { success: false, error: res.error || 'Failed to update tenant company' };
  }

  public async updateTenantStatus(tenantId: string, status: TenantStatus): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/tenants/${tenantId}/status`, { status });
    return { success: !res.error, error: res.error };
  }

  public async updateTenantLimits(tenantId: string, limits: TenantCompany['limits']): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/tenants/${tenantId}/limits`, { limits });
    return { success: !res.error, error: res.error };
  }

  public async impersonateTenant(tenantId: string): Promise<{ success: boolean; token?: string; error?: string }> {
    const res = await apiClient.post<{ token: string; tenant: TenantCompany }>(`/api/tenants/${tenantId}/impersonate`, {});
    if (res.data && !res.error) {
      return { success: true, token: res.data.token };
    }
    return { success: false, error: res.error || 'Failed to impersonate tenant' };
  }
}

export const tenantService = new TenantService();
