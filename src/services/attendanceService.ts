/**
 * Attendance & Daily Operations Client Service
 * Multi-Tenant Delivery Operations ERP
 */

import {
  DbAttendanceRecord,
  DbAttendanceMonth,
  DbAttendanceHistory,
  DbHolidayDate,
  DbShiftDefinition,
  TenantAttendanceSettings,
  OperationsExceptionItem,
  AttendanceImportPreviewRow,
  AttendanceImportBatch,
  AttendanceStatus,
} from '../types/attendance';

export interface DailyAttendanceResponse {
  date: string;
  projectId?: string;
  projectName?: string;
  branchId?: string;
  totalScheduled: number;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  weeklyOffCount: number;
  lateCount: number;
  notMarkedCount: number;
  exceptionsCount: number;
  records: DbAttendanceRecord[];
}

export interface MonthlyAttendanceSummaryRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  project: string;
  joiningDate?: string;
  totalMonthDays: number;
  eligibleDays: number;
  presentDays: number;
  absentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  weeklyOffDays: number;
  holidaysCount: number;
  halfDaysCount: number;
  lateDaysCount: number;
  overtimeHours: number;
  totalDeliveries: number;
  totalLoginHours: number;
  payableDays: number;
  attendanceRate: number; // %
  hasPayrollConflict?: boolean;
}

export interface OperationsOverviewData {
  date: string;
  activeRidersCount: number;
  workingTodayCount: number;
  absentTodayCount: number;
  onLeaveTodayCount: number;
  unassignedProjectCount: number;
  withoutBikeCount: number;
  withoutSimCount: number;
  expiringDocsCount: number;
  newJoinersCount: number;
  recentExitsCount: number;
  exceptions: OperationsExceptionItem[];
}

class AttendanceService {
  private getTenantId(): string {
    return (
      (typeof window !== 'undefined' &&
        (localStorage.getItem('apex_active_tenant_id') ||
         localStorage.getItem('active_tenant_id'))) ||
      'company_allied'
    );
  }

  private getHeaders(): Record<string, string> {
    const tenantId = this.getTenantId();
    const token = typeof window !== 'undefined' ? (localStorage.getItem('allied_auth_token') || localStorage.getItem('apex_auth_token') || '') : '';
    const activeUserRaw = typeof window !== 'undefined' ? localStorage.getItem('active_user_account') : null;
    let userId = 'usr_owner_1';
    let userRole = 'SUPER_ADMIN';
    if (activeUserRaw) {
      try {
        const u = JSON.parse(activeUserRaw);
        userId = u.id || userId;
        userRole = u.role || userRole;
      } catch (e) {
        // ignore
      }
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenantId,
      'x-user-id': userId,
      'x-user-role': userRole,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Fetch daily attendance roster with automated exception calculation
   */
  async getDailyAttendance(
    date: string,
    projectId?: string,
    branchId?: string,
    searchTerm?: string
  ): Promise<DailyAttendanceResponse> {
    try {
      const params = new URLSearchParams({ date });
      if (projectId && projectId !== 'ALL') params.append('projectId', projectId);
      if (branchId && branchId !== 'ALL') params.append('branchId', branchId);
      if (searchTerm) params.append('search', searchTerm);

      const res = await fetch(`/api/attendance/daily?${params.toString()}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch daily attendance');
      return await res.json();
    } catch (err) {
      console.warn('Using client fallback for getDailyAttendance:', err);
      return this.generateFallbackDailyRoster(date, projectId, branchId, searchTerm);
    }
  }

  /**
   * 1-Click Status Update for a Rider
   */
  async updateRiderStatus(
    employeeId: string,
    date: string,
    status: AttendanceStatus,
    reason?: string,
    overtimeHours?: number,
    ordersCount?: number
  ): Promise<{ success: boolean; record: DbAttendanceRecord; warning?: string }> {
    const res = await fetch('/api/attendance/quick-status', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        employeeId,
        date,
        status,
        reason,
        overtimeHours,
        ordersCount,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update attendance status');
    }
    return await res.json();
  }

  /**
   * Bulk Attendance Action (Mark Selected Present/Absent/Weekly Off/Leave/Reset)
   */
  async bulkUpdateStatus(
    employeeIds: string[],
    date: string,
    status: AttendanceStatus,
    reason?: string,
    note?: string
  ): Promise<{ success: boolean; updatedCount: number; warning?: string }> {
    const res = await fetch('/api/attendance/bulk-status', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        employeeIds,
        date,
        status,
        reason,
        note,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute bulk attendance action');
    }
    return await res.json();
  }

  /**
   * Monthly Attendance Summary for Payroll Sync
   */
  async getMonthlySummary(
    year: number,
    month: number,
    projectId?: string
  ): Promise<{
    monthKey: string;
    monthStatus: 'OPEN' | 'REVIEWED' | 'FINALIZED';
    isPayrollLocked: boolean;
    summaryRows: MonthlyAttendanceSummaryRow[];
    totals: {
      totalEmployees: number;
      totalPresentDays: number;
      totalAbsentDays: number;
      totalLeaveDays: number;
      totalWeeklyOffDays: number;
      totalHolidays: number;
      totalOvertimeHours: number;
      totalPayableDays: number;
      totalDeliveries: number;
    };
  }> {
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (projectId && projectId !== 'ALL') params.append('projectId', projectId);

      const res = await fetch(`/api/attendance/monthly-summary?${params.toString()}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch monthly attendance summary');
      return await res.json();
    } catch (err) {
      console.warn('Fallback for monthly summary:', err);
      return this.generateFallbackMonthlySummary(year, month, projectId);
    }
  }

  /**
   * Finalize Attendance Month
   */
  async finalizeMonth(
    year: number,
    month: number,
    notes?: string
  ): Promise<{ success: boolean; monthStatus: string }> {
    const res = await fetch('/api/attendance/finalize-month', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ year, month, notes }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to finalize attendance month');
    }
    return await res.json();
  }

  /**
   * Operations Overview & Exceptions View
   */
  async getOperationsOverview(date: string): Promise<OperationsOverviewData> {
    try {
      const res = await fetch(`/api/attendance/operations-overview?date=${encodeURIComponent(date)}`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch operations overview');
      return await res.json();
    } catch (err) {
      console.warn('Fallback operations overview:', err);
      return this.generateFallbackOperationsOverview(date);
    }
  }

  /**
   * Employee 360 Attendance Profile Data
   */
  async getEmployeeAttendanceProfile(employeeId: string, monthKey: string): Promise<{
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    todayStatus: AttendanceStatus;
    todayRecord?: DbAttendanceRecord;
    monthSummary: MonthlyAttendanceSummaryRow;
    calendarDays: {
      date: string;
      dayNumber: number;
      dayOfWeek: string;
      status: AttendanceStatus;
      overtimeHours?: number;
      deliveries?: number;
      note?: string;
      isFuture: boolean;
      isEligible: boolean;
    }[];
    historyLogs: DbAttendanceHistory[];
  }> {
    const res = await fetch(
      `/api/attendance/employee/${encodeURIComponent(employeeId)}?monthKey=${encodeURIComponent(monthKey)}`,
      {
        headers: this.getHeaders(),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch employee attendance profile');
    }
    return await res.json();
  }

  /**
   * Preview Attendance Import
   */
  async previewImport(
    csvContent: string,
    fileName: string
  ): Promise<{
    batchId: string;
    fileName: string;
    totalRows: number;
    validCount: number;
    duplicateCount: number;
    errorCount: number;
    detectedColumns: Record<string, string>;
    previewRows: AttendanceImportPreviewRow[];
  }> {
    const res = await fetch('/api/attendance/import/preview', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ csvContent, fileName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to parse and preview import file');
    }
    return await res.json();
  }

  /**
   * Execute Attendance Import
   */
  async executeImport(
    batchId: string,
    importMode: 'SKIP' | 'UPDATE' | 'REVIEW',
    rows: AttendanceImportPreviewRow[]
  ): Promise<{
    success: boolean;
    importedCount: number;
    skippedCount: number;
    updatedCount: number;
  }> {
    const res = await fetch('/api/attendance/import/execute', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ batchId, importMode, rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute attendance import');
    }
    return await res.json();
  }

  /**
   * Get Holiday Calendars & Dates
   */
  async getHolidays(year: number): Promise<DbHolidayDate[]> {
    const res = await fetch(`/api/attendance/holidays?year=${year}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.holidays || [];
  }

  /**
   * Add Holiday Date
   */
  async addHoliday(holiday: Partial<DbHolidayDate>): Promise<DbHolidayDate> {
    const res = await fetch('/api/attendance/holidays', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(holiday),
    });
    if (!res.ok) throw new Error('Failed to create holiday date');
    const data = await res.json();
    return data.holiday;
  }

  async saveHoliday(holiday: Partial<DbHolidayDate>): Promise<DbHolidayDate> {
    return this.addHoliday(holiday);
  }

  /**
   * Get Shift Definitions
   */
  async getShifts(): Promise<DbShiftDefinition[]> {
    const res = await fetch('/api/attendance/shifts', {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.shifts || [];
  }

  // --------------------------------------------------------------------------
  // Fallback Generators
  // --------------------------------------------------------------------------
  private generateFallbackDailyRoster(
    date: string,
    projectId?: string,
    branchId?: string,
    searchTerm?: string
  ): DailyAttendanceResponse {
    if (this.getTenantId() !== 'company_demo') {
      return {
        date,
        projectId,
        branchId,
        totalScheduled: 0,
        presentCount: 0,
        absentCount: 0,
        leaveCount: 0,
        weeklyOffCount: 0,
        lateCount: 0,
        notMarkedCount: 0,
        exceptionsCount: 0,
        records: [],
      };
    }

    const mockRiders: any[] = [];

    const records: DbAttendanceRecord[] = mockRiders.map((r, i) => ({
      id: `att_fb_${r.id}_${date}`,
      tenant_id: 'company_allied',
      employee_id: r.id,
      employee_code: r.code,
      employee_name: r.name,
      project_id: `proj_${i}`,
      project_name: r.project,
      branch_id: 'b_dxb',
      branch_name: 'Dubai Head Office',
      attendance_date: date,
      status: r.status,
      shift_name: r.shift,
      check_in: r.status === 'PRESENT' ? '08:00 AM' : r.status === 'LATE' ? '08:45 AM' : undefined,
      check_out: r.status === 'PRESENT' || r.status === 'LATE' ? '05:00 PM' : undefined,
      worked_minutes: r.status === 'PRESENT' ? 540 : r.status === 'LATE' ? 495 : 0,
      overtime_hours: r.id === 'emp_10271' ? 1.5 : 0,
      deliveries_count: r.id === 'emp_10271' ? 22 : r.id === 'emp_10273' ? 18 : 0,
      login_hours: r.status === 'PRESENT' ? 9.2 : 0,
      source: 'SYSTEM_DEFAULT',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return {
      date,
      projectId,
      branchId,
      totalScheduled: records.length,
      presentCount: records.filter((r) => r.status === 'PRESENT').length,
      absentCount: records.filter((r) => r.status === 'ABSENT').length,
      leaveCount: records.filter((r) => r.status === 'LEAVE' || r.status === 'SICK_LEAVE').length,
      weeklyOffCount: records.filter((r) => r.status === 'WEEKLY_OFF').length,
      lateCount: records.filter((r) => r.status === 'LATE').length,
      notMarkedCount: records.filter((r) => r.status === 'NOT_MARKED').length,
      exceptionsCount: records.filter((r) => r.status === 'ABSENT' || r.status === 'LATE').length,
      records,
    };
  }

  private generateFallbackMonthlySummary(year: number, month: number, projectId?: string) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month, 0).getDate();

    if (this.getTenantId() !== 'company_demo') {
      return {
        monthKey,
        monthStatus: 'OPEN' as const,
        isPayrollLocked: false,
        summaryRows: [],
        totals: {
          totalEmployees: 0,
          totalPresentDays: 0,
          totalAbsentDays: 0,
          totalLeaveDays: 0,
          totalWeeklyOffDays: 0,
          totalHolidays: 0,
          totalOvertimeHours: 0,
          totalPayableDays: 0,
          totalDeliveries: 0,
        },
      };
    }

    const mockSummaryRows: MonthlyAttendanceSummaryRow[] = [
      {
        employeeId: 'emp_10271',
        employeeCode: 'ADL0001',
        employeeName: 'Maruthi Thatikonda',
        designation: 'Delivery Rider',
        project: 'Noon Minutes Commission',
        joiningDate: '2025-01-10',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 27,
        absentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 1,
        overtimeHours: 8,
        totalDeliveries: 480,
        totalLoginHours: 245,
        payableDays: 31,
        attendanceRate: 100,
      },
      {
        employeeId: 'emp_10272',
        employeeCode: 'ADL0002',
        employeeName: 'Dabuto Gulata Beyene',
        designation: 'Delivery Rider',
        project: 'Talabat Fleet Dubai',
        joiningDate: '2025-02-15',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 26,
        absentDays: 1,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 2,
        overtimeHours: 12,
        totalDeliveries: 410,
        totalLoginHours: 230,
        payableDays: 30,
        attendanceRate: 96.3,
      },
      {
        employeeId: 'emp_10273',
        employeeCode: 'ADL0003',
        employeeName: 'Muhammad Tayyab',
        designation: 'Delivery Rider',
        project: 'Deliveroo On-Demand',
        joiningDate: '2025-03-01',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 27,
        absentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 0,
        overtimeHours: 15,
        totalDeliveries: 430,
        totalLoginHours: 240,
        payableDays: 31,
        attendanceRate: 100,
      },
      {
        employeeId: 'emp_10274',
        employeeCode: 'ADL0004',
        employeeName: 'Syed Daniyal Ali Shah',
        designation: 'Delivery Rider',
        project: 'Keeta Delivery Hub',
        joiningDate: '2025-04-12',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 26,
        absentDays: 1,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 3,
        overtimeHours: 6,
        totalDeliveries: 395,
        totalLoginHours: 215,
        payableDays: 30,
        attendanceRate: 96.3,
      },
      {
        employeeId: 'emp_10275',
        employeeCode: 'ADL0005',
        employeeName: 'Tariq Mansoor',
        designation: 'Delivery Rider',
        project: 'Amazon Prime Logistics',
        joiningDate: '2024-11-01',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 23,
        absentDays: 0,
        paidLeaveDays: 4,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 0,
        overtimeHours: 20,
        totalDeliveries: 350,
        totalLoginHours: 190,
        payableDays: 31,
        attendanceRate: 100,
      },
      {
        employeeId: 'emp_10276',
        employeeCode: 'ADL0006',
        employeeName: 'Rashid Khan',
        designation: 'Delivery Rider',
        project: 'Talabat Fleet Dubai',
        joiningDate: '2025-05-18',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 25,
        absentDays: 2,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 1,
        overtimeHours: 5,
        totalDeliveries: 380,
        totalLoginHours: 210,
        payableDays: 29,
        attendanceRate: 92.6,
      },
      {
        employeeId: 'emp_10277',
        employeeCode: 'ADL0007',
        employeeName: 'Waqas Haider',
        designation: 'Delivery Rider',
        project: 'Noon Minutes Commission',
        joiningDate: '2026-07-25',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 27,
        absentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 1,
        overtimeHours: 10,
        totalDeliveries: 420,
        totalLoginHours: 225,
        payableDays: 31,
        attendanceRate: 100,
      },
      {
        employeeId: 'emp_10278',
        employeeCode: 'ADL0008',
        employeeName: 'Zubair Sharaf',
        designation: 'HR Manager',
        project: 'Corporate Administration',
        joiningDate: '2024-03-01',
        totalMonthDays: daysInMonth,
        eligibleDays: daysInMonth,
        presentDays: 27,
        absentDays: 0,
        paidLeaveDays: 0,
        unpaidLeaveDays: 0,
        weeklyOffDays: 4,
        holidaysCount: 0,
        halfDaysCount: 0,
        lateDaysCount: 0,
        overtimeHours: 8,
        totalDeliveries: 0,
        totalLoginHours: 220,
        payableDays: 31,
        attendanceRate: 100,
      },
    ];

    return {
      monthKey,
      monthStatus: 'OPEN' as const,
      isPayrollLocked: false,
      summaryRows: mockSummaryRows,
      totals: {
        totalEmployees: mockSummaryRows.length,
        totalPresentDays: mockSummaryRows.reduce((s, r) => s + r.presentDays, 0),
        totalAbsentDays: mockSummaryRows.reduce((s, r) => s + r.absentDays, 0),
        totalLeaveDays: mockSummaryRows.reduce((s, r) => s + r.paidLeaveDays, 0),
        totalWeeklyOffDays: mockSummaryRows.reduce((s, r) => s + r.weeklyOffDays, 0),
        totalHolidays: 0,
        totalOvertimeHours: mockSummaryRows.reduce((s, r) => s + r.overtimeHours, 0),
        totalPayableDays: mockSummaryRows.reduce((s, r) => s + r.payableDays, 0),
        totalDeliveries: mockSummaryRows.reduce((s, r) => s + r.totalDeliveries, 0),
      },
    };
  }

  private generateFallbackOperationsOverview(date: string): OperationsOverviewData {
    if (this.getTenantId() !== 'company_demo') {
      return {
        date,
        activeRidersCount: 0,
        workingTodayCount: 0,
        absentTodayCount: 0,
        onLeaveTodayCount: 0,
        unassignedProjectCount: 0,
        withoutBikeCount: 0,
        withoutSimCount: 0,
        expiringDocsCount: 0,
        newJoinersCount: 0,
        recentExitsCount: 0,
        exceptions: [],
      };
    }

    return {
      date,
      activeRidersCount: 185,
      workingTodayCount: 168,
      absentTodayCount: 5,
      onLeaveTodayCount: 8,
      unassignedProjectCount: 3,
      withoutBikeCount: 2,
      withoutSimCount: 1,
      expiringDocsCount: 4,
      newJoinersCount: 3,
      recentExitsCount: 1,
      exceptions: [
        {
          id: 'exc_1',
          category: 'MISSING_BIKE',
          severity: 'HIGH',
          employeeId: 'emp_10276',
          employeeCode: 'ADL0006',
          employeeName: 'Rashid Khan',
          project: 'Talabat Fleet Dubai',
          issue: 'Rider is marked Working Today under Talabat but has no active bike assigned.',
          impact: 'Cannot execute deliveries; risk of platform SLA penalty.',
          recommendedAction: 'Assign available motorcycle from Dubai Fleet Depot.',
          actionType: 'ASSIGN_BIKE',
        },
        {
          id: 'exc_2',
          category: 'UNASSIGNED_PROJECT',
          severity: 'HIGH',
          employeeId: 'emp_10279',
          employeeCode: 'ADL0009',
          employeeName: 'Abdul Rehman',
          project: 'Unassigned',
          issue: 'Rider status is Active/Ready to Deploy but no project contract is assigned.',
          impact: 'Idle workforce cost without billing revenue.',
          recommendedAction: 'Transfer/Assign to Noon Minutes or Keeta expansion slot.',
          actionType: 'ASSIGN_PROJECT',
        },
        {
          id: 'exc_3',
          category: 'EXPIRED_DOCUMENT',
          severity: 'MEDIUM',
          employeeId: 'emp_10272',
          employeeCode: 'ADL0002',
          employeeName: 'Dabuto Gulata Beyene',
          project: 'Talabat Fleet Dubai',
          issue: 'UAE Driving License expired 14 days ago (2026-08-11).',
          impact: 'Police/RTA fine risk of AED 500+ and impoundment.',
          recommendedAction: 'Upload renewed RTA Driving License to Compliance Vault.',
          actionType: 'RENEW_DOCUMENT',
        },
        {
          id: 'exc_4',
          category: 'MISSING_SIM',
          severity: 'MEDIUM',
          employeeId: 'emp_10277',
          employeeCode: 'ADL0007',
          employeeName: 'Waqas Haider',
          project: 'Noon Minutes Commission',
          issue: 'Rider active on Noon Minutes without company data SIM assigned.',
          impact: 'GPS navigation and live order dispatch tracking unavailable.',
          recommendedAction: 'Assign telecom SIM from DU Fleet pool.',
          actionType: 'ASSIGN_SIM',
        },
      ],
    };
  }
}

export const attendanceService = new AttendanceService();
