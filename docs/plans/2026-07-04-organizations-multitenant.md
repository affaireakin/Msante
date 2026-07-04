# Organisations (Cabinets) — Multi-Tenant · Plan d'implémentation

> **Pour Claude :** SOUS-COMPÉTENCE REQUISE — utiliser `superpowers:subagent-driven-development` pour exécuter ce plan tâche par tâche.

**Objectif :** Introduire un 3ᵉ type d'acteur, l'**Organisation** (cabinet/clinique), regroupant des praticiens sous une administration propre, avec isolation multi-tenant stricte par `organization_id`.

**Architecture :** PostgreSQL/Supabase + RLS pour l'isolation tenant (source de vérité sécurité), Next.js 15 pour le dashboard org-admin (web), Edge Functions Deno pour les flux sensibles (validation, invitation OTP, suspension). Le mobile reste patient/praticien ; un praticien rattaché porte simplement un `organization_id`.

**Décisions actées (2026-07-04) :**
- Validation praticien invité = **double validation** (Admin orga **puis** Super Admin).
- Rôles v1 = **Admin orga + Praticiens** uniquement (le schéma RBAC supporte les autres, non câblés).
- Dashboard org-admin = **web** ; onboarding/création = web ; contrôles Super Admin = admin web existant.

**Tech Stack :** Supabase (Postgres, RLS, Edge Functions, Storage), Next.js App Router, TanStack Query, Zod. Emails via le template natif Supabase + Resend (déjà utilisé pour les invitations existantes — voir `invite-admin`/`invite-collaborator`).

---

## Contraintes d'intégration avec l'existant (à respecter absolument)

1. **`users.role`** a un `CHECK (role IN ('patient','practitioner','admin'))` — l'étendre à `'organization_admin'`. Le Super Admin reste `role='admin'`.
2. **Récursion RLS** : le repo a déjà corrigé une récursion (`20260602000001_fix_rls_infinite_recursion.sql`). Toute policy multi-tenant DOIT passer par des **fonctions `SECURITY DEFINER`** (`current_user_org_id()`, `is_super_admin()`) plutôt que des sous-requêtes croisées entre tables protégées, sinon on recrée un cycle.
3. **Rétro-compatibilité** : les praticiens **indépendants** existants ont `organization_id = NULL`. Toutes les policies doivent traiter `NULL` comme « hors organisation » sans casser l'accès actuel.
4. **Table `invitations`** existe déjà (`20260617000001_invitations_table.sql`) pour admin/collaborateurs — s'en inspirer, ne pas la dupliquer aveuglément ; créer `practitioner_invitations` distincte (schéma spécifié).
5. **Audit** : `audit_logs` existe déjà — réutiliser pour toutes les actions sensibles org.

---

## PHASE 1 — Fondations DB (schéma multi-tenant + RBAC)

### Task 1.1 : Migration `organizations` + extension du rôle

**Files :**
- Create : `supabase/migrations/20260704000001_organizations.sql`

**DDL :**
```sql
-- Étendre le rôle utilisateur
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
```

**Acceptation :** migration applicable sur une base fraîche (`supabase db reset`) sans erreur ; un `patient`/`practitioner`/`admin` existant reste valide.

### Task 1.2 : Helpers `SECURITY DEFINER` (anti-récursion)

**Files :**
- Create : `supabase/migrations/20260704000002_tenant_helpers.sql`

```sql
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
```

**Acceptation :** les 3 fonctions existent, `STABLE`, `SECURITY DEFINER`, `search_path=public`.

### Task 1.3 : Colonnes `organization_id` sur les entités métier

**Files :**
- Create : `supabase/migrations/20260704000003_tenant_columns.sql`

```sql
ALTER TABLE public.users            ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.practitioners    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.appointments     ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.payments         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
ALTER TABLE public.consultation_types ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
-- messages/documents : dérivés du praticien, org_id ajouté pour requêtes directes
ALTER TABLE public.messages         ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

CREATE INDEX IF NOT EXISTS idx_practitioners_org ON public.practitioners(organization_id);
CREATE INDEX IF NOT EXISTS idx_appointments_org  ON public.appointments(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_org         ON public.users(organization_id);
```
> Note : `organization_id` reste NULLABLE (praticiens indépendants). Un trigger (Task 6.3) renseignera `appointments.organization_id` depuis le praticien à l'insertion.

**Acceptation :** colonnes ajoutées, existant intact (toutes NULL).

### Task 1.4 : Tables RBAC (Roles / Permissions / RolePermissions / UserRoles)

**Files :**
- Create : `supabase/migrations/20260704000004_rbac.sql`

```sql
CREATE TABLE public.org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, name)
);

CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,   -- ex: practitioner.invite
  label TEXT NOT NULL,
  category TEXT NOT NULL
);

CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.org_roles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id, organization_id)
);

-- Seed du catalogue de permissions (spec §Permissions possibles)
INSERT INTO public.permissions (code, label, category) VALUES
  ('practitioner.create','Créer un praticien','Praticiens'),
  ('practitioner.update','Modifier un praticien','Praticiens'),
  ('practitioner.delete','Supprimer un praticien','Praticiens'),
  ('practitioner.invite','Inviter un praticien','Praticiens'),
  ('practitioner.suspend','Suspendre un praticien','Praticiens'),
  ('calendar.read','Voir l''agenda','Agenda'),
  ('calendar.update','Modifier l''agenda','Agenda'),
  ('appointment.read','Voir les RDV','Rendez-vous'),
  ('appointment.create','Créer un RDV','Rendez-vous'),
  ('appointment.update','Modifier un RDV','Rendez-vous'),
  ('appointment.cancel','Annuler un RDV','Rendez-vous'),
  ('patient.read','Voir les patients','Patients'),
  ('patient.update','Modifier un patient','Patients'),
  ('invoice.read','Voir les factures','Facturation'),
  ('invoice.export','Exporter les factures','Facturation'),
  ('accounting.read','Voir la comptabilité','Comptabilité'),
  ('dashboard.read','Voir les statistiques','Statistiques'),
  ('settings.update','Modifier les paramètres','Paramètres'),
  ('users.manage','Gérer les utilisateurs','Utilisateurs'),
  ('roles.manage','Gérer les rôles','Rôles')
ON CONFLICT (code) DO NOTHING;

-- Helper permission (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.user_has_permission(perm_code TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = auth.uid() AND p.code = perm_code
  );
$$;
```

**Acceptation :** catalogue de 21 permissions inséré ; `user_has_permission('roles.manage')` renvoie `true` pour un super admin.

### Task 1.5 : Rôle système par défaut à la création d'orga

**Files :**
- Create : `supabase/migrations/20260704000005_default_org_role.sql`

Trigger `AFTER INSERT ON organizations` qui crée un rôle système `"Administrateur"` (`is_system=true`) avec **toutes** les permissions, et un rôle `"Praticien"` avec `calendar.*`, `appointment.*`, `patient.read`. (DDL trigger + fonction plpgsql.)

**Acceptation :** insérer une orga crée automatiquement 2 rôles système avec les bonnes permissions.

---

## PHASE 2 — RLS / Isolation tenant

### Task 2.1 : RLS sur `organizations` + `organization_documents`
- SELECT : `is_super_admin()` OU membre de l'orga (`id = current_user_org_id()`).
- INSERT : tout authentifié (création onboarding, statut forcé `pending` — voir Task 4).
- UPDATE : `is_super_admin()` (validation/suspension) OU `is_org_admin(id)` pour les champs profil non-critiques (via policy `WITH CHECK` restreignant le statut).

### Task 2.2 : RLS tenant sur entités métier
Pour `practitioners`, `appointments`, `payments`, `consultation_types`, `messages` : ajouter une policy « org isolation » :
```sql
CREATE POLICY "org_isolation_select" ON public.<table>
  FOR SELECT USING (
    public.is_super_admin()
    OR organization_id IS NULL            -- indépendants : logique existante conservée
    OR organization_id = public.current_user_org_id()
  );
```
+ policies INSERT/UPDATE gardées par `user_has_permission(...)` selon l'entité. **Ne pas supprimer** les policies patient/praticien existantes — les compléter.

### Task 2.3 : Tests d'isolation (pgTAP ou script SQL)
**Files :** `supabase/migrations/20260704000010_tenant_isolation_tests.sql` (ou script `supabase/scripts/test-tenant-isolation.sql`).
Scénario : 2 orgs A/B, un admin A ne voit aucune donnée B ; un super admin voit tout ; un praticien indépendant reste visible/inchangé.

**Acceptation :** le script échoue si une fuite inter-org est détectée.

---

## PHASE 3 — Super Admin (contrôle des organisations)

- **Task 3.1** — Edge Function `validate-organization` (approve/reject/request-info) : passe `pending→active`/`rejected`, set `validated_by/at`, notifie l'admin orga, audit log.
- **Task 3.2** — Edge Function `suspend-organization` : `active↔suspended`, notifie admin + praticiens, audit. Conséquences (login/RDV/prestations/messages bloqués) appliquées via RLS `status='active'` (Task 2 helper `org_is_active()`).
- **Task 3.3** — Web `apps/web/app/admin/organizations/page.tsx` : liste + filtres statut, file d'attente PENDING, actions Valider/Refuser/Suspendre/Réactiver, slide-out détail + documents. (Réutiliser le style de `admin/practitioners/page.tsx`.)
- **Task 3.4** — Lien sidebar admin (`admin/layout.tsx`) « Organisations ».

## PHASE 4 — Onboarding organisation (création)

- **Task 4.1** — Web `apps/web/app/onboarding/organization/page.tsx` : formulaire (nom, adresse, tél, email, SIRET optionnel, responsable) + upload documents → crée `organizations(status=pending)` + `organization_documents`, notifie Super Admin.
- **Task 4.2** — Trigger/guard : à l'INSERT côté client le statut est **toujours** forcé `pending` (RLS `WITH CHECK status='pending'` pour non-super-admin).
- **Task 4.3** — Après validation (Phase 3), création du compte `organization_admin` (email + lien 1ʳᵉ connexion) et `users.organization_id` renseigné.

## PHASE 5 — Dashboard org-admin (web)

- **Task 5.1** — `apps/web/app/organization/layout.tsx` : garde d'accès (`role='organization_admin'` + org `active`), sidebar (Praticiens, RDV, Patients, Prestations, Stats, Factures, Messages, Rôles, Paramètres).
- **Task 5.2** — `organization/practitioners/page.tsx` : liste des praticiens de l'orga (filtrée RLS), actions inviter/suspendre/supprimer/consulter.
- **Task 5.3** — `organization/appointments`, `organization/patients`, `organization/services`, `organization/analytics` : vues filtrées par `current_user_org_id()` (données déjà isolées par RLS ; l'UI réutilise les composants praticien/admin existants).
- **Task 5.4** — Factures/compta : lecture seule v1 (si l'entité `invoices` n'existe pas encore, la créer minimalement ou marquer « à venir »).

## PHASE 6 — Invitation praticien (OTP) + rattachement

### Task 6.1 : Table `practitioner_invitations`
```sql
CREATE TABLE public.practitioner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  firstname TEXT NOT NULL, lastname TEXT NOT NULL,
  email TEXT NOT NULL, phone TEXT,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','used','expired','cancelled')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
RLS : lecture/écriture limitées à l'org (`is_org_admin(organization_id)` + super admin).

- **Task 6.2** — Edge Function `invite-practitioner` : `user_has_permission('practitioner.invite')`, génère OTP, crée l'invitation, envoie l'email (Resend, template repris de `invite-collaborator`). Audit.
- **Task 6.3** — Flux d'acceptation : page web `apps/web/app/invite/practitioner/page.tsx` → saisie OTP → création compte Supabase → `users.role='practitioner'`, `users.organization_id=invite.org`, création ligne `practitioners(organization_id, verification_status='pending')` → onboarding praticien standard. Marque l'invitation `used`.
- **Task 6.4** — Trigger `appointments.organization_id` = org du praticien à l'insertion (BEFORE INSERT).

### Task 6.5 : Double validation praticien
- `practitioners` : ajouter `org_validated_at/by` (validation admin orga) en plus de `verification_status` (validation Super Admin).
- Un praticien invité n'est **actif** que si `org_validated_at IS NOT NULL` **ET** `verification_status='approved'`.
- UI : bouton « Valider » côté org-admin (set `org_validated_*`) ; le Super Admin garde la validation finale via `admin/practitioners`. Notifier aux deux étapes.

## PHASE 7 — RBAC UI (v1 : Admin + Praticien)

- **Task 7.1** — `organization/roles/page.tsx` : liste des rôles de l'orga, édition des permissions (checkboxes par catégorie), garde `roles.manage`. Rôles `is_system` non supprimables.
- **Task 7.2** — Attribution de rôle à un membre (`user_roles`) depuis la fiche praticien/membre.

## PHASE 8 — Notifications + Audit (transverse)

- **Task 8.1** — Câbler les notifications spec §Notifications (création→super admin ; validation→admin orga ; invitation→praticien ; validation praticien→admin+praticien ; suspension→admin+praticiens) via la table `notifications` existante.
- **Task 8.2** — Vérifier que chaque action sensible (create/update/delete/suspend/role-assign) écrit dans `audit_logs`.

---

## Ordre d'exécution & jalons

1. **Phases 1–2** (DB + RLS) = fondation critique, à faire et **tester l'isolation** avant toute UI.
2. **Phase 3** (Super Admin) = débloque la création réelle d'orgs de test.
3. **Phase 4–5** (onboarding + dashboard) = valeur visible.
4. **Phase 6** (invitation praticien + double validation).
5. **Phases 7–8** (RBAC UI, notifs/audit) = finition.

## Risques / points de vigilance
- **Récursion RLS** : toujours passer par les helpers `SECURITY DEFINER` (Task 1.2). Ne jamais référencer une table protégée dans sa propre policy via sous-requête directe.
- **Rétro-compat** : `organization_id IS NULL` = indépendant ; ne jamais forcer NOT NULL sur les tables existantes.
- **Suspension** : appliquée par RLS (`org_is_active()`), pas seulement côté front.
- **Facturation/compta** : entités possiblement inexistantes — à créer a minima ou différer (marquer clairement dans la Phase 5).
```
```

---

*Plan v1 — 2026-07-04 · À exécuter via subagent-driven-development, phase par phase, avec revue entre chaque phase.*
