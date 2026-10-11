-- ==============================================================================
-- Migration: Labour Employee ↔ Building Assignments for company_pixel_syntax
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.labour_building_assignments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'company_pixel_syntax',
    employee_id VARCHAR(64) NOT NULL,
    building_id VARCHAR(64) NOT NULL,
    building_name VARCHAR(255) NOT NULL,
    area_location VARCHAR(255),
    emirate VARCHAR(100),
    assignment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'TRANSFERRED' | 'ENDED'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_lba_tenant ON public.labour_building_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lba_employee ON public.labour_building_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_lba_building ON public.labour_building_assignments(building_id);
CREATE INDEX IF NOT EXISTS idx_lba_status ON public.labour_building_assignments(status);

-- Partial index to strictly enforce one active building per employee in database
CREATE UNIQUE INDEX IF NOT EXISTS idx_lba_one_active_per_emp 
    ON public.labour_building_assignments (employee_id, tenant_id) 
    WHERE status = 'ACTIVE';

-- Enable RLS
ALTER TABLE public.labour_building_assignments ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy for company_pixel_syntax
DROP POLICY IF EXISTS "Tenant isolation for labour_building_assignments" ON public.labour_building_assignments;
CREATE POLICY "Tenant isolation for labour_building_assignments" ON public.labour_building_assignments
    FOR ALL
    USING (tenant_id = 'company_pixel_syntax' OR tenant_id IS NULL)
    WITH CHECK (tenant_id = 'company_pixel_syntax' OR tenant_id IS NULL);
