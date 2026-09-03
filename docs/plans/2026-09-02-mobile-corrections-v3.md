# Corrections & Évolutions Mobile V3 — Plan d'Implémentation

> **For Claude:** ce projet n'a pas de suite de tests automatisés — la vérification établie tout au long de cette session est : `tsc --noEmit` (web + mobile), `next build` (web), déploiement Edge Functions via `pnpm supabase functions deploy`, puis test manuel réel (navigateur / APK Android installé sur device). Chaque tâche ci-dessous remplace donc les étapes "test qui échoue / test qui passe" du skill `writing-plans` par : implémenter → vérifier (typecheck/build/déploiement) → tester manuellement sur mobile ET web → commit. Le mobile est la priorité explicite de l'utilisateur ; le web n'est retouché que quand il partage le bug (même table/RLS/Edge Function) ou pour garder la parité annoncée en section 2 du cahier des charges.

**Goal:** Traiter le cahier des charges "M-SANTÉ — LISTE DES CORRECTIONS ET ÉVOLUTIONS" (20 points, priorisés P1/P2/P3 par l'utilisateur) en tâches vérifiables indépendamment, mobile-first.

**Architecture:** Mobile (Expo/React Native, `apps/mobile`) et Web (Next.js 15, `apps/web`) partagent la même base Supabase (Postgres + RLS + Edge Functions Deno) — toute correction de logique métier/schéma se fait une seule fois côté backend et bénéficie aux deux clients automatiquement ; le travail spécifique à faire deux fois est uniquement l'UI.

**Tech Stack:** Expo SDK 54 · Expo Router · TanStack Query v5 · Zustand · React Hook Form + Zod · Next.js 15 App Router · Supabase (Postgres/RLS/Edge Functions/Storage) · TypeScript strict

**Source :** cahier des charges collé par l'utilisateur le 2026-09-02 (conversation), confirmé "c'est sur l'app mobile" (priorité mobile explicite).

---

## PHASE 1 — P1 BLOQUANT

### Task 1.1 — Disponibilités praticien → moteur de réservation → visibilité patient

**Statut : investigation terminée. Root cause identifiée — bien plus large qu'un bug ponctuel.**

**Diagnostic confirmé :** deux systèmes de disponibilités parallèles, sans aucune table en commun.
- **Legacy (mobile écrit ici)** : `availabilities`, `availability_exceptions`, `practitioner_services`, `availability_day_rules`, `schedule_blocks`.
- **V2 (web écrit ici, moteur de réservation lit ici pour le web)** : `consultation_types`, `weekly_availabilities`, `blocked_periods`, `practitioner_locations`, `practitioner_booking_settings`, via `apps/web/lib/availabilitySlots.ts` (`generateSlots()`).

**Bugs racine cumulés :**
1. `20260602000003_availability_date_based.sql` a **supprimé** `availabilities.day_of_week` (remplacé par `slot_date`), mais rien côté mobile n'a été mis à jour — chaque lecture/écriture mobile sur `day_of_week` échoue silencieusement.
2. `useAvailabilitySettings.ts` (mobile) n'appelle jamais `if (error) throw error` sur ses inserts/updates/deletes (`useSaveSchedule`, `useAddException`, `useDeleteException`) → `handleSave` affiche "✓ Sauvegardé" même quand rien n'est persisté. C'est la cause directe du symptôme "je crée une dispo, rien ne se passe".
3. Le moteur de réservation patient MOBILE (`apps/mobile/features/practitioners/hooks/useAvailability.ts`) lit aussi `availabilities.day_of_week` → toujours vide → **0 créneau affiché pour tout praticien, sur mobile, systématiquement**, indépendamment de qui a configuré quoi.
4. `availability_exceptions` et `schedule_blocks` (les deux tables "congés" du mobile) ne sont lues par **aucun** moteur de réservation (ni web ni mobile) — dead-end pur, confirmé par grep exhaustif.
5. Doublon interne mobile : `services.tsx` et le hook intégré à `availability.tsx` écrivent tous deux `practitioner_services` mais avec des colonnes différentes (`session_types[]` vs `type`+`currency`) → un service créé sur un écran s'affiche différemment sur l'autre.
6. Bug d'affichage de date confirmé (UTC/local) : `new Date('YYYY-MM-DD')` est parsé en UTC minuit puis affiché en fuseau local → décalage d'un jour. Le web a déjà le bon pattern (`'T00:00:00'` sans `Z`, dans `availabilitySlots.ts` et `availability/page.tsx`), à copier tel quel côté mobile.
7. Le type de créneau "audio" existe encore côté mobile (`practitioner_services.type`) alors que le web a déjà supprimé cette confusion (`consultation_types.mode` n'a que `presentiel`/`video`/`both`) — se recoupe directement avec la demande explicite de l'utilisateur (Task 2.4, section 11 du cahier des charges : retirer Audio du mobile).

**Décision de fix — une seule source de vérité (règle section 2 du cahier des charges) :** ne PAS rafistoler les tables legacy (colonne à recréer, error-handling à ajouter, tables mortes à raccorder) — ça pérenniserait deux systèmes parallèles. **Migrer l'écran mobile pour écrire dans les tables v2**, les mêmes que le web, et arrêter d'utiliser les tables legacy côté mobile. Effet de bord positif : Task 2.4 (retirer Audio) se résout naturellement puisque `consultation_types.mode` n'a pas cette valeur.

**Files (confirmés) :**
- Réécrire : `apps/mobile/app/(practitioner)/availability.tsx`, `apps/mobile/features/practitioner/hooks/useAvailabilitySettings.ts`, `useDayRules.ts`
- Réécrire : `apps/mobile/features/practitioners/hooks/useAvailability.ts` (lecture patient)
- Aligner/retirer le doublon : `apps/mobile/app/(practitioner)/services.tsx` + `apps/mobile/features/practitioner/hooks/usePractitionerServices.ts`
- Retirer (dead code) : `apps/mobile/app/(practitioner)/schedule-blocks/new.tsx`
- Référence exacte du modèle cible (à lire avant d'écrire) : `apps/web/app/practitioner/availability/page.tsx` (`useAvailData`), `apps/web/lib/availabilitySlots.ts` (`generateSlots`), `apps/web/app/patient/book/[id]/page.tsx`
- Pas de nouvelle migration nécessaire — les tables v2 existent déjà (`20260609000003_appointment_module_v2.sql`, `20260713000001_specific_date_availability.sql`)

**Step 1:** Lire `apps/web/lib/availabilitySlots.ts` + `apps/web/app/practitioner/availability/page.tsx` en entier pour connaître exactement la forme de données attendue (colonnes, enums, jointures).

**Step 2:** Réécrire les hooks mobile (`useAvailabilitySettings.ts`, `useDayRules.ts`) pour lire/écrire `weekly_availabilities` + `consultation_types` + `practitioner_locations` + `practitioner_booking_settings`, avec gestion d'erreur systématique (`if (error) throw error` partout — corrige aussi le bug #2 par construction).

**Step 3:** Réécrire la section "Congés & exceptions" mobile pour écrire dans `blocked_periods` (au lieu de `availability_exceptions`/`schedule_blocks`), avec le pattern date `'T00:00:00'` pour l'affichage (corrige le bug #6).

**Step 4:** Réécrire `useAvailability.ts` (lecture patient mobile) pour utiliser `generateSlots()`-équivalent sur les tables v2 (idéalement partager la logique avec le web plutôt que la dupliquer — voir si `availabilitySlots.ts` peut être déplacé dans un endroit importable par le mobile, sinon porter la même logique en TS pur côté mobile).

**Step 5:** Retirer "Audio" des types de consultation mobile (recoupe Task 2.4).

**Step 6:** Unifier "Mes prestations" — un seul écran/hook écrivant `consultation_types`, retirer le doublon `practitioner_services`/`usePractitionerServices.ts` côté mobile une fois basculé sur v2.

**Step 7: Vérifier bout en bout** : créer une disponibilité sur mobile → la retrouver dans l'agenda praticien (mobile) → la retrouver dans le moteur de réservation patient (mobile ET web) → réserver → vérifier que le créneau disparaît/se bloque partout. Créer une dispo côté web → vérifier qu'elle apparaît aussi côté mobile (test bidirectionnel imposé section 16).

**Step 8:** `tsc --noEmit` mobile, commit. Anciennes tables (`availabilities`, `availability_exceptions`, `practitioner_services`, `availability_day_rules`, `schedule_blocks`) laissées en base sans DROP (pas de perte de données historiques), simplement plus référencées par le code mobile.

---

### Task 1.2 — Agenda praticien accessible immédiatement au lancement (mobile)

**Files:**
- `apps/mobile/app/(practitioner)/_layout.tsx` (ou fichier de layout/tab-bar praticien)
- Écran d'accueil praticien actuel (à identifier — probablement pas l'agenda aujourd'hui, cf. section 12 du cahier des charges)

**Step 1:** Identifier l'écran affiché en premier après connexion praticien (route par défaut du groupe `(practitioner)`).

**Step 2:** Si ce n'est pas l'agenda, changer la route d'accueil du groupe praticien vers l'agenda (`router.replace` post-login ou réordonner les tabs/`index.tsx` du groupe).

**Step 3:** Vérifier sur mobile : connexion praticien → l'agenda s'affiche en premier, sans navigation supplémentaire.

**Step 4:** Commit.

*(Se recoupe avec Task 3.1 — réorganisation complète de l'espace praticien — mais ce point précis est bloquant/P1, à livrer indépendamment de la refonte visuelle complète.)*

---

### Task 1.3 — OTP : 60 minutes → 10 minutes

**Files:**
- `supabase/config.toml` (`[auth.email]` — ajouter `otp_expiry`)
- Réglage distant Supabase (Dashboard → Authentication → Email si `config push` non disponible côté CLI)
- Tout texte UI codé en dur mentionnant "60 minutes" : `apps/web/app/auth/verify-otp/page.tsx`, `apps/web/app/auth/verify-reset/page.tsx`, `apps/mobile/app/(auth)/verify-otp.tsx`, `apps/mobile/app/(auth)/verify-reset-otp.tsx` (grep `"60 minutes"` / `"valable 60"`)

**Step 1:** Ajouter `otp_expiry = 600` sous `[auth.email]` dans `supabase/config.toml`.

**Step 2:** Pousser le réglage (`pnpm supabase config push` si supporté par la version CLI installée — vérifié en cours) ; sinon donner à l'utilisateur l'étape Dashboard exacte.

**Step 3:** Remplacer tous les textes "60 minutes" par "10 minutes" (grep exhaustif web + mobile).

**Step 4:** Vérifier : demander un OTP, confirmer qu'il expire réellement après 10 min (test différé) et qu'un ancien code est bien rejeté ; vérifier le nombre de tentatives limité déjà en place (comportement Supabase Auth par défaut, à confirmer plutôt qu'à réimplémenter).

**Step 5:** `tsc --noEmit` (web + mobile), commit.

---

### Task 1.4 — Refonte soumission des documents + prise de photo caméra (mobile)

**Files:**
- `apps/mobile/components/ui/DocumentUploader.tsx` (types MIME déjà corrigés cette session — reste : aperçu, recadrage, remplacement, progression, statut)
- `apps/mobile/app/(onboarding)/practitioner.tsx`, `apps/mobile/app/(onboarding)/organization.tsx`
- Nouvelle lib de recadrage : probablement `expo-image-manipulator` (déjà dans les dépendances Expo SDK 54 ou à ajouter) — **vérifier avant d'ajouter une dépendance non listée dans CLAUDE.md, cf. règle "ne pas introduire de librairie non listée sans justification"**

**Step 1:** Étendre `DocumentUploader` : bouton caméra (via `expo-image-picker` `launchCameraAsync`, déjà utilisé ailleurs dans le repo pour les photos) en plus du sélecteur fichier existant.

**Step 2:** Ajouter un écran/modal d'aperçu + recadrage avant validation (reprendre/adapter si un composant de crop existe déjà côté avatar praticien — vérifier `onboarding/practitioner.tsx`'s `pickProfilePhoto`).

**Step 3:** Afficher la progression d'upload (état déjà géré via `loading` — ajouter un indicateur pourcentage/spinner par document plutôt que global si simple).

**Step 4:** Remplacer le message de fin de soumission (praticien ET organisation) par exactement :
Titre : **Documents reçus**
Corps : *"Nous avons bien reçu vos documents. Merci pour votre envoi. Nous allons les analyser et reviendrons vers vous dans les meilleurs délais. Vous serez informé(e) dès que l'analyse sera terminée."*
— aucune mention de "en attente de validation". Fichiers concernés : `apps/mobile/app/(onboarding)/practitioner-submitted.tsx` (et équivalent organisation, à créer si absent).

**Step 5:** Vérifier sur mobile : soumission complète praticien et organisation, avec au moins un document pris à la caméra.

**Step 6:** `tsc --noEmit`, commit.

---

## PHASE 2 — P2 FONCTIONNEL

### Task 2.1 — Notification WhatsApp de bienvenue

**Files:** `packages/notifications/templates.ts` + trigger d'inscription (`handle_new_user()` ne peut pas appeler une Edge Function directement — nécessite soit un trigger DB→webhook, soit un appel depuis le flux `verify-otp` une fois le compte confirmé et le téléphone connu).
Ajouter l'événement `welcome` au système existant (déjà simplifié en un seul message générique WhatsApp cette session — le "bienvenue" peut réutiliser `genericWhatsAppMessage` tel quel, déclenché une fois après confirmation OTP si `phone`/`whatsapp_number` renseigné).

**Step 1:** Ajouter l'appel (web `verify-otp/page.tsx` + mobile `verify-otp.tsx`) : après succès de `verifyOtp`, si le rôle est patient et qu'un téléphone a été fourni à l'inscription, appeler `send-workflow-notification` ou un envoi direct WhatsApp générique.

**Step 2:** Vérifier : inscription patient avec numéro d'un testeur Meta vérifié → message reçu.

**Step 3:** Commit.

### Task 2.2 — Notifications de nouveaux messages (push + badge + accès direct)

**Files:** feature messagerie mobile (`apps/mobile/features/messages/` ou équivalent), `NotificationBell` web déjà existant.

**Step 1:** Vérifier si un trigger DB existe déjà sur `messages` (table déjà présente d'après un plan antérieur, `2026-06-08-retour-fonctionnel-v2.md`) déclenchant une notification push à l'insertion.

**Step 2:** Si absent, ajouter une Edge Function/trigger déclenchant push (Expo) au destinataire, pour les 4 sens patient↔praticien↔organisation↔admin listés.

**Step 3:** Vérifier tap-to-open direct vers la conversation (deep link `data.route`).

**Step 4:** Commit.

### Task 2.3 — Titres professionnels corrects (pas de "Dr" par défaut)

**Files:** partout où un nom praticien est préfixé "Dr" en dur — grep `Dr\.` / `Dr \$\{` dans `apps/mobile` et `apps/web`. Utiliser `professional_prefixes` (déjà en place, section admin `/admin/prefixes`) au lieu d'un préfixe codé en dur.

**Step 1:** Grep exhaustif des préfixes "Dr" codés en dur (ex. déjà repéré cette session : `notify-practitioner-approved/index.ts` avant simplification WhatsApp — vérifier s'il en reste dans les sujets d'email, les titres de notification, l'affichage mobile fiche praticien).

**Step 2:** Remplacer par le `prefix_id` réel de l'utilisateur (jointure `professional_prefixes`), fallback neutre (juste le nom complet) si aucun préfixe assigné — jamais "Dr" par défaut.

**Step 3:** Vérifier sur profil/agenda/RDV/recherche/messages, mobile + web, avec un praticien non-médecin (infirmier, psychologue…).

**Step 4:** Commit.

### Task 2.4 — Mobile : uniquement Présentiel / Visioconférence (retirer Audio)

**Files:** `apps/mobile/app/(practitioner)/availability.tsx` (toggles Vidéo/Audio/Présentiel → Vidéo/Présentiel), tout écran mobile de sélection de type de consultation patient.
**Ne pas toucher le web** (gestion avancée conservée, cf. cahier des charges section 11).

**Step 1:** Retirer l'option "Audio" des toggles mobile (praticien) et du sélecteur mobile (patient).
**Step 2:** Vérifier que retirer Audio côté mobile n'empêche pas d'afficher un RDV existant en type `audio` créé depuis le web (lecture seule OK, juste pas de création/édition sur mobile).
**Step 3:** Commit.

### Task 2.5 — Logos d'organisation (upload + caméra + recadrage + sync web) & Task 2.6 — Recadrage photo de profil

**Files:** `apps/mobile/app/(onboarding)/organization.tsx`, `apps/mobile/app/(organization)/profile.tsx` (ou équivalent), même lib de recadrage que Task 1.4.

**Step 1:** Réutiliser le composant de recadrage construit en Task 1.4 pour logo d'organisation et photo de profil (DRY — un seul composant `ImageCropPicker` partagé).
**Step 2:** Vérifier l'upload logo organisation apparaît bien sur le web (`site-assets`/bucket dédié organisation déjà utilisé par le web admin — confirmer le bucket exact avant d'écrire).
**Step 3:** Commit.

### Task 2.7 — Parcours organisation : message de confirmation générique

**Files:** équivalent organisation de Task 1.4 Step 4, web (`apps/web/app/onboarding/organization/page.tsx` déjà vu cette session avec message "Demande envoyée !" — vérifier s'il faut aussi l'aligner sur le texte imposé, ou si "Demande envoyée !" reste acceptable puisqu'il ne mentionne pas "en attente de validation" — la capture fournie par l'utilisateur montre que ce texte web actuel est probablement déjà correct).

**Step 1:** Comparer le texte actuel web (`Demande envoyée !` / `Votre demande de création pour {nom} a été transmise à notre équipe...`) au texte imposé pour mobile — si le ton diffère trop, harmoniser ; sinon laisser le web tel quel (déjà conforme à l'esprit "pas de mention de statut en attente").
**Step 2:** Ajouter la notification de fin d'analyse (organisation informée quand le dossier est traité) si absente — vérifier si `notify-practitioner-approved`-like existe déjà pour les organisations (`validate-organization` Edge Function, à relire).
**Step 3:** Commit.

---

## PHASE 3 — P3 UX/UI

### Task 3.1 — Réorganisation espace praticien mobile

**Files:** navigation/tabs praticien (`apps/mobile/app/(practitioner)/_layout.tsx`), écrans à regrouper sous "Paramètres".

**Step 1:** Agenda en accueil (recoupe Task 1.2 — s'assurer que c'est fait avant de commencer cette tâche).
**Step 2:** Regrouper accès rapides : RDV, disponibilités, patients, messages, documents, profil.
**Step 3:** Déplacer infos secondaires (perso, pro, compte, notifications, sécurité, préférences) sous un seul écran "Paramètres".
**Step 4:** Vérifier parité fonctionnelle avec le web (rien de perdu, juste réorganisé).
**Step 5:** Commit.

### Task 3.2 — Format de date JJ/MM/AAAA partout

**Files:** dépend du rapport Task 1.1 pour l'écran "Congés & exceptions" ; grep plus large `AAAA-MM-JJ`/`YYYY-MM-DD` en placeholder/label affiché à l'utilisateur (pas les valeurs internes ISO, qui peuvent rester ISO en stockage — seul l'AFFICHAGE doit changer).

**Step 1:** Grep exhaustif mobile + web des libellés de date affichés.
**Step 2:** Remplacer l'affichage par JJ/MM/AAAA (garder le stockage/API en ISO — ne changer que la couche présentation, avec un formatter centralisé si possible plutôt que dupliqué à chaque écran).
**Step 3:** Commit.

### Task 3.3 — Barre de navigation (visibilité, safe area)

**Files:** layouts mobile concernés (admin en particulier, cité explicitement par l'utilisateur), vérifier `useSafeAreaInsets`/`SafeAreaView` bottom.

**Step 1:** Identifier l'écran admin mobile où la nav est partiellement masquée (capture/repro à obtenir si pas déjà visible dans le code).
**Step 2:** Corriger padding/safe-area bottom, contraste, hauteur tap targets.
**Step 3:** Vérifier sur plusieurs tailles d'écran si possible (au minimum : device de test réel de l'utilisateur).
**Step 4:** Commit.

### Task 3.4 — Suppression de compte dans Paramètres (mobile)

**Files:** écran Paramètres mobile (à créer/étendre selon Task 3.1), Edge Function `delete-account` déjà existante (self-service RGPD, utilisée côté web — réutiliser telle quelle, ne pas dupliquer la logique).

**Step 1:** Ajouter "Supprimer mon compte" dans Paramètres → Compte, section secondaire (pas un bouton principal).
**Step 2:** Écran d'avertissement + confirmation (reprendre le texte/flow déjà en place côté web si existant).
**Step 3:** Appel à la même Edge Function `delete-account` que le web (pas de nouvelle logique métier) + déconnexion locale.
**Step 4:** Vérifier : le compte supprimé depuis mobile a bien le même comportement (verrouillage immédiat + effacement 30 jours) que depuis le web.
**Step 5:** Commit.

---

## Règle de vérification transversale (rappel section 16 du cahier des charges)

Pour toute tâche touchant RDV / disponibilités / comptes / documents / photos / messages / statuts / notifications : tester **Action sur Mobile → vérifier sur Web** et **Action sur Web → vérifier sur Mobile**, pas seulement le sens mobile.
