import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Truck,
  Smartphone,
  Briefcase,
  Activity,
  RotateCcw,
  XCircle,
  X,
  User,
  UserPlus,
  ShieldAlert,
} from 'lucide-react';
import { DbEmployeeMaster } from '../../types/database';
import { resolveCanonicalStatus, isLifecycleOverrideStatus } from '../../utils/canonicalStatus';

export interface EmployeeRowActionMenuProps {
  employee: DbEmployeeMaster | null;
  anchorEl: HTMLElement | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignBike: (emp: DbEmployeeMaster) => void;
  onAssignSim: (emp: DbEmployeeMaster) => void;
  onChangeStatus: (emp: DbEmployeeMaster) => void;
  onAssignProject: (emp: DbEmployeeMaster) => void;
  onUnassignProject: (emp: DbEmployeeMaster) => void;
  onLogLeave: (emp: DbEmployeeMaster) => void;
  onExitOffboard: (emp: DbEmployeeMaster) => void;
  onMakeCandidate?: (emp: DbEmployeeMaster) => void;
}

interface MenuCoords {
  top: number;
  left: number;
  openUpward: boolean;
  maxHeight?: number;
}

const MENU_WIDTH = 256; // 256px min/standard width for comfortable label reading
const GAP = 6;
const VIEWPORT_PADDING = 8;
const ESTIMATED_MENU_HEIGHT = 340;

// Pure positioning calculation with collision detection & auto-flip
function calculatePosition(anchorEl: HTMLElement, menuEl: HTMLElement | null): MenuCoords {
  const rect = anchorEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const actualHeight = menuEl?.offsetHeight || ESTIMATED_MENU_HEIGHT;
  const spaceBelow = vh - rect.bottom - GAP - VIEWPORT_PADDING;
  const spaceAbove = rect.top - GAP - VIEWPORT_PADDING;

  // Auto-flip:
  // If enough space below, open downward.
  // If not enough space below, open upward if spaceAbove >= actualHeight or spaceAbove > spaceBelow.
  let openUpward = false;
  if (spaceBelow >= actualHeight) {
    openUpward = false;
  } else if (spaceAbove >= actualHeight) {
    openUpward = true;
  } else {
    // Screen is tight in both directions: choose side with more space
    openUpward = spaceAbove > spaceBelow;
  }

  const maxAvailableHeight = openUpward ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(160, Math.min(maxAvailableHeight, 460));

  let top: number;
  if (openUpward) {
    top = rect.top - GAP - Math.min(actualHeight, maxHeight);
  } else {
    top = rect.bottom + GAP;
  }

  // Clamp top within viewport boundaries
  top = Math.max(
    VIEWPORT_PADDING,
    Math.min(top, vh - Math.min(actualHeight, maxHeight) - VIEWPORT_PADDING)
  );

  // Horizontal positioning & collision detection
  let left: number;
  // If close to right edge or in right half of screen: align menu right edge with trigger right edge (opens to the left)
  if (rect.right > vw / 2 || vw - rect.left < MENU_WIDTH + VIEWPORT_PADDING) {
    left = rect.right - MENU_WIDTH;
  } else {
    // Otherwise align menu left edge with trigger left edge
    left = rect.left;
  }

  // Clamp left within viewport boundaries
  left = Math.max(VIEWPORT_PADDING, Math.min(left, vw - MENU_WIDTH - VIEWPORT_PADDING));

  return { top, left, openUpward, maxHeight };
}

export const EmployeeRowActionMenu: React.FC<EmployeeRowActionMenuProps> = ({
  employee,
  anchorEl,
  isOpen,
  onClose,
  onAssignBike,
  onAssignSim,
  onChangeStatus,
  onAssignProject,
  onUnassignProject,
  onLogLeave,
  onExitOffboard,
  onMakeCandidate,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });

  const [coords, setCoords] = useState<MenuCoords | null>(() => {
    if (typeof window !== 'undefined' && anchorEl) {
      return calculatePosition(anchorEl, null);
    }
    return null;
  });

  // Keep track of window resize for mobile vs desktop
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute anchored coordinates synchronously before browser paint
  useLayoutEffect(() => {
    if (!isOpen || !anchorEl || isMobile) return;
    setCoords(calculatePosition(anchorEl, menuRef.current));
  }, [isOpen, anchorEl, isMobile]);

  // Recalculate position on scroll (including table horizontal scroll) or window resize
  useEffect(() => {
    if (!isOpen || !anchorEl || isMobile) return;

    const handleUpdate = () => {
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // If trigger button is scrolled completely outside viewport, close menu
      if (rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) {
        onClose();
        return;
      }

      setCoords(calculatePosition(anchorEl, menuRef.current));
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isOpen, anchorEl, isMobile, onClose]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        anchorEl &&
        !anchorEl.contains(target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('touchstart', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('touchstart', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, anchorEl, onClose]);

  if (!isOpen || !employee || typeof document === 'undefined') {
    return null;
  }

  const statusNormalized = resolveCanonicalStatus(employee.current_status);
  const isEligibleForProject = !isLifecycleOverrideStatus(statusNormalized);

  const hasAssignedProject = Boolean(
    employee.project_name &&
    employee.project_name !== 'Unassigned' &&
    employee.project_name !== '-'
  );

  const employeeName = employee.full_name || employee.name || 'Employee';
  const employeeCode = employee.employee_code || `EMP-${employee.id.substring(0, 5)}`;

  // ============================================================================
  // 1. MOBILE BOTTOM ACTION SHEET (< 640px)
  // ============================================================================
  if (isMobile) {
    return createPortal(
      <div
        data-employee-action-portal="true"
        className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          ref={menuRef}
          className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl border-t border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] overflow-y-auto p-4 space-y-4 animate-in slide-in-from-bottom duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  Employee Actions
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {employeeCode}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5">
                {employeeName}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Groups */}
          <div className="space-y-3">
            {/* Assets Group */}
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-1">
                Assets & Hardware
              </span>
              <div className="space-y-1">
                <button
                  type="button"
                  id={`mobile-btn-assign-bike-${employee.id}`}
                  onClick={() => {
                    onClose();
                    onAssignBike(employee);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>{employee.current_bike_plate ? 'Replace Bike' : 'Assign Bike'}</span>
                </button>

                <button
                  type="button"
                  id={`mobile-btn-assign-sim-${employee.id}`}
                  onClick={() => {
                    onClose();
                    onAssignSim(employee);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <Smartphone className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>{employee.current_sim_number ? 'Replace SIM' : 'Assign SIM'}</span>
                </button>
              </div>
            </div>

            {/* Project Group */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-1">
                Project Assignment
              </span>
              <div className="space-y-1">
                {isEligibleForProject ? (
                  <button
                    type="button"
                    id={`mobile-btn-assign-project-${employee.id}`}
                    onClick={() => {
                      onClose();
                      onAssignProject(employee);
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-3 text-blue-600 dark:text-blue-400 text-xs font-semibold transition-colors"
                  >
                    <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <span>{hasAssignedProject ? 'Change / Transfer Project' : 'Assign Project'}</span>
                  </button>
                ) : (
                  <div
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 flex items-center gap-3 text-slate-400 dark:text-slate-500 text-xs cursor-not-allowed opacity-75"
                    title={`Cannot assign project while status is ${statusNormalized}`}
                  >
                    <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Assign Project (Unavailable - {statusNormalized})</span>
                  </div>
                )}

                {hasAssignedProject && (
                  <button
                    type="button"
                    id={`mobile-btn-unassign-project-${employee.id}`}
                    onClick={() => {
                      onClose();
                      onUnassignProject(employee);
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors"
                  >
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Unassign Project</span>
                  </button>
                )}
              </div>
            </div>

            {/* Employment Group */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-1 block mb-1">
                Employment Lifecycle
              </span>
              <div className="space-y-1">
                <button
                  type="button"
                  id={`mobile-btn-change-status-${employee.id}`}
                  onClick={() => {
                    onClose();
                    onChangeStatus(employee);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-slate-800 dark:text-slate-200 text-xs font-medium transition-colors"
                >
                  <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Change Status</span>
                </button>

                <button
                  type="button"
                  id={`mobile-btn-log-leave-${employee.id}`}
                  onClick={() => {
                    onClose();
                    onLogLeave(employee);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs font-medium transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Log Leave</span>
                </button>

                <button
                  type="button"
                  id={`mobile-btn-exit-${employee.id}`}
                  onClick={() => {
                    onClose();
                    onExitOffboard(employee);
                  }}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-3 text-rose-600 dark:text-rose-400 text-xs font-medium transition-colors"
                >
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>Exit / Offboard</span>
                </button>

                {onMakeCandidate && (
                  <button
                    type="button"
                    id={`mobile-btn-make-candidate-${employee.id}`}
                    onClick={() => {
                      onClose();
                      onMakeCandidate(employee);
                    }}
                    className="w-full min-h-[44px] px-3 py-2.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition-colors"
                  >
                    <UserPlus className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Make Candidate</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>,
      document.body
    );
  }

  // ============================================================================
  // 2. DESKTOP PORTALED FLOATING POPOVER (>= 640px)
  // ============================================================================
  return createPortal(
    <div
      ref={menuRef}
      data-employee-action-portal="true"
      className="fixed z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1.5 text-left text-xs animate-in fade-in zoom-in-95 select-none overflow-y-auto overscroll-contain"
      style={{
        top: coords ? `${coords.top}px` : '-9999px',
        left: coords ? `${coords.left}px` : '-9999px',
        maxHeight: coords?.maxHeight ? `${coords.maxHeight}px` : '460px',
        visibility: coords ? 'visible' : 'hidden',
      }}
    >
      {/* Mini Profile Indicator */}
      <div className="px-3 py-1.5 mb-1 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]" title={employeeName}>
          {employeeName}
        </span>
        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold">
          {employeeCode}
        </span>
      </div>

      {/* SECTION 1: ASSETS */}
      <div className="px-1.5 py-0.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 block">
          Assets
        </span>
        {/* Assign / Replace Bike */}
        <button
          type="button"
          id={`btn-emp-assign-bike-${employee.id}`}
          onClick={() => {
            onClose();
            onAssignBike(employee);
          }}
          className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <Truck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{employee.current_bike_plate ? 'Replace Bike' : 'Assign Bike'}</span>
        </button>

        {/* Assign / Replace SIM */}
        <button
          type="button"
          id={`btn-emp-assign-sim-${employee.id}`}
          onClick={() => {
            onClose();
            onAssignSim(employee);
          }}
          className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <Smartphone className="w-3.5 h-3.5 text-teal-500 shrink-0" />
          <span className="truncate">{employee.current_sim_number ? 'Replace SIM' : 'Assign SIM'}</span>
        </button>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

      {/* SECTION 2: PROJECT */}
      <div className="px-1.5 py-0.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 block">
          Project
        </span>
        {isEligibleForProject ? (
          <button
            type="button"
            id={`btn-emp-assign-project-menu-${employee.id}`}
            onClick={() => {
              onClose();
              onAssignProject(employee);
            }}
            className="w-full px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md flex items-center gap-2.5 text-blue-600 dark:text-blue-400 font-medium transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="truncate">
              {hasAssignedProject ? 'Change / Transfer Project' : 'Assign Project'}
            </span>
          </button>
        ) : (
          <div
            className="w-full px-2.5 py-1.5 flex items-center gap-2.5 text-slate-400 dark:text-slate-500 cursor-not-allowed text-[11px]"
            title={`Cannot assign project while status is ${statusNormalized}`}
          >
            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Assign Project (Unavailable - {statusNormalized})</span>
          </div>
        )}

        {hasAssignedProject && (
          <button
            type="button"
            id={`btn-emp-unassign-project-${employee.id}`}
            onClick={() => {
              onClose();
              onUnassignProject(employee);
            }}
            className="w-full px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md flex items-center gap-2.5 text-rose-600 dark:text-rose-400 font-medium transition-colors"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="truncate">Unassign Project</span>
          </button>
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

      {/* SECTION 3: EMPLOYMENT LIFECYCLE */}
      <div className="px-1.5 py-0.5">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 px-2 py-0.5 block">
          Employment
        </span>
        {/* Change Status */}
        <button
          type="button"
          id={`btn-emp-change-status-${employee.id}`}
          onClick={() => {
            onClose();
            onChangeStatus(employee);
          }}
          className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="truncate">Change Status</span>
        </button>

        {/* Log Leave */}
        <button
          type="button"
          id={`btn-emp-log-leave-${employee.id}`}
          onClick={() => {
            onClose();
            onLogLeave(employee);
          }}
          className="w-full px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-2.5 text-amber-600 dark:text-amber-400 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">Log Leave</span>
        </button>

        {/* Exit / Offboard */}
        <button
          type="button"
          id={`btn-emp-exit-${employee.id}`}
          onClick={() => {
            onClose();
            onExitOffboard(employee);
          }}
          className="w-full px-2.5 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md flex items-center gap-2.5 text-rose-600 dark:text-rose-400 transition-colors"
        >
          <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
          <span className="truncate">Exit / Offboard</span>
        </button>

        {/* Make Candidate */}
        {onMakeCandidate && (
          <button
            type="button"
            id={`btn-emp-make-candidate-${employee.id}`}
            onClick={() => {
              onClose();
              onMakeCandidate(employee);
            }}
            className="w-full px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md flex items-center gap-2.5 text-indigo-600 dark:text-indigo-400 font-medium transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Make Candidate</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
