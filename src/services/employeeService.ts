/**
 * Employee & HR Management Service with Multi-Tenant PostgreSQL isolation
 */

import { apiClient } from './apiClient';
import { EmployeeHR, LeaveRequest, PayrollRecord } from '../types/erp';
import { DbEmployee } from '../types/database';

class EmployeeService {
  public async getEmployees(branchId?: string): Promise<EmployeeHR[]> {
    const query = branchId && branchId !== 'ALL' ? `?branchId=${branchId}` : '';
    const res = await apiClient.get<EmployeeHR[]>(`/api/employees${query}`);
    return res.data || [];
  }

  public async getEmployeeById(id: string): Promise<EmployeeHR | null> {
    const res = await apiClient.get<EmployeeHR>(`/api/employees/${id}`);
    return res.data || null;
  }

  public async createEmployee(data: Partial<EmployeeHR>): Promise<{ success: boolean; employee?: EmployeeHR; error?: string }> {
    const res = await apiClient.post<EmployeeHR>('/api/employees', data);
    if (res.data && !res.error) {
      return { success: true, employee: res.data };
    }
    return { success: false, error: res.error || 'Failed to create employee' };
  }

  public async updateEmployee(id: string, updates: Partial<EmployeeHR>): Promise<{ success: boolean; employee?: EmployeeHR; error?: string }> {
    const res = await apiClient.put<EmployeeHR>(`/api/employees/${id}`, updates);
    if (res.data && !res.error) {
      return { success: true, employee: res.data };
    }
    return { success: false, error: res.error || 'Failed to update employee' };
  }

  public async deleteEmployee(id: string): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.delete(`/api/employees/${id}`);
    return { success: !res.error, error: res.error };
  }

  public async getLeaveRequests(): Promise<LeaveRequest[]> {
    const res = await apiClient.get<LeaveRequest[]>('/api/employees/leave-requests');
    return res.data || [];
  }

  public async updateLeaveRequestStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED'
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.put(`/api/employees/leave-requests/${id}/status`, { status });
    return { success: !res.error, error: res.error };
  }

  public async getPayrollRecords(): Promise<PayrollRecord[]> {
    const res = await apiClient.get<PayrollRecord[]>('/api/employees/payroll');
    return res.data || [];
  }
}

export const employeeService = new EmployeeService();
