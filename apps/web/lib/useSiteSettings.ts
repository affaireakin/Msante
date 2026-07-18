'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface PublicSiteSettings {
  logo_url: string | null
  phone: string | null
  whatsapp_number: string | null
  contact_email: string | null
  facebook_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  linkedin_url: string | null
  tiktok_url: string | null
  youtube_url: string | null
}

export function useSiteSettings() {
  return useQuery<PublicSiteSettings>({
    queryKey: ['public-site-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single()
      if (error) throw error
      return data
    },
    staleTime: 5 * 60_000,
  })
}
