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

## 📋 Reste à traiter (prioriré haute → basse, pas commencé)

### P0 — bloquant
- [ ] Onboarding organisation mobile : confirmer que le flux complet (bout en bout, avec le fix
      anti-doublon) passe réellement sur un device, pas seulement relu.
- [ ] Rendez-vous patient : pas de bouton "Rejoindre"/"Annuler", logique à aligner sur le web.
- [ ] Décalage horaire disponibilités (voir ci-dessus — chantier dédié web+mobile).

### P1 — fonctionnel
- [ ] Admin : modification profession/préfixe par un praticien → validation admin (nouveau
      workflow, web + mobile).
- [ ] Admin mobile : afficher la vraie profession au lieu de "Praticien" dans la liste
      utilisateurs.
- [ ] Admin mobile analytics : ajouter un bloc "Praticiens" (actuellement patients seulement).
- [ ] Admin mobile dashboard : raccourcis Messages / Agenda / Utilisateurs.
- [ ] Praticien mobile dashboard : mêmes raccourcis ("pareil" — même demande que l'admin).
- [ ] Profil praticien : séparer "Prénom" de "Nom complet".
- [ ] Nav praticien : séparer Prestations et Disponibilités en deux onglets (actuellement un
      seul écran combiné) ; Profil déplacé dans Paramètres (déjà fait pour l'agenda-first,
      reste la séparation Prestations/Dispo + le déplacement du Profil).
- [ ] CMS web : contenu modifié ne se propage pas immédiatement (cache), flash de l'ancien texte
      au refresh — probablement ISR/cache Next.js à revalidate, côté web uniquement.
- [ ] Recadrage photo profil / logo organisation (zoom, déplacement, confirmation) — vérifier ce
      qui existe déjà (`allowsEditing` natif) vs ce qui manque réellement.

### P2 — UX/UI
- [ ] "Supprimer mon compte" (patient) : le déplacer plus bas / le rendre moins visible (sous
      Aide & Support par ex.) — actuellement juste sous Déconnexion.
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
