'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSiteSettings as usePublicSiteSettings, type PublicSiteSettings } from '@/lib/useSiteSettings'

export type SiteSettings = PublicSiteSettings

export interface ContentPage {
  id: string
  slug: string
  title: string
  body: string
  updated_at: string
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  sort_order: number
  is_published: boolean
}

export function useSiteSettings() {
  const qc = useQueryClient()
  const settings = usePublicSiteSettings()

  const save = useMutation({
    mutationFn: async (patch: Partial<SiteSettings>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('site_settings').update({ ...patch, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['public-site-settings'] }),
  })

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `site/logo.${ext}`
      const { error: uploadError } = await supabase.storage.from('site-assets').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(path)
      const bustedUrl = `${publicUrl}?t=${Date.now()}`
      await save.mutateAsync({ logo_url: bustedUrl })
    },
  })

  return { settings, save, uploadLogo }
}

export function useContentPage(slug: string) {
  const qc = useQueryClient()

  const page = useQuery<ContentPage>({
    queryKey: ['content-page', slug],
    queryFn: async () => {
      const { data, error } = await supabase.from('content_pages').select('*').eq('slug', slug).single()
      if (error) throw error
      return data
    },
  })

  const save = useMutation({
    mutationFn: async (body: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('content_pages').update({ body, updated_by: user?.id ?? null, updated_at: new Date().toISOString() }).eq('slug', slug)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['content-page', slug] }),
  })

  return { page, save }
}

export function useFaqAdmin() {
  const qc = useQueryClient()

  const items = useQuery<FaqItem[]>({
    queryKey: ['faq-items-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('faq_items').select('*').order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })

  const create = useMutation({
    mutationFn: async (input: { question: string; answer: string }) => {
      const maxOrder = Math.max(0, ...(items.data ?? []).map(i => i.sort_order))
      const { error } = await supabase.from('faq_items').insert({ ...input, sort_order: maxOrder + 1 })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['faq-items-admin'] }),
  })

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<Pick<FaqItem, 'question' | 'answer' | 'is_published' | 'sort_order'>>) => {
      const { error } = await supabase.from('faq_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['faq-items-admin'] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('faq_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['faq-items-admin'] }),
  })

  return { items, create, update, remove }
}
