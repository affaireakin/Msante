'use client'
import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface OrgOverview {
  organizationId: string
  name: string
  city: string | null
  status: string
  logoUrl: string | null
  description: string | null
  openingHours: string | null
  practitionerCount: number
  todayAppointmentCount: number
  pendingAppointmentCount: number
}

function useOrgOverview() {
  return useQuery<OrgOverview | null>({
    queryKey: ['org-overview'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      const organizationId = profile?.organization_id
      if (!organizationId) return null

      const { data: org } = await supabase
        .from('organizations')
        .select('name, city, status, logo_url, description, opening_hours')
        .eq('id', organizationId)
        .single()

      const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0)
      const endOfDay = new Date(startOfDay); endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

      const [{ count: practitionerCount }, { count: todayAppointmentCount }, { count: pendingAppointmentCount }] = await Promise.all([
        supabase.from('practitioners').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('scheduled_at', startOfDay.toISOString())
          .lt('scheduled_at', endOfDay.toISOString())
          .not('status', 'in', '("cancelled")'),
        supabase.from('appointments').select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'pending'),
      ])

      return {
        organizationId,
        name: org?.name ?? '—',
        city: org?.city ?? null,
        status: org?.status ?? 'active',
        logoUrl: org?.logo_url ?? null,
        description: org?.description ?? null,
        openingHours: org?.opening_hours ?? null,
        practitionerCount: practitionerCount ?? 0,
        todayAppointmentCount: todayAppointmentCount ?? 0,
        pendingAppointmentCount: pendingAppointmentCount ?? 0,
      }
    },
    staleTime: 30_000,
  })
}

function LogoUploader({ organizationId, logoUrl }: { organizationId: string; logoUrl: string | null }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Image trop volumineuse (max 5 Mo)'); return }
    setError('')
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${organizationId}/logo.${ext}`
      const { error: uploadError } = await supabase.storage.from('organization-logos').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('organization-logos').getPublicUrl(path)
      // Cache-bust so patients/practitioners see the new logo immediately.
      const bustedUrl = `${publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase.from('organizations').update({ logo_url: bustedUrl }).eq('id', organizationId)
      if (updateError) throw updateError
      void queryClient.invalidateQueries({ queryKey: ['org-overview'] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l\'envoi.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
      style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div className="w-16 h-16 rounded-xl bg-[#e5eeff] flex items-center justify-center overflow-hidden flex-shrink-0 border border-[#d3e4fe]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
        ) : (
          <Icon name="storefront" style={{ fontSize: '28px', color: '#005e7a' }} />
        )}
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="font-semibold text-[#0b1c30] text-sm">Logo de l&apos;organisation</p>
        <p className="text-xs text-[#6f787e] mt-0.5">
          Affiché aux patients lors de la prise de rendez-vous, pour qu&apos;ils reconnaissent votre cabinet.
        </p>
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => void handleFile(e)} />
      <button onClick={() => inputRef.current?.click()} disabled={uploading}
        className="px-4 py-2 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 flex-shrink-0">
        {uploading ? 'Envoi...' : logoUrl ? 'Changer le logo' : 'Ajouter un logo'}
      </button>
    </div>
  )
}

function PublicProfileEditor({ organizationId, description, openingHours }: { organizationId: string; description: string | null; openingHours: string | null }) {
  const queryClient = useQueryClient()
  const [desc, setDesc] = useState(description ?? '')
  const [hours, setHours] = useState(openingHours ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    await supabase.from('organizations').update({ description: desc || null, opening_hours: hours || null }).eq('id', organizationId)
    void queryClient.invalidateQueries({ queryKey: ['org-overview'] })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div>
        <p className="font-semibold text-[#0b1c30] text-sm">Profil public</p>
        <p className="text-xs text-[#6f787e] mt-0.5">Visible par les patients sur la fiche de votre organisation.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Description</label>
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
          placeholder="Présentez votre cabinet, votre équipe, votre approche..."
          className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Horaires d&apos;ouverture</label>
        <textarea value={hours} onChange={e => setHours(e.target.value)} rows={2}
          placeholder="Ex: Lun-Ven 8h-18h, Sam 9h-13h"
          className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
      </div>
      <button onClick={() => void handleSave()} disabled={saving}
        className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
        style={{ backgroundColor: saved ? '#1d7a3a' : '#82d8ff' }}>
        {saving ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
      </button>
    </div>
  )
}

export default function OrganizationOverviewPage() {
  const { data, isLoading, error } = useOrgOverview()

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl h-28 animate-pulse bg-white/40" />)}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
        Impossible de charger les informations de l&apos;organisation.
      </div>
    )
  }

  const KPIS = [
    { label: 'Praticiens', value: data.practitionerCount, icon: 'medical_services', color: '#005e7a', bg: '#e5eeff' },
    { label: "Rendez-vous aujourd'hui", value: data.todayAppointmentCount, icon: 'calendar_today', color: '#1d7a3a', bg: '#e8f5e9' },
    { label: 'RDV en attente', value: data.pendingAppointmentCount, icon: 'schedule', color: '#705d00', bg: '#fff8e1' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">{data.name}</h1>
        <p className="text-sm text-[#6f787e] mt-1">{data.city ? `${data.city} · ` : ''}Vue d&apos;ensemble de votre organisation</p>
      </div>

      <LogoUploader organizationId={data.organizationId} logoUrl={data.logoUrl} />
      <PublicProfileEditor organizationId={data.organizationId} description={data.description} openingHours={data.openingHours} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {KPIS.map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-6 flex items-center gap-4"
            style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
              <Icon name={kpi.icon} style={{ fontSize: '24px', color: kpi.color }} />
            </div>
            <div>
              <p className="text-2xl font-black text-[#0b1c30]">{kpi.value}</p>
              <p className="text-xs text-[#6f787e] font-medium">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <Link href="/organization/practitioners"
        className="inline-flex items-center gap-2 px-5 py-3 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg transition-all">
        <Icon name="group" style={{ fontSize: '18px' }} />
        Gérer mes praticiens
      </Link>
    </div>
  )
}
