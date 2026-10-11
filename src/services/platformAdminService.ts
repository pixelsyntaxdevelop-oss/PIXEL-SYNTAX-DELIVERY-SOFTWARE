/**
 * Platform Admin Service
 * Handles communication with /api/platform-admin endpoints
 * Dedicated for software owner/support maintenance operations.
 */

import { apiClient } from './apiClient';

export interface TenantBranding {
  tenantId: string;
  companyName: string;
  portalTitle: string;
  logoUrl?: string | null;
  loginHeroUrl?: string | null;
  loginBgUrl?: string | null;
  sidebarLogoUrl?: string | null;
  headerLogoUrl?: string | null;
  faviconUrl?: string | null;
  loginTagline?: string;
  supportEmail?: string;
  supportPhone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  turnstileEnabled?: boolean;
  turnstileSiteKey?: string;
  is_live_protected?: boolean;
  domain?: string;
}

export interface AdminAttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  date: string;
  status: string;
  check_in: string;
  check_out: string;
  overtime_hours: number;
  deliveries_count: number;
  notes?: string;
}

export interface AdminTenant {
  id: string;
  name: string;
  code: string;
  domain: string;
  status: string;
  plan: string;
  go_live_status: 'SETUP' | 'TESTING' | 'LIVE';
  is_live_protected: boolean;
  createdDate: string;
  counts: {
    employees: number;
    vehicles: number;
    sims: number;
    projects: number;
    fines: number;
    salik: number;
    users: number;
  };
}

export interface AdminDashboardData {
  tenant: {
    id: string;
    name: string;
    code: string;
    domain: string;
    status: string;
    go_live_status: 'SETUP' | 'TESTING' | 'LIVE';
    is_live_protected: boolean;
  };
  counts: {
    employees: number;
    totalEmployeesWithArchived: number;
    vehicles: number;
    simCards: number;
    trafficFines: number;
    salikTransactions: number;
    projects: number;
    payrollRecords: number;
    activeUsers: number;
    duplicateWarnings: number;
    dataIntegrityIssues: number;
    orphanRelations: number;
    passports?: number;
    passportsWithCompany?: number;
    passportsWithRider?: number;
  };
}

export interface AdminPassportRecord {
  id: string;
  serial_number: string;
  passport_serial?: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  emirates_id: string;
  passport_number: string;
  passport_expiry: string;
  expiry_date?: string;
  status: 'WITH_COMPANY' | 'WITH_RIDER' | string;
  current_location: string;
  safe_location?: string;
  storage_detail?: string;
  current_handler: string;
  receive_date?: string;
  return_date?: string;
  returned_to?: string;
  reason?: string;
  notes?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  history?: any[];
}

export interface AdminPassportStats {
  success: boolean;
  totalTracked: number;
  total?: number;
  withCompany: number;
  withRider: number;
  withRiders?: number;
  branchWiseWithCompany?: Record<string, number>;
  branchWiseWithRiders?: Record<string, number>;
  returnReasonsCounts?: Record<string, number>;
}

export interface AdminEmployee {
  id: string;
  tenant_id: string;
  full_name: string;
  employee_code: string;
  emirates_id: string;
  mobile_number: string;
  current_status: string;
  project_id?: string;
  project_name?: string;
  current_bike_id?: string;
  current_bike_plate?: string | null;
  current_sim_id?: string;
  current_sim_number?: string | null;
  designation?: string;
  branch_name?: string;
  is_archived: boolean;
  created_at: string;
  created_by: string;
}

export interface EmployeeDependencies {
  employee: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  dependencies: {
    activeProject: { id: string; name: string } | null;
    historicalProjectsCount: number;
    activeBike: { id: string; plate: string } | null;
    historicalBikesCount: number;
    activeSim: { id: string; simNumber: string } | null;
    historicalSimsCount: number;
    trafficFinesCount: number;
    trafficFinesTotalAED: number;
    salikTransactionsCount: number;
    payrollRecordsCount: number;
    loansCount: number;
    activeLoansCount: number;
    attendanceRecordsCount: number;
    auditLogsCount: number;
  };
  hasBlockingPointers: boolean;
  isLiveTenant: boolean;
  canDeleteDirectly: boolean;
  recommendation: string;
}

export interface DuplicateGroup<T = any> {
  id: string;
  rule: string;
  matchType: string;
  matchValue: string;
  records: T[];
}

export interface AdminVehicle {
  id: string;
  tenant_id: string;
  plateNumber: string;
  plate_code?: string;
  plate_city?: string;
  vehicle_code?: string;
  vin?: string;
  make: string;
  model: string;
  year?: number;
  type?: string;
  status: string;
  current_assigned_employee_id?: string | null;
  current_assigned_employee_name?: string | null;
  project_name?: string | null;
  vendor_name?: string | null;
  ownership?: string;
  created_at?: string;
}

export interface AdminSim {
  id: string;
  tenant_id: string;
  sim_number: string;
  provider: string;
  iccid: string;
  status: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  project_name?: string;
  package_name?: string;
  created_at?: string;
}

export interface AdminFine {
  id: string;
  tenant_id: string;
  fine_ticket_number: string;
  plate_number: string;
  employee_id?: string;
  employee_name?: string;
  fine_date: string;
  amount: number;
  liability: string;
  status: string;
  source: string;
  reason?: string;
  created_by?: string;
}

export interface AdminSalik {
  id: string;
  tenant_id: string;
  transaction_id: string;
  trip_date: string;
  toll_gate: string;
  plate_number: string;
  employee_id?: string;
  employee_name?: string;
  amount: number;
  status: string;
  source: string;
  created_by?: string;
}

export interface AdminProject {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  client_name?: string;
  external_id_label?: string;
  status: string;
  assigned_employees_count: number;
  created_at?: string;
}

export interface AdminDocument {
  id: string;
  tenant_id: string;
  employee_id?: string;
  employee_name?: string;
  employee_code?: string;
  document_type: string;
  document_number?: string;
  expiry_date?: string;
  storage_status: string;
  file_url?: string;
  cloud_reference?: string;
  is_verified?: boolean;
}

export interface AdminUser {
  id: string;
  tenantId: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  role: string;
  designation?: string;
  status: string;
  employee_id?: string | null;
  employee_code?: string | null;
  mustChangePassword?: boolean;
  sessionCount?: number;
  lastLogin?: string;
  createdDate?: string;
}

export interface IntegrityIssue {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  recordType: string;
  recordId: string;
  recordIdentifier: string;
  recommendedAction: string;
  actionPayload: any;
}

export interface AdminAuditLog {
  id: string;
  tenant_id: string;
  real_actor_user_id?: string;
  actor_name?: string;
  actor_role?: string;
  action: string;
  module: string;
  entity_type: string;
  entity_id: string;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string;
  details?: string;
  timestamp: string;
  ipAddress?: string;
}

class PlatformAdminService {
  private getHeaders(tenantId: string) {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('platform_admin_session_token') || ''
        : '';
    return {
      'x-tenant-id': tenantId,
      'x-admin-tenant-id': tenantId,
      'x-platform-admin-token': token,
      authorization: token ? `Bearer ${token}` : '',
      'x-is-super-admin': 'true',
    };
  }

  // 0. Authentication (Strictly isolated from normal ERP employee login)
  async login(
    username: string,
    password: string
  ): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    const res = await apiClient.request<{
      success: boolean;
      token: string;
      user: any;
      error?: string;
    }>('/api/platform-admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (res.data?.success && res.data?.token) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('platform_admin_session_token', res.data.token);
      }
      return { success: true, token: res.data.token, user: res.data.user };
    }
    return { success: false, error: res.data?.error || res.error || 'Authentication failed' };
  }

  async checkSession(): Promise<{ authenticated: boolean; user?: any }> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('platform_admin_session_token')
        : null;
    if (!token) return { authenticated: false };

    const res = await apiClient.request<{ authenticated: boolean; user?: any }>(
      '/api/platform-admin/auth/session',
      {
        headers: {
          'x-platform-admin-token': token,
          authorization: `Bearer ${token}`,
        },
      }
    );

    if (res.data?.authenticated) {
      return { authenticated: true, user: res.data.user };
    }
    return { authenticated: false };
  }

  async logout(): Promise<void> {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('platform_admin_session_token')
        : null;
    if (token) {
      await apiClient.request('/api/platform-admin/auth/logout', {
        method: 'POST',
        headers: {
          'x-platform-admin-token': token,
          authorization: `Bearer ${token}`,
        },
      });
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('platform_admin_session_token');
    }
  }

  // Safe helper to normalize any API response to an array
  private ensureArray<T>(val: any, fallbackKey?: string): T[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (fallbackKey && Array.isArray(val[fallbackKey])) return val[fallbackKey];
    if (Array.isArray(val.data)) return val.data;
    if (Array.isArray(val.items)) return val.items;
    if (Array.isArray(val.records)) return val.records;
    if (Array.isArray(val.results)) return val.results;
    if (Array.isArray(val.employees)) return val.employees;
    if (Array.isArray(val.vehicles)) return val.vehicles;
    if (Array.isArray(val.sims)) return val.sims;
    if (Array.isArray(val.projects)) return val.projects;
    if (Array.isArray(val.fines)) return val.fines;
    if (Array.isArray(val.salik)) return val.salik;
    if (Array.isArray(val.documents)) return val.documents;
    if (Array.isArray(val.users)) return val.users;
    if (Array.isArray(val.attendance)) return val.attendance;
    if (Array.isArray(val.logs)) return val.logs;
    if (Array.isArray(val.issues)) return val.issues;
    if (Array.isArray(val.duplicates)) return val.duplicates;
    return [];
  }

  // 1. Tenants
  async getTenants(): Promise<AdminTenant[]> {
    const res = await apiClient.request<any>('/api/platform-admin/tenants');
    return this.ensureArray<AdminTenant>(res.data, 'tenants');
  }

  async updateTenantMode(tenantId: string, mode: 'SETUP' | 'TESTING' | 'LIVE'): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/tenants/${tenantId}/mode`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ mode }),
    });
    return !res.error;
  }

  // 2. Dashboard
  async getDashboard(tenantId: string): Promise<AdminDashboardData> {
    const res = await apiClient.request<any>(`/api/platform-admin/dashboard?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    const d = res.data || {};
    return {
      tenant: d.tenant || {
        id: tenantId,
        name: tenantId === 'company_pixel_syntax' ? 'Pixel Syntax Delivery Software' : tenantId,
        code: tenantId === 'company_pixel_syntax' ? 'ALLIED' : tenantId.toUpperCase(),
        domain: tenantId === 'company_pixel_syntax' ? 'deliverysoftwarepixel.site' : `${tenantId}.alliedfleet.com`,
        status: 'ACTIVE',
        go_live_status: tenantId === 'company_pixel_syntax' ? 'LIVE' : 'SETUP',
        is_live_protected: tenantId === 'company_pixel_syntax',
      },
      counts: {
        employees: Number(d.counts?.employees ?? 0),
        totalEmployeesWithArchived: Number(d.counts?.totalEmployeesWithArchived ?? d.counts?.employees ?? 0),
        vehicles: Number(d.counts?.vehicles ?? 0),
        simCards: Number(d.counts?.simCards ?? d.counts?.sims ?? 0),
        trafficFines: Number(d.counts?.trafficFines ?? d.counts?.fines ?? 0),
        salikTransactions: Number(d.counts?.salikTransactions ?? d.counts?.salik ?? 0),
        projects: Number(d.counts?.projects ?? 0),
        payrollRecords: Number(d.counts?.payrollRecords ?? 0),
        activeUsers: Number(d.counts?.activeUsers ?? d.counts?.users ?? 0),
        duplicateWarnings: Number(d.counts?.duplicateWarnings ?? 0),
        dataIntegrityIssues: Number(d.counts?.dataIntegrityIssues ?? 0),
        orphanRelations: Number(d.counts?.orphanRelations ?? 0),
      },
    };
  }

  // 3. Employees
  async getEmployees(tenantId: string, search = '', status = 'ALL', project = 'ALL'): Promise<AdminEmployee[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);
    if (status !== 'ALL') params.append('status', status);
    if (project !== 'ALL') params.append('project', project);

    const res = await apiClient.request<any>(`/api/platform-admin/employees?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminEmployee>(res.data, 'employees');
  }

  async getEmployeeDependencies(tenantId: string, empId: string): Promise<EmployeeDependencies> {
    const res = await apiClient.request<EmployeeDependencies>(
      `/api/platform-admin/employees/${empId}/dependencies?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    const d = res.data as any;
    return {
      employee: d?.employee || { id: empId, name: 'Employee', code: empId, status: 'Active' },
      dependencies: d?.dependencies || {
        activeProject: null,
        historicalProjectsCount: 0,
        activeBike: null,
        historicalBikesCount: 0,
        activeSim: null,
        historicalSimsCount: 0,
        trafficFinesCount: 0,
        trafficFinesTotalAED: 0,
        salikTransactionsCount: 0,
        payrollRecordsCount: 0,
        loansCount: 0,
        activeLoansCount: 0,
        attendanceRecordsCount: 0,
        auditLogsCount: 0,
      },
      hasBlockingPointers: Boolean(d?.hasBlockingPointers),
      isLiveTenant: Boolean(d?.isLiveTenant),
      canDeleteDirectly: Boolean(d?.canDeleteDirectly),
      recommendation: d?.recommendation || '',
    };
  }

  async updateEmployee(tenantId: string, empId: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/employees/${empId}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async archiveEmployee(tenantId: string, empId: string, reason = '', dependenciesFound?: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/employees/${empId}/archive?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, dependencies_found: dependenciesFound }),
    });
    return !res.error;
  }

  async deleteEmployee(
    tenantId: string,
    empId: string,
    reason = '',
    confirmationPhrase = '',
    dependenciesFound?: any
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/employees/${empId}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase, dependencies_found: dependenciesFound }),
    });
    if (res.error) {
      return { success: false, error: res.error };
    }
    return { success: true };
  }

  // 4. Duplicate Employees
  async getDuplicateEmployees(tenantId: string): Promise<DuplicateGroup<AdminEmployee>[]> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/duplicates/employees?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    return this.ensureArray<DuplicateGroup<AdminEmployee>>(res.data, 'duplicates');
  }

  async mergeDuplicateEmployees(
    tenantId: string,
    primaryId: string,
    duplicateId: string,
    mergeFields: any,
    reason = ''
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/duplicates/employees/merge?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({
        primary_employee_id: primaryId,
        duplicate_employee_id: duplicateId,
        merge_fields: mergeFields,
        reason,
      }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 5. Vehicles
  async getVehicles(tenantId: string, search = '', status = 'ALL'): Promise<AdminVehicle[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);
    if (status !== 'ALL') params.append('status', status);

    const res = await apiClient.request<any>(`/api/platform-admin/vehicles?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminVehicle>(res.data, 'vehicles');
  }

  async getDuplicateVehicles(tenantId: string): Promise<DuplicateGroup<AdminVehicle>[]> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/duplicates/vehicles?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    return this.ensureArray<DuplicateGroup<AdminVehicle>>(res.data, 'duplicates');
  }

  async getVehicleDependencies(tenantId: string, id: string): Promise<any> {
    const res = await apiClient.request(`/api/platform-admin/vehicles/${id}/dependencies?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    const d = res.data || {};
    return {
      activePointers: this.ensureArray<string>(d.activePointers, 'activePointers'),
      historicalCounts: this.ensureArray<{ label: string; count: number }>(d.historicalCounts, 'historicalCounts'),
      warnings: this.ensureArray<string>(d.warnings, 'warnings'),
      ...d,
    };
  }

  async updateVehicle(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/vehicles/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async deleteVehicle(tenantId: string, id: string, reason = '', confirmationPhrase = ''): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/vehicles/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 6. SIMs
  async getSims(tenantId: string, search = ''): Promise<AdminSim[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);

    const res = await apiClient.request<any>(`/api/platform-admin/sims?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminSim>(res.data, 'sims');
  }

  async getDuplicateSims(tenantId: string): Promise<DuplicateGroup<AdminSim>[]> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/duplicates/sims?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    return this.ensureArray<DuplicateGroup<AdminSim>>(res.data, 'duplicates');
  }

  async updateSim(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/sims/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async deleteSim(tenantId: string, id: string, reason = '', confirmationPhrase = ''): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/sims/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 7. Fines
  async getFines(tenantId: string, search = '', status = 'ALL'): Promise<AdminFine[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);
    if (status !== 'ALL') params.append('status', status);

    const res = await apiClient.request<any>(`/api/platform-admin/fines?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminFine>(res.data, 'fines');
  }

  async updateFine(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/fines/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async voidFine(tenantId: string, id: string, reason = ''): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/fines/${id}/void?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  async deleteFine(tenantId: string, id: string, reason = '', confirmationPhrase = ''): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/fines/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 8. Salik
  async getSalik(tenantId: string, search = ''): Promise<AdminSalik[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);

    const res = await apiClient.request<any>(`/api/platform-admin/salik?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminSalik>(res.data, 'salik');
  }

  async updateSalik(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/salik/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async deleteSalik(tenantId: string, id: string, reason = '', confirmationPhrase = ''): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/salik/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 9. Projects
  async getProjects(tenantId: string): Promise<AdminProject[]> {
    const res = await apiClient.request<any>(`/api/platform-admin/projects?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminProject>(res.data, 'projects');
  }

  async updateProject(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/projects/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async archiveProject(tenantId: string, id: string, reason = ''): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/projects/${id}/archive?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason }),
    });
    return !res.error;
  }

  // 10. Documents
  async getDocuments(tenantId: string): Promise<AdminDocument[]> {
    const res = await apiClient.request<any>(`/api/platform-admin/documents?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminDocument>(res.data, 'documents');
  }

  // 11. Users
  async getUsers(tenantId: string): Promise<AdminUser[]> {
    const res = await apiClient.request<any>(`/api/platform-admin/users?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminUser>(res.data, 'users');
  }

  async toggleUserStatus(tenantId: string, id: string): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}/toggle-status?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
    });
    return !res.error;
  }

  async updateUserRole(tenantId: string, id: string, role: string): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}/role?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ role }),
    });
    return !res.error;
  }

  async createUser(tenantId: string, userData: {
    username: string;
    fullName: string;
    email?: string;
    password: string;
    role: string;
    designation?: string;
    phone?: string;
    status?: string;
    assignedBranchIds?: string[];
    assignedDepartmentIds?: string[];
    mustChangePassword?: boolean;
    employee_id?: string | null;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/users?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ ...userData, tenantId }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, user: res.data?.user };
  }

  async updateUser(tenantId: string, id: string, userData: {
    fullName?: string;
    email?: string;
    phone?: string;
    designation?: string;
    role?: string;
    status?: string;
    employee_id?: string | null;
    mustChangePassword?: boolean;
  }): Promise<{ success: boolean; user?: any; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(userData),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, user: res.data?.user };
  }

  async forceLogoutUser(tenantId: string, id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}/force-logout?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  async requirePasswordChange(tenantId: string, id: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}/require-password-change?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  // 11.1 Tenant Branding (Requirement 16, 17, 18, 19, 20)
  async getTenantBranding(tenantId: string): Promise<TenantBranding | null> {
    const res = await apiClient.request<TenantBranding>(`/api/platform-admin/tenants/${tenantId}/branding?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    return res.data || null;
  }

  async updateTenantBranding(tenantId: string, branding: Partial<TenantBranding>): Promise<{ success: boolean; branding?: TenantBranding; error?: string }> {
    const res = await apiClient.request<{ success: boolean; branding?: TenantBranding; message?: string }>(
      `/api/platform-admin/tenants/${tenantId}/branding?tenant_id=${tenantId}`,
      {
        method: 'PUT',
        headers: this.getHeaders(tenantId),
        body: JSON.stringify(branding),
      }
    );
    if (res.error) return { success: false, error: res.error };
    return { success: true, branding: res.data?.branding };
  }

  async uploadBrandingAsset(
    tenantId: string,
    assetType: string,
    file: File
  ): Promise<{ success: boolean; assetUrl?: string; error?: string; code?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetType', assetType);
    
    const res = await apiClient.post<{
      success: boolean;
      assetUrl?: string;
      message?: string;
      error?: string;
      code?: string;
    }>(
      `/api/platform-admin/tenants/${tenantId}/branding/upload`,
      formData
    );
    
    if (res.error || !res.data?.success) {
      const errCode = res.code || (res.data as any)?.code || (res.data as any)?.error || res.error;
      return { success: false, error: res.error || (res.data as any)?.error, code: errCode };
    }
    return { success: true, assetUrl: res.data?.assetUrl };
  }

  // 11.2 Reset Training / Demo Workspace Data (Requirements 10, 11, 12, 13)
  async getDemoResetPreview(tenantId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/tenants/${tenantId}/reset-demo-preview?tenant_id=${tenantId}`,
      {
        method: 'GET',
        headers: this.getHeaders(tenantId),
      }
    );
    if (res.error) return { success: false, error: res.error };
    return { success: true, data: res.data };
  }

  async resetDemoTenantData(
    tenantId: string,
    confirmationPhrase: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request<{ success: boolean; message?: string }>(
      `/api/platform-admin/tenants/${tenantId}/reset-demo-data?tenant_id=${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(tenantId),
        body: JSON.stringify({ confirmationPhrase }),
      }
    );
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  async resetUserPassword(tenantId: string, id: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/users/${id}/reset-password?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ newPassword }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  async resetUserAuth(tenantId: string, id: string): Promise<{ success: boolean; tempCode?: string }> {
    const res = await apiClient.request<{ success: boolean; tempCode?: string }>(
      `/api/platform-admin/users/${id}/reset-auth?tenant_id=${tenantId}`,
      {
        method: 'POST',
        headers: this.getHeaders(tenantId),
      }
    );
    return res.data || { success: !res.error };
  }

  // 12. Data Integrity
  async getDataIntegrity(tenantId: string): Promise<{ issues: IntegrityIssue[]; summary: any }> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/integrity?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    const d = res.data || {};
    return {
      issues: this.ensureArray<IntegrityIssue>(d.issues || d, 'issues'),
      summary: d.summary || {},
    };
  }

  async repairIntegrityIssue(tenantId: string, issueId: string, actionType: string, payload: any = {}): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/integrity/repair?tenant_id=${tenantId}`, {
      method: 'POST',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({
        issue_id: issueId,
        action_type: actionType,
        ...payload,
      }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true };
  }

  // 13. Audit Logs
  async getAuditLogs(tenantId: string, limit = 100): Promise<AdminAuditLog[]> {
    const res = await apiClient.request<any>(`/api/platform-admin/audit?tenant_id=${tenantId}&limit=${limit}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminAuditLog>(res.data, 'logs');
  }

  // 14. Attendance Management
  async getAttendance(
    tenantId: string,
    filters: { employee_id?: string; date?: string; status?: string } = {}
  ): Promise<AdminAttendanceRecord[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (filters.employee_id) params.set('employee_id', filters.employee_id);
    if (filters.date) params.set('date', filters.date);
    if (filters.status) params.set('status', filters.status);

    const res = await apiClient.request<any>(
      `/api/platform-admin/attendance?${params.toString()}`,
      { headers: this.getHeaders(tenantId) }
    );
    return this.ensureArray<AdminAttendanceRecord>(res.data, 'attendance');
  }

  async deleteAttendance(
    tenantId: string,
    id: string,
    reason: string,
    confirmationPhrase: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/attendance/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  // 15. Document Safe Deletion
  async deleteDocument(
    tenantId: string,
    id: string,
    reason: string,
    confirmationPhrase: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/documents/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  // 16. Project Dependencies & Safe Deletion
  async getProjectDependencies(
    tenantId: string,
    id: string
  ): Promise<{ activePointers: string[]; historicalCounts: { label: string; count: number }[]; warnings: string[] }> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/projects/${id}/dependencies?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    const d = res.data || {};
    return {
      activePointers: this.ensureArray<string>(d.activePointers, 'activePointers'),
      historicalCounts: this.ensureArray<{ label: string; count: number }>(d.historicalCounts, 'historicalCounts'),
      warnings: this.ensureArray<string>(d.warnings, 'warnings'),
      ...d,
    };
  }

  async deleteProject(
    tenantId: string,
    id: string,
    reason: string,
    confirmationPhrase: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await apiClient.request(`/api/platform-admin/projects/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }

  // 17. Passport Custody & Safe Deletion
  async getPassports(tenantId: string, search = ''): Promise<AdminPassportRecord[]> {
    const params = new URLSearchParams({ tenant_id: tenantId });
    if (search) params.append('search', search);

    const res = await apiClient.request<any>(`/api/platform-admin/passports?${params.toString()}`, {
      headers: this.getHeaders(tenantId),
    });
    return this.ensureArray<AdminPassportRecord>(res.data, 'passports');
  }

  async getPassportStats(tenantId: string): Promise<AdminPassportStats> {
    const res = await apiClient.request<any>(`/api/platform-admin/passports/stats?tenant_id=${tenantId}`, {
      headers: this.getHeaders(tenantId),
    });
    return (
      res.data || {
        success: true,
        totalTracked: 0,
        withCompany: 0,
        withRider: 0,
      }
    );
  }

  async getPassportHistory(tenantId: string, custodyId: string): Promise<any[]> {
    const res = await apiClient.request<any>(
      `/api/platform-admin/passports/${custodyId}/history?tenant_id=${tenantId}`,
      { headers: this.getHeaders(tenantId) }
    );
    if (res.data && Array.isArray(res.data.history)) {
      return res.data.history;
    }
    return this.ensureArray<any>(res.data, 'history');
  }

  async updatePassport(tenantId: string, id: string, updates: any): Promise<boolean> {
    const res = await apiClient.request(`/api/platform-admin/passports/${id}?tenant_id=${tenantId}`, {
      method: 'PUT',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify(updates),
    });
    return !res.error;
  }

  async deletePassport(
    tenantId: string,
    id: string,
    reason = '',
    confirmationPhrase = ''
  ): Promise<{ success: boolean; message?: string; error?: string; auditRecord?: any }> {
    const res = await apiClient.request<any>(`/api/platform-admin/passports/${id}?tenant_id=${tenantId}`, {
      method: 'DELETE',
      headers: this.getHeaders(tenantId),
      body: JSON.stringify({ reason, confirmationPhrase, confirmation_phrase: confirmationPhrase }),
    });
    if (res.error) return { success: false, error: res.error };
    return {
      success: true,
      message: res.data?.message || 'Passport custody record safely deleted.',
      auditRecord: (res.data as any)?.auditRecord,
    };
  }
}

export const platformAdminService = new PlatformAdminService();
