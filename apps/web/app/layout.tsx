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
  title: 'M-Santé Admin',
  description: 'M-Santé — Admin Console',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} font-[family-name:var(--font-manrope)] antialiased bg-[#f8f9ff]`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
