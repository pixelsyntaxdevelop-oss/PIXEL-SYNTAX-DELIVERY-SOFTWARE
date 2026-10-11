import { apiClient } from './apiClient';

export interface LabourBuilding {
  id: string;
  tenant_id: string;
  name: string;
  area_location: string;
  emirate: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface LabourBuildingAssignment {
  id: string;
  tenant_id: string;
  employee_id: string;
  building_id: string;
  building_name: string;
  area_location?: string;
  emirate?: string;
  assignment_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  status: 'ACTIVE' | 'TRANSFERRED' | 'ENDED';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
}

export interface CreateLabourBuildingInput {
  name: string;
  area_location?: string;
  emirate?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

export interface UpdateLabourBuildingInput {
  name: string;
  area_location?: string;
  emirate?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  notes?: string;
}

export interface AssignLabourBuildingInput {
  employee_id: string;
  building_id: string;
  assignment_date?: string;
  notes?: string;
}

export const UAE_EMIRATES = [
  'Dubai',
  'Sharjah',
  'Abu Dhabi',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
] as const;

export const labourBuildingService = {
  // ==============================================================================
  // BUILDING MASTER SERVICES
  // ==============================================================================

  async getBuildings(params?: { search?: string; status?: string }): Promise<{
    success: boolean;
    data: LabourBuilding[];
    total: number;
    error?: string;
  }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await apiClient.get<any>(`/api/erp/labour-buildings${qs}`);

    if (res.error) {
      return {
        success: false,
        data: [],
        total: 0,
        error: res.error,
      };
    }

    const payload = res.data;
    const list: LabourBuilding[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : [];

    return {
      success: true,
      data: list,
      total: payload?.total ?? list.length,
    };
  },

  async getActiveBuildings(): Promise<{
    success: boolean;
    data: LabourBuilding[];
    error?: string;
  }> {
    const res = await apiClient.get<any>('/api/erp/labour-buildings?status=ACTIVE');
    if (res.error) {
      return { success: false, data: [], error: res.error };
    }
    const payload = res.data;
    const list: LabourBuilding[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
      ? payload.data
      : [];
    return { success: true, data: list.filter((b) => b.status === 'ACTIVE') };
  },

  async createBuilding(input: CreateLabourBuildingInput): Promise<{
    success: boolean;
    building?: LabourBuilding;
    error?: string;
  }> {
    const res = await apiClient.post<any>('/api/erp/labour-buildings', input);

    if (res.error) {
      return {
        success: false,
        error: res.error,
      };
    }

    const payload = res.data;
    return {
      success: true,
      building: payload?.building || payload,
    };
  },

  async updateBuilding(
    id: string,
    input: UpdateLabourBuildingInput
  ): Promise<{
    success: boolean;
    building?: LabourBuilding;
    error?: string;
  }> {
    const res = await apiClient.put<any>(`/api/erp/labour-buildings/${id}`, input);

    if (res.error) {
      return {
        success: false,
        error: res.error,
      };
    }

    const payload = res.data;
    return {
      success: true,
      building: payload?.building || payload,
    };
  },

  async toggleStatus(
    id: string,
    targetStatus?: 'ACTIVE' | 'INACTIVE'
  ): Promise<{
    success: boolean;
    building?: LabourBuilding;
    error?: string;
  }> {
    const res = await apiClient.patch<any>(`/api/erp/labour-buildings/${id}/status`, {
      status: targetStatus,
    });

    if (res.error) {
      return {
        success: false,
        error: res.error,
      };
    }

    const payload = res.data;
    return {
      success: true,
      building: payload?.building || payload,
    };
  },

  // ==============================================================================
  // STEP 2 & 3: LABOUR EMPLOYEE ↔ BUILDING ASSIGNMENTS
  // ==============================================================================

  async getActiveBuildingAssignments(): Promise<{
    success: boolean;
    data: LabourBuildingAssignment[];
    error?: string;
  }> {
    const res = await apiClient.get<any>('/api/erp/labour-buildings/assignments/active');
    if (res.error) {
      return {
        success: false,
        data: [],
        error: res.error,
      };
    }

    const payload = res.data;
    const list: LabourBuildingAssignment[] = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload)
      ? payload
      : [];

    return {
      success: true,
      data: list,
    };
  },

  async getEmployeeBuildingAssignments(employeeId: string): Promise<{
    success: boolean;
    activeAssignment: LabourBuildingAssignment | null;
    history: LabourBuildingAssignment[];
    isLabourEmployee?: boolean;
    activeProject?: any;
    error?: string;
  }> {
    const res = await apiClient.get<any>(
      `/api/erp/labour-buildings/assignments/employee/${encodeURIComponent(employeeId)}`
    );

    if (res.error) {
      return {
        success: false,
        activeAssignment: null,
        history: [],
        error: res.error,
      };
    }

    const payload = res.data;
    return {
      success: true,
      activeAssignment: payload?.activeAssignment || null,
      history: Array.isArray(payload?.history) ? payload.history : [],
      isLabourEmployee: payload?.isLabourEmployee,
      activeProject: payload?.activeProject,
    };
  },

  async assignBuilding(input: AssignLabourBuildingInput): Promise<{
    success: boolean;
    assignment?: LabourBuildingAssignment;
    message?: string;
    error?: string;
  }> {
    const res = await apiClient.post<any>('/api/erp/labour-buildings/assign', input);

    if (res.error) {
      return {
        success: false,
        error: res.error,
      };
    }

    const payload = res.data;
    if (!payload?.success && payload?.error) {
      return {
        success: false,
        error: payload.error,
      };
    }

    return {
      success: true,
      assignment: payload?.assignment,
      message: payload?.message || 'Building assigned successfully.',
    };
  },

  async transferBuilding(input: AssignLabourBuildingInput): Promise<{
    success: boolean;
    assignment?: LabourBuildingAssignment;
    message?: string;
    error?: string;
  }> {
    const res = await apiClient.post<any>('/api/erp/labour-buildings/transfer', input);

    if (res.error) {
      return {
        success: false,
        error: res.error,
      };
    }

    const payload = res.data;
    if (!payload?.success && payload?.error) {
      return {
        success: false,
        error: payload.error,
      };
    }

    return {
      success: true,
      assignment: payload?.assignment,
      message: payload?.message || 'Building transferred successfully.',
    };
  },
};
