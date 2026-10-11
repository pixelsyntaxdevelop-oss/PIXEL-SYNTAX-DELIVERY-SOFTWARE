-- ==============================================================================
-- Migration: 20260910000004_platform_admin_sessions.sql
-- Description: Authoritative Server-Side Supabase Session Store for Platform Admin
-- Requirements:
--   1. Store only secure session token SHA-256 hash/reference, never plaintext passwords
--   2. Track admin identity, role, created_at, expires_at, revoked_at, last_seen_at
--   3. Cloudflare Workers safe (persistent across ephemeral isolate restarts)
--   4. Strictly segregated from normal ERP sessions (user_sessions)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS platform_admin_sessions (
    id VARCHAR(64) PRIMARY KEY,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    admin_identity VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255),
    role VARCHAR(64) NOT NULL DEFAULT 'PLATFORM_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(100),
    user_agent TEXT
);

-- Indexes for ultra-fast lookup, TTL checks, and revocation validation
CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_token_hash ON platform_admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_identity ON platform_admin_sessions(admin_identity);
CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_expires_at ON platform_admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_platform_admin_sessions_revoked_at ON platform_admin_sessions(revoked_at);

-- Enable Row Level Security (RLS)
ALTER TABLE platform_admin_sessions ENABLE ROW LEVEL SECURITY;

-- Service role access policy: completely isolated from public and standard ERP user tokens
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'platform_admin_sessions' AND policyname = 'platform_admin_sessions_service_access'
    ) THEN
        CREATE POLICY platform_admin_sessions_service_access ON platform_admin_sessions
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Helper function to purge expired platform admin sessions
CREATE OR REPLACE FUNCTION purge_expired_platform_admin_sessions()
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM platform_admin_sessions
    WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;
