/**
 * Rider Performance & Project Operations Engine - Types & Schemas
 * Multi-Tenant SaaS Delivery Operations ERP
 */

export type DeliveryPlatform =
  | 'TALABAT'
  | 'DELIVEROO'
  | 'NOON'
  | 'NOON_MINUTES'
  | 'AMAZON'
  | 'CAREEM'
  | 'KEETA'
  | 'CUSTOM';

export type PerformanceScoreCategory =
  | 'EXCELLENT' // 90-100
  | 'GOOD' // 75-89
  | 'AVERAGE' // 60-74
  | 'NEEDS_ATTENTION' // 45-59
  | 'CRITICAL'; // < 45

export type PerformancePeriod = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export type PerformanceExceptionType =
  | 'LOW_DELIVERIES'
  | 'LOW_LOGIN_HOURS'
  | 'HIGH_ABSENCE'
  | 'LOW_ACCEPTANCE'
  | 'LOW_COMPLETION'
  | 'HIGH_CANCELLATION'
  | 'EXPIRED_DOCUMENT'
  | 'MISSING_BIKE'
  | 'MISSING_SIM'
  | 'UNASSIGNED_PROJECT'
  | 'REPEATED_UNDERPERFORMANCE';

export type PerformanceExceptionSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface PerformanceScoringWeights {
  deliveriesVsTarget: number; // e.g. 35%
  attendanceRate: number; // e.g. 20%
  loginHours: number; // e.g. 15%
  acceptanceRate: number; // e.g. 10%
  completionRate: number; // e.g. 15%
  customerRating: number; // e.g. 5%
}

export interface PerformanceIncentiveTier {
  id: string;
  minDeliveries: number;
  maxDeliveries?: number;
  bonusAmountAED: number;
  label: string;
}

export interface PerformanceIncentiveRule {
  id: string;
  name: string;
  ruleType: 'DELIVERY_TIER' | 'ACCEPTANCE_BONUS' | 'ATTENDANCE_BONUS' | 'PERFORMANCE_SCORE_BONUS';
  minAcceptanceRate?: number;
  bonusAmountAED: number;
  tiers?: PerformanceIncentiveTier[];
  description?: string;
  isActive: boolean;
}

export interface PerformancePenaltyRule {
  id: string;
  name: string;
  penaltyType: 'CANCELLATION_THRESHOLD' | 'NO_SHOW_PENALTY' | 'LOW_ACCEPTANCE_PENALTY' | 'LATE_LOGINS';
  thresholdPercent?: number;
  penaltyAmountAED: number;
  description?: string;
  isActive: boolean;
}

export interface DbProjectPerformanceConfig {
  id: string;
  tenant_id: string;
  project_id: string;
  project_name: string;
  platform: DeliveryPlatform;
  
  // Targets & Baselines
  daily_delivery_target: number; // e.g. 22 orders
  monthly_delivery_target: number; // e.g. 600 orders
  min_daily_login_hours: number; // e.g. 9.0 hrs
  monthly_working_days_target: number; // e.g. 26 days
  min_acceptance_rate: number; // e.g. 90%
  min_completion_rate: number; // e.g. 95%
  max_cancellation_rate: number; // e.g. 3%
  target_customer_rating: number; // e.g. 4.7
  
  // Scoring configuration
  scoring_weights: PerformanceScoringWeights;
  
  // Incentives & Penalties
  incentive_rules: PerformanceIncentiveRule[];
  penalty_rules: PerformancePenaltyRule[];
  
  // Platform specific enabled features
  track_speed_metrics?: boolean;
  track_cash_collected?: boolean;
  track_acceptance?: boolean;
  track_online_vs_login?: boolean;
  
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbRiderDailyPerformance {
  id: string;
  tenant_id: string;
  employee_id: string;
  employee_code: string;
  employee_name: string;
  project_id: string;
  project_name: string;
  platform: DeliveryPlatform;
  branch_id?: string;
  branch_name?: string;
  performance_date: string; // YYYY-MM-DD
  
  // Operational Metrics (Optional/Flexible per project)
  orders_assigned: number;
  orders_accepted: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_rejected: number;
  deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  
  login_hours: number;
  online_hours: number;
  active_hours: number;
  
  acceptance_rate: number; // %
  completion_rate: number; // %
  cancellation_rate: number; // %
  
  distance_km?: number;
  cash_collected_aed?: number;
  customer_rating?: number; // 1-5
  late_deliveries_count?: number;
  on_time_rate?: number; // %
  
  // Attendance connection
  attendance_status: string; // 'PRESENT' | 'ABSENT' | 'WEEKLY_OFF' etc
  attendance_record_id?: string;
  
  // Performance Engine Output
  target_achievement_rate: number; // %
  deliveries_per_hour: number;
  performance_score: number; // 0-100
  score_category: PerformanceScoreCategory;
  
  // Earnings / Incentives computed
  estimated_daily_incentive_aed: number;
  estimated_daily_penalty_aed: number;
  
  // Audit and Source
  source: 'CSV_IMPORT' | 'API_INTEGRATION' | 'MANUAL_ENTRY' | 'SYNTHESIZED';
  import_batch_id?: string;
  notes?: string;
  is_verified: boolean;
  verified_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DbPerformanceImportBatch {
  id: string;
  tenant_id: string;
  project_id?: string;
  project_name?: string;
  platform?: DeliveryPlatform;
  file_name: string;
  total_rows: number;
  valid_rows_count: number;
  duplicate_rows_count: number;
  error_rows_count: number;
  imported_count: number;
  updated_count: number;
  skipped_count: number;
  import_date: string;
  uploaded_by: string;
  status: 'PREVIEW' | 'COMPLETED' | 'FAILED';
  detected_columns: Record<string, string>;
  created_at: string;
}

export interface PerformanceImportPreviewRow {
  rowIndex: number;
  rawIdentifier: string;
  matchedEmployeeId?: string;
  matchedEmployeeCode?: string;
  matchedEmployeeName?: string;
  matchedProjectId?: string;
  matchedProjectName?: string;
  date: string;
  performanceDate?: string;
  orders: number;
  deliveries: number;
  loginHours: number;
  onlineHours: number;
  acceptanceRate: number;
  completionRate: number;
  cancellationRate: number;
  customerRating?: number;
  cashCollected?: number;
  isDuplicate: boolean;
  existingRecordId?: string;
  hasConflict: boolean;
  status: 'VALID' | 'WARNING' | 'ERROR';
  errorMessage?: string;
  matchedRiderBike?: string;
  matchedRiderSim?: string;
}

export interface RiderPerformanceSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designation: string;
  currentProjectId?: string;
  currentProjectName: string;
  platform: DeliveryPlatform;
  branchId?: string;
  branchName?: string;
  photo?: string;
  bikePlate?: string;
  simNumber?: string;
  supervisorName?: string;
  
  // Period aggregations
  period: PerformancePeriod;
  startDate: string;
  endDate: string;
  totalDays: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  weeklyOffDays: number;
  
  totalDeliveries: number;
  totalOrdersAssigned: number;
  totalOrdersCompleted: number;
  totalOrdersCancelled: number;
  totalLoginHours: number;
  totalOnlineHours: number;
  
  avgDeliveriesPerDay: number;
  avgDeliveriesPerHour: number;
  avgLoginHoursPerDay: number;
  avgAcceptanceRate: number;
  avgCompletionRate: number;
  avgCancellationRate: number;
  avgCustomerRating: number;
  attendanceRate: number;
  
  deliveryTarget: number;
  targetAchievementRate: number;
  
  // Central Score
  performanceScore: number; // 0-100
  scoreCategory: PerformanceScoreCategory;
  rank?: number;
  
  // Financial impact
  estimatedIncentiveAED: number;
  estimatedPenaltyAED: number;
  netPerformanceBonusAED: number;
  
  // Project-split history (if worked across multiple projects)
  projectBreakdowns: {
    projectId: string;
    projectName: string;
    platform: DeliveryPlatform;
    daysWorked: number;
    deliveries: number;
    loginHours: number;
    targetAchievementRate: number;
    performanceScore: number;
  }[];
  
  // Exception flags
  hasActiveExceptions: boolean;
  exceptionCount: number;
  exceptions: PerformanceException[];
  
  // Daily records list
  dailyRecords: DbRiderDailyPerformance[];

  // Compatibility & Legacy Aliases
  employee_id?: string;
  employee_name?: string;
  employee_code?: string;
  branch_name?: string;
  project_name?: string;
  total_deliveries?: number;
  avg_deliveries_daily?: number;
  delivery_target_achieved_percent?: number;
  avg_login_hours_daily?: number;
  total_login_hours?: number;
  avg_acceptance_rate?: number;
  avg_customer_rating?: number;
  assigned_bike_plate?: string;
  assigned_sim_number?: string;
  total_incentives?: number;
  total_penalties?: number;
  overall_score?: number;
  score_category?: PerformanceScoreCategory;
  active_exceptions_count?: number;
  net_performance_earnings?: number;
}

export interface PerformanceException {
  id: string;
  type: PerformanceExceptionType;
  severity: PerformanceExceptionSeverity;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  projectId?: string;
  projectName?: string;
  title: string;
  description: string;
  currentMetricValue: string;
  expectedThreshold: string;
  impact: string;
  suggestedAction: string;
  actionType:
    | 'ADJUST_TARGET'
    | 'REASSIGN_BIKE'
    | 'REASSIGN_SIM'
    | 'TRANSFER_PROJECT'
    | 'COACHING_NOTE'
    | 'UPDATE_DATA'
    | 'CONTACT_RIDER';
  createdAt: string;

  // Compatibility Aliases
  employee_id?: string;
  employee_code?: string;
  employee_name?: string;
  project_name?: string;
  suggested_action?: string;
}

export interface PerformanceCorrectionAuditLog {
  id: string;
  tenant_id: string;
  performance_record_id: string;
  employee_id: string;
  employee_name: string;
  field_changed: string;
  old_value: any;
  new_value: any;
  reason: string;
  changed_by: string;
  timestamp: string;

  // Compatibility Aliases
  field_name?: string;
  created_at?: string;
  corrected_by?: string;
}

export interface MonthlyPerformancePayrollSync {
  id: string;
  tenant_id: string;
  period_key: string; // e.g. "2026-08"
  status: 'OPEN' | 'REVIEWED' | 'FINALIZED' | 'SYNCED_TO_PAYROLL';
  total_riders_evaluated: number;
  total_deliveries: number;
  total_incentives_payable_aed: number;
  total_penalties_deductible_aed: number;
  net_payout_aed: number;
  is_payroll_locked: boolean;
  synced_payroll_period_id?: string;
  synced_at?: string;
  synced_by?: string;
  rules_applied_summary: {
    ruleName: string;
    beneficiariesCount: number;
    totalAmountAED: number;
  }[];
}

export type ProjectPerformanceConfig = DbProjectPerformanceConfig;

export interface PerformanceAiDiagnostic {
  analysis: string;
  contributingFactors: string[];
  actionableSuggestions: string[];
  recommendedProjectMatch?: string;
}

