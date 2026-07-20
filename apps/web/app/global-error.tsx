'use client'
import { useEffect } from 'react'
import { reportIncident } from '@/lib/reportIncident'

// Only fires if the ROOT layout itself throws (exceedingly rare) — Next.js
// requires this file to render its own <html>/<body> since it replaces the
// whole layout tree when triggered.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportIncident(error, 'global_error_boundary')
  }, [error])

  return (
    <html>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9ff', padding: 24, fontFamily: 'sans-serif' }}>
          <div style={{ maxWidth: 420, textAlign: 'center', background: 'white', borderRadius: 16, padding: 32, boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontWeight: 700, fontSize: 20, color: '#0b1c30', margin: 0 }}>Une erreur est survenue</h2>
            <p style={{ fontSize: 14, color: '#6f787e', marginTop: 8 }}>Notre équipe technique a été automatiquement informée.</p>
            <button onClick={() => reset()}
              style={{ marginTop: 16, padding: '10px 20px', borderRadius: 12, background: '#82d8ff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              Réessayer
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
