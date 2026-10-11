import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Request } from 'express';
import { getSupabaseClient } from './supabaseDb';

const PERSISTENT_SESSIONS_FILE = path.join(process.cwd(), 'data', 'persistent_user_sessions.json');
const PERSISTENT_REVOKED_FILE = path.join(process.cwd(), 'data', 'persistent_revoked_tokens.json');

const SESSION_SECRET = process.env.SESSION_SECRET || 'allied_delivery_authoritative_session_secret_2026_super_secure';

export interface AuthSession {
  token: string;
  userId: string;
  tenantId: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt?: string;
  lastSeenAt?: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

// In-memory cache for ultra-fast session lookup
const activeSessions = new Map<string, AuthSession>();

// Revoked tokens set
const revokedTokens = new Set<string>();

// Password reset tokens registry: token -> { userId, tenantId, expiresAt }
const activeResetTokens = new Map<string, { userId: string; tenantId: string; expiresAt: string }>();

function loadPersistentSessionStorage(): void {
  try {
    if (fs.existsSync(PERSISTENT_REVOKED_FILE)) {
      const rawRevoked = fs.readFileSync(PERSISTENT_REVOKED_FILE, 'utf-8');
      const arr = JSON.parse(rawRevoked);
      if (Array.isArray(arr)) {
        arr.forEach((t) => revokedTokens.add(t));
      }
    }
  } catch {}

  try {
    if (fs.existsSync(PERSISTENT_SESSIONS_FILE)) {
      const rawSessions = fs.readFileSync(PERSISTENT_SESSIONS_FILE, 'utf-8');
      const parsed = JSON.parse(rawSessions);
      if (parsed && typeof parsed === 'object') {
        for (const [token, sess] of Object.entries<any>(parsed)) {
          if (!revokedTokens.has(token) && sess) {
            const check = validateSessionPolicy(sess);
            if (check.valid) {
              activeSessions.set(token, sess);
            }
          }
        }
      }
    }
  } catch {}
}

// Initialize persistent session storage
loadPersistentSessionStorage();

function savePersistentSessionStorage(): void {
  try {
    const dir = path.dirname(PERSISTENT_SESSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const obj: Record<string, AuthSession> = {};
    for (const [token, sess] of activeSessions.entries()) {
      obj[token] = sess;
    }
    fs.writeFileSync(PERSISTENT_SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {}
}

function savePersistentRevokedStorage(): void {
  try {
    const dir = path.dirname(PERSISTENT_REVOKED_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERSISTENT_REVOKED_FILE, JSON.stringify(Array.from(revokedTokens)), 'utf-8');
  } catch {}
}

export function createSignedToken(payload: {
  u: string;
  t: string;
  r: string;
  c: string;
  e: string;
  rm: number;
  n: string;
}): string {
  const jsonStr = JSON.stringify(payload);
  const b64 = Buffer.from(jsonStr).toString('base64url');
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('hex');
  return `apex_sess_${b64}.${hmac}`;
}

export function verifySignedToken(token: string): any | null {
  if (!token || !token.startsWith('apex_sess_')) return null;
  const parts = token.substring('apex_sess_'.length).split('.');
  if (parts.length !== 2) return null;
  const [b64, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64).digest('hex');
  if (signature.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;
  try {
    const raw = Buffer.from(b64, 'base64url').toString('utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Checks if a session creation timestamp belongs to a previous calendar day.
 * Sessions must not cross into the next day even if the browser remained closed.
 */
function isNextCalendarDay(createdIso?: string, now: Date = new Date()): boolean {
  if (!createdIso) return false;
  const createdDate = new Date(createdIso);
  return (
    createdDate.getUTCFullYear() !== now.getUTCFullYear() ||
    createdDate.getUTCMonth() !== now.getUTCMonth() ||
    createdDate.getUTCDate() !== now.getUTCDate() ||
    createdDate.toDateString() !== now.toDateString()
  );
}

/**
 * Validates a session against security policies:
 * - Revocation check
 * - Absolute expiry (end of current day)
 * - Next-day calendar boundary
 * - 5-hour inactivity timeout based on last_seen_at / last_activity_at
 */
export function validateSessionPolicy(session: {
  createdAt?: string;
  expiresAt?: string;
  lastActivityAt?: string;
  lastSeenAt?: string;
  revokedAt?: string;
  created_at?: string;
  expires_at?: string;
  last_activity_at?: string;
  last_seen_at?: string;
  revoked_at?: string;
}): { valid: boolean; reason?: string } {
  const now = Date.now();
  const INACTIVITY_TIMEOUT_MS = 5 * 60 * 60 * 1000; // 5 hours

  const revoked = session.revokedAt || (session as any).revoked_at;
  if (revoked) return { valid: false, reason: 'revoked' };

  // 1. Absolute expiry check
  const expiresAt = session.expiresAt || (session as any).expires_at;
  if (expiresAt && new Date(expiresAt).getTime() <= now) {
    return { valid: false, reason: 'absolute_expiry' };
  }

  // 2. Next-day calendar boundary check
  const createdAt = session.createdAt || (session as any).created_at;
  if (createdAt && isNextCalendarDay(createdAt)) {
    return { valid: false, reason: 'next_day_expired' };
  }

  // 3. 5-hour inactivity timeout check
  const lastSeen =
    session.lastSeenAt ||
    (session as any).last_seen_at ||
    session.lastActivityAt ||
    (session as any).last_activity_at ||
    createdAt;
  if (lastSeen) {
    const lastSeenTime = new Date(lastSeen).getTime();
    if (lastSeenTime > 0 && (now - lastSeenTime) > INACTIVITY_TIMEOUT_MS) {
      return { valid: false, reason: 'inactivity_timeout' };
    }
  }

  return { valid: true };
}

export function hashPassword(plain: string, salt: string): string {
  return crypto.pbkdf2Sync(plain, salt, 100000, 64, 'sha512').toString('hex');
}

export function verifyPassword(plain: string, hash?: string, salt?: string): boolean {
  if (!hash || !salt || !plain) return false;
  try {
    // 1. Authoritative legacy ERP PBKDF2-SHA512 verification with 1,000 iterations
    const computed1k = crypto.pbkdf2Sync(plain, salt, 1000, 64, 'sha512').toString('hex');
    if (
      computed1k.length === hash.length &&
      crypto.timingSafeEqual(Buffer.from(computed1k, 'hex'), Buffer.from(hash, 'hex'))
    ) {
      return true;
    }

    // 2. Secondary fallback: 100,000 iterations (for newer or upgraded credentials)
    const computed100k = crypto.pbkdf2Sync(plain, salt, 100000, 64, 'sha512').toString('hex');
    if (
      computed100k.length === hash.length &&
      crypto.timingSafeEqual(Buffer.from(computed100k, 'hex'), Buffer.from(hash, 'hex'))
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Cloudflare-safe real client IP extraction.
 * Inspects CF-Connecting-IP, True-Client-IP, X-Forwarded-For, X-Real-IP, falling back to req.ip.
 */
export function getClientIp(req?: Request): string {
  if (!req || !req.headers) return '127.0.0.1';
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();

  const trueClientIp = req.headers['true-client-ip'];
  if (typeof trueClientIp === 'string' && trueClientIp.trim()) return trueClientIp.trim();

  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();

  return req.ip || '127.0.0.1';
}

/**
 * Creates a cryptographically secure session token, saves to local disk and Supabase user_sessions (if available),
 * and caches in activeSessions memory.
 */
export function createSession(
  user: { id: string; tenantId?: string; tenant_id?: string; role?: string },
  rememberMe: boolean = false,
  req?: Request,
  supabaseClient?: any
): AuthSession {
  const now = new Date();

  // Absolute expiry: session expires at the end of the current day (23:59:59.999),
  // guaranteeing sessions do not remain valid into the next day.
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const expiresAt = endOfDay.toISOString();
  const nowIso = now.toISOString();

  const ipAddress = getClientIp(req);
  const userAgent = (req?.headers?.['user-agent'] as string) || undefined;

  const tenantId = user.tenantId || user.tenant_id || 'company_pixel_syntax';
  const role = user.role || 'VIEWER';

  // Issue tamper-proof signed token that can survive server recycles and be authoritatively validated
  const token = createSignedToken({
    u: user.id,
    t: tenantId,
    r: role,
    c: nowIso,
    e: expiresAt,
    rm: rememberMe ? 1 : 0,
    n: crypto.randomBytes(12).toString('hex'),
  });

  const session: AuthSession = {
    token,
    userId: user.id,
    tenantId,
    role,
    createdAt: nowIso,
    expiresAt,
    lastActivityAt: nowIso,
    lastSeenAt: nowIso,
    rememberMe,
    ipAddress,
    userAgent,
  };

  activeSessions.set(token, session);
  savePersistentSessionStorage();

  // Authoritative Supabase session persistence
  const sb = supabaseClient || getSupabaseClient();
  if (sb) {
    try {
      sb.from('user_sessions')
        .upsert({
          id: `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          token,
          user_id: session.userId,
          tenant_id: session.tenantId,
          role: session.role,
          created_at: session.createdAt,
          expires_at: session.expiresAt,
          remember_me: Boolean(rememberMe),
          ip_address: ipAddress,
          user_agent: userAgent || null,
          last_activity_at: nowIso,
        })
        .then(({ error }: any) => {
          if (error) {
            console.warn('ℹ️ Notice persisting session to Supabase user_sessions:', error.message);
          }
        })
        .catch(() => {});
    } catch {}
  }

  return session;
}

/**
 * Synchronous session lookup (memory cache & signed token).
 */
export function getSession(token?: string | null): AuthSession | null {
  if (!token) return null;
  if (revokedTokens.has(token)) {
    activeSessions.delete(token);
    return null;
  }

  const session = activeSessions.get(token);
  if (session) {
    const policyCheck = validateSessionPolicy(session);
    if (!policyCheck.valid) {
      activeSessions.delete(token);
      revokedTokens.add(token);
      savePersistentSessionStorage();
      savePersistentRevokedStorage();
      return null;
    }

    const nowIso = new Date().toISOString();
    session.lastActivityAt = nowIso;
    session.lastSeenAt = nowIso;
    savePersistentSessionStorage();
    return session;
  }

  // Check signed token
  const payload = verifySignedToken(token);
  if (payload) {
    const policyCheck = validateSessionPolicy({
      createdAt: payload.c,
      expiresAt: payload.e,
      lastActivityAt: payload.c,
      lastSeenAt: payload.c,
    });
    if (!policyCheck.valid) {
      revokedTokens.add(token);
      savePersistentRevokedStorage();
      return null;
    }

    const nowIso = new Date().toISOString();
    const restored: AuthSession = {
      token,
      userId: payload.u,
      tenantId: payload.t,
      role: payload.r,
      createdAt: payload.c,
      expiresAt: payload.e,
      lastActivityAt: nowIso,
      lastSeenAt: nowIso,
      rememberMe: Boolean(payload.rm),
    };
    activeSessions.set(token, restored);
    savePersistentSessionStorage();
    return restored;
  }

  return null;
}

/**
 * Asynchronous authoritative session retrieval.
 * Checks memory cache, signed token, local disk persistence, and Supabase user_sessions table.
 */
export async function getSessionAsync(token?: string | null, supabaseClient?: any): Promise<AuthSession | null> {
  if (!token) return null;

  if (revokedTokens.has(token)) {
    activeSessions.delete(token);
    return null;
  }

  const sb = supabaseClient || getSupabaseClient();

  // 1. Check memory cache first
  const memSession = activeSessions.get(token);
  if (memSession) {
    const policyCheck = validateSessionPolicy(memSession);
    if (!policyCheck.valid) {
      activeSessions.delete(token);
      revokedTokens.add(token);
      savePersistentSessionStorage();
      savePersistentRevokedStorage();
      if (sb) {
        try {
          await sb.from('user_sessions').delete().eq('token', token);
        } catch {}
      }
      return null;
    }

    const nowIso = new Date().toISOString();
    memSession.lastActivityAt = nowIso;
    memSession.lastSeenAt = nowIso;
    savePersistentSessionStorage();

    if (sb) {
      sb.from('user_sessions')
        .update({ last_activity_at: nowIso, last_seen_at: nowIso })
        .eq('token', token)
        .then(
          ({ error }: any) => {
            if (error && error.message?.includes('last_seen_at')) {
              sb.from('user_sessions')
                .update({ last_activity_at: nowIso })
                .eq('token', token)
                .then(() => {}, () => {});
            }
          },
          () => {}
        );
    }
    return memSession;
  }

  // 2. Check signed token structure (survives process/container restarts & independent of Supabase)
  const payload = verifySignedToken(token);
  if (payload) {
    const policyCheck = validateSessionPolicy({
      createdAt: payload.c,
      expiresAt: payload.e,
      lastActivityAt: payload.c,
      lastSeenAt: payload.c,
    });

    if (!policyCheck.valid) {
      revokedTokens.add(token);
      savePersistentRevokedStorage();
      return null;
    }

    const nowIso = new Date().toISOString();
    const restoredSession: AuthSession = {
      token,
      userId: payload.u,
      tenantId: payload.t,
      role: payload.r,
      createdAt: payload.c,
      expiresAt: payload.e,
      lastActivityAt: nowIso,
      lastSeenAt: nowIso,
      rememberMe: Boolean(payload.rm),
    };

    activeSessions.set(token, restoredSession);
    savePersistentSessionStorage();

    if (sb) {
      sb.from('user_sessions')
        .upsert({
          id: `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          token,
          user_id: restoredSession.userId,
          tenant_id: restoredSession.tenantId,
          role: restoredSession.role,
          created_at: restoredSession.createdAt,
          expires_at: restoredSession.expiresAt,
          remember_me: restoredSession.rememberMe,
          last_activity_at: nowIso,
        })
        .catch(() => {});
    }

    return restoredSession;
  }

  // 3. Check Supabase authoritative store
  if (sb) {
    try {
      const { data, error } = await sb
        .from('user_sessions')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (!error && data) {
        const policyCheck = validateSessionPolicy({
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          lastActivityAt: data.last_activity_at,
          lastSeenAt: data.last_seen_at || data.last_activity_at,
          revokedAt: data.revoked_at,
        });

        if (!policyCheck.valid) {
          try {
            await sb.from('user_sessions').delete().eq('token', token);
          } catch {}
          activeSessions.delete(token);
          revokedTokens.add(token);
          savePersistentRevokedStorage();
          return null;
        }

        const nowIso = new Date().toISOString();
        const loadedSession: AuthSession = {
          token: data.token,
          userId: data.user_id,
          tenantId: data.tenant_id,
          role: data.role,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
          lastActivityAt: nowIso,
          lastSeenAt: nowIso,
          rememberMe: Boolean(data.remember_me),
          ipAddress: data.ip_address,
          userAgent: data.user_agent,
        };
        activeSessions.set(token, loadedSession);
        savePersistentSessionStorage();

        // Non-blocking update of last_activity_at and last_seen_at
        sb.from('user_sessions')
          .update({ last_activity_at: nowIso, last_seen_at: nowIso })
          .eq('token', token)
          .then(
            ({ error: updateErr }: any) => {
              if (updateErr && updateErr.message?.includes('last_seen_at')) {
                sb.from('user_sessions')
                  .update({ last_activity_at: nowIso })
                  .eq('token', token)
                  .then(() => {}, () => {});
              }
            },
            () => {}
          );

        return loadedSession;
      }
    } catch {}
  }

  return null;
}

/**
 * Destroys an active session (Logout).
 */
export function destroySession(token?: string | null, supabaseClient?: any): boolean {
  if (!token) return false;
  activeSessions.delete(token);
  revokedTokens.add(token);
  savePersistentSessionStorage();
  savePersistentRevokedStorage();

  const sb = supabaseClient || getSupabaseClient();
  if (sb) {
    try {
      sb.from('user_sessions')
        .delete()
        .eq('token', token)
        .catch(() => {});
    } catch {}
  }
  return true;
}

/**
 * Destroys all active sessions for a specific user ID (e.g. on deactivation or password reset).
 */
export function destroyAllUserSessions(userId: string, supabaseClient?: any): number {
  let count = 0;
  for (const [token, session] of activeSessions.entries()) {
    if (session.userId === userId) {
      activeSessions.delete(token);
      revokedTokens.add(token);
      count++;
    }
  }
  savePersistentSessionStorage();
  savePersistentRevokedStorage();

  const sb = supabaseClient || getSupabaseClient();
  if (sb) {
    try {
      sb.from('user_sessions')
        .delete()
        .eq('user_id', userId)
        .catch(() => {});
    } catch {}
  }

  return count;
}

/**
 * Extracts session token from Express request headers, cookies, and Cloudflare context.
 */
export function extractTokenFromRequest(req: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const raw = authHeader.substring(7).trim();
    if (raw && !raw.startsWith('mock-token-null')) {
      return raw;
    }
  }

  // 2. Cookie: apex_session_token=<token> (Secure, HttpOnly, SameSite)
  const cookies = req.headers.cookie;
  if (cookies) {
    const match = cookies
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('apex_session_token='));
    if (match) {
      const val = match.substring('apex_session_token='.length).trim();
      if (val) return val;
    }
  }

  // 3. Custom session token headers (Cloudflare proxy-friendly)
  const sessionTokenHeader = req.headers['x-session-token'] as string;
  if (sessionTokenHeader && sessionTokenHeader.trim()) {
    return sessionTokenHeader.trim();
  }

  const cfAuthHeader = req.headers['cf-access-token'] || req.headers['cf-authorization'];
  if (typeof cfAuthHeader === 'string' && cfAuthHeader.trim()) {
    return cfAuthHeader.trim();
  }

  // 4. Query parameter fallback for secure preview/direct iframe contexts
  if ((req as any).query?.session_token && typeof (req as any).query.session_token === 'string') {
    return (req as any).query.session_token.trim();
  }

  return null;
}

/**
 * Generates an expiring password reset token (1 hour TTL).
 */
export function createPasswordResetToken(userId: string, tenantId: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  activeResetTokens.set(token, { userId, tenantId, expiresAt });
  return token;
}

/**
 * Verifies and consumes a password reset token.
 */
export function consumePasswordResetToken(token: string): { userId: string; tenantId: string } | null {
  const record = activeResetTokens.get(token);
  if (!record) return null;

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    activeResetTokens.delete(token);
    return null;
  }

  activeResetTokens.delete(token);
  return { userId: record.userId, tenantId: record.tenantId };
}
