'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { reportIncident } from '@/lib/reportIncident'

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportIncident(error, 'react_error_boundary')
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff] p-6">
      <div className="max-w-md w-full text-center space-y-4 bg-white rounded-2xl p-8 shadow-xl">
        <span className="material-symbols-outlined text-red-500" style={{ fontSize: '48px' }}>error</span>
        <h2 className="text-xl font-bold text-[#0b1c30]">Une erreur est survenue</h2>
        <p className="text-sm text-[#6f787e]">
          Notre équipe technique a été automatiquement informée. Vous pouvez réessayer ou revenir à l&apos;accueil.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button onClick={() => reset()}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-[#0b1c30]" style={{ backgroundColor: '#82d8ff' }}>
            Réessayer
          </button>
          <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#6f787e] border border-slate-200">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
