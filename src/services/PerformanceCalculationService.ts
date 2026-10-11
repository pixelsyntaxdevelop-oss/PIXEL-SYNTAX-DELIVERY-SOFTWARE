/**
 * Centralized Performance Calculation Service
 * Single Source of Truth for KPI formulas, Weighted Scoring,
 * Multi-Project Aggregations, Exceptions, and Incentive Calculations.
 */

import {
  DbProjectPerformanceConfig,
  DbRiderDailyPerformance,
  PerformanceIncentiveRule,
  PerformancePenaltyRule,
  PerformanceScoreCategory,
  PerformanceScoringWeights,
  RiderPerformanceSummary,
  PerformanceException,
  DeliveryPlatform,
} from '../types/performance';
import { DbMasterEmployee } from '../types/database';

export const DEFAULT_SCORING_WEIGHTS: PerformanceScoringWeights = {
  deliveriesVsTarget: 35,
  attendanceRate: 20,
  loginHours: 15,
  acceptanceRate: 10,
  completionRate: 15,
  customerRating: 5,
};

export class PerformanceCalculationService {
  /**
   * Calculate 0-100 Performance Score with dynamic weight re-normalization
   * Allows projects with null/optional metrics without penalty.
   */
  static calculateDailyScore(
    record: Partial<DbRiderDailyPerformance>,
    config?: Partial<DbProjectPerformanceConfig>
  ): {
    score: number;
    category: PerformanceScoreCategory;
    targetAchievementRate: number;
    deliveriesPerHour: number;
  } {
    const dailyTarget = config?.daily_delivery_target || 20;
    const minHours = config?.min_daily_login_hours || 8.0;
    const minAcceptance = config?.min_acceptance_rate || 90;
    const minCompletion = config?.min_completion_rate || 95;
    const weights = config?.scoring_weights || DEFAULT_SCORING_WEIGHTS;

    const deliveries = record.orders_completed ?? record.deliveries ?? 0;
    const loginHours = record.login_hours ?? record.online_hours ?? 0;
    const acceptance = record.acceptance_rate;
    const completion = record.completion_rate;
    const rating = record.customer_rating;
    const isPresent = record.attendance_status === 'PRESENT' || record.attendance_status === 'OFFICIAL_VISIT';

    // 1. Deliveries vs Target Score (Capped at 120% efficiency)
    const targetAchievement = dailyTarget > 0 ? (deliveries / dailyTarget) * 100 : 100;
    const deliveriesSubScore = Math.min(100, (targetAchievement / 100) * 100);

    // 2. Attendance SubScore
    const attendanceSubScore = isPresent ? 100 : record.attendance_status === 'HALF_DAY' ? 50 : 0;

    // 3. Login Hours SubScore
    const hoursSubScore = minHours > 0 ? Math.min(100, (loginHours / minHours) * 100) : 100;

    // 4. Acceptance Rate SubScore
    let acceptanceSubScore: number | null = null;
    if (acceptance !== undefined && acceptance !== null) {
      acceptanceSubScore = minAcceptance > 0 ? Math.min(100, (acceptance / minAcceptance) * 100) : 100;
    }

    // 5. Completion Rate SubScore
    let completionSubScore: number | null = null;
    if (completion !== undefined && completion !== null) {
      completionSubScore = minCompletion > 0 ? Math.min(100, (completion / minCompletion) * 100) : 100;
    }

    // 6. Rating SubScore (1-5 scaled to 0-100)
    let ratingSubScore: number | null = null;
    if (rating !== undefined && rating !== null && rating > 0) {
      ratingSubScore = Math.min(100, (rating / 5.0) * 100);
    }

    // Rescale active weights
    let totalActiveWeight = weights.deliveriesVsTarget + weights.attendanceRate + weights.loginHours;
    let weightedSum =
      deliveriesSubScore * weights.deliveriesVsTarget +
      attendanceSubScore * weights.attendanceRate +
      hoursSubScore * weights.loginHours;

    if (acceptanceSubScore !== null) {
      totalActiveWeight += weights.acceptanceRate;
      weightedSum += acceptanceSubScore * weights.acceptanceRate;
    }
    if (completionSubScore !== null) {
      totalActiveWeight += weights.completionRate;
      weightedSum += completionSubScore * weights.completionRate;
    }
    if (ratingSubScore !== null) {
      totalActiveWeight += weights.customerRating;
      weightedSum += ratingSubScore * weights.customerRating;
    }

    const finalScore = totalActiveWeight > 0 ? Math.round(weightedSum / totalActiveWeight) : 0;
    const boundedScore = Math.max(0, Math.min(100, finalScore));

    const category = this.getScoreCategory(boundedScore);
    const deliveriesPerHour = loginHours > 0 ? Number((deliveries / loginHours).toFixed(2)) : 0;

    return {
      score: boundedScore,
      category,
      targetAchievementRate: Number(targetAchievement.toFixed(1)),
      deliveriesPerHour,
    };
  }

  /**
   * Determine Score Category
   */
  static getScoreCategory(score: number): PerformanceScoreCategory {
    if (score >= 90) return 'EXCELLENT';
    if (score >= 75) return 'GOOD';
    if (score >= 60) return 'AVERAGE';
    if (score >= 45) return 'NEEDS_ATTENTION';
    return 'CRITICAL';
  }

  /**
   * Calculate Estimated Daily / Monthly Incentives and Penalties
   */
  static calculateIncentives(
    deliveries: number,
    acceptanceRate: number = 100,
    cancellationRate: number = 0,
    config?: Partial<DbProjectPerformanceConfig>,
    perDeliveryRate: number = 0
  ): {
    incentiveAED: number;
    penaltyAED: number;
    netIncentiveAED: number;
    breakdown: string[];
  } {
    let incentiveAED = 0;
    let penaltyAED = 0;
    const breakdown: string[] = [];

    // 1. Base per-delivery commission if applicable
    if (perDeliveryRate > 0) {
      const baseComm = deliveries * perDeliveryRate;
      incentiveAED += baseComm;
      breakdown.push(`Base Deliveries (${deliveries} drops @ AED ${perDeliveryRate}): +AED ${baseComm.toFixed(2)}`);
    }

    // 2. Project Tiered Incentive Rules
    if (config?.incentive_rules) {
      for (const rule of config.incentive_rules) {
        if (!rule.isActive) continue;

        if (rule.ruleType === 'DELIVERY_TIER' && rule.tiers) {
          for (const tier of rule.tiers) {
            if (
              deliveries >= tier.minDeliveries &&
              (tier.maxDeliveries === undefined || deliveries <= tier.maxDeliveries)
            ) {
              incentiveAED += tier.bonusAmountAED;
              breakdown.push(`Tier Bonus (${tier.label}): +AED ${tier.bonusAmountAED}`);
              break;
            }
          }
        } else if (rule.ruleType === 'ACCEPTANCE_BONUS' && rule.minAcceptanceRate) {
          if (acceptanceRate >= rule.minAcceptanceRate) {
            incentiveAED += rule.bonusAmountAED;
            breakdown.push(`High Acceptance Bonus (>=${rule.minAcceptanceRate}%): +AED ${rule.bonusAmountAED}`);
          }
        }
      }
    }

    // 3. Project Penalty Rules
    if (config?.penalty_rules) {
      for (const rule of config.penalty_rules) {
        if (!rule.isActive) continue;

        if (rule.penaltyType === 'CANCELLATION_THRESHOLD' && rule.thresholdPercent) {
          if (cancellationRate > rule.thresholdPercent) {
            penaltyAED += rule.penaltyAmountAED;
            breakdown.push(`High Cancellation Penalty (>${rule.thresholdPercent}%): -AED ${rule.penaltyAmountAED}`);
          }
        }
      }
    }

    const netIncentiveAED = Math.max(0, incentiveAED - penaltyAED);

    return {
      incentiveAED: Math.round(incentiveAED * 100) / 100,
      penaltyAED: Math.round(penaltyAED * 100) / 100,
      netIncentiveAED: Math.round(netIncentiveAED * 100) / 100,
      breakdown,
    };
  }

  /**
   * Aggregate Performance for a single Rider over a set of daily records
   */
  static aggregateRiderPerformance(
    employee: DbMasterEmployee,
    dailyRecords: DbRiderDailyPerformance[],
    configMap: Map<string, DbProjectPerformanceConfig>,
    periodLabel: string = 'Current Month'
  ): RiderPerformanceSummary {
    const totalDays = dailyRecords.length;
    const presentDays = dailyRecords.filter(
      (r) => r.attendance_status === 'PRESENT' || r.attendance_status === 'OFFICIAL_VISIT'
    ).length;
    const absentDays = dailyRecords.filter(
      (r) => r.attendance_status === 'ABSENT' || r.attendance_status === 'NO_SHOW'
    ).length;
    const leaveDays = dailyRecords.filter(
      (r) => r.attendance_status === 'LEAVE' || r.attendance_status === 'SICK_LEAVE'
    ).length;
    const weeklyOffDays = dailyRecords.filter((r) => r.attendance_status === 'WEEKLY_OFF').length;
    const workingDays = Math.max(1, totalDays - weeklyOffDays - leaveDays);

    const totalDeliveries = dailyRecords.reduce(
      (sum, r) => sum + (r.orders_completed || r.deliveries || 0),
      0
    );
    const totalOrdersAssigned = dailyRecords.reduce((sum, r) => sum + (r.orders_assigned || 0), 0);
    const totalOrdersCompleted = dailyRecords.reduce((sum, r) => sum + (r.orders_completed || 0), 0);
    const totalOrdersCancelled = dailyRecords.reduce((sum, r) => sum + (r.orders_cancelled || 0), 0);
    const totalLoginHours = dailyRecords.reduce((sum, r) => sum + (r.login_hours || 0), 0);
    const totalOnlineHours = dailyRecords.reduce((sum, r) => sum + (r.online_hours || 0), 0);

    const validAcceptanceRecords = dailyRecords.filter(
      (r) => r.acceptance_rate !== undefined && r.acceptance_rate !== null
    );
    const avgAcceptanceRate =
      validAcceptanceRecords.length > 0
        ? Number(
            (
              validAcceptanceRecords.reduce((sum, r) => sum + r.acceptance_rate, 0) /
              validAcceptanceRecords.length
            ).toFixed(1)
          )
        : 100;

    const validCompletionRecords = dailyRecords.filter(
      (r) => r.completion_rate !== undefined && r.completion_rate !== null
    );
    const avgCompletionRate =
      validCompletionRecords.length > 0
        ? Number(
            (
              validCompletionRecords.reduce((sum, r) => sum + r.completion_rate, 0) /
              validCompletionRecords.length
            ).toFixed(1)
          )
        : 100;

    const validCancellationRecords = dailyRecords.filter(
      (r) => r.cancellation_rate !== undefined && r.cancellation_rate !== null
    );
    const avgCancellationRate =
      validCancellationRecords.length > 0
        ? Number(
            (
              validCancellationRecords.reduce((sum, r) => sum + r.cancellation_rate, 0) /
              validCancellationRecords.length
            ).toFixed(1)
          )
        : 0;

    const validRatingRecords = dailyRecords.filter(
      (r) => r.customer_rating !== undefined && r.customer_rating !== null && r.customer_rating > 0
    );
    const avgCustomerRating =
      validRatingRecords.length > 0
        ? Number(
            (
              validRatingRecords.reduce((sum, r) => sum + (r.customer_rating || 0), 0) /
              validRatingRecords.length
            ).toFixed(2)
          )
        : 4.8;

    const avgDeliveriesPerDay = presentDays > 0 ? Number((totalDeliveries / presentDays).toFixed(1)) : 0;
    const avgDeliveriesPerHour =
      totalLoginHours > 0 ? Number((totalDeliveries / totalLoginHours).toFixed(2)) : 0;
    const avgLoginHoursPerDay = presentDays > 0 ? Number((totalLoginHours / presentDays).toFixed(1)) : 0;
    const attendanceRate = totalDays > 0 ? Number(((presentDays / (presentDays + absentDays || 1)) * 100).toFixed(1)) : 100;

    // Target Calculation based on current or dominant project config
    const currentProjId = employee.project_id || (employee as any).current_project_id || 'proj_talabat';
    const activeConfig = configMap.get(currentProjId);
    const dailyTarget = activeConfig?.daily_delivery_target || 20;
    const periodTarget = dailyTarget * (presentDays || workingDays);
    const targetAchievementRate =
      periodTarget > 0 ? Number(((totalDeliveries / periodTarget) * 100).toFixed(1)) : 100;

    // Combined Performance Score (Average of daily scores, or computed weighted)
    const validScores = dailyRecords.map((r) => r.performance_score).filter((s) => s > 0);
    const overallScore =
      validScores.length > 0
        ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
        : this.calculateDailyScore(
            {
              orders_completed: totalDeliveries,
              login_hours: totalLoginHours,
              acceptance_rate: avgAcceptanceRate,
              completion_rate: avgCompletionRate,
              customer_rating: avgCustomerRating,
              attendance_status: presentDays > 0 ? 'PRESENT' : 'ABSENT',
            },
            {
              daily_delivery_target: periodTarget,
              min_daily_login_hours: (activeConfig?.min_daily_login_hours || 8) * (presentDays || 1),
            }
          ).score;

    const scoreCategory = this.getScoreCategory(overallScore);

    // Multi-Project Breakdown (e.g. Rider worked 10 days on Talabat, 5 days on Noon)
    const projectGroups = new Map<string, DbRiderDailyPerformance[]>();
    dailyRecords.forEach((r) => {
      const pid = r.project_id || 'unassigned';
      if (!projectGroups.has(pid)) projectGroups.set(pid, []);
      projectGroups.get(pid)!.push(r);
    });

    const projectBreakdowns = Array.from(projectGroups.entries()).map(([pid, recs]) => {
      const pConf = configMap.get(pid);
      const pName = recs[0]?.project_name || pConf?.project_name || 'Project Fleet';
      const pPlatform = recs[0]?.platform || pConf?.platform || 'CUSTOM';
      const pDays = recs.filter((r) => r.attendance_status === 'PRESENT').length || recs.length;
      const pDeliveries = recs.reduce((sum, r) => sum + (r.orders_completed || r.deliveries || 0), 0);
      const pHours = recs.reduce((sum, r) => sum + (r.login_hours || 0), 0);
      const pTarget = (pConf?.daily_delivery_target || 20) * pDays;
      const pAchieve = pTarget > 0 ? Math.round((pDeliveries / pTarget) * 100) : 100;
      const pScore =
        recs.length > 0
          ? Math.round(recs.reduce((sum, r) => sum + r.performance_score, 0) / recs.length)
          : 80;

      return {
        projectId: pid,
        projectName: pName,
        platform: pPlatform as DeliveryPlatform,
        daysWorked: pDays,
        deliveries: pDeliveries,
        loginHours: pHours,
        targetAchievementRate: pAchieve,
        performanceScore: pScore,
      };
    });

    // Financial estimations
    const totalIncentives = dailyRecords.reduce(
      (sum, r) => sum + (r.estimated_daily_incentive_aed || 0),
      0
    );
    const totalPenalties = dailyRecords.reduce(
      (sum, r) => sum + (r.estimated_daily_penalty_aed || 0),
      0
    );

    // Detect exceptions for this rider
    const exceptions = this.detectRiderExceptions(
      employee,
      {
        totalDeliveries,
        periodTarget,
        targetAchievementRate,
        avgLoginHoursPerDay,
        minLoginHours: activeConfig?.min_daily_login_hours || 8,
        absentDays,
        avgAcceptanceRate,
        minAcceptanceRate: activeConfig?.min_acceptance_rate || 90,
        avgCompletionRate,
        minCompletionRate: activeConfig?.min_completion_rate || 95,
        avgCancellationRate,
        maxCancellationRate: activeConfig?.max_cancellation_rate || 3,
        overallScore,
      },
      activeConfig
    );

    return {
      employeeId: employee.id,
      employeeCode: employee.employee_code || `RD-${employee.id}`,
      employeeName: employee.full_name,
      designation: employee.designation || 'Bike Rider',
      currentProjectId: employee.project_id || (employee as any).current_project_id,
      currentProjectName: employee.project_name || 'General Fleet',
      platform: (activeConfig?.platform || 'TALABAT') as DeliveryPlatform,
      branchId: employee.branch_id,
      branchName: (employee as any).branch_name,
      photo: employee.photo || (employee as any).profile_photo_url,
      bikePlate: employee.current_bike_plate,
      simNumber: employee.current_sim_number,
      supervisorName: employee.manager_name || (employee as any).supervisor_name,

      period: 'MONTH',
      startDate: dailyRecords[0]?.performance_date || '',
      endDate: dailyRecords[dailyRecords.length - 1]?.performance_date || '',
      totalDays,
      workingDays,
      presentDays,
      absentDays,
      leaveDays,
      weeklyOffDays,

      totalDeliveries,
      totalOrdersAssigned,
      totalOrdersCompleted,
      totalOrdersCancelled,
      totalLoginHours: Number(totalLoginHours.toFixed(1)),
      totalOnlineHours: Number(totalOnlineHours.toFixed(1)),

      avgDeliveriesPerDay,
      avgDeliveriesPerHour,
      avgLoginHoursPerDay,
      avgAcceptanceRate,
      avgCompletionRate,
      avgCancellationRate,
      avgCustomerRating,
      attendanceRate,

      deliveryTarget: periodTarget,
      targetAchievementRate,

      performanceScore: overallScore,
      scoreCategory,

      estimatedIncentiveAED: totalIncentives,
      estimatedPenaltyAED: totalPenalties,
      netPerformanceBonusAED: Math.max(0, totalIncentives - totalPenalties),

      projectBreakdowns,

      hasActiveExceptions: exceptions.length > 0,
      exceptionCount: exceptions.length,
      exceptions,

      dailyRecords,
    };
  }

  /**
   * Automatic Exception Detection Engine (Exception-First Operations UX)
   */
  static detectRiderExceptions(
    employee: DbMasterEmployee,
    metrics: {
      totalDeliveries: number;
      periodTarget: number;
      targetAchievementRate: number;
      avgLoginHoursPerDay: number;
      minLoginHours: number;
      absentDays: number;
      avgAcceptanceRate: number;
      minAcceptanceRate: number;
      avgCompletionRate: number;
      minCompletionRate: number;
      avgCancellationRate: number;
      maxCancellationRate: number;
      overallScore: number;
    },
    config?: Partial<DbProjectPerformanceConfig>
  ): PerformanceException[] {
    const exceptions: PerformanceException[] = [];
    const now = new Date().toISOString();

    // 1. Critical Delivery Shortfall (< 60% of Target)
    if (metrics.targetAchievementRate < 60 && metrics.periodTarget > 0) {
      exceptions.push({
        id: `exc_deliv_${employee.id}_${Date.now()}`,
        type: 'LOW_DELIVERIES',
        severity: metrics.targetAchievementRate < 40 ? 'CRITICAL' : 'HIGH',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `Severe Delivery Shortfall (${metrics.targetAchievementRate}% of Target)`,
        description: `Rider completed only ${metrics.totalDeliveries} deliveries against expected target of ${metrics.periodTarget} for this period.`,
        currentMetricValue: `${metrics.totalDeliveries} Drops (${metrics.targetAchievementRate}%)`,
        expectedThreshold: `>= ${metrics.periodTarget} Drops`,
        impact: `Lost platform incentives, lower fleet service level agreement (SLA) with ${employee.project_name || 'Client'}.`,
        suggestedAction: `Review route allocation, check bike mechanical condition, or schedule 1-on-1 operational coaching.`,
        actionType: 'COACHING_NOTE',
        createdAt: now,
      });
    }

    // 2. Low Daily Login Hours
    if (metrics.avgLoginHoursPerDay < metrics.minLoginHours && metrics.avgLoginHoursPerDay > 0) {
      exceptions.push({
        id: `exc_hours_${employee.id}_${Date.now()}`,
        type: 'LOW_LOGIN_HOURS',
        severity: metrics.avgLoginHoursPerDay < metrics.minLoginHours * 0.75 ? 'HIGH' : 'MEDIUM',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `Low Average Shift Hours (${metrics.avgLoginHoursPerDay} hrs/day)`,
        description: `Average daily active hours (${metrics.avgLoginHoursPerDay} hrs) falls below project mandatory threshold (${metrics.minLoginHours} hrs).`,
        currentMetricValue: `${metrics.avgLoginHoursPerDay} hrs/day`,
        expectedThreshold: `>= ${metrics.minLoginHours} hrs/day`,
        impact: `Underutilization of assigned fleet asset and SIM card data quota.`,
        suggestedAction: `Verify biometric clock-ins and investigate early disconnect reasons with field supervisor.`,
        actionType: 'CONTACT_RIDER',
        createdAt: now,
      });
    }

    // 3. Repeated Absences / High Unexcused Absence
    if (metrics.absentDays >= 3) {
      exceptions.push({
        id: `exc_abs_${employee.id}_${Date.now()}`,
        type: 'HIGH_ABSENCE',
        severity: metrics.absentDays >= 5 ? 'CRITICAL' : 'HIGH',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `High Unexcused Absences (${metrics.absentDays} Days)`,
        description: `Rider has accumulated ${metrics.absentDays} unexcused absent days in current operational period.`,
        currentMetricValue: `${metrics.absentDays} Absences`,
        expectedThreshold: `0 - 1 Max Days`,
        impact: `Salary wage deductions and disruption of scheduled delivery zone coverage.`,
        suggestedAction: `Initiate HR warning notice or check for medical emergencies / unauthorized leaves.`,
        actionType: 'COACHING_NOTE',
        createdAt: now,
      });
    }

    // 4. Low Acceptance Rate
    if (metrics.avgAcceptanceRate < metrics.minAcceptanceRate) {
      exceptions.push({
        id: `exc_acc_${employee.id}_${Date.now()}`,
        type: 'LOW_ACCEPTANCE',
        severity: 'MEDIUM',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `Low Order Acceptance Rate (${metrics.avgAcceptanceRate}%)`,
        description: `Rider is rejecting incoming platform dispatch orders, causing customer dispatch delays.`,
        currentMetricValue: `${metrics.avgAcceptanceRate}%`,
        expectedThreshold: `>= ${metrics.minAcceptanceRate}%`,
        impact: `Platform dispatch algorithms de-prioritize rider, lowering total earnings.`,
        suggestedAction: `Check if rider has phone battery/connectivity issues in current delivery zone.`,
        actionType: 'CONTACT_RIDER',
        createdAt: now,
      });
    }

    // 5. High Cancellation Rate
    if (metrics.avgCancellationRate > metrics.maxCancellationRate) {
      exceptions.push({
        id: `exc_canc_${employee.id}_${Date.now()}`,
        type: 'HIGH_CANCELLATION',
        severity: 'HIGH',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `Elevated Order Cancellation (${metrics.avgCancellationRate}%)`,
        description: `Cancellation percentage exceeds platform safety tolerance (${metrics.maxCancellationRate}%).`,
        currentMetricValue: `${metrics.avgCancellationRate}%`,
        expectedThreshold: `<= ${metrics.maxCancellationRate}%`,
        impact: `Incurs merchant partner penalty deductions and potential captain account suspension.`,
        suggestedAction: `Audit cancellation reasons (customer unreachable, wrong address, merchant delay).`,
        actionType: 'COACHING_NOTE',
        createdAt: now,
      });
    }

    // 6. Operational Asset Alignment (Missing Bike or SIM)
    if (!employee.current_bike_id && !employee.current_bike_plate) {
      exceptions.push({
        id: `exc_bike_${employee.id}_${Date.now()}`,
        type: 'MISSING_BIKE',
        severity: 'HIGH',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `No Active Vehicle / Bike Assigned`,
        description: `Rider profile is marked as Active on ${employee.project_name || 'Fleet'} but has no assigned motorcycle plate in system.`,
        currentMetricValue: `Unassigned`,
        expectedThreshold: `1 Active Vehicle`,
        impact: `Rider cannot fulfill delivery dispatches legally.`,
        suggestedAction: `Assign available motorcycle from fleet inventory.`,
        actionType: 'REASSIGN_BIKE',
        createdAt: now,
      });
    }

    if (!employee.current_sim_id && !employee.current_sim_number) {
      exceptions.push({
        id: `exc_sim_${employee.id}_${Date.now()}`,
        type: 'MISSING_SIM',
        severity: 'MEDIUM',
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.full_name,
        projectId: employee.project_id,
        projectName: employee.project_name,
        title: `No Active SIM Card Assigned`,
        description: `Rider has no company telecommunication SIM card registered for GPS and dispatch.`,
        currentMetricValue: `Unassigned`,
        expectedThreshold: `1 Active SIM`,
        impact: `Risk of disconnected tracking and dispatch blind spots.`,
        suggestedAction: `Issue corporate SIM from telecommunications inventory.`,
        actionType: 'REASSIGN_SIM',
        createdAt: now,
      });
    }

    return exceptions;
  }
}
