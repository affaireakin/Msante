# Analytics Avancés + PayDunya Unifié + Mounima Vocale — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Livrer 4 features : (1) paiement unifié via PayDunya checkout (Wave/OM/Carte), (2) analytics praticien web (revenus + agenda + patients), (3) analytics patient mobile (mood 30j + engagement + corrélation), (4) renommer Ami → Mounima + session vocale immersive STT/LLM/TTS.

**Architecture:** Calculs analytics côté client via TanStack Query sur données Supabase existantes. PayDunya checkout URL ouverte en WebView. Mounima vocale via Edge Function `mounima-voice` (Whisper + Claude Haiku + ElevenLabs). Reanimated 3 pour les animations.

**Tech Stack:** React Native + Expo Router, Next.js 15, TanStack Query v5, Recharts (web), Reanimated 3, Expo AV, Supabase Edge Functions (Deno), Whisper API, Claude Haiku API, ElevenLabs TTS API.

---

## Section 1 — PayDunya Unifié (VISA/MC + Wave + Orange Money)

### Contexte
PayDunya est le gateway qui gère nativement Wave, Orange Money ET les cartes bancaires (VISA/MC) via une seule invoice checkout. Le `process-payment` edge function crée déjà des invoices PayDunya et retourne un `checkoutUrl`. Le `PaymentSheet` mobile affiche actuellement Wave/OM séparément.

### Design

**`PaymentSheet` (mobile)** — 3 options :
- Wave (champ téléphone pré-rempli)
- Orange Money (champ téléphone pré-rempli)
- Carte bancaire (pas de champ, PayDunya gère le formulaire)

Toutes les 3 appellent `process-payment` → reçoivent `checkoutUrl` → ouvrent `Linking.openURL()` ou `expo-web-browser` sur le checkout PayDunya. PayDunya affiche le formulaire adapté (mobile money ou saisie carte VISA/MC).

**`process-payment` edge function** — aucun changement nécessaire. L'invoice PayDunya créée donne déjà accès à toutes les méthodes de paiement sur la page checkout.

**`PaymentSheet` modifications :**
- Ajouter option `card` dans `PaymentProvider`
- Supprimer la contrainte "téléphone obligatoire" pour l'option carte
- Après création invoice → `WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl)`

---

## Section 2 — Analytics Praticien (Web)

### Nouvelle page : `apps/web/app/practitioner/analytics/page.tsx`

**Bloc 1 — Revenus** (données : `payments` filtrées par `practitioner_id` + status=completed)
- KPIs : CA ce mois (XOF), CA mois précédent, croissance %, revenu moyen/séance
- `AreaChart` Recharts : revenus mensuels sur 6 mois
- `PieChart` ou barres : répartition par type de séance (vidéo/audio/présentiel)

**Bloc 2 — Agenda** (données : `appointments` + `availabilities`)
- Taux d'occupation : `booked_slots / total_available_slots` ce mois (%)
- Taux de no-show : `count(no_show) / count(confirmed+completed+no_show)`
- Taux de rebooking : `count(patients avec ≥2 RDV) / count(patients uniques)`
- Barres horizontales colorées pour chaque métrique

**Bloc 3 — Patients** (données : `appointments`)
- Top 5 patients par nombre de séances (liste avec avatar initiales)
- Nouveaux patients ce mois vs récurrents (badge coloré)

**Navigation :** Ajouter lien "Analytics" dans `apps/web/app/practitioner/layout.tsx`

---

## Section 3 — Analytics Patient (Mobile)

### Nouvelle page : `apps/mobile/app/(patient)/mental-health/mood-analytics.tsx`

**Bloc 1 — Mood 30 jours** (données : `mood_entries`)
- Graphe ligne SVG natif 30 jours (zone colorée : rouge < 4, jaune 4-6, vert > 6)
- KPIs : score moyen, meilleur streak, tendance vs mois précédent (+/- pts)
- Top 3 émotions fréquentes (chips colorées avec compteur)

**Bloc 2 — Engagement bien-être** (données : `mood_entries` + `journal_entries` + meditation sessions)
- Séances méditation complétées ce mois (compteur + barre de progression vs objectif 8/mois)
- Entrées journal cette semaine vs semaine précédente
- Heatmap dots 30 jours : chaque jour = dot coloré selon activité (gris=rien, bleu pâle=1 action, bleu=2+)

**Bloc 3 — Corrélation mood/méditation**
- Calcul : moyenne mood les jours avec méditation vs jours sans
- Affichage : "Les jours où tu médites, ton humeur est en moyenne **+X.X pts** plus haute"
- Seuil : affiché seulement si ≥ 5 séances enregistrées, sinon "Continue pour voir ta corrélation"

**Accès :** Bouton "Voir mes statistiques" dans `mental-health/index.tsx`

---

## Section 4 — Mounima (Renommage + Session Vocale Immersive)

### Renommage Ami → Mounima
- `apps/mobile/app/(patient)/mental-health/ami/` → `mounima/`
- Tous les labels, titres, Edge Functions et références `ami`/`Ami` → `mounima`/`Mounima`
- Mise à jour du `_layout.tsx` mental-health et du tab navigator

### Architecture vocale

```
[Expo AV — enregistrement audio] 
    → base64 chunks
    → [Edge Function: mounima-voice]
        → Whisper API (STT, fr)          → transcript
        → Claude Haiku (response + JSON sentiment: {score, stress, emotion})
        → ElevenLabs TTS (voix fr, voice_id configurable)
        → { audioUrl, transcript, sentiment }
    → [Expo AV — lecture réponse]
    → [Reanimated 3 — animation onde]
```

### Écran session vocale : `mounima/voice.tsx`
- Fond sombre avec onde animée centrale (Reanimated 3, pulse pendant écoute/parole)
- Indicateurs flottants temps réel :
  - Stress Level (jauge 0-100%)
  - Sentiment (positif/neutre/négatif badge)
  - État émotionnel (icône + label)
- Bouton micro central : press = start recording, release = send
- Header : durée session + bouton END SESSION
- Garde-fou : si `sentiment.score < 2` pendant 2 échanges → banner rouge "Parler à un praticien" + SOS

### Écran insights post-session : `mounima/voice-insights.tsx`
- Résumé : durée, nombre d'échanges, score émotionnel global
- Graphe tension émotionnelle (SVG natif, 1 point par échange)
- 3 suggestions coping générées par Claude Haiku à la fin de session
- CTA : "Enregistrer dans le journal" (crée une entrée `journal_entries` avec transcript résumé)
- CTA : "Réserver une séance" → navigate to find-practitioners

### Edge Function : `supabase/functions/mounima-voice/index.ts`
- Input : `{ audio_base64: string, conversation_history: Message[], session_id: string }`
- Whisper → transcript
- Claude Haiku → `{ response: string, sentiment: { score: number, stress: number, emotion: string } }`
- ElevenLabs → audio MP3 → upload Supabase Storage → signed URL (1h)
- Output : `{ transcript, response, sentiment, audio_url }`
- Garde-fous : system prompt strict, détection détresse → flag `crisis: true` dans réponse

### Système prompt Mounima
```
Tu es Mounima, l'assistante bien-être de M-Santé. Tu parles français.
Tu n'es PAS un médecin ou thérapeute. Tu offres écoute et soutien émotionnel.
Si l'utilisateur exprime une détresse sévère ou des pensées suicidaires,
indique IMMÉDIATEMENT qu'il doit contacter un professionnel ou le SOS Amitié (+221 33 823 8020).
Ne diagnostique JAMAIS. Ne prescris JAMAIS.
Réponds de façon chaleureuse, concise (2-3 phrases max pour TTS).
Retourne AUSSI un JSON sentiment: {"score": 1-10, "stress": 0-100, "emotion": "string"}.
```

---

## Garde-fous cliniques (CLAUDE.md obligatoires)

- Jamais de diagnostic ou prescription par Mounima
- Redirection automatique si détresse sévère (score < 2 ou keyword detection)
- Disclaimer permanent visible : "Mounima n'est pas un médecin ou thérapeute"
- Ligne SOS visible dans l'écran session et post-session

---

## Fichiers touchés

| Fichier | Action |
|---------|--------|
| `apps/mobile/features/booking/components/PaymentSheet.tsx` | Modifier — ajouter option card |
| `apps/mobile/types/booking.ts` | Modifier — ajouter `card` à `PaymentProvider` |
| `apps/web/app/practitioner/analytics/page.tsx` | Créer |
| `apps/web/app/practitioner/layout.tsx` | Modifier — ajouter lien Analytics |
| `apps/mobile/app/(patient)/mental-health/mood-analytics.tsx` | Créer |
| `apps/mobile/app/(patient)/mental-health/index.tsx` | Modifier — lien vers mood-analytics |
| `apps/mobile/app/(patient)/mental-health/ami/` | Renommer → `mounima/` |
| `apps/mobile/app/(patient)/mental-health/mounima/voice.tsx` | Créer |
| `apps/mobile/app/(patient)/mental-health/mounima/voice-insights.tsx` | Créer |
| `supabase/functions/mounima-voice/index.ts` | Créer |
| Toutes refs `ami`/`Ami` dans le code | Renommer → `mounima`/`Mounima` |
