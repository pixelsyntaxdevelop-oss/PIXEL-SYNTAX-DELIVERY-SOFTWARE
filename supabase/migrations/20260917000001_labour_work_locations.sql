-- ==============================================================================
-- Migration: Labour Buildings / Work Locations Master for company_pixel_syntax
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.labour_buildings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'company_pixel_syntax',
    name VARCHAR(255) NOT NULL,
    area_location VARCHAR(255),
    emirate VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'INACTIVE'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_labour_buildings_tenant ON public.labour_buildings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_labour_buildings_name ON public.labour_buildings(name);
CREATE INDEX IF NOT EXISTS idx_labour_buildings_status ON public.labour_buildings(status);

-- Enable RLS
ALTER TABLE public.labour_buildings ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for company_pixel_syntax
DROP POLICY IF EXISTS "Tenant isolation for labour_buildings" ON public.labour_buildings;
CREATE POLICY "Tenant isolation for labour_buildings" ON public.labour_buildings
    FOR ALL
    USING (tenant_id = 'company_pixel_syntax' OR tenant_id IS NULL)
    WITH CHECK (tenant_id = 'company_pixel_syntax' OR tenant_id IS NULL);
