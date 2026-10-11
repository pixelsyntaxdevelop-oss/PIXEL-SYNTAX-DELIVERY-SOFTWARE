/**
 * Multi-Tenant Authentication & Identity Resolution Service
 * Production token-based session management, individual accounts, and strict RBAC
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { apiClient } from './apiClient';
import { SystemUserAccount, UserRole } from '../types/erp';
import { fetchAuthoritativeTenantContext } from '../utils/brandingCache';

export interface AuthSessionData {
  user: SystemUserAccount;
  tenantId: string;
  isSuperAdmin: boolean;
  isCompanyAdmin: boolean;
  token?: string;
  assignedBranchIds: string[];
  assignedDepartmentIds: string[];
  permissions: Record<string, Record<string, boolean>>; // module -> action -> boolean
}

class AuthService {
  private currentSession: AuthSessionData | null = null;
  private isInitialized: boolean = false;
  private listeners: ((session: AuthSessionData | null) => void)[] = [];

  constructor() {
    this.initSession();
  }

  public async initSession(): Promise<AuthSessionData | null> {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token')
      : null;

    if (!token) {
      this.isInitialized = true;
      this.setSession(null);
      return null;
    }

    // Restore cached session immediately to allow instantaneous render without white screens
    if (typeof window !== 'undefined') {
      try {
        const cachedRaw = localStorage.getItem('apex_cached_session');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (parsed && parsed.user) {
            const user = { ...parsed.user };
            if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
              user.allowedModules = ['ALL'];
            }
            this.setSession({ ...parsed, user, token });
          }
        }
      } catch {}
    }

    try {
      apiClient.setAuthContext(token, null);
      const res = await apiClient.get<AuthSessionData>('/api/auth/current-session');

      if (res.data && res.data.user && !res.error) {
        const user = { ...res.data.user };
        if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
          user.allowedModules = ['ALL'];
        }
        const fullSession: AuthSessionData = { ...res.data, user, token };
        this.setSession(fullSession);
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_session_token', token);
          sessionStorage.setItem('apex_session_token', token);
          localStorage.setItem('apex_cached_session', JSON.stringify(fullSession));
        }
        this.isInitialized = true;
        return this.currentSession;
      } else if (
        res.status === 401 ||
        res.code === 'SESSION_EXPIRED' ||
        res.code === 'SESSION_REVOKED' ||
        res.code === 'UNAUTHENTICATED'
      ) {
        // Confirmed expired, revoked, or invalid session from authority
        this.clearStoredTokens();
        this.setSession(null);
        this.isInitialized = true;
        return null;
      } else {
        // Transient network, gateway (502/503), or 5xx server error:
        // Do NOT wipe credentials or log the user out!
        console.warn('⚠️ Non-fatal response while checking current-session, preserving authenticated state:', res.error);
        this.isInitialized = true;
        return this.currentSession;
      }
    } catch (err: any) {
      // Network failure or unexpected exception: preserve stored tokens
      console.warn('⚠️ Exception during session verification, keeping stored session:', err?.message);
      this.isInitialized = true;
      return this.currentSession;
    }
  }

  private clearStoredTokens() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('apex_session_token');
      sessionStorage.removeItem('apex_session_token');
      localStorage.removeItem('apex_cached_session');
    }
  }

  public subscribe(listener: (session: AuthSessionData | null) => void): () => void {
    this.listeners.push(listener);
    listener(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public setSession(session: AuthSessionData | null) {
    this.currentSession = session;
    if (session) {
      apiClient.setTenantContext(session.tenantId, session.isSuperAdmin);
      apiClient.setAuthContext(session.token || null, session.user.id);
    } else {
      apiClient.setAuthContext(null, null);
    }
    this.listeners.forEach((l) => l(this.currentSession));
  }

  public getSession(): AuthSessionData | null {
    return this.currentSession;
  }

  public getCurrentUser(): SystemUserAccount | null {
    return this.currentSession?.user || null;
  }

  public getActiveTenantId(): string {
    return this.currentSession?.tenantId || 'company_pixel_syntax';
  }

  public isAuthenticated(): boolean {
    return Boolean(this.currentSession && this.currentSession.user);
  }

  public isSuperAdmin(): boolean {
    return Boolean(this.currentSession?.isSuperAdmin);
  }

  public isCompanyAdmin(): boolean {
    return Boolean(this.currentSession?.isCompanyAdmin || this.currentSession?.isSuperAdmin);
  }

  public hasPermission(module: string, action: string = 'view'): boolean {
    if (!this.currentSession) return false;
    if (this.currentSession.isSuperAdmin) return true;
    if (this.currentSession.user.isOwner) return true;

    // Check allowed modules array safely
    const allowed = Array.isArray(this.currentSession.user?.allowedModules)
      ? this.currentSession.user.allowedModules
      : ['ALL'];
    if (!allowed.includes('ALL') && !allowed.includes(module)) {
      return false;
    }

    const perms = this.currentSession.permissions;
    if (!perms || !perms[this.currentSession.user.role]) return true;
    const rolePerms = perms[this.currentSession.user.role];
    if (!rolePerms || !rolePerms[module]) return true;
    return Boolean((rolePerms[module] as any)[action] ?? true);
  }

  public canAccessBranch(branchId: string): boolean {
    if (!this.currentSession) return false;
    if (this.currentSession.isSuperAdmin || this.currentSession.isCompanyAdmin) return true;
    const branchIds = this.currentSession.assignedBranchIds;
    if (!branchIds || !Array.isArray(branchIds) || !branchIds.length) return true;
    return branchIds.includes(branchId);
  }

  public canAccessDepartment(departmentId: string): boolean {
    if (!this.currentSession) return false;
    if (this.currentSession.isSuperAdmin || this.currentSession.isCompanyAdmin) return true;
    const deptIds = this.currentSession.assignedDepartmentIds;
    if (!deptIds || !Array.isArray(deptIds) || !deptIds.length) return true;
    return deptIds.includes(departmentId);
  }

  public async getTenantContext(requestedTenantId?: string): Promise<{
    isPlatformDomain: boolean;
    tenantId?: string;
    companyName: string;
    logoUrl?: string | null;
    portalTitle: string;
    loginHeroUrl?: string | null;
    loginBgUrl?: string | null;
    loginTagline?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    turnstileEnabled?: boolean;
    turnstileSiteKey?: string | null;
    status: string;
    allowTenantSelection: boolean;
    customHero?: boolean;
    branding_assets?: Record<string, any>;
  }> {
    try {
      const urlTenant = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tenant') : null;
      const targetTenant = requestedTenantId || urlTenant || 'company_pixel_syntax';
      const data = await fetchAuthoritativeTenantContext(targetTenant);
      if (data) {
        return {
          ...data,
          customHero: Boolean(data.loginHeroUrl),
        };
      }
    } catch {}
    return {
      isPlatformDomain: false,
      companyName: 'Pixel Syntax Delivery Software',
      logoUrl: '/allied-logo-original.png',
      loginHeroUrl: '/allied-hero.jpg',
      portalTitle: 'Pixel Syntax Delivery Software',
      loginTagline: 'Fleet & Logistics Management Portal',
      status: 'ACTIVE',
      allowTenantSelection: false,
      customHero: true,
    };
  }

  public async loginWithCredentials(
    identifier: string,
    password: string,
    rememberMe: boolean = false,
    tenantId?: string
  ): Promise<{ success: boolean; error?: string; session?: AuthSessionData }> {
    const res = await apiClient.post<AuthSessionData>('/api/auth/login', {
      username: identifier,
      email: identifier,
      password,
      rememberMe,
      tenantId,
    });

    if (res.error || !res.data) {
      return { success: false, error: res.error || 'Invalid credentials' };
    }

    const sessionData = { ...res.data };
    const user = { ...sessionData.user };
    if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
      user.allowedModules = ['ALL'];
    }
    sessionData.user = user;

    if (sessionData.token) {
      if (typeof window !== 'undefined') {
        // Persist token in localStorage & sessionStorage so same-day browser close/reopen preserves login
        localStorage.setItem('apex_session_token', sessionData.token);
        sessionStorage.setItem('apex_session_token', sessionData.token);
        localStorage.setItem('apex_cached_session', JSON.stringify(sessionData));
      }
    }

    this.setSession(sessionData);
    return { success: true, session: sessionData };
  }

  public async loginWithEmailPassword(
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string; session?: AuthSessionData }> {
    return this.loginWithCredentials(email, password, false);
  }

  public async switchActiveUser(userId: string): Promise<{ success: boolean; session?: AuthSessionData; error?: string }> {
    const res = await apiClient.post<AuthSessionData>('/api/auth/switch-user', { userId });
    if (res.data && !res.error) {
      const sessionData = { ...res.data };
      const user = { ...sessionData.user };
      if (!user.allowedModules || !Array.isArray(user.allowedModules)) {
        user.allowedModules = ['ALL'];
      }
      sessionData.user = user;
      if (res.data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('apex_session_token', res.data.token);
          sessionStorage.setItem('apex_session_token', res.data.token);
          localStorage.setItem('apex_cached_session', JSON.stringify(sessionData));
        }
      }
      this.setSession(sessionData);
      return { success: true, session: sessionData };
    }
    return { success: false, error: res.error || 'Failed to switch user' };
  }

  public clearLocalSession(): void {
    this.clearStoredTokens();
    this.setSession(null);
  }

  public async logout(): Promise<void> {
    try {
      await apiClient.post('/api/auth/logout', {});
    } catch {}
    this.clearStoredTokens();
    this.setSession(null);
  }

  public async forgotPassword(identifier: string, tenantId?: string): Promise<{ success: boolean; error?: string; message?: string; resetToken?: string }> {
    const res = await apiClient.post<any>('/api/auth/forgot-password', {
      email: identifier,
      username: identifier,
      tenantId,
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message, resetToken: res.data?.resetToken };
  }

  public async confirmResetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await apiClient.post<any>('/api/auth/reset-password', {
      token,
      newPassword,
    });
    if (res.error) return { success: false, error: res.error };
    return { success: true, message: res.data?.message };
  }
}

export const authService = new AuthService();
