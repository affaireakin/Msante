# Admin Dashboard — Design Document

**Date :** 2026-05-03
**Statut :** Approuvé
**Périmètre :** Web Next.js 15 — 4 modules admin (Overview, Utilisateurs, Praticiens, Paiements)

---

## Objectif

Implémenter le dashboard admin basique de M-Santé : KPIs temps réel, gestion utilisateurs, validation et permissions praticiens, réconciliation paiements.

---

## Architecture

### Approche retenue : Monolithique multi-pages sous `/admin`

```
apps/web/app/
├── middleware.ts                  # Auth guard role='admin'
├── admin/
│   ├── layout.tsx                 # Sidebar + topbar glassmorphique
│   ├── page.tsx                   # Redirect → /admin/overview
│   ├── overview/page.tsx          # KPIs + graphiques Realtime
│   ├── users/page.tsx             # Annuaire utilisateurs
│   ├── practitioners/page.tsx     # File validation + permissions
│   └── payments/page.tsx          # Réconciliation paiements
```

### Packages à installer

```bash
pnpm --filter web add recharts @tanstack/react-query @tanstack/react-query-devtools papaparse
pnpm --filter web add -D @types/papaparse
# Shadcn UI (via CLI)
pnpm dlx shadcn@latest init  # dans apps/web/
pnpm dlx shadcn@latest add table badge dialog sheet select input button card tabs
```

---

## Base de données — Migrations

### Migration : permissions praticiens

```sql
-- supabase/migrations/20260503000002_practitioner_permissions.sql

ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS practitioner_type TEXT DEFAULT 'doctor'
    CHECK (practitioner_type IN ('doctor', 'psychologist', 'coach', 'nutritionist', 'other')),
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"can_prescribe": true, "can_order_exams": true}';
```

---

## Middleware

```typescript
// apps/web/middleware.ts
// Vérifie le JWT Supabase + role='admin' pour toutes les routes /admin/*
// Redirige vers / si non authentifié ou rôle insuffisant
```

Utilise `@supabase/ssr` + `createServerClient` pour lire le cookie de session Next.js.

---

## Module 1 — Overview (`/admin/overview`)

### KPI Cards (Supabase Realtime)

| KPI | Requête |
|-----|---------|
| Utilisateurs actifs (30j) | `COUNT users WHERE updated_at > now()-30d` |
| Revenus du mois (XOF) | `SUM payments.amount WHERE status='completed' AND mois courant` |
| Praticiens en attente | `COUNT practitioners WHERE verification_status='pending'` |
| Taux de no-show (%) | `no_show / total_appointments * 100` |

**Realtime :** `postgres_changes` sur `payments`, `appointments`, `practitioners` → invalide le cache TanStack Query.

### Graphiques (Recharts)

| Graphique | Type | Données |
|-----------|------|---------|
| Revenus 7j | AreaChart | `SUM payments par jour` |
| Nouveaux utilisateurs 7j | LineChart | `COUNT users par jour` |
| RDV par statut | BarChart | `COUNT appointments GROUP BY status` |
| Providers paiement | PieChart | `COUNT payments GROUP BY provider` |

---

## Module 2 — Utilisateurs (`/admin/users`)

- Tableau paginé 10/page : initiales + nom + rôle + pays + date inscription + statut onboarding
- Filtres : `ALL / PATIENTS / PRACTITIONERS / ADMINS`
- Recherche debounce 300ms sur nom/email
- Clic → Sheet slide-out profil (lecture seule MVP)
- TanStack Query `staleTime: 30_000`

---

## Module 3 — Praticiens (`/admin/practitioners`)

### File de validation

- Liste triée : `pending` → `under_review` → `approved` → `rejected`
- Carte praticien : nom + spécialité + date soumission + documents (diplôme, licence, CNI)
- Actions :
  - **Approuver** → `UPDATE verification_status='approved', is_verified=true` + Edge Function `notify-practitioner-approved`
  - **Rejeter** → Dialog motif obligatoire → `UPDATE verification_status='rejected'`
  - **Mettre sous revue** → `UPDATE verification_status='under_review'`
- Badges : amber (pending) · blue (under_review) · green (approved) · red (rejected)

### Gestion des permissions

- Sélecteur `practitioner_type` : Médecin / Psychologue / Coach / Nutritionniste / Autre
- Toggles permissions :
  - `can_prescribe` (masqué pour coaches et nutritionnistes par défaut)
  - `can_order_exams` (médecins uniquement par défaut)
- `UPDATE practitioners SET practitioner_type=..., permissions=...`
- Impact consultation : bouton "Ordonnance" masqué si `permissions.can_prescribe = false`

---

## Module 4 — Paiements (`/admin/payments`)

- Tableau paginé : date + patient + praticien + montant XOF + provider + statut badge
- Filtres : statut + provider + plage de dates
- Totaux en header : revenus jour / en attente / échoués
- Export CSV via `papaparse` (côté client)
- Action `failed` → bouton **Rembourser** → `UPDATE payments SET status='refunded'`

---

## Layout global (`/admin/layout.tsx`)

Design fidèle au CLAUDE.md :

```
Sidebar fixe w-64
  bg-white/70 backdrop-blur-xl
  border-r border-slate-200/50
  Logo M-Santé + badge "Admin Console"
  Nav : Overview · Utilisateurs · Praticiens · Paiements
  Item actif : bg-sky-50 text-sky-600 font-semibold border-r-4 border-sky-500
  Hover : hover:translate-x-1 hover:bg-slate-50/50

Topbar fixe h-16
  bg-white/40 backdrop-blur-lg
  border-b border-white/10 z-40
  Search + cloche notifications + avatar admin

Fond : bg-[#f8f9ff]
Font : Manrope
```

---

## Sécurité

- Middleware Next.js vérifie `role='admin'` à chaque requête vers `/admin/*`
- Toutes les mutations passent par Supabase client avec JWT — RLS garantit que seul `service_role` peut modifier `practitioners.verification_status`
- Export CSV : données filtrées côté serveur avant envoi au client

---

## Stack technique

| Outil | Usage |
|-------|-------|
| Next.js 15 App Router | Framework |
| Supabase SSR + Realtime | Auth + données temps réel |
| TanStack Query v5 | Cache + invalidation |
| Shadcn UI | Table, Badge, Dialog, Sheet, Select |
| Recharts | AreaChart, LineChart, BarChart, PieChart |
| papaparse | Export CSV |
| Manrope + Material Design 3 | Design system CLAUDE.md |
