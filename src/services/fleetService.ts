/**
 * Fleet & Vehicle Operations Engine Service
 * Provides client-side service methods with fallback and API sync
 * Enforces Multi-Tenant isolation, transactional integrity, and telemetry calculations
 */

import { apiClient } from './apiClient';
import {
  DbVehicleMasterEnhanced,
  DbVehicleStatusHistory,
  DbVehicleAssignmentRecord,
  DbVehicleOdometerHistory,
  DbVehicleMaintenance,
  DbMaintenanceRule,
  DbFuelEntry,
  DbFuelCard,
  DbVehicleAccident,
  DbVehicleFine,
  DbVehicleExpense,
  DbFleetVendor,
  DbFleetException,
  Vehicle360Data,
  FleetSummaryKpis,
  VehicleOperationalStatus,
  VehicleFilters,
} from '../types/fleet';

export type { VehicleFilters };

class FleetService {
  /**
   * Fetch all fleet vehicles (returns array)
   */
  public async getVehicles(filters?: VehicleFilters): Promise<DbVehicleMasterEnhanced[]> {
    const params = new URLSearchParams();
    if (filters?.branch && filters.branch !== 'All Branches' && filters.branch !== 'All') params.append('branch', filters.branch);
    if (filters?.project && filters.project !== 'All Projects' && filters.project !== 'All') params.append('project', filters.project);
    if (filters?.status && filters.status !== 'All Statuses' && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.type && filters.type !== 'All Types' && filters.type !== 'All') params.append('type', filters.type);
    if (filters?.ownership && filters.ownership !== 'All Ownership' && filters.ownership !== 'All') params.append('ownership', filters.ownership);
    if (filters?.vendor && filters.vendor !== 'All' && filters.vendor !== 'ALL') params.append('vendor', filters.vendor);
    if (filters?.state && filters.state !== 'All' && filters.state !== 'ALL') params.append('state', filters.state);
    if (filters?.maintenanceDue && filters.maintenanceDue !== 'All') params.append('maintenanceDue', filters.maintenanceDue);
    if (filters?.expiryAlert && filters.expiryAlert !== 'All') params.append('expiryAlert', filters.expiryAlert);
    if (filters?.search) params.append('q', filters.search);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiClient.get<any>(`/api/erp/fleet/vehicles${query}`);
    if (res.data && res.data.items && Array.isArray(res.data.items)) {
      return res.data.items;
    }
    return Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Fetch fleet vehicles with server-side pagination & live filtering
   */
  public async getVehiclesPaginated(
    filters?: VehicleFilters
  ): Promise<{ items: DbVehicleMasterEnhanced[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const params = new URLSearchParams();
    if (filters?.branch && filters.branch !== 'All Branches' && filters.branch !== 'All') params.append('branch', filters.branch);
    if (filters?.project && filters.project !== 'All Projects' && filters.project !== 'All') params.append('project', filters.project);
    if (filters?.status && filters.status !== 'All Statuses' && filters.status !== 'All') params.append('status', filters.status);
    if (filters?.type && filters.type !== 'All Types' && filters.type !== 'All') params.append('type', filters.type);
    if (filters?.ownership && filters.ownership !== 'All Ownership' && filters.ownership !== 'All') params.append('ownership', filters.ownership);
    if (filters?.vendor && filters.vendor !== 'All' && filters.vendor !== 'ALL') params.append('vendor', filters.vendor);
    if (filters?.state && filters.state !== 'All' && filters.state !== 'ALL') params.append('state', filters.state);
    if (filters?.maintenanceDue && filters.maintenanceDue !== 'All') params.append('maintenanceDue', filters.maintenanceDue);
    if (filters?.expiryAlert && filters.expiryAlert !== 'All') params.append('expiryAlert', filters.expiryAlert);
    if (filters?.search) params.append('q', filters.search);
    params.append('page', String(filters?.page || 1));
    params.append('pageSize', String(filters?.pageSize || 25));

    const query = `?${params.toString()}`;
    const res = await apiClient.get<any>(`/api/erp/fleet/vehicles${query}`);
    if (res.data && res.data.items) {
      return res.data;
    }
    const list = Array.isArray(res.data) ? res.data : [];
    return {
      items: list,
      total: list.length,
      page: 1,
      pageSize: list.length || 25,
      totalPages: 1,
    };
  }

  /**
   * Search vehicles across Plate, VIN, Model, Rider, Code
   */
  public async searchVehicles(query: string): Promise<DbVehicleMasterEnhanced[]> {
    if (!query.trim()) return this.getVehicles();
    const res = await apiClient.get<DbVehicleMasterEnhanced[]>(
      `/api/erp/fleet/vehicles/search?q=${encodeURIComponent(query)}`
    );
    return res.data || [];
  }

  /**
   * Get 360-degree operational profile for a vehicle
   */
  public async getVehicle360Profile(vehicleId: string): Promise<Vehicle360Data | null> {
    const res = await apiClient.get<Vehicle360Data>(`/api/erp/fleet/vehicles/${vehicleId}/profile-360`);
    return res.data || null;
  }

  /**
   * Fetch vehicle makes from live master
   */
  public async getMakes(params?: {
    q?: string;
    vehicle_type?: string;
    include_inactive?: boolean;
  }): Promise<{ id: string; name: string; vehicle_type?: string; active: boolean }[]> {
    const searchParams = new URLSearchParams();
    if (params?.q) searchParams.append('q', params.q);
    if (params?.vehicle_type) searchParams.append('vehicle_type', params.vehicle_type);
    if (params?.include_inactive) searchParams.append('include_inactive', 'true');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<any[]>(`/api/erp/fleet/makes${query}`);
    return Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Fetch vehicle models linked to make from live master
   */
  public async getModels(params?: {
    make_id?: string;
    make_name?: string;
    q?: string;
    include_inactive?: boolean;
  }): Promise<{ id: string; make_id: string; name: string; active: boolean }[]> {
    const searchParams = new URLSearchParams();
    if (params?.make_id) searchParams.append('make_id', params.make_id);
    if (params?.make_name) searchParams.append('make_name', params.make_name);
    if (params?.q) searchParams.append('q', params.q);
    if (params?.include_inactive) searchParams.append('include_inactive', 'true');
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const res = await apiClient.get<any[]>(`/api/erp/fleet/models${query}`);
    return Array.isArray(res.data) ? res.data : [];
  }

  /**
   * Create new vehicle make in master
   */
  public async createMake(data: { name: string; vehicle_type?: string; active?: boolean }) {
    const res = await apiClient.post<any>('/api/erp/fleet/makes', data);
    return res.data;
  }

  /**
   * Create new vehicle model in master
   */
  public async createModel(data: { make_id: string; name: string; active?: boolean }) {
    const res = await apiClient.post<any>('/api/erp/fleet/models', data);
    return res.data;
  }

  /**
   * Create new vehicle in fleet
   */
  public async createVehicle(
    data: Partial<DbVehicleMasterEnhanced>
  ): Promise<{ success: boolean; vehicle?: DbVehicleMasterEnhanced; error?: string }> {
    const res = await apiClient.post<DbVehicleMasterEnhanced>('/api/erp/fleet/vehicles', data);
    if (res.data && !res.error) {
      return { success: true, vehicle: res.data };
    }
    return { success: false, error: res.error || 'Failed to create vehicle record' };
  }

  /**
   * Update vehicle master data
   */
  public async updateVehicle(
    vehicleId: string,
    updates: Partial<DbVehicleMasterEnhanced>
  ): Promise<{ success: boolean; vehicle?: DbVehicleMasterEnhanced; error?: string }> {
    const res = await apiClient.put<DbVehicleMasterEnhanced>(`/api/erp/fleet/vehicles/${vehicleId}`, updates);
    if (res.data && !res.error) {
      return { success: true, vehicle: res.data };
    }
    return { success: false, error: res.error || 'Failed to update vehicle record' };
  }

  /** Save the bike's physical emirate, not its number-plate registration. */
  public async updateVehicleLocation(
    vehicleId: string, state: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.patch<{ success: boolean; error?: string }>(
      `/api/erp/fleet/vehicles/${encodeURIComponent(vehicleId)}/location`,
      { location_state: state }
    );
    if (res.error || !res.data?.success) {
      return { success: false, error: res.data?.error || res.error || 'Could not save bike location.' };
    }
    return { success: true };
  }

  /**
   * Change vehicle status with audit logging
   */
  public async changeVehicleStatus(
    vehicleId: string,
    status: VehicleOperationalStatus,
    reason?: string,
    effectiveDate?: string,
    notes?: string
  ): Promise<{ success: boolean; vehicle?: DbVehicleMasterEnhanced; error?: string }> {
    const res = await apiClient.post<{ success: boolean; vehicle: DbVehicleMasterEnhanced }>(
      `/api/erp/fleet/vehicles/${vehicleId}/status`,
      { status, reason, effectiveDate, notes }
    );
    if (res.data?.success) {
      return { success: true, vehicle: res.data.vehicle };
    }
    return { success: false, error: res.error || 'Failed to update vehicle status' };
  }

  /**
   * Assign vehicle to a rider (checks active status, starting odometer, prevents double-assign)
   */
  public async assignVehicle(
    vehicleId: string,
    employeeId: string,
    options: {
      assignmentDate: string;
      assignmentTime?: string;
      startingOdometer: number;
      condition?: string;
      handoverNotes?: string;
      assignedBy?: string;
      forceReassign?: boolean;
    }
  ): Promise<{
    success: boolean;
    assignment?: DbVehicleAssignmentRecord;
    error?: string;
    reassignmentRequired?: boolean;
    currentAssignee?: any;
    message?: string;
  }> {
    const res = await apiClient.post<{
      success: boolean;
      assignment?: DbVehicleAssignmentRecord;
      error?: string;
      reassignmentRequired?: boolean;
      currentAssignee?: any;
      message?: string;
    }>(
      `/api/erp/fleet/vehicles/${vehicleId}/assign`,
      { employeeId, ...options }
    );
    if (res.data?.success) {
      return {
        success: true,
        assignment: res.data.assignment,
        message: res.data.message,
      };
    }
    return {
      success: false,
      error: res.data?.error || res.error || 'Failed to assign vehicle to rider',
      reassignmentRequired: Boolean(res.data?.reassignmentRequired),
      currentAssignee: res.data?.currentAssignee,
    };
  }

  /**
   * Return vehicle from rider back to fleet
   */
  public async returnVehicle(
    vehicleId: string,
    options: {
      returnDate: string;
      returnTime?: string;
      returnOdometer: number;
      conditionOnReturn?: string;
      returnReason?: string;
      returnNotes?: string;
      returnedTo?: string;
      returnedBy?: string;
    }
  ): Promise<{ success: boolean; assignment?: DbVehicleAssignmentRecord; error?: string }> {
    const res = await apiClient.post<{ success: boolean; assignment: DbVehicleAssignmentRecord }>(
      `/api/erp/fleet/vehicles/${vehicleId}/return`,
      options
    );
    if (res.data?.success) {
      return { success: true, assignment: res.data.assignment };
    }
    return { success: false, error: res.error || 'Failed to return vehicle' };
  }

  /**
   * Return vehicle to leasing company / vendor (e.g. Easylease, Raid Lease)
   */
  public async returnVehicleToVendor(
    vehicleId: string,
    options: {
      vendorReturnDate?: string;
      vendorReturnTime?: string;
      vendorReturnReason: string;
      finalOdometer?: number;
      vendorReference?: string;
      returnedBy?: string;
      notes?: string;
      autoCloseRiderAssignment?: boolean;
    }
  ): Promise<{ success: boolean; vehicle?: any; error?: string; message?: string }> {
    const res = await apiClient.post<{ success: boolean; vehicle?: any; error?: string; message?: string }>(
      `/api/erp/fleet/vehicles/${vehicleId}/return-to-vendor`,
      options
    );
    if (res.data?.success) {
      return res.data;
    }
    return { success: false, error: res.data?.error || res.error || 'Failed to return vehicle to vendor' };
  }

  /**
   * Edit historical assignment log record
   */
  public async updateAssignmentHistory(
    assignmentId: string,
    updates: {
      assignment_date?: string;
      assignment_time?: string;
      return_date?: string;
      return_time?: string;
      starting_odometer?: number;
      return_odometer?: number;
      return_reason?: string;
      return_notes?: string;
      assigned_by?: string;
      returned_by?: string;
      handover_notes?: string;
    }
  ): Promise<{ success: boolean; assignment?: any; error?: string }> {
    const res = await apiClient.put<{ success: boolean; assignment?: any; error?: string }>(
      `/api/erp/fleet/assignment-history/${assignmentId}`,
      updates
    );
    if (res.data?.success) {
      return res.data;
    }
    return { success: false, error: res.data?.error || res.error || 'Failed to update assignment record' };
  }

  /**
   * Atomic Vehicle Replacement for a rider:
   * Returns current vehicle and assigns new vehicle in a single safe transaction.
   */
  public async replaceVehicle(
    employeeId: string,
    oldVehicleId: string,
    newVehicleId: string,
    options: {
      returnOdometer: number;
      conditionOnReturn?: string;
      returnNotes?: string;
      newStartingOdometer: number;
      newCondition?: string;
      replacementReason: string;
      assignedBy?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.post<{ success: boolean }>(
      `/api/erp/fleet/employees/${employeeId}/replace-vehicle`,
      { oldVehicleId, newVehicleId, ...options }
    );
    if (res.data?.success) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to replace vehicle' };
  }

  /**
   * Record new odometer reading with validation against previous history
   */
  public async recordOdometer(
    vehicleId: string,
    readingOrData: number | {
      reading: number;
      source: string;
      notes?: string;
      isCorrection?: boolean;
      correctionReason?: string;
      enteredBy?: string;
    },
    sourceParam?: string,
    options?: {
      notes?: string;
      isCorrection?: boolean;
      correctionReason?: string;
      enteredBy?: string;
    }
  ): Promise<{ success: boolean; odometerRecord?: DbVehicleOdometerHistory; error?: string }> {
    const payload = typeof readingOrData === 'object'
      ? readingOrData
      : { reading: readingOrData, source: sourceParam || 'Manual', ...options };

    const res = await apiClient.post<{ success: boolean; odometerRecord: DbVehicleOdometerHistory }>(
      `/api/erp/fleet/vehicles/${vehicleId}/odometer`,
      payload
    );
    if (res.data?.success) {
      return { success: true, odometerRecord: res.data.odometerRecord };
    }
    return { success: false, error: res.error || 'Failed to update odometer' };
  }

  /**
   * Create or log a Maintenance job / service
   */
  public async logMaintenance(
    vehicleId: string,
    data: Partial<DbVehicleMaintenance>
  ): Promise<{ success: boolean; maintenance?: DbVehicleMaintenance; error?: string }> {
    const res = await apiClient.post<DbVehicleMaintenance>(
      `/api/erp/fleet/vehicles/${vehicleId}/maintenance`,
      data
    );
    if (res.data && !res.error) {
      return { success: true, maintenance: res.data };
    }
    return { success: false, error: res.error || 'Failed to log maintenance record' };
  }

  /**
   * Complete a maintenance job and restore vehicle availability
   */
  public async completeMaintenance(
    maintenanceId: string,
    options: {
      completedDate: string;
      odometerAtService: number;
      actualCost: number;
      partsCost?: number;
      labourCost?: number;
      replacedParts?: string[];
      invoiceNumber?: string;
      technicianNotes?: string;
      setVehicleAvailable?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.post<{ success: boolean }>(
      `/api/erp/fleet/maintenance/${maintenanceId}/complete`,
      options
    );
    if (res.data?.success) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to complete maintenance' };
  }

  /**
   * Log Fuel Entry
   */
  public async logFuel(
    vehicleId: string,
    data: Partial<DbFuelEntry>
  ): Promise<{ success: boolean; fuelEntry?: DbFuelEntry; error?: string }> {
    const res = await apiClient.post<DbFuelEntry>(`/api/erp/fleet/vehicles/${vehicleId}/fuel`, data);
    if (res.data && !res.error) {
      return { success: true, fuelEntry: res.data };
    }
    return { success: false, error: res.error || 'Failed to log fuel entry' };
  }

  /**
   * Report Vehicle Accident
   */
  public async reportAccident(
    vehicleId: string,
    data: Partial<DbVehicleAccident>
  ): Promise<{ success: boolean; accident?: DbVehicleAccident; error?: string }> {
    const res = await apiClient.post<DbVehicleAccident>(
      `/api/erp/fleet/vehicles/${vehicleId}/accidents`,
      data
    );
    if (res.data && !res.error) {
      return { success: true, accident: res.data };
    }
    return { success: false, error: res.error || 'Failed to report accident' };
  }

  /**
   * Log Traffic Fine / Ticket
   */
  public async logFine(
    vehicleId: string,
    data: Partial<DbVehicleFine>
  ): Promise<{ success: boolean; fine?: DbVehicleFine; error?: string }> {
    const res = await apiClient.post<DbVehicleFine>(`/api/erp/fleet/vehicles/${vehicleId}/fines`, data);
    if (res.data && !res.error) {
      return { success: true, fine: res.data };
    }
    return { success: false, error: res.error || 'Failed to log traffic fine' };
  }

  /**
   * Link Fine to Payroll Deduction
   */
  public async linkFineToPayroll(
    fineId: string,
    payrollPeriodKey: string
  ): Promise<{ success: boolean; error?: string }> {
    const res = await apiClient.post<{ success: boolean }>(
      `/api/erp/fleet/fines/${fineId}/link-payroll`,
      { payrollPeriodKey }
    );
    if (res.data?.success) {
      return { success: true };
    }
    return { success: false, error: res.error || 'Failed to link fine to payroll' };
  }

  /**
   * Get Fleet Exception Center Alerts
   */
  public async getFleetExceptions(): Promise<DbFleetException[]> {
    const res = await apiClient.get<DbFleetException[]>('/api/erp/fleet/exceptions');
    return res.data || [];
  }

  public async getExceptions(): Promise<DbFleetException[]> {
    return this.getFleetExceptions();
  }

  /**
   * Get Fleet Summary KPIs
   */
  public async getFleetKpis(): Promise<FleetSummaryKpis> {
    const res = await apiClient.get<FleetSummaryKpis>('/api/erp/fleet/kpis');
    if (res.data) {
      return res.data;
    }
    return {
      totalVehicles: 0,
      availableVehicles: 0,
      assignedVehicles: 0,
      inMaintenanceVehicles: 0,
      outOfServiceVehicles: 0,
      utilizationRate: 0,
      mulkiyaExpiringCount: 0,
      insuranceExpiringCount: 0,
      maintenanceDueCount: 0,
      openAccidentsCount: 0,
      unpaidFinesCount: 0,
      totalMonthlySpendAED: 0,
    };
  }

  public async getKPIs(): Promise<FleetSummaryKpis> {
    return this.getFleetKpis();
  }

  public async replaceVehicleForEmployee(
    employeeId: string,
    optionsOrOldId: any,
    newVehicleId?: string,
    optionsParam?: any
  ): Promise<{ success: boolean; error?: string }> {
    if (typeof optionsOrOldId === 'object') {
      return this.replaceVehicle(
        employeeId,
        optionsOrOldId.oldVehicleId,
        optionsOrOldId.newVehicleId,
        optionsOrOldId
      );
    }
    return this.replaceVehicle(employeeId, optionsOrOldId, newVehicleId!, optionsParam);
  }

  /**
   * AI Copilot Fleet Execution Tool:
   * Perform safe, authorized fleet operations through natural language
   */
  public async executeAiFleetCommand(
    command: string,
    params?: any
  ): Promise<{ success: boolean; message: string; result?: any; error?: string }> {
    const res = await apiClient.post<{ success: boolean; message: string; result?: any }>(
      '/api/erp/fleet/ai-command',
      { command, params }
    );
    if (res.data?.success) {
      return { success: true, message: res.data.message, result: res.data.result };
    }
    return { success: false, message: res.error || 'AI command failed', error: res.error };
  }

  /**
   * Commit Validated Vehicles in Bulk
   * Enforces production safety, skips conflicts/duplicates, persists to Supabase & memory
   */
  public async commitBulkImport(
    rows: any[],
    dryRun: boolean = false
  ): Promise<{
    success: boolean;
    totalSourceRows: number;
    readyToImport: number;
    importedCount: number;
    skippedCount: number;
    failedCount: number;
    totalVehiclesAfterImport: number;
    rowErrors: {
      rowNumber: number;
      plate_number: string;
      chassis_number?: string;
      error: string;
      failingColumn?: string;
      cause?: string;
    }[];
    importedVehicles?: { id: string; plate_number: string; vehicle_code: string }[];
    failureSummaryByCause?: Record<
      string,
      { count: number; description: string; samplePlates: string[]; sampleRows: number[] }
    >;
    simulation?: boolean;
    error?: string;
  }> {
    const res = await apiClient.post<any>(
      '/api/erp/fleet/bulk-import/commit',
      { rows, dryRun }
    );
    if (res.data) {
      return res.data;
    }
    return {
      success: false,
      totalSourceRows: rows.length,
      readyToImport: 0,
      importedCount: 0,
      skippedCount: rows.length,
      failedCount: 0,
      totalVehiclesAfterImport: 0,
      rowErrors: [{ rowNumber: 0, plate_number: 'N/A', error: res.error || 'Commit failed' }],
      error: res.error || 'Failed to communicate with server',
    };
  }
}

export const fleetService = new FleetService();

