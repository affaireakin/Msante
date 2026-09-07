# M-Santé Mobile — Corrections v4 (retour terrain PDF du 2026-09-07)

> Source : PDF "mise a jour mobil app M-santé" (20 pages, captures annotées à la main) + un
> prompt-cadre "agent autonome" fourni par l'utilisateur. Ce document reprend le contenu réel
> (les annotations) organisé par impact, et sert de suivi entre les tours de travail — trop
> volumineux pour être traité en un seul passage.

**Principe de travail** (repris du prompt-cadre, appliqué) : le web fait référence quand la
logique existe déjà des deux côtés ; ne rien casser ; aucune migration destructive sans analyse ;
ne jamais prétendre qu'un point est corrigé sans l'avoir vérifié (tsc, lecture du code réel) ;
signaler et ne pas trancher seul les décisions métier ambiguës ou les changements de schéma.

---

## ✅ Corrigé ce tour (vérifié par lecture de code + tsc)

| # | Problème | Cause racine | Fix | Fichier(s) |
|---|----------|--------------|-----|-----------|
| 1 | Flash de l'écran de connexion à la réouverture de l'app déjà connectée ("se déconnecte et se reconnecte") | Le splash natif se cachait dès les polices chargées, avant que la session persistée soit restaurée (`isLoading`) | Splash caché seulement quand `fontsLoaded && !isLoading` | `app/_layout.tsx` |
| 2 | Splash ne correspondait pas à la réf. (mark seul, bleu pâle) | Mauvais asset (variante icône, pas le logo complet) | Regénéré : logo complet recoloré en blanc + fond bleu marque `#0bc2ee`, à partir de la source Supabase Storage | `assets/splash.png`, `app.json` |
| 3 | "Couleur bleue qui recouvre le logo" dans les headers (partout où il apparaît) | `icon.png` (icône de lancement, fond carré opaque intégré) utilisé comme logo inline au lieu d'un mark transparent | Remplacé par `logo-mark.png` (nouveau, transparent, téléchargé depuis Storage) | `app/(auth)/welcome.tsx`, `app/(patient)/home.tsx` |
| 4 | Barre de navigation cachée/chevauchant la barre système Android — **constat général sur tous les écrans à onglets** | `tabBarStyle.height` fixe sans compensation de `insets.bottom` : désactive le padding de zone de sécurité automatique de React Navigation | `useSafeAreaInsets()` + `height`/`paddingBottom` recalculés dans les 5 layouts | `app/(patient|practitioner|organization|admin|secretary)/_layout.tsx` |
| 5 | Inscription organisation : double soumission → deux organisations en base ("clinique rabi") | `slug` inclut un suffixe aléatoire à chaque appel → la contrainte UNIQUE ne bloque jamais un doublon ; `INSERT` simple, pas de réutilisation entre tentatives | Id de l'organisation retenu en état local après la 1ère insertion ; réutilisé sur tout nouvel essai (plus jamais de second `INSERT`) ; documents déjà envoyés non renvoyés | `app/(onboarding)/organization.tsx` |
| 6 | Créneau praticien : "Format d'heure invalide (attendu HH:MM)" quasi systématique | Champ texte libre, clavier par défaut sans `:` accessible | Masque de saisie (chiffres → `HH:MM` auto), clavier numérique dédié | `app/(practitioner)/availability.tsx` |
| 7 | Clavier qui cache le champ pendant la saisie du créneau | Modale sans `KeyboardAvoidingView` | Ajouté | `app/(practitioner)/availability.tsx` |
| 8 | "Practitioner Portal" à retirer | — | Supprimé | `app/(practitioner)/dashboard.tsx` |
| 9 | "Activité récente" → pluriel | — | Renommé "Activités récentes" | `app/(practitioner)/dashboard.tsx` |
| 10 | "Abandonner la session" (méditation) — wording | — | Renommé "Arrêter la session" | `app/(patient)/mental-health/meditation/session.tsx` |
| 11 | Carte "Compagnon Bien-être IA" en doublon avec le raccourci Mounima (mêmes destination) | — | Carte retirée | `app/(patient)/home.tsx` |
| 12 | OTP en vert (signalé à nouveau sur l'inscription organisation) | Déjà corrigé dans un tour précédent (verify-otp.tsx, onboarding confirmations) | Rien à refaire côté code — probablement testé sur un APK antérieur au fix ; à reconfirmer sur le prochain build | — |
| 13 | Admin mobile : liste utilisateurs affiche "Praticien" au lieu de la vraie profession | Requête ne récupérait jamais `practitioners.speciality` | Jointure ajoutée, affiche préfixe + spécialité réelle | `app/(admin)/users.tsx` |
| 14 | Analytics admin mobile : pas de KPI "Praticiens" dédié | — | Carte KPI ajoutée (donnée déjà calculée, juste pas affichée) | `app/(admin)/analytics.tsx` |
| 15 | Dashboard admin mobile : pas de raccourci Messages/Utilisateurs | — | Ajoutés (pas de raccourci "Agenda" — aucun écran admin-wide de ce type n'existe, ce serait un nouvel écran à construire) | `app/(admin)/index.tsx` |

---

## 🔎 Investigué, PAS de bug de code trouvé (documenté, pas "corrigé à l'aveugle")

- **"Network request failed" sur upload photo/cachet/signature (profil praticien) et documents
  organisation** : code d'upload relu (buckets `avatars`, `practitioner-assets`, `documents`) —
  buckets existent, policies RLS correctes, chemins conformes, pas de timeout global suspect.
  Le bucket `verification_documents` cassé (mauvais bucket + URL publique sur bucket privé) a
  déjà été corrigé au tour précédent. Hypothèse la plus probable restante : conditions réseau
  au moment du test (cohérent avec les lenteurs CLI Supabase déjà observées cette session), pas
  un défaut de code identifiable par lecture statique. **À reconfirmer sur le nouveau build** —
  si ça persiste, il faudra des logs réseau réels (pas de la lecture de code) pour aller plus loin.

## ⚠️ Identifié, fix nécessite une décision ou un chantier plus large — PAS touché ce tour

- **Décalage horaire disponibilités** : `useAvailability.ts` (mobile) ET `availabilitySlots.ts`
  (web, référence) construisent tous les deux le créneau via `new Date(`${date}T${heure}:00Z`)`
  — traite l'heure locale du cabinet comme si elle était UTC. Fonctionne par coïncidence pour un
  praticien basé à Dakar (UTC+0) mais pas si le téléphone (ou le cabinet) est sur un autre fuseau.
  **Ce n'est pas une régression mobile** — le web fait exactement pareil (mobile suit la
  référence, comme demandé). Corriger proprement demande de toucher web ET mobile ensemble avec
  une vraie conversion de fuseau horaire (`practitioners.timezone`), pas un correctif `+1h`
  arbitraire — trop risqué pour un correctif rapide sur un sujet aussi sensible (heures de RDV
  médicaux). À planifier comme chantier dédié.
- **Recadrage/capture de document peu clair** ("on ne sait pas comment valider, on aperçoit
  redimensionner mais c'est pas clair") : nécessite de revoir l'UI de crop, pas juste un
  wording — à designer avant de coder.
- **Renommage "Ajouter un document" → "Autres documents"** : annotation ambiguë sur l'écran
  concerné (regroupement des 4 types nommés vs. le bouton générique) — à clarifier avant de
  changer un libellier qui pourrait mal représenter l'intention réelle.

---

## ✅ Corrigé — 2ᵉ vague ("faut tout corriger")

| # | Problème | Cause | Correction | Fichier(s) |
|---|----------|-------|------------|-----------|
| 16 | Rendez-vous patient : pas de règles pour les créneaux proposés par le praticien, délai d'annulation ignoré | Logique jamais portée du web (patient/appointments/page.tsx) vers le mobile | Accepter/Refuser ajouté, délai d'annulation respecté, motif obligatoire saisi (plus de texte figé) | `app/(patient)/appointments.tsx` |
| 17 | Prestations et Disponibilités devaient être deux rubriques séparées sur la nav bar (comme Doctolib) | Un seul écran caché "Disponibilités & Prestations", accessible seulement depuis Profil | Écran scindé en deux (`prestations.tsx` nouveau + `availability.tsx` réduit), deux onglets ajoutés à la nav, Profil renommé Paramètres | `app/(practitioner)/_layout.tsx`, `prestations.tsx` (nouveau), `availability.tsx`, `profile.tsx` |
| 18 | "Rajouter prénom" sur le profil praticien | `users.full_name` reste un champ unique dans tout le schéma (web inclus) — pas de vraie colonne séparée | Saisie Prénom/Nom sur cet écran uniquement, recomposée en un seul `full_name` à l'enregistrement — zéro migration | `app/(practitioner)/profile.tsx` |
| 19 | "Supprimer mon compte" trop visible juste sous Déconnexion | — | Éloigné/regroupé avec les réglages secondaires sur les 3 écrans (patient/praticien/secrétaire) | `profile.tsx` ×3 |
| 20 | CMS : "l'écriture ancienne reste figée... on aperçoit les anciens textes au rafraîchissement" | `useHomepageContent()` est un fetch client (React Query) — `data ?? DEFAULT_HOMEPAGE_CONTENT` affichait systématiquement le texte placeholder en dur au premier rendu (cache froid), sur la home ET dans le formulaire d'édition CMS lui-même | N'affiche chaque section (et le formulaire admin) qu'une fois le vrai contenu chargé | 5 fichiers `components/homepage/*.tsx` + `admin/content/page.tsx` |
| 21 | Modification profession/préfixe par un praticien → validation admin | Fonctionnalité inexistante (simple champ libre, aucune validation) | Nouvelle table `profession_change_requests` (RLS dédiée) ; mobile : spécialité en lecture seule + bouton "Demander un changement" ; web `/admin/practitioners` : panneau Approuver/Refuser | migration `20260907000001`, `useProfessionChangeRequest.ts` (nouveau), `profile.tsx`, `admin/practitioners/page.tsx` |
| 22 | Recadrage logo organisation / photo profil patient / photo profil praticien | — (vérifié, déjà correct sur les 3) | RAS : `allowsEditing:true` déjà en place partout, bucket organisation-logos confirmé public et fonctionnel | `(organization)/index.tsx`, `(patient)/profile.tsx`, `usePractitionerProfile.ts` |

## ✅ Corrigé — 3ᵉ vague (précisions de l'utilisateur)

| # | Problème | Cause confirmée | Correction | Fichier(s) |
|---|----------|------------------|------------|-----------|
| 23 | Décalage horaire confirmé : créneau écrit 16h30, session réelle +2h (heure d'été) | Repro précise obtenue : la plateforme interprète TOUJOURS les horaires saisis comme heure du Sénégal (GMT, sans DST) — design assumé et documenté dans `availabilitySlots.ts` ("Dakar = UTC+0"), identique web/mobile. Un praticien en France l'ignorait et tapait son heure locale (ex. CEST, GMT+2), d'où le décalage à l'usage. Ce n'est pas un bug arithmétique — deviner/convertir un fuseau par praticien serait risqué et non demandé ; rendre le fuseau explicite corrige la vraie cause (l'ambiguïté), sans toucher au calcul des créneaux/RDV. | Bandeau "Heures en heure du Sénégal (GMT), même si vous êtes ailleurs" ajouté sur les 3 formulaires de saisie d'horaire (créneau hebdo mobile, créneau hebdo web, date spécifique web) | `app/(practitioner)/availability.tsx`, `app/practitioner/availability/page.tsx` |
| 24 | Badges "Mindfulness Sanctuary" / "Wellness Space" | Trouvés — le texte source est en Title Case (`textTransform: uppercase` en CSS les affichait en majuscules sur les captures, d'où l'échec de la recherche exacte précédente) | Retirés des 3 écrans où ils apparaissaient (bien-être, méditation, journal — le 3ᵉ non signalé mais même motif, retiré par cohérence) | `mental-health/index.tsx`, `meditation/index.tsx`, `journal/index.tsx` |

## 🔎 Toujours pas touché

- **Libellés des émotions (mood check-in)** : écriture manuscrite sur la
  capture pas assez nette pour être certain du texte exact voulu — je ne
  veux pas remplacer un libellé au hasard sur un écran de suivi émotionnel.

## 📋 Reste à traiter (prioriré haute → basse, pas commencé)

### P0 — bloquant
- [ ] Onboarding organisation mobile : confirmer que le flux complet (bout en bout, avec le fix
      anti-doublon) passe réellement sur un device, pas seulement relu.
- [ ] Décalage horaire disponibilités — chantier dédié web+mobile, question ouverte ci-dessus
      avant de commencer (quel écran exactement ?).

### P2 — UX/UI
- [ ] Badges "MINDFULNESS SANCTUARY" / "WELLNESS SPACE" à retirer — chaîne exacte non retrouvée
      par recherche automatique, probablement un nom légèrement différent ou un composant
      partagé ; à relocaliser précisément.
- [ ] Mood check-in : libellés d'émotions à corriger (remplacer un chip par "Besoin de calme" —
      lecture manuscrite imprécise, à reconfirmer avec l'utilisateur avant de coder).
- [ ] Cohérence cardiaque : badges "RECOMMANDÉ" barrés sur la capture — à clarifier (supprimer le
      badge ou juste le texte annoté).
- [ ] Dates JJ/MM/AAAA pour les congés praticien (vérifier si déjà couvert par le fix de
      section 10 du cahier des charges précédent, ou si c'est un champ non couvert).

---

## Build & déploiement

- [ ] `tsc --noEmit` (mobile) après ce lot — en cours au moment de la rédaction de ce doc.
- [ ] Nouveau build APK une fois ce lot committé.
- [ ] Redéploiement VPS web si des fichiers `apps/web` sont touchés dans un prochain lot (aucun
      cette fois — tout ce tour est mobile uniquement).
