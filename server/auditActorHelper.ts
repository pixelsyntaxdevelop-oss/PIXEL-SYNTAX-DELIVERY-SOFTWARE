import { Request } from 'express';
import { extractTokenFromRequest, getSession } from './sessionService';
import { getSupabaseClient } from './supabaseDb';

export interface AuthenticatedActor {
  tenantId: string;
  userId: string;
  userName: string;
  userRole: string;
  employeeId: string;
  employeeCode: string;
  isSuperAdmin: boolean;
  isAuthenticated: boolean;
  realActorUserId?: string;
  realActorName?: string;
  realActorRole?: string;
  impersonatedUserId?: string | null;
  isImpersonating?: boolean;
  mustChangePassword?: boolean;
}

/**
 * Resolves the authenticated user from the HTTP request context.
 * Strictly respects server session tokens, never trusts client-supplied actor IDs.
 * Disallows automatic fallback to demo admin accounts.
 * Maps office staff users to their corresponding employee record if present.
 * If impersonation is active, tracks both real_actor_user_id and impersonated_user_id.
 */
export function resolveAuthenticatedActor(req: Request, db: any, _fallbackSessionUser?: any): AuthenticatedActor {
  let headerTenantId = (req.headers['x-tenant-id'] as string) || '';
  const impersonatedUserIdHeader = (req.headers['x-impersonated-user-id'] as string) || '';

  // Authoritative Session Token Resolution
  const token = extractTokenFromRequest(req);
  const session = getSession(token);

  let verifiedUser: any = null;
  if (session) {
    const candidate = (db.users || []).find((u: any) => u.id === session.userId || u.username === session.userId);
    // User must be ACTIVE to authenticate
    if (candidate && candidate.status === 'ACTIVE') {
      verifiedUser = candidate;
    }
  }

  // If unauthenticated: absolute rejection of fallback to demo admin
  if (!verifiedUser) {
    return {
      tenantId: headerTenantId || 'company_demo',
      userId: '',
      userName: 'Unauthenticated Guest',
      userRole: 'UNAUTHENTICATED',
      employeeId: '',
      employeeCode: '',
      isSuperAdmin: false,
      isAuthenticated: false,
      realActorUserId: '',
      realActorName: 'Unauthenticated Guest',
      realActorRole: 'UNAUTHENTICATED',
      impersonatedUserId: null,
      isImpersonating: false,
      mustChangePassword: false,
    };
  }

  const actualUser = verifiedUser;
  const userId = actualUser.id;
  const userRole = actualUser.role || 'VIEWER';
  const userName = actualUser.fullName || actualUser.username || 'System User';

  // Only trust database-verified super admin status, NEVER client headers
  const isSuperAdmin = actualUser.role === 'SUPER_ADMIN' || actualUser.role === 'PLATFORM_ADMIN' || actualUser.isSuperAdmin === true;

  // Real Actor Resolution (for impersonation tracking)
  const realActorUserId = actualUser.id;
  const realActorName = actualUser.fullName || userName;
  const realActorRole = actualUser.role || userRole;

  let effectiveTenantId: string;
  let isImpersonating = false;

  if (isSuperAdmin) {
    // Super admin is authorized to specify/impersonate target tenant if valid
    const requestedTenant = headerTenantId ? headerTenantId.trim() : '';
    const isValidTenant = requestedTenant && (
      requestedTenant === 'company_demo' ||
      requestedTenant === 'company_pixel_syntax' ||
      (db.tenants || []).some((t: any) => t.id === requestedTenant)
    );
    if (isValidTenant) {
      effectiveTenantId = requestedTenant;
      isImpersonating = requestedTenant !== actualUser.tenantId;
    } else {
      effectiveTenantId = actualUser.tenantId && actualUser.tenantId !== 'GLOBAL_SUPER_ADMIN'
        ? actualUser.tenantId
        : 'company_demo';
    }
  } else {
    // Normal user: tenant is strictly locked to user's assigned tenant in the database.
    // Client-supplied x-tenant-id header is strictly ignored.
    effectiveTenantId = actualUser.tenantId || actualUser.tenant_id || 'company_demo';
    isImpersonating = false;
  }

  const tenantId = effectiveTenantId;

  // Staff User -> Employee relation mapping
  let mappedEmployee = (db.employees || []).find((e: any) =>
    (actualUser.email && e.email?.toLowerCase() === actualUser.email.toLowerCase()) ||
    (actualUser.employee_id && (e.id === actualUser.employee_id || e.employee_id === actualUser.employee_id)) ||
    (e.user_id && e.user_id === userId) ||
    (userName && e.fullName?.toLowerCase() === userName.toLowerCase())
  );
  if (!mappedEmployee && db.masterEmployees) {
    mappedEmployee = (db.masterEmployees || []).find((e: any) =>
      (actualUser.email && e.email?.toLowerCase() === actualUser.email.toLowerCase()) ||
      (actualUser.employee_id && (e.id === actualUser.employee_id || e.employee_id === actualUser.employee_id)) ||
      (e.user_id && e.user_id === userId) ||
      (userName && (e.full_name?.toLowerCase() === userName.toLowerCase() ||
        `${e.first_name || ''} ${e.last_name || ''}`.trim().toLowerCase() === userName.toLowerCase()))
    );
  }

  const employeeId = mappedEmployee?.id || mappedEmployee?.employee_id || actualUser.employee_id || '';
  const employeeCode = mappedEmployee?.employeeCode || mappedEmployee?.employee_code || actualUser.employee_code || '';

  return {
    tenantId,
    userId,
    userName,
    userRole,
    employeeId,
    employeeCode,
    isSuperAdmin: Boolean(isSuperAdmin),
    isAuthenticated: true,
    realActorUserId,
    realActorName,
    realActorRole,
    impersonatedUserId: impersonatedUserIdHeader || (isImpersonating && userId !== realActorUserId ? userId : null),
    isImpersonating,
    mustChangePassword: Boolean(actualUser.mustChangePassword),
  };
}

/**
 * Universal Audit Logging Helper
 * Persists performed_by_user_id, performed_by_employee_id, actor_name_at_time, actor_employee_code_at_time,
 * real_actor_user_id, impersonated_user_id, and tenant_id.
 */
export function logUniversalAudit(
  db: any,
  actor: AuthenticatedActor,
  payload: {
    action: string;
    actionType?: string;
    module: string;
    entityType: string;
    entityId: string;
    oldState?: any;
    newState?: any;
    reason?: string;
    notes?: string;
    details?: string;
    branchId?: string;
    ipAddress?: string;
  }
) {
  const now = new Date().toISOString();
  if (!db.auditLogs) db.auditLogs = [];

  const logEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    tenant_id: actor.tenantId,
    timestamp: now.replace('T', ' ').substring(0, 19),
    userId: actor.userId,
    userName: actor.userName,
    userRole: actor.userRole,
    performed_by_user_id: actor.userId,
    performed_by_employee_id: actor.employeeId,
    performed_by_name: actor.userName,
    actor_name_at_time: actor.userName,
    actor_employee_code_at_time: actor.employeeCode,
    real_actor_user_id: actor.realActorUserId || actor.userId,
    real_actor_name: actor.realActorName || actor.userName,
    real_actor_role: actor.realActorRole || actor.userRole,
    impersonated_user_id: actor.impersonatedUserId || null,
    is_impersonating: Boolean(actor.isImpersonating),
    performed_at: now,
    action: payload.action,
    actionType: payload.actionType || 'UPDATE',
    status: 'SUCCESS',
    module: payload.module,
    entity_type: payload.entityType,
    entity_id: payload.entityId,
    old_state: payload.oldState,
    new_state: payload.newState,
    reason: payload.reason || '',
    notes: payload.notes || '',
    details: payload.details || `${actor.userName} performed ${payload.action} on ${payload.entityType} ${payload.entityId}`,
    branch_id: payload.branchId || '',
    ipAddress: payload.ipAddress || '127.0.0.1',
  };

  db.auditLogs.unshift(logEntry);

  // Authoritative Supabase Database Audit Persistence
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      Promise.resolve(
        supabase.from('audit_logs').insert([{
          id: logEntry.id,
          tenant_id: actor.tenantId,
          user_id: actor.userId && !actor.userId.startsWith('user_') ? actor.userId : null,
          user_name: actor.userName,
          user_email: (actor as any).userEmail || null,
          role: actor.userRole,
          action: payload.action,
          module: payload.module,
          target_id: payload.entityId || null,
          target_type: payload.entityType || null,
          ip_address: payload.ipAddress || '127.0.0.1',
          old_values: payload.oldState || null,
          new_values: payload.newState || null,
          metadata: {
            performed_by_user_id: actor.userId,
            performed_by_employee_id: actor.employeeId,
            performed_by_name: actor.userName,
            actor_name_at_time: actor.userName,
            actor_employee_code_at_time: actor.employeeCode,
            details: logEntry.details,
            reason: payload.reason || '',
          },
          timestamp: now,
        }])
      ).then(({ error }: any) => {
        if (error) {
          // Non-blocking log if schema difference
          console.warn('ℹ️ Supabase audit_logs record notice:', error.message);
        }
      }).catch(() => {});
    } catch {
      // Non-blocking audit persistence failure guard
    }
  }

  return logEntry;
}
