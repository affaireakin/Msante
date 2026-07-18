-- CMS pour le "Responsable contenu" (section 9) : réglages généraux du site
-- (logo, téléphone, réseaux sociaux), CGU, FAQ — le tout éditable sans
-- développeur et affiché dynamiquement sur les pages publiques.

CREATE TABLE public.site_settings (
  id              INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- singleton
  logo_url        TEXT,
  phone           TEXT,
  whatsapp_number TEXT,
  contact_email   TEXT,
  facebook_url    TEXT,
  instagram_url   TEXT,
  twitter_url     TEXT,
  linkedin_url    TEXT,
  tiktok_url      TEXT,
  youtube_url     TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      UUID REFERENCES public.users(id)
);
INSERT INTO public.site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.content_pages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.users(id)
);

CREATE TABLE public.faq_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_faq_items_order ON public.faq_items(sort_order);

-- Seed: préserve le contenu CGU existant (jusqu'ici codé en dur dans
-- apps/web/app/cgu/page.tsx) pour qu'il ne disparaisse pas au passage au CMS.
INSERT INTO public.content_pages (slug, title, body) VALUES (
  'cgu', 'Conditions Générales d''Utilisation',
$html$<h2>1. Présentation de la plateforme</h2>
<p>M-Santé est une super-application de santé numérique éditée par AUTOMATISE, permettant la mise en relation entre patients et professionnels de santé ou praticiens bien-être. La plateforme propose notamment la prise de rendez-vous, la téléconsultation, le suivi de l'humeur et du bien-être, ainsi que des outils d'accompagnement psychologique.</p>
<p>M-Santé ne constitue pas un service d'urgence médicale. En cas d'urgence, contactez immédiatement le 15 (SAMU) ou rendez-vous aux urgences les plus proches.</p>
<h2>2. Acceptation des conditions</h2>
<p>En créant un compte sur M-Santé, vous reconnaissez avoir lu, compris et accepté l'intégralité des présentes Conditions Générales d'Utilisation. Si vous n'acceptez pas ces conditions, vous ne pouvez pas utiliser la plateforme.</p>
<h2>3. Comptes utilisateurs</h2>
<p>Deux types de comptes sont disponibles : Patient et Praticien. Chaque utilisateur est responsable de la confidentialité de ses identifiants. Les comptes praticiens font l'objet d'une procédure de vérification avant activation.</p>
<p>Vous vous engagez à fournir des informations exactes, complètes et à jour lors de votre inscription et à les maintenir dans cet état. M-Santé se réserve le droit de suspendre ou supprimer tout compte dont les informations seraient inexactes ou frauduleuses.</p>
<h2>4. Données personnelles et santé</h2>
<p>M-Santé traite des données de santé à caractère sensible (humeur, journal émotionnel, antécédents médicaux). Ces données sont chiffrées au repos, accessibles uniquement par vous-même et, dans le cadre d'une consultation, par le praticien concerné. Elles ne sont jamais transmises à des tiers sans votre consentement explicite.</p>
<p>Conformément au RGPD et aux législations locales applicables, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données. Pour exercer ces droits, contactez-nous à privacy@m-sante.com.</p>
<h2>5. Limites du service de santé mentale</h2>
<p><strong>Avertissement important :</strong></p>
<ul>
<li>M-Santé ne fournit pas de diagnostic médical.</li>
<li>L'assistant IA (Mounima) ne remplace pas un professionnel de santé.</li>
<li>En cas de détresse sévère ou de pensées suicidaires, contactez SOS Amitié (+221 33 823 8020) ou un médecin.</li>
<li>Les outils de bien-être (mood, journal, méditation) sont des outils d'accompagnement, non des traitements médicaux.</li>
</ul>
<h2>6. Paiements</h2>
<p>Les consultations sont payantes selon les tarifs fixés par chaque praticien. Les paiements sont traités via Wave, Orange Money ou carte bancaire. En cas d'annulation dans les conditions prévues, un remboursement peut être accordé selon la politique d'annulation du praticien. M-Santé prélève une commission de 20% sur chaque transaction.</p>
<h2>7. Responsabilités</h2>
<p>M-Santé agit comme intermédiaire technique entre patients et praticiens. La responsabilité médicale incombe exclusivement au praticien diplômé. M-Santé ne peut être tenu responsable des conseils médicaux prodigués lors des consultations ni des résultats de santé obtenus.</p>
<h2>8. Propriété intellectuelle</h2>
<p>L'ensemble des contenus de la plateforme (design, code, textes, logos) est la propriété d'AUTOMATISE et protégé par les droits de propriété intellectuelle applicables. Toute reproduction sans autorisation écrite est interdite.</p>
<h2>9. Modifications des CGU</h2>
<p>M-Santé se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront notifiés par email et/ou notification dans l'application. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles conditions.</p>
<h2>10. Droit applicable</h2>
<p>Les présentes CGU sont régies par le droit sénégalais. Tout litige relatif à leur interprétation ou leur exécution relèvera de la compétence des tribunaux de Dakar, sauf disposition légale contraire.</p>$html$
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.faq_items (question, answer, sort_order) VALUES
  ('Comment prendre rendez-vous avec un praticien ?', 'Recherchez un praticien depuis la page "Praticiens", consultez son profil puis cliquez sur "Réserver" pour choisir un créneau disponible.', 1),
  ('Quels moyens de paiement sont acceptés ?', 'Wave, Orange Money et carte bancaire. Pour les consultations en présentiel, le paiement sur place est également possible selon le praticien.', 2),
  ('Comment annuler un rendez-vous ?', 'Depuis votre espace patient, ouvrez le rendez-vous concerné et cliquez sur "Annuler". Un motif est obligatoire, et chaque praticien définit son propre délai d''annulation.', 3),
  ('Mes données de santé sont-elles confidentielles ?', 'Oui. Vos données (humeur, journal, dossiers) sont chiffrées et accessibles uniquement par vous et le praticien concerné, jamais partagées sans votre consentement.', 4),
  ('Que faire en cas d''urgence ?', 'M-Santé n''est pas un service d''urgence. Appelez le 15 (SAMU) ou rendez-vous aux urgences les plus proches. Pour une détresse psychologique, SOS Amitié est joignable au +221 33 823 8020.', 5)
ON CONFLICT DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_settings_public_read" ON public.site_settings FOR SELECT USING (TRUE);
CREATE POLICY "site_settings_admin_write" ON public.site_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_pages_public_read" ON public.content_pages FOR SELECT USING (TRUE);
CREATE POLICY "content_pages_admin_write" ON public.content_pages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "faq_public_read" ON public.faq_items FOR SELECT USING (is_published = TRUE);
CREATE POLICY "faq_admin_all" ON public.faq_items FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Storage bucket for the site logo (public read — used on the homepage/header)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('site-assets', 'site-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "site_assets_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "site_assets_admin_write" ON storage.objects FOR ALL USING (
  bucket_id = 'site-assets' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
