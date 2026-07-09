'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface Secretary {
  id: string
  status: 'active' | 'revoked'
  created_at: string
  user: { full_name: string; email: string | null } | null
}

function useMyPractitionerId() {
  return useQuery<string | null>({
    queryKey: ['my-practitioner-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).maybeSingle()
      return data?.id ?? null
    },
    staleTime: 5 * 60_000,
  })
}

function useSecretaries(practitionerId: string | null) {
  return useQuery<Secretary[]>({
    queryKey: ['practitioner-secretaries', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_secretaries')
        .select('id, status, created_at, user:user_id(full_name, email)')
        .eq('practitioner_id', practitionerId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Secretary[]
    },
  })
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error: fnError } = await supabase.functions.invoke('invite-practitioner', {
        body: { firstname, lastname, email, phone, account_type: 'secretary' },
      })
      if (fnError) throw fnError
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
    },
    onSuccess: () => {
      setSent(true)
      queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] })
    },
    onError: (e: Error) => setError(e.message || "Erreur lors de l'envoi de l'invitation."),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <Icon name="check_circle" style={{ fontSize: '28px', color: '#059669' }} />
            </div>
            <h3 className="text-lg font-bold text-[#0b1c30]">Invitation envoyée !</h3>
            <p className="text-sm text-[#6f787e]">{firstname} recevra un email avec un code de vérification.</p>
            <button onClick={onClose} className="w-full py-2.5 bg-[#82d8ff] text-[#0b1c30] rounded-full text-sm font-semibold">
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-bold text-[#0b1c30] mb-1">Inviter un(e) secrétaire</h3>
            <p className="text-sm text-[#6f787e] mb-5">Il/elle pourra consulter et gérer vos rendez-vous (confirmer, reporter, annuler).</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={firstname} onChange={e => setFirstname(e.target.value)} placeholder="Prénom"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
                <input value={lastname} onChange={e => setLastname(e.target.value)} placeholder="Nom"
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              </div>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Téléphone (optionnel)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-[#6f787e]">
                  Annuler
                </button>
                <button
                  onClick={() => invite.mutate()}
                  disabled={invite.isPending || !firstname.trim() || !lastname.trim() || !email.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-[#82d8ff] text-[#0b1c30] text-sm font-bold disabled:opacity-50"
                >
                  {invite.isPending ? 'Envoi...' : "Envoyer l'invitation"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PractitionerSecretaryPage() {
  const [inviting, setInviting] = useState(false)
  const { data: practitionerId } = useMyPractitionerId()
  const { data: secretaries, isLoading } = useSecretaries(practitionerId ?? null)
  const queryClient = useQueryClient()

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioner_secretaries').update({ status: 'revoked' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] }),
  })

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioner_secretaries').update({ status: 'active' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] }),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Secrétaires</h1>
          <p className="text-sm text-[#6f787e] mt-1">Déléguez la gestion de vos rendez-vous à un(e) assistant(e).</p>
        </div>
        <button
          onClick={() => setInviting(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#82d8ff] text-[#0b1c30] text-sm font-bold"
        >
          <Icon name="person_add" style={{ fontSize: '18px' }} />
          Inviter
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-20 rounded-2xl bg-white/40 animate-pulse" />)}</div>
      ) : (secretaries ?? []).length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="support_agent" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun(e) secrétaire</p>
          <p className="text-sm text-[#6f787e] mt-1">Invitez quelqu'un pour vous aider à gérer votre agenda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(secretaries ?? []).map(s => (
            <div key={s.id} className="rounded-2xl p-5 flex items-center justify-between" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
                  <Icon name="support_agent" style={{ fontSize: '20px', color: '#005e7a' }} />
                </div>
                <div>
                  <p className="font-bold text-[#0b1c30]">{s.user?.full_name ?? '—'}</p>
                  <p className="text-xs text-[#6f787e]">{s.user?.email ?? ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {s.status === 'active' ? 'Actif' : 'Révoqué'}
                </span>
                {s.status === 'active' ? (
                  <button onClick={() => revoke.mutate(s.id)} className="text-xs font-semibold text-red-600 hover:underline">Révoquer</button>
                ) : (
                  <button onClick={() => reactivate.mutate(s.id)} className="text-xs font-semibold text-[#005e7a] hover:underline">Réactiver</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} />}
    </div>
  )
}
