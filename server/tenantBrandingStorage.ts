import fs from 'fs';
import path from 'path';
import { getSupabaseClient } from './supabaseDb';

const PERSISTENT_BRANDING_FILE = path.join(process.cwd(), 'data', 'persistent_tenant_branding.json');

export interface TenantBrandingConfig {
  tenantId: string;
  name?: string;
  companyName?: string;
  portalTitle?: string;
  loginTagline?: string;
  logoUrl?: string | null;
  loginHeroUrl?: string | null;
  loginBgUrl?: string | null;
  sidebarLogoUrl?: string | null;
  headerLogoUrl?: string | null;
  faviconUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  turnstileEnabled?: boolean;
  turnstileSiteKey?: string | null;
  branding_assets?: Record<string, any>;
  updated_at?: string;
}

function sanitizeCustomLogo(url?: string | null): string | null {
  if (!url) return null;
  if (url.includes('images.unsplash.com') || url.includes('photo-1586528116311-ad8dd3c8310d')) {
    return null;
  }
  return url;
}

/**
 * Load saved tenant branding configurations from local persistent disk
 */
export function loadPersistentTenantBranding(db: any): void {
  try {
    if (fs.existsSync(PERSISTENT_BRANDING_FILE)) {
      const raw = fs.readFileSync(PERSISTENT_BRANDING_FILE, 'utf-8');
      const savedMap = JSON.parse(raw);
      if (savedMap && typeof savedMap === 'object') {
        for (const [tenantId, bData] of Object.entries<any>(savedMap)) {
          const tenant = (db.tenants || []).find((t: any) => t.id === tenantId);
          if (tenant && bData) {
            if (bData.name || bData.companyName) tenant.name = bData.name || bData.companyName;
            if (bData.portalTitle !== undefined) tenant.portalTitle = bData.portalTitle;
            if (bData.loginTagline !== undefined) tenant.loginTagline = bData.loginTagline;
            if (bData.logoUrl !== undefined) tenant.logoUrl = sanitizeCustomLogo(bData.logoUrl);
            if (bData.loginHeroUrl !== undefined) tenant.loginHeroUrl = bData.loginHeroUrl;
            if (bData.loginBgUrl !== undefined) tenant.loginBgUrl = bData.loginBgUrl;
            if (bData.sidebarLogoUrl !== undefined) tenant.sidebarLogoUrl = sanitizeCustomLogo(bData.sidebarLogoUrl);
            if (bData.headerLogoUrl !== undefined) tenant.headerLogoUrl = sanitizeCustomLogo(bData.headerLogoUrl);
            if (bData.faviconUrl !== undefined) tenant.faviconUrl = bData.faviconUrl;
            if (bData.supportEmail !== undefined) tenant.supportEmail = bData.supportEmail;
            if (bData.supportPhone !== undefined) tenant.supportPhone = bData.supportPhone;
            if (bData.primaryColor !== undefined) tenant.primaryColor = bData.primaryColor;
            if (bData.secondaryColor !== undefined) tenant.secondaryColor = bData.secondaryColor;
            if (bData.turnstileEnabled !== undefined) tenant.turnstileEnabled = bData.turnstileEnabled;
            if (bData.turnstileSiteKey !== undefined) tenant.turnstileSiteKey = bData.turnstileSiteKey;
            if (bData.branding_assets !== undefined) tenant.branding_assets = bData.branding_assets;
          }
        }
        console.log('✅ Authoritative tenant branding loaded from persistent storage.');
      }
    }
  } catch (err) {
    console.warn('⚠️ Could not load persistent tenant branding:', err);
  }
}

/**
 * Save all tenant branding configurations to local persistent disk
 */
export function savePersistentTenantBranding(db: any): void {
  try {
    const dir = path.dirname(PERSISTENT_BRANDING_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const brandingMap: Record<string, any> = {};
    for (const t of db.tenants || []) {
      brandingMap[t.id] = {
        name: t.name,
        companyName: t.name,
        portalTitle: t.portalTitle || '',
        loginTagline: t.loginTagline || '',
        logoUrl: t.logoUrl || null,
        loginHeroUrl: t.loginHeroUrl || null,
        loginBgUrl: t.loginBgUrl || null,
        sidebarLogoUrl: t.sidebarLogoUrl || null,
        headerLogoUrl: t.headerLogoUrl || null,
        faviconUrl: t.faviconUrl || null,
        supportEmail: t.supportEmail || 'support@alliedfleet.com',
        supportPhone: t.supportPhone || '+971 4 000 0000',
        primaryColor: t.primaryColor || '#059669',
        secondaryColor: t.secondaryColor || '#2563eb',
        turnstileEnabled: Boolean(t.turnstileEnabled),
        turnstileSiteKey: t.turnstileSiteKey || null,
        branding_assets: t.branding_assets || {},
        updated_at: new Date().toISOString(),
      };
    }

    fs.writeFileSync(PERSISTENT_BRANDING_FILE, JSON.stringify(brandingMap, null, 2), 'utf-8');
    invalidateTenantBrandingCache();
    console.log('✅ Authoritative tenant branding successfully saved to persistent disk.');
  } catch (err) {
    console.warn('⚠️ Could not save persistent tenant branding to disk:', err);
  }
}

/**
 * Persist branding changes directly to Supabase cloud database if configured
 */
export async function syncTenantBrandingToSupabase(tenantId: string, tenant: any): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const brandingPayload = {
      companyName: tenant.name,
      portalTitle: tenant.portalTitle || '',
      loginTagline: tenant.loginTagline || '',
      logoUrl: tenant.logoUrl || null,
      loginHeroUrl: tenant.loginHeroUrl || null,
      loginBgUrl: tenant.loginBgUrl || null,
      sidebarLogoUrl: tenant.sidebarLogoUrl || null,
      headerLogoUrl: tenant.headerLogoUrl || null,
      faviconUrl: tenant.faviconUrl || null,
      supportEmail: tenant.supportEmail || 'support@alliedfleet.com',
      supportPhone: tenant.supportPhone || '+971 4 000 0000',
      primaryColor: tenant.primaryColor || '#059669',
      secondaryColor: tenant.secondaryColor || '#2563eb',
      turnstileEnabled: Boolean(tenant.turnstileEnabled),
      turnstileSiteKey: tenant.turnstileSiteKey || null,
      branding_assets: tenant.branding_assets || {},
      updated_at: new Date().toISOString(),
    };

    // 1. Update tenants table
    await supabase
      .from('tenants')
      .update({
        name: tenant.name,
        logo_url: tenant.logoUrl || null,
        primary_color: tenant.primaryColor || '#059669',
        domain: tenant.domain || (tenantId === 'company_pixel_syntax' ? 'deliverysoftwarepixel.site' : undefined),
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    // 2. Upsert into tenant_settings table
    await supabase
      .from('tenant_settings')
      .upsert(
        {
          tenant_id: tenantId,
          custom_branding: brandingPayload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' }
      );

    console.log(`✅ Synced authoritative tenant branding for [${tenantId}] to Supabase.`);
  } catch (err) {
    console.warn(`⚠️ Error syncing tenant branding for [${tenantId}] to Supabase:`, err);
  }
}

/**
 * Restore authoritative branding from Supabase into in-memory db.tenants
 */
export async function loadTenantBrandingFromSupabase(db: any, specificTenantId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // 1. Query tenant_settings
    let settingsQuery = supabase.from('tenant_settings').select('*');
    if (specificTenantId) {
      settingsQuery = settingsQuery.eq('tenant_id', specificTenantId);
    }
    const { data: settingsRows, error: settingsErr } = await settingsQuery;

    if (!settingsErr && Array.isArray(settingsRows)) {
      for (const row of settingsRows) {
        const tId = row.tenant_id;
        if (!tId) continue;
        const tenant = (db.tenants || []).find((t: any) => t.id === tId);
        if (!tenant) continue;

        let cb = row.custom_branding;
        if (typeof cb === 'string') {
          try {
            cb = JSON.parse(cb);
          } catch {}
        }

        if (cb && typeof cb === 'object') {
          if (cb.companyName || cb.name) tenant.name = cb.companyName || cb.name;
          if (cb.portalTitle !== undefined) tenant.portalTitle = cb.portalTitle;
          if (cb.loginTagline !== undefined) tenant.loginTagline = cb.loginTagline;
          if (cb.logoUrl !== undefined) tenant.logoUrl = cb.logoUrl;
          if (cb.loginHeroUrl !== undefined) tenant.loginHeroUrl = cb.loginHeroUrl;
          else if (cb.heroUrl !== undefined) tenant.loginHeroUrl = cb.heroUrl;
          else if (cb.login_hero_url !== undefined) tenant.loginHeroUrl = cb.login_hero_url;
          else if (cb.hero_url !== undefined) tenant.loginHeroUrl = cb.hero_url;
          if (cb.loginBgUrl !== undefined) tenant.loginBgUrl = cb.loginBgUrl;
          if (cb.sidebarLogoUrl !== undefined) tenant.sidebarLogoUrl = cb.sidebarLogoUrl;
          if (cb.headerLogoUrl !== undefined) tenant.headerLogoUrl = cb.headerLogoUrl;
          if (cb.faviconUrl !== undefined) tenant.faviconUrl = cb.faviconUrl;
          if (cb.supportEmail !== undefined) tenant.supportEmail = cb.supportEmail;
          if (cb.supportPhone !== undefined) tenant.supportPhone = cb.supportPhone;
          if (cb.primaryColor !== undefined) tenant.primaryColor = cb.primaryColor;
          if (cb.secondaryColor !== undefined) tenant.secondaryColor = cb.secondaryColor;
          if (cb.turnstileEnabled !== undefined) tenant.turnstileEnabled = cb.turnstileEnabled;
          if (cb.turnstileSiteKey !== undefined) tenant.turnstileSiteKey = cb.turnstileSiteKey;
          if (cb.branding_assets !== undefined) tenant.branding_assets = cb.branding_assets;
        }

        // Direct column overrides if present
        if (row.login_hero_url) tenant.loginHeroUrl = row.login_hero_url;
        if (row.hero_url) tenant.loginHeroUrl = row.hero_url;
        if (row.logo_url) tenant.logoUrl = row.logo_url;
      }
    }

    // 2. Query tenants table
    let tenantQuery = supabase.from('tenants').select('*');
    if (specificTenantId) {
      tenantQuery = tenantQuery.eq('id', specificTenantId);
    }
    const { data: tenantRows, error: tenantErr } = await tenantQuery;

    if (!tenantErr && Array.isArray(tenantRows)) {
      for (const row of tenantRows) {
        const tenant = (db.tenants || []).find((t: any) => t.id === row.id);
        if (tenant) {
          if (row.name) tenant.name = row.name;
          if (row.logo_url) tenant.logoUrl = row.logo_url;
          if (row.primary_color) tenant.primaryColor = row.primary_color;
          if (row.domain) tenant.domain = row.domain;
          if (row.login_hero_url) tenant.loginHeroUrl = row.login_hero_url;
          if (row.hero_url) tenant.loginHeroUrl = row.hero_url;
        }
      }
    }
  } catch (err) {
    console.warn('⚠️ Error loading tenant branding from Supabase:', err);
  }
}

interface AuthoritativeCacheEntry {
  data: any;
  cachedAt: number;
}

const authoritativeBrandingCache = new Map<string, AuthoritativeCacheEntry>();
const BRANDING_SERVER_CACHE_TTL_MS = 60 * 1000; // 60s fast in-memory server cache

export function invalidateTenantBrandingCache(tenantId?: string): void {
  if (tenantId) {
    authoritativeBrandingCache.delete(tenantId);
  } else {
    authoritativeBrandingCache.clear();
  }
}

/**
 * Authoritative Tenant Branding Resolver
 * Guarantees that Admin Save and Live /login Fetch read from the SAME unified store:
 * 1. Fast in-memory server cache (<5ms)
 * 2. Disk persistence (/data/persistent_tenant_branding.json)
 * 3. Supabase Cloud DB with safe background revalidation (never blocking login requests)
 */
export async function getAuthoritativeTenantBranding(
  tenantId: string,
  db: any,
  forceRevalidate: boolean = false
): Promise<any> {
  // 1. Fast path: in-memory server cache
  if (!forceRevalidate && authoritativeBrandingCache.has(tenantId)) {
    const cached = authoritativeBrandingCache.get(tenantId)!;
    if (Date.now() - cached.cachedAt < BRANDING_SERVER_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 2. Ensure persistent disk branding is loaded into memory if not already present
  const existing = (db.tenants || []).find((t: any) => t.id === tenantId);
  if (!existing) {
    loadPersistentTenantBranding(db);
  }

  // 3. Find tenant record in db.tenants
  let tenant = (db.tenants || []).find((t: any) => t.id === tenantId);
  if (!tenant) {
    tenant = {
      id: tenantId,
      name: tenantId === 'company_pixel_syntax' ? 'Pixel Syntax' : 'Pixel Syntax Delivery Software Demo',
      domain: tenantId === 'company_pixel_syntax' ? 'deliverysoftwarepixel.site' : 'deliverysoftwarepixel.site',
      status: 'ACTIVE',
    };
    if (!db.tenants) db.tenants = [];
    db.tenants.push(tenant);
  }

  // If hero artwork is present in branding_assets slot, ensure loginHeroUrl reflects it
  if (!tenant.loginHeroUrl && tenant.branding_assets?.hero?.url) {
    tenant.loginHeroUrl = tenant.branding_assets.hero.url;
  }

  const isDemo = tenantId === 'company_demo';
  const isAllied = tenantId === 'company_pixel_syntax' || (!isDemo && tenantId.includes('allied'));
  const effectiveHero = tenant.loginHeroUrl || (isAllied ? '/pixel-syntax-logo.png' : null);
  const effectiveLogo = sanitizeCustomLogo(tenant.logoUrl) || (isAllied ? '/pixel-syntax-logo.png' : null);
  const effectiveHeaderLogo = sanitizeCustomLogo(tenant.headerLogoUrl) || effectiveLogo || (isAllied ? '/pixel-syntax-logo.png' : null);

  const result = {
    tenantId: tenant.id,
    companyName: tenant.name || (isDemo ? 'Pixel Syntax Delivery Software Demo' : 'Pixel Syntax'),
    portalTitle: tenant.portalTitle || (isDemo ? 'Pixel Syntax Demo Workspace' : 'Pixel Syntax'),
    logoUrl: effectiveLogo,
    loginHeroUrl: effectiveHero,
    loginBgUrl: tenant.loginBgUrl || null,
    sidebarLogoUrl: sanitizeCustomLogo(tenant.sidebarLogoUrl) || effectiveHeaderLogo || null,
    headerLogoUrl: effectiveHeaderLogo,
    faviconUrl: tenant.faviconUrl || (isAllied ? '/favicon.png' : null),
    loginTagline: tenant.loginTagline || (isDemo
      ? 'Interactive Training Environment — Safe Simulated Operations'
      : 'Fleet & Logistics Management Portal'),
    supportEmail: tenant.supportEmail || (isDemo ? 'training@alliedfleet.com' : 'support@alliedfleet.com'),
    supportPhone: tenant.supportPhone || '+971 4 000 0000',
    domain: tenant.domain || (isDemo ? 'deliverysoftwarepixel.site' : 'deliverysoftwarepixel.site'),
    primaryColor: tenant.primaryColor || (isDemo ? '#8b5cf6' : '#059669'),
    secondaryColor: tenant.secondaryColor || '#2563eb',
    turnstileEnabled: Boolean(tenant.turnstileEnabled),
    turnstileSiteKey: tenant.turnstileSiteKey || null,
    status: tenant.status || 'ACTIVE',
    customHero: Boolean(effectiveHero),
    branding_assets: tenant.branding_assets || {},
    updated_at: tenant.updated_at || new Date().toISOString(),
  };

  // Cache immediately
  authoritativeBrandingCache.set(tenantId, { data: result, cachedAt: Date.now() });

  // 4. Background revalidation against Supabase (non-blocking so /login stays <10ms)
  const supabase = getSupabaseClient();
  if (supabase) {
    if (forceRevalidate) {
      // If caller explicitly forced revalidation, cap wait time to 300ms so it never hangs
      try {
        await Promise.race([
          loadTenantBrandingFromSupabase(db, tenantId),
          new Promise((resolve) => setTimeout(resolve, 300)),
        ]);
        const refreshed = (db.tenants || []).find((t: any) => t.id === tenantId);
        if (refreshed) {
          result.loginHeroUrl = refreshed.loginHeroUrl || result.loginHeroUrl;
          result.logoUrl = sanitizeCustomLogo(refreshed.logoUrl) || result.logoUrl;
          result.companyName = refreshed.name || result.companyName;
          result.portalTitle = refreshed.portalTitle || result.portalTitle;
          result.loginTagline = refreshed.loginTagline || result.loginTagline;
          authoritativeBrandingCache.set(tenantId, { data: result, cachedAt: Date.now() });
        }
      } catch (err) {
        console.warn(`[TenantBranding] Quick sync note for ${tenantId}:`, err);
      }
    } else {
      // Asynchronous background revalidation
      loadTenantBrandingFromSupabase(db, tenantId)
        .then(() => {
          const refreshed = (db.tenants || []).find((t: any) => t.id === tenantId);
          if (refreshed) {
            if (!refreshed.loginHeroUrl && refreshed.branding_assets?.hero?.url) {
              refreshed.loginHeroUrl = refreshed.branding_assets.hero.url;
            }
            const updated = {
              ...result,
              companyName: refreshed.name || result.companyName,
              portalTitle: refreshed.portalTitle || result.portalTitle,
              logoUrl: sanitizeCustomLogo(refreshed.logoUrl) || result.logoUrl,
              loginHeroUrl: refreshed.loginHeroUrl || result.loginHeroUrl,
              loginBgUrl: refreshed.loginBgUrl || result.loginBgUrl,
              sidebarLogoUrl: sanitizeCustomLogo(refreshed.sidebarLogoUrl) || sanitizeCustomLogo(refreshed.logoUrl) || result.sidebarLogoUrl,
              headerLogoUrl: sanitizeCustomLogo(refreshed.headerLogoUrl) || sanitizeCustomLogo(refreshed.logoUrl) || result.headerLogoUrl,
              faviconUrl: refreshed.faviconUrl || result.faviconUrl,
              loginTagline: refreshed.loginTagline || result.loginTagline,
              primaryColor: refreshed.primaryColor || result.primaryColor,
              secondaryColor: refreshed.secondaryColor || result.secondaryColor,
              turnstileEnabled: Boolean(refreshed.turnstileEnabled),
              turnstileSiteKey: refreshed.turnstileSiteKey || result.turnstileSiteKey,
              status: refreshed.status || result.status,
              customHero: Boolean(refreshed.loginHeroUrl),
              branding_assets: refreshed.branding_assets || result.branding_assets,
              updated_at: refreshed.updated_at || result.updated_at,
            };
            authoritativeBrandingCache.set(tenantId, { data: updated, cachedAt: Date.now() });
          }
        })
        .catch((err) => {
          console.warn(`[Background Revalidation] Supabase sync for ${tenantId}:`, err);
        });
    }
  }

  return result;
}
