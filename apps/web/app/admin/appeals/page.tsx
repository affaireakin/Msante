'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface Appeal {
  id: string
  message: string
  status: string
  admin_response: string | null
  created_at: string
  practitioner: {
    id: string
    speciality: string
    account_status: string
    users: { full_name: string }
  }
}

export default function AppealsPage() {
  const qc = useQueryClient()
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null)
  const [response, setResponse] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  const { data: appeals = [], isLoading } = useQuery<Appeal[]>({
    queryKey: ['practitioner-appeals'],
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_appeals')
        .select(`
          id, message, status, admin_response, created_at,
          practitioner:practitioners!practitioner_appeals_practitioner_id_fkey(
            id, speciality, account_status,
            users!inner(full_name)
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      return (data ?? []) as Appeal[]
    },
  })

  const reviewAppeal = useMutation({
    mutationFn: async ({
      appealId,
      decision,
      practitionerId,
    }: {
      appealId: string
      decision: 'accepted' | 'rejected'
      practitionerId: string
    }) => {
      const { data: { session } } = await supabase.auth.getSession()

      await supabase.from('practitioner_appeals').update({
        status: decision,
        admin_response: response,
        reviewed_at: new Date().toISOString(),
        reviewed_by: session?.user.id,
      }).eq('id', appealId)

      if (decision === 'accepted') {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update-practitioner-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              practitioner_id: practitionerId,
              new_status: 'active',
              reason: `Appel accepté: ${response}`,
            }),
          }
        )
        if (!res.ok) throw new Error('Erreur lors de la réactivation')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practitioner-appeals'] })
      setSelectedAppeal(null)
      setResponse('')
      setActionError(null)
    },
    onError: (e: Error) => setActionError(e.message),
  })

  const STATUS_BADGE: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    suspended: 'bg-amber-100 text-amber-700',
    blocked: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Appels en cours</h1>
        <p className="text-slate-500 text-sm mt-1">Contestations de praticiens suspendus ou bloqués</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : appeals.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-slate-300 text-5xl">gavel</span>
          <p className="text-slate-400 mt-3">Aucun appel en attente</p>
        </div>
      ) : (
        <div className="space-y-4">
          {appeals.map(appeal => (
            <div
              key={appeal.id}
              className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-slate-900">
                      {(appeal.practitioner as any)?.users?.full_name ?? 'Praticien'}
                    </h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[(appeal.practitioner as any)?.account_status] ?? ''}`}>
                      {(appeal.practitioner as any)?.account_status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{(appeal.practitioner as any)?.speciality}</p>
                  <p className="text-xs text-slate-400">
                    Soumis le {new Date(appeal.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedAppeal(appeal)
                    setResponse('')
                    setActionError(null)
                  }}
                  className="text-sm font-semibold text-[#006685] hover:underline whitespace-nowrap"
                >
                  Répondre
                </button>
              </div>
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-700 leading-relaxed">{appeal.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAppeal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Répondre à l'appel</h3>
              <button
                onClick={() => { setSelectedAppeal(null); setActionError(null) }}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600 italic">"{selectedAppeal.message}"</p>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">Votre réponse</label>
              <textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
                placeholder="Expliquez votre décision..."
              />
            </div>
            {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
            <div className="flex gap-3">
              <button
                onClick={() => reviewAppeal.mutate({
                  appealId: selectedAppeal.id,
                  decision: 'rejected',
                  practitionerId: (selectedAppeal.practitioner as any).id,
                })}
                disabled={!response || reviewAppeal.isPending}
                className="flex-1 border border-red-200 text-red-600 rounded-lg py-2.5 text-sm font-semibold hover:bg-red-50 transition disabled:opacity-50"
              >
                Rejeter
              </button>
              <button
                onClick={() => reviewAppeal.mutate({
                  appealId: selectedAppeal.id,
                  decision: 'accepted',
                  practitionerId: (selectedAppeal.practitioner as any).id,
                })}
                disabled={!response || reviewAppeal.isPending}
                className="flex-1 bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {reviewAppeal.isPending ? 'Traitement...' : 'Accepter & Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
