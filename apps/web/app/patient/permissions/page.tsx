'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1, userSelect: 'none' }}>{name}</span>
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

const EXPIRY_OPTIONS = [
  { value: 'none',  label: 'Pas d\'expiration' },
  { value: '24h',   label: '24 heures' },
  { value: '7d',    label: '7 jours' },
  { value: '30d',   label: '30 jours' },
  { value: '90d',   label: '3 mois' },
]

const ACCESS_LEVELS = [
  { value: 'full',           label: 'Accès complet',    color: '#82d8ff', desc: 'Toutes les données' },
  { value: 'limited',        label: 'Limité',           color: '#705d00', desc: 'Informations essentielles' },
  { value: 'document_only',  label: 'Documents seuls',  color: '#475569', desc: 'Fichiers uniquement' },
  { value: 'emergency_only', label: 'Urgence',          color: '#ba1a1a', desc: 'En cas d\'urgence seulement' },
]

const DATA_TOGGLES = [
  { key: 'allow_notes',         label: 'Notes cliniques',   icon: 'description' },
  { key: 'allow_appreciations', label: 'Appréciations',     icon: 'star' },
  { key: 'allow_mood_journal',  label: 'Journal mood',      icon: 'mood' },
]

interface PatientPermission {
  id: string
  practitioner_id: string
  pract_name: string
  pract_speciality: string
  access_level: string
  expires_at: string | null
  allow_notes: boolean
  allow_appreciations: boolean
  allow_mood_journal: boolean
  notes: string | null
}

interface EditState {
  access_level: string
  expiry: string
  allow_notes: boolean
  allow_appreciations: boolean
  allow_mood_journal: boolean
  notes: string
}

function usePermissions() {
  return useQuery<PatientPermission[]>({
    queryKey: ['patient-permissions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('patient_data_permissions')
        .select(`id, practitioner_id, access_level, expires_at, allow_notes, allow_appreciations, allow_mood_journal, notes,
                 practitioner:practitioners!patient_data_permissions_practitioner_id_fkey(
                   speciality,
                   user:users!practitioners_user_id_fkey(full_name)
                 )`)
        .eq('patient_id', user.id)
        .order('id', { ascending: false })
      if (error) throw error
      return (data ?? []).map(r => {
        const pract = r.practitioner as unknown as { speciality: string; user: { full_name: string } }
        return {
          id: r.id,
          practitioner_id: r.practitioner_id,
          pract_name: pract?.user?.full_name ?? 'Praticien',
          pract_speciality: pract?.speciality ?? '',
          access_level: r.access_level ?? 'limited',
          expires_at: r.expires_at,
          allow_notes: r.allow_notes ?? true,
          allow_appreciations: r.allow_appreciations ?? true,
          allow_mood_journal: r.allow_mood_journal ?? false,
          notes: r.notes,
        }
      })
    },
    staleTime: 60_000,
  })
}

function expiryToDate(expiry: string): string | null {
  if (expiry === 'none') return null
  const now = new Date()
  if (expiry === '24h') now.setHours(now.getHours() + 24)
  else if (expiry === '7d') now.setDate(now.getDate() + 7)
  else if (expiry === '30d') now.setDate(now.getDate() + 30)
  else if (expiry === '90d') now.setDate(now.getDate() + 90)
  return now.toISOString()
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isExpired(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function EditDrawer({
  perm,
  onClose,
}: {
  perm: PatientPermission
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<EditState>({
    access_level: perm.access_level,
    expiry: 'none',
    allow_notes: perm.allow_notes,
    allow_appreciations: perm.allow_appreciations,
    allow_mood_journal: perm.allow_mood_journal,
    notes: perm.notes ?? '',
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('patient_data_permissions').update({
        access_level: state.access_level,
        expires_at: state.expiry === 'none' ? null : expiryToDate(state.expiry),
        allow_notes: state.allow_notes,
        allow_appreciations: state.allow_appreciations,
        allow_mood_journal: state.allow_mood_journal,
        notes: state.notes || null,
      }).eq('id', perm.id)
      if (error) throw error
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['patient-permissions'] }); onClose() },
    onError: (err: Error) => alert(err.message),
  })

  const revokeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('patient_data_permissions').delete().eq('id', perm.id)
      if (error) throw error
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['patient-permissions'] }); onClose() },
    onError: (err: Error) => alert(err.message),
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full sm:w-96 h-full bg-white flex flex-col overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">{perm.pract_name}</h2>
            <p className="text-xs text-[#6f787e] capitalize">{perm.pract_speciality}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
            <Icon name="close" size={18} color="#6f787e" />
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Niveau d'accès */}
          <div>
            <p className="text-xs font-semibold text-[#3f484d] uppercase tracking-wider mb-2">Niveau d'accès</p>
            <div className="grid grid-cols-2 gap-2">
              {ACCESS_LEVELS.map(lvl => (
                <button key={lvl.value} onClick={() => setState(s => ({ ...s, access_level: lvl.value }))}
                  className="flex flex-col items-start px-3 py-2.5 rounded-xl border transition-all text-left"
                  style={{
                    borderColor: state.access_level === lvl.value ? lvl.color : '#e2e8f0',
                    backgroundColor: state.access_level === lvl.value ? `${lvl.color}10` : 'transparent',
                  }}>
                  <span className="text-xs font-semibold" style={{ color: lvl.color }}>{lvl.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <p className="text-xs font-semibold text-[#3f484d] uppercase tracking-wider mb-2">Durée d'accès</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPIRY_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setState(s => ({ ...s, expiry: opt.value }))}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={{
                    borderColor: state.expiry === opt.value ? '#82d8ff' : '#e2e8f0',
                    backgroundColor: state.expiry === opt.value ? '#e5eeff' : 'transparent',
                    color: state.expiry === opt.value ? '#82d8ff' : '#3f484d',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
            {perm.expires_at && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Expiration actuelle : {fmtDate(perm.expires_at)} {isExpired(perm.expires_at) ? '(expiré)' : ''}
              </p>
            )}
          </div>

          {/* Toggles catégories */}
          <div>
            <p className="text-xs font-semibold text-[#3f484d] uppercase tracking-wider mb-2">Données autorisées</p>
            <div className="space-y-2">
              {DATA_TOGGLES.map(t => {
                const checked = state[t.key as keyof EditState] as boolean
                return (
                  <div key={t.key} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Icon name={t.icon} size={16} color="#6f787e" />
                      <span className="text-sm text-[#0b1c30]">{t.label}</span>
                    </div>
                    <button type="button" onClick={() => setState(s => ({ ...s, [t.key]: !checked }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-[#82d8ff]' : 'bg-slate-300'}`}>
                      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Note interne */}
          <div>
            <p className="text-xs font-semibold text-[#3f484d] uppercase tracking-wider mb-2">Note personnelle</p>
            <textarea value={state.notes} onChange={e => setState(s => ({ ...s, notes: e.target.value }))}
              rows={2} placeholder="Raison de cet accès, remarques…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-[#0b1c30] placeholder-slate-400 outline-none focus:border-[#82d8ff] resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 space-y-2">
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all active:scale-95"
            style={{ backgroundColor: '#82d8ff' }}>
            {saveMutation.isPending
              ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Enregistrement…</>
              : <><Icon name="save" size={16} color="#fff" />Enregistrer</>}
          </button>
          <button onClick={() => { if (confirm('Révoquer l\'accès de ce praticien ?')) revokeMutation.mutate() }}
            disabled={revokeMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-red-500 bg-red-50 hover:bg-red-100 border border-red-100 transition-colors disabled:opacity-50">
            <Icon name="block" size={16} color="#ba1a1a" />
            Révoquer l'accès
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PatientPermissionsPage() {
  const { data: permissions = [], isLoading, error } = usePermissions()
  const [editing, setEditing] = useState<PatientPermission | null>(null)

  const active = permissions.filter(p => !isExpired(p.expires_at))
  const expired = permissions.filter(p => isExpired(p.expires_at))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Mes permissions d'accès</h1>
        <p className="text-sm text-slate-500 mt-0.5">Gérez quelles données chaque praticien peut consulter</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-[#e5eeff] border border-[#bee9ff] rounded-xl px-4 py-3">
        <Icon name="shield_person" size={18} color="#82d8ff" />
        <div className="text-xs text-[#005e7a] leading-relaxed">
          <strong>Vous contrôlez vos données.</strong> Les permissions ici s'appliquent par-dessus les règles de votre profession. Un praticien ne peut jamais accéder à plus que ce que vous autorisez ici.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-[#82d8ff]">{active.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Accès actifs</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-amber-600">{permissions.filter(p => p.expires_at && !isExpired(p.expires_at)).length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Temporaires</p>
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-4 text-center shadow-sm">
          <p className="text-2xl font-black text-slate-400">{expired.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Expirés</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-xl" />)}</div>
      ) : error ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-8 text-center">
          <Icon name="error" size={32} color="#ba1a1a" />
          <p className="mt-2 text-sm text-slate-500">{(error as Error).message}</p>
        </div>
      ) : permissions.length === 0 ? (
        <div className="bg-white/60 border border-white/80 rounded-xl p-10 text-center shadow-sm">
          <Icon name="shield_person" size={48} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm font-medium">Aucun praticien n'a d'accès configuré</p>
          <p className="text-xs text-slate-400 mt-1">Les accès sont créés lors de vos rendez-vous.</p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#3f484d] uppercase tracking-wider">Accès actifs</p>
              {active.map(perm => <PermCard key={perm.id} perm={perm} onEdit={() => setEditing(perm)} />)}
            </div>
          )}
          {expired.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accès expirés</p>
              {expired.map(perm => <PermCard key={perm.id} perm={perm} onEdit={() => setEditing(perm)} dimmed />)}
            </div>
          )}
        </>
      )}

      {editing && <EditDrawer perm={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PermCard({ perm, onEdit, dimmed }: { perm: PatientPermission; onEdit: () => void; dimmed?: boolean }) {
  const lvl = ACCESS_LEVELS.find(a => a.value === perm.access_level) ?? ACCESS_LEVELS[1]
  const expiredStatus = isExpired(perm.expires_at)

  return (
    <div className={`bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-4 transition-all ${dimmed ? 'opacity-50' : 'hover:shadow-md'}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#e5eeff] flex items-center justify-center text-[#82d8ff] text-sm font-bold flex-shrink-0">
            {initials(perm.pract_name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-[#0b1c30]">{perm.pract_name}</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${lvl.color}15`, color: lvl.color }}>
                {lvl.label}
              </span>
              {expiredStatus && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-500 border border-red-100">Expiré</span>
              )}
            </div>
            <p className="text-xs text-slate-400 capitalize mt-0.5">{perm.pract_speciality}</p>
          </div>
        </div>
        <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#82d8ff] bg-[#e5eeff] hover:bg-[#bee9ff] transition-colors flex-shrink-0">
          <Icon name="edit" size={14} color="#82d8ff" />
          Modifier
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {[
          { key: 'allow_notes', label: 'Notes', icon: 'description', val: perm.allow_notes },
          { key: 'allow_appreciations', label: 'Appréciations', icon: 'star', val: perm.allow_appreciations },
          { key: 'allow_mood_journal', label: 'Journal mood', icon: 'mood', val: perm.allow_mood_journal },
        ].map(t => (
          <span key={t.key} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
            style={{ background: t.val ? '#dcfce7' : '#fef2f2', color: t.val ? '#1d7a3a' : '#ba1a1a' }}>
            <Icon name={t.val ? 'check_circle' : 'cancel'} size={12} color={t.val ? '#1d7a3a' : '#ba1a1a'} />
            {t.label}
          </span>
        ))}
        {perm.expires_at && !expiredStatus && (
          <span className="text-[11px] text-amber-600 ml-auto">
            Expire le {fmtDate(perm.expires_at)}
          </span>
        )}
      </div>
    </div>
  )
}
