import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/query-client'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const BASE_URL = 'https://m-santé.com'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'M-Santé | Psychologues & Psychiatres en ligne au Sénégal',
    template: '%s | M-Santé',
  },
  description:
    'M-Santé — 1ère plateforme de santé mentale africaine. Consultez des psychologues et psychiatres certifiés en téléconsultation. Paiement Wave & Orange Money. Disponible à Dakar et dans toute l\'Afrique francophone.',
  keywords: [
    'santé mentale Sénégal',
    'psychologue Dakar',
    'psychiatre en ligne',
    'téléconsultation psychologie',
    'thérapie Afrique',
    'consultation psychologique en ligne',
    'bien-être mental',
    'Wave paiement santé',
    'Orange Money consultation',
    'M-Santé',
    'psychologue en ligne Sénégal',
    'santé mentale Afrique',
  ],
  authors: [{ name: 'M-Santé', url: BASE_URL }],
  creator: 'M-Santé',
  publisher: 'M-Santé',
  category: 'health',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_SN',
    alternateLocale: ['fr_FR'],
    url: BASE_URL,
    siteName: 'M-Santé',
    title: 'M-Santé | Psychologues & Psychiatres en ligne au Sénégal',
    description:
      '1ère plateforme de santé mentale africaine. Praticiens certifiés, téléconsultation sécurisée, paiement Wave & Orange Money.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'M-Santé — Votre sanctuaire de santé mentale',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@msante_sn',
    creator: '@msante_sn',
    title: 'M-Santé | Psychologues & Psychiatres en ligne au Sénégal',
    description:
      '1ère plateforme de santé mentale africaine. Praticiens certifiés, téléconsultation, paiement Wave & Orange Money.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: BASE_URL,
    languages: { 'fr-SN': BASE_URL, 'fr-FR': BASE_URL },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body suppressHydrationWarning className={`${manrope.variable} font-[family-name:var(--font-manrope)] antialiased bg-[#f8f9ff]`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
