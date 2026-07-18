-- Two more legacy constraints on practitioner_services that the previous
-- session_types fix didn't address, both of which still block every
-- "Nouvelle prestation" creation:
--   - `type` is NOT NULL with no default, but no web/mobile code path has
--     ever set it (dead legacy column) — inserts fail with a not-null
--     violation before session_types even comes into play.
--   - `price` is NOT NULL with no default, but the create-service form
--     explicitly supports leaving price empty (sends null) — the intended
--     schema (20260513000003_p2_schema.sql) always had price as nullable.
ALTER TABLE public.practitioner_services
  ALTER COLUMN type DROP NOT NULL,
  ALTER COLUMN price DROP NOT NULL;
