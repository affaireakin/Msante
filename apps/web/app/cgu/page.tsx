import Link from 'next/link'

export const metadata = { title: 'Conditions Générales d\'Utilisation — M-Santé' }

export default function CGUPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>medical_services</span>
          </div>
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
        <span className="text-xs text-[#6f787e] font-semibold ml-auto">CGU · Version 1.0 · Juin 2026</span>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div>
          <h1 className="text-3xl font-black text-[#0b1c30] mb-2">Conditions Générales d&apos;Utilisation</h1>
          <p className="text-sm text-[#6f787e]">Dernière mise à jour : 1er juin 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">1. Présentation de la plateforme</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            M-Santé est une super-application de santé numérique éditée par AUTOMATISE, permettant la mise en relation entre patients et professionnels de santé ou praticiens bien-être. La plateforme propose notamment la prise de rendez-vous, la téléconsultation, le suivi de l&apos;humeur et du bien-être, ainsi que des outils d&apos;accompagnement psychologique.
          </p>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            M-Santé ne constitue pas un service d&apos;urgence médicale. En cas d&apos;urgence, contactez immédiatement le 15 (SAMU) ou rendez-vous aux urgences les plus proches.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">2. Acceptation des conditions</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            En créant un compte sur M-Santé, vous reconnaissez avoir lu, compris et accepté l&apos;intégralité des présentes Conditions Générales d&apos;Utilisation. Si vous n&apos;acceptez pas ces conditions, vous ne pouvez pas utiliser la plateforme.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">3. Comptes utilisateurs</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            Deux types de comptes sont disponibles : <strong>Patient</strong> et <strong>Praticien</strong>. Chaque utilisateur est responsable de la confidentialité de ses identifiants. Les comptes praticiens font l&apos;objet d&apos;une procédure de vérification avant activation.
          </p>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            Vous vous engagez à fournir des informations exactes, complètes et à jour lors de votre inscription et à les maintenir dans cet état. M-Santé se réserve le droit de suspendre ou supprimer tout compte dont les informations seraient inexactes ou frauduleuses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">4. Données personnelles et santé</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            M-Santé traite des données de santé à caractère sensible (humeur, journal émotionnel, antécédents médicaux). Ces données sont chiffrées au repos, accessibles uniquement par vous-même et, dans le cadre d&apos;une consultation, par le praticien concerné. Elles ne sont jamais transmises à des tiers sans votre consentement explicite.
          </p>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            Conformément au RGPD et aux législations locales applicables, vous disposez d&apos;un droit d&apos;accès, de rectification, de portabilité et de suppression de vos données. Pour exercer ces droits, contactez-nous à <strong>privacy@m-sante.app</strong>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">5. Limites du service de santé mentale</h2>
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-5 py-4 space-y-2">
            <p className="text-sm font-bold text-amber-800">Avertissement important</p>
            <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
              <li>M-Santé ne fournit pas de diagnostic médical.</li>
              <li>L&apos;assistant IA (Mounima) ne remplace pas un professionnel de santé.</li>
              <li>En cas de détresse sévère ou de pensées suicidaires, contactez SOS Amitié (+221 33 823 8020) ou un médecin.</li>
              <li>Les outils de bien-être (mood, journal, méditation) sont des outils d&apos;accompagnement, non des traitements médicaux.</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">6. Paiements</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            Les consultations sont payantes selon les tarifs fixés par chaque praticien. Les paiements sont traités via Wave, Orange Money ou carte bancaire. En cas d&apos;annulation dans les conditions prévues, un remboursement peut être accordé selon la politique d&apos;annulation du praticien. M-Santé prélève une commission de 20 % sur chaque transaction.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">7. Responsabilités</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            M-Santé agit comme intermédiaire technique entre patients et praticiens. La responsabilité médicale incombe exclusivement au praticien diplômé. M-Santé ne peut être tenu responsable des conseils médicaux prodigués lors des consultations ni des résultats de santé obtenus.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">8. Propriété intellectuelle</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            L&apos;ensemble des contenus de la plateforme (design, code, textes, logos) est la propriété d&apos;AUTOMATISE et protégé par les droits de propriété intellectuelle applicables. Toute reproduction sans autorisation écrite est interdite.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">9. Modifications des CGU</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            M-Santé se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront notifiés par email et/ou notification dans l&apos;application. La poursuite de l&apos;utilisation du service après notification vaut acceptation des nouvelles conditions.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-[#0b1c30]">10. Droit applicable</h2>
          <p className="text-sm text-[#3f484d] leading-relaxed">
            Les présentes CGU sont régies par le droit sénégalais. Tout litige relatif à leur interprétation ou leur exécution relèvera de la compétence des tribunaux de Dakar, sauf disposition légale contraire.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-200/50 flex items-center gap-4">
          <Link
            href="/auth/signup"
            className="px-6 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#82d8ff]/20 transition-all"
          >
            Créer mon compte
          </Link>
          <Link href="/auth/login" className="text-sm text-[#82d8ff] font-semibold hover:underline">
            Se connecter
          </Link>
        </div>
      </main>
    </div>
  )
}
