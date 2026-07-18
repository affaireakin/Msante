import Link from 'next/link'

const SECTIONS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Découvrir',
    links: [
      { label: 'Accueil', href: '/' },
      { label: 'Trouver un praticien', href: '/patient/practitioners' },
      { label: 'Organisations partenaires', href: '/patient/organizations' },
    ],
  },
  {
    title: 'Compte',
    links: [
      { label: 'Connexion', href: '/auth/login' },
      { label: 'Créer un compte', href: '/auth/signup' },
    ],
  },
  {
    title: 'Ressources',
    links: [
      { label: 'Questions fréquentes', href: '/faq' },
      { label: 'Tarifs', href: '/pages/tarifs' },
      { label: 'Nous contacter', href: '/contact' },
    ],
  },
  {
    title: 'Entreprise',
    links: [
      { label: 'À propos', href: '/pages/a-propos' },
      { label: 'Carrières', href: '/pages/carrieres' },
      { label: 'Presse', href: '/pages/presse' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { label: "Conditions Générales d'Utilisation", href: '/cgu' },
      { label: 'Mentions légales', href: '/pages/mentions-legales' },
      { label: 'Politique de confidentialité', href: '/pages/confidentialite' },
    ],
  },
]

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow">
            <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>medical_services</span>
          </div>
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="text-3xl font-black text-[#0b1c30]">Plan du site</h1>
        {SECTIONS.map(section => (
          <div key={section.title}>
            <h2 className="text-sm font-bold text-[#6f787e] uppercase tracking-wide mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.links.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-[#0b1c30] hover:text-[#82d8ff] transition-colors">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  )
}
