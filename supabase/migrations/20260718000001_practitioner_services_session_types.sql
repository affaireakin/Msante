-- practitioner_services in production predates the current migration history
-- (it has legacy `type`/`currency` columns instead) — the CREATE TABLE IF NOT
-- EXISTS in 20260513000003_p2_schema.sql silently no-op'd against it, so
-- `session_types` (what every web/mobile write path actually uses) was never
-- added. Every "Nouvelle prestation" creation has been failing with
-- "Could not find the 'session_types' column ... in the schema cache".
ALTER TABLE public.practitioner_services
  ADD COLUMN IF NOT EXISTS session_types TEXT[] NOT NULL DEFAULT ARRAY['video'];
