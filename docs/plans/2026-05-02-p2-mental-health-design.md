# P2 M-Santé — Mental Health Design
**Mood Tracker · Journal Émotionnel · Méditation · Assistant IA Ami**
Date: 2026-05-02

---

## Contexte

P1 (booking + payment) est livré et testé (9/9 tests). P2 ajoute le cœur bien-être de M-Santé :
- Mood tracker quotidien avec suivi 7 jours
- Journal émotionnel privé avec analyse IA (Claude)
- Méditation guidée avec breathing animations (timer visuel uniquement)
- Assistant Ami — companion conversationnel Claude Haiku, limites cliniques strictes

---

## Architecture retenue : Module `mental-health/` monolithique

```
features/mental-health/
├── store/
│   ├── moodStore.ts           # Zustand: entrées locales + sync status
│   ├── journalStore.ts        # Zustand: brouillons offline
│   └── offlineQueue.ts        # AsyncStorage → Supabase sync via NetInfo
├── mood/
│   ├── hooks/useMoodEntries.ts
│   ├── components/MoodSlider.tsx
│   └── components/EmotionPicker.tsx
├── journal/
│   ├── hooks/useJournalEntries.ts
│   ├── hooks/useJournalAnalysis.ts   # Edge Function → Claude API
│   └── components/JournalCard.tsx
├── meditation/
│   ├── hooks/useMeditationTimer.ts   # Reanimated loop
│   └── components/BreathingRing.tsx
└── ai-companion/
    ├── hooks/useAmiFriend.ts          # Claude Haiku streaming
    ├── components/ChatBubble.tsx
    ├── components/ActionCards.tsx
    └── constants/systemPrompt.ts     # Garde-fous cliniques
```

**Offline** : AsyncStorage pour mood + journal (append-only, pas de conflit). NetInfo listener déclenche la sync au retour en ligne.

---

## Screens

```
app/(patient)/mental-health/
├── index.tsx            # Wellness Hub — bento grid
├── mood-checkin.tsx     # Slider + EmotionPicker + note
├── mood-history.tsx     # Graphe 7 jours (barres Reanimated)
├── meditation/
│   ├── index.tsx        # Catalogue séances
│   └── session.tsx      # Session active: BreathingRing + timer
├── journal/
│   ├── index.tsx        # Liste entrées + FAB
│   ├── new.tsx          # Canvas écriture + mood chips + reflection prompts
│   └── [id].tsx         # Détail + AIInsightCard
└── ami/
    └── index.tsx        # Chat Ami: orb + bulles + action cards
```

**Bottom nav (5 onglets)** : HOME · ASSISTANT · ACTIVITIES · PROVIDERS · SUPPORT
- ACTIVITIES → `/mental-health/` (Wellness Hub)
- ASSISTANT → `/mental-health/ami/`

---

## UX — Écrans source (Design System réel)

### Wellness Hub (`mental-health/index.tsx`)
Source: `wellness_space_1/code.html`

- Ambient blobs: 2 `fixed` circles (primary-fixed/40 blur-[100px] top-left + surface-variant/60 blur-[80px] bottom-right)
- Bento grid (mobile: 1 col, tablet: 12 cols):
  - **Breathing module** : grande card `glass-panel rounded-[32px]` avec `BreathingRing` animé + bouton "Begin Session"
  - **Mood Tracker** : barres 7 jours (`primary-container/30`→`primary` pour aujourd'hui) + Mood Insight card
  - **Quick Journal** : card textarea + bouton SAVE ENTRY
- Bottom nav `bg-white/60 backdrop-blur-2xl border-t border-white/30 rounded-t-3xl`

### Journal (`journal/new.tsx`)
Source: `emotional_journal_entry/code.html`

- Mood chips row : `rounded-full bg-surface-container/50 border border-white/80` — actif: `bg-primary-container/40 border-primary/20`
- Canvas: `bg-white/60 backdrop-blur-2xl border border-white/50 rounded-3xl` avec input titre (`border-b-2 border-transparent focus:border-primary-container`) + textarea
- Auto-save indicator: `cloud_done` icon + "Saved just now"
- Sidebar (desktop/tablet): "Guided Reflection" prompts + "Recent Logs" history
- FAB: `fixed bottom-8 right-8 w-14 h-14 bg-primary rounded-full`

### Assistant Ami (`ami/index.tsx`)
Source: `ai_wellness_companion_mobile/code.html`

- Orb central: `w-32 h-32 rounded-full orb-glow` (box-shadow primary-container glow) + icône `graphic_eq`
- Heading: "How are you feeling today?" + "I'm listening..."
- Bulles user: `self-end glass-panel rounded-2xl rounded-tr-none bg-surface-container-low/80`
- Bulles Ami: `self-start glass-panel rounded-2xl rounded-tl-none border-l-4 border-l-primary-container` + label "M-Santé Assistant"
- Action cards (horizontal scroll): Breathing (primary) / Specialist (outline) / Crisis (error-container/10 border)
- Voice control bar: `bg-surface-container-high/90 backdrop-blur-md rounded-full` + bouton mic primary

### Méditation (`meditation/session.tsx`)
Source: `wellness_space_1/code.html` (breathing section)

- BreathingRing: 3 cercles concentriques (outer `breathing-circle` animation, middle blur, inner solid primary)
- Animation CSS: `breathe` keyframe scale 0.85→1.1, 8s cubic-bezier(0.4,0,0.2,1)
- Phase label: "Inspirez / Retenez / Expirez" avec fade
- Timer circulaire + bouton "Begin Session" / "End Session"

---

## Data Flow

### Mood Tracker
```
MoodCheckin → moodStore.addLocal() → AsyncStorage
            → si online: Supabase mood_entries INSERT
            → si score < 3: toast → "Parler à un praticien ?"
```

### Journal + Analyse IA
```
JournalNew  → journalStore.saveDraft() → AsyncStorage
            → submit → Supabase journal_entries INSERT
            → useJournalAnalysis() → Edge Function ami-analysis
            → Claude Haiku: { sentiment, themes[], suggestion }
            → AIInsightCard affiché sous l'entrée
```

### Assistant Ami
```
Message user → Edge Function ami-chat
             → Anthropic claude-haiku-4-5-20251001, max_tokens: 512
             → stream response → ChatBubble
             → détection détresse sévère → CrisisCard (error theme)
             → si mention praticien → ActionCard "Book Now"
```

---

## Garde-fous cliniques (non négociables)

```typescript
// features/mental-health/ai-companion/constants/systemPrompt.ts
export const AMI_SYSTEM_PROMPT = `
Tu es Ami, l'assistant bien-être de M-Santé.
Tu n'es PAS un médecin, thérapeute, ou professionnel de santé.
Tu offres un espace d'écoute bienveillant et de soutien émotionnel.

RÈGLES ABSOLUES :
- Ne diagnostique JAMAIS une condition médicale ou psychiatrique
- Ne prescris JAMAIS de traitement, médicament, ou thérapie
- Ne promets JAMAIS de guérison ou d'amélioration garantie
- Si l'utilisateur exprime une détresse sévère, des pensées suicidaires,
  ou une urgence : dirige-le IMMÉDIATEMENT vers SOS Amitié Sénégal
  (+221 33 823 8020) et propose de trouver un praticien M-Santé
- Termine chaque conversation par : "Cet espace ne remplace pas
  un professionnel de santé."

Langue : français. Ton : chaleureux, empathique, non-clinique.
`
```

---

## Edge Functions

| Fonction | Input | Output |
|----------|-------|--------|
| `ami-chat` | `{ messages: Message[], userId }` | Stream SSE Claude Haiku |
| `ami-analysis` | `{ content: string, moodScore: number }` | `{ sentiment, themes[], suggestion }` |

---

## Composants clés

| Composant | Style source |
|-----------|-------------|
| `BreathingRing` | 3 cercles, animation `breathe` 8s |
| `MoodSlider` | Score 1-10, gradient vert→rouge |
| `EmotionPicker` | Chips `rounded-full`, icônes Material |
| `JournalCanvas` | `rounded-3xl bg-white/60 backdrop-blur-2xl` |
| `AIInsightCard` | Icône sparkle, résumé Claude, disclaimer |
| `ChatBubble` | Variante user/ami, glass-panel |
| `ActionCards` | Scroll horizontal, 3 cards (Breathing/Specialist/Crisis) |
| `CrisisCard` | `bg-error-container/10 border-error-container` |
| `MoodBarChart` | 7 barres Reanimated, `primary-container/30` → `primary` |

---

## Tests

- `moodStore`: addLocal, sync, score < 3 trigger
- `journalStore`: saveDraft, submit, offline queue
- `useMeditationTimer`: phases cycliques, completion callback
- `useAmiFriend`: message envoyé, réponse reçue, détection détresse
- `ami-chat` Edge Function: JWT validation, prompt injection guard

---

## Limites cliniques — récapitulatif

```
❌ Diagnostic autonome IA
❌ Prescription ou recommandation médicale
❌ Promesse de guérison
✅ Redirection praticien si score < 3
✅ CrisisCard si détresse sévère détectée
✅ Disclaimer visible sur chaque écran Ami
✅ SOS Amitié Sénégal +221 33 823 8020 accessible
```
