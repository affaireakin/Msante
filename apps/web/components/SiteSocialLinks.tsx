'use client'
import { useSiteSettings } from '@/lib/useSiteSettings'

// Tracés simplifiés des véritables logos (pas d'icônes génériques) — un seul
// path par réseau, coloré via currentColor pour suivre le style du bouton
// (cercle glassmorphique, couleur qui s'inverse au survol).
function SocialGlyph({ platform }: { platform: string }) {
  switch (platform) {
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-.303-.018-.658-.019-1.049-.019-1.019 0-1.564.267-1.923.836-.257.408-.325.877-.325 1.577v1.58h3.925l-.585 3.667h-3.34v7.98H9.101z" />
        </svg>
      )
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
          <circle cx="12" cy="12" r="4.6" />
          <circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'twitter':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      )
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M16.436.02c.083 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07 1.3-.01 2.6-.02 3.91-.03z" />
        </svg>
      )
    case 'youtube':
      return (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12z" />
        </svg>
      )
    default:
      return null
  }
}

const SOCIALS: { key: 'facebook_url' | 'instagram_url' | 'twitter_url' | 'linkedin_url' | 'tiktok_url' | 'youtube_url'; platform: string; label: string }[] = [
  { key: 'facebook_url',  platform: 'facebook',  label: 'Facebook' },
  { key: 'instagram_url', platform: 'instagram', label: 'Instagram' },
  { key: 'twitter_url',   platform: 'twitter',   label: 'X' },
  { key: 'linkedin_url',  platform: 'linkedin',  label: 'LinkedIn' },
  { key: 'tiktok_url',    platform: 'tiktok',    label: 'TikTok' },
  { key: 'youtube_url',   platform: 'youtube',   label: 'YouTube' },
]

export default function SiteSocialLinks() {
  const { data } = useSiteSettings()
  const active = SOCIALS.filter(s => data?.[s.key])

  if (active.length === 0) return null

  return (
    <div className="flex space-x-3">
      {active.map(s => (
        <a key={s.key} href={data![s.key]!} target="_blank" rel="noopener noreferrer" aria-label={s.label} title={s.label}
          className="w-10 h-10 rounded-full flex items-center justify-center text-[#82d8ff] hover:bg-[#82d8ff] hover:text-[#0b1c30] transition-all"
          style={{ background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.3)' }}>
          <SocialGlyph platform={s.platform} />
        </a>
      ))}
    </div>
  )
}
