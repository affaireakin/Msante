-- Rend éditable (depuis Contenu du site → Page d'accueil) le texte des
-- sections de la landing page publique (Hero, Fonctionnalités, Proposition
-- de valeur, CTA final, Bandeau partenaires) — jusqu'ici codé en dur dans
-- apps/web/app/page.tsx. La mise en page/icônes/couleurs restent fixes,
-- seul le texte devient éditable. Seedé avec le texte actuel pour qu'aucun
-- changement visuel n'ait lieu tant qu'un admin ne modifie rien.
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS homepage_content JSONB;

UPDATE public.site_settings SET homepage_content = '{
  "hero": {
    "badge": "NOUVEAU · INNOVATION BIEN-ÊTRE",
    "titleMain": "Votre sanctuaire de santé mentale,",
    "titleHighlight": "réinventé.",
    "subtitle": "Une approche holistique propulsée par l''intelligence artificielle pour des soins personnalisés et accessibles. Redécouvrez l''équilibre intérieur avec M-Santé.",
    "ctaPrimary": "Commencer mon parcours",
    "ctaSecondary": "Découvrir nos praticiens",
    "statBadgeValue": "98%",
    "statBadgeLabel": "de confiance renouvelée."
  },
  "features": [
    { "title": "Compagnon Bien-être IA", "desc": "Un assistant émotionnel intelligent disponible 24/7 pour vous écouter, analyser vos humeurs et proposer des exercices adaptés." },
    { "title": "Réseau d''Experts", "desc": "Accédez à un panel de psychologues, psychiatres et coachs de vie certifiés, sélectionnés pour leur excellence." },
    { "title": "Téléconsultation Sécurisée", "desc": "Des sessions vidéo chiffrées de bout en bout pour garantir une confidentialité totale. Consultez depuis chez vous." },
    { "title": "Consultation en présentiel", "desc": "Rencontrez votre praticien dans son cabinet ou à domicile. Une présence humaine quand vous en avez besoin." }
  ],
  "valueProposition": {
    "heading": "Le Futurisme Médical : L''IA au service de l''empathie.",
    "items": [
      { "title": "Précision Clinique", "desc": "Algorithmes de diagnostic préventif basés sur des protocoles médicaux internationaux validés." },
      { "title": "Sérénité Humaine", "desc": "Interfaces minimalistes et apaisantes conçues pour réduire l''anxiété et favoriser la guérison mentale." },
      { "title": "Écosystème Connecté", "desc": "Synchronisation transparente entre vos appareils, vos praticiens et votre historique de santé." }
    ],
    "videoLabel": "Découvrez notre vision (2:45)",
    "stat1Value": "500+",
    "stat1Label": "Praticiens Certifiés",
    "stat2Value": "24/7",
    "stat2Label": "Support IA Illimité"
  },
  "ctaFinal": {
    "heading": "Prêt à transformer votre rapport à la santé mentale ?",
    "subtitle": "Rejoignez des milliers de personnes qui ont choisi une approche moderne et bienveillante pour leur bien-être.",
    "ctaPrimary": "Commencer maintenant",
    "ctaSecondary": "Consulter les tarifs",
    "disclaimer": "Essai gratuit de 7 jours sur le Compagnon IA. Sans engagement."
  },
  "trustBar": {
    "label": "NOS PARTENAIRES DE CONFIANCE",
    "partners": [
      { "label": "Wave" },
      { "label": "Orange Money" },
      { "label": "Santevie" }
    ]
  }
}'::jsonb
WHERE id = 1 AND homepage_content IS NULL;
