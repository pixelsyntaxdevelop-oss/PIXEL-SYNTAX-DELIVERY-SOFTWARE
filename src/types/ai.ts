/**
 * Enterprise AI Copilot Architecture Type Definitions
 * Multi-Tenant Delivery Operations ERP
 */

import { NavigationModule, UserRole } from './erp';

export type AiToolName =
  | 'resolveEmployee'
  | 'getEmployeeProfile'
  | 'getEmployeeStatus'
  | 'getEmployeeStatusHistory'
  | 'getEmployeeProject'
  | 'getEmployeeVehicle'
  | 'getEmployeeVehicleHistory'
  | 'getEmployeeSim'
  | 'getEmployeeSimHistory'
  | 'getEmployeeAssets'
  | 'getEmployeeDocuments'
  | 'getDocumentDetails'
  | 'getDocumentVersions'
  | 'getAuthorizedDocumentDownload'
  | 'bulkDownloadEmployeeDocuments'
  | 'getExpiringDocuments'
  | 'getMissingDocuments'
  | 'reverseLookupAsset'
  | 'getEmployeePayroll'
  | 'getEmployeeSalarySheet'
  | 'generatePayrollPeriod'
  | 'getPayrollSummary'
  | 'getPayrollPeriodSummary'
  | 'getPayrollExceptions'
  | 'approvePayrollPeriod'
  | 'createEmployeeAdvance'
  | 'recordSalaryAdvance'
  | 'addPayrollAdjustment'
  | 'calculateFinalSettlement'
  | 'getEmployeeAttendance'
  | 'getDailyAttendance'
  | 'markEmployeeAttendance'
  | 'getAttendanceExceptions'
  | 'getOperationsExceptions'
  | 'getTodayWorkforce'
  | 'getMonthlyAttendanceSummary'
  | 'getEmployeeTimeline'
  | 'searchEmployees'
  | 'searchVehicles'
  | 'prepareWriteAction'
  | 'executeWriteAction'
  | 'explainErpScreen';

export interface AiDisambiguationOption {
  id: string;
  code: string;
  name: string;
  designation: string;
  department?: string;
  branch?: string;
  project?: string;
  status: string;
  photo?: string;
  mobile?: string;
  emiratesId?: string;
  passportNumber?: string;
}

export interface AiAssetMatch {
  assetType: 'BIKE' | 'SIM' | 'DEVICE' | 'HELMET' | 'BAG';
  identifier: string; // e.g. "51604", "0507766554", "HLM-DXB-9921"
  modelName: string;
  status: string;
  condition?: string;
  isAssigned: boolean;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  assignedEmployeeCode?: string;
  assignmentDate?: string;
  handoverNotes?: string;
  branchName?: string;
  projectName?: string;
  mulkiyaExpiry?: string;
  insuranceExpiry?: string;
  simPlan?: string;
}

export interface AiStatusHistoryEntry {
  id: string;
  status: string;
  reason: string;
  effectiveFrom: string;
  effectiveTo?: string;
  changedBy: string;
  notes?: string;
}

export interface AiConfirmationProposal {
  confirmationToken: string;
  actionType: 'ASSIGN_VEHICLE' | 'RETURN_VEHICLE' | 'ASSIGN_SIM' | 'CHANGE_STATUS' | 'ARCHIVE_DOCUMENT' | 'APPROVE_LEAVE';
  title: string;
  summary: string;
  consequences: string[];
  targetEntityId: string;
  targetEntityName: string;
  targetEntityType: 'Employee' | 'Vehicle' | 'SIM' | 'Document';
  payload: Record<string, any>;
  expiresAt: string;
  requiresElevatedPrivilege?: boolean;
}

export interface AiZipDownloadPackage {
  packageId: string;
  packageName: string;
  employeeId: string;
  employeeName: string;
  documentCount: number;
  totalSizeEstimated: string;
  downloadUrl: string;
  downloadToken: string;
  expiresInSeconds: number;
  documents: {
    id: string;
    docType: string;
    docNumber: string;
    fileName: string;
    versionNumber: number;
    downloadUrl: string;
  }[];
}

export interface AiDocumentItem {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  documentTypeId: string;
  documentTypeName: string;
  documentNumber: string;
  issueDate?: string;
  expiryDate?: string;
  daysRemaining?: number;
  severity: 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
  currentVersion: number;
  fileName: string;
  fileSize?: string;
  isArchived: boolean;
  downloadToken?: string;
  downloadUrl?: string;
}

export interface AiEmployee360Data {
  id: string;
  code: string;
  name: string;
  photo?: string;
  designation: string;
  department: string;
  branch: string;
  project?: string;
  projectCode?: string;
  supervisor?: string;
  status: string;
  statusReason?: string;
  joiningDate: string;
  nationality?: string;
  mobile?: string;
  email?: string;
  passportNumber?: string;
  passportExpiry?: string;
  passportStatus?: string;
  passportLocation?: string;
  eidNumber?: string;
  eidExpiry?: string;
  visaNumber?: string;
  visaExpiry?: string;
  drivingLicense?: string;
  drivingLicenseExpiry?: string;
  assignedBikeId?: string;
  assignedBikePlate?: string;
  assignedBikeModel?: string;
  assignedSimId?: string;
  assignedSimNumber?: string;
  assignedSimProvider?: string;
  assetsCount?: number;
  documentsCount?: number;
  basicSalary?: number;
  allowances?: number;
  salaryType?: string;
  attendanceSummary?: {
    ratePercent: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
  createdBy?: string;
  createdDate?: string;
  updatedBy?: string;
  updatedDate?: string;
}

export interface AiCopilotCardPayload {
  type:
    | 'EMPLOYEE_360'
    | 'DOCUMENT_LIST'
    | 'DISAMBIGUATION'
    | 'ASSET_MATCH'
    | 'STATUS_HISTORY'
    | 'CONFIRMATION_PROPOSAL'
    | 'ZIP_DOWNLOAD'
    | 'SALARY_SHEET'
    | 'EMPLOYEE_SALARY_SLIP_CARD'
    | 'PAYROLL_PERIOD_CARD'
    | 'PAYROLL_EXCEPTIONS_CARD'
    | 'EMPLOYEE_ADVANCE_CARD'
    | 'FINAL_SETTLEMENT_CARD'
    | 'DAILY_ATTENDANCE_CARD'
    | 'OPERATIONS_EXCEPTIONS_CARD'
    | 'WORKFORCE_SNAPSHOT_CARD'
    | 'ATTENDANCE_SUMMARY_CARD'
    | 'REPORT_SUMMARY'
    | 'SCREEN_EXPLANATION'
    | 'ACTION_CONFIRMATION'
    | 'RBAC_DENIAL';
  employeeData?: AiEmployee360Data;
  documentsData?: {
    title: string;
    count: number;
    employeeName?: string;
    items: AiDocumentItem[];
  };
  disambiguationData?: {
    query: string;
    message: string;
    options: AiDisambiguationOption[];
  };
  assetMatchData?: AiAssetMatch;
  statusHistoryData?: {
    employeeName: string;
    employeeCode: string;
    currentStatus: string;
    history: AiStatusHistoryEntry[];
  };
  confirmationData?: AiConfirmationProposal;
  confirmationProposal?: any;
  zipPackageData?: AiZipDownloadPackage;
  payrollPeriod?: any;
  payrollExceptions?: any;
  salarySlip?: any;
  advance?: any;
  settlement?: any;
  dailyAttendance?: any;
  operationsExceptions?: any;
  workforceSnapshot?: any;
  attendanceSummaryData?: any;
  salaryData?: {
    employeeId?: string;
    employeeName: string;
    employeeCode: string;
    designation?: string;
    project?: string;
    periodMonth: string;
    periodKey?: string;
    salaryStructureType?: string;
    baseSalary: number;
    proratedBaseSalary?: number;
    fuelAllowance?: number;
    mobileAllowance?: number;
    accommodationAllowance?: number;
    bikeAllowance?: number;
    foodAllowance?: number;
    otherAllowances?: number;
    totalAllowances?: number;
    deliveriesCompleted?: number;
    deliveryIncentives?: number;
    overtimeHours?: number;
    overtimePay?: number;
    bonusAdjustments?: number;
    grossEarnings?: number;
    absenceDeductions?: number;
    trafficFinesDeduction?: number;
    advanceLoanDeduction?: number;
    penaltyDeductions?: number;
    otherDeductions?: number;
    totalDeductions?: number;
    netPayable: number;
    attendanceDays?: number;
    totalDays?: number;
    iban?: string;
    bankName?: string;
    paymentMethod?: string;
    status?: string;
    hasExceptions?: boolean;
    exceptions?: { type: string; message: string; severity: string }[];
  };
  payrollPeriodData?: {
    periodId: string;
    periodMonth: string;
    year: number;
    month: number;
    status: string;
    totalEmployees: number;
    totalGrossPay: number;
    totalAllowances: number;
    totalDeliveryIncentives: number;
    totalOvertimePay: number;
    totalDeductions: number;
    totalTrafficFines: number;
    totalAdvancesRecovered: number;
    totalNetPayable: number;
    exceptionsCount: number;
    wpsFileGenerated: boolean;
    generatedAt?: string;
    generatedBy?: string;
    approvedAt?: string;
    approvedBy?: string;
  };
  exceptionsData?: {
    periodMonth: string;
    totalExceptions: number;
    criticalCount: number;
    warningCount: number;
    exceptions: {
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      project?: string;
      type: string;
      message: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      netSalary?: number;
    }[];
  };
  screenExplanation?: {
    moduleName: string;
    summary: string;
    features: string[];
    buttons: { name: string; description: string }[];
    workflow: string[];
  };
  actionConfirmation?: {
    actionName: string;
    status: 'SUCCESS' | 'WARNING' | 'FAILED';
    details: string;
    targetEntity?: string;
    auditLogId?: string;
  };
  rbacDenial?: {
    requiredPermission: string;
    userRole: string;
    message: string;
    suggestedContact?: string;
  };
}

export interface AiCopilotInteractionMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  suggestedActions?: { label: string; actionType?: string; payload?: any }[];
  actionType?:
    | 'NAVIGATE_MODULE'
    | 'FILTER_DOCS'
    | 'GENERATE_SALARY'
    | 'SHOW_EMPLOYEE'
    | 'EXPORT_REPORT'
    | 'EXPLAIN_SCREEN'
    | 'EXECUTE_AUTOMATION'
    | 'DOWNLOAD_DOC'
    | 'PROPOSE_CONFIRMATION'
    | 'RESOLVE_DISAMBIGUATION';
  actionPayload?: any;
  cards?: AiCopilotCardPayload[];
  toolExecutions?: {
    toolName: string;
    durationMs: number;
    status: 'SUCCESS' | 'ERROR' | 'DENIED';
    entityType?: string;
    entityId?: string;
  }[];
}

export interface AiConversationSession {
  conversationId: string;
  tenantId: string;
  userId: string;
  activeEntity?: {
    type: 'Employee' | 'Vehicle' | 'SIM' | 'Document';
    id: string;
    name: string;
    code?: string;
  };
  lastToolUsed?: string;
  createdAt: string;
  updatedAt: string;
}
