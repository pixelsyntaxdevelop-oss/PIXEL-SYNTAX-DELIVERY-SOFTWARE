/**
 * Client-side safe branding cache for instantaneous view rendering.
 * Stores ONLY safe visual metadata in localStorage (no tokens, credentials, or sensitive data).
 */

const BRANDING_CACHE_KEY_PREFIX = 'apex_cached_login_branding_';
const PIXEL_SYNTAX_LOGO = '/pixel-syntax-logo.webp';

export interface SafeCachedBranding {
  tenantId?: string;
  mainLogoUrl: string | null;
  headerLogoUrl?: string | null;
  loginHeroUrl: string | null;
  companyName: string;
  portalSubtitle: string;
  portalTitle?: string;
  loginTagline: string;
  faviconUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  updatedAt?: number;
}

export const DEFAULT_ALLIED_PRODUCTION_BRANDING: SafeCachedBranding = {
  tenantId: 'company_pixel_syntax',
  companyName: 'Pixel Syntax',
  portalSubtitle: 'Pixel Syntax',
  portalTitle: 'Pixel Syntax',
  loginTagline: 'Fleet & Logistics Management Portal',
  mainLogoUrl: '/pixel-syntax-logo.webp',
  headerLogoUrl: '/pixel-syntax-logo.webp',
  loginHeroUrl: '/pixel-syntax-logo.webp',
  faviconUrl: PIXEL_SYNTAX_LOGO,
  primaryColor: '#059669',
  secondaryColor: '#2563eb',
};

const preloadedUrls = new Set<string>();

/**
 * Preloads an image binary into browser cache as early as possible.
 */
export function preloadImage(url?: string | null): void {
  if (!url || typeof window === 'undefined') return;
  if (preloadedUrls.has(url)) return;
  preloadedUrls.add(url);
  const img = new Image();
  img.referrerPolicy = 'no-referrer';
  img.src = url;
}

/**
 * Synchronously retrieves last valid cached branding for a tenant.
 * Guarantees instantaneous first-paint branding for company_pixel_syntax without blocking or flickering.
 */
export function getCachedBranding(tenantId: string = 'company_pixel_syntax'): SafeCachedBranding {
  if (typeof window !== 'undefined') {
    // 1. Check window.__ALLIED_BOOTSTRAP_BRANDING__ if company_pixel_syntax
    const bootstrap = (window as any).__ALLIED_BOOTSTRAP_BRANDING__;
    
    try {
      const raw = localStorage.getItem(`${BRANDING_CACHE_KEY_PREFIX}${tenantId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Demo brand is fixed to the approved PS artwork, ignoring stale login imagery.
        if (parsed && tenantId === 'company_pixel_syntax') {
          parsed.mainLogoUrl = PIXEL_SYNTAX_LOGO;
          parsed.headerLogoUrl = PIXEL_SYNTAX_LOGO;
          parsed.loginHeroUrl = PIXEL_SYNTAX_LOGO;
          parsed.faviconUrl = PIXEL_SYNTAX_LOGO;
        }
        if (parsed && typeof parsed === 'object') {
          const effectiveLogo = parsed.mainLogoUrl || parsed.logoUrl || (bootstrap?.mainLogoUrl ?? (tenantId === 'company_pixel_syntax' ? '/pixel-syntax-logo.webp' : null));
          const effectiveHero = parsed.loginHeroUrl || (bootstrap?.loginHeroUrl ?? (tenantId === 'company_pixel_syntax' ? '/pixel-syntax-logo.webp' : null));
          const effectiveHeader = parsed.headerLogoUrl || effectiveLogo || (bootstrap?.headerLogoUrl ?? (tenantId === 'company_pixel_syntax' ? '/pixel-syntax-logo.webp' : null));

          // Trigger background preload for cached image URLs immediately
          if (effectiveHero) preloadImage(effectiveHero);
          if (effectiveLogo) preloadImage(effectiveLogo);
          if (effectiveHeader) preloadImage(effectiveHeader);

          return {
            tenantId: parsed.tenantId || tenantId,
            mainLogoUrl: effectiveLogo,
            headerLogoUrl: effectiveHeader,
            loginHeroUrl: effectiveHero,
            companyName: parsed.companyName || (bootstrap?.companyName ?? 'Pixel Syntax'),
            portalSubtitle: parsed.portalSubtitle || parsed.portalTitle || (bootstrap?.portalSubtitle ?? (tenantId === 'company_pixel_syntax' ? 'Pixel Syntax' : 'Operations Portal')),
            portalTitle: parsed.portalTitle || parsed.portalSubtitle || (bootstrap?.portalTitle ?? (tenantId === 'company_pixel_syntax' ? 'Pixel Syntax' : 'Operations Portal')),
            loginTagline: parsed.loginTagline || (bootstrap?.loginTagline ?? 'Fleet & Logistics Management Portal'),
            faviconUrl: parsed.faviconUrl || (bootstrap?.faviconUrl ?? PIXEL_SYNTAX_LOGO),
            primaryColor: parsed.primaryColor || (bootstrap?.primaryColor ?? '#059669'),
            secondaryColor: parsed.secondaryColor || '#2563eb',
            updatedAt: parsed.updatedAt,
          };
        }
      }
    } catch {
      // Graceful fallback on localStorage error
    }

    if (bootstrap && tenantId === 'company_pixel_syntax') {
      const bHero = bootstrap.loginHeroUrl || '/pixel-syntax-logo.webp';
      const bLogo = bootstrap.mainLogoUrl || bootstrap.logoUrl || '/pixel-syntax-logo.webp';
      const bHeader = bootstrap.headerLogoUrl || bLogo;

      preloadImage(bHero);
      preloadImage(bLogo);
      preloadImage(bHeader);

      return {
        tenantId: 'company_pixel_syntax',
        mainLogoUrl: bLogo,
        headerLogoUrl: bHeader,
        loginHeroUrl: bHero,
        companyName: bootstrap.companyName || 'Pixel Syntax',
        portalSubtitle: bootstrap.portalSubtitle || bootstrap.portalTitle || 'Pixel Syntax',
        portalTitle: bootstrap.portalTitle || bootstrap.portalSubtitle || 'Pixel Syntax',
        loginTagline: bootstrap.loginTagline || 'Fleet & Logistics Management Portal',
        faviconUrl: bootstrap.faviconUrl || PIXEL_SYNTAX_LOGO,
        primaryColor: bootstrap.primaryColor || '#059669',
        secondaryColor: '#2563eb',
      };
    }
  }

  // Authoritative default fallback
  return tenantId === 'company_pixel_syntax'
    ? { ...DEFAULT_ALLIED_PRODUCTION_BRANDING }
    : {
        tenantId,
        mainLogoUrl: null,
        headerLogoUrl: null,
        loginHeroUrl: null,
        companyName: tenantId.replace('company_', '').toUpperCase(),
        portalSubtitle: 'Operations Portal',
        portalTitle: 'Operations Portal',
        loginTagline: 'Fleet & Logistics Management Portal',
        faviconUrl: PIXEL_SYNTAX_LOGO,
        primaryColor: '#059669',
        secondaryColor: '#2563eb',
      };
}

/**
 * Persists ONLY safe visual branding metadata to localStorage.
 */
export function setCachedBranding(
  tenantId: string = 'company_pixel_syntax',
  branding: {
    logoUrl?: string | null;
    mainLogoUrl?: string | null;
    headerLogoUrl?: string | null;
    loginHeroUrl?: string | null;
    companyName?: string;
    portalSubtitle?: string;
    portalTitle?: string;
    loginTagline?: string;
    faviconUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getCachedBranding(tenantId);
    const safePayload: SafeCachedBranding = {
      tenantId,
      mainLogoUrl: branding.mainLogoUrl !== undefined ? branding.mainLogoUrl : branding.logoUrl !== undefined ? branding.logoUrl : (existing.mainLogoUrl || null),
      headerLogoUrl: branding.headerLogoUrl !== undefined ? branding.headerLogoUrl : (existing.headerLogoUrl || null),
      loginHeroUrl: branding.loginHeroUrl !== undefined ? branding.loginHeroUrl : (existing.loginHeroUrl || null),
      companyName: branding.companyName || existing.companyName || 'Pixel Syntax',
      portalSubtitle: branding.portalSubtitle || branding.portalTitle || existing.portalSubtitle || 'Operations Portal',
      portalTitle: branding.portalTitle || branding.portalSubtitle || existing.portalTitle || 'Operations Portal',
      loginTagline: branding.loginTagline || existing.loginTagline || 'Fleet & Logistics Management Portal',
      faviconUrl: branding.faviconUrl || existing.faviconUrl || PIXEL_SYNTAX_LOGO,
      primaryColor: branding.primaryColor || existing.primaryColor || '#059669',
      secondaryColor: branding.secondaryColor || existing.secondaryColor || '#2563eb',
      updatedAt: Date.now(),
    };
    if (tenantId === 'company_pixel_syntax') {
      safePayload.mainLogoUrl = PIXEL_SYNTAX_LOGO;
      safePayload.headerLogoUrl = PIXEL_SYNTAX_LOGO;
      safePayload.loginHeroUrl = PIXEL_SYNTAX_LOGO;
      safePayload.faviconUrl = PIXEL_SYNTAX_LOGO;
    }
    localStorage.setItem(`${BRANDING_CACHE_KEY_PREFIX}${tenantId}`, JSON.stringify(safePayload));

    // Update bootstrap global cache
    if (typeof window !== 'undefined' && tenantId === 'company_pixel_syntax') {
      (window as any).__ALLIED_BOOTSTRAP_BRANDING__ = {
        ...(window as any).__ALLIED_BOOTSTRAP_BRANDING__,
        ...safePayload,
      };
    }

    // Preload image binaries immediately
    if (safePayload.loginHeroUrl) preloadImage(safePayload.loginHeroUrl);
    if (safePayload.mainLogoUrl) preloadImage(safePayload.mainLogoUrl);
    if (safePayload.headerLogoUrl) preloadImage(safePayload.headerLogoUrl);
  } catch {
    // Quota or access error handling
  }
}

// In-flight promise tracker and in-memory TTL cache to eliminate duplicate network requests on startup
const inFlightRequests = new Map<string, Promise<any>>();
const memoryContextCache = new Map<string, { data: any; timestamp: number }>();
const CLIENT_CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Deduplicated client-side fetch for authoritative tenant context.
 * Guarantees that concurrent calls from Header, Login, and AlliedLogo share ONE single HTTP request.
 */
export async function fetchAuthoritativeTenantContext(
  tenantId: string = 'company_pixel_syntax',
  options?: { force?: boolean }
): Promise<any> {
  const now = Date.now();
  if (!options?.force) {
    const cached = memoryContextCache.get(tenantId);
    if (cached && now - cached.timestamp < CLIENT_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  if (inFlightRequests.has(tenantId)) {
    return inFlightRequests.get(tenantId);
  }

  const promise = (async () => {
    try {
      const res = await fetch(`/api/auth/tenant-context?tenant=${encodeURIComponent(tenantId)}`, {
        headers: { 'x-tenant-id': tenantId },
      });
      if (!res.ok) {
        throw new Error(`Tenant context fetch returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (tenantId === 'company_pixel_syntax' && data) {
        data.logoUrl = PIXEL_SYNTAX_LOGO;
        data.mainLogoUrl = PIXEL_SYNTAX_LOGO;
        data.headerLogoUrl = PIXEL_SYNTAX_LOGO;
        data.loginHeroUrl = PIXEL_SYNTAX_LOGO;
        data.faviconUrl = PIXEL_SYNTAX_LOGO;
      }
      memoryContextCache.set(tenantId, { data, timestamp: Date.now() });

      // Synchronize client cache if valid data received
      if (data) {
        const isAllied = tenantId === 'company_pixel_syntax';
        setCachedBranding(tenantId, {
          mainLogoUrl: data.logoUrl || data.mainLogoUrl || (isAllied ? '/pixel-syntax-logo.webp' : null),
          headerLogoUrl: data.headerLogoUrl || data.logoUrl || (isAllied ? '/pixel-syntax-logo.webp' : null),
          loginHeroUrl: data.loginHeroUrl || (isAllied ? '/pixel-syntax-logo.webp' : null),
          companyName: data.companyName || (isAllied ? 'Pixel Syntax' : data.companyName),
          portalTitle: data.portalTitle || (isAllied ? 'Pixel Syntax' : data.portalTitle),
          portalSubtitle: data.portalTitle || (isAllied ? 'Pixel Syntax' : data.portalTitle),
          loginTagline: data.loginTagline || 'Fleet & Logistics Management Portal',
          faviconUrl: data.faviconUrl || PIXEL_SYNTAX_LOGO,
          primaryColor: data.primaryColor,
          secondaryColor: data.secondaryColor,
        });
      }
      return data;
    } finally {
      inFlightRequests.delete(tenantId);
    }
  })();

  inFlightRequests.set(tenantId, promise);
  return promise;
}

/**
 * Helper to check whether incoming branding data genuinely differs from current state.
 * Prevents unnecessary re-renders or layout flicker after initial paint.
 */
export function hasBrandingChanged(current: any, next: any): boolean {
  if (!current || !next) return true;
  return (
    (next.headerLogoUrl !== undefined && next.headerLogoUrl !== current.headerLogoUrl) ||
    (next.loginHeroUrl !== undefined && next.loginHeroUrl !== current.loginHeroUrl) ||
    (next.logoUrl !== undefined && next.logoUrl !== current.logoUrl) ||
    (next.companyName !== undefined && next.companyName !== current.companyName) ||
    (next.portalTitle !== undefined && next.portalTitle !== current.portalTitle) ||
    (next.loginTagline !== undefined && next.loginTagline !== current.loginTagline)
  );
}
