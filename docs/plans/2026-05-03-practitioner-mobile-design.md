# Espace Praticien Mobile V1 — Design Document

**Date :** 2026-05-03
**Statut :** Approuvé
**Périmètre :** React Native + Expo Router — `apps/mobile/app/(practitioner)/` — 3 écrans fonctionnels + 1 stub

---

## Objectif

Remplacer le placeholder `(practitioner)/home.tsx` par un espace praticien complet : dashboard KPIs, gestion agenda/approbations, répertoire patients. Fidèle aux écrans de référence (`practitioner_dashboard_mobile/`, `appointment_approvals_mobile/`, `patient_directory_mobile/`).

---

## Architecture

```
apps/mobile/app/(practitioner)/
├── _layout.tsx          # Tab navigator 4 onglets (remplace Stack)
├── index.tsx            # Dashboard — KPIs + agenda du jour + activité récente
├── agenda.tsx           # Pending approvals + RDV confirmés du jour
├── patients.tsx         # Répertoire patients searchable + filtres
└── profile.tsx          # Stub : nom, spécialité, déconnexion

apps/mobile/features/practitioner/
├── hooks/
│   ├── useDashboard.ts       # earnings mois, consultations, rating, activité
│   ├── useAgenda.ts          # appointments pending + confirmed aujourd'hui
│   └── usePatients.ts        # patients uniques du praticien + search/filtre
└── services/
    └── appointmentActions.ts  # approve / decline mutations Supabase
```

---

## Bottom Navigation

4 onglets, icônes Material Symbols Outlined, actif en sky-500 / inactif en slate-400 :

| Tab | Icône | Route |
|-----|-------|-------|
| Dashboard | `dashboard` | `/` (index) |
| Agenda | `calendar_today` | `/agenda` |
| Patients | `group` | `/patients` |
| Profile | `person` | `/profile` |

---

## Écrans

### Dashboard (`index.tsx`)

**Header glassmorphique**
- Avatar circulaire praticien (initiales si pas de photo)
- "Dr. [full_name]" en sky-500 font-bold
- "Practitioner Portal" en label-caps text-outline
- Bouton cloche notifications

**Bento Grid KPIs (2 colonnes)**
- Earnings (col-span-2) : somme `payments WHERE practitioner_id = X AND status = 'completed' AND created_at >= début du mois` — montant en `text-display-lg text-primary` — trend calculé vs mois précédent — icône `account_balance_wallet`
- Consultations : COUNT `appointments WHERE status = 'completed'` — icône `personal_injury`
- Rating : `practitioners.rating` + `/5` — icône `star`

**Today's Agenda**
- `appointments WHERE practitioner_id = X AND DATE(scheduled_at) = today AND status IN ('confirmed', 'pending')` ORDER BY scheduled_at ASC
- Card par RDV : avatar patient (initiales) + nom + type (Follow-up / Initial Consultation) + chip heure (`primary-container`)
- Premier RDV : bouton "Start Session" (videocam icon, bg-primary)
- Bouton "VIEW ALL" → navigate to `/agenda`

**Recent Activity**
- 5 dernières `notifications WHERE user_id = practitioner.user_id` ORDER BY created_at DESC
- Icône colorée selon type (mail → primary, payments → secondary-container)
- Titre + extrait (line-clamp-1) + timestamp relatif

---

### Agenda (`agenda.tsx`)

**Header**
- "Appointments" en headline-md text-sky-600
- Avatar praticien (top right)

**Pending Approvals**
- Badge "N Requests" en `primary-container`
- `appointments WHERE practitioner_id = X AND status = 'pending'` ORDER BY scheduled_at ASC
- Card par demande :
  - Avatar initiales patient + nom + type consultation (Telehealth / In-person)
  - Date/heure + note patient (line-clamp-2)
  - 3 boutons : **Approve** (bg-primary text-white) · **Reschedule** (border text-primary) · **Decline** (text-error)
- Approve → `UPDATE appointments SET status='confirmed'` + insert notification patient
- Decline → `UPDATE appointments SET status='cancelled'` + insert notification patient

**RDV confirmés aujourd'hui**
- Section séparée sous les pending
- Cards plus légères : nom + heure + type — pas de boutons d'action

---

### Patients (`patients.tsx`)

**Header**
- Search bar "Search patients, IDs..." (filtre local sur nom + ID)
- Icône settings (top right)

**Filtres tabs**
- All Patients · Requires Follow-up · Stable
- "Requires Follow-up" = dernière consultation avec note non vide et date > 30j
- "Stable" = dernière consultation < 30j

**Données**
- Jointure : `appointments JOIN users ON patient_id = users.id WHERE practitioner_id = X`
- Grouper par patient, prendre la dernière consultation
- Champs : full_name, avatar_url, created_at (comme ID MS-XXXX → last 4 de l'UUID), dernière consultation date + notes

**Card patient**
- Avatar initiales 2 lettres dans cercle coloré
- Nom + ID MS-XXXX (4 derniers chars UUID)
- Badge statut : "Follow-up" (rose) / "Stable" (vert)
- Date dernière consultation + note (line-clamp-2)
- Boutons : **Records** (outline) · **Message** (bg-primary) — stubs en V1

---

### Profile (`profile.tsx`) — Stub

- Avatar large + nom praticien + spécialité
- Statut vérification (badge Approuvé / En attente)
- Rating + nombre avis
- Bouton "Se déconnecter" → `supabase.auth.signOut()` → redirect `/(auth)/welcome`

---

## Stack technique

| Outil | Usage |
|-------|-------|
| Expo Router tabs | Navigation 4 onglets |
| NativeWind v4 | Styling fidèle aux designs |
| TanStack Query v5 | Cache + mutations |
| Supabase client | Données temps réel |
| GlassCard (existant) | Composant glassmorphique |
| PrimaryButton (existant) | Boutons CTA |

---

## Design System (fidèle aux écrans)

- Fond : `bg-[#f8f9ff]`
- Glass cards : `bg-white/60 backdrop-blur-[20px] border border-white/60 shadow-[0_8px_32px_rgba(0,102,133,0.05)]`
- Primary : `#006685`
- Tab actif : `text-sky-500`
- Tab inactif : `text-slate-400`
- Font : Manrope (déjà configuré)
- Header : `bg-white/70 backdrop-blur-xl border-b border-white/20`
