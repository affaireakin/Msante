'use client'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface DiagnosticPermissions {
  can_use_cim: boolean
  can_advanced_search_diagnostic: boolean
  can_associate_diagnosis: boolean
  can_export_diagnostic: boolean
}

interface CimResult {
  uri: string
  code: string | null
  title: string
}

export interface SelectedDiagnosis {
  source: 'cim'
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

export default function DiagnosticAidSearch({
  patientId, consultationId, appointmentId, onSelect,
}: {
  patientId?: string
  consultationId?: string
  appointmentId?: string
  onSelect?: (d: SelectedDiagnosis) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CimResult[] | null>(null)
  const [error, setError] = useState('')
  const [associated, setAssociated] = useState<Set<string>>(new Set())

  const { data: perms } = useDiagnosticPermissions()

  const search = useMutation({
    mutationFn: async (q: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnError } = await supabase.functions.invoke('icd-search', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { query: q },
      })
      if (fnError) throw fnError
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
      return (data as { results: CimResult[] }).results
    },
    onSuccess: (r) => { setResults(r); setError('') },
    onError: (e: Error) => { setResults([]); setError(e.message) },
  })

  const associate = useMutation({
    mutationFn: async ({ code, label, key }: { code: string; label: string; key: string }) => {
      if (!patientId) throw new Error('Aucun patient sélectionné')
      const { data: { user } } = await supabase.auth.getUser()
      const { data: practitioner } = await supabase.from('practitioners').select('id').eq('user_id', user!.id).single()
      if (!practitioner) throw new Error('Profil praticien introuvable')
      const { error: insertError } = await supabase.from('diagnosis_records').insert({
        patient_id: patientId,
        practitioner_id: practitioner.id,
        consultation_id: consultationId ?? null,
        appointment_id: appointmentId ?? null,
        source: 'cim', code, label,
      })
      if (insertError) throw insertError
      return key
    },
    onSuccess: (key) => setAssociated(prev => new Set(prev).add(key)),
  })

  if (!perms?.can_use_cim) return null

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
        Aide au diagnostic (CIM)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-[#0b1c30]">Aide au diagnostic — CIM (OMS ICD-11)</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <Icon name="close" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              <form onSubmit={e => { e.preventDefault(); if (query.trim().length >= 2) search.mutate(query.trim()) }} className="flex gap-2">
                <input
                  value={query} onChange={e => setQuery(e.target.value)}
                  placeholder={perms.can_advanced_search_diagnostic ? 'Nom, symptôme ou code CIM-11...' : 'Rechercher un diagnostic ou un code CIM-11...'}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[#82d8ff]"
                />
                <button type="submit" disabled={search.isPending || query.trim().length < 2}
                  className="px-4 py-2.5 rounded-lg bg-[#82d8ff] text-[#0b1c30] text-sm font-bold disabled:opacity-50">
                  {search.isPending ? '...' : 'Rechercher'}
                </button>
              </form>
              {error && <p className="text-sm text-red-500">{error}</p>}
              {results?.length === 0 && !error && <p className="text-sm text-[#6f787e]">Aucun résultat.</p>}
              {(results ?? []).map((r, i) => {
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
                          <button onClick={() => associate.mutate({ code: r.code ?? '—', label: r.title, key })}
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
            </div>
          </div>
        </div>
      )}
    </>
  )
}
