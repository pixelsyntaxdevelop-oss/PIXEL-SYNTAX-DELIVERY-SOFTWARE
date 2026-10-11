import { apiClient } from './apiClient';

export interface ProjectCardSummary {
  id: string;
  name: string;
  code: string;
  client_name: string;
  status: string;
  active_count: number;
  branch_id?: string;
}

export interface StatusCountsSummary {
  activeAssigned: number;
  availableUnassigned: number;
  onLeave: number;
  onHold: number;
  absconding: number;
  terminated: number;
  exited: number;
  terminatedExited?: number;
}

export interface RiderProjectSummaryResponse {
  success: boolean;
  totalEmployees: number;
  totalActiveAssignments: number;
  multiProjectCount: number;
  unassignedCount: number;
  projects: ProjectCardSummary[];
  statusCounts: StatusCountsSummary;
}

export interface ActiveAssignmentItem {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_name: string;
  employee_code: string;
  project_id: string;
  project_name: string;
  project_code: string;
  external_rider_id?: string;
  external_id_type?: string;
  external_id_label?: string;
  assignment_start_date: string;
  start_date?: string;
  assignment_end_date?: string;
  end_date?: string;
  status: 'ACTIVE' | 'ENDED';
  is_primary: boolean;
  location_state?: string;
  notes?: string;
  created_by: string;
  created_at: string;
  ended_by?: string;
  ended_at?: string;
  end_reason?: string;
}

export interface EnrichedProjectEmployee {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  visa_contractor_type?: string;
  contractor?: string;
  vendor_name?: string;
  vendor_id?: string;
  current_status: string;
  branch_id?: string;
  branch?: string;
  mobile_number?: string;
  emirates_id?: string;
  passport_number?: string;
  designation?: string;
  role_type?: string;
  current_bike_plate?: string;
  active_assignments: ActiveAssignmentItem[];
  active_projects_count: number;
  primary_project: {
    id?: string;
    project_id: string;
    project_name: string;
    project_code: string;
    external_rider_id?: string;
    external_id_type?: string;
    start_date: string;
    is_primary?: boolean;
  } | null;
  latest_assignment_date: string | null;
  ended_assignments_count: number;
  external_ids: {
    project_id: string;
    project_name: string;
    external_rider_id: string;
    external_id_type?: string;
    is_primary?: boolean;
    start_date?: string;
  }[];
}

export interface PaginatedRiderEmployeesResponse {
  success: boolean;
  employees: EnrichedProjectEmployee[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface EmployeeAssignmentsDetailResponse {
  success: boolean;
  employee: {
    id: string;
    employee_code: string;
    full_name: string;
    current_status: string;
    branch?: string;
    mobile_number?: string;
    emirates_id?: string;
    passport_number?: string;
  };
  activeAssignments: ActiveAssignmentItem[];
  endedAssignments: ActiveAssignmentItem[];
  statusHistory: any[];
}

export interface AssignProjectPayload {
  employee_id: string;
  project_id: string;
  assignment_start_date?: string;
  external_rider_id?: string;
  location_state?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface EndAssignmentPayload {
  assignment_id: string;
  end_date: string;
  end_reason: string;
  replacement_primary_assignment_id?: string;
  notes?: string;
}

export interface MoveProjectPayload {
  employee_id: string;
  old_assignment_id?: string;
  new_project_id: string;
  end_date?: string;
  end_reason?: string;
  start_date?: string;
  external_rider_id?: string;
  location_state?: string;
  notes?: string;
}

export interface ChangeStatusPayload {
  employee_id: string;
  status: string;
  effective_date?: string;
  reason: string;
  notes?: string;
}

export interface BulkAssignPayload {
  employee_ids: string[];
  project_id: string;
  start_date?: string;
  location_state?: string;
  notes?: string;
}

export const riderProjectService = {
  getSummary: async (): Promise<RiderProjectSummaryResponse> => {
    const res = await apiClient.get<RiderProjectSummaryResponse>('/api/erp/rider-projects/summary');
    return res.data || {
      success: false,
      totalEmployees: 0,
      totalActiveAssignments: 0,
      multiProjectCount: 0,
      unassignedCount: 0,
      projects: [],
      statusCounts: {
        activeAssigned: 0,
        availableUnassigned: 0,
        onLeave: 0,
        onHold: 0,
        absconding: 0,
        terminated: 0,
        exited: 0,
        terminatedExited: 0,
      },
    };
  },

  getEmployees: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    projectId?: string;
    status?: string;
    branchId?: string;
    visaContractor?: string;
    assignmentStatus?: string;
    primaryAdditional?: string;
    hasMultiple?: boolean;
  }): Promise<PaginatedRiderEmployeesResponse> => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search) q.append('search', params.search);
    if (params.projectId) q.append('projectId', params.projectId);
    if (params.status) q.append('status', params.status);
    if (params.branchId) q.append('branchId', params.branchId);
    if (params.visaContractor) q.append('visaContractor', params.visaContractor);
    if (params.assignmentStatus) q.append('assignmentStatus', params.assignmentStatus);
    if (params.primaryAdditional) q.append('primaryAdditional', params.primaryAdditional);
    if (params.hasMultiple) q.append('hasMultiple', 'true');

    const res = await apiClient.get<PaginatedRiderEmployeesResponse>(`/api/erp/rider-projects/employees?${q.toString()}`);
    return res.data || {
      success: false,
      employees: [],
      pagination: { page: 1, limit: 25, totalCount: 0, totalPages: 0 },
    };
  },

  searchEmployees: async (q: string): Promise<any[]> => {
    if (!q || !q.trim()) return [];
    const res = await apiClient.get<{ success: boolean; employees: any[] }>(
      `/api/erp/rider-projects/employee-search?q=${encodeURIComponent(q.trim())}`
    );
    return res.data?.employees || [];
  },

  getVisaContractors: async (): Promise<string[]> => {
    const res = await apiClient.get<{ success: boolean; visaContractors: string[] }>(
      '/api/erp/rider-projects/visa-contractors'
    );
    return res.data?.visaContractors || ['Allied AUH', 'Allied DXB', 'Own Visa', 'Rapid Crew', 'Vendor'];
  },

  validateExternalId: async (params: {
    projectId: string;
    externalRiderId: string;
    employeeId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    valid: boolean;
    status: 'Available' | 'Already Assigned' | 'Historical ID' | 'Conflict';
    message?: string;
    conflictingAssignment?: any;
  }> => {
    const q = new URLSearchParams();
    q.append('project_id', params.projectId);
    q.append('external_rider_id', params.externalRiderId);
    if (params.employeeId) q.append('employee_id', params.employeeId);
    if (params.startDate) q.append('start_date', params.startDate);
    if (params.endDate) q.append('end_date', params.endDate);

    const res = await apiClient.get<{
      valid: boolean;
      status: 'Available' | 'Already Assigned' | 'Historical ID' | 'Conflict';
      message?: string;
      conflictingAssignment?: any;
    }>(`/api/erp/rider-projects/validate-external-id?${q.toString()}`);

    return res.data || { valid: true, status: 'Available' };
  },

  getExternalIdConfig: async (projectId: string): Promise<{ label: string; key: string; placeholder: string }> => {
    const res = await apiClient.get<{ label: string; key: string; placeholder: string }>(
      `/api/erp/rider-projects/external-id-config/${projectId}`
    );
    return res.data || { label: 'External Rider ID', key: 'external_rider_id', placeholder: 'e.g. RID-10023' };
  },

  getEmployeeAssignments: async (employeeId: string): Promise<EmployeeAssignmentsDetailResponse> => {
    const res = await apiClient.get<EmployeeAssignmentsDetailResponse>(`/api/erp/rider-projects/employees/${employeeId}/assignments`);
    return res.data || {
      success: false,
      employee: {} as any,
      activeAssignments: [],
      endedAssignments: [],
      statusHistory: [],
    };
  },

  assignProject: async (payload: AssignProjectPayload): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/assign', payload);
    return res.data || { success: false, error: res.error };
  },

  endAssignment: async (payload: EndAssignmentPayload): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/end-assignment', payload);
    return res.data || { success: false, error: res.error };
  },

  moveProject: async (payload: MoveProjectPayload): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/move', payload);
    return res.data || { success: false, error: res.error };
  },

  setPrimaryProject: async (employeeId: string, assignmentId: string): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/set-primary', {
      employee_id: employeeId,
      assignment_id: assignmentId,
    });
    return res.data || { success: false, error: res.error };
  },

  changeStatus: async (payload: ChangeStatusPayload): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/change-status', payload);
    return res.data || { success: false, error: res.error };
  },

  bulkAssign: async (payload: BulkAssignPayload): Promise<any> => {
    const res = await apiClient.post('/api/erp/rider-projects/bulk-assign', payload);
    return res.data || { success: false, error: res.error };
  },

  lookupExternalId: async (employeeId: string, projectId: string): Promise<{ found: boolean; external_rider_id: string }> => {
    const res = await apiClient.get<{ found: boolean; external_rider_id: string }>(
      `/api/erp/rider-projects/external-id-lookup?employee_id=${employeeId}&project_id=${projectId}`
    );
    return res.data || { found: false, external_rider_id: '' };
  },

  getProjectsList: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/api/erp/projects');
    return res.data || [];
  },

  // Project Master APIs
  getProjectsMaster: async (params?: { status?: string; search?: string }): Promise<ProjectMasterItem[]> => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    const res = await apiClient.get<{ success: boolean; projects: ProjectMasterItem[] }>(
      `/api/erp/rider-projects/projects?${q.toString()}`
    );
    return res.data?.projects || [];
  },

  getProjectById: async (id: string): Promise<ProjectMasterItem | null> => {
    const res = await apiClient.get<{ success: boolean; project: ProjectMasterItem }>(
      `/api/erp/rider-projects/projects/${id}`
    );
    return res.data?.project || null;
  },

  createProject: async (payload: {
    name: string;
    code: string;
    external_id_label?: string;
    status?: string;
    notes?: string;
  }): Promise<{ success: boolean; project?: ProjectMasterItem; error?: string }> => {
    const res = await apiClient.post<{ success: boolean; project?: ProjectMasterItem; error?: string }>(
      '/api/erp/rider-projects/projects',
      payload
    );
    return res.data || { success: false, error: res.error || 'Failed to create project' };
  },

  updateProject: async (
    id: string,
    payload: {
      name: string;
      code: string;
      external_id_label?: string;
      status?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; project?: ProjectMasterItem; error?: string }> => {
    const res = await apiClient.put<{ success: boolean; project?: ProjectMasterItem; error?: string }>(
      `/api/erp/rider-projects/projects/${id}`,
      payload
    );
    return res.data || { success: false, error: res.error || 'Failed to update project' };
  },

  toggleProjectStatus: async (
    id: string,
    status?: string
  ): Promise<{ success: boolean; project?: ProjectMasterItem; error?: string }> => {
    const res = await apiClient.patch<{ success: boolean; project?: ProjectMasterItem; error?: string }>(
      `/api/erp/rider-projects/projects/${id}/status`,
      { status }
    );
    return res.data || { success: false, error: res.error || 'Failed to toggle project status' };
  },

  // Project Assignments Directory APIs
  getAssignmentsDirectory: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    projectId?: string;
    visaContractor?: string;
    status?: string;
    primaryAdditional?: string;
  }): Promise<PaginatedAssignmentsResponse> => {
    const q = new URLSearchParams();
    if (params.page) q.append('page', params.page.toString());
    if (params.limit) q.append('limit', params.limit.toString());
    if (params.search) q.append('search', params.search);
    if (params.projectId) q.append('projectId', params.projectId);
    if (params.visaContractor) q.append('visaContractor', params.visaContractor);
    if (params.status) q.append('status', params.status);
    if (params.primaryAdditional) q.append('primaryAdditional', params.primaryAdditional);

    const res = await apiClient.get<PaginatedAssignmentsResponse>(
      `/api/erp/rider-projects/assignments?${q.toString()}`
    );
    return res.data || {
      success: false,
      assignments: [],
      pagination: { page: 1, limit: 20, totalCount: 0, totalPages: 0 },
    };
  },

  resolvePayrollIdentity: async (
    projectId: string,
    externalRiderId: string,
    payrollMonth?: string
  ): Promise<any> => {
    const q = new URLSearchParams();
    q.append('projectId', projectId);
    q.append('externalRiderId', externalRiderId);
    if (payrollMonth) q.append('payrollMonth', payrollMonth);

    const res = await apiClient.get<any>(`/api/erp/rider-projects/payroll-resolve?${q.toString()}`);
    return res.data;
  },
};

export interface ProjectMasterItem {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  external_id_label: string;
  requires_external_id?: boolean;
  status: 'Active' | 'Inactive / Archived';
  active_count: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DirectoryAssignmentItem extends ActiveAssignmentItem {
  visa_contractor_type?: string;
  vendor_name?: string;
  branch?: string;
  designation?: string;
}

export interface PaginatedAssignmentsResponse {
  success: boolean;
  assignments: DirectoryAssignmentItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}
