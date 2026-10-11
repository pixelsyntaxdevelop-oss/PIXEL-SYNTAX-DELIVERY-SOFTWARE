-- Migration: Remove vehicle plate unique constraint & enforce unique chassis_number
-- Business rule for Allied fleet:
--   - Plate Number is NOT globally unique. Two bikes/vehicles may have the same Plate Number.
--   - Chassis Number MUST be unique for company_pixel_syntax (and per tenant).
--   - Duplicate blocking must be based primarily on Chassis Number only.
--   - Production vehicle records, assignments, and histories are strictly preserved.

DO $$
BEGIN
    -- 1. Drop unique constraint on plate if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_vehicles_tenant_plate'
    ) THEN
        ALTER TABLE vehicles DROP CONSTRAINT uq_vehicles_tenant_plate;
    END IF;

    -- 2. Drop any separate unique index on plate if present
    DROP INDEX IF EXISTS idx_vehicles_tenant_plate;
    DROP INDEX IF EXISTS uq_vehicles_tenant_plate;

    -- 3. Ensure Chassis Number is unique for company_pixel_syntax (and across tenants)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'uq_vehicles_tenant_chassis'
    ) THEN
        CREATE UNIQUE INDEX uq_vehicles_tenant_chassis 
        ON vehicles (tenant_id, chassis_number) 
        WHERE chassis_number IS NOT NULL AND chassis_number <> '';
    END IF;
END $$;
