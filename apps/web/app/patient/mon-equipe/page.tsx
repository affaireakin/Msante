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
const ROLES = [
  { value: 'medecin_traitant',  label: 'Médecin traitant',    icon: 'stethoscope',       color: '#006685', bg: '#e5eeff' },
  { value: 'psychiatre',        label: 'Psychiatre',           icon: 'psychology',        color: '#1d7a3a', bg: '#dcfce7' },
  { value: 'psychologue',       label: 'Psychologue',          icon: 'self_improvement',  color: '#7c3aed', bg: '#f3e8ff' },
  { value: 'therapeute',        label: 'Thérapeute',           icon: 'favorite',          color: '#be185d', bg: '#fce7f3' },
  { value: 'sophrologue',       label: 'Sophrologue / Coach',  icon: 'spa',               color: '#0f766e', bg: '#ccfbf1' },
  { value: 'kinesitherapeute',  label: 'Kinésithérapeute',     icon: 'accessibility_new', color: '#b45309', bg: '#fef3c7' },
  { value: 'infirmier',         label: 'Infirmier(e)',         icon: 'medical_services',  color: '#475569', bg: '#f1f5f9' },
  { value: 'specialiste',       label: 'Spécialiste',          icon: 'biotech',           color: '#2563eb', bg: '#dbeafe' },
  { value: 'autre',             label: 'Autre',                icon: 'person_add',        color: '#6f787e', bg: '#f8fafc' },
] as const
const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]))

const ACCESS_LEVELS = [
  { value: 'full',           label: 'Complet',    desc: 'Toutes vos données',       color: '#006685' },
  { value: 'limited',        label: 'Limité',     desc: 'Informations essentielles', color: '#705d00' },
  { value: 'document_only',  label: 'Documents',  desc: 'Fichiers uniquement',       color: '#475569' },
  { value: 'emergency_only', label: 'Urgence',    desc: 'Urgences seulement',        color: '#ba1a1a' },
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

interface PractRow {
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

// ─── Hooks ─────────────────────────────────────────────────────────────────
function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: ['patient-team'],
    retry: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .rpc('get_patient_team', { patient_uuid: user.id })
      if (error) throw error
      return (data ?? []).map((r: {
        permission_id: string; practitioner_id: string; role: string; access_level: string;
        expires_at: string | null; allow_notes: boolean; allow_appreciations: boolean;
        allow_mood_journal: boolean; speciality: string; full_name: string
      }) => ({
        id: r.permission_id,
        practitioner_id: r.practitioner_id,
        pract_name: r.full_name ?? 'Praticien',
        pract_speciality: r.speciality ?? '',
        role: r.role ?? 'autre',
        access_level: r.access_level ?? 'limited',
        expires_at: r.expires_at,
        allow_notes: r.allow_notes ?? false,
        allow_appreciations: r.allow_appreciations ?? false,
        allow_mood_journal: r.allow_mood_journal ?? false,
      }))
    },
    staleTime: 30_000,
  })
}

function useAllPractitioners() {
  return useQuery<PractRow[]>({
    queryKey: ['all-practitioners'],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_practitioners')
      if (error) throw error
      return (data ?? []).map((r: PractRow) => ({
        id: r.id,
        user_id: r.user_id,
        speciality: r.speciality ?? '',
        rating: r.rating,
        session_price: r.session_price,
        currency: r.currency ?? 'XOF',
        is_verified: r.is_verified,
        full_name: r.full_name ?? 'Praticien',
      }))
    },
    staleTime: 5 * 60_000,
  })
}

// ─── Modal ajout/édition ───────────────────────────────────────────────────
function AddModal({
  practitioner, onClose, existingId,
}: {
  practitioner: PractRow | TeamMember
  onClose: () => void
  existingId?: string
}) {
  const qc = useQueryClient()
  const isPractRow = 'user_id' in practitioner
  const practId = isPractRow ? (practitioner as PractRow).id : (practitioner as TeamMember).practitioner_id
  const practName = isPractRow ? (practitioner as PractRow).full_name : (practitioner as TeamMember).pract_name
  const existingMember = !isPractRow ? practitioner as TeamMember : null

  const [form, setForm] = useState<AddForm>({
    role: existingMember?.role ?? 'autre',
    access_level: existingMember?.access_level ?? 'limited',
    allow_notes: existingMember?.allow_notes ?? false,
    allow_appreciations: existingMember?.allow_appreciations ?? false,
    allow_mood_journal: existingMember?.allow_mood_journal ?? false,
  })

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      if (existingId) {
        const { error } = await supabase.from('patient_data_permissions').update({
          role: form.role, access_level: form.access_level,
          allow_notes: form.allow_notes, allow_appreciations: form.allow_appreciations,
          allow_mood_journal: form.allow_mood_journal,
        }).eq('id', existingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('patient_data_permissions').insert({
          patient_id: user.id, practitioner_id: practId,
          role: form.role, access_level: form.access_level,
          allow_notes: form.allow_notes, allow_appreciations: form.allow_appreciations,
          allow_mood_journal: form.allow_mood_journal,
        })
        if (error) throw error
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['patient-team'] }); onClose() },
  })

  const toggle = (key: 'allow_notes' | 'allow_appreciations' | 'allow_mood_journal') =>
    setForm(f => ({ ...f, [key]: !f[key] }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-black text-[#0b1c30]">{existingId ? 'Modifier' : 'Ajouter à mon équipe'}</h2>
            <p className="text-sm text-slate-500">{practName}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100">
            <Icon name="close" size={18} color="#475569" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Rôle */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Rôle dans votre équipe</p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(r => (
                <button key={r.value} onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all border"
                  style={{
                    background: form.role === r.value ? r.bg : 'white',
                    borderColor: form.role === r.value ? r.color : '#e2e8f0',
                    color: form.role === r.value ? r.color : '#64748b',
                    fontWeight: form.role === r.value ? 700 : 400,
                  }}>
                  <Icon name={r.icon} size={14} color={form.role === r.value ? r.color : '#94a3b8'} />
                  {r.label}
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
                  className="p-3 rounded-xl border text-left transition-all"
                  style={{
                    background: form.access_level === a.value ? '#f8f9ff' : 'white',
                    borderColor: form.access_level === a.value ? a.color : '#e2e8f0',
                  }}>
                  <p className="text-xs font-bold" style={{ color: a.color }}>{a.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Accès spécifiques</p>
            <div className="space-y-2">
              {([
                ['allow_notes', 'Notes cliniques', 'note_alt'],
                ['allow_appreciations', 'Appréciations', 'star'],
                ['allow_mood_journal', 'Journal d\'humeur', 'mood'],
              ] as [keyof AddForm, string, string][]).map(([key, label, icon]) => (
                <button key={key} onClick={() => toggle(key as 'allow_notes' | 'allow_appreciations' | 'allow_mood_journal')}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon name={icon} size={16} color="#006685" />
                    <span className="text-sm text-[#0b1c30]">{label}</span>
                  </div>
                  <div className={`w-10 h-5 rounded-full transition-colors relative ${form[key] ? 'bg-[#006685]' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form[key] ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {save.error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{(save.error as Error).message}</p>}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Annuler</button>
          <button onClick={() => save.mutate()} disabled={save.isPending}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ background: '#006685' }}>
            {save.isPending ? '...' : existingId ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Remove confirm ────────────────────────────────────────────────────────
function useRemove() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patient_data_permissions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['patient-team'] }),
  })
}

// ─── Page ──────────────────────────────────────────────────────────────────
export default function MonEquipePage() {
  const { data: team = [], isLoading: teamLoading, error: teamError } = useTeam()
  const { data: allPract = [], isLoading: practLoading, error: practError } = useAllPractitioners()
  const remove = useRemove()

  const [modalPract, setModalPract] = useState<PractRow | TeamMember | null>(null)
  const [editingId, setEditingId] = useState<string | undefined>()
  const [specialityFilter, setSpecialityFilter] = useState('tous')

  const teamIds = new Set(team.map(m => m.practitioner_id))

  // Collecte les spécialités disponibles
  const specialities = ['tous', ...Array.from(new Set(allPract.map(p => p.speciality).filter(Boolean))).sort()]

  const filtered = specialityFilter === 'tous'
    ? allPract
    : allPract.filter(p => p.speciality === specialityFilter)

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {modalPract && (
        <AddModal
          practitioner={modalPract}
          existingId={editingId}
          onClose={() => { setModalPract(null); setEditingId(undefined) }}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Mon équipe de soins</h1>
        <p className="text-sm text-slate-500 mt-1">Gérez les praticiens qui suivent votre santé et leurs accès à vos données</p>
      </div>

      {/* Équipe actuelle */}
      <section>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Votre équipe ({team.length})
        </p>
        {teamLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-20 bg-slate-100 rounded-xl" />)}
          </div>
        ) : teamError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700 font-mono break-all">
            {(teamError as Error).message}
          </div>
        ) : team.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-8 text-center">
            <Icon name="group_add" size={36} color="#cbd5e1" />
            <p className="mt-2 text-slate-400 text-sm">Aucun praticien dans votre équipe</p>
            <p className="text-xs text-slate-400 mt-1">Ajoutez un praticien ci-dessous</p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map(member => {
              const role = ROLE_MAP[member.role] ?? ROLE_MAP.autre
              const access = ACCESS_LEVELS.find(a => a.value === member.access_level) ?? ACCESS_LEVELS[1]
              return (
                <div key={member.id} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: role.bg, color: role.color }}>
                    {initials(member.pract_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] truncate">{member.pract_name}</p>
                    <p className="text-xs text-slate-500 truncate">{member.pract_speciality}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: role.bg, color: role.color }}>
                        <Icon name={role.icon} size={10} color={role.color} />
                        {role.label}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100"
                        style={{ color: access.color }}>
                        Accès {access.label}
                      </span>
                      {member.allow_notes && <span className="text-[10px] text-slate-400">Notes</span>}
                      {member.allow_mood_journal && <span className="text-[10px] text-slate-400">Humeur</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => { setModalPract(member); setEditingId(member.id) }}
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-[#006685]">
                      <Icon name="edit" size={16} />
                    </button>
                    <button onClick={() => { if (confirm('Retirer ce praticien de votre équipe ?')) remove.mutate(member.id) }}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500">
                      <Icon name="person_remove" size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Liste des praticiens */}
      <section>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
          Ajouter un praticien
        </p>

        {/* Filtres spécialité */}
        <div className="flex gap-2 flex-wrap mb-4">
          {specialities.map(s => (
            <button key={s} onClick={() => setSpecialityFilter(s)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all capitalize"
              style={{
                background: specialityFilter === s ? '#006685' : 'rgba(255,255,255,0.80)',
                color: specialityFilter === s ? '#fff' : '#475569',
                border: '1px solid',
                borderColor: specialityFilter === s ? '#006685' : '#e2e8f0',
              }}>
              {s === 'tous' ? 'Tous' : s}
            </button>
          ))}
        </div>

        {practLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
          </div>
        ) : practError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-red-700">Erreur — fonctions SQL manquantes</p>
            <p className="text-xs text-red-600 font-mono break-all">{(practError as Error).message}</p>
            <p className="text-xs text-red-500 mt-2">Exécutez les fonctions <code className="bg-red-100 px-1 rounded">list_practitioners()</code> et <code className="bg-red-100 px-1 rounded">get_patient_team()</code> dans l'éditeur SQL Supabase.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-8 text-center">
            <Icon name="person_search" size={32} color="#cbd5e1" />
            <p className="mt-2 text-slate-400 text-sm">Aucun praticien disponible</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(p => {
              const inTeam = teamIds.has(p.id)
              return (
                <div key={p.id} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                    style={{ background: '#e5eeff', color: '#006685' }}>
                    {initials(p.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0b1c30] truncate">{p.full_name}</p>
                    <p className="text-xs text-slate-500 truncate capitalize">{p.speciality}</p>
                    {p.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon name="star" size={11} color="#e4c546" />
                        <span className="text-[10px] text-slate-400">{p.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {inTeam ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        <Icon name="check_circle" size={10} color="#1d7a3a" />
                        Dans l'équipe
                      </span>
                    ) : (
                      <button onClick={() => { setModalPract(p); setEditingId(undefined) }}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full transition-colors"
                        style={{ background: '#e5eeff', color: '#006685' }}>
                        <Icon name="person_add" size={10} color="#006685" />
                        Ajouter
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Note info */}
      <div className="bg-[#e5eeff] rounded-xl p-4 flex gap-3">
        <Icon name="info" size={18} color="#006685" />
        <p className="text-xs text-[#006685] leading-relaxed">
          Les praticiens de votre équipe peuvent accéder aux données que vous autorisez.
          Vous pouvez modifier ou révoquer ces accès à tout moment. Chaque accès est consigné dans votre{' '}
          <Link href="/patient/journal-acces" className="font-bold underline">journal d'accès</Link>.
        </p>
      </div>
    </div>
  )
}
