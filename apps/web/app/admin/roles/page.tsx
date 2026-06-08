'use client'
import { useQuery } from '@tanstack/react-query'
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

function useProfessionPermissions() {
  return useQuery({
    queryKey: ['profession-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_permissions')
        .select('*')
        .order('profession_label', { ascending: true })
      if (error) throw error
      return (data ?? []) as ProfessionPermission[]
    },
    staleTime: 30_000,
  })
}

function BooleanCell({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 font-bold text-base select-none">
        ✓
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-50 text-red-400 font-bold text-base select-none">
      –
    </span>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100/70">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-slate-200/70 rounded animate-pulse" style={{ width: i === 0 ? '140px' : '32px', margin: '0 auto' }} />
        </td>
      ))}
    </tr>
  )
}

export default function RolesPage() {
  const { data: professions, isLoading, error } = useProfessionPermissions()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30]">Rôles &amp; Permissions</h1>
          <p className="mt-1 text-sm text-[#6f787e]">Configurez les droits de chaque profession médicale</p>
        </div>
        <button
          onClick={() => alert('Bientôt disponible')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ backgroundColor: '#006685' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter une profession
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                <th className="px-4 py-3.5 text-left font-semibold text-[#3f484d] whitespace-nowrap">Profession</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Prescription</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Observations</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Comptes-rendus</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Dossier complet</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Analyses</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Imagerie</th>
                <th className="px-4 py-3.5 text-center font-semibold text-[#3f484d] whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {error && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-sm text-red-500 font-medium">Erreur lors du chargement des permissions</p>
                      <p className="text-xs text-[#6f787e]">{(error as Error).message}</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !error && professions && professions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <svg className="w-6 h-6 text-[#6f787e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-[#3f484d]">Aucune profession configurée</p>
                      <p className="text-xs text-[#6f787e]">Cliquez sur &laquo;&nbsp;Ajouter une profession&nbsp;&raquo; pour commencer.</p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !error && professions?.map((prof, idx) => (
                <tr
                  key={prof.id}
                  className={`border-b border-slate-100/70 transition-colors duration-150 hover:bg-sky-50/30 ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                >
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-semibold text-[#0b1c30]">{prof.profession_label}</p>
                      {prof.description && (
                        <p className="text-xs text-[#6f787e] mt-0.5 line-clamp-1">{prof.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_prescribe} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_write_observations} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_write_reports} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_view_full_dossier} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_view_analyses} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <BooleanCell value={prof.can_view_imaging} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Link
                      href={`/admin/roles/${prof.profession_key}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#006685] bg-sky-50 border border-sky-200/60 hover:bg-sky-100 transition-colors duration-150"
                    >
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

        {/* Footer count */}
        {!isLoading && !error && professions && professions.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100/70 bg-slate-50/30">
            <p className="text-xs text-[#6f787e]">{professions.length} profession{professions.length > 1 ? 's' : ''} configurée{professions.length > 1 ? 's' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}
