-- Organizations (multi-tenant) — Phase 1, Task 1.1
-- Introduit l'entité Organisation (cabinet/clinique) et étend le rôle utilisateur.

-- Étendre le rôle utilisateur pour inclure organization_admin
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('patient','practitioner','admin','organization_admin'));

CREATE TABLE public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  postal_code   TEXT,
  country       TEXT DEFAULT 'SN',
  siret         TEXT,
  logo_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','active','suspended','rejected','archived')),
  created_by    UUID REFERENCES public.users(id),
  validated_by  UUID REFERENCES public.users(id),
  validated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_organizations_status ON public.organizations(status);
CREATE INDEX idx_organizations_created_by ON public.organizations(created_by);

-- Documents justificatifs de l'organisation
CREATE TABLE public.organization_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type    TEXT NOT NULL,
  file_url         TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
