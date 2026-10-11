/**
 * SIM Operations Service
 * Separates Rider Return (returning SIM to Allied depot inventory)
 * from Provider Return (cancellation or returning SIM line to telecom provider: DU/Etisalat/Virgin)
 */

import { apiClient } from './apiClient';

export interface SimHistoryStaffUser {
  id: string;
  full_name: string;
  designation?: string | null;
  status?: string | null;
  is_owner?: boolean;
}

export interface ReturnSimToProviderOptions {
  providerReturnDate?: string;
  providerReturnReason: string;
  cancellationReference?: string;
  returnedBy?: string;
  notes?: string;
  autoCloseRiderAssignment?: boolean;
}

export interface UpdateSimAssignmentHistoryUpdates {
  assigned_date?: string;
  return_date?: string;
  returned_date?: string;
  return_time?: string;
  assigned_by?: string;
  returned_by?: string;
  return_reason?: string;
  return_remark?: string;
  notes?: string;
  remarks?: string;
  handover_notes?: string;
  editReason?: string;
  reason?: string;
  correction_reason?: string;
  [key: string]: any;
}

class SimService {
  /**
   * Return SIM from Rider back to Allied Telecom Inventory (Depot Pool)
   */
  public async returnSimFromRider(
    simId: string,
    options: {
      returnReason: string;
      returnDate?: string;
      returnedBy?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await apiClient.post<{ success: boolean; error?: string; message?: string }>(
      `/api/erp/sims/${simId}/return`,
      {
        returnReason: options.returnReason,
        returnDate: options.returnDate,
        returnedBy: options.returnedBy,
        notes: options.notes,
      }
    );
    if (res.data?.success) {
      return res.data;
    }
    return { success: false, error: res.data?.error || res.error || 'Failed to return SIM to inventory' };
  }

  /**
   * Return or Cancel SIM line with Telecom Provider (DU, Etisalat, Virgin)
   */
  public async returnSimToProvider(
    simId: string,
    options: ReturnSimToProviderOptions
  ): Promise<{ success: boolean; sim?: any; error?: string; message?: string }> {
    const res = await apiClient.post<{ success: boolean; sim?: any; error?: string; message?: string }>(
      `/api/erp/sims/${simId}/return-to-provider`,
      options
    );
    if (res.data?.success) {
      return res.data;
    }
    return { success: false, error: res.data?.error || res.error || 'Failed to return SIM to provider' };
  }

  /**
   * Verified operator choices from staff profiles in the authenticated tenant.
   * Never fetch employee/rider lists to attribute SIM handovers.
   */
  public async getHistoryStaffUsers(): Promise<{ success: boolean; users: SimHistoryStaffUser[]; error?: string }> {
    const res = await apiClient.get<{ success: boolean; users: SimHistoryStaffUser[]; error?: string }>(
      '/api/erp/sims/staff-users'
    );
    if (res.data?.success && Array.isArray(res.data.users)) {
      return { success: true, users: res.data.users };
    }
    return { success: false, users: [], error: res.data?.error || res.error || 'Could not load staff users.' };
  }

  /**
   * An explicit user-confirmed legacy handover, not a silent history backfill.
   * Only valid when inventory currently has no holder/active history and the
   * employee already references that SIM. The server checks and audits custody.
   */
  public async verifyLegacyCurrentHandover(input: {
    employeeId: string;
    simCardId: string;
    assignedDate: string;
    assignedByProfileId: string;
    correctionReason: string;
    notes?: string;
    confirmPhysicalCustody: boolean;
  }): Promise<{ success: boolean; assignment_id?: string; error?: string }> {
    const res = await apiClient.post<{ success: boolean; assignment_id?: string; error?: string }>(
      '/api/erp/sims/verify-legacy-current-handover',
      input
    );
    if (res.data?.success) return res.data;
    return { success: false, error: res.data?.error || res.error || 'Could not verify this legacy SIM handover.' };
  }

  /**
   * Edit historical SIM assignment log record with audit logging
   */
  public async updateAssignmentHistory(
    assignmentId: string,
    updates: UpdateSimAssignmentHistoryUpdates
  ): Promise<{ success: boolean; assignment?: any; error?: string }> {
    const res = await apiClient.put<{ success: boolean; assignment?: any; error?: string }>(
      `/api/erp/sims/assignment-history/${assignmentId}`,
      updates
    );
    if (res.data?.success) {
      return res.data;
    }
    return { success: false, error: res.data?.error || res.error || 'Failed to update SIM assignment record' };
  }
}

export const simService = new SimService();
