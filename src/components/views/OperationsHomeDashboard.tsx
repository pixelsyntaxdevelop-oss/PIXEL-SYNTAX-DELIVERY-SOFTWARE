import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Briefcase,
  Stamp,
  Smartphone,
  Truck,
  DollarSign,
  AlertTriangle,
  FileText,
  Clock,
  CheckCircle2,
  ChevronRight,
  Plus,
  ArrowRightLeft,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Info,
  X,
} from 'lucide-react';
import { masterEmployeeService } from '../../services/masterEmployeeService';
import { NavigationModule, SystemUserAccount } from '../../types/erp';
import { apiClient } from '../../services/apiClient';
import { resolveCanonicalStatus } from '../../utils/canonicalStatus';
import { translations, LanguageMode } from '../../data/translations';

// Format monetary KPI totals for the selected language without changing stored amounts.
const formatKpiCurrencyAmount = (amount: number, lang: LanguageMode): string =>
  new Intl.NumberFormat(lang === 'AR' ? 'ar-AE' : 'en-AE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// Spell out whole dirhams and fractional fils for assistive technology.
// Round to the same two decimals as the visual amount before splitting units.
const formatKpiCurrencyForScreenReader = (amount: number, lang: LanguageMode): string => {
  if (!Number.isFinite(amount)) return `${formatKpiCurrencyAmount(amount, lang)} ${translations[lang].kpiCurrencyAedAccessible}`;
  const roundedFils = Math.round((Math.abs(amount) + Number.EPSILON) * 100);
  const dirhams = Math.trunc(roundedFils / 100);
  const fils = roundedFils % 100;
  const numberFormatter = new Intl.NumberFormat(lang === 'AR' ? 'ar-AE' : 'en-AE', { maximumFractionDigits: 0 });
  const whole = `${numberFormatter.format(dirhams)} ${translations[lang].kpiCurrencyAedAccessible}`;
  const spokenAmount = fils === 0 ? whole : `${whole} ${translations[lang].kpiCurrencyAmountAnd} ${numberFormatter.format(fils)} ${translations[lang].kpiCurrencyFilsAccessible}`;
  return amount < 0 && roundedFils !== 0 ? `${translations[lang].kpiCurrencyNegative} ${spokenAmount}` : spokenAmount;
};

// Localize known payroll month labels for display without changing API period values.
const formatKpiPayrollMonth = (period: string, lang: LanguageMode): string => {
  if (lang !== 'AR') return period;
  if (period.trim().toLowerCase() === 'no active period') return translations[lang].kpiPayrollNoActivePeriod;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const named = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i.exec(period.trim());
  const numeric = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period.trim());
  const monthIndex = named ? monthNames.findIndex((month) => month.toLowerCase() === named[1].toLowerCase()) : numeric ? Number(numeric[2]) - 1 : -1;
  if (monthIndex < 0) return period;
  const year = named ? Number(named[2]) : Number(numeric![1]);
  return new Intl.DateTimeFormat('ar-AE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, monthIndex, 1)));
};

// Presentation-only count labels; the underlying fine totals are unchanged.
const formatKpiFineCount = (count: number, lang: LanguageMode): string => {
  if (lang !== 'AR') return `${count} ${translations[lang].kpiFinesCountUnit}`;

  const category = new Intl.PluralRules('ar').select(count);
  const unit = category === 'one'
    ? translations[lang].kpiFinesCountSingular
    : category === 'two'
      ? translations[lang].kpiFinesCountDual
      : category === 'zero' || category === 'few'
        ? translations[lang].kpiFinesCountUnit
        : translations[lang].kpiFinesCountSingular;
  return `${count} ${unit}`;
};

interface KpiHelpLabelProps {
  id: string;
  lang: LanguageMode;
  label: React.ReactNode;
  description: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const KpiHelpLabel: React.FC<KpiHelpLabelProps> = ({ id, lang, label, description, isOpen, onToggle, onClose }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const helpContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const dismissOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !helpContainerRef.current?.contains(event.target)) {
        onClose();
      }
    };

    const dismissOnOutsideFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !helpContainerRef.current?.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    document.addEventListener("focusin", dismissOnOutsideFocus);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
      document.removeEventListener("focusin", dismissOnOutsideFocus);
    };
  }, [isOpen, onClose]);

  return (
  <div ref={helpContainerRef} className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
    <span className="min-w-0 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
    <button
      ref={triggerRef}
      type="button"
      aria-label={translations[lang].aboutKpiHelp.replace('{label}', typeof label === 'string' ? label : 'KPI')}
      aria-expanded={isOpen}
      aria-controls={`kpi-help-${id}`}
      aria-describedby={isOpen ? `kpi-help-${id}` : undefined}
      onClick={(event) => { event.stopPropagation(); onToggle(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.stopPropagation();
          onClose();
          triggerRef.current?.focus();
        }
      }}
      className="inline-flex min-h-11 min-w-11 sm:min-h-9 sm:min-w-9 shrink-0 touch-manipulation items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700 focus-visible:outline-none focus-visible:bg-blue-50 focus-visible:text-blue-800 focus-visible:ring-4 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:bg-slate-800 dark:focus-visible:text-blue-200 dark:focus-visible:ring-blue-300/80 dark:focus-visible:ring-offset-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-300"
    >
      <Info className="h-4 w-4" aria-hidden="true" />
    </button>
    {isOpen && (
      <div
        id={`kpi-help-${id}`}
        role="note"
        aria-live="polite"
        aria-atomic="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            triggerRef.current?.focus();
          }
        }}
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-x-0 top-full z-20 mt-2 w-full max-w-64 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-3 text-left text-sm sm:text-xs font-normal normal-case leading-6 sm:leading-relaxed break-words tracking-normal text-slate-800 shadow-lg focus-visible:outline-none focus-visible:border-blue-600 focus-visible:ring-4 focus-visible:ring-blue-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus-visible:border-blue-300 dark:focus-visible:ring-blue-300/70 dark:focus-visible:ring-offset-slate-900"
      >
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1">{description}</span>
          <button
            type="button"
            aria-label={translations[lang].closeKpiHelpFor.replace('{label}', typeof label === 'string' ? label : 'KPI')}
            aria-describedby={`kpi-help-close-hint-${id}`}
            title={translations[lang].closeKpiHelp}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
              triggerRef.current?.focus();
            }}
            className="inline-flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors duration-150 motion-reduce:transition-none hover:bg-blue-100 hover:text-blue-800 active:bg-blue-200 active:text-blue-900 active:ring-2 active:ring-inset active:ring-blue-600/50 focus-visible:outline-none focus-visible:bg-blue-50 focus-visible:text-blue-800 focus-visible:ring-4 focus-visible:ring-blue-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-300 dark:hover:bg-blue-900/60 dark:hover:text-blue-100 dark:active:bg-blue-900 dark:active:text-white dark:active:ring-blue-300/60 dark:focus-visible:bg-slate-700 dark:focus-visible:text-blue-100 dark:focus-visible:ring-blue-300/80 dark:focus-visible:ring-offset-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
          <span id={`kpi-help-close-hint-${id}`} className="sr-only">{translations[lang].closeKpiHelpHint}</span>
        </div>
      </div>
    )}
  </div>
  );
};

interface OperationsHomeDashboardProps {
  onNavigateModule: (module: NavigationModule) => void;
  onSelectEmployee?: (employeeId: string) => void;
  onOpenQuickAction?: (actionType: string) => void;
  currentUser?: SystemUserAccount;
  lang?: 'EN' | 'AR';
}

export const OperationsHomeDashboard: React.FC<OperationsHomeDashboardProps> = ({
  onNavigateModule,
  onSelectEmployee,
  onOpenQuickAction,
  currentUser,
  lang = 'EN',
}) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedSuccessfully, setHasLoadedSuccessfully] = useState(false);
  const [openKpiHelp, setOpenKpiHelp] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'HR' | 'FLEET' | 'OPERATIONS' | 'ACCOUNTS'>('ALL');

  // Live Metric State
  const [metrics, setMetrics] = useState({
    employees: { total: 0, active: 0, available: 0, onLeave: 0, exited: 0 },
    projects: { list: [] as Array<{ name: string; count: number }>, availableRiders: 0 },
    passports: { withCompany: 0, withRider: 0, expiring: 0 },
    sims: { total: 0, available: 0, assigned: 0, lost: 0 },
    fleet: { total: 0, available: 0, assigned: 0, garage: 0, expiringMulkiya: 0 },
    payroll: { currentMonth: 'August 2026', totalAmount: 0, status: 'APPROVED', needsReviewCount: 0 },
    fines: { newFines: 0, payrollLinked: 0, totalAmount: 0 },
  });

  // Central Exceptions State
  const [exceptions, setExceptions] = useState<Array<{
    id: string;
    type: 'EID_MISSING' | 'PASSPORT_EXPIRING' | 'PASSPORT_OVERDUE' | 'NO_SIM' | 'NO_BIKE' | 'VEHICLE_EXPIRING' | 'GARAGE_LONG' | 'FINE_CONFIRM' | 'PAYROLL_MISMATCH' | 'EXIT_CLEARANCE' | 'DOC_MISSING';
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    title: string;
    subtitle: string;
    entityId?: string;
    entityType: 'employee' | 'vehicle' | 'sim' | 'fine' | 'payroll' | 'passport';
    targetModule: NavigationModule;
    actionLabel: string;
  }>>([]);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);

      // Fetch Consolidated Stats
      let statsData: any = null;
      try {
        const statsRes = await apiClient.get<any>('/api/erp/dashboard/stats');
        if (statsRes?.data?.success) {
          statsData = statsRes.data;
        }
      } catch (err) {
        // Fallback to separate loaders if needed
      }

      // Fetch Authoritative SIM Dashboard Stats as fallback/guarantee
      let simStatsData: any = null;
      try {
        const simDashRes = await apiClient.get<any>('/api/erp/sims/dashboard');
        if (simDashRes?.data) {
          simStatsData = simDashRes.data;
        }
      } catch (err) {}

      // Fetch Employees for list & exceptions
      const employees = await masterEmployeeService.getMasterEmployees();
      const activeEmps = employees.filter((e) => resolveCanonicalStatus(e.current_status) === 'Assigned / Active');
      const availEmps = employees.filter((e) => resolveCanonicalStatus(e.current_status) === 'Available / Unassigned');
      const onLeaveEmps = employees.filter((e) => resolveCanonicalStatus(e.current_status) === 'On Leave');
      const exitedEmps = employees.filter(
        (e) => resolveCanonicalStatus(e.current_status) === 'Terminated' || resolveCanonicalStatus(e.current_status) === 'Exited'
      );

      // Fetch Fleet for exceptions
      let vehicles: any[] = [];
      try {
        const vRes = await apiClient.get<any[]>('/api/erp/fleet/vehicles');
        vehicles = Array.isArray(vRes?.data) ? vRes.data : [];
      } catch (err) {}

      // Fetch SIMs
      let sims: any[] = [];
      try {
        const sRes = await apiClient.get<any[]>('/api/erp/sims');
        sims = Array.isArray(sRes?.data) ? sRes.data : [];
      } catch (err) {}

      // Fetch Passports
      let passports: any[] = [];
      try {
        const pRes = await apiClient.get<any[]>('/api/erp/passports');
        passports = Array.isArray(pRes?.data) ? pRes.data : [];
      } catch (err) {}

      // Fetch Fines
      let fines: any[] = [];
      try {
        const fRes = await apiClient.get<any[]>('/api/erp/traffic-fines');
        fines = Array.isArray(fRes?.data) ? fRes.data : [];
      } catch (err) {}

      // Project breakdown
      const projectCounts: Record<string, number> = {};
      employees.forEach((e) => {
        const pName = e.project_name || 'Unassigned';
        projectCounts[pName] = (projectCounts[pName] || 0) + 1;
      });
      const projList = Object.entries(projectCounts).map(([name, count]) => ({ name, count }));

      if (statsData) {
        setMetrics({
          employees: {
            total: statsData.employees.total,
            active: statsData.employees.active,
            available: statsData.employees.available,
            onLeave: statsData.employees.onLeave,
            exited: statsData.employees.exited,
          },
          projects: {
            list: statsData.employees.projects?.length > 0 ? statsData.employees.projects : projList,
            availableRiders: statsData.employees.available,
          },
          passports: {
            withCompany: statsData.passports.withCompany,
            withRider: statsData.passports.withRider,
            expiring: 0,
          },
          sims: {
            total: statsData.sims?.total ?? simStatsData?.totalSims ?? 0,
            available: statsData.sims?.available ?? simStatsData?.unassigned ?? simStatsData?.available ?? 0,
            assigned: statsData.sims?.assigned ?? simStatsData?.assigned ?? 0,
            lost: statsData.sims?.lost ?? simStatsData?.lost ?? 0,
          },
          fleet: {
            total: statsData.vehicles.total,
            available: statsData.vehicles.available,
            assigned: statsData.vehicles.assigned,
            garage: statsData.vehicles.garage,
            expiringMulkiya: 0,
          },
          payroll: {
            currentMonth: statsData.payroll?.currentMonth || 'No Active Period',
            totalAmount: Number(statsData.payroll?.totalAmount) || 0,
            status: statsData.payroll?.status || 'NO_DATA',
            needsReviewCount: Number(statsData.payroll?.needsReviewCount) || 0,
          },
          fines: {
            newFines: statsData.fines.pending,
            payrollLinked: statsData.fines.payrollLinked,
            totalAmount: statsData.fines.totalAmountAED,
          },
        });
      } else {
        const availVehicles = vehicles.filter((v) => v.status === 'AVAILABLE' || v.status === 'Available');
        const assignedVehicles = vehicles.filter((v) => v.status === 'ASSIGNED' || v.status === 'Assigned' || v.status === 'IN_USE');
        const garageVehicles = vehicles.filter((v) => v.status === 'GARAGE' || v.status === 'MAINTENANCE');

        const availSims = sims.filter((s) => s.status === 'Available' || s.status === 'AVAILABLE');
        const assignedSims = sims.filter((s) => s.status === 'Assigned' || s.status === 'ASSIGNED');
        const lostSims = sims.filter((s) => s.status === 'Lost' || s.status === 'LOST');

        const withCompanyPassports = passports.filter((p) => p.status === 'WITH_COMPANY' || p.status === 'ACTIVE' || p.status === 'STORED');
        const withRiderPassports = passports.filter((p) => p.status === 'WITH_RIDER' || p.status === 'TEMPORARILY_RELEASED' || p.status === 'RETURNED_TO_RIDER');

        const pendingFines = fines.filter((f) => f.status === 'PENDING' || f.status === 'NEW' || f.status === 'DISPUTED');
        const payrollLinkedFines = fines.filter((f) => f.payroll_period_id || f.status === 'PAYROLL_DEDUCTED' || f.status === 'LINKED_TO_PAYROLL');
        const totalFineAmount = fines.reduce((acc, f) => acc + (Number(f.total_amount) || Number(f.amount) || 0), 0);

        setMetrics({
          employees: {
            total: employees.length,
            active: activeEmps.length,
            available: availEmps.length,
            onLeave: onLeaveEmps.length,
            exited: exitedEmps.length,
          },
          projects: {
            list: projList,
            availableRiders: availEmps.length,
          },
          passports: {
            withCompany: withCompanyPassports.length,
            withRider: withRiderPassports.length,
            expiring: 0,
          },
          sims: {
            total: simStatsData?.totalSims ?? (sims.length || 0),
            available: simStatsData?.unassigned ?? simStatsData?.available ?? availSims.length,
            assigned: simStatsData?.assigned ?? assignedSims.length,
            lost: simStatsData?.lost ?? lostSims.length,
          },
          fleet: {
            total: vehicles.length,
            available: availVehicles.length,
            assigned: assignedVehicles.length,
            garage: garageVehicles.length,
            expiringMulkiya: 0,
          },
          payroll: {
            currentMonth: 'No Active Period',
            totalAmount: 0,
            status: 'NO_DATA',
            needsReviewCount: 0,
          },
          fines: {
            newFines: pendingFines.length,
            payrollLinked: payrollLinkedFines.length,
            totalAmount: totalFineAmount,
          },
        });
      }

      // Compute Live Attention Required / Exceptions
      const computedExceptions: typeof exceptions = [];

      // 1. Employee without Emirates ID
      employees.forEach((emp) => {
        if (!emp.emirates_id_number || emp.emirates_id_number === 'N/A' || emp.emirates_id_number === '') {
          computedExceptions.push({
            id: `exc_eid_${emp.id}`,
            type: 'EID_MISSING',
            severity: 'CRITICAL',
            title: `Missing Emirates ID for ${emp.full_name}`,
            subtitle: `Employee ${emp.employee_code} (${emp.project_name || 'No Project'}) requires mandatory Emirates ID verification`,
            entityId: emp.id,
            entityType: 'employee',
            targetModule: 'riders_drivers',
            actionLabel: 'Update ID',
          });
        }
      });

      // 2. Active Rider with Project but no Bike assigned
      employees.forEach((emp) => {
        if ((emp.current_status === 'Active' || emp.current_status === 'Assigned') && !emp.current_bike_plate && !emp.current_bike_id) {
          computedExceptions.push({
            id: `exc_bike_${emp.id}`,
            type: 'NO_BIKE',
            severity: 'HIGH',
            title: `Active Rider without Bike: ${emp.full_name}`,
            subtitle: `Assigned to ${emp.project_name || 'Project'} but has no operational bike assigned`,
            entityId: emp.id,
            entityType: 'employee',
            targetModule: 'riders_drivers',
            actionLabel: 'Assign Bike',
          });
        }
      });

      // 3. Active Rider without SIM card
      employees.forEach((emp) => {
        if ((emp.current_status === 'Active' || emp.current_status === 'Assigned') && !emp.current_sim_number && !emp.current_sim_id) {
          computedExceptions.push({
            id: `exc_sim_${emp.id}`,
            type: 'NO_SIM',
            severity: 'MEDIUM',
            title: `Active Rider without SIM: ${emp.full_name}`,
            subtitle: `Rider ${emp.employee_code} needs an active company telecom SIM assigned`,
            entityId: emp.id,
            entityType: 'employee',
            targetModule: 'riders_drivers',
            actionLabel: 'Assign SIM',
          });
        }
      });

      // 4. Traffic fines needing rider review or payroll deduction
      fines.forEach((f) => {
        if (f.status === 'PENDING' || f.status === 'DISPUTED') {
          computedExceptions.push({
            id: `exc_fine_${f.id}`,
            type: 'FINE_CONFIRM',
            severity: 'HIGH',
            title: `Unresolved Fine: ${f.reference_number || f.ref_number || 'DXB-FINE'} (AED ${f.total_amount || f.amount || 500})`,
            subtitle: `Plate: ${f.plate_number || f.plate} | Assigned to ${f.employee_name || 'Rider'} | Requires payroll linking or dispute resolution`,
            entityId: f.id,
            entityType: 'fine',
            targetModule: 'traffic_fines_mgmt',
            actionLabel: 'Review Fine',
          });
        }
      });

      // 5. Vehicles in garage or expiring
      vehicles.forEach((v) => {
        if (v.status === 'GARAGE' || v.status === 'MAINTENANCE') {
          computedExceptions.push({
            id: `exc_garage_${v.id}`,
            type: 'GARAGE_LONG',
            severity: 'MEDIUM',
            title: `Bike in Garage: ${v.plate_number || v.plateNumber}`,
            subtitle: `${v.make || 'Yamaha'} ${v.model || 'FZ'} under maintenance at Al-Qouz Depot`,
            entityId: v.id,
            entityType: 'vehicle',
            targetModule: 'vehicles_fleet',
            actionLabel: 'Depot Status',
          });
        }
      });

      setExceptions(computedExceptions);
      setHasLoadedSuccessfully(true);
      setLoadError(false);
    } catch (err) {
      setLoadError(true);
      console.error('Failed to load dashboard operational data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const handleUpdate = () => {
      loadDashboardData();
    };
    window.addEventListener('erp:sims-updated', handleUpdate);
    window.addEventListener('erp:employees-updated', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    return () => {
      window.removeEventListener('erp:sims-updated', handleUpdate);
      window.removeEventListener('erp:employees-updated', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
    };
  }, []);

  const handleExceptionClick = (exc: (typeof exceptions)[0]) => {
    if (exc.entityId && exc.entityType === 'employee' && onSelectEmployee) {
      onSelectEmployee(exc.entityId);
    } else {
      onNavigateModule(exc.targetModule);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading operations dashboard" aria-busy="true">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Loading operations dashboard data…
        </p>
        <div className="animate-pulse motion-reduce:animate-none rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" aria-hidden="true">
          <div className="h-5 w-44 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 h-7 w-full max-w-sm rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-3 h-4 w-full max-w-xl rounded bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="animate-pulse motion-reduce:animate-none rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-5 h-8 w-20 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="mt-4 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          ))}
        </div>
        <div className="animate-pulse motion-reduce:animate-none rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" aria-hidden="true">
          <div className="h-4 w-52 max-w-full rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !hasLoadedSuccessfully) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-xs dark:border-rose-900 dark:bg-slate-900" role="alert">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">Dashboard data could not be loaded</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Operational figures are temporarily unavailable. Please try again.
        </p>
        <button type="button" onClick={loadDashboardData} disabled={refreshing}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? 'Retrying…' : 'Retry loading'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span>Dashboard refresh failed. Showing the last loaded figures.</span>
          <button type="button" onClick={loadDashboardData} disabled={refreshing}
            className="min-h-10 rounded-lg border border-amber-400 px-3 py-2 font-semibold hover:bg-amber-100 disabled:opacity-50 dark:hover:bg-amber-900/40">
            {refreshing ? 'Retrying…' : 'Retry refresh'}
          </button>
        </div>
      )}
      {/* Top Welcome Header & Quick Action Row */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              Operations Control Hub
            </span>
            <span className="text-xs text-slate-400 font-medium">Dubai & Northern Emirates</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Delivery Operations Command Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Live telemetry, active rider deployments, asset custody, vehicle compliance, and automated payroll operations.
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateModule('riders_drivers')}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Employee</span>
          </button>
          <button
            onClick={() => onNavigateModule('office_forms_passport')}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Stamp className="w-3.5 h-3.5 text-amber-500" />
            <span>Passport Custody</span>
          </button>
          <button
            onClick={() => onNavigateModule('sim_management')}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Smartphone className="w-3.5 h-3.5 text-sky-500" />
            <span>Assign SIM</span>
          </button>
          <button
            onClick={() => onNavigateModule('vehicles_fleet')}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Truck className="w-3.5 h-3.5 text-amber-600" />
            <span>Assign Bike</span>
          </button>
          <button
            onClick={() => onNavigateModule('traffic_fines_mgmt')}
            className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>+ Traffic Fine</span>
          </button>
          <div className="flex items-center gap-2">
            <span role="status" aria-live="polite" aria-atomic="true" className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {refreshing ? 'Refreshing dashboard…' : loadError ? 'Refresh failed' : hasLoadedSuccessfully ? 'Dashboard updated' : ''}
            </span>
            <button
              type="button"
              onClick={loadDashboardData}
              disabled={refreshing}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              title={refreshing ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
              aria-label={refreshing ? 'Refreshing dashboard data' : 'Refresh dashboard data'}
              aria-busy={refreshing}
            >
              <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Role Filter Chips */}
      <div
        role="group"
        aria-label="Filter dashboard by role"
        className="flex items-center gap-2 max-w-full overflow-x-auto overscroll-x-contain pb-2 text-xs"
      >
        <span className="shrink-0 text-slate-400 font-bold uppercase text-[10px] mr-1">Role View:</span>
        {(['ALL', 'HR', 'FLEET', 'OPERATIONS', 'ACCOUNTS'] as const).map((rf) => (
          <button
            key={rf}
            onClick={() => setRoleFilter(rf)}
            aria-pressed={roleFilter === rf}
            className={`shrink-0 min-h-[40px] px-3 py-2 rounded-full font-bold transition-all whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
              roleFilter === rf
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
            }`}
          >
            {rf === 'ALL' ? '🌟 All Operations' : rf}
          </button>
        ))}
      </div>

      {/* Section 1: ATTENTION REQUIRED / EXCEPTION CENTER (Prominent & Actionable) */}
      <div className="bg-amber-500/10 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-3 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <div className="flex min-w-0 items-start sm:items-center gap-2">
            <div className="w-7 h-7 bg-amber-500 text-slate-950 rounded-lg flex items-center justify-center font-black">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex flex-wrap items-center gap-2">
                <span>Attention Required & Operational Exceptions</span>
                <span className="inline-flex max-w-full items-center rounded-full px-2.5 py-1 sm:px-2 sm:py-0.5 bg-amber-500 text-slate-950 text-xs sm:text-[10px] leading-snug font-extrabold whitespace-normal">
                  {exceptions.length} Action Items
                </span>
              </h2>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
            Click or press Enter on an item to jump to resolution
          </span>
        </div>

        {exceptions.length === 0 ? (
          <div className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl text-center text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Zero pending exceptions! All employee IDs, asset custody, and fines are compliant.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {exceptions.map((exc) => (
              <div
                key={exc.id}
                role="link"
                tabIndex={0}
                aria-label={`${exc.severity.toLowerCase()} severity: ${exc.title}. Open ${exc.actionLabel}`}
                onClick={() => handleExceptionClick(exc)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleExceptionClick(exc);
                  }
                }}
                className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/80 shadow-xs cursor-pointer transition-all hover:shadow-md focus-visible:outline-none focus-visible:border-amber-700 focus-visible:ring-4 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:border-amber-300 dark:focus-visible:ring-amber-300/60 dark:focus-visible:ring-offset-slate-950 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded-md text-[10px] sm:text-[9px] font-black uppercase tracking-wider break-words ${
                        exc.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                          : exc.severity === 'HIGH'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      {exc.severity} · {exc.type.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs sm:text-[10px] font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 group-focus-visible:underline group-focus-visible:underline-offset-2 transition-transform flex items-center gap-0.5">
                      {exc.actionLabel}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-xs font-bold text-slate-900 dark:text-white leading-snug break-words">
                    {exc.title}
                  </h4>
                  <p className="text-xs sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed sm:line-clamp-2 break-words">
                    {exc.subtitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Core Operational KPIs (Live Backend Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. EMPLOYEES KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'HR' || roleFilter === 'OPERATIONS') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open Delivery Employees module"
            onClick={() => onNavigateModule('riders_drivers')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('riders_drivers');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="employees" label={translations[lang].kpiHeadingEmployees} description={translations[lang].kpiHelpEmployeesDescription} isOpen={openKpiHelp === 'employees'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'employees' ? null : 'employees')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1.75rem,7vw,2.25rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {metrics.employees.total}
            </div>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px] tabular-nums">
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownActive}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-emerald-600 dark:text-emerald-400">{metrics.employees.active}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownAvailable}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-blue-600 dark:text-blue-400">{metrics.employees.available}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownOnLeave}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-amber-600 dark:text-amber-400">{metrics.employees.onLeave}</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. FLEET BIKES KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'FLEET' || roleFilter === 'OPERATIONS') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open Fleet & Bikes module"
            onClick={() => onNavigateModule('vehicles_fleet')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('vehicles_fleet');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="fleet" label={translations[lang].kpiHeadingFleet} description={translations[lang].kpiHelpFleetDescription} isOpen={openKpiHelp === 'fleet'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'fleet' ? null : 'fleet')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1.75rem,7vw,2.25rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {metrics.fleet.total}
            </div>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px] tabular-nums">
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownAssigned}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-emerald-600 dark:text-emerald-400">{metrics.fleet.assigned}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownAvailable}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-blue-600 dark:text-blue-400">{metrics.fleet.available}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownGarage}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-amber-600 dark:text-amber-400">{metrics.fleet.garage}</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. SIM CARDS KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'OPERATIONS' || roleFilter === 'FLEET') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open SIM Inventory module"
            onClick={() => onNavigateModule('sim_management')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('sim_management');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-sky-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="sims" label={translations[lang].kpiHeadingSims} description={translations[lang].kpiHelpSimsDescription} isOpen={openKpiHelp === 'sims'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'sims' ? null : 'sims')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-xl group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Smartphone className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1.75rem,7vw,2.25rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {metrics.sims.total}
            </div>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px] tabular-nums">
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownAssigned}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-emerald-600 dark:text-emerald-400">{metrics.sims.assigned}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownAvailable}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-blue-600 dark:text-blue-400">{metrics.sims.available}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownLostFaulty}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-rose-600 dark:text-rose-400">{metrics.sims.lost}</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. PASSPORT CUSTODY KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'HR') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open Passport Custody module"
            onClick={() => onNavigateModule('office_forms_passport')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('office_forms_passport');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="passports" label={translations[lang].kpiHeadingPassports} description={translations[lang].kpiHelpPassportsDescription} isOpen={openKpiHelp === 'passports'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'passports' ? null : 'passports')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Stamp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-[clamp(1.75rem,7vw,2.25rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {metrics.passports.withCompany + metrics.passports.withRider}
            </div>
            <div className="grid grid-cols-2 min-[420px]:grid-cols-3 gap-x-3 gap-y-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px] tabular-nums">
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownInSafeBox}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-emerald-600 dark:text-emerald-400">{metrics.passports.withCompany}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownWithRider}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-blue-600 dark:text-blue-400">{metrics.passports.withRider}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownExpiring}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-amber-600 dark:text-amber-400">{metrics.passports.expiring}</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. PAYROLL & SALARIES KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'ACCOUNTS' || roleFilter === 'HR') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open Monthly Payroll module"
            onClick={() => onNavigateModule('hr_payroll')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('hr_payroll');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="payroll" label={`${translations[lang].kpiHeadingPayroll} (${formatKpiPayrollMonth(metrics.payroll.currentMonth, lang)})`} description={translations[lang].kpiHelpPayrollDescription} isOpen={openKpiHelp === 'payroll'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'payroll' ? null : 'payroll')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div role="text" aria-label={`${translations[lang].kpiHeadingPayroll}: ${formatKpiCurrencyForScreenReader(metrics.payroll.totalAmount, lang)}`} className="text-[clamp(1.5rem,6vw,2rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {translations[lang].kpiCurrencyAed} {formatKpiCurrencyAmount(metrics.payroll.totalAmount, lang)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px]">
              <span className="inline-flex max-w-full items-center rounded-full px-3 py-1.5 sm:px-2 sm:py-0.5 text-xs sm:text-[10px] leading-snug font-bold break-words bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {translations[lang].kpiPayrollStatusLabel}: {({ APPROVED: translations[lang].kpiPayrollStatusApproved, NO_DATA: translations[lang].kpiPayrollStatusNoData, PENDING: translations[lang].kpiPayrollStatusPending, DRAFT: translations[lang].kpiPayrollStatusDraft, PROCESSED: translations[lang].kpiPayrollStatusProcessed, PAID: translations[lang].kpiPayrollStatusPaid } as Record<string, string>)[metrics.payroll.status.trim().toUpperCase().replace(/[\s-]+/g, '_')] ?? metrics.payroll.status}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium leading-snug break-words">{translations[lang].kpiPayrollSplitCalculated}</span>
            </div>
          </div>
        )}

        {/* 6. TRAFFIC FINES KPI */}
        {(roleFilter === 'ALL' || roleFilter === 'FLEET' || roleFilter === 'ACCOUNTS') && (
          <div
            role="link"
            tabIndex={0}
            aria-label="Open Traffic Fines module"
            onClick={() => onNavigateModule('traffic_fines_mgmt')}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onNavigateModule('traffic_fines_mgmt');
              }
            }}
            className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 p-3.5 sm:p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-500 transition-all cursor-pointer group"
          >
            <div className="flex min-w-0 items-start justify-between gap-2 mb-3">
              <KpiHelpLabel lang={lang} id="fines" label={translations[lang].kpiHeadingFines} description={translations[lang].kpiHelpFinesDescription} isOpen={openKpiHelp === 'fines'} onToggle={() => setOpenKpiHelp(openKpiHelp === 'fines' ? null : 'fines')} onClose={() => setOpenKpiHelp(null)} />
              <div className="shrink-0 p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-xl group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div role="text" aria-label={`${translations[lang].kpiHeadingFines}: ${formatKpiCurrencyForScreenReader(metrics.fines.totalAmount, lang)}`} className="text-[clamp(1.5rem,6vw,2rem)] leading-tight font-black tabular-nums tracking-tight break-words text-slate-900 dark:text-white">
              {translations[lang].kpiCurrencyAed} {formatKpiCurrencyAmount(metrics.fines.totalAmount, lang)}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-[11px] tabular-nums">
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownUnresolved}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-rose-600 dark:text-rose-400">{formatKpiFineCount(metrics.fines.newFines, lang)}</span>
              </div>
              <div>
                <span className="text-slate-600 dark:text-slate-300 block text-[11px] sm:text-[10px] leading-snug break-words">{translations[lang].kpiBreakdownPayrollLinked}</span>
                <span className="block mt-1 text-sm sm:text-xs leading-tight font-bold break-words text-blue-600 dark:text-blue-400">{formatKpiFineCount(metrics.fines.payrollLinked, lang)}</span>
              </div>
            </div>
          </div>
        )}

        {/* 7. CLIENT PROJECTS DEPLOYMENT */}
        {(roleFilter === 'ALL' || roleFilter === 'OPERATIONS') && (
          <div
            onClick={() => onNavigateModule('riders_drivers')}
            className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-500 transition-all cursor-pointer col-span-1 md:col-span-2 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Active Client Deployments & Projects
              </span>
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <div className="space-y-2 mt-2">
              {metrics.projects.list.slice(0, 3).map((proj) => (
                <div key={proj.name} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{proj.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden hidden sm:block">
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${Math.min(100, proj.count * 8)}%` }}
                      ></div>
                    </div>
                    <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md text-[11px]">
                      {proj.count} Riders
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Quick Navigation to Enterprise Modules */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
          Direct Operations Shortcuts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            onClick={() => onNavigateModule('riders_drivers')}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl text-left border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
          >
            <Users className="w-4 h-4 text-blue-600 mb-1.5" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">Employee 360</div>
            <div className="text-[10px] text-slate-400">Master profiles</div>
          </button>

          <button
            onClick={() => onNavigateModule('office_forms_passport')}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-xl text-left border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
          >
            <Stamp className="w-4 h-4 text-purple-600 mb-1.5" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">Passports & Forms</div>
            <div className="text-[10px] text-slate-400">Physical custody</div>
          </button>

          <button
            onClick={() => onNavigateModule('vehicles_fleet')}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl text-left border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
          >
            <Truck className="w-4 h-4 text-amber-600 mb-1.5" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">Fleet & Bikes</div>
            <div className="text-[10px] text-slate-400">Handover & depot</div>
          </button>

          <button
            onClick={() => onNavigateModule('traffic_fines_mgmt')}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl text-left border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 mb-1.5" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">Traffic Fines</div>
            <div className="text-[10px] text-slate-400">Police & RTA sync</div>
          </button>

          <button
            onClick={() => onNavigateModule('hr_payroll')}
            className="p-3 bg-slate-50 dark:bg-slate-800/60 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-xl text-left border border-slate-200/60 dark:border-slate-700/60 transition-colors group"
          >
            <DollarSign className="w-4 h-4 text-emerald-600 mb-1.5" />
            <div className="text-xs font-bold text-slate-900 dark:text-white">Split Payroll</div>
            <div className="text-[10px] text-slate-400">Project calculations</div>
          </button>

          <button
            onClick={() => onNavigateModule('rider_portal')}
            className="p-3 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-xl text-left border border-indigo-200 dark:border-indigo-800 transition-colors group"
          >
            <Sparkles className="w-4 h-4 text-indigo-600 mb-1.5" />
            <div className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Rider Portal</div>
            <div className="text-[10px] text-indigo-500">Self-service view</div>
          </button>
        </div>
      </div>
    </div>
  );
};
