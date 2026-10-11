import { apiClient } from './apiClient';

export interface OfficeStaffUser {
  id: string;
  tenantId: string;
  employee_id: string | null;
  employee_code: string | null;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  roleDisplayName: string;
  designation: string;
  branch_id: string | null;
  branch_name: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
  lastLogin: string;
  createdDate: string;
  createdBy: string;
  isOwner: boolean;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
  mustChangePassword: boolean;
  override_reason: string | null;
}

export interface EligibleEmployeeSearchResult {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  designation: string;
  department_id: string;
  department_name: string;
  branch_id: string;
  branch_name: string;
  visa_contractor_type: string;
  current_status: string;
  personal_mobile: string;
  emirates_id_number: string;
  email: string;
  photo?: string;
  is_rider_staff: boolean;
  has_erp_account: boolean;
  existing_account_username: string | null;
  existing_account_status: string | null;
}

export interface OfficeStaffListResponse {
  data: OfficeStaffUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  metrics: {
    totalStaff: number;
    activeStaff: number;
    disabledStaff: number;
    configuredRolesCount: number;
  };
}

export interface CreateStaffAccessPayload {
  employee_id?: string | null;
  username: string;
  fullName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  role: string;
  status?: 'ACTIVE' | 'DISABLED';
  temporary_password: string;
  must_change_password?: boolean;
  override_reason?: string;
  branch_id?: string;
  notes?: string;
}

export class OfficeStaffService {
  async getStaffUsers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    status?: string;
    branch?: string;
  }): Promise<OfficeStaffListResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', params.page.toString());
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.search) query.set('search', params.search);
    if (params?.role && params.role !== 'ALL') query.set('role', params.role);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.branch && params.branch !== 'ALL') query.set('branch', params.branch);

    const res = await apiClient.request<any>(
      `/api/erp/office-staff?${query.toString()}`
    );

    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to fetch authorized office staff');
    }

    const payload = res.data;
    if (Array.isArray(payload)) {
      return {
        data: payload,
        pagination: {
          total: payload.length,
          page: params?.page || 1,
          limit: params?.limit || 15,
          totalPages: Math.ceil(payload.length / (params?.limit || 15)) || 1,
        },
        metrics: {
          totalStaff: payload.length,
          activeStaff: payload.filter((u: any) => u.status === 'ACTIVE').length,
          disabledStaff: payload.filter((u: any) => u.status === 'DISABLED' || u.status === 'LOCKED').length,
          configuredRolesCount: 1,
        },
      };
    }

    return {
      data: Array.isArray(payload.data) ? payload.data : [],
      pagination: {
        total: payload.pagination?.total ?? (Array.isArray(payload.data) ? payload.data.length : 0),
        page: payload.pagination?.page ?? params?.page ?? 1,
        limit: payload.pagination?.limit ?? params?.limit ?? 15,
        totalPages: payload.pagination?.totalPages ?? 1,
      },
      metrics: {
        totalStaff: payload.metrics?.totalStaff ?? (Array.isArray(payload.data) ? payload.data.length : 0),
        activeStaff: payload.metrics?.activeStaff ?? 0,
        disabledStaff: payload.metrics?.disabledStaff ?? 0,
        configuredRolesCount: payload.metrics?.configuredRolesCount ?? 1,
      },
    };
  }

  async searchEligibleEmployees(query: string): Promise<EligibleEmployeeSearchResult[]> {
    const res = await apiClient.request<EligibleEmployeeSearchResult[]>(
      `/api/erp/office-staff/search-employees?q=${encodeURIComponent(query)}`
    );
    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to search employees');
    }
    return res.data;
  }

  async checkUsernameAvailability(
    username: string,
    employeeName?: string
  ): Promise<{ available: boolean; normalizedUsername: string; suggestions: string[] }> {
    const query = new URLSearchParams({ username });
    if (employeeName) query.set('employeeName', employeeName);

    const res = await apiClient.request<{
      available: boolean;
      normalizedUsername: string;
      suggestions: string[];
    }>(`/api/erp/office-staff/check-username?${query.toString()}`);

    if (res.error || !res.data) {
      throw new Error(res.error || 'Failed to check username');
    }
    return res.data;
  }

  async createStaffAccess(payload: CreateStaffAccessPayload): Promise<{
    success: boolean;
    user: OfficeStaffUser;
    message: string;
  }> {
    const res = await apiClient.request<{
      success: boolean;
      user: OfficeStaffUser;
      message: string;
      error?: string;
      suggestions?: string[];
    }>('/api/erp/office-staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.error || !res.data?.success) {
      const err: any = new Error(res.error || 'Failed to create office staff access');
      if (res.data?.suggestions) {
        err.suggestions = res.data.suggestions;
      }
      throw err;
    }
    return res.data;
  }

  async updateStaffStatus(
    id: string,
    status: 'ACTIVE' | 'DISABLED' | 'LOCKED',
    reason?: string
  ): Promise<{ success: boolean; status: string; message: string }> {
    const res = await apiClient.request<{
      success: boolean;
      status: string;
      message: string;
    }>(`/api/erp/office-staff/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    });

    if (res.error || !res.data?.success) {
      throw new Error(res.error || `Failed to update status to ${status}`);
    }
    return res.data;
  }

  async resetTemporaryPassword(
    id: string,
    temporary_password: string,
    must_change_password: boolean = true
  ): Promise<{ success: boolean; message: string }> {
    const res = await apiClient.request<{
      success: boolean;
      message: string;
    }>(`/api/erp/office-staff/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temporary_password, must_change_password }),
    });

    if (res.error || !res.data?.success) {
      throw new Error(res.error || 'Failed to reset password');
    }
    return res.data;
  }

  async getRoles(): Promise<any[]> {
    const res = await apiClient.request<any[]>('/api/roles');
    if (res.error || !res.data) {
      return [];
    }
    return res.data;
  }
}

export const officeStaffService = new OfficeStaffService();
