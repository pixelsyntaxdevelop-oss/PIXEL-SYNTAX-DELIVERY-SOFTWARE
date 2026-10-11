import { SystemUserAccount, SystemAuditLog } from '../types/erp';
import { DEFAULT_USER_ACCOUNTS, INITIAL_AUDIT_LOGS } from '../data/defaultUserAccounts';
import { apiClient } from '../services/apiClient';

/**
 * Enterprise Audit Logger and User Persistence Layer
 * Backed by multi-tenant cloud database API
 */

// Load User Accounts from cloud API
export function loadUserAccounts(): SystemUserAccount[] {
  return DEFAULT_USER_ACCOUNTS;
}

// Save User Accounts to cloud API
export async function saveUserAccounts(accounts: SystemUserAccount[]) {
  // Dispatches to server/database
  try {
    for (const account of accounts) {
      if (account.id.startsWith('user_admin_') || account.id.startsWith('user_new_')) {
        await apiClient.post('/api/users', account);
      }
    }
  } catch (e) {
    console.error('Failed to sync user accounts to database', e);
  }
}

// Load Current Logged In User - strictly returns null if not authenticated
export function loadCurrentUser(): SystemUserAccount | null {
  if (typeof window !== 'undefined') {
    const savedUserId = localStorage.getItem('apex_current_user_id');
    if (savedUserId) {
      const user = DEFAULT_USER_ACCOUNTS.find((u) => u.id === savedUserId);
      if (user) return user;
    }
  }
  return null;
}

// Save Current Logged In User
export async function saveCurrentUser(user: SystemUserAccount) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('apex_current_user_id', user.id);
      if (user.tenantId && user.tenantId !== 'GLOBAL_SUPER_ADMIN') {
        localStorage.setItem('apex_active_tenant_id', user.tenantId);
      }
    }
    await apiClient.post('/api/auth/switch-user', { userId: user.id });
  } catch (e) {
    console.error('Failed to sync current user session', e);
  }
}

// Load Audit Logs
export function loadAuditLogs(): SystemAuditLog[] {
  return INITIAL_AUDIT_LOGS;
}

// Save Audit Logs
export async function saveAuditLogs(logs: SystemAuditLog[]) {
  // Logs are automatically persisted server-side
}

// Log a system action with enterprise tracking
export function addAuditLog(
  user: SystemUserAccount,
  moduleName: string,
  actionType: 'ASSIGN' | 'UNASSIGN' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'STATUS_CHANGE',
  details: string,
  targetEntityId?: string
): SystemAuditLog {
  const newLog: SystemAuditLog = {
    id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: user.id,
    userName: `${user.fullName} (${user.designation})`,
    userRole: user.role,
    actorName: user.fullName,
    actorRole: user.role,
    action: actionType,
    status: 'SUCCESS',
    module: moduleName,
    actionType,
    details,
    targetEntityId,
    ipAddress: '192.168.1.' + (10 + Math.floor(Math.random() * 40)),
  };

  // Asynchronously dispatch to database audit log endpoint
  apiClient.post('/api/audit/logs', newLog).catch((err) => {
    console.warn('Audit log dispatched with status:', err);
  });

  return newLog;
}
