import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/query-client'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'M-Santé | Votre sanctuaire de santé mentale',
  description: 'M-Santé — Plateforme de santé mentale africaine. Praticiens certifiés, téléconsultation, paiements Wave & Orange Money.',
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
