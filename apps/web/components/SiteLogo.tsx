'use client'
import { useSiteSettings } from '@/lib/useSiteSettings'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function SiteLogo({ size = 40 }: { size?: number }) {
  const { data } = useSiteSettings()

  if (data?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={data.logo_url} alt="M-Santé" style={{ width: size, height: size, borderRadius: size * 0.28 }} className="object-cover shadow-md" />
    )
  }

  return (
    <div className="rounded-xl bg-[#82d8ff] flex items-center justify-center shadow-md" style={{ width: size, height: size }}>
      <Icon name="medical_services" style={{ fontSize: `${size * 0.5}px`, color: '#fff' }} />
    </div>
  )
}
