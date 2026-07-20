'use client'
import Link from 'next/link'
import { useSiteSettings } from '@/lib/useSiteSettings'
import SiteLogo from '@/components/SiteLogo'
import SiteSocialLinks from '@/components/SiteSocialLinks'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function ContactClient() {
  const { data, isLoading } = useSiteSettings()

  return (
    <div className="min-h-screen bg-[#f8f9ff]">
      <header className="bg-white/70 backdrop-blur-xl border-b border-slate-200/50 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <SiteLogo size={32} />
          <span className="text-base font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#0b1c30] mb-2">Nous contacter</h1>
          <p className="text-sm text-[#6f787e]">Une question, une suggestion ? Notre équipe vous répond.</p>
        </div>

        {isLoading ? (
          <div className="h-40 rounded-2xl bg-white/40 animate-pulse" />
        ) : (
          <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            {data?.phone && (
              <a href={`tel:${data.phone.replace(/\s/g, '')}`} className="flex items-center gap-3 text-sm text-[#0b1c30] hover:text-[#82d8ff] transition-colors">
                <Icon name="call" style={{ fontSize: '20px', color: '#82d8ff' }} />
                {data.phone}
              </a>
            )}
            {data?.whatsapp_number && (
              <a href={`https://wa.me/${data.whatsapp_number.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm text-[#0b1c30] hover:text-[#82d8ff] transition-colors">
                <Icon name="chat" style={{ fontSize: '20px', color: '#82d8ff' }} />
                WhatsApp — {data.whatsapp_number}
              </a>
            )}
            {data?.contact_email && (
              <a href={`mailto:${data.contact_email}`} className="flex items-center gap-3 text-sm text-[#0b1c30] hover:text-[#82d8ff] transition-colors">
                <Icon name="mail" style={{ fontSize: '20px', color: '#82d8ff' }} />
                {data.contact_email}
              </a>
            )}
            {!data?.phone && !data?.whatsapp_number && !data?.contact_email && (
              <p className="text-sm text-[#6f787e]">Les coordonnées de contact seront bientôt disponibles.</p>
            )}
            <div className="pt-2">
              <SiteSocialLinks />
            </div>
          </div>
        )}

        <div className="rounded-2xl p-6 bg-amber-50 border border-amber-100">
          <p className="text-sm text-amber-800">
            En cas d&apos;urgence médicale ou de détresse psychologique, ce formulaire ne remplace pas les services d&apos;urgence.
            Appelez le <strong>15 (SAMU)</strong> ou <strong>SOS Amitié : +221 33 823 8020</strong>.
          </p>
        </div>
      </main>
    </div>
  )
}
