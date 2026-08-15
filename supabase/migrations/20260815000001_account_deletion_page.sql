-- Page publique requise par le formulaire "Sécurité des données" de Google
-- Play (URL de suppression de compte) — doit être accessible sans connexion.
-- Reflète le comportement réel de l'edge function delete-account : blocage
-- immédiat du compte (ban Supabase Auth), effacement des données sous 30
-- jours conformément au RGPD.
INSERT INTO public.content_pages (slug, title, body) VALUES (
  'suppression-compte', 'Suppression de compte — M-Santé',
$html$<h2>Demander la suppression de votre compte M-Santé</h2>
<p>Vous pouvez demander la suppression de votre compte M-Santé et des données associées à tout moment, directement depuis l'application.</p>
<h2>Procédure</h2>
<p>Depuis l'application mobile ou le site web M-Santé :</p>
<ul>
<li>Connectez-vous à votre compte.</li>
<li>Rendez-vous dans <strong>Profil</strong> (ou <strong>Paramètres du compte</strong>).</li>
<li>Sélectionnez <strong>« Supprimer mon compte »</strong>.</li>
<li>Confirmez la demande.</li>
</ul>
<p>Si vous n'avez plus accès à votre compte ou à l'application, vous pouvez faire votre demande par email à <strong>privacy@m-sante.com</strong> en précisant l'adresse email associée à votre compte.</p>
<h2>Ce qu'il se passe ensuite</h2>
<ul>
<li>Votre compte est <strong>immédiatement bloqué</strong> : vous ne pouvez plus vous connecter dès la confirmation de la demande.</li>
<li>Vos données personnelles et cliniques (profil, historique de rendez-vous, journal émotionnel, mood tracker, messages, documents) sont <strong>définitivement effacées sous 30 jours</strong>, conformément au RGPD.</li>
<li>Certaines données peuvent être conservées au-delà de ce délai uniquement lorsque la loi l'exige (ex. obligations comptables sur les transactions de paiement), pour la durée légale strictement nécessaire, et ne sont plus utilisées à d'autres fins.</li>
</ul>
<h2>Contact</h2>
<p>Pour toute question relative à la suppression de votre compte ou de vos données, contactez-nous à <strong>privacy@m-sante.com</strong>.</p>$html$
) ON CONFLICT (slug) DO NOTHING;
