'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

type AllowedRole = 'patient' | 'practitioner' | 'admin'

interface PrefixRow {
  id: string
  prefix: string
  label: string
  allowed_roles: AllowedRole[]
  is_active: boolean
  sort_order: number
  created_at: string
}

interface PrefixForm {
  prefix: string
  label: string
  allowed_roles: AllowedRole[]
  sort_order: number
  is_active: boolean
}

const EMPTY_FORM: PrefixForm = {
  prefix: '',
  label: '',
  allowed_roles: ['practitioner'],
  sort_order: 0,
  is_active: true,
}

// ─── Role config ─────────────────────────────────────────────────────────────

const ROLES: { id: AllowedRole; label: string; bg: string; color: string }[] = [
  { id: 'practitioner', label: 'Médecin',         bg: '#e5eeff', color: '#006685' },
  { id: 'patient',      label: 'Patient',          bg: '#e8f5e9', color: '#1d7a3a' },
  { id: 'admin',        label: 'Administrateur',   bg: '#ede9fe', color: '#7c3aed' },
]

function RolePill({ role }: { role: AllowedRole }) {
  const r = ROLES.find(x => x.id === role)
  if (!r) return null
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: r.bg, color: r.color }}>
      {r.label}
    </span>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function PrefixModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: PrefixForm
  onClose: () => void
  onSave: (f: PrefixForm) => void
  saving: boolean
}) {
  const [form, setForm] = useState<PrefixForm>(initial)

  const toggleRole = (r: AllowedRole) => {
    setForm(f => ({
      ...f,
      allowed_roles: f.allowed_roles.includes(r)
        ? f.allowed_roles.filter(x => x !== r)
        : [...f.allowed_roles, r],
    }))
  }

  const valid = form.prefix.trim().length > 0 && form.label.trim().length > 0 && form.allowed_roles.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-7 flex flex-col gap-5"
        style={{ backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,102,133,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0b1c30]">
              {initial.prefix ? 'Modifier le préfixe' : 'Ajouter un préfixe'}
            </h2>
            <p className="text-sm text-[#6f787e] mt-0.5">Définissez les rôles autorisés</p>
          </div>
          <button onClick={onClose} className="text-[#6f787e] hover:text-[#0b1c30] text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Préfixe *</label>
            <input
              value={form.prefix}
              onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
              placeholder="Dr, Pr, M., Mme…"
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all text-sm font-bold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Libellé *</label>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Docteur, Professeur…"
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Rôles autorisés *</label>
          <div className="flex flex-col gap-2">
            {ROLES.map(r => (
              <label key={r.id} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-[#e5eeff] hover:bg-[#f8f9ff] transition-colors">
                <input
                  type="checkbox"
                  checked={form.allowed_roles.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                  className="w-4 h-4 accent-[#006685]"
                />
                <span className="text-sm font-medium text-[#0b1c30]">{r.label}</span>
                <span className="text-xs text-[#6f787e] ml-auto">{r.id}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8f9ff] border border-[#e5eeff]">
          <div>
            <p className="text-sm font-semibold text-[#0b1c30]">Préfixe actif</p>
            <p className="text-xs text-[#6f787e]">Visible dans les listes déroulantes</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{ backgroundColor: form.is_active ? '#006685' : '#bec8ce' }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform"
              style={{ transform: form.is_active ? 'translateX(20px)' : 'none' }}
            />
          </button>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-[#6f787e] hover:bg-slate-50 transition-all"
          >
            Annuler
          </button>
          <button
            disabled={!valid || saving}
            onClick={() => onSave(form)}
            className="flex-1 py-3 bg-[#006685] text-white font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminPrefixesPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row?: PrefixRow } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: prefixes = [], isLoading } = useQuery<PrefixRow[]>({
    queryKey: ['admin-prefixes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_prefixes')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as PrefixRow[]
    },
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ form, id }: { form: PrefixForm; id?: string }) => {
      if (id) {
        const { error } = await supabase
          .from('professional_prefixes')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('professional_prefixes')
          .insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-prefixes'] })
      setModal(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('professional_prefixes')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-prefixes'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('professional_prefixes')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-prefixes'] })
      setDeleteId(null)
    },
  })

  const active = prefixes.filter(p => p.is_active).length
  const inactive = prefixes.length - active
  const medicalOnly = prefixes.filter(p => p.is_active && !p.allowed_roles.includes('patient')).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Préfixes professionnels</h1>
          <p className="text-sm text-[#6f787e] mt-1">Gestion des préfixes affichés sur toute la plateforme</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#006685] text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
        >
          <span className="text-lg leading-none">+</span>
          Ajouter un préfixe
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total actifs',      value: active,      bg: '#e5eeff', color: '#006685', icon: '🏷️' },
          { label: 'Médicaux uniquement', value: medicalOnly,  bg: '#e8f5e9', color: '#1d7a3a', icon: '🩺' },
          { label: 'Inactifs',          value: inactive,    bg: '#ffdad6', color: '#ba1a1a', icon: '⏸️' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: kpi.bg }}>
                {kpi.icon}
              </div>
              <div>
                <p className="text-2xl font-black" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-xs text-[#6f787e] font-medium">{kpi.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Explanation banner */}
      <div className="bg-[#e5eeff] border border-[#c5d8f5] rounded-xl px-5 py-3 flex items-start gap-3">
        <span className="text-[#006685] text-lg mt-0.5">ℹ️</span>
        <div className="text-sm text-[#005e7a]">
          <span className="font-bold">Impact plateforme :</span> le préfixe attribué à un utilisateur s&apos;affiche automatiquement dans la messagerie, les ordonnances, les rendez-vous, la liste des médecins et les PDF exportés.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/80">
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Préfixe</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Libellé</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Rôles autorisés</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Statut</th>
              <th className="text-right px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="h-5 bg-slate-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : prefixes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">
                  Aucun préfixe configuré
                </td>
              </tr>
            ) : (
              prefixes.map(row => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-[#f8f9ff]/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-lg font-black text-[#0b1c30]">{row.prefix}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-[#3f484d]">{row.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {row.allowed_roles.map(r => <RolePill key={r} role={r} />)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleMutation.mutate({ id: row.id, is_active: !row.is_active })}
                      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: row.is_active ? '#006685' : '#bec8ce' }}
                      title={row.is_active ? 'Désactiver' : 'Activer'}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
                        style={{ transform: row.is_active ? 'translateX(20px)' : 'none' }}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setModal({ mode: 'edit', row })}
                        className="p-2 rounded-lg text-[#006685] hover:bg-[#e5eeff] transition-colors text-xs font-bold"
                        title="Modifier"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setDeleteId(row.id)}
                        className="p-2 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors text-xs"
                        title="Supprimer"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Attribution info */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-[#0b1c30] mb-3">Attribution des préfixes</h3>
        <p className="text-sm text-[#6f787e] mb-4">
          Les préfixes s&apos;attribuent depuis la fiche de chaque utilisateur dans{' '}
          <a href="/admin/users" className="text-[#006685] font-semibold hover:underline">Gestion des utilisateurs</a>.
          Seuls les rôles autorisés par le préfixe apparaissent dans la liste déroulante de l&apos;utilisateur concerné.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(r => {
            const compatible = prefixes.filter(p => p.is_active && p.allowed_roles.includes(r.id))
            return (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#e5eeff]">
                <RolePill role={r.id} />
                <span className="text-sm text-[#3f484d]">
                  {compatible.length} préfixe{compatible.length > 1 ? 's' : ''} disponible{compatible.length > 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <PrefixModal
          initial={
            modal.mode === 'edit' && modal.row
              ? {
                  prefix: modal.row.prefix,
                  label: modal.row.label,
                  allowed_roles: modal.row.allowed_roles,
                  sort_order: modal.row.sort_order,
                  is_active: modal.row.is_active,
                }
              : EMPTY_FORM
          }
          onClose={() => setModal(null)}
          onSave={form => saveMutation.mutate({ form, id: modal.mode === 'edit' ? modal.row?.id : undefined })}
          saving={saveMutation.isPending}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
          <div
            className="relative w-full max-w-sm rounded-2xl p-7 flex flex-col gap-5 text-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl mx-auto">🗑️</div>
            <div>
              <h2 className="text-lg font-black text-[#0b1c30]">Supprimer ce préfixe ?</h2>
              <p className="text-sm text-[#6f787e] mt-1">
                Les utilisateurs qui ont ce préfixe ne seront plus impactés (la colonne restera renseignée).
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-medium text-[#6f787e] hover:bg-slate-50 transition-all"
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-3 bg-[#ba1a1a] text-white font-bold rounded-xl text-sm hover:opacity-90 transition-all disabled:opacity-40"
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
