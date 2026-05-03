'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
type PractType = 'doctor' | 'psychologist' | 'coach' | 'nutritionist' | 'other'

interface Practitioner {
  id: string
  user_id: string
  speciality: string
  verification_status: VerifStatus
  practitioner_type: PractType | null
  permissions: { can_prescribe: boolean; can_order_exams: boolean } | null
  created_at: string
  users: { full_name: string } | null
}

const STATUS_ORDER: VerifStatus[] = ['pending', 'under_review', 'approved', 'rejected']
const STATUS_LABELS: Record<VerifStatus, string> = {
  pending: 'En attente',
  under_review: 'En revue',
  approved: 'Approuvé',
  rejected: 'Rejeté',
}
const STATUS_COLORS: Record<VerifStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<PractType, string> = {
  doctor: 'Médecin',
  psychologist: 'Psychologue',
  coach: 'Coach',
  nutritionist: 'Nutritionniste',
  other: 'Autre',
}
const DEFAULT_PERMISSIONS: Record<PractType, { can_prescribe: boolean; can_order_exams: boolean }> = {
  doctor: { can_prescribe: true, can_order_exams: true },
  psychologist: { can_prescribe: false, can_order_exams: false },
  coach: { can_prescribe: false, can_order_exams: false },
  nutritionist: { can_prescribe: false, can_order_exams: false },
  other: { can_prescribe: false, can_order_exams: false },
}

function usePractitioners() {
  return useQuery({
    queryKey: ['admin-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, verification_status, practitioner_type, permissions, created_at, users!inner(full_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const sorted = (data ?? []) as Practitioner[]
      sorted.sort((a, b) =>
        STATUS_ORDER.indexOf(a.verification_status) - STATUS_ORDER.indexOf(b.verification_status)
      )
      return sorted
    },
    staleTime: 30_000,
  })
}

export default function PractitionersPage() {
  const queryClient = useQueryClient()
  const { data: practitioners, isLoading } = usePractitioners()
  const [rejectDialog, setRejectDialog] = useState<{ practId: string; userId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const updateStatus = useMutation({
    mutationFn: async ({ practId, status, userId }: { practId: string; status: VerifStatus; userId: string }) => {
      const updates: Record<string, unknown> = { verification_status: status }
      if (status === 'approved') updates.is_verified = true
      const { error } = await supabase.from('practitioners').update(updates).eq('id', practId)
      if (error) throw error

      if (status === 'approved') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          await supabase.functions.invoke('notify-practitioner-approved', {
            body: { practitionerUserId: userId },
          })
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] }),
  })

  const updatePermissions = useMutation({
    mutationFn: async ({
      practId,
      practType,
      permissions,
    }: {
      practId: string
      practType: PractType
      permissions: { can_prescribe: boolean; can_order_exams: boolean }
    }) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ practitioner_type: practType, permissions })
        .eq('id', practId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] }),
  })

  const handleApprove = (practId: string, userId: string) => {
    updateStatus.mutate({ practId, status: 'approved', userId })
  }

  const handleReview = (practId: string, userId: string) => {
    updateStatus.mutate({ practId, status: 'under_review', userId })
  }

  const handleReject = () => {
    if (!rejectDialog || !rejectReason.trim()) return
    updateStatus.mutate({ practId: rejectDialog.practId, status: 'rejected', userId: rejectDialog.userId })
    setRejectDialog(null)
    setRejectReason('')
  }

  const handleTypeChange = (pract: Practitioner, newType: PractType) => {
    updatePermissions.mutate({
      practId: pract.id,
      practType: newType,
      permissions: DEFAULT_PERMISSIONS[newType],
    })
  }

  const handlePermissionToggle = (
    pract: Practitioner,
    key: 'can_prescribe' | 'can_order_exams'
  ) => {
    const current = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'doctor']
    updatePermissions.mutate({
      practId: pract.id,
      practType: pract.practitioner_type ?? 'doctor',
      permissions: { ...current, [key]: !current[key] },
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Praticiens</h1>
        <p className="text-sm text-[#6f787e] mt-1">Validation et gestion des permissions</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-40 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {(practitioners ?? []).map((pract) => (
            <div
              key={pract.id}
              className="rounded-2xl p-6"
              style={{
                backgroundColor: 'rgba(255,255,255,0.60)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.80)',
                boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
              }}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                {/* Identité */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#006685] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(pract.users?.full_name ?? 'P').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0b1c30]">{pract.users?.full_name ?? '—'}</p>
                    <p className="text-sm text-[#6f787e]">{pract.speciality}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5">
                      Soumis le {new Date(pract.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                {/* Statut + Actions validation */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[pract.verification_status]}`}>
                    {STATUS_LABELS[pract.verification_status]}
                  </span>
                  {pract.verification_status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(pract.id, pract.user_id)}
                      disabled={updateStatus.isPending}
                      className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50"
                    >
                      Approuver
                    </button>
                  )}
                  {pract.verification_status === 'pending' && (
                    <button
                      onClick={() => handleReview(pract.id, pract.user_id)}
                      disabled={updateStatus.isPending}
                      className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-200 transition-colors disabled:opacity-50"
                    >
                      Mettre en revue
                    </button>
                  )}
                  {pract.verification_status !== 'rejected' && (
                    <button
                      onClick={() => setRejectDialog({ practId: pract.id, userId: pract.user_id })}
                      className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-full hover:bg-red-200 transition-colors"
                    >
                      Rejeter
                    </button>
                  )}
                </div>
              </div>

              {/* Permissions */}
              <div className="mt-6 pt-5 border-t border-slate-100/60 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Type</label>
                  <select
                    value={pract.practitioner_type ?? 'doctor'}
                    onChange={(e) => handleTypeChange(pract, e.target.value as PractType)}
                    className="text-sm border border-slate-200/50 rounded-lg px-3 py-1.5 bg-white/60 text-[#0b1c30] outline-none focus:border-[#006685]"
                  >
                    {(Object.entries(TYPE_LABELS) as [PractType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {(['can_prescribe', 'can_order_exams'] as const).map((key) => {
                  const perms = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'doctor']
                  const enabled = perms[key]
                  return (
                    <button
                      key={key}
                      onClick={() => handlePermissionToggle(pract, key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        enabled
                          ? 'bg-[#006685] text-white border-[#006685]'
                          : 'bg-white/60 text-[#6f787e] border-slate-200/50'
                      }`}
                    >
                      {enabled ? '✓' : '✗'}{' '}
                      {key === 'can_prescribe' ? 'Ordonnances' : 'Examens'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {(practitioners ?? []).length === 0 && (
            <div className="text-center py-16 text-[#6f787e]">
              <p className="text-lg font-medium">Aucun praticien à afficher</p>
            </div>
          )}
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Motif de rejet</h3>
            <p className="text-sm text-[#6f787e] mb-4">Ce motif sera conservé en interne.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Documents insuffisants, diplôme non reconnu..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#006685] resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setRejectDialog(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-full text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
