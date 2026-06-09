'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>{name}</span>
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ─── Constantes ────────────────────────────────────────────────────────────
const ROLES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'medecin_traitant',  label: 'Médecin traitant',    icon: 'stethoscope',         color: '#006685', bg: '#e5eeff' },
  { value: 'psychiatre',        label: 'Psychiatre',           icon: 'psychology',          color: '#1d7a3a', bg: '#dcfce7' },
  { value: 'psychologue',       label: 'Psychologue',          icon: 'self_improvement',    color: '#7c3aed', bg: '#f3e8ff' },
  { value: 'therapeute',        label: 'Thérapeute principal', icon: 'favorite',            color: '#be185d', bg: '#fce7f3' },
  { value: 'sophrologue',       label: 'Sophrologue / Coach',  icon: 'spa',                 color: '#0f766e', bg: '#ccfbf1' },
  { value: 'kinesitherapeute',  label: 'Kinésithérapeute',     icon: 'accessibility_new',   color: '#b45309', bg: '#fef3c7' },
  { value: 'infirmier',         label: 'Infirmier(e)',         icon: 'medical_services',    color: '#475569', bg: '#f1f5f9' },
  { value: 'specialiste',       label: 'Spécialiste',          icon: 'biotech',             color: '#2563eb', bg: '#dbeafe' },
  { value: 'autre',             label: 'Autre',                icon: 'person_add',          color: '#6f787e', bg: '#f8fafc' },
]
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]))

const ACCESS_LEVELS = [
  { value: 'full',           label: 'Complet',          desc: 'Toutes vos données',        color: '#006685' },
  { value: 'limited',        label: 'Limité',           desc: 'Informations essentielles',  color: '#705d00' },
  { value: 'document_only',  label: 'Documents',        desc: 'Fichiers uniquement',        color: '#475569' },
  { value: 'emergency_only', label: 'Urgence',          desc: 'Cas d\'urgence seulement',   color: '#ba1a1a' },
]

// ─── Types ─────────────────────────────────────────────────────────────────
interface TeamMember {
  id: string
  practitioner_id: string
  pract_name: string
  pract_speciality: string
  role: string
  access_level: string
  expires_at: string | null
  allow_notes: boolean
  allow_appreciations: boolean
  allow_mood_journal: boolean
}

interface SearchResult {
  id: string
  user_id: string
  speciality: string
  rating: number | null
  session_price: number | null
  currency: string
  is_verified: boolean
  full_name: string
}

interface AddForm {
  role: string
  access_level: string
  allow_notes: boolean
  allow_appreciations: boolean
  allow_mood_journal: boolean
}

// ─── Hooks ──────────────────────────────────────────────────────────────────
function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: ['patient-team'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('patient_data_permissions')
        .select(`id, practitioner_id, role, access_level, expires_at,
                 allow_notes, allow_appreciations, allow_mood_journal,
                 practitioner:practitioner_id(speciality, user:user_id(full_name))`)
        .eq('patient_id', user.id)
        .order('id', { ascending: true })
      if (error) throw error
      return (data ?? []).map(r => {
        const p = r.practitioner as unknown as { speciality: string; user: { full_name: string } }
        return {
          id: r.id,
          practitioner_id: r.practitioner_id as string,
          pract_name: p?.user?.full_name ?? 'Praticien',
          pract_speciality: p?.speciality ?? '',
          role: (r.role as string) ?? 'autre',
          access_level: (r.access_level as string) ?? 'limited',
          expires_at: r.expires_at as string | null,
          allow_notes: (r.allow_notes as boolean) ?? false,
          allow_appreciations: (r.allow_appreciations as boolean) ?? false,
          allow_mood_journal: (r.allow_mood_journal as boolean) ?? false,
        }
      })
    },
    staleTime: 30_000,
  })
}

function useSearch(q: string) {
  return useQuery<SearchResult[]>({
    queryKey: ['pract-search', q],
    enabled: q.trim().length >= 2,
    queryFn: async () => {
      // Recherche en parallèle : par spécialité (direct) + par nom via users
      const [bySpeciality, byName] = await Promise.all([
        supabase
          .from('practitioners')
          .select('id, user_id, speciality, rating, session_price, currency, is_verified')
          .ilike('speciality', `%${q}%`)
          .limit(15),
        supabase
          .from('users')
          .select('id, full_name')
          .ilike('full_name', `%${q}%`)
          .limit(15),
      ])

      // Récupérer les praticiens correspondant aux noms trouvés
      const matchedUserIds = (byName.data ?? []).map(u => u.id)
      const byNamePract = matchedUserIds.length > 0
        ? await supabase
            .from('practitioners')
            .select('id, user_id, speciality, rating, session_price, currency, is_verified')
            .in('user_id', matchedUserIds)
            .limit(15)
        : { data: [] as typeof bySpeciality.data }

      // Dédoublonner et construire la map nom
      const nameMap = Object.fromEntries((byName.data ?? []).map(u => [u.id, u.full_name]))
      const seen = new Set<string>()
      const combined = [...(bySpeciality.data ?? []), ...(byNamePract.data ?? [])]
        .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })

      return combined.map(r => ({
        id: r.id,
        user_id: r.user_id,
        speciality: r.speciality ?? '',
        rating: r.rating,
        session_price: r.session_price,
        currency: r.currency ?? 'XOF',
        is_verified: r.is_verified,
        full_name: nameMap[r.user_id] ?? 'Praticien',
      }))
    },
    staleTime: 60_000,
  })
}

// ─── Composants UI ──────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const r = ROLE_MAP[role] ?? ROLE_MAP.autre
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ background: r.bg, color: r.color }}>
      <Icon name={r.icon} size={12} color={r.color} />
      {r.label}
    </span>
  )
}

function AccessBadge({ level }: { level: string }) {
  const a = ACCESS_LEVELS.find(l => l.value === level) ?? ACCESS_LEVELS[1]
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
      {a.label}
    </span>
  )
}

// ─── Modal Ajout / Édition ──────────────────────────────────────────────────
function AddModal({
  practitioner, onClose, existingId,
}: {
  practitioner: SearchResult | TeamMember
  onClose: () => void
  existingId?: string
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AddForm>(() => {
    if ('pract_name' in practitioner) {
      const m = practitioner as TeamMember
      return { role: m.role, access_level: m.access_level, allow_notes: m.allow_notes, allow_appreciations: m.allow_appreciations, allow_mood_journal: m.allow_mood_journal }
    }
    return { role: 'autre', access_level: 'limited', allow_notes: false, allow_appreciations: false, allow_mood_journal: false }
  })

  const practId = 'practitioner_id' in practitioner
    ? (practitioner as TeamMember).practitioner_id
    : (practitioner as SearchResult).id
  const practName = 'pract_name' in practitioner
    ? (practitioner as TeamMember).pract_name
    : (practitioner as SearchResult).full_name

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      if (existingId) {
        const { error } = await supabase.from('patient_data_permissions').update({
          role: form.role,
          access_level: form.access_level,
          allow_notes: form.allow_notes,
          allow_appreciations: form.allow_appreciations,
          allow_mood_journal: form.allow_mood_journal,
        }).eq('id', existingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('patient_data_permissions').insert({
          patient_id: user.id,
          practitioner_id: practId,
          role: form.role,
          access_level: form.access_level,
          allow_notes: form.allow_notes,
          allow_appreciations: form.allow_appreciations,
          allow_mood_journal: form.allow_mood_journal,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-team'] }); onClose() },
  })

  const toggle = (key: keyof AddForm) => setForm(f => ({ ...f, [key]: !f[key as 'allow_notes'] }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-black text-[#0b1c30]">{existingId ? 'Modifier' : 'Ajouter'}</h2>
            <p className="text-sm text-slate-500">{practName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors">
            <Icon name="close" size={18} color="#475569" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Rôle */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rôle dans votre équipe</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all border"
                  style={{
                    background: form.role === r.value ? r.bg : 'white',
                    color: form.role === r.value ? r.color : '#475569',
                    borderColor: form.role === r.value ? r.color : '#e2e8f0',
                  }}>
                  <Icon name={r.icon} size={14} color={form.role === r.value ? r.color : '#94a3b8'} />
                  <span className="truncate">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Niveau d'accès */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Niveau d'accès</p>
            <div className="grid grid-cols-2 gap-2">
              {ACCESS_LEVELS.map(a => (
                <button key={a.value} onClick={() => setForm(f => ({ ...f, access_level: a.value }))}
                  className="flex flex-col px-3 py-2.5 rounded-xl text-left transition-all border"
                  style={{
                    background: form.access_level === a.value ? `${a.color}12` : 'white',
                    borderColor: form.access_level === a.value ? a.color : '#e2e8f0',
                  }}>
                  <span className="text-xs font-bold" style={{ color: form.access_level === a.value ? a.color : '#0b1c30' }}>{a.label}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles données */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Données autorisées</p>
            <div className="space-y-2">
              {([
                { key: 'allow_notes',         label: 'Notes cliniques',  icon: 'description' },
                { key: 'allow_appreciations', label: 'Appréciations',    icon: 'star' },
                { key: 'allow_mood_journal',  label: 'Journal & mood',   icon: 'mood' },
              ] as const).map(t => {
                const val = form[t.key]
                return (
                  <button key={t.key} onClick={() => toggle(t.key)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all"
                    style={{ background: val ? '#e5eeff' : 'white', borderColor: val ? '#006685' : '#e2e8f0' }}>
                    <span className="flex items-center gap-2 text-sm font-medium text-[#0b1c30]">
                      <Icon name={t.icon} size={16} color={val ? '#006685' : '#94a3b8'} />
                      {t.label}
                    </span>
                    <div className="w-9 h-5 rounded-full relative transition-colors flex-shrink-0"
                      style={{ background: val ? '#006685' : '#cbd5e1' }}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                        style={{ left: val ? '18px' : '2px' }} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors disabled:opacity-60"
            style={{ background: '#006685' }}>
            {save.isPending ? '...' : existingId ? 'Enregistrer' : 'Ajouter à mon équipe'}
          </button>
        </div>
        {save.error && <p className="px-5 pb-4 text-xs text-red-600">{(save.error as Error).message}</p>}
      </div>
    </div>
  )
}

// ─── Page principale ────────────────────────────────────────────────────────
export default function MonEquipePage() {
  const qc = useQueryClient()
  const { data: team = [], isLoading } = useTeam()
  const [searchQ, setSearchQ] = useState('')
  const [modal, setModal] = useState<{ practitioner: SearchResult | TeamMember; existingId?: string } | null>(null)

  const { data: searchResults = [], isFetching: searching } = useSearch(searchQ)

  const teamIds = new Set(team.map(m => m.practitioner_id))

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_data_permissions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-team'] }),
  })

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Mon équipe de soins</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Gérez les praticiens qui font partie de votre suivi et définissez leurs accès à vos données
        </p>
      </div>

      {/* Équipe actuelle */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
          Votre équipe ({team.length})
        </h2>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2].map(i => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
          </div>
        ) : team.length === 0 ? (
          <div className="bg-white/60 border border-white/80 rounded-2xl p-10 text-center shadow-sm">
            <Icon name="group_add" size={48} color="#cbd5e1" />
            <p className="mt-3 text-slate-400 font-medium">Aucun praticien dans votre équipe</p>
            <p className="text-xs text-slate-400 mt-1">Recherchez un praticien ci-dessous pour l'ajouter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map(m => {
              const roleInfo = ROLE_MAP[m.role] ?? ROLE_MAP.autre
              return (
                <div key={m.id} className="bg-white/70 backdrop-blur-sm border border-white/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
                      style={{ background: roleInfo.color }}>
                      {initials(m.pract_name)}
                    </div>

                    {/* Infos */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-[#0b1c30]">{m.pract_name}</p>
                        <RoleBadge role={m.role} />
                        <AccessBadge level={m.access_level} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 capitalize">{m.pract_speciality}</p>

                      {/* Données autorisées */}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {m.allow_notes && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-[#e5eeff] text-[#006685] px-1.5 py-0.5 rounded-full">
                            <Icon name="description" size={11} color="#006685" />Notes
                          </span>
                        )}
                        {m.allow_appreciations && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-[#fef9c3] text-[#705d00] px-1.5 py-0.5 rounded-full">
                            <Icon name="star" size={11} color="#705d00" />Appréciations
                          </span>
                        )}
                        {m.allow_mood_journal && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-[#dcfce7] text-[#1d7a3a] px-1.5 py-0.5 rounded-full">
                            <Icon name="mood" size={11} color="#1d7a3a" />Mood
                          </span>
                        )}
                        {!m.allow_notes && !m.allow_appreciations && !m.allow_mood_journal && (
                          <span className="text-[11px] text-slate-400">Aucune donnée spécifique</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => setModal({ practitioner: m, existingId: m.id })}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
                        title="Modifier">
                        <Icon name="edit" size={15} color="#475569" />
                      </button>
                      <button
                        onClick={() => { if (confirm(`Retirer ${m.pract_name} de votre équipe ?`)) remove.mutate(m.id) }}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-red-100 hover:bg-red-50 transition-colors"
                        title="Retirer">
                        <Icon name="person_remove" size={15} color="#ba1a1a" />
                      </button>
                    </div>
                  </div>

                  {m.expires_at && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1 text-[11px] text-amber-600">
                      <Icon name="schedule" size={12} color="#d97706" />
                      Expire le {new Date(m.expires_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Rechercher et ajouter */}
      <section>
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
          Ajouter un praticien
        </h2>

        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/70 border border-white/80 shadow-sm mb-4">
          <Icon name="search" size={18} color="#6f787e" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Rechercher par nom ou spécialité…"
            className="bg-transparent flex-1 text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none"
          />
          {searching && <span className="text-xs text-slate-400">Recherche…</span>}
          {searchQ && !searching && (
            <button onClick={() => setSearchQ('')} className="text-slate-400 hover:text-slate-600">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>

        {/* Résultats */}
        {searchQ.length >= 2 && (
          <div className="space-y-2">
            {searchResults.length === 0 && !searching && (
              <div className="text-center py-6 text-sm text-slate-400">
                Aucun praticien trouvé pour « {searchQ} »
              </div>
            )}
            {searchResults.map(p => {
              const already = teamIds.has(p.id)
              return (
                <div key={p.id} className="bg-white/70 border border-white/80 rounded-xl p-4 flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-full bg-[#006685] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {initials(p.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#0b1c30] text-sm">{p.full_name}</p>
                      {p.is_verified && (
                        <Icon name="verified" size={14} color="#006685" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 capitalize">{p.speciality}</p>
                    {p.session_price && (
                      <p className="text-xs text-slate-400">
                        {p.session_price.toLocaleString('fr-FR')} {p.currency} / séance
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link href={`/patient/book/${p.id}`}
                      className="px-3 py-1.5 text-xs font-semibold border border-[#006685] text-[#006685] rounded-xl hover:bg-[#e5eeff] transition-colors">
                      Réserver
                    </Link>
                    {already ? (
                      <span className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-400">
                        Déjà dans l'équipe
                      </span>
                    ) : (
                      <button
                        onClick={() => setModal({ practitioner: p })}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl text-white transition-colors"
                        style={{ background: '#006685' }}>
                        <Icon name="add" size={14} color="#fff" />
                        Ajouter
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {searchQ.length < 2 && (
          <div className="text-center py-8 text-sm text-slate-400">
            <Icon name="manage_search" size={40} color="#e2e8f0" />
            <p className="mt-2">Tapez au moins 2 caractères pour rechercher</p>
          </div>
        )}
      </section>

      {/* Info */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <Icon name="info" size={16} color="#2563eb" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Les praticiens de votre équipe peuvent accéder aux données que vous autorisez.
          Vous pouvez modifier ou révoquer ces accès à tout moment. Chaque accès est consigné dans votre{' '}
          <Link href="/patient/journal-acces" className="underline font-semibold">journal d'accès</Link>.
        </p>
      </div>

      {/* Modal */}
      {modal && (
        <AddModal
          practitioner={modal.practitioner}
          existingId={modal.existingId}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
