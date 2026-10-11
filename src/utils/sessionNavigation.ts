/**
 * Session Navigation Lifecycle Utilities
 *
 * Manages distinction between:
 * 1. A normal browser refresh during the SAME active working session (preserves current route & work)
 * 2. A NEW app or login session (opens clean Employee Management main/list page, clears stale deep routes/modals)
 */

export function isSameWorkingSessionReload(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const hasActiveMarker = sessionStorage.getItem('apex_working_session_active') === 'true';
    if (!hasActiveMarker) {
      return false;
    }

    // Check performance navigation timing
    const navEntries = window.performance?.getEntriesByType?.('navigation');
    const navEntry = navEntries && navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming) : null;
    const isReload = navEntry?.type === 'reload' || (window.performance as any)?.navigation?.type === 1;

    // Check heartbeat timestamp (valid within 12 hours active window)
    const sessionTime = Number(sessionStorage.getItem('apex_working_session_time') || '0');
    const isRecent = sessionTime > 0 && Date.now() - sessionTime < 12 * 60 * 60 * 1000;

    return Boolean(isReload && isRecent);
  } catch {
    return false;
  }
}

/**
 * Marks or refreshes active working session in sessionStorage.
 */
export function markWorkingSessionActive(currentModule?: string, employee360Id?: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem('apex_working_session_active', 'true');
    sessionStorage.setItem('apex_working_session_time', Date.now().toString());
    if (currentModule) {
      sessionStorage.setItem('apex_working_session_module', currentModule);
    }
    if (employee360Id) {
      sessionStorage.setItem('apex_working_session_360_id', employee360Id);
    } else {
      sessionStorage.removeItem('apex_working_session_360_id');
    }
  } catch {
    // Ignore storage quota or security errors
  }
}

/**
 * Resets working session markers upon logout or starting a clean new session.
 */
export function clearWorkingSessionNavigation(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('apex_working_session_active');
    sessionStorage.removeItem('apex_working_session_time');
    sessionStorage.removeItem('apex_working_session_module');
    sessionStorage.removeItem('apex_working_session_360_id');
  } catch {
    // Ignore storage quota or security errors
  }
}
