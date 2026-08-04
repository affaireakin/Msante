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
        <div className="flex items-center gap-3 mb-8">
          <SiteLogo size={40} />
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">M-Santé</h1>
            <p className="text-xs text-slate-500 font-medium">Health Sanctuary</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
