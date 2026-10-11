/**
 * Role & Permission Management Service
 * RBAC configuration per tenant and module
 */

import { apiClient } from './apiClient';
import { RolePermission, UserRole } from '../types/erp';
import { DbRole, DbPermission } from '../types/database';

class RoleService {
  public async getRoles(): Promise<RolePermission[]> {
    const res = await apiClient.get<RolePermission[]>('/api/roles');
    if (res.data) {
      return res.data;
    }
    return [];
  }

  public async updateRolePermissions(
    roleKey: UserRole | string,
    permissions: RolePermission['permissions']
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/roles/${roleKey}/permissions`, { permissions });
    return { success: !res.error, error: res.error };
  }

  public async createCustomRole(roleData: Partial<RolePermission>): Promise<{ success: boolean; role?: RolePermission; error?: string }> {
    const res = await apiClient.post<RolePermission>('/api/roles', roleData);
    if (res.data && !res.error) {
      return { success: true, role: res.data };
    }
    return { success: false, error: res.error || 'Failed to create role' };
  }

  public async deleteRole(roleId: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/roles/${roleId}`);
    return { success: !res.error, error: res.error };
  }
}

export const roleService = new RoleService();
