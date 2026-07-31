'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface DiagnosticPermissions {
  can_use_dsm: boolean
  can_use_cim: boolean
  can_view_diagnostic_criteria: boolean
  can_advanced_search_diagnostic: boolean
  can_associate_diagnosis: boolean
  can_export_diagnostic: boolean
}

interface DsmEntry {
  id: string
  code: string
  label: string
  category: string
  icd_code: string | null
  keywords: string[]
}

interface CimResult {
  uri: string
  code: string | null
  title: string
}

export interface SelectedDiagnosis {
  source: 'dsm' | 'cim'
  code: string
  label: string
}

function useDiagnosticPermissions() {
  return useQuery<DiagnosticPermissions>({
    queryKey: ['my-diagnostic-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_diagnostic_permissions')
      if (error) throw error
      return data as DiagnosticPermissions
    },
    staleTime: 5 * 60_000,
  })
}

// Recherche client-side sur le référentiel DSM léger (nom/code/catégorie
// uniquement — aucun critère diagnostique complet, voir dsm_entries).
function useDsmSearch(query: string, enabled: boolean, advanced: boolean) {
  return useQuery<DsmEntry[]>({
    queryKey: ['dsm-search', query, advanced],
    enabled: enabled && query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim()
      let request = supabase.from('dsm_entries').select('id, code, label, category, icd_code, keywords').limit(20)
      request = advanced
        ? request.or(`label.ilike.%${q}%,keywords.cs.{${q}}`)
        : request.ilike('label', `%${q}%`)
      const { data, error } = await request
      if (error) throw error
      return (data ?? []) as DsmEntry[]
    },
  })
}

export default function DiagnosticAidSearch({
  patientId, consultationId, appointmentId, onSelect,
}: {
  patientId?: string
  consultationId?: string
  appointmentId?: string
  onSelect?: (d: SelectedDiagnosis) => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'dsm' | 'cim'>('dsm')
  const [dsmQuery, setDsmQuery] = useState('')
  const [cimQuery, setCimQuery] = useState('')
  const [cimResults, setCimResults] = useState<CimResult[] | null>(null)
  const [cimError, setCimError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [associateNote, setAssociateNote] = useState<Record<string, string>>({})
  const [associated, setAssociated] = useState<Set<string>>(new Set())

  const { data: perms } = useDiagnosticPermissions()
  const { data: dsmResults = [], isLoading: dsmLoading } = useDsmSearch(dsmQuery, open && tab === 'dsm', !!perms?.can_advanced_search_diagnostic)

  const cimSearch = useMutation({
    mutationFn: async (q: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('icd-search', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { query: q },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
      return (data as { results: CimResult[] }).results
    },
    onSuccess: (results) => { setCimResults(results); setCimError('') },
    onError: (e: Error) => { setCimResults([]); setCimError(e.message) },
  })

  const associate = useMutation({
    mutationFn: async ({ source, code, label, key }: { source: 'dsm' | 'cim'; code: string; label: string; key: string }) => {
      if (!patientId) throw new Error('Aucun patient sélectionné')
      const { data: { user } } = await supabase.auth.getUser()
      const { data: practitioner } = await supabase.from('practitioners').select('id').eq('user_id', user!.id).single()
      if (!practitioner) throw new Error('Profil praticien introuvable')
      const { error } = await supabase.from('diagnosis_records').insert({
        patient_id: patientId,
        practitioner_id: practitioner.id,
        consultation_id: consultationId ?? null,
        appointment_id: appointmentId ?? null,
        source, code, label,
        notes: associateNote[key] || null,
      })
      if (error) throw error
      return key
    },
    onSuccess: (key) => setAssociated(prev => new Set(prev).add(key)),
  })

  if (!perms || (!perms.can_use_dsm && !perms.can_use_cim)) return null

  const exportResult = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[#82d8ff] text-[#005e7a] hover:bg-[#e5eeff] transition-colors"
      >
        <Icon name="psychology_alt" style={{ fontSize: '18px' }} />
        Aide au diagnostic (DSM / CIM)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0b1c30]">Aide au diagnostic</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="close" />
              </button>
            </div>

            <div className="flex gap-2 px-6 pt-4">
              {perms.can_use_dsm && (
                <button onClick={() => setTab('dsm')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'dsm' ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-[#e5eeff] text-[#82d8ff]'}`}>
                  DSM
                </button>
              )}
              {perms.can_use_cim && (
                <button onClick={() => setTab('cim')}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === 'cim' ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-[#e5eeff] text-[#82d8ff]'}`}>
                  CIM (OMS ICD-11)
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {tab === 'dsm' && perms.can_use_dsm && (
                <>
                  <input
                    value={dsmQuery} onChange={e => setDsmQuery(e.target.value)}
                    placeholder={perms.can_advanced_search_diagnostic ? 'Nom, symptôme ou mot-clé...' : 'Rechercher par nom de diagnostic...'}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#82d8ff]"
                  />
                  {dsmLoading && <p className="text-sm text-[#6f787e]">Recherche...</p>}
                  {dsmQuery.trim().length >= 2 && !dsmLoading && dsmResults.length === 0 && (
                    <p className="text-sm text-[#6f787e]">Aucun résultat.</p>
                  )}
                  {dsmResults.map(entry => {
                    const key = `dsm-${entry.id}`
                    return (
                      <div key={entry.id} className="rounded-xl border border-slate-200 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#0b1c30] text-sm">{entry.label}</p>
                            <p className="text-xs text-[#6f787e] font-mono">DSM {entry.code}{entry.icd_code ? ` · CIM ${entry.icd_code}` : ''}</p>
                          </div>
                          {onSelect && (
                            <button onClick={() => { onSelect({ source: 'dsm', code: entry.code, label: entry.label }); setOpen(false) }}
                              className="text-xs font-bold text-[#82d8ff] hover:underline whitespace-nowrap">
                              Utiliser
                            </button>
                          )}
                        </div>
                        {perms.can_view_diagnostic_criteria && (
                          <button onClick={() => setExpandedId(expandedId === key ? null : key)} className="text-xs text-[#005e7a] font-semibold hover:underline">
                            {expandedId === key ? 'Masquer' : 'Voir'} la catégorie
                          </button>
                        )}
                        {expandedId === key && perms.can_view_diagnostic_criteria && (
                          <div className="bg-[#f8f9ff] rounded-lg p-3 text-xs text-[#3f484d] space-y-1">
                            <p><strong>Catégorie DSM-5 :</strong> {entry.category}</p>
                            <p className="text-[#6f787e] italic">
                              Consultez le DSM-5 officiel (American Psychiatric Association) pour les critères diagnostiques complets — non reproduits ici pour des raisons de droits d&apos;auteur.
                            </p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          {perms.can_associate_diagnosis && patientId && (
                            associated.has(key) ? (
                              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                <Icon name="check_circle" style={{ fontSize: '14px' }} /> Associé au dossier
                              </span>
                            ) : (
                              <button onClick={() => associate.mutate({ source: 'dsm', code: entry.code, label: entry.label, key })}
                                disabled={associate.isPending}
                                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#82d8ff] text-[#0b1c30] disabled:opacity-50">
                                Associer au dossier patient
                              </button>
                            )
                          )}
                          {perms.can_export_diagnostic && (
                            <button onClick={() => exportResult(`DSM ${entry.code} — ${entry.label}`)} className="text-xs font-semibold text-[#6f787e] hover:text-[#0b1c30] flex items-center gap-1">
                              <Icon name="content_copy" style={{ fontSize: '14px' }} /> Copier
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}

              {tab === 'cim' && perms.can_use_cim && (
                <>
                  <form onSubmit={e => { e.preventDefault(); if (cimQuery.trim().length >= 2) cimSearch.mutate(cimQuery.trim()) }} className="flex gap-2">
                    <input
                      value={cimQuery} onChange={e => setCimQuery(e.target.value)}
                      placeholder="Rechercher un diagnostic ou un code CIM-11..."
                      className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#82d8ff]"
                    />
                    <button type="submit" disabled={cimSearch.isPending || cimQuery.trim().length < 2}
                      className="px-4 py-2.5 rounded-lg bg-[#82d8ff] text-[#0b1c30] text-sm font-bold disabled:opacity-50">
                      {cimSearch.isPending ? '...' : 'Rechercher'}
                    </button>
                  </form>
                  {cimError && <p className="text-sm text-red-500">{cimError}</p>}
                  {cimResults?.length === 0 && !cimError && <p className="text-sm text-[#6f787e]">Aucun résultat.</p>}
                  {(cimResults ?? []).map((r, i) => {
                    const key = `cim-${r.uri}-${i}`
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-[#0b1c30] text-sm">{r.title}</p>
                            {r.code && <p className="text-xs text-[#6f787e] font-mono">CIM-11 {r.code}</p>}
                          </div>
                          {onSelect && (
                            <button onClick={() => { onSelect({ source: 'cim', code: r.code ?? '—', label: r.title }); setOpen(false) }}
                              className="text-xs font-bold text-[#82d8ff] hover:underline whitespace-nowrap">
                              Utiliser
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {perms.can_associate_diagnosis && patientId && (
                            associated.has(key) ? (
                              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                                <Icon name="check_circle" style={{ fontSize: '14px' }} /> Associé au dossier
                              </span>
                            ) : (
                              <button onClick={() => associate.mutate({ source: 'cim', code: r.code ?? '—', label: r.title, key })}
                                disabled={associate.isPending}
                                className="text-xs font-bold px-3 py-1.5 rounded-full bg-[#82d8ff] text-[#0b1c30] disabled:opacity-50">
                                Associer au dossier patient
                              </button>
                            )
                          )}
                          {perms.can_export_diagnostic && (
                            <button onClick={() => exportResult(`CIM-11 ${r.code ?? ''} — ${r.title}`)} className="text-xs font-semibold text-[#6f787e] hover:text-[#0b1c30] flex items-center gap-1">
                              <Icon name="content_copy" style={{ fontSize: '14px' }} /> Copier
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
