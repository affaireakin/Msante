'use client'
import { useSiteSettings } from '@/lib/useSiteSettings'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

export default function SiteContactLine() {
  const { data } = useSiteSettings()

  if (!data?.phone && !data?.contact_email) return null

  return (
    <div className="space-y-1.5">
      {data.phone && (
        <a href={`tel:${data.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-sm text-[#6f787e] hover:text-[#82d8ff] transition-colors w-fit">
          <Icon name="call" style={{ fontSize: '16px', color: '#82d8ff' }} />
          {data.phone}
        </a>
      )}
      {data.contact_email && (
        <a href={`mailto:${data.contact_email}`} className="flex items-center gap-2 text-sm text-[#6f787e] hover:text-[#82d8ff] transition-colors w-fit">
          <Icon name="mail" style={{ fontSize: '16px', color: '#82d8ff' }} />
          {data.contact_email}
        </a>
      )}
    </div>
  )
}
