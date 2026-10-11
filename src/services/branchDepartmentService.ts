/**
 * Branches & Departments Multi-Tenant Management Service
 */

import { apiClient } from './apiClient';
import { BranchInfo } from '../types/erp';
import { DbBranch, DbDepartment } from '../types/database';

export interface DepartmentInfo {
  id: string;
  code: string;
  name: string;
  branchId?: string;
  employeeCount: number;
}

class BranchDepartmentService {
  public async getBranches(): Promise<BranchInfo[]> {
    const res = await apiClient.get<BranchInfo[]>('/api/branches');
    return Array.isArray(res.data) ? res.data : [];
  }

  public async getDepartments(): Promise<DepartmentInfo[]> {
    const res = await apiClient.get<DepartmentInfo[]>('/api/departments');
    return Array.isArray(res.data) ? res.data : [];
  }

  public async createBranch(data: Partial<BranchInfo>): Promise<{ success: boolean; branch?: BranchInfo; error?: string }> {
    const res = await apiClient.post<BranchInfo>('/api/branches', data);
    if (res.data && !res.error) {
      return { success: true, branch: res.data };
    }
    return { success: false, error: res.error || 'Failed to create branch' };
  }

  public async createDepartment(data: Partial<DepartmentInfo>): Promise<{ success: boolean; department?: DepartmentInfo; error?: string }> {
    const res = await apiClient.post<DepartmentInfo>('/api/departments', data);
    if (res.data && !res.error) {
      return { success: true, department: res.data };
    }
    return { success: false, error: res.error || 'Failed to create department' };
  }
}

export const branchDepartmentService = new BranchDepartmentService();
