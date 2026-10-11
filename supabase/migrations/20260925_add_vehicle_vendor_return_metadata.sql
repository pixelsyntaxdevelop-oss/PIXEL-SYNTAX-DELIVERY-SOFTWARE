-- Allied ERP: additive vehicle vendor-return metadata.
-- Existing employees, vehicles, assignments, SIMs and passports remain untouched.
-- Execute only after confirming the current public.vehicles schema.
BEGIN;
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS current_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS vendor_returned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vendor_return_date DATE,
  ADD COLUMN IF NOT EXISTS vendor_return_time TIME,
  ADD COLUMN IF NOT EXISTS vendor_return_reason TEXT,
  ADD COLUMN IF NOT EXISTS vendor_return_reference TEXT,
  ADD COLUMN IF NOT EXISTS vendor_returned_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS vendor_return_notes TEXT;
COMMIT;
