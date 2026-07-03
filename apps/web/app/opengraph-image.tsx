import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'M-Santé — Votre sanctuaire de santé mentale'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #f8f9ff 0%, #e5eeff 40%, #bee9ff 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo + nom */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '36px' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              background: '#82d8ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 40px rgba(0,102,133,0.35)',
            }}
          >
            <span style={{ color: 'white', fontSize: 52, fontWeight: 900 }}>M</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 68, fontWeight: 900, color: '#0b1c30', letterSpacing: '-3px', lineHeight: 1 }}>
              M-Santé
            </span>
            <span style={{ fontSize: 16, color: '#82d8ff', fontWeight: 700, letterSpacing: '8px', textTransform: 'uppercase' }}>
              Health Sanctuary
            </span>
          </div>
        </div>

        {/* Accroche */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            color: '#0b1c30',
            textAlign: 'center',
            maxWidth: 880,
            lineHeight: 1.25,
            marginBottom: 20,
          }}
        >
          Votre sanctuaire de santé mentale, réinventé.
        </div>

        {/* Sous-titre */}
        <div style={{ fontSize: 22, color: '#6f787e', textAlign: 'center', maxWidth: 780, marginBottom: 36 }}>
          Psychologues certifiés · Téléconsultation sécurisée · Wave & Orange Money
        </div>

        {/* Badge géo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(0,102,133,0.08)',
            border: '1.5px solid rgba(0,102,133,0.25)',
            borderRadius: 40,
            padding: '14px 32px',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#82d8ff' }}>
            Sénégal · Afrique francophone · Europe
          </span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
