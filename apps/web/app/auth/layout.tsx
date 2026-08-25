import type { Metadata } from 'next'
import SiteLogo from '@/components/SiteLogo'

export const metadata: Metadata = {
  title: {
    default: 'Connexion',
    template: '%s | M-Santé',
  },
  robots: { index: true, follow: true },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-start gap-2 mb-8">
          <SiteLogo size={56} variant="mark" />
          <p className="text-xs text-slate-500 font-medium tracking-wide">MIND · CARE · CONNECT</p>
        </div>
        {children}
      </div>
    </div>
  )
}
