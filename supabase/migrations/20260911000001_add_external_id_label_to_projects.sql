-- Migration: Add external_id_label column to public.projects
-- Resolves PostgREST schema cache error: "Could not find the 'external_id_label' column of 'projects' in the schema cache"
-- Safe, idempotent column addition with backward-compatible default for existing projects.

ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS external_id_label VARCHAR(100) DEFAULT 'External Rider ID';

-- Ensure existing project records have a valid fallback label
UPDATE public.projects 
SET external_id_label = 'External Rider ID' 
WHERE external_id_label IS NULL;
