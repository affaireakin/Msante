import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'M-Santé | Psychologues & Psychiatres en ligne au Sénégal',
  description:
    'M-Santé — 1ère plateforme de santé mentale africaine. Consultez des psychologues et psychiatres certifiés en téléconsultation depuis Dakar ou partout au Sénégal. Paiement Wave & Orange Money.',
  alternates: { canonical: 'https://m-santé.com' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://m-santé.com/#website',
      url: 'https://m-santé.com',
      name: 'M-Santé',
      description: '1ère plateforme de santé mentale africaine',
      inLanguage: 'fr-SN',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://m-santé.com/patient/practitioners?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'MedicalOrganization',
      '@id': 'https://m-santé.com/#organization',
      name: 'M-Santé',
      url: 'https://m-santé.com',
      logo: 'https://m-santé.com/logo.png',
      description:
        'Première plateforme de santé mentale africaine connectant patients et praticiens certifiés via téléconsultation.',
      medicalSpecialty: ['Psychiatry', 'Psychology'],
      areaServed: [
        { '@type': 'Country', name: 'Sénégal', sameAs: 'https://www.wikidata.org/wiki/Q1041' },
        { '@type': 'Continent', name: 'Afrique' },
      ],
      availableService: [
        { '@type': 'MedicalTherapy', name: 'Téléconsultation psychologique' },
        { '@type': 'MedicalTherapy', name: 'Suivi bien-être mental' },
        { '@type': 'MedicalTherapy', name: 'Consultation psychiatrique en ligne' },
      ],
      paymentAccepted: 'Wave, Orange Money, Carte bancaire',
      sameAs: ['https://twitter.com/msante_sn'],
    },
  ],
}

function Icon({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] font-[family-name:var(--font-manrope)] text-[#0b1c30] overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 bg-[#f8f9ff]/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#006685] flex items-center justify-center shadow-md">
              <Icon name="medical_services" className="text-white" style={{ fontSize: '20px' }} />
            </div>
            <div>
              <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
              <p className="text-[10px] text-[#006685] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <a className="text-[#006685] font-bold border-b-2 border-[#006685] py-1 text-sm" href="#">Accueil</a>
            <a className="text-[#6f787e] hover:text-[#006685] transition-colors text-sm font-medium" href="#">Bien-être</a>
            <a className="text-[#6f787e] hover:text-[#006685] transition-colors text-sm font-medium" href="#">Praticiens</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="px-5 py-2 text-[#006685] text-sm font-semibold hover:bg-[#006685]/5 transition-all rounded-lg">
              Connexion
            </Link>
            <Link href="/auth/signup" className="px-5 py-2 bg-[#006685] text-white text-sm font-bold rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Inscription
            </Link>
          </div>
        </div>
      </header>

      <main>

        {/* ── Hero ── */}
        <section className="relative min-h-[90vh] flex items-center pt-10 overflow-hidden">
          {/* glow bg */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(130,216,255,0.15) 0%, transparent 70%)' }} />

          <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="z-10 space-y-8">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#82d8ff]/30 border border-[#006685]/20 text-[#006685] text-xs font-bold uppercase tracking-widest">
                <span className="mr-2">NOUVEAU</span> INNOVATION BIEN-ÊTRE
              </div>
              <h1 className="text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight text-[#0b1c30]">
                Votre sanctuaire de santé mentale,{' '}
                <span className="text-[#006685]">réinventé.</span>
              </h1>
              <p className="text-lg text-[#6f787e] max-w-lg leading-relaxed">
                Une approche holistique propulsée par l&apos;intelligence artificielle pour des soins personnalisés et accessibles. Redécouvrez l&apos;équilibre intérieur avec M-Santé.
              </p>
              <div className="flex flex-wrap gap-4 pt-2">
                <Link href="/auth/signup" className="px-8 py-4 bg-[#006685] text-white font-bold rounded-xl shadow-xl shadow-[#006685]/20 hover:scale-105 active:scale-95 transition-all">
                  Commencer mon parcours
                </Link>
                <Link href="#praticiens" className="px-8 py-4 font-semibold rounded-xl hover:bg-white/80 transition-all text-[#0b1c30]" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  Découvrir nos praticiens
                </Link>
              </div>
            </div>

            {/* Right — image + floating card */}
            <div className="relative group hidden lg:block">
              <div className="absolute -inset-4 bg-[#006685]/10 blur-3xl rounded-full opacity-50 group-hover:opacity-70 transition-opacity" />
              <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-square p-2" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                {/* Gradient placeholder instead of external image */}
                <div className="w-full h-full rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #e5eeff 0%, #82d8ff 40%, #bee9ff 70%, #f8f9ff 100%)' }}>
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center space-y-4">
                      <div className="w-24 h-24 rounded-full bg-[#006685] flex items-center justify-center mx-auto shadow-2xl">
                        <Icon name="medical_services" className="text-white" style={{ fontSize: '48px' }} />
                      </div>
                      <div>
                        <p className="text-xl font-black text-[#006685]">Dr. Aminata Diallo</p>
                        <p className="text-sm text-[#6f787e] font-medium">Psychologue Clinicienne</p>
                        <div className="flex items-center justify-center gap-1 mt-2">
                          {[1,2,3,4,5].map(i => (
                            <Icon key={i} name="star" className="text-[#ffde5c]" style={{ fontSize: '16px' }} />
                          ))}
                          <span className="text-xs text-[#6f787e] ml-1">5.0</span>
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#006685] text-white rounded-full text-xs font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                          Disponible maintenant
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating stat card */}
              <div className="absolute -bottom-6 -left-6 p-5 rounded-2xl shadow-xl max-w-[200px]" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-[#ffde5c] flex items-center justify-center text-[#705d00]">
                    <Icon name="auto_awesome" style={{ fontSize: '20px' }} />
                  </div>
                  <span className="font-bold text-2xl leading-none text-[#006685]">98%</span>
                </div>
                <p className="text-sm text-[#6f787e]">de confiance renouvelée.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Trust Bar ── */}
        <section className="py-12 bg-[#eff4ff] border-y border-[#bec8ce]/30">
          <div className="max-w-7xl mx-auto px-6">
            <p className="text-center text-xs font-bold text-[#6f787e] mb-8 uppercase tracking-widest opacity-60">NOS PARTENAIRES DE CONFIANCE</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
              {[
                { icon: 'account_balance', label: 'Ministère de la Santé' },
                { icon: 'waves', label: 'Wave' },
                { icon: 'cell_tower', label: 'Orange Money' },
                { icon: 'shield', label: 'Santevie' },
              ].map(p => (
                <div key={p.label} className="flex items-center gap-2">
                  <Icon name={p.icon} className="text-[#006685]" />
                  <span className="font-bold text-[#0b1c30]/50">{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section id="features" className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-[40px] font-black text-[#0b1c30]">Des solutions pensées pour vous</h2>
            <p className="text-[#6f787e] max-w-2xl mx-auto">
              Allier la technologie de pointe à la chaleur humaine pour transformer votre expérience de santé.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: 'psychology',
                iconBg: '#82d8ff',
                iconColor: '#006685',
                title: 'Compagnon Bien-être IA',
                desc: "Un assistant émotionnel intelligent disponible 24/7 pour vous écouter, analyser vos humeurs et proposer des exercices adaptés.",
                gradient: 'from-[#e5eeff] to-[#bee9ff]',
              },
              {
                icon: 'verified_user',
                iconBg: '#ffde5c',
                iconColor: '#705d00',
                title: "Réseau d'Experts",
                desc: "Accédez à un panel de psychologues, psychiatres et coachs de vie certifiés, sélectionnés pour leur excellence.",
                gradient: 'from-[#fff8e1] to-[#ffde5c]/30',
              },
              {
                icon: 'video_chat',
                iconBg: '#82d8ff',
                iconColor: '#006685',
                title: 'Téléconsultation Sécurisée',
                desc: "Des sessions vidéo chiffrées de bout en bout pour garantir une confidentialité totale. Consultez depuis chez vous.",
                gradient: 'from-[#e5eeff] to-[#82d8ff]/20',
              },
              {
                icon: 'location_on',
                iconBg: '#fce4ec',
                iconColor: '#c2185b',
                title: 'Consultation en présentiel',
                desc: "Rencontrez votre praticien dans son cabinet ou à domicile. Une présence humaine quand vous en avez besoin.",
                gradient: 'from-[#fce4ec] to-[#f8bbd0]/30',
              },
            ].map(card => (
              <div
                key={card.title}
                className="group rounded-[2rem] hover:shadow-2xl hover:-translate-y-2 transition-all py-12 px-8 text-center flex flex-col items-center"
                style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 group-hover:rotate-6 transition-transform"
                  style={{ backgroundColor: card.iconBg }}
                >
                  <Icon name={card.icon} className={`text-[${card.iconColor}]`} style={{ fontSize: '36px', color: card.iconColor }} />
                </div>
                <h3 className="text-xl font-bold text-[#0b1c30] mb-4">{card.title}</h3>
                <p className="text-[#6f787e] text-sm leading-relaxed mb-6">{card.desc}</p>
                <div className={`w-full h-36 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon name={card.icon} className="opacity-20" style={{ fontSize: '72px', color: card.iconColor }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Value Proposition ── */}
        <section className="py-24 bg-[#eff4ff] overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">

              {/* Left — glass card */}
              <div className="relative order-2 lg:order-1">
                <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#006685]/20 rounded-full blur-3xl" />
                <div className="relative rounded-[2.5rem] p-12 overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Icon name="vital_signs" style={{ fontSize: '72px', color: '#006685' }} />
                  </div>
                  <h2 className="text-2xl font-bold text-[#0b1c30] mb-10">Le Futurisme Médical : L&apos;IA au service de l&apos;empathie.</h2>
                  <div className="space-y-8">
                    {[
                      { icon: 'biotech', title: 'Précision Clinique', desc: 'Algorithmes de diagnostic préventif basés sur des protocoles médicaux internationaux validés.' },
                      { icon: 'spa', title: 'Sérénité Humaine', desc: "Interfaces minimalistes et apaisantes conçues pour réduire l'anxiété et favoriser la guérison mentale." },
                      { icon: 'hub', title: 'Écosystème Connecté', desc: "Synchronisation transparente entre vos appareils, vos praticiens et votre historique de santé." },
                    ].map(item => (
                      <div key={item.title} className="flex gap-6">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#006685] text-white flex items-center justify-center shadow-lg shadow-[#006685]/20">
                          <Icon name={item.icon} />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#0b1c30] mb-1">{item.title}</h4>
                          <p className="text-sm text-[#6f787e]">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — video placeholder + stats */}
              <div className="order-1 lg:order-2 space-y-6">
                <div className="aspect-video rounded-[2rem] overflow-hidden shadow-2xl relative" style={{ background: 'linear-gradient(135deg, #0b1c30 0%, #006685 100%)' }}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center border border-white/30 hover:scale-110 transition-transform cursor-pointer" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
                      <Icon name="play_arrow" className="text-white" style={{ fontSize: '40px' }} />
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div className="w-10 h-10 rounded-full bg-[#006685] flex items-center justify-center text-white">
                      <Icon name="play_circle" style={{ fontSize: '20px' }} />
                    </div>
                    <span className="font-bold text-sm text-white">Découvrez notre vision (2:45)</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl bg-white shadow-sm border border-[#bec8ce]/20">
                    <span className="block text-2xl font-black text-[#006685] mb-1">500+</span>
                    <span className="text-sm text-[#6f787e]">Praticiens Certifiés</span>
                  </div>
                  <div className="p-6 rounded-2xl bg-white shadow-sm border border-[#bec8ce]/20">
                    <span className="block text-2xl font-black text-[#006685] mb-1">24/7</span>
                    <span className="text-sm text-[#6f787e]">Support IA Illimité</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Praticiens ── */}
        <section id="praticiens" className="py-24 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#0b1c30] mb-4">Nos praticiens certifiés</h2>
            <p className="text-[#6f787e]">Sélectionnés pour leur expertise et leur bienveillance</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: 'Dr. Aminata Diallo', spec: 'Psychologue Clinicienne', rating: 4.9, sessions: 142, initials: 'AD', color: '#006685' },
              { name: 'Dr. Moussa Sow', spec: 'Psychiatre', rating: 4.8, sessions: 98, initials: 'MS', color: '#705d00' },
              { name: 'Dr. Fatou Ndiaye', spec: 'Coach de vie certifiée', rating: 5.0, sessions: 203, initials: 'FN', color: '#1d7a3a' },
            ].map(p => (
              <div key={p.name} className="rounded-2xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-black text-lg flex-shrink-0" style={{ backgroundColor: p.color }}>
                    {p.initials}
                  </div>
                  <div>
                    <p className="font-bold text-[#0b1c30]">{p.name}</p>
                    <p className="text-sm text-[#6f787e]">{p.spec}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(i => (
                    <Icon key={i} name="star" style={{ fontSize: '14px', color: '#ffde5c' }} />
                  ))}
                  <span className="text-xs text-[#6f787e] ml-1">{p.rating} · {p.sessions} sessions</span>
                </div>
                <div className="flex items-center justify-end mt-4">
                  <Link href="/auth/signup" className="px-4 py-2 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-[#006685]/20 transition-all">
                    Réserver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Final ── */}
        <section className="py-24 px-6">
          <div className="max-w-5xl mx-auto rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl bg-[#213145]">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ background: 'radial-gradient(circle at 50% -20%, rgba(130,216,255,0.15), transparent 70%)' }} />
            <div className="relative z-10 space-y-8">
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
                Prêt à transformer votre rapport à la santé mentale ?
              </h2>
              <p className="text-white/70 max-w-xl mx-auto text-base">
                Rejoignez des milliers de personnes qui ont choisi une approche moderne et bienveillante pour leur bien-être.
              </p>
              <div className="flex flex-wrap justify-center gap-4 pt-2">
                <Link href="/auth/signup" className="px-10 py-4 bg-[#006685] text-white font-bold rounded-2xl shadow-xl shadow-[#006685]/30 hover:scale-105 active:scale-95 transition-all">
                  Commencer maintenant
                </Link>
                <Link href="/auth/login" className="px-10 py-4 font-bold rounded-2xl hover:bg-white/20 transition-all text-white border border-white/20" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                  Consulter les tarifs
                </Link>
              </div>
              <p className="text-white/40 text-sm">Essai gratuit de 7 jours sur le Compagnon IA. Sans engagement.</p>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#dce9ff] border-t border-[#bec8ce]/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-12 max-w-7xl mx-auto w-full">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#006685] flex items-center justify-center shadow-sm">
                <Icon name="medical_services" className="text-white" style={{ fontSize: '18px' }} />
              </div>
              <div>
                <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
                <p className="text-[10px] text-[#006685] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
              </div>
            </div>
            <p className="text-sm text-[#6f787e] max-w-xs leading-relaxed">
              Votre partenaire de confiance pour une santé mentale épanouie, alliant innovation et humanité.
            </p>
            <div className="flex space-x-3">
              {['share', 'mail'].map(icon => (
                <a key={icon} href="#" className="w-10 h-10 rounded-full flex items-center justify-center text-[#006685] hover:bg-[#006685] hover:text-white transition-all" style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
                  <Icon name={icon} style={{ fontSize: '20px' }} />
                </a>
              ))}
            </div>
          </div>
          {[
            { title: 'Produit', links: ['Wellness IA', 'Praticiens', 'Tarifs', 'Aide'] },
            { title: 'Entreprise', links: ['À propos', 'Carrières', 'Presse', 'Contact'] },
            { title: 'Légal', links: ['Plan du site', 'Mentions légales', 'Confidentialité', "Conditions d'utilisation"] },
          ].map(col => (
            <div key={col.title}>
              <h5 className="font-bold mb-5 text-[#0b1c30]">{col.title}</h5>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l}><a href="#" className="text-sm text-[#6f787e] hover:text-[#006685] transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[#bec8ce]/30 py-6 px-6 max-w-7xl mx-auto w-full text-center">
          <p className="text-sm text-[#6f787e]/60">© 2026 M-Santé. Tous droits réservés.</p>
        </div>
      </footer>

    </div>
  )
}
