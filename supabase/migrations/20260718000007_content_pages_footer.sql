-- Footer links (Tarifs/À propos/Carrières/Presse/Mentions légales/
-- Confidentialité) were all dead '#' placeholders — seed real, editable
-- content_pages rows for each so the CMS "Pages" tab can manage them like CGU.
INSERT INTO public.content_pages (slug, title, body) VALUES
(
  'a-propos', 'À propos de M-Santé',
$html$<h2>Notre mission</h2>
<p>M-Santé est la première plateforme de santé mentale africaine connectant patients et praticiens certifiés — psychologues, psychiatres, coachs de vie et thérapeutes bien-être — via la téléconsultation et le suivi de proximité.</p>
<p>Basée à Dakar, notre ambition est de rendre l'accompagnement psychologique accessible partout au Sénégal et en Afrique francophone, en combinant technologie moderne et chaleur humaine.</p>
<h2>Notre approche</h2>
<p>Nous croyons qu'une bonne santé mentale commence par un accès simple et sans jugement à un professionnel de confiance. C'est pourquoi M-Santé propose la prise de rendez-vous en ligne, la téléconsultation vidéo sécurisée, le suivi de l'humeur et un accompagnement bien-être au quotidien.</p>$html$
),
(
  'carrieres', 'Carrières',
$html$<h2>Rejoindre M-Santé</h2>
<p>Nous n'avons pas de poste ouvert publiquement pour le moment, mais nous sommes toujours curieux de rencontrer des personnes passionnées par la santé mentale et la technologie.</p>
<p>Envoyez-nous votre profil à <strong>carrieres@m-sante.com</strong> — nous le conservons pour nos futurs recrutements.</p>$html$
),
(
  'presse', 'Presse',
$html$<h2>Espace presse</h2>
<p>Pour toute demande d'interview, de partenariat média ou d'information sur M-Santé, contactez notre équipe communication à <strong>presse@m-sante.com</strong>.</p>$html$
),
(
  'mentions-legales', 'Mentions légales',
$html$<h2>Éditeur</h2>
<p>M-Santé est une plateforme éditée par AUTOMATISE. Pour toute question relative à l'édition du site, contactez <strong>contact@m-sante.com</strong>.</p>
<h2>Hébergement</h2>
<p>Le site est hébergé sur une infrastructure cloud sécurisée. Les données de santé sont traitées conformément à la réglementation applicable au Sénégal et au RGPD.</p>
<h2>Propriété intellectuelle</h2>
<p>L'ensemble des contenus (textes, logos, code, design) de M-Santé est protégé par les droits de propriété intellectuelle applicables. Toute reproduction sans autorisation écrite est interdite.</p>$html$
),
(
  'confidentialite', 'Politique de confidentialité',
$html$<h2>Données collectées</h2>
<p>M-Santé collecte les données nécessaires à la fourniture du service : informations de profil, données de rendez-vous, et pour les patients, des données de santé sensibles (humeur, journal, antécédents) traitées avec un niveau de confidentialité renforcé.</p>
<h2>Utilisation des données</h2>
<p>Vos données ne sont jamais vendues ni transmises à des tiers à des fins commerciales. Elles sont utilisées uniquement pour vous fournir le service et, avec votre consentement explicite, partagées avec le praticien que vous consultez.</p>
<h2>Vos droits</h2>
<p>Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de portabilité et de suppression de vos données. Contactez <strong>privacy@m-sante.com</strong> pour exercer ces droits.</p>$html$
),
(
  'tarifs', 'Tarifs',
$html$<h2>Comment fonctionnent les tarifs ?</h2>
<p>Chaque praticien fixe librement le prix de ses consultations selon sa spécialité et son expérience. Le tarif exact est indiqué sur son profil avant la réservation, sans frais cachés.</p>
<h2>Moyens de paiement</h2>
<p>Wave, Orange Money et carte bancaire sont acceptés pour les téléconsultations. Pour les rendez-vous en présentiel, le paiement sur place peut également être proposé selon le praticien.</p>
<h2>Annulation</h2>
<p>Chaque praticien définit son propre délai d'annulation. Un remboursement peut être accordé si l'annulation intervient avant ce délai, conformément à sa politique.</p>$html$
)
ON CONFLICT (slug) DO NOTHING;
