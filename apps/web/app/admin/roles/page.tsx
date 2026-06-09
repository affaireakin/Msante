'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface ProfessionPermission {
  id: string
  profession_key: string
  profession_label: string
  can_prescribe: boolean
  can_write_observations: boolean
  can_write_reports: boolean
  can_view_full_dossier: boolean
  can_view_analyses: boolean
  can_view_imaging: boolean
  can_share_with_patient: boolean
  can_request_analyses: boolean
  can_view_notes: boolean
  can_view_prescriptions: boolean
  can_view_appreciations: boolean
  can_view_mood_journal: boolean
  can_teleconsult: boolean
  allowed_data_categories: string[]
  description: string | null
  created_at: string
  updated_at: string
}

const DATA_CATEGORIES = [
  { value: 'analyses',        label: 'Analyses biologiques' },
  { value: 'imagerie',        label: 'Imagerie médicale' },
  { value: 'comptes_rendus',  label: 'Comptes-rendus' },
  { value: 'ordonnances',     label: 'Ordonnances' },
  { value: 'antecedents',     label: 'Antécédents médicaux' },
  { value: 'vaccinations',    label: 'Vaccinations' },
  { value: 'psychologie',     label: 'Données psychologiques' },
  { value: 'gynecologie',     label: 'Données gynécologiques' },
  { value: 'cardiologie',     label: 'Cardiologie' },
  { value: 'pediatrie',       label: 'Pédiatrie' },
  { value: 'dermatologie',    label: 'Dermatologie' },
]

function useProfessionPermissions() {
  return useQuery({
    queryKey: ['profession-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profession_permissions').select('*').order('profession_label', { ascending: true })
      if (error) throw error
      return (data ?? []) as ProfessionPermission[]
    },
    staleTime: 30_000,
  })
}

function BooleanCell({ value }: { value: boolean }) {
  return value
    ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 font-bold text-base select-none">✓</span>
    : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-400 font-bold text-base select-none">–</span>
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100/70">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-200/70 rounded animate-pulse" style={{ width: i === 0 ? '140px' : '32px', margin: '0 auto' }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Add Profession Modal ──────────────────────────────────────────────────────

function AddProfessionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('')
  const [key, setKey] = useState('')
  const [description, setDescription] = useState('')
  const [perms, setPerms] = useState({
    can_prescribe: false, can_write_observations: true, can_write_reports: true,
    can_view_full_dossier: false, can_view_analyses: false, can_view_imaging: false,
    can_share_with_patient: true, can_request_analyses: false,
    can_view_notes: true, can_view_prescriptions: false, can_view_appreciations: false,
    can_view_mood_journal: false, can_teleconsult: false,
  })
  const [categories, setCategories] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error('Le nom de la profession est requis')
      const profKey = key.trim() || label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_')
      const { error } = await supabase.from('profession_permissions').insert({
        profession_key: profKey,
        profession_label: label.trim(),
        description: description.trim() || null,
        allowed_data_categories: categories,
        ...perms,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profession-permissions'] })
      onClose()
    },
    onError: (err: Error) => setError(err.message),
  })

  const toggle = (k: keyof typeof perms) => setPerms(p => ({ ...p, [k]: !p[k] }))
  const toggleCat = (v: string) => setCategories(prev => prev.includes(v) ? prev.filter(c => c !== v) : [...prev, v])

  const PERM_LABELS: { key: keyof typeof perms; label: string }[] = [
    { key: 'can_prescribe',          label: 'Prescription médicale' },
    { key: 'can_write_observations', label: 'Rédaction d\'observations' },
    { key: 'can_write_reports',      label: 'Comptes-rendus' },
    { key: 'can_view_full_dossier',  label: 'Dossier complet' },
    { key: 'can_view_analyses',      label: 'Analyses biologiques' },
    { key: 'can_view_imaging',       label: 'Imagerie médicale' },
    { key: 'can_request_analyses',   label: 'Prescription d\'analyses' },
    { key: 'can_view_notes',         label: 'Voir les notes cliniques' },
    { key: 'can_view_prescriptions', label: 'Voir les ordonnances' },
    { key: 'can_view_appreciations', label: 'Voir les appréciations' },
    { key: 'can_view_mood_journal',  label: 'Journal mood / bien-être' },
    { key: 'can_teleconsult',        label: 'Téléconsultation' },
    { key: 'can_share_with_patient', label: 'Partage avec le patient' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-[#0b1c30]">Nouvelle profession</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nom de la profession <span className="text-red-500">*</span></label>
              <input type="text" value={label} onChange={e => setLabel(e.target.value)}
                placeholder="Ex: Diététicien"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Clé technique <span className="text-slate-400 font-normal">(auto-générée)</span></label>
              <input type="text" value={key} onChange={e => setKey(e.target.value)}
                placeholder="Ex: dieteticien"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description <span className="text-slate-400 font-normal">(optionnel)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Contexte clinique, responsabilités…"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685] resize-none" />
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Permissions cliniques</p>
            <div className="grid grid-cols-2 gap-2">
              {PERM_LABELS.map(p => (
                <label key={p.key} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderColor: perms[p.key] ? '#006685' : '#e2e8f0', backgroundColor: perms[p.key] ? '#f0f9ff' : 'transparent' }}>
                  <input type="checkbox" checked={perms[p.key]} onChange={() => toggle(p.key)} className="w-4 h-4 accent-[#006685]" />
                  <span className="text-xs font-medium text-[#0b1c30]">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Catégories de données accessibles</p>
            <div className="grid grid-cols-2 gap-2">
              {DATA_CATEGORIES.map(cat => (
                <label key={cat.value} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                  style={{ borderColor: categories.includes(cat.value) ? '#705d00' : '#e2e8f0', backgroundColor: categories.includes(cat.value) ? '#fffbeb' : 'transparent' }}>
                  <input type="checkbox" checked={categories.includes(cat.value)} onChange={() => toggleCat(cat.value)} className="w-4 h-4 accent-[#705d00]" />
                  <span className="text-xs font-medium text-[#0b1c30]">{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
            Annuler
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: '#006685' }}>
            {mutation.isPending ? 'Création…' : 'Créer la profession'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { data: professions, isLoading, error } = useProfessionPermissions()
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      {showModal && <AddProfessionModal onClose={() => setShowModal(false)} />}

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">Rôles &amp; Permissions</h1>
            <p className="mt-1 text-sm text-[#6f787e]">Droits cliniques par profession — le patient affine ensuite individuellement</p>
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90"
            style={{ backgroundColor: '#006685' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter une profession
          </button>
        </div>

        {/* Explainer */}
        <div className="flex items-start gap-3 bg-[#e5eeff] rounded-xl px-4 py-3">
          <span className="material-symbols-outlined text-[#006685] mt-0.5" style={{ fontSize: '18px' }}>info</span>
          <div className="text-xs text-[#006685] leading-relaxed">
            <strong>Deux niveaux de contrôle :</strong> Ici vous définissez ce que chaque profession peut faire par défaut.
            Le patient contrôle ensuite précisément l'accès de chaque praticien individuel depuis son espace (Mes permissions).
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200/60 bg-slate-50/50">
                  <th className="px-4 py-3.5 text-left font-semibold text-[#3f484d] whitespace-nowrap">Profession</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Prescription</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Notes / OB</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Comptes-rendus</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Dossier complet</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Analyses</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Téléconsult</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Mood/Journal</th>
                  <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <><SkeletonRow /><SkeletonRow /><SkeletonRow /></>}

                {error && (
                  <tr><td colSpan={9} className="px-6 py-10 text-center">
                    <p className="text-sm text-red-500 font-medium">Erreur : {(error as Error).message}</p>
                  </td></tr>
                )}

                {!isLoading && !error && professions?.length === 0 && (
                  <tr><td colSpan={9} className="px-6 py-14 text-center">
                    <p className="text-sm font-medium text-[#3f484d]">Aucune profession configurée</p>
                    <button onClick={() => setShowModal(true)} className="mt-3 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#006685' }}>
                      Ajouter la première profession
                    </button>
                  </td></tr>
                )}

                {!isLoading && !error && professions?.map((prof, idx) => (
                  <tr key={prof.id}
                    className={`border-b border-slate-100/70 transition-colors hover:bg-sky-50/30 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-semibold text-[#0b1c30]">{prof.profession_label}</p>
                        {prof.description && <p className="text-xs text-[#6f787e] mt-0.5 line-clamp-1">{prof.description}</p>}
                        {prof.allowed_data_categories?.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {prof.allowed_data_categories.slice(0, 3).map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{c}</span>
                            ))}
                            {prof.allowed_data_categories.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">+{prof.allowed_data_categories.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_prescribe} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_write_observations ?? prof.can_view_notes} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_write_reports} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_view_full_dossier} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_view_analyses} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_teleconsult ?? false} /></td>
                    <td className="px-4 py-4 text-center"><BooleanCell value={prof.can_view_mood_journal ?? false} /></td>
                    <td className="px-4 py-4 text-center">
                      <Link href={`/admin/roles/${prof.profession_key}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#006685] bg-sky-50 border border-sky-200/60 hover:bg-sky-100 transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!isLoading && !error && professions && professions.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100/70 bg-slate-50/30">
              <p className="text-xs text-[#6f787e]">{professions.length} profession{professions.length > 1 ? 's' : ''} configurée{professions.length > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
