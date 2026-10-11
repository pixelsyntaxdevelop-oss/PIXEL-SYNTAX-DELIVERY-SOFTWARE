/**
 * ApexFleet ERP & Tech Performance Platform - TypeScript Interface Definitions
 */

export type NavigationModule = string;

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'PENDING';
export type PlanTier = 'ENTERPRISE_PRO' | 'BUSINESS_GROWTH' | 'STARTER_SME' | 'TRIAL';

export interface SubscriptionLimits {
  maxUsers: number;
  maxRiders: number;
  maxVehicles: number;
  maxBranches: number;
  maxStorageGB: number;
  aiRequestsMonthly: number;
  smsMonthly: number;
  whatsappMonthly: number;
}

export interface SubscriptionUsage {
  activeUsers: number;
  activeRiders: number;
  activeVehicles: number;
  usedBranches: number;
  usedStorageGB: number;
  aiRequestsUsed: number;
  smsUsed: number;
  whatsappUsed: number;
}

export interface TenantCompany {
  id: string; // e.g. "company_allied", "company_swift", "company_express"
  code: string; // e.g. "ALLIED", "SWIFT", "EXPRESS"
  name: string;
  tradeLicenseNumber: string;
  taxRegistrationNumber: string;
  domain: string;
  status: TenantStatus;
  plan: PlanTier;
  subscriptionStart: string;
  subscriptionExpiry: string;
  createdDate: string;
  companyAdminEmail: string;
  companyAdminName: string;
  country: string;
  city: string;
  currency: string;
  logoUrl?: string;
  primaryColor?: string;
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
  enabledModules: string[];
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'PLATFORM_ADMIN'
  | 'COMPANY_ADMIN'
  | 'ERP_USER'
  | 'STAFF'
  | 'HR_MANAGER'
  | 'FLEET_MANAGER'
  | 'DISPATCHER'
  | 'OPERATIONS_MANAGER'
  | 'FINANCE_MANAGER'
  | 'ACCOUNTANT'
  | 'DRIVER'
  | 'RIDER'
  | 'TEAM_LEADER'
  | 'BRANCH_MANAGER';

export interface RolePermission {
  role: UserRole;
  displayName: string;
  description: string;
  permissions: {
    dashboard: { read: boolean; edit: boolean };
    riders: { read: boolean; create: boolean; edit: boolean; delete: boolean; export: boolean };
    fleet: { read: boolean; create: boolean; edit: boolean; delete: boolean };
    dispatch: { read: boolean; execute: boolean; reassign: boolean };
    hrPayroll: { read: boolean; approveLeave: boolean; runPayroll: boolean; editSalary: boolean };
    finance: { read: boolean; createInvoice: boolean; viewProfit: boolean };
    documents: { read: boolean; upload: boolean; approve: boolean };
    reports: { generate: boolean; export: boolean; schedule: boolean };
    settings: { companyConfig: boolean; auditLogs: boolean; manageRoles: boolean };
  };
}

export type RiderStatus = 'ONLINE' | 'DELIVERING' | 'OFFLINE' | 'ON_LEAVE' | 'SUSPENDED';

export interface RiderDriver {
  id: string;
  code: string;
  fullName: string;
  email: string;
  phone: string;
  roleType: 'RIDER' | 'DRIVER';
  branchId: string;
  status: RiderStatus;
  avatarUrl: string;
  
  // Performance
  deliveriesCompleted: number;
  rating: number; // 1-5
  onTimeRate: number; // percentage
  cancellationRate: number; // percentage
  
  // Documents
  passportNumber: string;
  passportExpiry: string;
  visaNumber: string;
  visaExpiry: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  licenseNumber: string;
  licenseExpiry: string;
  
  // HR & Contract
  contractType: 'FULL_TIME' | 'CONTRACTOR' | 'PART_TIME';
  joiningDate: string;
  baseSalary: number;
  incentivesMonth: number;
  penaltiesMonth: number;
  
  // Gear & Equipment
  assignedVehicleId?: string;
  equipmentAssigned: {
    uniform: boolean;
    helmet: boolean;
    deliveryBag: boolean;
    gpsTrackerDevice: boolean;
    mobilePhone: boolean;
  };
  
  // Current Location
  currentLocation?: {
    lat: number;
    lng: number;
    address: string;
    lastUpdated: string;
  };
}

export type VehicleType = 'MOTORCYCLE' | 'VAN' | 'CAR' | 'ELECTRIC_SCOOTER' | 'TRUCK';
export type VehicleStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'OUT_OF_SERVICE';

export interface Vehicle {
  id: string;
  plateNumber: string;
  model: string;
  make: string;
  year: number;
  type: VehicleType;
  status: VehicleStatus;
  branchId: string;
  currentRiderId?: string;
  odometerKm: number;
  fuelLevelPercent: number;
  batteryPercent?: number;
  
  // Registration & Insurance (Mulkiya)
  mulkiyaNumber: string;
  mulkiyaExpiry: string;
  insuranceCompany: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  
  // Service & Diagnostics
  lastServiceDate: string;
  nextServiceKm: number;
  tireConditionPercent: number;
  oilConditionPercent: number;
  fuelCostThisMonth: number;
  maintenanceCostThisMonth: number;
  accidentCount: number;
  gpsDeviceId: string;
}

export type OrderPriority = 'STANDARD' | 'EXPRESS' | 'CRITICAL';
export type OrderStatus = 'PENDING' | 'ASSIGNED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'DELAYED' | 'CANCELLED';

export interface OrderDispatch {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  merchantName: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  deliveryAddress: string;
  deliveryLat: number;
  deliveryLng: number;
  assignedRiderId?: string;
  assignedRiderName?: string;
  assignedVehiclePlate?: string;
  status: OrderStatus;
  priority: OrderPriority;
  orderAmount: number;
  orderValue?: number;
  deliveryFee: number;
  distanceKm: number;
  estimatedTimeMin: number;
  createdAt: string;
  promisedDeliveryTime: string;
  actualDeliveryTime?: string;
  delayedReason?: string;
  aiSuggestedRiderId?: string;
}

export interface GeofenceZone {
  id: string;
  name: string;
  type: 'DELIVERY_ZONE' | 'NO_GO_ZONE' | 'SPEED_RESTRICTED' | 'WAREHOUSE_HUB';
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  color: string;
  activeRidersCount: number;
  speedLimitKmh: number;
}

export interface EmployeeHR {
  id: string;
  employeeCode: string;
  fullName: string;
  department: 'SOFTWARE_ENGINEERING' | 'OPERATIONS' | 'FLEET' | 'HR' | 'FINANCE' | 'EXEC';
  designation: string;
  email: string;
  phone: string;
  joiningDate: string;
  salaryBase: number;
  allowances: number;
  taxDeduction: number;
  attendanceRate: number;
  leaveBalanceDays: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'PROBATION' | 'TERMINATED';
  contractEndDate: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: 'ANNUAL' | 'SICK' | 'EMERGENCY' | 'UNPAID';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedDate: string;
}

export interface PayrollRecord {
  id: string;
  periodMonth: string; // e.g. "August 2026"
  employeeId: string;
  employeeName: string;
  role: string;
  baseSalary: number;
  incentives: number;
  overtimeHours: number;
  overtimePay: number;
  penalties: number;
  taxDeductions: number;
  netPayable: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  paymentDate?: string;
}

export interface SoftwareProject {
  id: string;
  projectName: string;
  clientName: string;
  techStack: string[];
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD' | 'PLANNING';
  progressPercent: number;
  budgetTotal: number;
  billedRevenue: number;
  mrrContribution: number;
  startDate: string;
  deadline: string;
  teamLead: string;
  teamSize: number;
  openBugs: number;
  sprintVelocity: number;
}

export interface SoftwareDeveloper {
  id: string;
  fullName: string;
  role: 'FULLSTACK' | 'BACKEND' | 'FRONTEND' | 'DEVOPS' | 'MOBILE' | 'AI_ENGINEER';
  assignedProjectId: string;
  commitsThisWeek: number;
  prsReviewed: number;
  bugResolutionRate: number; // %
  codeQualityScore: number; // 1-100
  tasksCompleted: number;
  hourlyRate: number;
  avatarUrl: string;
}

export interface ExpiringDocumentAlert {
  id: string;
  entityType: 'RIDER' | 'VEHICLE' | 'EMPLOYEE';
  entityName: string;
  documentType: 'Passport' | 'Visa' | 'Emirates ID' | 'Driving License' | 'Mulkiya' | 'Insurance';
  expiryDate: string;
  daysRemaining: number;
  daysUntilExpiry?: number;
  severity: 'CRITICAL' | 'WARNING' | 'INFO'; // < 7 days = CRITICAL, < 30 days = WARNING
}

export interface BranchInfo {
  id: string;
  name: string;
  city: string;
  country: string;
  code: string;
  activeRiders: number;
  activeVehicles: number;
  monthlyRevenue: number;
  isHeadquarters: boolean;
}

export interface SystemAuditLog {
  id: string;
  timestamp: string;
  actorName?: string;
  actorRole?: UserRole | string;
  action?: string;
  module: NavigationModule | string;
  ipAddress?: string;
  details: string;
  status?: 'SUCCESS' | 'WARNING' | 'FAILED';
  userId?: string;
  userName?: string;
  userRole?: string;
  actionType?: 'ASSIGN' | 'UNASSIGN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'STATUS_CHANGE';
  targetEntityId?: string;
}

export interface AiCopilotCardData {
  type:
    | 'EMPLOYEE_360'
    | 'DOCUMENT_LIST'
    | 'SALARY_SHEET'
    | 'REPORT_SUMMARY'
    | 'SCREEN_EXPLANATION'
    | 'ACTION_CONFIRMATION'
    | 'DISAMBIGUATION'
    | 'ASSET_MATCH'
    | 'STATUS_HISTORY'
    | 'CONFIRMATION_PROPOSAL'
    | 'ZIP_DOWNLOAD'
    | 'RBAC_DENIAL'
    | 'PAYROLL_PERIOD_CARD'
    | 'PAYROLL_EXCEPTIONS_CARD'
    | 'EMPLOYEE_ADVANCE_CARD'
    | 'FINAL_SETTLEMENT_CARD'
    | (string & {});
  [key: string]: any;
  employeeData?: {
    id: string;
    code: string;
    name: string;
    designation: string;
    department: string;
    branch: string;
    status: string;
    joiningDate: string;
    visaExpiry: string;
    passportNumber: string;
    eidNumber: string;
    drivingLicense: string;
    assignedBikePlate?: string;
    assignedSimNumber?: string;
    salaryBase: number;
    attendanceRate: number;
    createdBy?: string;
    createdDate?: string;
    photoUrl?: string;
  };
  documentsData?: {
    title: string;
    count: number;
    items: {
      id: string;
      entityName: string;
      docType: string;
      docNumber?: string;
      expiryDate: string;
      daysRemaining: number;
      fileUrl?: string;
      status: string;
    }[];
  };
  salaryData?: {
    employeeName: string;
    employeeCode: string;
    periodMonth: string;
    baseSalary: number;
    incentives: number;
    overtimePay: number;
    penalties: number;
    deductions: number;
    netPayable: number;
    attendanceDays: number;
    totalDays: number;
  };
  reportData?: {
    reportTitle: string;
    generatedAt: string;
    metrics: { label: string; value: string | number; change?: string }[];
    tableData?: { headers: string[]; rows: (string | number)[][] };
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
}

export interface AiCopilotMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  timestamp: string;
  suggestedActions?: { label: string; actionType: string; payload?: any }[];
  actionType?: 'NAVIGATE_MODULE' | 'FILTER_DOCS' | 'GENERATE_SALARY' | 'SHOW_EMPLOYEE' | 'EXPORT_REPORT' | 'EXPLAIN_SCREEN' | 'EXECUTE_AUTOMATION';
  actionPayload?: any;
  cards?: AiCopilotCardData[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'ON_LEAVE' | 'OFFICIAL_VISIT';
  location: string;
  shiftName: string;
  overtimeHours: number;
}

export interface PartnerPerformanceRecord {
  id: string;
  riderId: string;
  riderName: string;
  riderCode: string;
  partner: 'CAREEM' | 'TALABAT' | 'DELIVEROO' | 'NOON' | 'AMAZON';
  userCode: string;
  assignedStore: string;
  projectShift: string;
  ordersTarget: number;
  ordersCompleted: number;
  acceptanceRate: number; // %
  customerRating: number; // 1-5
  totalEarnings: number;
  penaltyDeductions: number;
  netPayable: number;
  status: 'ACTIVE' | 'STANDBY' | 'SUSPENDED';
}

export interface DriverTicket {
  id: string;
  ticketNumber: string;
  riderId: string;
  riderName: string;
  vehiclePlate: string;
  violationDate: string;
  violationType: 'SPEEDING' | 'PARKING' | 'LANE_VIOLATION' | 'RED_LIGHT' | 'NO_HELMET';
  location: string;
  fineAmountAED: number;
  status: 'PENDING_REVIEW' | 'ASSIGNED_TO_DRIVER' | 'PAID' | 'DISPUTED';
  deductedFromPayroll: boolean;
}

export interface InventoryItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: 'UNIFORM' | 'HELMET' | 'DELIVERY_BAG' | 'GPS_TRACKER' | 'SMARTPHONE';
  totalStock: number;
  assignedStock: number;
  availableStock: number;
  damagedStock: number;
  unitValueAED: number;
  supplier: string;
}

export interface SimCardRecord {
  id: string;
  simNumber: string;
  phoneNumber: string;
  provider: 'DU' | 'ETISALAT' | 'VIRGIN' | 'STC';
  planName: string;
  monthlyBillAED: number;
  dataUsageGB: number;
  dataLimitGB: number;
  assignedRiderId?: string;
  assignedRiderName?: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'AVAILABLE';
}

export interface OfficeFormRecord {
  id: string;
  formNumber: string;
  employeeId: string;
  employeeName: string;
  templateType: 'NOC_REQUEST' | 'SALARY_CERTIFICATE' | 'ASSET_HANDOVER' | 'WARNING_LETTER' | 'RESIGNATION';
  createdDate: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  fileAttachment?: string;
}

export interface PassportRecord {
  id: string;
  passportNumber: string;
  employeeId: string;
  employeeName: string;
  nationality: string;
  custodyLocation: 'HEAD_OFFICE_SAFE' | 'BRANCH_SAFE' | 'WITH_EMPLOYEE' | 'IN_TRANSIT';
  status: 'SECURE' | 'RELEASED_FOR_TRAVEL' | 'EMBASSY_RENEWAL';
  lastDeliveryLog: string;
  handledBy: string;
}

export interface CandidateRecord {
  id: string;
  candidateId: string; // e.g. "127"
  employee_id?: string;
  employee_code?: string;
  tenant_id?: string;
  fullName: string;
  uniqueId: string; // e.g. "XXX-XXXX-XXXXXXX-X"
  cnicPassport: string;
  mobile: string;
  nationality?: string;
  createdDate: string;
  created_by?: string;
  archived?: boolean;
  interview: 'Pass' | 'Fail' | 'Pending';
  status: 'Active' | 'Inactive' | 'Closed';
  licensePackageType: string; // "Visa Only", "License & Visa"
  totalPackage: number;
  advance: number;
  balance: number;
  perMonthDeduction: number;
  currentStage: string; // "Visa Deal & Documentation"
  currentStageCode: 'STAGE_1' | 'STAGE_2' | 'STAGE_3' | 'STAGE_4' | 'STAGE_5' | 'STAGE_6';
  stageStatus: 'Not Started' | 'Open' | 'Completed' | 'Skipped';
  stage1Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage2Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage3Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage4Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage5Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  stage6Status: 'Completed' | 'Open' | 'Not Started' | 'Skipped';
  visaProcess: {
    current: string;
    completed: string;
    elapsed: string;
    next: string;
  };
  dlProcess: {
    current: string;
    completed: string;
    elapsed: string;
    next: string;
  };
  stageData?: Record<string, any>;
}

export interface SystemUserAccount {
  id: string;
  tenantId?: string; // Multi-tenant company isolation ID
  tenant_id?: string;
  companyName?: string;
  username: string; // e.g. "owner_main", "m_adnan", "sara_hr", "ali_fleet"
  fullName: string;
  name?: string;
  email: string;
  phone: string;
  role: UserRole;
  designation: string;
  isOwner: boolean;
  isSuperAdmin?: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdDate: string;
  lastLogin: string;
  avatarUrl?: string;
  allowedModules: string[]; // Navigation module IDs allowed for this user
}



