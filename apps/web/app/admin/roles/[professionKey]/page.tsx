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
  description: string
}

const PERMISSION_META: Array<{
  key: keyof Omit<PermissionState, 'description'>
  label: string
  description: string
}> = [
  {
    key: 'can_prescribe',
    label: 'Prescription médicale',
    description: 'Autoriser cette profession à rédiger et signer des ordonnances de médicaments.',
  },
  {
    key: 'can_write_observations',
    label: 'Rédaction d\'observations',
    description: 'Permettre d\'écrire des notes cliniques et observations dans le dossier patient.',
  },
  {
    key: 'can_write_reports',
    label: 'Rédaction de comptes-rendus',
    description: 'Autoriser la création de comptes-rendus médicaux structurés (consultations, interventions).',
  },
  {
    key: 'can_view_full_dossier',
    label: 'Accès dossier complet',
    description: 'Consulter l\'intégralité du dossier médical d\'un patient, y compris les données sensibles.',
  },
  {
    key: 'can_view_analyses',
    label: 'Consultation des analyses',
    description: 'Accéder aux résultats de biologie, examens de laboratoire et bilans sanguins.',
  },
  {
    key: 'can_view_imaging',
    label: 'Consultation de l\'imagerie',
    description: 'Visualiser les examens d\'imagerie médicale (radiographies, IRM, échographies, etc.).',
  },
  {
    key: 'can_share_with_patient',
    label: 'Partage avec le patient',
    description: 'Transmettre des documents, résultats et informations directement au patient via l\'application.',
  },
  {
    key: 'can_request_analyses',
    label: 'Prescription d\'analyses',
    description: 'Prescrire des examens de biologie ou d\'imagerie médicale.',
  },
]

function useProfession(professionKey: string) {
  return useQuery({
    queryKey: ['profession-permission', professionKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_permissions')
        .select('*')
        .eq('profession_key', professionKey)
        .single()
      if (error) throw error
      return data as ProfessionPermission
    },
    staleTime: 30_000,
    enabled: !!professionKey,
  })
}

function ToggleSwitch({
  checked,
  onChange,
  id,
}: {
  checked: boolean
  onChange: (val: boolean) => void
  id: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#006685] focus:ring-offset-2 ${
        checked ? 'bg-[#006685]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function EditProfessionPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const professionKey = params.professionKey as string

  const { data: profession, isLoading, error } = useProfession(professionKey)

  const [permissions, setPermissions] = useState<PermissionState>({
    can_prescribe: false,
    can_write_observations: false,
    can_write_reports: false,
    can_view_full_dossier: false,
    can_view_analyses: false,
    can_view_imaging: false,
    can_share_with_patient: false,
    can_request_analyses: false,
    description: '',
  })

  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (profession) {
      setPermissions({
        can_prescribe: profession.can_prescribe,
        can_write_observations: profession.can_write_observations,
        can_write_reports: profession.can_write_reports,
        can_view_full_dossier: profession.can_view_full_dossier,
        can_view_analyses: profession.can_view_analyses,
        can_view_imaging: profession.can_view_imaging,
        can_share_with_patient: profession.can_share_with_patient,
        can_request_analyses: profession.can_request_analyses,
        description: profession.description ?? '',
      })
      setIsDirty(false)
    }
  }, [profession])

  const updateMutation = useMutation({
    mutationFn: async (updates: PermissionState) => {
      const { error } = await supabase
        .from('profession_permissions')
        .update({
          can_prescribe: updates.can_prescribe,
          can_write_observations: updates.can_write_observations,
          can_write_reports: updates.can_write_reports,
          can_view_full_dossier: updates.can_view_full_dossier,
          can_view_analyses: updates.can_view_analyses,
          can_view_imaging: updates.can_view_imaging,
          can_share_with_patient: updates.can_share_with_patient,
          can_request_analyses: updates.can_request_analyses,
          description: updates.description || null,
          updated_at: new Date().toISOString(),
        })
        .eq('profession_key', professionKey)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profession-permissions'] })
      void queryClient.invalidateQueries({ queryKey: ['profession-permission', professionKey] })
      alert('Permissions mises à jour avec succès.')
      router.push('/admin/roles')
    },
    onError: (err: Error) => {
      alert(`Erreur : ${err.message}`)
    },
  })

  function handleToggle(key: keyof Omit<PermissionState, 'description'>, value: boolean) {
    setPermissions((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  function handleDescriptionChange(value: string) {
    setPermissions((prev) => ({ ...prev, description: value }))
    setIsDirty(true)
  }

  function handleSave() {
    updateMutation.mutate(permissions)
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded bg-slate-200 animate-pulse" />
          <div className="h-7 w-48 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm p-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-4 border-b border-slate-100">
              <div className="space-y-2">
                <div className="h-4 w-40 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-64 bg-slate-100 rounded animate-pulse" />
              </div>
              <div className="h-6 w-11 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-red-500">Profession introuvable</p>
        <p className="text-xs text-[#6f787e]">{(error as Error).message}</p>
        <Link href="/admin/roles" className="text-sm font-medium text-[#006685] underline underline-offset-2">
          Retour à la liste
        </Link>
      </div>
    )
  }

  const enabledCount = PERMISSION_META.filter((m) => permissions[m.key]).length

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/roles"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/60 border border-white/80 text-[#6f787e] hover:bg-slate-50 transition-colors duration-150 shadow-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">{profession?.profession_label}</h1>
          <p className="mt-0.5 text-sm text-[#6f787e]">Configurez les droits de cette profession</p>
        </div>
      </div>

      {/* Summary badge */}
      <div className="flex items-center gap-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: '#e5eeff', color: '#006685' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          {enabledCount} / {PERMISSION_META.length} autorisations actives
        </span>
        {isDirty && (
          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            Modifications non sauvegardées
          </span>
        )}
      </div>

      {/* Permissions grid */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100/70">
          <h2 className="text-sm font-semibold text-[#0b1c30]">Autorisations cliniques</h2>
          <p className="text-xs text-[#6f787e] mt-0.5">Activez ou désactivez chaque permission individuellement</p>
        </div>

        <div className="divide-y divide-slate-100/70">
          {PERMISSION_META.map((meta) => {
            const enabled = permissions[meta.key]
            return (
              <div
                key={meta.key}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-sky-50/20 transition-colors duration-150"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                      enabled ? 'bg-emerald-50' : 'bg-slate-100'
                    }`}
                  >
                    {enabled ? (
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#0b1c30]">{meta.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          enabled
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-500'
                        }`}
                      >
                        {enabled ? 'Autorisé' : 'Refusé'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6f787e] mt-0.5 leading-relaxed">{meta.description}</p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ToggleSwitch
                    id={meta.key}
                    checked={enabled}
                    onChange={(val) => handleToggle(meta.key, val)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Description */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100/70">
          <h2 className="text-sm font-semibold text-[#0b1c30]">Description</h2>
          <p className="text-xs text-[#6f787e] mt-0.5">Notes internes sur cette profession (optionnel)</p>
        </div>
        <div className="p-5">
          <textarea
            value={permissions.description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={3}
            placeholder="Décrivez les responsabilités et le contexte clinique de cette profession…"
            className="w-full rounded-xl border border-slate-200/70 bg-white/80 px-4 py-3 text-sm text-[#0b1c30] placeholder-[#6f787e] outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 resize-none transition-colors duration-150"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href="/admin/roles"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#3f484d] bg-white/70 border border-slate-200/60 hover:bg-slate-50 transition-colors duration-150 shadow-sm"
        >
          Annuler
        </Link>
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending || !isDirty}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#006685' }}
        >
          {updateMutation.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enregistrement…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Enregistrer les modifications
            </>
          )}
        </button>
      </div>
    </div>
  )
}
