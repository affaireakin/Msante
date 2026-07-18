'use client'
import { useSiteSettings } from '@/lib/useSiteSettings'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

const SOCIALS: { key: 'facebook_url' | 'instagram_url' | 'twitter_url' | 'linkedin_url' | 'tiktok_url' | 'youtube_url'; icon: string; label: string }[] = [
  { key: 'facebook_url', icon: 'thumb_up', label: 'Facebook' },
  { key: 'instagram_url', icon: 'photo_camera', label: 'Instagram' },
  { key: 'twitter_url', icon: 'tag', label: 'X' },
  { key: 'linkedin_url', icon: 'work', label: 'LinkedIn' },
  { key: 'tiktok_url', icon: 'music_note', label: 'TikTok' },
  { key: 'youtube_url', icon: 'smart_display', label: 'YouTube' },
]

export default function SiteSocialLinks() {
  const { data } = useSiteSettings()
  const active = SOCIALS.filter(s => data?.[s.key])

  if (active.length === 0) return null

  return (
    <div className="flex space-x-3">
      {active.map(s => (
        <a key={s.key} href={data![s.key]!} target="_blank" rel="noopener noreferrer" title={s.label}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#82d8ff] hover:bg-[#82d8ff] hover:text-[#0b1c30] transition-all"
          style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <Icon name={s.icon} style={{ fontSize: '20px' }} />
        </a>
      ))}
    </div>
  )
}
