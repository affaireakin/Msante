'use client'
import { useSiteSettings } from '@/lib/useSiteSettings'

export default function SiteLogo({ size = 40 }: { size?: number }) {
  const { data } = useSiteSettings()
  const src = data?.logo_url || '/logo.png'

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="M-Santé" style={{ width: size, height: size, borderRadius: size * 0.28 }} className="object-cover shadow-md" />
  )
}
