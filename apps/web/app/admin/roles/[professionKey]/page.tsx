'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
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

interface PermissionState {
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
  description: string
}

const PERMISSION_GROUPS: Array<{
  group: string
  icon: string
  items: Array<{ key: keyof Omit<PermissionState, 'description' | 'allowed_data_categories'>; label: string; description: string }>
}> = [
  {
    group: 'Actes cliniques',
    icon: 'medical_services',
    items: [
      { key: 'can_prescribe',          label: 'Prescription médicale',    description: 'Rédiger et signer des ordonnances de médicaments.' },
      { key: 'can_request_analyses',   label: 'Prescription d\'analyses', description: 'Prescrire des examens biologiques ou d\'imagerie.' },
      { key: 'can_teleconsult',        label: 'Téléconsultation',         description: 'Conduire des consultations à distance.' },
    ],
  },
  {
    group: 'Rédaction & Documentation',
    icon: 'edit_note',
    items: [
      { key: 'can_write_observations', label: 'Rédaction d\'observations',  description: 'Écrire des notes cliniques dans le dossier patient.' },
      { key: 'can_write_reports',      label: 'Comptes-rendus médicaux',    description: 'Créer des comptes-rendus de consultation structurés.' },
      { key: 'can_share_with_patient', label: 'Partage avec le patient',    description: 'Transmettre des documents directement au patient.' },
    ],
  },
  {
    group: 'Accès aux données patient',
    icon: 'folder_shared',
    items: [
      { key: 'can_view_full_dossier',  label: 'Dossier médical complet',   description: 'Consulter l\'intégralité du dossier, y compris les données sensibles.' },
      { key: 'can_view_analyses',      label: 'Résultats d\'analyses',     description: 'Accéder aux résultats de biologie et bilans.' },
      { key: 'can_view_imaging',       label: 'Imagerie médicale',         description: 'Visualiser IRM, radios, échographies.' },
      { key: 'can_view_notes',         label: 'Notes cliniques',           description: 'Voir les notes rédigées dans le dossier.' },
      { key: 'can_view_prescriptions', label: 'Ordonnances',               description: 'Consulter les prescriptions médicales du patient.' },
      { key: 'can_view_appreciations', label: 'Appréciations patients',    description: 'Voir les notes et évaluations laissées par les patients.' },
      { key: 'can_view_mood_journal',  label: 'Journal mood & bien-être',  description: 'Accéder aux données de suivi émotionnel et journal privé.' },
    ],
  },
]

const DATA_CATEGORIES = [
  { value: 'analyses',       label: 'Analyses biologiques' },
  { value: 'imagerie',       label: 'Imagerie médicale' },
  { value: 'comptes_rendus', label: 'Comptes-rendus' },
  { value: 'ordonnances',    label: 'Ordonnances' },
  { value: 'antecedents',    label: 'Antécédents médicaux' },
  { value: 'vaccinations',   label: 'Vaccinations' },
  { value: 'psychologie',    label: 'Données psychologiques' },
  { value: 'gynecologie',    label: 'Données gynécologiques' },
  { value: 'cardiologie',    label: 'Cardiologie' },
  { value: 'pediatrie',      label: 'Pédiatrie' },
  { value: 'dermatologie',   label: 'Dermatologie' },
]

const DEFAULT_STATE: PermissionState = {
  can_prescribe: false, can_write_observations: true, can_write_reports: true,
  can_view_full_dossier: false, can_view_analyses: false, can_view_imaging: false,
  can_share_with_patient: true, can_request_analyses: false,
  can_view_notes: true, can_view_prescriptions: false, can_view_appreciations: false,
  can_view_mood_journal: false, can_teleconsult: false,
  allowed_data_categories: [], description: '',
}

function ToggleSwitch({ checked, onChange, id }: { checked: boolean; onChange: (val: boolean) => void; id: string }) {
  return (
    <button type="button" id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#82d8ff] focus:ring-offset-2 ${checked ? 'bg-[#82d8ff]' : 'bg-slate-300'}`}>
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function EditProfessionPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const professionKey = params.professionKey as string

  const { data: profession, isLoading, error } = useQuery({
    queryKey: ['profession-permission', professionKey],
    queryFn: async () => {
      const { data, error } = await supabase.from('profession_permissions').select('*').eq('profession_key', professionKey).maybeSingle()
      if (error) throw error
      if (!data) throw new Error('not_found')
      return data as ProfessionPermission
    },
    staleTime: 30_000,
    enabled: !!professionKey,
  })

  const [permissions, setPermissions] = useState<PermissionState>(DEFAULT_STATE)
  const [isDirty, setIsDirty] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (profession) {
      setPermissions({
        can_prescribe:          profession.can_prescribe,
        can_write_observations: profession.can_write_observations,
        can_write_reports:      profession.can_write_reports,
        can_view_full_dossier:  profession.can_view_full_dossier,
        can_view_analyses:      profession.can_view_analyses,
        can_view_imaging:       profession.can_view_imaging,
        can_share_with_patient: profession.can_share_with_patient,
        can_request_analyses:   profession.can_request_analyses,
        can_view_notes:         profession.can_view_notes ?? true,
        can_view_prescriptions: profession.can_view_prescriptions ?? false,
        can_view_appreciations: profession.can_view_appreciations ?? false,
        can_view_mood_journal:  profession.can_view_mood_journal ?? false,
        can_teleconsult:        profession.can_teleconsult ?? false,
        allowed_data_categories: profession.allowed_data_categories ?? [],
        description:            profession.description ?? '',
      })
      setIsDirty(false)
    }
  }, [profession])

  const updateMutation = useMutation({
    mutationFn: async (updates: PermissionState) => {
      const { allowed_data_categories, description, ...booleans } = updates
      const { error } = await supabase.from('profession_permissions').update({
        ...booleans,
        allowed_data_categories,
        description: description || null,
        updated_at: new Date().toISOString(),
      }).eq('profession_key', professionKey)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profession-permissions'] })
      void queryClient.invalidateQueries({ queryKey: ['profession-permission', professionKey] })
      setSaveSuccess(true)
      setIsDirty(false)
      setTimeout(() => setSaveSuccess(false), 3000)
    },
    onError: (err: Error) => alert(`Erreur : ${err.message}`),
  })

  function handleToggle(key: keyof Omit<PermissionState, 'description' | 'allowed_data_categories'>, value: boolean) {
    setPermissions(prev => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  function toggleCategory(cat: string) {
    setPermissions(prev => {
      const cats = prev.allowed_data_categories
      return { ...prev, allowed_data_categories: cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat] }
    })
    setIsDirty(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm font-semibold text-red-500">Profession introuvable</p>
        <Link href="/admin/roles" className="text-sm font-medium text-[#82d8ff] underline">Retour à la liste</Link>
      </div>
    )
  }

  const totalEnabled = PERMISSION_GROUPS.flatMap(g => g.items).filter(i => permissions[i.key]).length
  const totalPerms = PERMISSION_GROUPS.flatMap(g => g.items).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/roles"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 border border-white/80 text-[#6f787e] hover:bg-slate-50 transition-colors shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">{profession?.profession_label}</h1>
          <p className="mt-0.5 text-sm text-[#6f787e]">Permissions par défaut de cette profession</p>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-[#e5eeff] text-[#82d8ff]">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          {totalEnabled} / {totalPerms} permissions actives
        </span>
        {permissions.allowed_data_categories.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
            {permissions.allowed_data_categories.length} catégorie{permissions.allowed_data_categories.length > 1 ? 's' : ''} de données
          </span>
        )}
        {isDirty && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Modifications non sauvegardées
          </span>
        )}
        {saveSuccess && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200/60">
            ✓ Sauvegardé
          </span>
        )}
      </div>

      {/* Note contextuelle */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <span className="material-symbols-outlined text-amber-600 mt-0.5" style={{ fontSize: '16px' }}>shield_person</span>
        <p className="text-xs text-amber-700 leading-relaxed">
          Ces permissions définissent le <strong>plafond</strong> pour cette profession. Le patient peut ensuite
          restreindre davantage l'accès pour chaque praticien individuel depuis son espace <em>Mes permissions</em>.
        </p>
      </div>

      {/* Permission groups */}
      {PERMISSION_GROUPS.map(group => (
        <div key={group.group} className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100/70 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#82d8ff]" style={{ fontSize: '18px' }}>{group.icon}</span>
            <h2 className="text-sm font-semibold text-[#0b1c30]">{group.group}</h2>
          </div>
          <div className="divide-y divide-slate-100/70">
            {group.items.map(meta => {
              const enabled = permissions[meta.key]
              return (
                <div key={meta.key} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sky-50/20 transition-colors">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                      {enabled
                        ? <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        : <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0b1c30]">{meta.label}</p>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                          {enabled ? 'Autorisé' : 'Refusé'}
                        </span>
                      </div>
                      <p className="text-xs text-[#6f787e] mt-0.5 leading-relaxed">{meta.description}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <ToggleSwitch id={meta.key} checked={enabled} onChange={v => handleToggle(meta.key, v)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Data categories */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100/70 flex items-center gap-2">
          <span className="material-symbols-outlined text-[#705d00]" style={{ fontSize: '18px' }}>category</span>
          <div>
            <h2 className="text-sm font-semibold text-[#0b1c30]">Catégories de données médicales autorisées</h2>
            <p className="text-xs text-[#6f787e] mt-0.5">Définit quels types de données cette profession peut consulter par défaut</p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-2 gap-2">
          {DATA_CATEGORIES.map(cat => {
            const checked = permissions.allowed_data_categories.includes(cat.value)
            return (
              <label key={cat.value} onClick={() => toggleCategory(cat.value)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer hover:bg-slate-50 transition-colors"
                style={{ borderColor: checked ? '#705d00' : '#e2e8f0', backgroundColor: checked ? '#fffbeb' : 'transparent' }}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-amber-600 border-amber-600' : 'border-slate-300'}`}>
                  {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                </div>
                <span className="text-sm text-[#0b1c30]">{cat.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100/70">
          <h2 className="text-sm font-semibold text-[#0b1c30]">Description interne</h2>
        </div>
        <div className="p-5">
          <textarea value={permissions.description}
            onChange={e => { setPermissions(p => ({ ...p, description: e.target.value })); setIsDirty(true) }}
            rows={3} placeholder="Contexte clinique, responsabilités…"
            className="w-full rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none focus:border-[#82d8ff] resize-none transition-colors" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link href="/admin/roles" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#3f484d] bg-white/70 border border-slate-200/60 hover:bg-slate-50 transition-colors shadow-sm">
          Annuler
        </Link>
        <button onClick={() => updateMutation.mutate(permissions)} disabled={updateMutation.isPending || !isDirty}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#82d8ff' }}>
          {updateMutation.isPending ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Enregistrement…</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Enregistrer les modifications</>
          )}
        </button>
      </div>
    </div>
  )
}
