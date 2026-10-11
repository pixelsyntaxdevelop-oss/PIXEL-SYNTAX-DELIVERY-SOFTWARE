-- ==============================================================================
-- Migration: 20260907000001_sequential_employee_code.sql
-- Description: Deterministic, tenant-scoped sequential employee code generator
-- Format: EMP-00001, EMP-00002, ... (atomic, never reuses old codes, DB-level)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS tenant_employee_sequences (
    tenant_id VARCHAR(100) NOT NULL PRIMARY KEY,
    last_code_number BIGINT NOT NULL DEFAULT 0,
    prefix VARCHAR(20) NOT NULL DEFAULT 'EMP-',
    pad_length INT NOT NULL DEFAULT 5,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE tenant_employee_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_employee_sequences_isolation ON tenant_employee_sequences
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant', true));

-- Function: Atomic next sequential employee code generation
CREATE OR REPLACE FUNCTION rpc_get_next_employee_code(
    p_tenant_id VARCHAR,
    p_commit BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_seq RECORD;
    v_next_val BIGINT;
    v_code VARCHAR(50);
    v_prefix VARCHAR(20);
    v_pad INT;
    v_max_existing BIGINT := 0;
BEGIN
    IF p_tenant_id IS NULL OR TRIM(p_tenant_id) = '' THEN
        RAISE EXCEPTION 'p_tenant_id is required';
    END IF;

    -- Ensure initial record exists
    INSERT INTO tenant_employee_sequences (tenant_id, last_code_number, prefix, pad_length, updated_at)
    VALUES (
        p_tenant_id, 
        0, 
        CASE WHEN p_tenant_id = 'company_pixel_syntax' THEN 'ADL' ELSE 'EMP-' END, 
        CASE WHEN p_tenant_id = 'company_pixel_syntax' THEN 4 ELSE 5 END, 
        NOW()
    )
    ON CONFLICT (tenant_id) DO NOTHING;

    -- Lock and retrieve current sequence value
    SELECT * INTO v_seq
    FROM tenant_employee_sequences
    WHERE tenant_id = p_tenant_id
    FOR UPDATE;

    -- Synchronize with existing maximum numeric code if table has higher values
    SELECT COALESCE(MAX(
        CASE 
            WHEN p_tenant_id = 'company_pixel_syntax' AND employee_code ~ '^ADL[0-9]+$' THEN SUBSTRING(employee_code FROM 4)::BIGINT
            WHEN employee_code ~ '^EMP-[0-9]+$' THEN SUBSTRING(employee_code FROM 5)::BIGINT
            ELSE 0
        END
    ), 0) INTO v_max_existing
    FROM employees
    WHERE tenant_id = p_tenant_id;

    IF v_max_existing > v_seq.last_code_number THEN
        v_next_val := v_max_existing + 1;
    ELSE
        v_next_val := v_seq.last_code_number + 1;
    END IF;

    v_prefix := COALESCE(v_seq.prefix, CASE WHEN p_tenant_id = 'company_pixel_syntax' THEN 'ADL' ELSE 'EMP-' END);
    v_pad := COALESCE(v_seq.pad_length, CASE WHEN p_tenant_id = 'company_pixel_syntax' THEN 4 ELSE 5 END);

    -- Increment and persist if committing
    IF p_commit THEN
        UPDATE tenant_employee_sequences
        SET last_code_number = v_next_val,
            prefix = v_prefix,
            pad_length = v_pad,
            updated_at = NOW()
        WHERE tenant_id = p_tenant_id;
    END IF;

    v_code := v_prefix || LPAD(v_next_val::TEXT, v_pad, '0');

    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', p_tenant_id,
        'next_code', v_code,
        'code_number', v_next_val,
        'committed', p_commit
    );
END;
$$;

-- Function: Preview next code without incrementing
CREATE OR REPLACE FUNCTION rpc_preview_next_employee_code(p_tenant_id VARCHAR)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN rpc_get_next_employee_code(p_tenant_id, FALSE);
END;
$$;

-- Seed initial sequences for known tenants
INSERT INTO tenant_employee_sequences (tenant_id, last_code_number, prefix, pad_length, updated_at)
VALUES 
    ('company_demo', 3, 'EMP-', 5, NOW()),
    ('company_pixel_syntax', 1010, 'EMP-', 5, NOW())
ON CONFLICT (tenant_id) DO NOTHING;
