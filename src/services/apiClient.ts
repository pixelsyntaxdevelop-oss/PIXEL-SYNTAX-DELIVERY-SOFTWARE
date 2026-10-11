/**
 * Unified API Client for Multi-Tenant Delivery Operations ERP
 * Handles tenant header injection, auth tokens, error propagation, and Supabase integration
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  code?: string;
  count?: number;
  status: number;
}

class ApiClient {
  private activeTenantId: string = (() => {
    if (typeof window !== 'undefined') {
      const urlTenant = new URLSearchParams(window.location.search).get('tenant');
      if (urlTenant) return urlTenant;
      // On login screen / unauthenticated root, always default to authoritative company_pixel_syntax
      if (window.location.pathname === '/login' || window.location.pathname === '/') {
        const stored = localStorage.getItem('apex_active_tenant_id');
        if (stored && stored !== 'company_demo') return stored;
        return 'company_pixel_syntax';
      }
      const stored = localStorage.getItem('apex_active_tenant_id');
      if (stored) return stored;
    }
    return 'company_pixel_syntax';
  })();
  private authToken: string | null = null;
  private currentUserId: string | null = null;
  private realUserId: string | null = null;
  private impersonatedUserId: string | null = null;
  private isSuperAdmin: boolean = false;

  public setTenantContext(tenantId: string, isSuperAdmin: boolean = false) {
    this.activeTenantId = tenantId || 'company_pixel_syntax';
    this.isSuperAdmin = isSuperAdmin;
    if (typeof window !== 'undefined' && tenantId) {
      localStorage.setItem('apex_active_tenant_id', tenantId);
    }
  }

  public setAuthContext(
    token: string | null,
    userId: string | null,
    realUserId?: string | null,
    impersonatedUserId?: string | null
  ) {
    this.authToken = token;
    this.currentUserId = userId;
    this.realUserId = realUserId || userId;
    this.impersonatedUserId = impersonatedUserId || null;
  }

  public getActiveTenantId(): string {
    return this.activeTenantId;
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
    const headers: Record<string, string> = {
      'x-tenant-id': this.activeTenantId || 'company_pixel_syntax',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers as Record<string, string> || {}),
    };

    const storedToken = typeof window !== 'undefined'
      ? localStorage.getItem('apex_session_token') || sessionStorage.getItem('apex_session_token')
      : null;
    const tokenToUse = this.authToken || storedToken;

    if (tokenToUse) {
      headers['Authorization'] = `Bearer ${tokenToUse}`;
    }
    if (this.currentUserId) {
      headers['x-user-id'] = this.currentUserId;
    }
    if (this.realUserId) {
      headers['x-real-user-id'] = this.realUserId;
    }
    if (this.impersonatedUserId) {
      headers['x-impersonated-user-id'] = this.impersonatedUserId;
    }
    if (this.isSuperAdmin) {
      headers['x-is-super-admin'] = 'true';
    }

    try {
      const response = await fetch(endpoint, {
        ...options,
        credentials: 'include',
        headers,
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (
          response.status === 401 &&
          typeof window !== 'undefined' &&
          (json.code === 'SESSION_EXPIRED' || json.code === 'SESSION_REVOKED')
        ) {
          window.dispatchEvent(
            new CustomEvent('apex_unauthorized', {
              detail: { code: json.code, endpoint, error: json.error }
            })
          );
        }
        return {
          error: json.error || `Request failed with status ${response.status}`,
          code: json.code,
          status: response.status,
        };
      }

      // If the response object contains pagination alongside data (like { data: [...], pagination: {...} }),
      // we preserve the full object so the caller receives pagination and metrics metadata.
      const resolvedData =
        json && json.data !== undefined && json.pagination === undefined
          ? json.data
          : json;

      return {
        data: resolvedData,
        count: json?.count ?? json?.pagination?.total,
        status: response.status,
      };
    } catch (err: any) {
      console.error(`API Client Error [${endpoint}]:`, err);
      return {
        error: err.message || 'Network error or server unreachable',
        status: 500,
      };
    }
  }

  public get<T = any>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  public post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
    });
  }

  public put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
    });
  }

  public patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>) {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      headers,
    });
  }

  public delete<T = any>(endpoint: string, headers?: Record<string, string>) {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const apiClient = new ApiClient();
