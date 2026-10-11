import crypto from 'crypto';
import { Request } from 'express';
import { getSupabaseClient } from './supabaseDb';
import { getClientIp } from './sessionService';

export interface PlatformAdminSession {
  id: string;
  tokenHash: string;
  adminIdentity: string;
  adminName: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastSeenAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory mirror cache for sub-millisecond local resilience
const activePlatformAdminSessionsCache = new Map<string, PlatformAdminSession>();

/**
 * Computes a secure SHA-256 hash of the session token.
 * Plaintext tokens are returned to the client and never stored in the database.
 */
export function hashPlatformAdminToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

/**
 * Extracts the platform admin bearer token from HTTP request headers.
 * Looks for 'x-platform-admin-token' or 'Authorization: Bearer <token>'.
 */
export function extractPlatformAdminToken(req: Request): string {
  const customHeader = req.headers['x-platform-admin-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return '';
}

/**
 * Creates an authoritative Platform Admin session in Supabase platform_admin_sessions.
 * Stores only the SHA-256 hash of the token along with admin identity, role, and timestamps.
 */
export async function createPlatformAdminSession(
  admin: { username: string; fullName?: string; role?: string },
  req?: Request,
  supabaseClient?: any
): Promise<{ token: string; session: PlatformAdminSession }> {
  // Generate random 256-bit token
  const token = `plf_adm_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = hashPlatformAdminToken(token);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours TTL
  const ipAddress = getClientIp(req);
  const userAgent = (req?.headers['user-agent'] as string) || undefined;
  const sessionId = `pas_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const session: PlatformAdminSession = {
    id: sessionId,
    tokenHash,
    adminIdentity: admin.username,
    adminName: admin.fullName || admin.username,
    role: admin.role || 'PLATFORM_ADMIN',
    createdAt: now.toISOString(),
    expiresAt,
    revokedAt: null,
    lastSeenAt: now.toISOString(),
    ipAddress,
    userAgent,
  };

  // Cache in-memory mirror
  activePlatformAdminSessionsCache.set(tokenHash, session);

  // Authoritative persistence in Supabase
  const sb = supabaseClient || getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb.from('platform_admin_sessions').insert({
        id: session.id,
        token_hash: tokenHash,
        admin_identity: session.adminIdentity,
        admin_name: session.adminName,
        role: session.role,
        created_at: session.createdAt,
        expires_at: session.expiresAt,
        revoked_at: null,
        last_seen_at: session.lastSeenAt,
        ip_address: ipAddress || null,
        user_agent: userAgent || null,
      });

      if (error) {
        console.warn('ℹ️ Notice persisting platform_admin_session to Supabase:', error.message);
      }
    } catch (err: any) {
      console.warn('⚠️ Supabase network error saving platform admin session:', err.message);
    }
  }

  return { token, session };
}

/**
 * Validates a Platform Admin session token server-side.
 * Authoritatively verifies against Supabase platform_admin_sessions:
 *  - Token hash must match
 *  - Session must NOT be revoked (revoked_at is null)
 *  - Session must NOT be expired (expires_at > NOW)
 * Automatically touches last_seen_at on success.
 */
export async function validatePlatformAdminSession(
  token?: string | null,
  req?: Request,
  supabaseClient?: any
): Promise<PlatformAdminSession | null> {
  if (!token || typeof token !== 'string') return null;
  const cleanToken = token.trim();
  if (!cleanToken) return null;

  const tokenHash = hashPlatformAdminToken(cleanToken);
  const nowIso = new Date().toISOString();
  const sb = supabaseClient || getSupabaseClient();

  if (sb) {
    try {
      const { data, error } = await sb
        .from('platform_admin_sessions')
        .select('*')
        .eq('token_hash', tokenHash)
        .is('revoked_at', null)
        .gt('expires_at', nowIso)
        .maybeSingle();

      if (!error && data) {
        const validated: PlatformAdminSession = {
          id: data.id,
          tokenHash: data.token_hash,
          adminIdentity: data.admin_identity,
          adminName: data.admin_name || data.admin_identity,
          role: data.role || 'PLATFORM_ADMIN',
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          revokedAt: data.revoked_at,
          lastSeenAt: nowIso,
          ipAddress: data.ip_address,
          userAgent: data.user_agent,
        };

        // Mirror cache update
        activePlatformAdminSessionsCache.set(tokenHash, validated);

        // Update last_seen_at asynchronously
        sb.from('platform_admin_sessions')
          .update({ last_seen_at: nowIso })
          .eq('token_hash', tokenHash)
          .then(() => {})
          .catch(() => {});

        return validated;
      }
    } catch (err: any) {
      console.warn('⚠️ Error querying Supabase platform_admin_sessions:', err.message);
    }
  }

  // Fallback cache check (for local development or transient Supabase downtime)
  const cached = activePlatformAdminSessionsCache.get(tokenHash);
  if (cached) {
    if (cached.revokedAt) {
      activePlatformAdminSessionsCache.delete(tokenHash);
      return null;
    }
    if (new Date(cached.expiresAt).getTime() <= Date.now()) {
      activePlatformAdminSessionsCache.delete(tokenHash);
      return null;
    }

    cached.lastSeenAt = nowIso;
    return cached;
  }

  return null;
}

/**
 * Revokes an active Platform Admin session immediately in Supabase and cache.
 * Sets revoked_at to current timestamp so subsequent requests are rejected.
 */
export async function revokePlatformAdminSession(
  token?: string | null,
  supabaseClient?: any
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false;
  const cleanToken = token.trim();
  if (!cleanToken) return false;

  const tokenHash = hashPlatformAdminToken(cleanToken);
  const nowIso = new Date().toISOString();

  // Clear in-memory cache
  activePlatformAdminSessionsCache.delete(tokenHash);

  const sb = supabaseClient || getSupabaseClient();
  if (sb) {
    try {
      const { error } = await sb
        .from('platform_admin_sessions')
        .update({ revoked_at: nowIso })
        .eq('token_hash', tokenHash);

      if (error) {
        console.warn('ℹ️ Notice revoking platform_admin_session in Supabase:', error.message);
      }
      return !error;
    } catch (err: any) {
      console.warn('⚠️ Supabase error revoking platform admin session:', err.message);
    }
  }

  return true;
}
