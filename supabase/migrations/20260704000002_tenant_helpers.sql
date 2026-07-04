-- Tenant helpers (SECURITY DEFINER) — Phase 1, Task 1.2
-- Fonctions anti-récursion pour les policies RLS multi-tenant (Phase 2).
-- Elles contournent la RLS des tables protégées (SECURITY DEFINER) afin
-- d'éviter les cycles de policies déjà rencontrés dans ce repo.

-- Org de l'utilisateur courant (NULL si indépendant / patient)
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

-- Admin de SA propre organisation
CREATE OR REPLACE FUNCTION public.is_org_admin(target_org UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'organization_admin' AND organization_id = target_org
  );
$$;
