'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CountryRow {
  id: string
  iso_code: string
  dial_code: string
  flag_emoji: string
  label: string
  is_active: boolean
  sort_order: number
  created_at: string
}

interface CountryForm {
  iso_code: string
  dial_code: string
  flag_emoji: string
  label: string
  sort_order: number
  is_active: boolean
}

const EMPTY_FORM: CountryForm = {
  iso_code: '',
  dial_code: '',
  flag_emoji: '',
  label: '',
  sort_order: 0,
  is_active: false,
}

// ─── Modal ───────────────────────────────────────────────────────────────────

function CountryModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial: CountryForm
  onClose: () => void
  onSave: (f: CountryForm) => void
  saving: boolean
}) {
  const [form, setForm] = useState<CountryForm>(initial)

  const valid = form.iso_code.trim().length === 2 && form.dial_code.trim().length > 0 && form.label.trim().length > 0 && form.flag_emoji.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl p-7 flex flex-col gap-5"
        style={{ backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,102,133,0.15)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-[#0b1c30]">
              {initial.iso_code ? 'Modifier le pays' : 'Ajouter un pays'}
            </h2>
            <p className="text-sm text-[#6f787e] mt-0.5">Disponible dans le sélecteur de téléphone à l&apos;inscription</p>
          </div>
          <button onClick={onClose} className="text-[#6f787e] hover:text-[#0b1c30] text-xl leading-none">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Code ISO *</label>
            <input
              value={form.iso_code}
              onChange={e => setForm(f => ({ ...f, iso_code: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="SN"
              maxLength={2}
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all text-sm font-bold"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Indicatif *</label>
            <input
              value={form.dial_code}
              onChange={e => setForm(f => ({ ...f, dial_code: e.target.value }))}
              placeholder="+221"
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Drapeau (emoji) *</label>
            <input
              value={form.flag_emoji}
              onChange={e => setForm(f => ({ ...f, flag_emoji: e.target.value }))}
              placeholder="🇸🇳"
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all text-lg text-center"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom *</label>
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Sénégal"
              className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-[#f8f9ff] border border-[#e5eeff]">
          <div>
            <p className="text-sm font-semibold text-[#0b1c30]">Pays activé</p>
            <p className="text-xs text-[#6f787e]">Sélectionnable à l&apos;inscription patient</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
            className="relative w-11 h-6 rounded-full transition-colors"
            style={{ backgroundColor: form.is_active ? '#82d8ff' : '#bec8ce' }}
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
            className="flex-1 py-3 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-40"
          >
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminCountriesPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; row?: CountryRow } | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: countries = [], isLoading } = useQuery<CountryRow[]>({
    queryKey: ['admin-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('allowed_countries')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []) as CountryRow[]
    },
    staleTime: 30_000,
  })

  const saveMutation = useMutation({
    mutationFn: async ({ form, id }: { form: CountryForm; id?: string }) => {
      if (id) {
        const { error } = await supabase
          .from('allowed_countries')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('allowed_countries')
          .insert(form)
        if (error) throw error
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-countries'] })
      setModal(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('allowed_countries')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-countries'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('allowed_countries')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-countries'] })
      setDeleteId(null)
    },
  })

  const active = countries.filter(c => c.is_active).length
  const inactive = countries.length - active

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Pays autorisés</h1>
          <p className="text-sm text-[#6f787e] mt-1">Pays sélectionnables dans le drapeau/indicatif du téléphone à l&apos;inscription patient</p>
        </div>
        <button
          onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
        >
          <span className="text-lg leading-none">+</span>
          Ajouter un pays
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Pays débloqués', value: active,   bg: '#e5eeff', color: '#82d8ff', icon: '🌍' },
          { label: 'Verrouillés',    value: inactive,  bg: '#ffdad6', color: '#ba1a1a', icon: '🔒' },
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
        <span className="text-[#82d8ff] text-lg mt-0.5">ℹ️</span>
        <div className="text-sm text-[#005e7a]">
          <span className="font-bold">Impact plateforme :</span> seuls les pays débloqués ici apparaissent dans le sélecteur de drapeau/indicatif à l&apos;inscription patient. Le numéro de téléphone est obligatoire pour créer un compte patient.
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-slate-100/80">
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Pays</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Indicatif</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#6f787e] uppercase tracking-widest">Code</th>
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
            ) : countries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-[#6f787e] text-sm">
                  Aucun pays configuré
                </td>
              </tr>
            ) : (
              countries.map(row => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-[#f8f9ff]/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-lg mr-2">{row.flag_emoji}</span>
                    <span className="text-sm font-medium text-[#3f484d]">{row.label}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-[#0b1c30]">{row.dial_code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-[#6f787e]">{row.iso_code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleMutation.mutate({ id: row.id, is_active: !row.is_active })}
                      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: row.is_active ? '#82d8ff' : '#bec8ce' }}
                      title={row.is_active ? 'Verrouiller' : 'Débloquer'}
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
                        className="p-2 rounded-lg text-[#82d8ff] hover:bg-[#e5eeff] transition-colors text-xs font-bold"
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

      {/* Create / Edit Modal */}
      {modal && (
        <CountryModal
          initial={
            modal.mode === 'edit' && modal.row
              ? {
                  iso_code: modal.row.iso_code,
                  dial_code: modal.row.dial_code,
                  flag_emoji: modal.row.flag_emoji,
                  label: modal.row.label,
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
            className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl p-7 flex flex-col gap-5 text-center"
            style={{ backgroundColor: 'rgba(255,255,255,0.97)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
          >
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl mx-auto">🗑️</div>
            <div>
              <h2 className="text-lg font-black text-[#0b1c30]">Supprimer ce pays ?</h2>
              <p className="text-sm text-[#6f787e] mt-1">
                Il ne sera plus proposé à l&apos;inscription. Les comptes déjà créés avec ce numéro ne sont pas affectés.
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
