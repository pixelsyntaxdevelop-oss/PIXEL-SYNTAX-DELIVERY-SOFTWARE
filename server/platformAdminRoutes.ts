import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { resolveAuthenticatedActor, logUniversalAudit, AuthenticatedActor } from './auditActorHelper';
import { destroyAllUserSessions, verifyPassword, getClientIp } from './sessionService';
import {
  createPlatformAdminSession,
  validatePlatformAdminSession,
  revokePlatformAdminSession,
  extractPlatformAdminToken,
} from './platformAdminSessionService';
import { getSupabaseClient } from './supabaseDb';
import { checkIsR2Configured, getR2Client, getR2BucketName } from './fileStorageService';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { AUTHORITATIVE_MASTER_EMPLOYEES } from './authoritativeEmployees';
import { savePersistentTenantBranding, syncTenantBrandingToSupabase, getAuthoritativeTenantBranding } from './tenantBrandingStorage';
import {
  getAuthoritativePassportCustody,
  getAuthoritativePassportHistory,
  calculatePassportStats,
  editPassportAuthoritative,
  deletePassportAuthoritative,
} from './authoritativePassportCustody';

export function createPlatformAdminRouter(db: any, extractTenantContext: (req: Request) => any) {
  const router = Router();

  const persistAlliedUsers = () => {
    try {
      const persistentUsersPath = path.join(process.cwd(), 'data', 'persistent_erp_users.json');
      const dir = path.dirname(persistentUsersPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const BANNED_LEGACY = ['admin_user', 'ahmed', 'raza', 'fatima_hr', 'bilal_payroll'];
      const alliedUsers = (db.users || []).filter(
        (u: any) => (u.tenantId === 'company_pixel_syntax' || u.tenant_id === 'company_pixel_syntax') && !BANNED_LEGACY.includes(u.username)
      );
      fs.writeFileSync(persistentUsersPath, JSON.stringify(alliedUsers, null, 2), 'utf8');
    } catch (err) {
      console.warn('⚠️ Notice saving persistent users:', err);
    }
  };

  // Ensure default tenants baseline data is present in memory
  const ensureDefaultTenantsData = () => {
    if (!db.masterEmployees) db.masterEmployees = [];
    if (!db.projects) db.projects = [];
    if (!db.simCards) db.simCards = [];
    if (!db.vehicles) db.vehicles = [];

    const alliedEmps = db.masterEmployees.filter((e: any) => e.tenant_id === 'company_pixel_syntax');
    if (alliedEmps.length === 0) {
      db.masterEmployees.push(...AUTHORITATIVE_MASTER_EMPLOYEES);
    }
    return; // Strict safety constraint: Do NOT reseed or modify tenant data
  };

  ensureDefaultTenantsData();

  // 0. Dedicated Platform Admin Authentication Routes (Publicly accessible before middleware)
  router.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const username = String(req.body?.username || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const clientIp = getClientIp(req);

      if (!username || !password) {
        return res.status(400).json({ error: 'Platform admin username and password are required.' });
      }

      let authenticated = false;
      let adminUser: { username: string; fullName: string; role: string } | null = null;

      // Check 1: Server environment credentials
      const envAdminUser = (process.env.PLATFORM_ADMIN_USERNAME || 'platform_admin').toLowerCase();
      const envAdminPass = process.env.PLATFORM_ADMIN_PASSWORD || process.env.INITIAL_PLATFORM_ADMIN_PASSWORD;

      if (envAdminPass && username === envAdminUser && password === envAdminPass) {
        authenticated = true;
        adminUser = {
          username: envAdminUser,
          fullName: 'Platform Super Administrator',
          role: 'PLATFORM_ADMIN',
        };
      }

      // Check 2: Authoritative / Database users with SUPER_ADMIN or PLATFORM_ADMIN role
      if (!authenticated) {
        const found = (db.users || []).find((u: any) => {
          const matchId =
            (u.username && u.username.toLowerCase() === username) ||
            (u.email && u.email.toLowerCase() === username);
          const isPrivileged =
            u.role === 'SUPER_ADMIN' || u.role === 'PLATFORM_ADMIN' || u.isSuperAdmin === true;
          return matchId && isPrivileged;
        });

        if (found) {
          const valid =
            verifyPassword(password, found.password_hash, found.salt) ||
            (found.password && found.password === password);
          if (valid) {
            authenticated = true;
            adminUser = {
              username: found.username,
              fullName: found.fullName || found.name || found.username,
              role: found.role || 'PLATFORM_ADMIN',
            };
          }
        }
      }

      // Development fallback: If no password is set in env and no DB admin user matched, allow dev admin bootstrap
      if (!authenticated && !envAdminPass && username === 'platform_admin') {
        const foundAnySuper = (db.users || []).some(
          (u: any) => u.role === 'SUPER_ADMIN' || u.role === 'PLATFORM_ADMIN'
        );
        if (!foundAnySuper && (process.env.NODE_ENV !== 'production' || !process.env.SUPABASE_URL)) {
          if (password.length >= 6) {
            authenticated = true;
            adminUser = {
              username: 'platform_admin',
              fullName: 'Primary Platform Administrator',
              role: 'PLATFORM_ADMIN',
            };
          }
        }
      }

      if (!authenticated || !adminUser) {
        if (db.auditLogs) {
          db.auditLogs.unshift({
            id: `log_adm_fail_${Date.now()}`,
            tenant_id: 'GLOBAL_PLATFORM',
            timestamp: new Date().toISOString(),
            userId: 'UNKNOWN',
            userName: 'Unauthenticated Platform Guest',
            userRole: 'UNAUTHENTICATED',
            actorName: username,
            actorRole: 'UNAUTHENTICATED',
            action: 'PLATFORM_ADMIN_LOGIN_FAILED',
            actionType: 'LOGIN',
            status: 'FAILED',
            module: 'Platform Security',
            details: `Failed Platform Admin sign-in attempt for '${username}' from IP ${clientIp}`,
            ipAddress: clientIp,
          });
        }
        return res.status(401).json({
          error: 'Invalid Platform Admin credentials. Access strictly restricted to Platform Administrators.',
        });
      }

      // Create persistent Platform Admin session in Supabase platform_admin_sessions
      const { token, session } = await createPlatformAdminSession(adminUser, req);

      if (db.auditLogs) {
        db.auditLogs.unshift({
          id: `log_adm_ok_${Date.now()}`,
          tenant_id: 'GLOBAL_PLATFORM',
          timestamp: new Date().toISOString(),
          userId: adminUser.username,
          userName: adminUser.fullName,
          userRole: adminUser.role,
          actorName: adminUser.fullName,
          actorRole: adminUser.role,
          action: 'PLATFORM_ADMIN_LOGIN_SUCCESS',
          actionType: 'LOGIN',
          status: 'SUCCESS',
          module: 'Platform Security',
          details: `Platform Administrator '${adminUser.username}' logged into Platform Admin Console`,
          ipAddress: clientIp,
        });
      }

      res.json({
        success: true,
        token,
        user: adminUser,
        expiresAt: session.expiresAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Platform admin authentication failed: ' + err.message });
    }
  });

  router.get('/auth/session', async (req: Request, res: Response) => {
    try {
      const token = extractPlatformAdminToken(req);

      if (!token) {
        return res.status(401).json({ authenticated: false, error: 'No active platform admin session' });
      }

      const session = await validatePlatformAdminSession(token, req);
      if (!session) {
        return res.status(401).json({ authenticated: false, error: 'Platform admin session expired or invalid' });
      }

      res.json({
        authenticated: true,
        user: {
          username: session.adminIdentity,
          fullName: session.adminName,
          role: session.role,
        },
      });
    } catch (err: any) {
      res.status(500).json({ authenticated: false, error: 'Failed to validate platform admin session: ' + err.message });
    }
  });

  router.post('/auth/logout', async (req: Request, res: Response) => {
    try {
      const token = extractPlatformAdminToken(req);

      if (token) {
        const session = await validatePlatformAdminSession(token, req);
        await revokePlatformAdminSession(token);

        if (session && db.auditLogs) {
          db.auditLogs.unshift({
            id: `log_adm_logout_${Date.now()}`,
            tenant_id: 'GLOBAL_PLATFORM',
            timestamp: new Date().toISOString(),
            userId: session.adminIdentity,
            userName: session.adminName,
            userRole: session.role,
            actorName: session.adminName,
            actorRole: session.role,
            action: 'PLATFORM_ADMIN_LOGOUT',
            actionType: 'LOGOUT',
            status: 'SUCCESS',
            module: 'Platform Security',
            details: `Platform Administrator '${session.adminIdentity}' logged out`,
            ipAddress: getClientIp(req),
          });
        }
      }

      res.json({ success: true, message: 'Platform admin logged out successfully' });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to logout platform admin: ' + err.message });
    }
  });

  // 1. Strict Server-Side Access Control Middleware
  const requirePlatformAdmin = async (req: Request, res: Response, next: () => void) => {
    try {
      // 1. Primary check: Verified Platform Admin persistent session in Supabase platform_admin_sessions
      const token = extractPlatformAdminToken(req);

      if (token) {
        const session = await validatePlatformAdminSession(token, req);
        if (session) {
          (req as any).adminActor = {
            userId: session.adminIdentity,
            userName: session.adminName,
            userRole: session.role,
            isSuperAdmin: true,
          };
          return next();
        }
      }

      // 2. Secondary check for server diagnostics / automated scripts
      const context = extractTenantContext(req);
      const actor = context.actor || resolveAuthenticatedActor(req, db);
      const isSuper =
        context.isSuperAdmin ||
        actor.isSuperAdmin ||
        actor.userRole === 'SUPER_ADMIN' ||
        actor.userRole === 'PLATFORM_ADMIN';

      if (!isSuper) {
        return res.status(403).json({
          error:
            'Access Denied: Platform Admin Panel is strictly restricted to authenticated Platform Admin sessions.',
          status: 403,
          currentUserRole: actor.userRole || 'UNAUTHENTICATED',
        });
      }

      (req as any).adminActor = actor;
      next();
    } catch (err: any) {
      return res.status(403).json({ error: 'Authorization verification failed: ' + err.message });
    }
  };

  router.use(requirePlatformAdmin);

  // Helper to resolve target tenant for scoped admin actions
  const getTargetTenantId = (req: Request): string => {
    const fromQuery = req.query.tenant_id as string;
    const fromHeader = (req.headers['x-admin-tenant-id'] as string) || (req.headers['x-tenant-id'] as string);
    const fromBody = req.body?.tenant_id as string;
    return (fromQuery || fromHeader || fromBody || 'company_pixel_syntax').trim();
  };

  // Live Supabase Data Synchronization for Platform Admin
  const syncSupabaseForTenant = async (tenantId: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const [empRes, vehRes, simRes, projRes, fineRes, salikRes, userRes, credRes, candRes, payRes, docRes, attRes] = await Promise.all([
        supabase.from('employees').select('*').eq('tenant_id', tenantId),
        supabase.from('vehicles').select('*').eq('tenant_id', tenantId),
        supabase.from('sim_cards').select('*').eq('tenant_id', tenantId),
        supabase.from('projects').select('*').eq('tenant_id', tenantId),
        supabase.from('traffic_fines').select('*').eq('tenant_id', tenantId),
        supabase.from('salik_records').select('*').eq('tenant_id', tenantId),
        supabase.from('profiles').select('*').eq('tenant_id', tenantId),
        supabase.from('user_credentials').select('profile_id, username, must_change_password, failed_login_count, locked_until').eq('tenant_id', tenantId),
        supabase.from('candidates').select('*').eq('tenant_id', tenantId),
        supabase.from('payroll_records').select('*').eq('tenant_id', tenantId),
        supabase.from('entity_documents').select('*').eq('tenant_id', tenantId),
        supabase.from('attendance_records').select('*').eq('tenant_id', tenantId),
      ]);

      if (Array.isArray(empRes.data) && empRes.data.length > 0) {
        const otherEmps = (db.masterEmployees || []).filter((e: any) => e.tenant_id !== tenantId);
        db.masterEmployees = [...otherEmps, ...empRes.data];
      }
      if (Array.isArray(vehRes.data) && vehRes.data.length > 0) {
        const otherVehs = (db.vehicles || []).filter((v: any) => v.tenant_id !== tenantId);
        db.vehicles = [...otherVehs, ...vehRes.data];
      }
      if (Array.isArray(simRes.data) && simRes.data.length > 0) {
        const otherSims = (db.simCards || []).filter((s: any) => s.tenant_id !== tenantId);
        db.simCards = [...otherSims, ...simRes.data];
      }
      if (Array.isArray(projRes.data) && projRes.data.length > 0) {
        const otherProjs = (db.projects || []).filter((p: any) => p.tenant_id !== tenantId);
        db.projects = [...otherProjs, ...projRes.data];
      }
      if (Array.isArray(fineRes.data) && fineRes.data.length > 0) {
        const otherFines = (db.trafficFines || []).filter((f: any) => f.tenant_id !== tenantId);
        db.trafficFines = [...otherFines, ...fineRes.data];
      }
      if (Array.isArray(salikRes.data) && salikRes.data.length > 0) {
        const otherSalik = (db.salikRecords || []).filter((s: any) => s.tenant_id !== tenantId);
        db.salikRecords = [...otherSalik, ...salikRes.data];
      }
      if (Array.isArray(userRes.data) && userRes.data.length > 0) {
        const otherUsers = (db.users || []).filter((u: any) => (u.tenantId || u.tenant_id) !== tenantId);
        const banned = ['admin_user', 'ahmed', 'raza', 'fatima_hr', 'bilal_payroll'];
        const credMap = new Map((credRes?.data || []).map((c: any) => [c.username, c]));
        const syncedUsers = userRes.data
          .filter((p: any) => !banned.includes((p.username || '').toLowerCase()))
          .map((p: any) => {
            const cred = credMap.get(p.username);
            return {
              id: p.id || `user_${p.username}`,
              tenantId: tenantId,
              tenant_id: tenantId,
              username: p.username,
              fullName: p.full_name || p.username,
              full_name: p.full_name || p.username,
              name: p.full_name || p.username,
              email: p.email || `${p.username}@alliedfleet.com`,
              phone: p.phone || '',
              role: p.role || (p.is_super_admin ? 'SUPER_ADMIN' : (p.is_owner ? 'COMPANY_ADMIN' : 'ERP_USER')),
              designation: p.designation || (p.is_owner ? 'Company Owner & Administrator' : 'ERP Staff Member'),
              status: p.status || 'ACTIVE',
              mustChangePassword: Boolean(cred?.must_change_password),
              failed_login_count: cred?.failed_login_count || 0,
              locked_until: cred?.locked_until || null,
              lastLogin: p.last_login ? p.last_login.substring(0, 19).replace('T', ' ') : 'Never',
              last_login: p.last_login || null,
              created_at: p.created_at || '2026-01-01',
              createdDate: p.created_at ? p.created_at.split('T')[0] : '2026-01-01',
            };
          });
        db.users = [...otherUsers, ...syncedUsers];
      }
      if (Array.isArray(candRes.data) && candRes.data.length > 0) {
        const otherCand = (db.candidates || []).filter((c: any) => c.tenant_id !== tenantId);
        db.candidates = [...otherCand, ...candRes.data];
      }
      if (Array.isArray(payRes.data) && payRes.data.length > 0) {
        const otherPay = (db.payrollRecords || []).filter((p: any) => p.tenant_id !== tenantId);
        db.payrollRecords = [...otherPay, ...payRes.data];
      }
      if (Array.isArray(docRes.data) && docRes.data.length > 0) {
        const otherDocs = (db.documents || []).filter((d: any) => d.tenant_id !== tenantId);
        db.documents = [...otherDocs, ...docRes.data];
      }
      if (Array.isArray(attRes.data) && attRes.data.length > 0) {
        const otherAtt = (db.attendanceRecords || []).filter((a: any) => a.tenant_id !== tenantId);
        db.attendanceRecords = [...otherAtt, ...attRes.data];
      }
    } catch (err: any) {
      console.error('Error syncing Supabase data in platform admin:', err?.message);
    }
  };

  // Sync Supabase data on all platform admin requests before route handlers execute
  router.use(async (req: Request, _res: Response, next: any) => {
    try {
      const tenantId = getTargetTenantId(req);
      if (tenantId) {
        await syncSupabaseForTenant(tenantId);
      }
    } catch {}
    next();
  });

  // Helper to find tenant record
  const findTenant = (tenantId: string) => {
    return (db.tenants || []).find((t: any) => t.id === tenantId);
  };

  // Helper to verify if tenant is LIVE
  const isTenantLive = (tenantId: string): boolean => {
    const tenant = findTenant(tenantId);
    return tenant?.go_live_status === 'LIVE';
  };

  // Helper to combine vehicles from both collections safely
  const getAllVehicles = (tenantId?: string) => {
    const v1 = db.fleetVehicles || [];
    const v2 = db.vehicles || [];
    const map = new Map<string, any>();
    [...v1, ...v2].forEach((v) => {
      if (v && v.id) {
        if (!map.has(v.id)) {
          map.set(v.id, v);
        } else {
          // Merge properties if duplicate ID exists
          map.set(v.id, { ...map.get(v.id), ...v });
        }
      }
    });
    const all = Array.from(map.values());
    if (tenantId) {
      return all.filter((v) => v.tenant_id === tenantId);
    }
    return all;
  };

  // Helper to combine SIM cards from both collections safely
  const getAllSims = (tenantId?: string) => {
    const s1 = db.simCardsMaster || [];
    const s2 = db.simCards || [];
    const map = new Map<string, any>();
    [...s1, ...s2].forEach((s) => {
      if (s && s.id) {
        if (!map.has(s.id)) {
          map.set(s.id, s);
        } else {
          map.set(s.id, { ...map.get(s.id), ...s });
        }
      }
    });
    const all = Array.from(map.values());
    if (tenantId) {
      return all.filter((s) => s.tenant_id === tenantId);
    }
    return all;
  };

  // Helper to log admin actions immutably
  const logAdminAction = (
    actor: AuthenticatedActor,
    tenantId: string,
    action: string,
    moduleName: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    newValue: any,
    reason?: string,
    details?: string,
    extraFields?: Record<string, any>
  ) => {
    const now = new Date().toISOString();
    const logEntry = {
      id: `log_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      tenant_id: tenantId,
      employee_id: extraFields?.employee_id || (entityType === 'EMPLOYEE' ? entityId : undefined),
      employee_name: extraFields?.employee_name || undefined,
      actor_user_id: actor.userId,
      real_actor_user_id: actor.userId,
      actor_name: actor.userName,
      actor_role: actor.userRole,
      action,
      module: moduleName,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      reason: reason || 'Platform Admin operational maintenance',
      details: details || `Admin action ${action} executed by ${actor.userName}`,
      dependencies_found: extraFields?.dependencies_found !== undefined
        ? (typeof extraFields.dependencies_found === 'string'
            ? extraFields.dependencies_found
            : JSON.stringify(extraFields.dependencies_found))
        : undefined,
      timestamp: now.replace('T', ' ').substring(0, 19),
      ipAddress: '127.0.0.1',
      ...(extraFields || {}),
    };

    if (!db.auditLogs) db.auditLogs = [];
    db.auditLogs.unshift(logEntry);
  };

  // ==========================================
  // 1. TENANTS MANAGEMENT & SELECTOR
  // ==========================================
  router.get('/tenants', async (req: Request, res: Response) => {
    try {
      await Promise.all([
        syncSupabaseForTenant('company_pixel_syntax'),
        syncSupabaseForTenant('company_demo'),
      ]);
      const tenants = (db.tenants || []).map((t: any) => {
        const tId = t.id;
        const empCount = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tId && !e.is_archived).length;
        const vehCount = getAllVehicles(tId).length;
        const simCount = getAllSims(tId).length;
        const projCount = (db.projects || []).filter((p: any) => p.tenant_id === tId).length;
        const fineCount = (db.trafficFines || []).filter((f: any) => f.tenant_id === tId).length;
        const salikCount = (db.salikRecords || []).filter((s: any) => s.tenant_id === tId).length;
        const userCount = (db.users || []).filter((u: any) => u.tenantId === tId).length;

        // Default go_live_status if not explicitly set
        let goLiveStatus = t.go_live_status;
        if (!goLiveStatus) {
          if (tId === 'company_pixel_syntax') goLiveStatus = 'LIVE';
          else if (tId === 'company_demo') goLiveStatus = 'TESTING';
          else goLiveStatus = 'SETUP';
        }

        return {
          id: t.id,
          name: t.name,
          code: t.code,
          domain: t.domain || `${t.code.toLowerCase()}.apexfleet.ae`,
          status: t.status || 'ACTIVE',
          plan: t.plan || 'ENTERPRISE_PRO',
          go_live_status: goLiveStatus,
          is_live_protected: goLiveStatus === 'LIVE',
          createdDate: t.createdDate || t.created_at || '2026-01-01',
          counts: {
            employees: empCount,
            vehicles: vehCount,
            sims: simCount,
            projects: projCount,
            fines: fineCount,
            salik: salikCount,
            users: userCount,
          },
        };
      });

      res.json(tenants);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tenants/:id/mode', (req: Request, res: Response) => {
    try {
      const { mode } = req.body;
      const targetId = req.params.id;
      if (!['SETUP', 'TESTING', 'LIVE'].includes(mode)) {
        return res.status(400).json({ error: 'Mode must be SETUP, TESTING, or LIVE.' });
      }

      const tenant = findTenant(targetId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      const oldMode = tenant.go_live_status || 'SETUP';
      tenant.go_live_status = mode;
      tenant.updated_at = new Date().toISOString();

      const actor = (req as any).adminActor;
      logAdminAction(
        actor,
        targetId,
        'ADMIN_TENANT_MODE_CHANGE',
        'Tenants',
        'TENANT',
        targetId,
        { mode: oldMode },
        { mode },
        `Changed tenant go-live mode from ${oldMode} to ${mode}`
      );

      res.json({ success: true, tenantId: targetId, mode });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.1 TENANT BRANDING GET & UPDATE (Requirement 16, 17, 18, 19)
  router.get('/tenants/:id/branding', async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      const tenant = findTenant(targetId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const branding = await getAuthoritativeTenantBranding(targetId, db, true);

      res.json({
        ...branding,
        is_live_protected: targetId === 'company_pixel_syntax' || tenant.go_live_status === 'LIVE',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/tenants/:id/branding', async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      const tenant = findTenant(targetId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      const actor = (req as any).adminActor;
      const oldBranding = {
        name: tenant.name,
        portalTitle: tenant.portalTitle,
        logoUrl: tenant.logoUrl,
        loginHeroUrl: tenant.loginHeroUrl,
        loginBgUrl: tenant.loginBgUrl,
        sidebarLogoUrl: tenant.sidebarLogoUrl,
        headerLogoUrl: tenant.headerLogoUrl,
        faviconUrl: tenant.faviconUrl,
        loginTagline: tenant.loginTagline,
        supportEmail: tenant.supportEmail,
        supportPhone: tenant.supportPhone,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
        turnstileEnabled: tenant.turnstileEnabled,
        turnstileSiteKey: tenant.turnstileSiteKey,
      };

      const b = req.body;
      if (b.companyName) tenant.name = b.companyName.trim();
      if (b.portalTitle !== undefined) tenant.portalTitle = b.portalTitle.trim();
      if (b.logoUrl !== undefined) tenant.logoUrl = b.logoUrl;
      if (b.loginHeroUrl !== undefined) tenant.loginHeroUrl = b.loginHeroUrl;
      if (b.loginBgUrl !== undefined) tenant.loginBgUrl = b.loginBgUrl;
      if (b.sidebarLogoUrl !== undefined) tenant.sidebarLogoUrl = b.sidebarLogoUrl;
      if (b.headerLogoUrl !== undefined) tenant.headerLogoUrl = b.headerLogoUrl;
      if (b.faviconUrl !== undefined) tenant.faviconUrl = b.faviconUrl;
      if (b.loginTagline !== undefined) tenant.loginTagline = b.loginTagline.trim();
      if (b.supportEmail !== undefined) tenant.supportEmail = b.supportEmail.trim();
      if (b.supportPhone !== undefined) tenant.supportPhone = b.supportPhone.trim();
      if (b.domain !== undefined) tenant.domain = b.domain.trim();
      if (b.custom_domain !== undefined) tenant.custom_domain = b.custom_domain.trim();
      if (b.primaryColor !== undefined) tenant.primaryColor = b.primaryColor.trim();
      if (b.secondaryColor !== undefined) tenant.secondaryColor = b.secondaryColor.trim();
      if (b.turnstileEnabled !== undefined) tenant.turnstileEnabled = Boolean(b.turnstileEnabled);
      if (b.turnstileSiteKey !== undefined) tenant.turnstileSiteKey = b.turnstileSiteKey.trim();

      tenant.updated_at = new Date().toISOString();

      // Persist branding to disk and Supabase
      savePersistentTenantBranding(db);
      await syncTenantBrandingToSupabase(targetId, tenant);

      logAdminAction(
        actor,
        targetId,
        'ADMIN_TENANT_BRANDING_UPDATE',
        'Branding Management',
        'TENANT_BRANDING',
        targetId,
        oldBranding,
        {
          name: tenant.name,
          portalTitle: tenant.portalTitle,
          logoUrl: tenant.logoUrl,
          loginHeroUrl: tenant.loginHeroUrl,
          faviconUrl: tenant.faviconUrl,
          loginTagline: tenant.loginTagline,
        },
        `Updated tenant branding configuration for ${tenant.name}`
      );

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const authoritative = await getAuthoritativeTenantBranding(targetId, db, false);

      res.json({
        success: true,
        message: 'Tenant branding updated successfully.',
        branding: authoritative,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image / Asset Upload for Branding (Requirement 13 & 17: Reference stored, no permanent base64 in database)
  router.post('/tenants/:id/branding/upload', async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      const tenant = findTenant(targetId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      const { assetType, fileData, fileName, mimeType } = req.body;
      const actor = (req as any).adminActor;
      if (!fileData || !assetType) {
        return res.status(400).json({ error: 'assetType and fileData are required.' });
      }

      // 1. Detect and validate MIME type
      let cleanedMime = String(mimeType || '').toLowerCase();
      let rawBase64 = '';
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          cleanedMime = matches[1].toLowerCase();
          rawBase64 = matches[2];
        } else {
          rawBase64 = fileData;
        }
      } else if (typeof fileData === 'string') {
        rawBase64 = fileData;
      }

      const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!cleanedMime || !ALLOWED_MIME_TYPES.includes(cleanedMime)) {
        return res.status(400).json({
          error: 'INVALID_FILE_TYPE',
          code: 'INVALID_FILE_TYPE',
          message: 'Invalid file type. Only PNG, JPEG, and WEBP images are supported.',
        });
      }

      // Parse base64 into binary buffer
      let buffer: Buffer;
      try {
        buffer = Buffer.from(rawBase64, 'base64');
      } catch {
        return res.status(400).json({
          error: 'INVALID_FILE_TYPE',
          code: 'INVALID_FILE_TYPE',
          message: 'Failed to decode image data.',
        });
      }

      // 2. Sensible file-size validation (5MB max)
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({
          error: 'FILE_TOO_LARGE',
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds maximum allowed limit of 5MB.',
        });
      }

      const assetSize = buffer.length;
      const uploadedAt = new Date().toISOString();
      const uploadedBy = actor?.userName || 'Platform Admin';
      const safeExt = cleanedMime === 'image/jpeg' || cleanedMime === 'image/jpg' ? 'jpg' : cleanedMime === 'image/webp' ? 'webp' : 'png';
      const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
      const objectKey = `tenants/${targetId}/branding/${assetType}_${uniqueSuffix}.${safeExt}`;
      const assetId = `brand_${targetId}_${assetType}_${uniqueSuffix}`;
      const assetUrl = `/api/erp/storage/asset/${assetId}`;

      // 3. Persist to configured object storage (Cloudflare R2 if configured)
      if (checkIsR2Configured()) {
        try {
          const r2Client = getR2Client();
          if (r2Client) {
            const bucketName = getR2BucketName();
            await r2Client.send(
              new PutObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                Body: buffer,
                ContentType: cleanedMime,
                Metadata: {
                  tenantId: targetId,
                  assetType,
                  uploadedBy,
                  uploadedAt,
                },
              })
            );
          }
        } catch (uploadErr: any) {
          console.error('Failed to upload branding asset to R2 bucket:', uploadErr);
          return res.status(500).json({
            error: 'UPLOAD_FAILED',
            code: 'UPLOAD_FAILED',
            message: 'Failed to upload asset to object storage.',
          });
        }
      }

      if (!db.tenantAssets) {
        db.tenantAssets = {};
      }

      // Store in dedicated object storage layer (binary buffer, not string in tenant table)
      db.tenantAssets[assetId] = {
        assetId,
        objectKey,
        tenantId: targetId,
        assetType,
        mimeType: cleanedMime,
        size: assetSize,
        buffer,
        fileName: fileName || `${assetType}.${safeExt}`,
        uploadedAt,
        uploadedBy,
      };

      // 4. Save ONLY asset metadata/reference/URL in branding configuration
      try {
        if (assetType === 'logo') {
          tenant.logoUrl = assetUrl;
          tenant.headerLogoUrl = assetUrl;
          tenant.sidebarLogoUrl = assetUrl;
        } else if (assetType === 'hero') {
          tenant.loginHeroUrl = assetUrl;
        } else if (assetType === 'bg') {
          tenant.loginBgUrl = assetUrl;
        } else if (assetType === 'header') {
          tenant.headerLogoUrl = assetUrl;
        } else if (assetType === 'sidebar') {
          tenant.sidebarLogoUrl = assetUrl;
        } else if (assetType === 'favicon') {
          tenant.faviconUrl = assetUrl;
        }

        if (!tenant.branding_assets) tenant.branding_assets = {};
        tenant.branding_assets[assetType] = {
          assetId,
          objectKey,
          url: assetUrl,
          mimeType: cleanedMime,
          size: assetSize,
          uploaded_at: uploadedAt,
          uploaded_by: uploadedBy,
          fileName: fileName || `${assetType}.${safeExt}`,
        };

        tenant.updated_at = uploadedAt;

        savePersistentTenantBranding(db);
        await syncTenantBrandingToSupabase(targetId, tenant);
      } catch (metaErr: any) {
        return res.status(500).json({
          error: 'METADATA_SAVE_FAILED',
          code: 'METADATA_SAVE_FAILED',
          message: 'Failed to update tenant branding metadata reference.',
        });
      }

      logAdminAction(
        actor,
        targetId,
        'TENANT_BRANDING_ASSET_UPLOAD',
        'Branding',
        'TENANT',
        targetId,
        null,
        { assetType, assetUrl, objectKey, size: assetSize, mimeType: cleanedMime },
        `Uploaded branding asset ${assetType} (${assetSize} bytes) for tenant ${targetId}`
      );

      res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');

      res.json({
        success: true,
        assetId,
        assetUrl,
        objectKey,
        assetType,
        mimeType: cleanedMime,
        size: assetSize,
        uploaded_at: uploadedAt,
        message: `${assetType} uploaded to object storage and linked successfully.`,
      });
    } catch (err: any) {
      res.status(500).json({
        error: 'UPLOAD_FAILED',
        code: 'UPLOAD_FAILED',
        message: err.message || 'An unexpected error occurred during asset upload.',
      });
    }
  });

  // 1.2 RESET DEMO PREVIEW (Requirement 10 & 11)
  router.get('/tenants/:id/reset-demo-preview', (req: Request, res: Response) => {
    try {
      const targetTenantId = req.params.id;

      // Production protection: company_pixel_syntax is strictly blocked
      if (targetTenantId === 'company_pixel_syntax') {
        return res.status(403).json({
          error: 'CANNOT RESET PRODUCTION TENANT: Pixel Syntax Delivery Software. is live protected. Operation blocked.',
          code: 'PRODUCTION_RESET_PROHIBITED',
        });
      }

      // Backend independently verifies target tenant is company_demo
      if (targetTenantId !== 'company_demo') {
        return res.status(403).json({
          error: 'RESET DEMO is strictly restricted to company_demo. Arbitrary tenants are forbidden.',
          code: 'DEMO_RESET_RESTRICTED',
        });
      }

      const tenant = findTenant(targetTenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      if (tenant.go_live_status === 'LIVE' || tenant.is_live_protected) {
        return res.status(403).json({
          error: `CANNOT RESET LIVE TENANT: "${tenant.name}" is marked as LIVE. Only training/demo environments can be reset.`,
          code: 'PRODUCTION_RESET_PROHIBITED',
        });
      }

      const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === targetTenantId);
      const candidates = (db.candidates || []).filter((c: any) => c.tenant_id === targetTenantId && !c.archived);
      const projects = (db.projects || []).filter((p: any) => p.tenant_id === targetTenantId);
      const vehicles = getAllVehicles(targetTenantId);
      const sims = getAllSims(targetTenantId);
      const assignments = vehicles.filter((v: any) => v.assigned_rider_id || v.assignedRiderId || v.status === 'Assigned').length;
      const payroll = (db.payrollRecords || []).filter((pr: any) => pr.tenant_id === targetTenantId);
      const fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === targetTenantId);
      const salik = (db.salikRecords || []).filter((s: any) => s.tenant_id === targetTenantId);
      const documents = (db.documents || []).filter((d: any) => d.tenant_id === targetTenantId);
      const staffUsers = (db.users || []).filter((u: any) => u.tenantId === targetTenantId);

      res.json({
        success: true,
        tenantId: targetTenantId,
        tenantName: tenant.name,
        counts: {
          employees: employees.length,
          candidates: candidates.length,
          projects: projects.length,
          vehicles: vehicles.length,
          sims: sims.length,
          assignments,
          payroll: payroll.length,
          fines: fines.length,
          salik: salik.length,
          documents: documents.length,
        },
        preservedConfig: {
          tenantRecord: tenant.name,
          domainMapping: tenant.domain || 'demo.apexfleet.io',
          branding: true,
          platformConfig: true,
          staffAccountsCount: staffUsers.length,
          rolesRBAC: true,
          documentTypeConfig: true,
          payrollFormulas: true,
          auditArchitecture: true,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 1.3 RESET DEMO / TRAINING DATA (Strict Protection: Requirements 10, 11, 12, 13)
  router.post('/tenants/:id/reset-demo-data', (req: Request, res: Response) => {
    try {
      const targetTenantId = req.params.id;
      const actor = (req as any).adminActor;

      // CRITICAL PRODUCTION SAFEGUARD
      // company_pixel_syntax must NEVER be reset through any startup, restart, or endpoint
      if (targetTenantId === 'company_pixel_syntax') {
        return res.status(403).json({
          error: 'CANNOT RESET PRODUCTION TENANT: Pixel Syntax Delivery Software. is live protected. Operation blocked.',
          code: 'PRODUCTION_RESET_PROHIBITED',
        });
      }

      // Backend independently verifies target tenant is company_demo
      if (targetTenantId !== 'company_demo') {
        return res.status(403).json({
          error: 'RESET DEMO is strictly restricted to company_demo. Arbitrary tenant resets are forbidden.',
          code: 'DEMO_RESET_RESTRICTED',
        });
      }

      const tenant = findTenant(targetTenantId);
      if (!tenant) return res.status(404).json({ error: 'Tenant not found.' });

      // Target environment/type check: Must be DEMO/TRAINING (not LIVE)
      if (tenant.go_live_status === 'LIVE' || tenant.is_live_protected) {
        return res.status(403).json({
          error: `CANNOT RESET LIVE TENANT: "${tenant.name}" is marked as LIVE. Only training/demo tenants can be reset.`,
          code: 'PRODUCTION_RESET_PROHIBITED',
        });
      }

      // Requirement 11: Require exact confirmation phrase "RESET DEMO"
      const phrase = (req.body?.confirmationPhrase || '').trim();
      if (phrase !== 'RESET DEMO') {
        return res.status(400).json({
          error: 'Confirmation failed: Exact phrase "RESET DEMO" is required.',
          code: 'INVALID_CONFIRMATION_PHRASE',
        });
      }

      // Capture affected counts before reset for audit log (Requirement 15)
      const affectedCounts = {
        fines: (db.trafficFines || []).filter((f: any) => f.tenant_id === targetTenantId).length,
        salik: (db.salikRecords || []).filter((s: any) => s.tenant_id === targetTenantId).length,
        payroll: (db.payrollRecords || []).filter((p: any) => p.tenant_id === targetTenantId).length,
        vehicle_assignments: (db.fleetVehicles || []).filter((v: any) => v.tenant_id === targetTenantId && (v.assigned_rider_id || v.assignedRiderId)).length,
        sim_assignments: (db.fleetSims || []).filter((s: any) => s.tenant_id === targetTenantId && s.assigned_rider_id).length,
      };

      // Safe Demo Reset (Requirement 12): Reset TRAINING OPERATIONAL DATA only.
      // 1. Clear simulated operational traffic fines for company_demo
      if (db.trafficFines) {
        db.trafficFines = db.trafficFines.filter((f: any) => f.tenant_id !== targetTenantId);
      }
      // 2. Clear simulated operational salik toll records for company_demo
      if (db.salikRecords) {
        db.salikRecords = db.salikRecords.filter((s: any) => s.tenant_id !== targetTenantId);
      }
      // 3. Clear simulated payroll test run records for company_demo
      if (db.payrollRecords) {
        db.payrollRecords = db.payrollRecords.filter((p: any) => p.tenant_id !== targetTenantId);
      }

      // 4. Reset vehicle assignments in company_demo back to available baseline
      (db.fleetVehicles || []).forEach((v: any) => {
        if (v.tenant_id === targetTenantId) {
          v.assigned_rider_id = null;
          v.assignedRiderId = null;
          v.assignedRiderName = null;
          v.status = 'Available';
          v.assignment_status = 'Unassigned';
        }
      });

      // 5. Reset SIM assignments in company_demo back to available baseline
      (db.fleetSims || []).forEach((s: any) => {
        if (s.tenant_id === targetTenantId) {
          s.assigned_rider_id = null;
          s.assigned_rider_name = null;
          s.status = 'Available';
          s.assignment_status = 'Unassigned';
        }
      });

      // 6. Retain demo staff employees but reset their operational status to clean training state
      (db.masterEmployees || []).forEach((e: any) => {
        if (e.tenant_id === targetTenantId) {
          e.current_status = 'Assigned / Active';
          e.status = 'Assigned / Active';
        }
      });

      // PRESERVED BY DESIGN (Requirement 12):
      // - company_demo tenant record
      // - domain mapping (tenant.domain)
      // - branding (tenant.logoUrl, tenant.loginHeroUrl, colors, etc.)
      // - Platform/Admin configuration
      // - staff login accounts (db.users)
      // - roles/RBAC (db.roles)
      // - document type configuration (db.documentTypes)
      // - payroll formulas/templates
      // - project configuration (db.projects)
      // - audit architecture (db.auditLogs preserved, never deleted)

      logAdminAction(
        actor,
        targetTenantId,
        'DEMO_RESET',
        'Tenant Management',
        'TENANT',
        targetTenantId,
        null,
        {
          confirmation_timestamp: new Date().toISOString(),
          affected_counts: affectedCounts,
          preserved_config: ['branding', 'domain_mapping', 'users', 'roles', 'document_types', 'formulas'],
        },
        `Executed demo data reset for workspace "${tenant.name}" (${targetTenantId})`
      );

      res.json({
        success: true,
        message: `Training workspace "${tenant.name}" has been cleanly reset for simulation. All system configuration and staff accounts were preserved.`,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 2. MAIN ADMIN DASHBOARD (Live counts)
  // ==========================================
  router.get('/dashboard', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const tenant = findTenant(tenantId) || { id: tenantId, name: tenantId, go_live_status: 'TESTING' };

      const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);
      const activeEmployees = employees.filter((e: any) => !e.is_archived);
      const vehicles = getAllVehicles(tenantId);
      const sims = getAllSims(tenantId);
      const fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === tenantId);
      const salik = (db.salikRecords || []).filter((s: any) => s.tenant_id === tenantId);
      const projects = (db.projects || []).filter((p: any) => p.tenant_id === tenantId);
      const candidates = (db.candidates || []).filter((c: any) => c.tenant_id === tenantId && !c.archived);
      const payroll = (db.payrollRecords || []).filter((pr: any) => pr.tenant_id === tenantId);
      const pStats = await calculatePassportStats(tenantId, getSupabaseClient());
      const banned = ['admin_user', 'ahmed', 'raza', 'fatima_hr', 'bilal_payroll'];
      const users = (db.users || []).filter(
        (u: any) => (u.tenantId === tenantId || u.tenant_id === tenantId) &&
          !banned.includes((u.username || '').toLowerCase())
      );

      // Scan duplicate counts
      const eidMap: Record<string, number> = {};
      const codeMap: Record<string, number> = {};
      let empDuplicates = 0;
      employees.forEach((e: any) => {
        const eid = (e.emirates_id_number || e.emirates_id || '').replace(/\D/g, '');
        if (eid && eid.length >= 8) {
          eidMap[eid] = (eidMap[eid] || 0) + 1;
        }
        const code = (e.employee_code || '').trim().toUpperCase();
        if (code) {
          codeMap[code] = (codeMap[code] || 0) + 1;
        }
      });
      Object.values(eidMap).forEach((c) => { if (c > 1) empDuplicates += c; });
      Object.values(codeMap).forEach((c) => { if (c > 1) empDuplicates += c; });

      const plateMap: Record<string, number> = {};
      let vehDuplicates = 0;
      vehicles.forEach((v: any) => {
        const plate = (v.plateNumber || v.plate_number || '').trim().toUpperCase();
        if (plate) {
          plateMap[plate] = (plateMap[plate] || 0) + 1;
        }
      });
      Object.values(plateMap).forEach((c) => { if (c > 1) vehDuplicates += c; });

      const simMap: Record<string, number> = {};
      let simDuplicates = 0;
      sims.forEach((s: any) => {
        const num = (s.sim_number || s.simNumber || '').replace(/\D/g, '');
        if (num) {
          simMap[num] = (simMap[num] || 0) + 1;
        }
      });
      Object.values(simMap).forEach((c) => { if (c > 1) simDuplicates += c; });

      const duplicateWarningsCount = empDuplicates + vehDuplicates + simDuplicates;

      // Scan orphan relations & integrity issues
      const empIds = new Set(employees.map((e: any) => e.id));
      const projIds = new Set(projects.map((p: any) => p.id));
      const vehIds = new Set(vehicles.map((v: any) => v.id));

      let orphanRelationsCount = 0;
      sims.forEach((s: any) => {
        if (s.assigned_to_id && !empIds.has(s.assigned_to_id)) orphanRelationsCount++;
      });
      vehicles.forEach((v: any) => {
        const assignedEmp = v.current_assigned_employee_id || v.currentRiderId;
        if (assignedEmp && !empIds.has(assignedEmp)) orphanRelationsCount++;
      });
      employees.forEach((e: any) => {
        if (e.project_id && e.project_id !== 'Unassigned' && !projIds.has(e.project_id)) {
          orphanRelationsCount++;
        }
      });

      const dataIntegrityIssuesCount = duplicateWarningsCount + orphanRelationsCount;

      res.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          code: tenant.code,
          domain: tenant.domain,
          status: tenant.status || 'ACTIVE',
          go_live_status: tenant.go_live_status || (tenant.id === 'company_pixel_syntax' ? 'LIVE' : 'TESTING'),
          is_live_protected: (tenant.go_live_status || (tenant.id === 'company_pixel_syntax' ? 'LIVE' : 'TESTING')) === 'LIVE',
        },
        counts: {
          employees: activeEmployees.length,
          totalEmployeesWithArchived: employees.length,
          candidates: candidates.length,
          vehicles: vehicles.length,
          simCards: sims.length,
          trafficFines: fines.length,
          salikTransactions: salik.length,
          projects: projects.length,
          payrollRecords: payroll.length,
          activeUsers: users.filter((u: any) => (u.status || 'ACTIVE') === 'ACTIVE').length,
          passports: pStats.totalTracked ?? 0,
          passportsWithCompany: pStats.withCompany ?? 0,
          passportsWithRider: pStats.withRider ?? 0,
          duplicateWarnings: duplicateWarningsCount,
          dataIntegrityIssues: dataIntegrityIssuesCount,
          orphanRelations: orphanRelationsCount,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 3. EMPLOYEES ADMIN
  // ==========================================
  router.get('/employees', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      const statusFilter = req.query.status as string;
      const projectFilter = req.query.project as string;

      let employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);
      if (tenantId === 'company_pixel_syntax' && employees.length === 0) {
        if (!db.masterEmployees) db.masterEmployees = [];
        db.masterEmployees.push(...AUTHORITATIVE_MASTER_EMPLOYEES);
        employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);
      }

      if (search) {
        employees = employees.filter((e: any) => {
          const name = (e.full_name || '').toLowerCase();
          const code = (e.employee_code || '').toLowerCase();
          const eid = (e.emirates_id_number || e.emirates_id || '').toLowerCase();
          const phone = (e.mobile_number || e.phone || '').toLowerCase();
          return name.includes(search) || code.includes(search) || eid.includes(search) || phone.includes(search);
        });
      }

      if (statusFilter && statusFilter !== 'ALL') {
        employees = employees.filter((e: any) => e.current_status === statusFilter);
      }

      if (projectFilter && projectFilter !== 'ALL') {
        employees = employees.filter((e: any) => e.project_id === projectFilter || e.project_name === projectFilter);
      }

      const formatted = employees.map((e: any) => ({
        id: e.id,
        tenant_id: e.tenant_id,
        full_name: e.full_name,
        employee_code: e.employee_code,
        emirates_id: e.emirates_id_number || e.emirates_id,
        email: e.email || '',
        mobile_number: e.mobile_number || e.personal_mobile || e.phone,
        current_status: e.current_status || 'Active',
        project_id: e.project_id,
        project_name: e.project_name || 'Unassigned',
        current_bike_id: e.current_bike_id,
        current_bike_plate: e.current_bike_plate || null,
        current_sim_id: e.current_sim_id,
        current_sim_number: e.current_sim_number || null,
        designation: e.designation || 'Rider',
        branch_name: e.branch_name,
        is_archived: Boolean(e.is_archived),
        created_at: e.created_at || '2026-01-01',
        created_by: e.created_by || 'System Onboarding',
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/employees/:id/dependencies', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const empId = req.params.id;
      const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);

      if (!emp) return res.status(404).json({ error: 'Employee not found.' });

      // Check projects
      const activeProject = emp.project_name && emp.project_name !== 'Unassigned' && emp.project_name !== '-'
        ? { id: emp.project_id, name: emp.project_name }
        : null;

      const projectAssignments = (db.employeeProjectAssignments || []).filter(
        (pa: any) => pa.employee_id === empId && pa.tenant_id === tenantId
      );

      // Check bike assignments
      const activeBike = emp.current_bike_plate
        ? { id: emp.current_bike_id, plate: emp.current_bike_plate }
        : null;

      const bikeAssignments = (db.vehicleAssignments || []).filter(
        (va: any) => va.employee_id === empId && va.tenant_id === tenantId
      );

      // Check SIM assignments
      const activeSim = emp.current_sim_number
        ? { id: emp.current_sim_id, simNumber: emp.current_sim_number }
        : null;

      const simAssignments = (db.simAssignments || []).filter(
        (sa: any) => (sa.employee_id === empId || sa.assigned_to_id === empId) && sa.tenant_id === tenantId
      );

      // Check fines
      const fines = (db.trafficFines || []).filter(
        (f: any) => (f.rider_id === empId || f.employee_id === empId) && f.tenant_id === tenantId
      );

      // Check Salik
      const salik = (db.salikRecords || []).filter(
        (s: any) => s.assigned_employee_id === empId && s.tenant_id === tenantId
      );

      // Check Payroll
      const payroll = (db.payrollRecords || []).filter(
        (p: any) => p.employee_id === empId && p.tenant_id === tenantId
      );

      // Check Audits
      const audits = (db.auditLogs || []).filter(
        (a: any) => (a.entity_id === empId || (a.details && a.details.includes(emp.employee_code))) && a.tenant_id === tenantId
      );

      // Check Loans
      const loans = (db.employeeLoans || db.loans || []).filter(
        (l: any) => (l.employee_id === empId || l.employeeId === empId) && l.tenant_id === tenantId
      );
      const activeLoans = loans.filter(
        (l: any) => l.status === 'ACTIVE' || l.status === 'APPROVED' || l.status === 'PENDING'
      );

      // Check Attendance
      const attendance = (db.attendanceRecords || db.attendance || []).filter(
        (a: any) => (a.employee_id === empId || a.employeeId === empId) && a.tenant_id === tenantId
      );

      const hasBlockingPointers = Boolean(activeBike || activeSim || activeProject);
      const isLive = isTenantLive(tenantId);

      res.json({
        employee: {
          id: emp.id,
          name: emp.full_name,
          code: emp.employee_code,
          status: emp.current_status,
        },
        dependencies: {
          activeProject,
          historicalProjectsCount: projectAssignments.length,
          activeBike,
          historicalBikesCount: bikeAssignments.length,
          activeSim,
          historicalSimsCount: simAssignments.length,
          trafficFinesCount: fines.length,
          trafficFinesTotalAED: fines.reduce((sum: number, f: any) => sum + (f.fineAmountAED || f.amount || 0), 0),
          salikTransactionsCount: salik.length,
          payrollRecordsCount: payroll.length,
          loansCount: loans.length,
          activeLoansCount: activeLoans.length,
          attendanceRecordsCount: attendance.length,
          auditLogsCount: audits.length,
        },
        hasBlockingPointers,
        isLiveTenant: isLive,
        canDeleteDirectly: !isLive && !hasBlockingPointers,
        recommendation: isLive
          ? 'Live tenant: Hard delete is restricted. Recommend archiving or deactivating the employee.'
          : hasBlockingPointers
          ? 'Active bike or SIM pointers exist. Deletion will automatically unassign them and free assets.'
          : 'Ready for deletion.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/employees/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const empId = req.params.id;
      const index = (db.masterEmployees || []).findIndex((e: any) => e.id === empId && e.tenant_id === tenantId);

      if (index === -1) return res.status(404).json({ error: 'Employee not found.' });

      const oldEmp = { ...db.masterEmployees[index] };
      const updates = req.body;

      // Clean updates to prevent overriding system identity
      delete updates.id;
      delete updates.tenant_id;

      db.masterEmployees[index] = {
        ...db.masterEmployees[index],
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const actor = (req as any).adminActor;
      logAdminAction(
        actor,
        tenantId,
        'ADMIN_EMPLOYEE_EDIT',
        'Employees',
        'EMPLOYEE',
        empId,
        oldEmp,
        db.masterEmployees[index],
        updates.reason || 'Master employee record edited via Platform Admin'
      );

      res.json({ success: true, employee: db.masterEmployees[index] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/employees/:id/archive', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const empId = req.params.id;
      const emp = (db.masterEmployees || []).find((e: any) => e.id === empId && e.tenant_id === tenantId);

      if (!emp) return res.status(404).json({ error: 'Employee not found.' });

      const oldState = { is_archived: emp.is_archived, current_status: emp.current_status };
      emp.is_archived = true;
      emp.current_status = 'Archived';
      emp.archived_at = new Date().toISOString();
      emp.archived_by = (req as any).adminActor?.userName || 'Platform Admin';

      // Safe pointer cleanup: release active bike if assigned
      if (emp.current_bike_id || emp.current_bike_plate) {
        const allVehs = getAllVehicles(tenantId);
        const veh = allVehs.find((v: any) => v.id === emp.current_bike_id || v.plateNumber === emp.current_bike_plate);
        if (veh) {
          veh.status = 'AVAILABLE';
          veh.current_assigned_employee_id = null;
          veh.current_assigned_employee_name = null;
          veh.currentRiderId = null;
          veh.currentRider = null;
        }
        emp.current_bike_id = null;
        emp.current_bike_plate = null;
      }

      // Safe pointer cleanup: release active SIM if assigned
      if (emp.current_sim_id || emp.current_sim_number) {
        const sim = (db.simCardsMaster || []).find(
          (s: any) => s.id === emp.current_sim_id || s.sim_number === emp.current_sim_number
        );
        if (sim) {
          sim.status = 'AVAILABLE';
          sim.assigned_to_id = null;
          sim.assigned_to_name = null;
          sim.current_employee_id = null;
          sim.current_employee_name = null;
        }
        emp.current_sim_id = null;
        emp.current_sim_number = null;
      }

      // Safe pointer cleanup: unlink active project
      emp.project_id = null;
      emp.project_name = 'Unassigned';

      const actor = (req as any).adminActor;
      logAdminAction(
        actor,
        tenantId,
        'ADMIN_EMPLOYEE_ARCHIVED',
        'Employees',
        'EMPLOYEE',
        empId,
        oldState,
        { is_archived: true, current_status: 'Archived' },
        req.body?.reason || 'Employee archived via Platform Admin',
        `Employee ${emp.full_name} (${emp.employee_code}) archived by ${actor.userName}`,
        {
          employee_id: emp.id,
          employee_name: emp.full_name,
          dependencies_found: req.body?.dependencies_found || null,
        }
      );

      res.json({ success: true, employee: emp, message: 'Employee archived successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/employees/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const empId = req.params.id;
      const actor = (req as any).adminActor;
      const isLive = isTenantLive(tenantId);

      // LIVE Tenant safety checks
      if (isLive) {
        if (!actor.isSuperAdmin && actor.userRole !== 'SUPER_ADMIN') {
          return res.status(403).json({
            error: 'Live Tenant Safety Restriction: Hard deletion in a LIVE tenant requires SUPER_ADMIN credentials.',
          });
        }
        const reason = req.body?.reason || req.query.reason;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Hard deletion requires an explicit audit reason (minimum 10 characters).',
          });
        }
        const confirmation = req.body?.confirmation_phrase || req.query.confirmation_phrase;
        if (confirmation !== 'CONFIRM DELETE') {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Please provide confirmation_phrase "CONFIRM DELETE".',
          });
        }
      }

      const index = (db.masterEmployees || []).findIndex((e: any) => e.id === empId && e.tenant_id === tenantId);
      if (index === -1) return res.status(404).json({ error: 'Employee not found.' });

      const emp = db.masterEmployees[index];

      // Safe pointer cleanup: free active bike if assigned
      if (emp.current_bike_id || emp.current_bike_plate) {
        const allVehs = getAllVehicles(tenantId);
        const veh = allVehs.find((v: any) => v.id === emp.current_bike_id || v.plateNumber === emp.current_bike_plate);
        if (veh) {
          veh.status = 'AVAILABLE';
          veh.current_assigned_employee_id = null;
          veh.current_assigned_employee_name = null;
          veh.currentRiderId = null;
          veh.currentRider = null;
        }
      }

      // Safe pointer cleanup: free active SIM if assigned
      if (emp.current_sim_id || emp.current_sim_number) {
        const sim = (db.simCardsMaster || []).find(
          (s: any) => s.id === emp.current_sim_id || s.sim_number === emp.current_sim_number
        );
        if (sim) {
          sim.status = 'AVAILABLE';
          sim.assigned_to_id = null;
          sim.assigned_to_name = null;
          sim.current_employee_id = null;
          sim.current_employee_name = null;
        }
      }

      // Safe pointer cleanup: clear project assignments to eliminate orphan references
      if (Array.isArray(db.employeeProjectAssignments)) {
        db.employeeProjectAssignments = db.employeeProjectAssignments.filter(
          (pa: any) => !(pa.employee_id === empId && pa.tenant_id === tenantId)
        );
      }
      if (Array.isArray(db.projectRiderMappings)) {
        db.projectRiderMappings = db.projectRiderMappings.filter(
          (pm: any) => !(pm.employee_id === empId && pm.tenant_id === tenantId)
        );
      }

      // Execute removal
      const [deleted] = db.masterEmployees.splice(index, 1);

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_EMPLOYEE_REMOVED',
        'Employees',
        'EMPLOYEE',
        empId,
        deleted,
        null,
        req.body?.reason || 'Employee permanently removed via Platform Admin',
        `Employee ${emp.full_name} (${emp.employee_code}) permanently removed by ${actor.userName}`,
        {
          employee_id: emp.id,
          employee_name: emp.full_name,
          dependencies_found: req.body?.dependencies_found || null,
        }
      );

      res.json({ success: true, deletedEmployeeId: empId, message: 'Employee safely removed from platform.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 4. DUPLICATE EMPLOYEE DETECTION & MERGE
  // ==========================================
  router.get('/duplicates/employees', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);

      // Groups by normalized Emirates ID
      const byEid = new Map<string, any[]>();
      // Groups by normalized Employee Code
      const byCode = new Map<string, any[]>();
      // Groups by normalized Mobile
      const byMobile = new Map<string, any[]>();

      employees.forEach((emp: any) => {
        // Normalize Emirates ID (digits only, e.g.  -> )
        const rawEid = emp.emirates_id_number || emp.emirates_id || '';
        const normEid = rawEid.replace(/\D/g, '');
        if (normEid.length >= 9) {
          if (!byEid.has(normEid)) byEid.set(normEid, []);
          byEid.get(normEid)!.push(emp);
        }

        // Normalize Code
        const normCode = (emp.employee_code || '').trim().toUpperCase();
        if (normCode) {
          if (!byCode.has(normCode)) byCode.set(normCode, []);
          byCode.get(normCode)!.push(emp);
        }

        // Normalize Mobile (last 9 digits)
        const rawPhone = emp.mobile_number || emp.phone || '';
        const normPhone = rawPhone.replace(/\D/g, '').slice(-9);
        if (normPhone.length === 9) {
          if (!byMobile.has(normPhone)) byMobile.set(normPhone, []);
          byMobile.get(normPhone)!.push(emp);
        }
      });

      const duplicateGroups: any[] = [];
      const seenGroupKeys = new Set<string>();

      byEid.forEach((list, key) => {
        if (list.length > 1) {
          const ids = list.map((e) => e.id).sort().join('_');
          if (!seenGroupKeys.has(ids)) {
            seenGroupKeys.add(ids);
            duplicateGroups.push({
              id: `dup_eid_${key}`,
              rule: 'DUPLICATE_EMIRATES_ID',
              matchKey: key,
              matchType: 'Emirates ID',
              matchValue: list[0].emirates_id_number || list[0].emirates_id,
              records: list,
            });
          }
        }
      });

      byCode.forEach((list, key) => {
        if (list.length > 1) {
          const ids = list.map((e) => e.id).sort().join('_');
          if (!seenGroupKeys.has(ids)) {
            seenGroupKeys.add(ids);
            duplicateGroups.push({
              id: `dup_code_${key}`,
              rule: 'DUPLICATE_EMPLOYEE_CODE',
              matchKey: key,
              matchType: 'Employee Code',
              matchValue: key,
              records: list,
            });
          }
        }
      });

      byMobile.forEach((list, key) => {
        if (list.length > 1) {
          const ids = list.map((e) => e.id).sort().join('_');
          if (!seenGroupKeys.has(ids)) {
            seenGroupKeys.add(ids);
            duplicateGroups.push({
              id: `dup_phone_${key}`,
              rule: 'DUPLICATE_PHONE_NUMBER',
              matchKey: key,
              matchType: 'Mobile Phone',
              matchValue: list[0].mobile_number || list[0].phone,
              records: list,
            });
          }
        }
      });

      res.json(duplicateGroups);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/duplicates/employees/merge', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const { primaryId, secondaryId, action, reason } = req.body;
      const actor = (req as any).adminActor;

      if (!primaryId || !secondaryId) {
        return res.status(400).json({ error: 'Both primaryId and secondaryId are required.' });
      }

      const employees = db.masterEmployees || [];
      const primaryIndex = employees.findIndex((e: any) => e.id === primaryId && e.tenant_id === tenantId);
      const secondaryIndex = employees.findIndex((e: any) => e.id === secondaryId && e.tenant_id === tenantId);

      if (primaryIndex === -1 || secondaryIndex === -1) {
        return res.status(404).json({ error: 'One or both employee records not found.' });
      }

      const primary = employees[primaryIndex];
      const secondary = employees[secondaryIndex];

      if (action === 'MERGE') {
        // Copy non-empty attributes from secondary to primary if primary lacks them
        if (!primary.current_bike_id && secondary.current_bike_id) {
          primary.current_bike_id = secondary.current_bike_id;
          primary.current_bike_plate = secondary.current_bike_plate;
        }
        if (!primary.current_sim_id && secondary.current_sim_id) {
          primary.current_sim_id = secondary.current_sim_id;
          primary.current_sim_number = secondary.current_sim_number;
        }
        if ((!primary.project_id || primary.project_id === 'Unassigned') && secondary.project_id) {
          primary.project_id = secondary.project_id;
          primary.project_name = secondary.project_name;
        }

        // Re-point fines
        (db.trafficFines || []).forEach((f: any) => {
          if (f.rider_id === secondaryId) {
            f.rider_id = primaryId;
            f.rider_name = primary.full_name;
          }
        });

        // Re-point Salik
        (db.salikRecords || []).forEach((s: any) => {
          if (s.assigned_employee_id === secondaryId) {
            s.assigned_employee_id = primaryId;
            s.assigned_employee_name = primary.full_name;
          }
        });

        // Soft archive secondary
        secondary.is_archived = true;
        secondary.current_status = 'Merged / Inactive';
        secondary.merged_into_id = primaryId;

        logAdminAction(
          actor,
          tenantId,
          'ADMIN_DUPLICATE_MERGE',
          'Employees',
          'EMPLOYEE',
          primaryId,
          { primaryBefore: primary, secondaryBefore: secondary },
          { mergedPrimary: primary, mergedSecondary: secondary },
          reason || `Merged duplicate employee ${secondary.employee_code} into ${primary.employee_code}`
        );

        return res.json({ success: true, primaryEmployee: primary, archivedDuplicate: secondary });
      } else if (action === 'KEEP_A' || action === 'KEEP_B') {
        const keepPrimary = action === 'KEEP_A';
        const toKeep = keepPrimary ? primary : secondary;
        const toArchive = keepPrimary ? secondary : primary;

        toArchive.is_archived = true;
        toArchive.current_status = 'Archived Duplicate';

        logAdminAction(
          actor,
          tenantId,
          'ADMIN_DUPLICATE_RESOLVE',
          'Employees',
          'EMPLOYEE',
          toKeep.id,
          { kept: toKeep.id, archived: toArchive.id },
          { status: 'RESOLVED' },
          reason || `Resolved duplicate by keeping ${toKeep.employee_code} and archiving ${toArchive.employee_code}`
        );

        return res.json({ success: true, kept: toKeep, archived: toArchive });
      }

      res.status(400).json({ error: 'Invalid action. Must be MERGE, KEEP_A, or KEEP_B.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 5. VEHICLES / BIKES ADMIN & DUPLICATES
  // ==========================================
  router.get('/vehicles', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      let vehicles = getAllVehicles(tenantId);

      if (search) {
        vehicles = vehicles.filter((v: any) => {
          const plate = (v.plateNumber || v.plate_number || '').toLowerCase();
          const code = (v.vehicleCode || v.vehicle_code || '').toLowerCase();
          const vin = (v.chassisNumber || v.vin || '').toLowerCase();
          const make = (v.make || '').toLowerCase();
          const model = (v.model || '').toLowerCase();
          return plate.includes(search) || code.includes(search) || vin.includes(search) || make.includes(search) || model.includes(search);
        });
      }

      const formatted = vehicles.map((v: any) => ({
        id: v.id,
        tenant_id: v.tenant_id,
        plate_number: v.plateNumber || v.plate_number,
        vehicle_code: v.vehicleCode || v.vehicle_code || `VH-${v.plateNumber || '00'}`,
        vin: v.chassisNumber || v.vin || '-',
        make: v.make || 'Honda',
        model: v.model || 'Motorcycle',
        status: v.status || 'AVAILABLE',
        assigned_employee_id: v.current_assigned_employee_id || v.currentRiderId,
        assigned_employee_name: v.current_assigned_employee_name || v.currentRider || null,
        project_name: v.projectName || v.project_name || '-',
        vendor: v.vendorCompany || v.ownership || 'Company Owned',
        created_at: v.created_at || '2026-01-01',
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/duplicates/vehicles', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const vehicles = getAllVehicles(tenantId);

      const byPlate = new Map<string, any[]>();
      const byVin = new Map<string, any[]>();

      vehicles.forEach((v: any) => {
        const plate = (v.plateNumber || v.plate_number || '').trim().toUpperCase();
        if (plate) {
          if (!byPlate.has(plate)) byPlate.set(plate, []);
          byPlate.get(plate)!.push(v);
        }

        const vin = (v.chassisNumber || v.vin || '').trim().toUpperCase();
        if (vin && vin !== '-') {
          if (!byVin.has(vin)) byVin.set(vin, []);
          byVin.get(vin)!.push(v);
        }
      });

      const duplicates: any[] = [];
      byPlate.forEach((list, key) => {
        if (list.length > 1) {
          duplicates.push({
            id: `dup_plate_${key}`,
            rule: 'DUPLICATE_PLATE_NUMBER',
            matchType: 'Plate Number',
            matchValue: key,
            records: list,
          });
        }
      });

      byVin.forEach((list, key) => {
        if (list.length > 1) {
          duplicates.push({
            id: `dup_vin_${key}`,
            rule: 'DUPLICATE_VIN',
            matchType: 'VIN / Chassis Number',
            matchValue: key,
            records: list,
          });
        }
      });

      res.json(duplicates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/vehicles/:id/dependencies', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const vehId = req.params.id;
      const veh = getAllVehicles(tenantId).find((v: any) => v.id === vehId);

      if (!veh) return res.status(404).json({ error: 'Vehicle not found.' });

      const assignedEmpId = veh.current_assigned_employee_id || veh.currentRiderId;
      const assignedEmp = assignedEmpId
        ? (db.masterEmployees || []).find((e: any) => e.id === assignedEmpId)
        : null;

      const fines = (db.trafficFines || []).filter(
        (f: any) => (f.vehicle_id === vehId || f.plateNumber === veh.plateNumber || f.plate_number === veh.plateNumber) && f.tenant_id === tenantId
      );

      const salik = (db.salikRecords || []).filter(
        (s: any) => (s.vehicle_id === vehId || s.plate_number === veh.plateNumber) && s.tenant_id === tenantId
      );

      res.json({
        vehicle: {
          id: veh.id,
          plate: veh.plateNumber || veh.plate_number,
          status: veh.status,
        },
        hasActiveAssignment: Boolean(assignedEmp),
        assignedEmployee: assignedEmp ? { id: assignedEmp.id, name: assignedEmp.full_name, code: assignedEmp.employee_code } : null,
        trafficFinesCount: fines.length,
        salikCount: salik.length,
        canDeleteDirectly: !assignedEmp,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/vehicles/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const vehId = req.params.id;
      const actor = (req as any).adminActor;

      const updateInList = (list: any[]) => {
        const idx = (list || []).findIndex((v: any) => v.id === vehId && v.tenant_id === tenantId);
        if (idx !== -1) {
          list[idx] = { ...list[idx], ...req.body, updated_at: new Date().toISOString() };
          return list[idx];
        }
        return null;
      };

      const updated1 = updateInList(db.fleetVehicles);
      const updated2 = updateInList(db.vehicles);
      const updated = updated1 || updated2;

      if (!updated) return res.status(404).json({ error: 'Vehicle not found.' });

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_VEHICLE_EDIT',
        'Vehicles',
        'VEHICLE',
        vehId,
        null,
        updated,
        req.body?.reason || 'Vehicle record edited via Platform Admin'
      );

      res.json({ success: true, vehicle: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/vehicles/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const vehId = req.params.id;
      const actor = (req as any).adminActor;
      const veh = getAllVehicles(tenantId).find((v: any) => v.id === vehId);

      if (!veh) return res.status(404).json({ error: 'Vehicle not found.' });

      // Unassign employee if assigned
      const assignedEmpId = veh.current_assigned_employee_id || veh.currentRiderId;
      if (assignedEmpId) {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === assignedEmpId);
        if (emp && emp.current_bike_id === vehId) {
          emp.current_bike_id = null;
          emp.current_bike_plate = null;
        }
      }

      // Remove from both collections
      if (db.fleetVehicles) {
        const idx = db.fleetVehicles.findIndex((v: any) => v.id === vehId);
        if (idx !== -1) db.fleetVehicles.splice(idx, 1);
      }
      if (db.vehicles) {
        const idx = db.vehicles.findIndex((v: any) => v.id === vehId);
        if (idx !== -1) db.vehicles.splice(idx, 1);
      }

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_VEHICLE_DELETE',
        'Vehicles',
        'VEHICLE',
        vehId,
        veh,
        null,
        req.body?.reason || 'Vehicle deleted via Platform Admin'
      );

      res.json({ success: true, message: 'Vehicle deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 6. SIM CARDS ADMIN & DUPLICATES
  // ==========================================
  router.get('/sims', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      let sims = (db.simCardsMaster || []).filter((s: any) => s.tenant_id === tenantId);

      if (search) {
        sims = sims.filter((s: any) => {
          const num = (s.sim_number || s.simNumber || '').toLowerCase();
          const iccid = (s.iccid || '').toLowerCase();
          const emp = (s.assigned_to_name || '').toLowerCase();
          return num.includes(search) || iccid.includes(search) || emp.includes(search);
        });
      }

      const formatted = sims.map((s: any) => ({
        id: s.id,
        tenant_id: s.tenant_id,
        sim_number: s.sim_number || s.simNumber,
        provider: s.provider || 'Du',
        iccid: s.iccid || '-',
        status: s.status || 'AVAILABLE',
        assigned_employee_id: s.assigned_to_id,
        assigned_employee_name: s.assigned_to_name,
        project_name: s.project_name || '-',
        package_name: s.package_name || s.plan || 'Fleet Standard',
        created_at: s.created_at || '2026-01-01',
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/duplicates/sims', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const sims = (db.simCardsMaster || []).filter((s: any) => s.tenant_id === tenantId);

      const byNum = new Map<string, any[]>();
      const byIccid = new Map<string, any[]>();

      sims.forEach((s: any) => {
        const num = (s.sim_number || s.simNumber || '').replace(/\D/g, '');
        if (num) {
          if (!byNum.has(num)) byNum.set(num, []);
          byNum.get(num)!.push(s);
        }
        const iccid = (s.iccid || '').trim().toUpperCase();
        if (iccid && iccid !== '-') {
          if (!byIccid.has(iccid)) byIccid.set(iccid, []);
          byIccid.get(iccid)!.push(s);
        }
      });

      const duplicates: any[] = [];
      byNum.forEach((list, key) => {
        if (list.length > 1) {
          duplicates.push({
            id: `dup_sim_${key}`,
            rule: 'DUPLICATE_SIM_NUMBER',
            matchType: 'SIM Number',
            matchValue: key,
            records: list,
          });
        }
      });

      byIccid.forEach((list, key) => {
        if (list.length > 1) {
          duplicates.push({
            id: `dup_iccid_${key}`,
            rule: 'DUPLICATE_ICCID',
            matchType: 'ICCID',
            matchValue: key,
            records: list,
          });
        }
      });

      res.json(duplicates);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/sims/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const simId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.simCardsMaster || []).findIndex((s: any) => s.id === simId && s.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'SIM not found.' });

      const oldSim = { ...db.simCardsMaster[idx] };
      db.simCardsMaster[idx] = { ...db.simCardsMaster[idx], ...req.body, updated_at: new Date().toISOString() };

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_SIM_EDIT',
        'SIM Cards',
        'SIM_CARD',
        simId,
        oldSim,
        db.simCardsMaster[idx],
        req.body?.reason || 'SIM card record edited via Platform Admin'
      );

      res.json({ success: true, sim: db.simCardsMaster[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/sims/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const simId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.simCardsMaster || []).findIndex((s: any) => s.id === simId && s.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'SIM card not found.' });

      const sim = db.simCardsMaster[idx];

      // If assigned to employee, clean pointer
      if (sim.assigned_to_id) {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === sim.assigned_to_id);
        if (emp && emp.current_sim_id === simId) {
          emp.current_sim_id = null;
          emp.current_sim_number = null;
        }
      }

      const [deleted] = db.simCardsMaster.splice(idx, 1);

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_SIM_DELETE',
        'SIM Cards',
        'SIM_CARD',
        simId,
        deleted,
        null,
        req.body?.reason || 'SIM card deleted via Platform Admin'
      );

      res.json({ success: true, message: 'SIM card safely deleted.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 7. TRAFFIC FINES ADMIN
  // ==========================================
  router.get('/fines', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      let fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === tenantId);

      if (search) {
        fines = fines.filter((f: any) => {
          const fineId = (f.fine_number || f.ticket_id || f.id || '').toLowerCase();
          const emp = (f.rider_name || f.assigned_employee_name || '').toLowerCase();
          const veh = (f.plate_number || f.plateNumber || '').toLowerCase();
          return fineId.includes(search) || emp.includes(search) || veh.includes(search);
        });
      }

      const formatted = fines.map((f: any) => ({
        id: f.id,
        tenant_id: f.tenant_id,
        fine_id: f.fine_number || f.ticket_id || f.id,
        employee_name: f.rider_name || f.assigned_employee_name || 'Unassigned',
        employee_id: f.rider_id || f.employee_id,
        vehicle_plate: f.plate_number || f.plateNumber || '-',
        fine_date: f.violation_date || f.fine_date || '2026-08-01',
        amount: Number(f.fineAmountAED || f.amount || 0),
        liability: f.liability || (f.driver_liability_percent ? `${f.driver_liability_percent}% Rider` : 'RIDER'),
        status: f.status || 'PENDING',
        source: f.source || 'Dubai Police / RTA',
        created_by: f.created_by || 'Traffic Sync Service',
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/fines/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const fineId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.trafficFines || []).findIndex((f: any) => f.id === fineId && f.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Traffic fine not found.' });

      const oldFine = { ...db.trafficFines[idx] };
      db.trafficFines[idx] = { ...db.trafficFines[idx], ...req.body, updated_at: new Date().toISOString() };

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_FINE_EDIT',
        'Traffic Fines',
        'FINE',
        fineId,
        oldFine,
        db.trafficFines[idx],
        req.body?.reason || 'Traffic fine modified via Platform Admin'
      );

      res.json({ success: true, fine: db.trafficFines[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/fines/:id/void', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const fineId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.trafficFines || []).findIndex((f: any) => f.id === fineId && f.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Traffic fine not found.' });

      const oldFine = { ...db.trafficFines[idx] };
      db.trafficFines[idx].status = 'VOID';
      db.trafficFines[idx].void_reason = req.body?.reason || 'Voided by Platform Admin';
      db.trafficFines[idx].voided_at = new Date().toISOString();

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_FINE_VOID',
        'Traffic Fines',
        'FINE',
        fineId,
        oldFine,
        db.trafficFines[idx],
        req.body?.reason || 'Traffic fine voided via Platform Admin'
      );

      res.json({ success: true, fine: db.trafficFines[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/fines/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const fineId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.trafficFines || []).findIndex((f: any) => f.id === fineId && f.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Traffic fine not found.' });

      const [deleted] = db.trafficFines.splice(idx, 1);

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_FINE_DELETE',
        'Traffic Fines',
        'FINE',
        fineId,
        deleted,
        null,
        req.body?.reason || 'Traffic fine deleted via Platform Admin'
      );

      res.json({ success: true, message: 'Traffic fine deleted successfully.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 8. SALIK ADMIN
  // ==========================================
  router.get('/salik', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      let salik = (db.salikRecords || []).filter((s: any) => s.tenant_id === tenantId);

      if (search) {
        salik = salik.filter((s: any) => {
          const txnId = (s.transaction_id || s.id || '').toLowerCase();
          const veh = (s.plate_number || '').toLowerCase();
          const emp = (s.assigned_employee_name || '').toLowerCase();
          return txnId.includes(search) || veh.includes(search) || emp.includes(search);
        });
      }

      // Check orphan references
      const employees = db.masterEmployees || [];
      const vehicles = getAllVehicles(tenantId);
      const empIds = new Set(employees.map((e: any) => e.id));
      const vehPlates = new Set(vehicles.map((v: any) => (v.plateNumber || v.plate_number || '').toUpperCase()));

      const formatted = salik.map((s: any) => {
        const isOrphanEmp = s.assigned_employee_id && !empIds.has(s.assigned_employee_id);
        const isOrphanVeh = s.plate_number && !vehPlates.has((s.plate_number || '').toUpperCase());

        return {
          id: s.id,
          tenant_id: s.tenant_id,
          transaction_id: s.transaction_id || s.id,
          date: s.transaction_date || '2026-08-12',
          toll_gate: s.toll_gate || 'Salik Gate',
          vehicle_plate: s.plate_number || '-',
          employee_name: s.assigned_employee_name || 'Unassigned',
          employee_id: s.assigned_employee_id,
          amount: Number(s.amount || 4.0),
          status: s.status || 'ALLOCATED',
          source: s.source_type || 'Salik RTA Gate Sync',
          created_by: s.allocated_by || 'System Gate Sync',
          is_orphan_employee: isOrphanEmp,
          is_orphan_vehicle: isOrphanVeh,
        };
      });

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/salik/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const salikId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.salikRecords || []).findIndex((s: any) => s.id === salikId && s.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Salik record not found.' });

      const oldRecord = { ...db.salikRecords[idx] };
      db.salikRecords[idx] = { ...db.salikRecords[idx], ...req.body, updated_at: new Date().toISOString() };

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_SALIK_EDIT',
        'Salik',
        'SALIK_TRANSACTION',
        salikId,
        oldRecord,
        db.salikRecords[idx],
        req.body?.reason || 'Salik record modified via Platform Admin'
      );

      res.json({ success: true, salik: db.salikRecords[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/salik/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const salikId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.salikRecords || []).findIndex((s: any) => s.id === salikId && s.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Salik record not found.' });

      const [deleted] = db.salikRecords.splice(idx, 1);

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_SALIK_DELETE',
        'Salik',
        'SALIK_TRANSACTION',
        salikId,
        deleted,
        null,
        req.body?.reason || 'Salik record deleted via Platform Admin'
      );

      res.json({ success: true, message: 'Salik record safely deleted.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 9. PROJECTS ADMIN
  // ==========================================
  router.get('/projects', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      let projects = (db.projects || []).filter((p: any) => p.tenant_id === tenantId);

      if (search) {
        projects = projects.filter((p: any) => {
          const name = (p.name || '').toLowerCase();
          const code = (p.code || '').toLowerCase();
          return name.includes(search) || code.includes(search);
        });
      }

      const formatted = projects.map((p: any) => {
        const assignedEmployeesCount = (db.masterEmployees || []).filter(
          (e: any) => (e.project_id === p.id || e.project_name === p.name) && e.tenant_id === tenantId && !e.is_archived
        ).length;

        return {
          id: p.id,
          tenant_id: p.tenant_id,
          name: p.name,
          code: p.code,
          status: p.status || 'ACTIVE',
          external_identity_type: p.external_identity_type || 'Courier ID',
          assigned_employees_count: assignedEmployeesCount,
          created_at: p.created_at || '2026-01-01',
        };
      });

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/projects/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const projId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.projects || []).findIndex((p: any) => p.id === projId && p.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Project not found.' });

      const oldProject = { ...db.projects[idx] };
      db.projects[idx] = { ...db.projects[idx], ...req.body, updated_at: new Date().toISOString() };

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_PROJECT_EDIT',
        'Projects',
        'PROJECT',
        projId,
        oldProject,
        db.projects[idx],
        req.body?.reason || 'Project modified via Platform Admin'
      );

      res.json({ success: true, project: db.projects[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/projects/:id/archive', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const projId = req.params.id;
      const actor = (req as any).adminActor;
      const idx = (db.projects || []).findIndex((p: any) => p.id === projId && p.tenant_id === tenantId);

      if (idx === -1) return res.status(404).json({ error: 'Project not found.' });

      db.projects[idx].status = 'ARCHIVED';

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_PROJECT_ARCHIVE',
        'Projects',
        'PROJECT',
        projId,
        null,
        { status: 'ARCHIVED' },
        req.body?.reason || 'Project archived via Platform Admin'
      );

      res.json({ success: true, project: db.projects[idx] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/projects/:id/dependencies', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const projId = req.params.id;

      const activeEmployees = (db.masterEmployees || []).filter(
        (e: any) =>
          e.tenant_id === tenantId &&
          (e.project_id === projId || e.current_project_id === projId) &&
          !e.is_archived
      );

      const activeAssignments = (db.employeeProjectAssignments || []).filter(
        (pa: any) =>
          pa.tenant_id === tenantId && (pa.project_id === projId || pa.projectId === projId)
      );

      const warnings: string[] = [];
      if (activeEmployees.length > 0) {
        warnings.push(
          `Project has ${activeEmployees.length} currently assigned active employees. Unassign them before deleting.`
        );
      }

      res.json({
        activePointers: activeEmployees.map(
          (e: any) => `Assigned Employee: ${e.full_name || e.name} (${e.employee_code || e.id})`
        ),
        historicalCounts: [
          { label: 'Active Assigned Employees', count: activeEmployees.length },
          { label: 'Project Rider Assignments', count: activeAssignments.length },
        ],
        warnings,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/projects/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const projId = req.params.id;
      const actor = (req as any).adminActor;
      const isLive = isTenantLive(tenantId);

      if (isLive) {
        if (!actor.isSuperAdmin && actor.userRole !== 'SUPER_ADMIN' && actor.userRole !== 'PLATFORM_ADMIN') {
          return res.status(403).json({
            error: 'Live Tenant Safety Restriction: Project deletion in a LIVE tenant requires PLATFORM_ADMIN credentials.',
          });
        }
        const reason = req.body?.reason || req.query.reason;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Project deletion requires an explicit audit reason (minimum 10 characters).',
          });
        }
        const confirmation = req.body?.confirmation_phrase || req.query.confirmation_phrase;
        if (confirmation !== 'CONFIRM DELETE') {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Please provide confirmation_phrase "CONFIRM DELETE".',
          });
        }
      }

      const activeEmployees = (db.masterEmployees || []).filter(
        (e: any) =>
          e.tenant_id === tenantId &&
          (e.project_id === projId || e.current_project_id === projId) &&
          !e.is_archived
      );

      if (activeEmployees.length > 0) {
        return res.status(400).json({
          error: `Cannot delete project: ${activeEmployees.length} active employee(s) are currently assigned to this project. Reassign them first to prevent orphaned records.`,
        });
      }

      const idx = (db.projects || []).findIndex((p: any) => p.id === projId && p.tenant_id === tenantId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const deleted = db.projects.splice(idx, 1)[0];

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_PROJECT_DELETE',
        'Projects',
        'PROJECT',
        projId,
        deleted,
        null,
        req.body?.reason || 'Project removed via Platform Admin'
      );

      res.json({ success: true, message: 'Project safely deleted.', deletedId: projId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 10. DOCUMENTS METADATA VISIBILITY ONLY
  // (Never duplicates storage, reads metadata)
  // ==========================================
  router.get('/documents', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);

      const docs: any[] = [];
      employees.forEach((emp: any) => {
        if (emp.visa_number || emp.visa_expiry) {
          docs.push({
            id: `doc_visa_${emp.id}`,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            document_type: 'Residency Visa',
            storage_status: 'CLOUD_STORAGE_LINKED',
            expiry: emp.visa_expiry || '-',
            cloud_reference: `gcs://apexfleet-docs/${tenantId}/employees/${emp.id}/visa.pdf`,
          });
        }
        if (emp.emirates_id_number || emp.emirates_id) {
          docs.push({
            id: `doc_eid_${emp.id}`,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            document_type: 'Emirates ID',
            storage_status: 'CLOUD_STORAGE_LINKED',
            expiry: emp.eid_expiry || emp.emirates_id_expiry || '-',
            cloud_reference: `gcs://apexfleet-docs/${tenantId}/employees/${emp.id}/eid.pdf`,
          });
        }
        if (emp.passport_number) {
          docs.push({
            id: `doc_pass_${emp.id}`,
            employee_name: emp.full_name,
            employee_code: emp.employee_code,
            document_type: 'Passport Copy',
            storage_status: 'CLOUD_STORAGE_LINKED',
            expiry: emp.passport_expiry || '-',
            cloud_reference: `gcs://apexfleet-docs/${tenantId}/employees/${emp.id}/passport.pdf`,
          });
        }
      });

      // Also append from entityDocuments metadata collection if present
      (db.entityDocuments || []).filter((ed: any) => ed.tenant_id === tenantId).forEach((ed: any) => {
        docs.push({
          id: ed.id,
          employee_name: ed.entity_name || 'System Entity',
          employee_code: ed.entity_code || '-',
          document_type: ed.document_type_name || ed.document_name || 'Attached File',
          storage_status: 'CLOUD_STORAGE_LINKED',
          expiry: ed.expiry_date || '-',
          cloud_reference: ed.file_url || `s3://apexfleet/${tenantId}/${ed.id}`,
        });
      });

      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/documents/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const docId = req.params.id;
      const actor = (req as any).adminActor;
      const isLive = isTenantLive(tenantId);

      if (isLive) {
        if (!actor.isSuperAdmin && actor.userRole !== 'SUPER_ADMIN' && actor.userRole !== 'PLATFORM_ADMIN') {
          return res.status(403).json({
            error: 'Live Tenant Safety Restriction: Deletion in a LIVE tenant requires PLATFORM_ADMIN credentials.',
          });
        }
        const reason = req.body?.reason || req.query.reason;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Deletion requires an explicit audit reason (minimum 10 characters).',
          });
        }
        const confirmation = req.body?.confirmation_phrase || req.query.confirmation_phrase;
        if (confirmation !== 'CONFIRM DELETE') {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Please provide confirmation_phrase "CONFIRM DELETE".',
          });
        }
      }

      let deleted = false;
      let recordType = 'DOCUMENT';

      // 1. Check entityDocuments collection
      if (Array.isArray(db.entityDocuments)) {
        const idx = db.entityDocuments.findIndex(
          (ed: any) => ed.id === docId && ed.tenant_id === tenantId
        );
        if (idx >= 0) {
          db.entityDocuments.splice(idx, 1);
          deleted = true;
          recordType = 'ENTITY_DOCUMENT';
        }
      }

      // 2. Check synthetic document references (doc_visa_empId, doc_eid_empId, doc_pass_empId)
      if (!deleted) {
        const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);
        for (const emp of employees) {
          if (docId === `doc_visa_${emp.id}`) {
            emp.visa_number = '';
            emp.visa_expiry = '';
            deleted = true;
            recordType = 'VISA_METADATA';
            break;
          }
          if (docId === `doc_eid_${emp.id}`) {
            emp.emirates_id_number = '';
            emp.eid_expiry = '';
            deleted = true;
            recordType = 'EID_METADATA';
            break;
          }
          if (docId === `doc_pass_${emp.id}`) {
            emp.passport_number = '';
            emp.passport_expiry = '';
            deleted = true;
            recordType = 'PASSPORT_METADATA';
            break;
          }
        }
      }

      if (!deleted) {
        return res.status(404).json({ error: 'Document record not found.' });
      }

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_DOCUMENT_DELETE',
        'Documents',
        recordType,
        docId,
        { id: docId },
        null,
        req.body?.reason || 'Document record removed via Platform Admin'
      );

      res.json({ success: true, message: 'Document record safely deleted.', deletedId: docId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 10.1 ATTENDANCE RECORDS ADMIN
  // ==========================================
  router.get('/attendance', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const employeeId = (req.query.employee_id as string || '').trim();
      const date = (req.query.date as string || '').trim();
      const status = (req.query.status as string || '').trim();

      const rawList = db.attendanceRecords || db.attendance || [];
      let records = rawList.filter(
        (a: any) => a.tenant_id === tenantId || (!a.tenant_id && tenantId === 'company_pixel_syntax')
      );

      if (employeeId && employeeId !== 'ALL') {
        records = records.filter(
          (a: any) => a.employee_id === employeeId || a.employeeId === employeeId
        );
      }
      if (date) {
        records = records.filter((a: any) => a.date === date || a.date?.startsWith(date));
      }
      if (status && status !== 'ALL') {
        records = records.filter((a: any) => a.status === status);
      }

      const emps = db.masterEmployees || [];
      const formatted = records.map((r: any) => {
        const empId = r.employee_id || r.employeeId;
        const emp = emps.find((e: any) => e.id === empId);
        return {
          id: r.id || `${empId}_${r.date}`,
          employee_id: empId,
          employee_name: r.employee_name || emp?.full_name || emp?.name || 'Unknown Staff',
          employee_code: r.employee_code || emp?.employee_code || '-',
          date: r.date,
          status: r.status || 'PRESENT',
          check_in: r.check_in || r.checkInTime || '-',
          check_out: r.check_out || r.checkOutTime || '-',
          overtime_hours: Number(r.overtime_hours || 0),
          deliveries_count: Number(r.deliveries_count || r.deliveries || 0),
          notes: r.note || r.notes || '',
        };
      });

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/attendance/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const recordId = req.params.id;
      const actor = (req as any).adminActor;
      const isLive = isTenantLive(tenantId);

      if (isLive) {
        if (!actor.isSuperAdmin && actor.userRole !== 'SUPER_ADMIN' && actor.userRole !== 'PLATFORM_ADMIN') {
          return res.status(403).json({
            error: 'Live Tenant Safety Restriction: Hard deletion in a LIVE tenant requires PLATFORM_ADMIN credentials.',
          });
        }
        const reason = req.body?.reason || req.query.reason;
        if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Hard deletion requires an explicit audit reason (minimum 10 characters).',
          });
        }
        const confirmation = req.body?.confirmation_phrase || req.query.confirmation_phrase;
        if (confirmation !== 'CONFIRM DELETE') {
          return res.status(400).json({
            error: 'Live Tenant Safety Restriction: Please provide confirmation_phrase "CONFIRM DELETE".',
          });
        }
      }

      const list = db.attendanceRecords || db.attendance || [];
      const index = list.findIndex(
        (a: any) =>
          (a.id === recordId || `${a.employee_id || a.employeeId}_${a.date}` === recordId) &&
          (a.tenant_id === tenantId || (!a.tenant_id && tenantId === 'company_pixel_syntax'))
      );

      if (index === -1) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }

      const deleted = list.splice(index, 1)[0];

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_ATTENDANCE_DELETE',
        'Attendance',
        'ATTENDANCE_RECORD',
        recordId,
        deleted,
        null,
        req.body?.reason || 'Attendance record deleted via Platform Admin'
      );

      res.json({
        success: true,
        message: 'Attendance record safely deleted.',
        deletedId: recordId,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 11. USERS / LOGIN ACCOUNTS ADMIN
  // ==========================================
  router.get('/users', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const banned = ['admin_user', 'ahmed', 'raza', 'fatima_hr', 'bilal_payroll'];
      const supabase = getSupabaseClient();
      let safeUsers: any[] = [];

      if (supabase) {
        try {
          const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('tenant_id', tenantId);

          if (!profErr && Array.isArray(profiles) && profiles.length > 0) {
            let credMap = new Map<string, any>();
            try {
              const { data: credsList } = await supabase
                .from('user_credentials')
                .select('profile_id, username, must_change_password, failed_login_count, locked_until')
                .eq('tenant_id', tenantId);
              if (Array.isArray(credsList)) {
                credMap = new Map(credsList.map((c: any) => [c.username, c]));
              }
            } catch {}

            safeUsers = profiles
              .filter((p: any) => !banned.includes((p.username || '').toLowerCase()))
              .map((p: any) => {
                const cred = credMap.get(p.username);
                return {
                  id: p.id,
                  name: p.full_name || p.username || 'System User',
                  fullName: p.full_name || p.username || 'System User',
                  full_name: p.full_name || p.username || 'System User',
                  email: p.email || `${p.username}@alliedfleet.com`,
                  username: p.username,
                  role: p.role || (p.is_super_admin ? 'SUPER_ADMIN' : (p.is_owner ? 'COMPANY_ADMIN' : 'ERP_USER')),
                  tenantId: tenantId,
                  tenant_id: tenantId,
                  designation: p.designation || (p.is_owner ? 'Company Owner & Administrator' : 'ERP Staff Member'),
                  phone: p.phone || '',
                  employee_id: p.employee_id || null,
                  employee_code: p.employee_code || null,
                  mustChangePassword: Boolean(cred?.must_change_password),
                  failed_login_count: Number(cred?.failed_login_count || 0),
                  locked_until: cred?.locked_until || null,
                  is_active: (p.status || 'ACTIVE') === 'ACTIVE',
                  status: p.status || 'ACTIVE',
                  lastLogin: p.last_login ? p.last_login.substring(0, 19).replace('T', ' ') : 'Never',
                  last_login: p.last_login || null,
                  created_at: p.created_at || '2026-01-01',
                };
              });
          }
        } catch (sbErr) {
          console.error('Error fetching authoritative users from Supabase in platformAdminRoutes:', sbErr);
        }
      }

      // Fallback to db.users if Supabase not configured or yielded no results
      if (safeUsers.length === 0) {
        const users = (db.users || []).filter(
          (u: any) => (u.tenantId === tenantId || u.tenant_id === tenantId) &&
            !banned.includes((u.username || '').toLowerCase())
        );

        safeUsers = users.map((u: any) => ({
          id: u.id,
          name: u.fullName || u.name || u.username,
          fullName: u.fullName || u.name || u.username,
          full_name: u.fullName || u.name || u.username,
          email: u.email || `${u.username}@alliedfleet.com`,
          username: u.username,
          role: u.role || (u.isSuperAdmin ? 'SUPER_ADMIN' : (u.isOwner ? 'COMPANY_ADMIN' : 'ERP_USER')),
          tenantId: tenantId,
          tenant_id: tenantId,
          designation: u.designation || u.role || 'ERP Staff Member',
          phone: u.phone || '',
          employee_id: u.employee_id || null,
          employee_code: u.employee_code || null,
          mustChangePassword: Boolean(u.mustChangePassword),
          failed_login_count: u.failed_login_count || 0,
          locked_until: u.locked_until || null,
          is_active: (u.status || 'ACTIVE') === 'ACTIVE',
          status: u.status || 'ACTIVE',
          lastLogin: u.lastLogin || 'Never',
          last_login: u.lastLogin || null,
          created_at: u.createdDate || u.created_at || '2026-01-01',
        }));
      }

      // STRICT SECURITY GUARANTEE: Never return password hashes, salts, plain passwords, or tokens
      safeUsers.forEach((u: any) => {
        delete u.password_hash;
        delete u.password;
        delete u.salt;
        delete u.token;
      });

      res.json(safeUsers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  function getModulesForRole(role: string): string[] {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'PLATFORM_ADMIN':
      case 'COMPANY_ADMIN':
      case 'ERP_USER':
        return ['ALL'];
      case 'HR':
        return ['employees_list', 'recruitment', 'attendance_daily', 'attendance_monthly', 'doc_expiry_listing', 'forms_list', 'passport_list'];
      case 'OPERATIONS':
        return ['operations_dashboard', 'riders_drivers', 'rider_project_mgmt', 'captain_perf', 'tracking_mgmt', 'driver_tickets_list'];
      case 'FLEET_MANAGER':
      case 'FLEET':
        return ['fleet_dashboard', 'vehicle_status', 'traffic_fines_mgmt', 'salik_mgmt', 'sim_mgmt', 'inventory_list', 'inventory_assign'];
      case 'PAYROLL':
        return ['hr_payroll', 'payroll_loan_mgmt', 'salik_mgmt', 'traffic_fines_mgmt', 'finance_overview'];
      case 'RECRUITMENT':
        return ['recruitment', 'employees_list', 'forms_list'];
      case 'ATTENDANCE':
        return ['attendance_daily', 'attendance_monthly', 'employees_list'];
      case 'VIEWER':
        return ['operations_dashboard', 'fleet_dashboard', 'employees_list', 'rider_project_mgmt'];
      default:
        return ['operations_dashboard', 'riders_drivers'];
    }
  }

  router.post('/users/:id/toggle-status', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });

      // Protect against deactivating the main super admin account
      if (user.id === 'user_global_admin') {
        return res.status(400).json({ error: 'The Primary Global Super Admin account cannot be deactivated.' });
      }

      const oldStatus = user.status || 'ACTIVE';
      const newStatus = oldStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      user.status = newStatus;
      user.updated_at = new Date().toISOString();

      if (newStatus === 'INACTIVE') {
        destroyAllUserSessions(userId);
      }

      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('profiles')
          .update({ status: newStatus, updated_at: user.updated_at })
          .eq('id', userId)
          .then(() => {}, () => {});
      }

      const actionType = newStatus === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DEACTIVATED';
      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        actionType,
        'User Management',
        'USER',
        userId,
        { status: oldStatus },
        { status: user.status },
        `Toggled user account status from ${oldStatus} to ${user.status} for @${user.username}`
      );

      res.json({ success: true, user: { id: user.id, status: user.status } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/users/:id/role', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;
      const actor = (req as any).adminActor;

      const allowedRoles = [
        'COMPANY_ADMIN',
        'ERP_USER',
        'HR',
        'OPERATIONS',
        'FLEET_MANAGER',
        'PAYROLL',
        'RECRUITMENT',
        'ATTENDANCE',
        'VIEWER',
        'SUPER_ADMIN',
        'PLATFORM_ADMIN',
        'FLEET',
        'AUDITOR',
      ];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` });
      }

      const user = (db.users || []).find((u: any) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'User not found.' });

      const oldRole = user.role;
      user.role = role;
      user.roleDisplayName = role === 'COMPANY_ADMIN' ? 'Company Administrator' : role === 'ERP_USER' ? 'ERP Staff Member' : role;
      user.isSuperAdmin = role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
      user.allowedModules = getModulesForRole(role);
      user.updated_at = new Date().toISOString();

      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('profiles')
          .update({ role, updated_at: user.updated_at })
          .eq('id', userId)
          .then(() => {}, () => {});
      }

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'USER_ROLE_CHANGED',
        'User Management',
        'USER',
        userId,
        { role: oldRole },
        { role, allowedModules: user.allowedModules },
        `Changed user role from ${oldRole} to ${role} for @${user.username}`
      );

      res.json({ success: true, user: { id: user.id, role: user.role, allowedModules: user.allowedModules } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users/:id/reset-auth', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });

      user.auth_token = null;
      user.session_revoked_at = new Date().toISOString();
      user.updated_at = user.session_revoked_at;
      destroyAllUserSessions(userId);

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'USER_SESSIONS_REVOKED',
        'User Management',
        'USER',
        userId,
        null,
        { session_revoked_at: user.session_revoked_at },
        `Authentication sessions revoked for user @${user.username}`
      );

      res.json({ success: true, message: 'Authentication session successfully reset.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users/:id/toggle-lock', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (user.id === 'user_global_admin') {
        return res.status(400).json({ error: 'The Primary Global Super Admin cannot be locked.' });
      }

      user.is_locked = !user.is_locked;
      user.locked_until = user.is_locked ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() : null;
      user.updated_at = new Date().toISOString();

      if (user.is_locked) {
        destroyAllUserSessions(userId);
      }

      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('user_credentials')
          .update({ locked_until: user.locked_until, updated_at: user.updated_at })
          .eq('profile_id', userId)
          .then(() => {}, () => {});
      }

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        user.is_locked ? 'USER_LOCKED' : 'USER_UNLOCKED',
        'User Management',
        'USER',
        userId,
        null,
        { is_locked: user.is_locked },
        `${user.is_locked ? 'Locked' : 'Unlocked'} user account @${user.username}`
      );

      res.json({ success: true, is_locked: user.is_locked });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users/:id/reset-password', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const newPassword = req.body.newPassword || req.body.password;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(newPassword, salt, 1000, 64, 'sha512').toString('hex');

      user.password_hash = hash;
      user.salt = salt;
      user.mustChangePassword = false;
      user.password_changed_at = new Date().toISOString();
      user.updated_at = user.password_changed_at;
      user.failed_login_count = 0;
      user.locked_until = null;
      user.is_locked = false;

      // Invalidate active sessions
      destroyAllUserSessions(userId);

      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('user_credentials')
          .update({
            password_hash: hash,
            salt,
            must_change_password: false,
            failed_login_count: 0,
            locked_until: null,
            updated_at: user.updated_at,
          })
          .eq('profile_id', userId)
          .then(() => {}, () => {});
      }

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'USER_PASSWORD_RESET',
        'User Management',
        'USER',
        userId,
        null,
        { updated_at: user.password_changed_at },
        `Password reset by Platform Admin for user @${user.username}`
      );

      res.json({ success: true, message: `Password for @${user.username} has been successfully updated.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', (req: Request, res: Response) => {
    try {
      const {
        username,
        email,
        fullName,
        role,
        password,
        tenantId,
        designation,
        phone,
        employee_id,
        status,
        mustChangePassword,
        allowedModules,
        assignedBranchIds,
        assignedDepartmentIds,
      } = req.body;
      const actor = (req as any).adminActor;

      if (!username || !password || !fullName) {
        return res.status(400).json({ error: 'Username, password, and Full Name are required.' });
      }

      const targetTenantId = tenantId || getTargetTenantId(req) || 'company_pixel_syntax';
      const normalizedUsername = username.toLowerCase().trim();

      // Check if employee is already linked to an existing account
      if (employee_id) {
        const existingForEmp = (db.users || []).find(
          (u: any) => (u.tenantId === targetTenantId || u.tenant_id === targetTenantId) && u.employee_id === employee_id
        );
        if (existingForEmp) {
          return res.status(400).json({
            error: `An account already exists for this employee (@${existingForEmp.username}). Please edit their existing account instead of creating duplicate credentials.`
          });
        }
      }

      const existing = (db.users || []).find(
        (u: any) =>
          (u.tenantId === targetTenantId || u.tenant_id === targetTenantId) &&
          (u.username.toLowerCase() === normalizedUsername || (email && u.email && u.email.toLowerCase() === email.toLowerCase().trim()))
      );

      if (existing) {
        return res.status(400).json({ error: 'A user with this username or email already exists in this tenant.' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

      const tenant = (db.tenants || []).find((t: any) => t.id === targetTenantId);

      // Resolve linked employee if provided
      let linkedEmp: any = null;
      if (employee_id) {
        linkedEmp = (db.masterEmployees || []).find((e: any) => e.id === employee_id && e.tenant_id === targetTenantId);
      }

      const userRole = role || 'ERP_USER';
      const nowIso = new Date().toISOString();

      const newUser = {
        id: `user_${Date.now()}`,
        tenant_id: targetTenantId,
        tenantId: targetTenantId,
        companyName: tenant?.name || 'Pixel Syntax Delivery Software',
        username: normalizedUsername,
        fullName: fullName.trim(),
        email: email ? email.trim() : (linkedEmp?.email || `${normalizedUsername}@alliedfleet.com`),
        phone: phone || (linkedEmp ? (linkedEmp.mobile_number || linkedEmp.personal_mobile || '') : ''),
        role: userRole,
        roleDisplayName: userRole === 'COMPANY_ADMIN' ? 'Company Administrator' : userRole === 'ERP_USER' ? 'ERP Staff Member' : userRole,
        designation: designation || (linkedEmp?.designation || (userRole === 'COMPANY_ADMIN' ? 'Company Administrator' : 'ERP Staff Member')),
        employee_id: linkedEmp ? linkedEmp.id : (employee_id || null),
        employee_code: linkedEmp ? linkedEmp.employee_code : null,
        isOwner: false,
        isSuperAdmin: userRole === 'SUPER_ADMIN' || userRole === 'PLATFORM_ADMIN',
        status: status === 'SUSPENDED' ? 'SUSPENDED' : status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        password_hash: hash,
        salt,
        failed_login_count: 0,
        mustChangePassword: Boolean(mustChangePassword),
        createdDate: nowIso.substring(0, 10),
        created_at: nowIso,
        updated_at: nowIso,
        createdBy: actor?.userName || 'Platform Admin',
        created_by_user_id: actor?.userId || 'user_global_admin',
        lastLogin: 'Never',
        avatarUrl: `https://images.unsplash.com/photo-${1534528741775 + (db.users.length % 10)}?w=150`,
        allowedModules: Array.isArray(allowedModules) && allowedModules.length > 0 ? allowedModules : getModulesForRole(userRole),
        assignedBranchIds: Array.isArray(assignedBranchIds) ? assignedBranchIds : (linkedEmp?.branch_id ? [linkedEmp.branch_id] : []),
        assignedDepartmentIds: Array.isArray(assignedDepartmentIds) ? assignedDepartmentIds : [],
      };

      db.users.push(newUser);
      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('profiles')
          .insert({
            id: newUser.id,
            tenant_id: targetTenantId,
            full_name: newUser.fullName,
            email: newUser.email,
            phone: newUser.phone,
            role: newUser.role,
            status: newUser.status,
            designation: newUser.designation,
            employee_id: newUser.employee_id,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .then(() => {
            return supabase.from('user_credentials').insert({
              profile_id: newUser.id,
              tenant_id: targetTenantId,
              username: newUser.username,
              password_hash: hash,
              salt,
              must_change_password: newUser.mustChangePassword,
              created_at: nowIso,
              updated_at: nowIso,
            });
          }, () => {});
      }

      logAdminAction(
        actor,
        targetTenantId,
        'USER_CREATED',
        'User Management',
        'USER',
        newUser.id,
        null,
        { username: newUser.username, role: newUser.role, employee_code: newUser.employee_code, tenantId: targetTenantId },
        `Created new user account @${newUser.username} (${newUser.fullName}) with role ${newUser.role}`
      );

      const { password_hash: _p, salt: _s, ...safeUser } = newUser;
      res.status(201).json({ success: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Edit user account details
  router.put('/users/:id', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });

      const {
        fullName,
        email,
        phone,
        designation,
        role,
        status,
        employee_id,
        mustChangePassword,
        allowedModules,
        assignedBranchIds,
        assignedDepartmentIds,
      } = req.body;

      const oldState = {
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        designation: user.designation,
      };

      if (fullName) user.fullName = fullName.trim();
      if (email) user.email = email.trim();
      if (phone !== undefined) user.phone = phone.trim();
      if (designation !== undefined) user.designation = designation.trim();
      if (role) {
        user.role = role;
        user.roleDisplayName = role === 'COMPANY_ADMIN' ? 'Company Administrator' : role === 'ERP_USER' ? 'ERP Staff Member' : role;
        user.isSuperAdmin = role === 'SUPER_ADMIN' || role === 'PLATFORM_ADMIN';
        if (!req.body.allowedModules) {
          user.allowedModules = getModulesForRole(role);
        }
      }
      if (Array.isArray(allowedModules)) {
        user.allowedModules = allowedModules;
      }
      if (status) {
        user.status = status;
        if (status === 'INACTIVE' || status === 'SUSPENDED') {
          destroyAllUserSessions(userId);
        }
      }
      if (mustChangePassword !== undefined) user.mustChangePassword = Boolean(mustChangePassword);
      if (assignedBranchIds !== undefined) user.assignedBranchIds = Array.isArray(assignedBranchIds) ? assignedBranchIds : [];
      if (assignedDepartmentIds !== undefined) user.assignedDepartmentIds = Array.isArray(assignedDepartmentIds) ? assignedDepartmentIds : [];

      if (employee_id !== undefined) {
        if (employee_id) {
          const emp = (db.masterEmployees || []).find((e: any) => e.id === employee_id);
          user.employee_id = emp ? emp.id : employee_id;
          user.employee_code = emp ? emp.employee_code : null;
        } else {
          user.employee_id = null;
          user.employee_code = null;
        }
      }

      user.updated_at = new Date().toISOString();

      persistAlliedUsers();

      const supabase = getSupabaseClient();
      if (supabase) {
        supabase
          .from('profiles')
          .update({
            full_name: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            designation: user.designation,
            employee_id: user.employee_id,
            updated_at: user.updated_at,
          })
          .eq('id', userId)
          .then(() => {}, () => {});
      }

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'USER_UPDATED',
        'User Management',
        'USER',
        userId,
        oldState,
        { fullName: user.fullName, email: user.email, role: user.role, status: user.status, allowedModules: user.allowedModules },
        `Updated account profile for user @${user.username}`
      );

      const { password_hash: _p, salt: _s, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Force Logout User (Requirement 11: Invalidate active sessions immediately)
  router.post('/users/:id/force-logout', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });

      destroyAllUserSessions(userId);
      user.session_revoked_at = new Date().toISOString();

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'ADMIN_USER_FORCE_LOGOUT',
        'User Management',
        'USER',
        userId,
        null,
        { revoked_at: user.session_revoked_at },
        `Force logged out user @${user.username} and terminated active sessions`
      );

      res.json({ success: true, message: `Active sessions for @${user.username} have been terminated.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Require Password Change on next login (Requirement 11)
  router.post('/users/:id/require-password-change', (req: Request, res: Response) => {
    try {
      const userId = req.params.id;
      const actor = (req as any).adminActor;
      const user = (db.users || []).find((u: any) => u.id === userId);

      if (!user) return res.status(404).json({ error: 'User not found.' });

      user.mustChangePassword = true;
      destroyAllUserSessions(userId);

      logAdminAction(
        actor,
        user.tenantId || 'GLOBAL_SUPER_ADMIN',
        'ADMIN_USER_REQUIRE_PASSWORD_CHANGE',
        'User Management',
        'USER',
        userId,
        null,
        { mustChangePassword: true },
        `Flagged user @${user.username} to require password change upon next sign in`
      );

      res.json({ success: true, message: `@${user.username} will be required to change their password upon next login.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 12. DATA INTEGRITY CENTER
  // ==========================================
  router.get('/integrity', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const employees = (db.masterEmployees || []).filter((e: any) => e.tenant_id === tenantId);
      const vehicles = getAllVehicles(tenantId);
      const sims = (db.simCardsMaster || []).filter((s: any) => s.tenant_id === tenantId);
      const projects = (db.projects || []).filter((p: any) => p.tenant_id === tenantId);
      const fines = (db.trafficFines || []).filter((f: any) => f.tenant_id === tenantId);
      const salik = (db.salikRecords || []).filter((s: any) => s.tenant_id === tenantId);

      const empMap = new Map<string, any>(employees.map((e: any) => [e.id, e]));
      const projMap = new Map<string, any>(projects.map((p: any) => [p.id, p]));
      const vehIdMap = new Map<string, any>(vehicles.map((v: any) => [v.id, v]));
      const vehPlateMap = new Map<string, any>(
        vehicles.map((v: any) => [(v.plateNumber || v.plate_number || '').toUpperCase(), v])
      );

      const issues: any[] = [];

      // 1. SIM assigned to nonexistent employee
      sims.forEach((sim: any) => {
        if (sim.assigned_to_id && !empMap.has(sim.assigned_to_id)) {
          issues.push({
            id: `int_sim_orphan_${sim.id}`,
            issueType: 'SIM_ASSIGNED_TO_NONEXISTENT_EMPLOYEE',
            recordType: 'SIM',
            recordId: sim.id,
            recordLabel: `SIM ${sim.sim_number || sim.simNumber} (ID: ${sim.id})`,
            severity: 'HIGH',
            tenantId,
            description: `SIM points to missing employee ID "${sim.assigned_to_id}" (${sim.assigned_to_name || 'Unknown'}).`,
            recommendedRepair: 'Clear orphan employee reference and set SIM status to AVAILABLE.',
            repairAction: 'CLEAR_SIM_ORPHAN',
          });
        }
      });

      // 2. Bike assigned to nonexistent employee
      vehicles.forEach((veh: any) => {
        const assignedEmpId = veh.current_assigned_employee_id || veh.currentRiderId;
        if (assignedEmpId && !empMap.has(assignedEmpId)) {
          issues.push({
            id: `int_veh_orphan_${veh.id}`,
            issueType: 'BIKE_ASSIGNED_TO_NONEXISTENT_EMPLOYEE',
            recordType: 'VEHICLE',
            recordId: veh.id,
            recordLabel: `Vehicle ${veh.plateNumber || veh.plate_number} (ID: ${veh.id})`,
            severity: 'HIGH',
            tenantId,
            description: `Vehicle points to nonexistent employee ID "${assignedEmpId}".`,
            recommendedRepair: 'Clear orphan employee reference and return vehicle to AVAILABLE pool.',
            repairAction: 'CLEAR_VEHICLE_ORPHAN',
          });
        }
      });

      // 3. Employee referencing missing project
      employees.forEach((emp: any) => {
        if (emp.project_id && emp.project_id !== 'Unassigned' && emp.project_id !== '-' && !projMap.has(emp.project_id)) {
          issues.push({
            id: `int_emp_proj_${emp.id}`,
            issueType: 'EMPLOYEE_REFERENCING_MISSING_PROJECT',
            recordType: 'EMPLOYEE',
            recordId: emp.id,
            recordLabel: `${emp.full_name} (${emp.employee_code})`,
            severity: 'MEDIUM',
            tenantId,
            description: `Employee is assigned to project ID "${emp.project_id}" ("${emp.project_name || 'Unknown'}") which does not exist in project master.`,
            recommendedRepair: 'Set employee project to Unassigned or map to an active project.',
            repairAction: 'UNASSIGN_EMPLOYEE_MISSING_PROJECT',
          });
        }
      });

      // 4. Duplicate employee Emirates ID
      const eidGroups = new Map<string, any[]>();
      employees.forEach((emp: any) => {
        const rawEid = emp.emirates_id_number || emp.emirates_id;
        const normEid = (rawEid || '').replace(/\D/g, '');
        if (normEid.length >= 9) {
          if (!eidGroups.has(normEid)) eidGroups.set(normEid, []);
          eidGroups.get(normEid)!.push(emp);
        }
      });
      eidGroups.forEach((list, eid) => {
        if (list.length > 1) {
          issues.push({
            id: `int_dup_eid_${eid}`,
            issueType: 'DUPLICATE_EMPLOYEE_EMIRATES_ID',
            recordType: 'EMPLOYEE',
            recordId: list[0].id,
            recordLabel: `Emirates ID ${list[0].emirates_id_number || list[0].emirates_id}`,
            severity: 'CRITICAL',
            tenantId,
            description: `Found ${list.length} employee records sharing identical Emirates ID: ${list.map((e) => e.employee_code).join(', ')}.`,
            recommendedRepair: 'Review in Duplicate Employee Center and merge or archive the redundant record.',
            repairAction: 'NAVIGATE_DUPLICATES',
          });
        }
      });

      // 5. Duplicate vehicle plate
      const plateGroups = new Map<string, any[]>();
      vehicles.forEach((veh: any) => {
        const plate = (veh.plateNumber || veh.plate_number || '').trim().toUpperCase();
        if (plate) {
          if (!plateGroups.has(plate)) plateGroups.set(plate, []);
          plateGroups.get(plate)!.push(veh);
        }
      });
      plateGroups.forEach((list, plate) => {
        if (list.length > 1) {
          issues.push({
            id: `int_dup_plate_${plate}`,
            issueType: 'DUPLICATE_VEHICLE_PLATE',
            recordType: 'VEHICLE',
            recordId: list[0].id,
            recordLabel: `Plate Number: ${plate}`,
            severity: 'CRITICAL',
            tenantId,
            description: `Found ${list.length} vehicle entries registered with the same plate number "${plate}".`,
            recommendedRepair: 'Merge into one authoritative vehicle and remove duplicate ID.',
            repairAction: 'RESOLVE_DUPLICATE_PLATE',
          });
        }
      });

      // 6. Duplicate SIM number
      const simNumGroups = new Map<string, any[]>();
      sims.forEach((sim: any) => {
        const num = (sim.sim_number || sim.simNumber || '').replace(/\D/g, '');
        if (num) {
          if (!simNumGroups.has(num)) simNumGroups.set(num, []);
          simNumGroups.get(num)!.push(sim);
        }
      });
      simNumGroups.forEach((list, num) => {
        if (list.length > 1) {
          issues.push({
            id: `int_dup_sim_${num}`,
            issueType: 'DUPLICATE_SIM_NUMBER',
            recordType: 'SIM',
            recordId: list[0].id,
            recordLabel: `SIM Number: ${list[0].sim_number || list[0].simNumber}`,
            severity: 'HIGH',
            tenantId,
            description: `Found ${list.length} SIM records configured with identical telecom number: ${num}.`,
            recommendedRepair: 'Retain active SIM record and safely remove duplicate.',
            repairAction: 'RESOLVE_DUPLICATE_SIM',
          });
        }
      });

      // 7. Desynced Bike Pointer: Employee says has bike, but bike doesn't point to employee
      employees.forEach((emp: any) => {
        if (emp.current_bike_id) {
          const veh = vehIdMap.get(emp.current_bike_id);
          if (veh) {
            const assignedEmpId = veh.current_assigned_employee_id || veh.currentRiderId;
            if (assignedEmpId && assignedEmpId !== emp.id) {
              issues.push({
                id: `int_desync_bike_${emp.id}`,
                issueType: 'DESYNCED_BIKE_ASSIGNMENT',
                recordType: 'EMPLOYEE',
                recordId: emp.id,
                recordLabel: `${emp.full_name} vs Vehicle ${veh.plateNumber || veh.plate_number}`,
                severity: 'MEDIUM',
                tenantId,
                description: `Employee ${emp.employee_code} points to bike ${veh.plateNumber}, but that bike is marked assigned to employee ID ${assignedEmpId}.`,
                recommendedRepair: 'Resynchronize assignment pointer between employee and vehicle.',
                repairAction: 'SYNC_BIKE_POINTER',
              });
            }
          }
        }
      });

      // 8. Invalid fine reference: fine referencing missing employee or vehicle
      fines.forEach((fine: any) => {
        const empId = fine.rider_id || fine.employee_id;
        if (empId && !empMap.has(empId)) {
          issues.push({
            id: `int_fine_orphan_${fine.id}`,
            issueType: 'INVALID_FINE_REFERENCE',
            recordType: 'FINE',
            recordId: fine.id,
            recordLabel: `Fine ID: ${fine.fine_number || fine.ticket_id || fine.id}`,
            severity: 'LOW',
            tenantId,
            description: `Traffic fine references missing employee ID "${empId}" (${fine.rider_name || 'Unknown'}).`,
            recommendedRepair: 'Clear orphan employee reference from fine record or re-allocate.',
            repairAction: 'CLEAR_FINE_ORPHAN',
          });
        }
      });

      // 9. Invalid Salik reference: missing employee or vehicle
      salik.forEach((slk: any) => {
        if (slk.assigned_employee_id && !empMap.has(slk.assigned_employee_id)) {
          issues.push({
            id: `int_salik_orphan_${slk.id}`,
            issueType: 'INVALID_SALIK_REFERENCE',
            recordType: 'SALIK',
            recordId: slk.id,
            recordLabel: `Salik Transaction: ${slk.transaction_id || slk.id}`,
            severity: 'LOW',
            tenantId,
            description: `Salik record points to nonexistent employee ID "${slk.assigned_employee_id}".`,
            recommendedRepair: 'Reset Salik transaction allocation to UNALLOCATED.',
            repairAction: 'RESET_SALIK_ALLOCATION',
          });
        }
      });

      res.json(issues);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/integrity/repair', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const { issueId, repairAction, recordId, reason } = req.body;
      const actor = (req as any).adminActor;

      if (!repairAction || !recordId) {
        return res.status(400).json({ error: 'repairAction and recordId are required.' });
      }

      let repairSummary = '';

      if (repairAction === 'CLEAR_SIM_ORPHAN') {
        const sim = (db.simCardsMaster || []).find((s: any) => s.id === recordId && s.tenant_id === tenantId);
        if (sim) {
          const oldAssignee = sim.assigned_to_id;
          sim.assigned_to_id = null;
          sim.assigned_to_name = null;
          sim.status = 'AVAILABLE';
          repairSummary = `Cleared orphan assignee (${oldAssignee}) from SIM ${sim.sim_number} and returned to AVAILABLE pool.`;
        }
      } else if (repairAction === 'CLEAR_VEHICLE_ORPHAN') {
        const veh = getAllVehicles(tenantId).find((v: any) => v.id === recordId);
        if (veh) {
          veh.current_assigned_employee_id = null;
          veh.current_assigned_employee_name = null;
          veh.currentRiderId = null;
          veh.currentRider = null;
          veh.status = 'AVAILABLE';
          repairSummary = `Cleared orphan employee from vehicle ${veh.plateNumber || veh.plate_number} and set status to AVAILABLE.`;
        }
      } else if (repairAction === 'UNASSIGN_EMPLOYEE_MISSING_PROJECT') {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === recordId && e.tenant_id === tenantId);
        if (emp) {
          emp.project_id = null;
          emp.project_name = 'Unassigned';
          repairSummary = `Unassigned missing project from employee ${emp.full_name} (${emp.employee_code}).`;
        }
      } else if (repairAction === 'SYNC_BIKE_POINTER') {
        const emp = (db.masterEmployees || []).find((e: any) => e.id === recordId && e.tenant_id === tenantId);
        if (emp && emp.current_bike_id) {
          const veh = getAllVehicles(tenantId).find((v: any) => v.id === emp.current_bike_id);
          if (veh) {
            veh.current_assigned_employee_id = emp.id;
            veh.current_assigned_employee_name = emp.full_name;
            veh.status = 'ASSIGNED';
            repairSummary = `Synchronized bike ${veh.plateNumber || veh.plate_number} to belong to ${emp.full_name}.`;
          }
        }
      } else if (repairAction === 'CLEAR_FINE_ORPHAN') {
        const fine = (db.trafficFines || []).find((f: any) => f.id === recordId && f.tenant_id === tenantId);
        if (fine) {
          fine.rider_id = null;
          fine.rider_name = 'Unassigned';
          repairSummary = `Cleared orphan employee from fine ${fine.fine_number || fine.ticket_id || fine.id}.`;
        }
      } else if (repairAction === 'RESET_SALIK_ALLOCATION') {
        const slk = (db.salikRecords || []).find((s: any) => s.id === recordId && s.tenant_id === tenantId);
        if (slk) {
          slk.assigned_employee_id = null;
          slk.assigned_employee_name = 'Unallocated';
          slk.status = 'PENDING_ALLOCATION';
          repairSummary = `Reset Salik transaction ${slk.transaction_id || slk.id} to PENDING_ALLOCATION.`;
        }
      } else {
        return res.status(400).json({ error: `Unknown repairAction: ${repairAction}` });
      }

      logAdminAction(
        actor,
        tenantId,
        'ADMIN_INTEGRITY_REPAIR',
        'Data Integrity',
        repairAction,
        recordId,
        { issueId, repairAction },
        { status: 'REPAIRED', summary: repairSummary },
        reason || repairSummary
      );

      res.json({ success: true, message: repairSummary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 12.5 RECRUITMENT CANDIDATES MANAGEMENT & REPAIR
  // ==========================================
  router.get('/candidates', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      const statusFilter = req.query.status as string;
      const stageFilter = req.query.stage as string;

      let candidates = (db.candidates || []).filter((c: any) => c.tenant_id === tenantId);

      if (search) {
        candidates = candidates.filter((c: any) => {
          const name = (c.fullName || '').toLowerCase();
          const code = (c.employee_code || c.candidateId || '').toLowerCase();
          const pport = (c.cnicPassport || '').toLowerCase();
          const eid = (c.uniqueId || '').toLowerCase();
          const mob = (c.mobile || '').toLowerCase();
          return name.includes(search) || code.includes(search) || pport.includes(search) || eid.includes(search) || mob.includes(search);
        });
      }

      if (statusFilter && statusFilter !== 'ALL') {
        candidates = candidates.filter((c: any) => c.status === statusFilter);
      }

      if (stageFilter && stageFilter !== 'ALL') {
        candidates = candidates.filter((c: any) => c.currentStageCode === stageFilter || c.currentStage === stageFilter);
      }

      const formatted = candidates.map((c: any) => {
        const linkedEmp = c.employee_id
          ? (db.masterEmployees || []).find((e: any) => e.id === c.employee_id)
          : null;

        return {
          id: c.id,
          candidateId: c.candidateId,
          tenant_id: c.tenant_id,
          fullName: c.fullName,
          employee_id: c.employee_id || null,
          employee_code: c.employee_code || linkedEmp?.employee_code || null,
          linkedEmployee: linkedEmp ? {
            id: linkedEmp.id,
            full_name: linkedEmp.full_name,
            employee_code: linkedEmp.employee_code,
            current_status: linkedEmp.current_status,
          } : null,
          passport: c.cnicPassport || linkedEmp?.passport_number || '',
          emirates_id: c.uniqueId || linkedEmp?.emirates_id_number || '',
          mobile: c.mobile || linkedEmp?.personal_mobile || linkedEmp?.company_mobile || '',
          nationality: c.nationality || linkedEmp?.nationality || '',
          currentStage: c.currentStage || 'Stage 1 — Initial Process',
          currentStageCode: c.currentStageCode || 'STAGE_1',
          stageStatus: c.stageStatus || 'Open',
          status: c.status || 'Active',
          archived: Boolean(c.archived),
          createdDate: c.createdDate || c.created_at || '',
          created_by: c.created_by || 'Operations Team',
        };
      });

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/candidates/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const actor = resolveAuthenticatedActor(req, db);
      const candidateIndex = (db.candidates || []).findIndex(
        (c: any) => c.id === req.params.id && c.tenant_id === tenantId
      );

      if (candidateIndex === -1) {
        return res.status(404).json({ error: 'Candidate record not found' });
      }

      const oldState = { ...db.candidates[candidateIndex] };
      const updates = req.body.updates || req.body;
      const reason = req.body.reason || 'Platform Admin manual correction';

      db.candidates[candidateIndex] = {
        ...db.candidates[candidateIndex],
        ...updates,
        updated_at: new Date().toISOString(),
        updated_by: actor.userName,
      };

      logUniversalAudit(db, actor, {
        action: 'UPDATE_CANDIDATE',
        actionType: 'UPDATE',
        module: 'Platform Admin — Recruitment',
        entityType: 'Candidate',
        entityId: req.params.id,
        oldState,
        newState: db.candidates[candidateIndex],
        reason,
        details: `Platform admin ${actor.userName} updated candidate ${db.candidates[candidateIndex].fullName}`,
      });

      res.json({ success: true, candidate: db.candidates[candidateIndex] });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/candidates/:id/archive', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const actor = resolveAuthenticatedActor(req, db);
      const candidate = (db.candidates || []).find(
        (c: any) => c.id === req.params.id && c.tenant_id === tenantId
      );

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate record not found' });
      }

      const reason = req.body.reason || 'Platform Admin archived candidate workflow';
      candidate.archived = true;
      candidate.status = 'Closed';
      candidate.archived_at = new Date().toISOString();
      candidate.archived_by = actor.userName;

      logUniversalAudit(db, actor, {
        action: 'ARCHIVE_CANDIDATE',
        actionType: 'UPDATE',
        module: 'Platform Admin — Recruitment',
        entityType: 'Candidate',
        entityId: candidate.id,
        reason,
        details: `Candidate ${candidate.fullName} was archived by ${actor.userName}. Reason: ${reason}`,
      });

      res.json({ success: true, message: `Candidate ${candidate.fullName} archived.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/candidates/:id', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const actor = resolveAuthenticatedActor(req, db);

      if (!actor.isSuperAdmin) {
        return res.status(403).json({ error: 'Only Platform Super Admins can perform controlled candidate deletion.' });
      }

      const candidate = (db.candidates || []).find(
        (c: any) => c.id === req.params.id && c.tenant_id === tenantId
      );

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      const reason = req.body.reason || 'Platform Admin controlled repair removal';
      db.candidates = (db.candidates || []).filter((c: any) => c.id !== req.params.id);

      logUniversalAudit(db, actor, {
        action: 'CONTROLLED_REMOVE_CANDIDATE',
        actionType: 'DELETE',
        module: 'Platform Admin — Recruitment',
        entityType: 'Candidate',
        entityId: candidate.id,
        reason,
        details: `Platform admin ${actor.userName} removed candidate ${candidate.fullName} (${candidate.candidateId}) via controlled repair. Reason: ${reason}`,
      });

      res.json({ success: true, message: `Candidate ${candidate.fullName} successfully removed.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 13. AUDIT LOGS
  // ==========================================
  router.get('/audit', (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      const moduleFilter = req.query.module as string;
      const actionFilter = req.query.action as string;

      let logs = (db.auditLogs || []).filter((l: any) => l.tenant_id === tenantId || l.tenant_id === 'GLOBAL_SUPER_ADMIN');

      if (moduleFilter && moduleFilter !== 'ALL') {
        logs = logs.filter((l: any) => l.module === moduleFilter);
      }

      if (actionFilter && actionFilter !== 'ALL') {
        logs = logs.filter((l: any) => l.action === actionFilter);
      }

      if (search) {
        logs = logs.filter((l: any) => {
          const act = (l.action || '').toLowerCase();
          const mod = (l.module || '').toLowerCase();
          const det = (l.details || '').toLowerCase();
          const rsn = (l.reason || '').toLowerCase();
          const actorName = (l.actor_name || l.userName || '').toLowerCase();
          return act.includes(search) || mod.includes(search) || det.includes(search) || rsn.includes(search) || actorName.includes(search);
        });
      }

      const formatted = logs.slice(0, 200).map((l: any) => ({
        id: l.id,
        tenant_id: l.tenant_id,
        real_actor_user_id: l.real_actor_user_id || l.userId,
        actor_name: l.actor_name || l.userName || 'Platform Admin',
        actor_role: l.actor_role || l.userRole || 'SUPER_ADMIN',
        action: l.action || 'SYSTEM_ACTION',
        module: l.module || 'Platform Core',
        entity_type: l.entity_type || l.entityType || '-',
        entity_id: l.entity_id || l.entityId || '-',
        old_value: l.old_value,
        new_value: l.new_value,
        reason: l.reason || l.notes || '-',
        details: l.details || '-',
        timestamp: l.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      }));

      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ==========================================
  // 14. PASSPORT MANAGEMENT ADMIN (Authoritative)
  // ==========================================
  router.get('/passports', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const search = (req.query.search as string || '').toLowerCase().trim();
      const list = await getAuthoritativePassportCustody(tenantId, getSupabaseClient(), db);
      let filtered = list;
      if (search) {
        filtered = list.filter((p) => {
          const empName = (p.employee_name || '').toLowerCase();
          const empCode = (p.employee_code || '').toLowerCase();
          const eid = (p.emirates_id || '').toLowerCase();
          const passportNo = (p.passport_number || '').toLowerCase();
          return (
            empName.includes(search) ||
            empCode.includes(search) ||
            eid.includes(search) ||
            passportNo.includes(search)
          );
        });
      }
      res.json(filtered);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/passports/stats', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const stats = await calculatePassportStats(tenantId, getSupabaseClient());
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/passports/:id/history', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const history = await getAuthoritativePassportHistory(tenantId, req.params.id, getSupabaseClient());
      res.json({ success: true, history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/passports/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const actor = (req as any).adminActor || { userId: 'admin', userName: 'Platform Super Admin', userRole: 'SUPER_ADMIN' };
      const result = await editPassportAuthoritative(
        req.params.id,
        {
          ...req.body,
          tenant_id: tenantId,
          user_name: actor.userName,
          user_id: actor.userId,
        },
        getSupabaseClient()
      );
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/passports/:id', async (req: Request, res: Response) => {
    try {
      const tenantId = getTargetTenantId(req);
      const actor = (req as any).adminActor || { userId: 'admin', userName: 'Platform Super Admin', userRole: 'SUPER_ADMIN' };
      const body = req.body || {};

      const result = await deletePassportAuthoritative(
        {
          custodyId: req.params.id,
          tenantId,
          actor: {
            userId: actor.userId,
            userName: actor.userName,
            userRole: actor.userRole || 'SUPER_ADMIN',
          },
          reason: body.reason || '',
          confirmationPhrase: body.confirmationPhrase || body.confirmation_phrase || '',
        },
        getSupabaseClient(),
        db
      );

      if (!result.success) {
        return res.status(400).json({ success: false, error: result.error });
      }

      // Also log via platformAdmin logAdminAction
      logAdminAction(
        actor,
        tenantId,
        'ADMIN_PASSPORT_DELETE',
        'Passport Management',
        'PASSPORT_CUSTODY',
        req.params.id,
        result.deletedRecord,
        null,
        body.reason || 'Passport custody record deleted via Platform Admin',
        result.message,
        {
          employee_id: result.deletedRecord?.employee_id,
          employee_name: result.deletedRecord?.employee_name,
        }
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
