import React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import AuthRedirect from '@/components/AuthRedirect'
import FeaturedOrganizations from '@/components/FeaturedOrganizations'
import FeaturedPractitioners from '@/components/FeaturedPractitioners'
import SiteLogo from '@/components/SiteLogo'
import SiteSocialLinks from '@/components/SiteSocialLinks'
import SiteContactLine from '@/components/SiteContactLine'
import HeroSection from '@/components/homepage/HeroSection'
import FeaturesSection from '@/components/homepage/FeaturesSection'
import ValuePropositionSection from '@/components/homepage/ValuePropositionSection'
import CtaFinalSection from '@/components/homepage/CtaFinalSection'
import TrustBarSection from '@/components/homepage/TrustBarSection'

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] font-[family-name:var(--font-manrope)] text-[#0b1c30] overflow-x-hidden">
      <AuthRedirect />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Topbar ── */}
      <header className="sticky top-0 z-50 bg-[#f8f9ff]/80 backdrop-blur-xl border-b border-white/10 shadow-sm">
        <div className="flex justify-between items-center h-20 px-6 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <SiteLogo size={40} />
            <div>
              <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
              <p className="text-[10px] text-[#82d8ff] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-8">
            <Link className="text-[#82d8ff] font-bold border-b-2 border-[#82d8ff] py-1 text-sm" href="/">Accueil</Link>
            <a className="text-[#6f787e] hover:text-[#82d8ff] transition-colors text-sm font-medium" href="#features">Bien-être</a>
            <a className="text-[#6f787e] hover:text-[#82d8ff] transition-colors text-sm font-medium" href="#praticiens">Praticiens</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="px-5 py-2 text-[#82d8ff] text-sm font-semibold hover:bg-[#82d8ff]/5 transition-all rounded-lg">
              Connexion
            </Link>
            <Link href="/auth/signup" className="px-5 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Inscription
            </Link>
          </div>
        </div>
      </header>

      <main>

        <HeroSection />

        <FeaturesSection />

        <ValuePropositionSection />

        <FeaturedPractitioners />

        <FeaturedOrganizations />

        <CtaFinalSection />

      </main>

      <TrustBarSection />

      {/* ── Footer ── */}
      <footer className="bg-[#dce9ff] border-t border-[#bec8ce]/30">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-12 max-w-7xl mx-auto w-full">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <SiteLogo size={36} />
              <div>
                <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
                <p className="text-[10px] text-[#82d8ff] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
              </div>
            </div>
            <p className="text-sm text-[#6f787e] max-w-xs leading-relaxed">
              Votre partenaire de confiance pour une santé mentale épanouie, alliant innovation et humanité.
            </p>
            <SiteContactLine />
            <SiteSocialLinks />
          </div>
          {[
            { title: 'Produit', links: [{ label: 'Wellness IA', href: '#features' }, { label: 'Praticiens', href: '#praticiens' }, { label: 'Tarifs', href: '/pages/tarifs' }, { label: 'Aide', href: '/faq' }] },
            { title: 'Entreprise', links: [{ label: 'À propos', href: '/pages/a-propos' }, { label: 'Carrières', href: '/pages/carrieres' }, { label: 'Presse', href: '/pages/presse' }, { label: 'Contact', href: '/contact' }] },
            { title: 'Légal', links: [{ label: 'Plan du site', href: '/plan-du-site' }, { label: 'Mentions légales', href: '/pages/mentions-legales' }, { label: 'Confidentialité', href: '/pages/confidentialite' }, { label: "Conditions d'utilisation", href: '/cgu' }] },
          ].map(col => (
            <div key={col.title}>
              <h5 className="font-bold mb-5 text-[#0b1c30]">{col.title}</h5>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.href === '#' ? (
                      <span className="text-sm text-[#6f787e]/60 cursor-default">{l.label}</span>
                    ) : (
                      <Link href={l.href} className="text-sm text-[#6f787e] hover:text-[#82d8ff] transition-colors">{l.label}</Link>
                    )}
                  </li>
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
