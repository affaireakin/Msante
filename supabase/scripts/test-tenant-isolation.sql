-- Tenant isolation test — Phase 2
-- Run against a local Supabase DB (Docker up):
--   npx supabase db reset            # applies all migrations
--   psql "$DATABASE_URL" -f supabase/scripts/test-tenant-isolation.sql
-- The whole test runs in a transaction and ROLLS BACK, leaving no data behind.
-- It RAISES EXCEPTION on the first isolation breach, so a clean run == pass.

BEGIN;

-- Helper to impersonate a user for RLS (mimics Supabase auth.uid()).
CREATE OR REPLACE FUNCTION pg_temp.act_as(uid UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.act_as_service()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE 'SET LOCAL ROLE postgres';
  PERFORM set_config('request.jwt.claims', NULL, true);
END;
$$;

-- ── Fixture (as service/postgres, bypassing RLS) ────────────────────────────
SELECT pg_temp.act_as_service();

-- Two orgs
INSERT INTO public.organizations (id, name, slug, email, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Org A', 'org-a', 'a@a.io', 'active'),
  ('22222222-2222-2222-2222-222222222222', 'Org B', 'org-b', 'b@b.io', 'active');

-- Users: an org admin per org, plus an independent patient.
-- NOTE: real rows reference auth.users; for this isolated test we insert into
-- public.users only and rely on the FK to auth.users being deferrable/absent in
-- the test DB. If your local schema enforces the auth.users FK, create matching
-- auth.users rows first (see comment block at the bottom).
INSERT INTO public.users (id, role, full_name, organization_id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'organization_admin', 'Admin A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'organization_admin', 'Admin B', '22222222-2222-2222-2222-222222222222'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin',              'Super',   NULL);

-- Practitioners in each org + one independent.
INSERT INTO public.practitioners (id, user_id, speciality, organization_id) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Psy', '11111111-1111-1111-1111-111111111111'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Psy', '22222222-2222-2222-2222-222222222222');

-- ── Assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE cnt INT;
BEGIN
  -- Admin A sees only org A practitioners via the org_admin_read policy.
  PERFORM pg_temp.act_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  SELECT count(*) INTO cnt FROM public.practitioners WHERE organization_id = '22222222-2222-2222-2222-222222222222';
  IF cnt <> 0 THEN RAISE EXCEPTION 'LEAK: Admin A can see % org-B practitioners', cnt; END IF;

  SELECT count(*) INTO cnt FROM public.organizations WHERE id = '22222222-2222-2222-2222-222222222222';
  IF cnt <> 0 THEN RAISE EXCEPTION 'LEAK: Admin A can see org B organization row'; END IF;

  -- Admin A can see its own org.
  SELECT count(*) INTO cnt FROM public.organizations WHERE id = '11111111-1111-1111-1111-111111111111';
  IF cnt <> 1 THEN RAISE EXCEPTION 'Admin A cannot see own organization'; END IF;

  -- Admin A cannot flip its own org status (trigger guard).
  BEGIN
    UPDATE public.organizations SET status = 'active' WHERE id = '11111111-1111-1111-1111-111111111111';
    -- same value → no-op is allowed; now try a real change:
    UPDATE public.organizations SET status = 'suspended' WHERE id = '11111111-1111-1111-1111-111111111111';
    RAISE EXCEPTION 'GUARD FAIL: Admin A changed its org status';
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM NOT LIKE '%super admin can change the organization status%' THEN RAISE; END IF;
  END;

  -- Super admin sees everything.
  PERFORM pg_temp.act_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
  SELECT count(*) INTO cnt FROM public.organizations;
  IF cnt < 2 THEN RAISE EXCEPTION 'Super admin cannot see all organizations (%)', cnt; END IF;

  PERFORM pg_temp.act_as_service();
  RAISE NOTICE 'TENANT ISOLATION TESTS PASSED';
END $$;

ROLLBACK;

-- If the public.users → auth.users FK is enforced in your local DB, prepend:
--   INSERT INTO auth.users (id, email) VALUES
--     ('aaaaaaaa-...','a-admin@test.io'), ('bbbbbbbb-...','b-admin@test.io'),
--     ('cccccccc-...','super@test.io');
-- inside the service section, before inserting into public.users.
