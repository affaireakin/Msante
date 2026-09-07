'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSignedDocumentUrl } from '@/lib/signedDocumentUrl'

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
type AccountStatus = 'active' | 'suspended' | 'blocked'
type PractType = 'healthcare' | 'wellness'

const DOC_TYPE_LABELS: Record<string, string> = {
  diploma: 'Diplôme',
  license: "Autorisation d'exercer",
  id_card: "Pièce d'identité",
  order_certificate: "Carte de l'Ordre",
  professional_insurance: 'Assurance pro',
  other: 'Autre',
}

interface VerificationDoc {
  id: string
  document_type: string
  file_url: string
  status: 'pending' | 'approved' | 'rejected'
}

interface Practitioner {
  id: string
  user_id: string
  speciality: string
  verification_status: VerifStatus
  account_status: AccountStatus | null
  practitioner_type: PractType | null
  permissions: { can_prescribe: boolean; can_order_exams: boolean } | null
  created_at: string
  organization_id: string | null
  users: { full_name: string; prefix: { prefix: string } | null } | null
  organizations: { name: string } | null
  verification_documents: VerificationDoc[]
}

const ACCOUNT_STATUS_COLORS: Record<AccountStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  blocked: 'bg-red-100 text-red-700',
}
const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: 'Actif',
  suspended: 'Suspendu',
  blocked: 'Bloqué',
}

const STATUS_ORDER: VerifStatus[] = ['pending', 'under_review', 'approved', 'rejected']
const STATUS_LABELS: Record<VerifStatus, string> = {
  pending: 'En attente',
  under_review: 'En revue',
  approved: 'Validé',
  rejected: 'Rejeté',
}
const STATUS_COLORS: Record<VerifStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}
const TYPE_LABELS: Record<PractType, string> = {
  healthcare: 'Professionnel de santé',
  wellness: 'Praticien bien-être',
}
const DEFAULT_PERMISSIONS: Record<PractType, { can_prescribe: boolean; can_order_exams: boolean }> = {
  healthcare: { can_prescribe: true, can_order_exams: true },
  wellness: { can_prescribe: false, can_order_exams: false },
}

function usePractitioners() {
  return useQuery({
    queryKey: ['admin-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, verification_status, account_status, practitioner_type, permissions, created_at, organization_id, users!user_id(full_name, prefix:professional_prefixes(prefix)), organizations(name), verification_documents(id, document_type, file_url, status)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const sorted = (data ?? []) as unknown as Practitioner[]
      sorted.sort((a, b) =>
        STATUS_ORDER.indexOf(a.verification_status) - STATUS_ORDER.indexOf(b.verification_status)
      )
      return sorted
    },
    staleTime: 30_000,
  })
}

// N'affiche un préfixe (Dr, Infirmier, Psychologue...) que s'il a réellement
// été attribué à ce praticien (/admin/prefixes) — jamais "Dr." par défaut
// simplement parce que le compte est de type "healthcare" (section 9 du
// cahier des charges du 2026-09-02).
function displayName(pract: Practitioner): string {
  const name = pract.users?.full_name ?? '—'
  if (name === '—') return name
  const prefix = pract.users?.prefix?.prefix
  return prefix ? `${prefix} ${name}` : name
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'under_review', label: 'En revue' },
  { value: 'approved', label: 'Validés' },
  { value: 'rejected', label: 'Rejetés' },
] as const

export default function PractitionersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>}>
      <PractitionersContent />
    </Suspense>
  )
}

function PractitionersContent() {
  const queryClient = useQueryClient()
  const searchParams = useSearchParams()
  const defaultStatus = searchParams.get('status') ?? 'all'
  const [statusFilter, setStatusFilter] = useState<string>(defaultStatus)
  const { data: practitioners, isLoading, error: queryError } = usePractitioners()
  const [rejectDialog, setRejectDialog] = useState<{ practId: string; userId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [statusDialog, setStatusDialog] = useState<{ practId: string; action: 'suspended' | 'blocked' | 'active' } | null>(null)
  const [statusReason, setStatusReason] = useState('')
  const [actionError, setActionError] = useState('')

  const updateStatus = useMutation({
    mutationFn: async ({ practId, status, userId, reason }: { practId: string; status: VerifStatus; userId: string; reason?: string }) => {
      const updates: Record<string, unknown> = { verification_status: status }
      if (status === 'approved') updates.is_verified = true
      const { error } = await supabase.from('practitioners').update(updates).eq('id', practId)
      if (error) throw error

      if (status === 'approved' || status === 'rejected') {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          const fn = status === 'approved' ? 'notify-practitioner-approved' : 'notify-practitioner-rejected'
          await supabase.functions.invoke(fn, {
            body: status === 'approved' ? { practitionerUserId: userId } : { practitionerUserId: userId, reason },
          })
        }
      }
    },
    onSuccess: () => {
      setActionError('')
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] })
    },
    // Le trigger Postgres trg_practitioner_approval_requires_documents (voir
    // 20260904000001) rejette un passage à 'approved' sans document soumis —
    // ce message doit rester visible, pas juste avaler l'erreur en silence
    // comme avant (le bouton s'arrêtait de tourner sans aucun retour).
    onError: (err: Error) => setActionError(err.message || "Erreur lors de la mise à jour du statut."),
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

  const [openingDocId, setOpeningDocId] = useState<string | null>(null)
  const handleOpenDocument = async (doc: VerificationDoc) => {
    setOpeningDocId(doc.id)
    try {
      const url = await getSignedDocumentUrl(doc.file_url)
      if (!url) { setActionError("Impossible d'ouvrir ce document."); return }
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setOpeningDocId(null)
    }
  }

  const handleReview = (practId: string, userId: string) => {
    updateStatus.mutate({ practId, status: 'under_review', userId })
  }

  const handleReject = () => {
    if (!rejectDialog || !rejectReason.trim()) return
    updateStatus.mutate({ practId: rejectDialog.practId, status: 'rejected', userId: rejectDialog.userId, reason: rejectReason.trim() })
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

  const updateAccountStatus = useMutation({
    mutationFn: async ({ practId, newStatus, reason }: { practId: string; newStatus: AccountStatus; reason: string }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/update-practitioner-status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ practitioner_id: practId, new_status: newStatus, reason }),
        }
      )
      if (!res.ok) throw new Error('Erreur lors de la mise à jour du statut')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] })
      setStatusDialog(null)
      setStatusReason('')
    },
  })

  const handleAccountStatus = () => {
    if (!statusDialog || !statusReason.trim()) return
    updateAccountStatus.mutate({ practId: statusDialog.practId, newStatus: statusDialog.action, reason: statusReason })
  }

  const handlePermissionToggle = (
    pract: Practitioner,
    key: 'can_prescribe' | 'can_order_exams'
  ) => {
    const current = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'healthcare']
    updatePermissions.mutate({
      practId: pract.id,
      practType: pract.practitioner_type ?? 'healthcare',
      permissions: { ...current, [key]: !current[key] },
    })
  }

  const filtered = (practitioners ?? []).filter(p =>
    statusFilter === 'all' || p.verification_status === statusFilter
  )
  const pendingCount = (practitioners ?? []).filter(p => p.verification_status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Praticiens</h1>
          <p className="text-sm text-[#6f787e] mt-1">Validation et gestion des permissions</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-amber-700">{pendingCount} en attente de validation</span>
          </div>
        )}
      </div>

      <ProfessionChangeRequestsPanel />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'all'
            ? (practitioners ?? []).length
            : (practitioners ?? []).filter(p => p.verification_status === f.value).length
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={{
                backgroundColor: statusFilter === f.value ? '#82d8ff' : 'rgba(255,255,255,0.70)',
                color: statusFilter === f.value ? '#fff' : '#475569',
                borderColor: statusFilter === f.value ? '#82d8ff' : 'rgba(190,200,206,0.40)',
              }}>
              {f.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: statusFilter === f.value ? 'rgba(255,255,255,0.25)' : '#e5eeff', color: statusFilter === f.value ? '#fff' : '#82d8ff' }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {queryError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Erreur de chargement : {(queryError as Error).message}
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700 flex items-start justify-between gap-4">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl h-40 animate-pulse bg-white/40" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((pract) => (
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
                  <div className="w-12 h-12 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-bold text-lg flex-shrink-0">
                    {(pract.users?.full_name ?? 'P').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[#0b1c30]">{displayName(pract)}</p>
                    <p className="text-sm text-[#6f787e]">{pract.speciality}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5">
                      Soumis le {new Date(pract.created_at).toLocaleDateString('fr-FR')}
                    </p>
                    {pract.organization_id && (
                      <Link
                        href={`/admin/organizations/${pract.organization_id}`}
                        className="inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[#e5eeff] text-[#005e7a] hover:bg-[#d3e4fe] transition-colors"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>business</span>
                        {pract.organizations?.name ?? 'Organisation'}
                      </Link>
                    )}
                  </div>
                </div>

                {/* Statut + Actions validation */}
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[pract.verification_status]}`}>
                    {STATUS_LABELS[pract.verification_status]}
                  </span>
                  {pract.account_status && pract.account_status !== 'active' && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${ACCOUNT_STATUS_COLORS[pract.account_status]}`}>
                      {ACCOUNT_STATUS_LABELS[pract.account_status]}
                    </span>
                  )}
                  {pract.verification_status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(pract.id, pract.user_id)}
                      disabled={updateStatus.isPending || pract.verification_documents.length === 0}
                      title={pract.verification_documents.length === 0 ? 'Aucun document soumis — impossible à approuver' : undefined}
                      className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  {(!pract.account_status || pract.account_status === 'active') && pract.verification_status === 'approved' && (
                    <>
                      <button
                        onClick={() => { setStatusDialog({ practId: pract.id, action: 'suspended' }); setStatusReason('') }}
                        className="px-4 py-2 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full hover:bg-amber-200 transition-colors"
                      >
                        Suspendre
                      </button>
                      <button
                        onClick={() => { setStatusDialog({ practId: pract.id, action: 'blocked' }); setStatusReason('') }}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-full hover:bg-red-200 transition-colors"
                      >
                        Bloquer
                      </button>
                    </>
                  )}
                  {pract.account_status && pract.account_status !== 'active' && (
                    <button
                      onClick={() => { setStatusDialog({ practId: pract.id, action: 'active' }); setStatusReason('Compte réactivé après vérification') }}
                      className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full hover:bg-emerald-200 transition-colors"
                    >
                      Réactiver
                    </button>
                  )}
                </div>
              </div>

              {/* Documents de vérification — un praticien ne doit jamais être
                  approuvable sans qu'un admin ait pu au moins voir ce qu'il a
                  soumis (voir trigger trg_practitioner_approval_requires_documents,
                  20260904000001, qui refuse le passage à 'approved' côté DB si
                  cette liste est vide). */}
              <div className="mt-4 pt-4 border-t border-slate-100/60">
                <p className="text-xs font-bold text-[#6f787e] uppercase tracking-widest mb-2">
                  Documents ({pract.verification_documents.length})
                </p>
                {pract.verification_documents.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 inline-block">
                    Aucun document soumis
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pract.verification_documents.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => handleOpenDocument(doc)}
                        disabled={openingDocId === doc.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#e5eeff] text-[#005e7a] hover:bg-[#d3e4fe] transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>description</span>
                        {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                        {doc.status === 'rejected' && <span className="text-red-600">· rejeté</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Permissions */}
              <div className="mt-6 pt-5 border-t border-slate-100/60 flex items-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-widest">Type</label>
                  <select
                    value={pract.practitioner_type ?? 'healthcare'}
                    onChange={(e) => handleTypeChange(pract, e.target.value as PractType)}
                    className="text-sm border border-slate-200/50 rounded-lg px-3 py-1.5 bg-white/60 text-[#0b1c30] outline-none focus:border-[#82d8ff]"
                  >
                    {(Object.entries(TYPE_LABELS) as [PractType, string][]).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {(['can_prescribe', 'can_order_exams'] as const).map((key) => {
                  const perms = pract.permissions ?? DEFAULT_PERMISSIONS[pract.practitioner_type ?? 'healthcare']
                  const enabled = perms[key]
                  return (
                    <button
                      key={key}
                      onClick={() => handlePermissionToggle(pract, key)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        enabled
                          ? 'bg-[#82d8ff] text-[#0b1c30] border-[#82d8ff]'
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

          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#6f787e]">
              <p className="text-lg font-medium">
                {statusFilter === 'all' ? 'Aucun praticien enregistré' : `Aucun praticien avec le statut « ${STATUS_FILTERS.find(f => f.value === statusFilter)?.label ?? statusFilter} »`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Account Status Dialog */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setStatusDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-2">
              {statusDialog.action === 'suspended' ? 'Suspendre le praticien' : statusDialog.action === 'blocked' ? 'Bloquer le praticien' : 'Réactiver le praticien'}
            </h3>
            <p className="text-sm text-[#6f787e] mb-4">Ce motif sera envoyé au praticien par notification.</p>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Motif obligatoire..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none"
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStatusDialog(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                onClick={handleAccountStatus}
                disabled={!statusReason.trim() || updateAccountStatus.isPending}
                className={`flex-1 py-2.5 text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
                  statusDialog.action === 'active' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  statusDialog.action === 'suspended' ? 'bg-amber-500 hover:bg-amber-600' :
                  'bg-red-500 hover:bg-red-600'
                }`}
              >
                {updateAccountStatus.isPending ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Motif de rejet</h3>
            <p className="text-sm text-[#6f787e] mb-4">Ce motif sera conservé en interne.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Documents insuffisants, diplôme non reconnu..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none"
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

// ── Demandes de changement de profession ──────────────────────────────────
// Retour terrain (2026-09-07) : un praticien ne modifie plus sa profession/
// préfixe lui-même (mobile) — il soumet une demande ici validée par un admin.
// cf. supabase/migrations/20260907000001_profession_change_requests.sql

interface ProfessionChangeRequest {
  id: string
  practitioner_id: string
  current_speciality: string
  requested_speciality: string
  requested_prefix_id: string | null
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  practitioners: { id: string; users: { full_name: string } | null } | null
}

function useProfessionChangeRequests() {
  return useQuery({
    queryKey: ['profession-change-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profession_change_requests')
        .select('id, practitioner_id, current_speciality, requested_speciality, requested_prefix_id, reason, status, created_at, practitioners(id, users!user_id(full_name))')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as ProfessionChangeRequest[]
    },
    staleTime: 30_000,
  })
}

function ProfessionChangeRequestsPanel() {
  const { data: requests = [] } = useProfessionChangeRequests()
  const queryClient = useQueryClient()
  const [rejectTarget, setRejectTarget] = useState<ProfessionChangeRequest | null>(null)
  const [rejectNote, setRejectNote] = useState('')

  const respond = useMutation({
    mutationFn: async ({ req, decision, note }: { req: ProfessionChangeRequest; decision: 'approved' | 'rejected'; note?: string }) => {
      if (decision === 'approved') {
        const { error: e1 } = await supabase.from('practitioners')
          .update({ speciality: req.requested_speciality })
          .eq('id', req.practitioner_id)
        if (e1) throw e1
        if (req.requested_prefix_id) {
          const { data: pract } = await supabase.from('practitioners').select('user_id').eq('id', req.practitioner_id).single()
          if (pract?.user_id) {
            const { error: e2 } = await supabase.from('users').update({ prefix_id: req.requested_prefix_id }).eq('id', pract.user_id)
            if (e2) throw e2
          }
        }
      }
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('profession_change_requests')
        .update({ status: decision, admin_note: note ?? null, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', req.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profession-change-requests'] })
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] })
      setRejectTarget(null)
      setRejectNote('')
    },
  })

  if (requests.length === 0) return null

  return (
    <div className="rounded-2xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,248,225,0.60)', border: '1px solid rgba(112,93,0,0.20)' }}>
      <p className="text-sm font-bold text-[#705d00] flex items-center gap-2">
        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>swap_horiz</span>
        Demandes de changement de profession ({requests.length})
      </p>
      {requests.map(req => (
        <div key={req.id} className="rounded-xl p-4 bg-white/70 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-semibold text-[#0b1c30] text-sm">{req.practitioners?.users?.full_name ?? '—'}</p>
            <p className="text-xs text-[#6f787e] mt-0.5">
              « {req.current_speciality} » → « {req.requested_speciality} »
            </p>
            {req.reason && <p className="text-xs text-[#3f484d] mt-1 italic">{req.reason}</p>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => respond.mutate({ req, decision: 'approved' })}
              disabled={respond.isPending}
              className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-full hover:bg-emerald-600 disabled:opacity-50"
            >
              Approuver
            </button>
            <button
              onClick={() => setRejectTarget(req)}
              className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full hover:bg-red-200"
            >
              Refuser
            </button>
          </div>
        </div>
      ))}

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-[#0b1c30] mb-3">Refuser cette demande</h3>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="Motif (optionnel)..."
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setRejectTarget(null)} className="flex-1 py-2 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e]">
                Annuler
              </button>
              <button
                onClick={() => respond.mutate({ req: rejectTarget, decision: 'rejected', note: rejectNote.trim() || undefined })}
                disabled={respond.isPending}
                className="flex-1 py-2 bg-red-500 text-white rounded-full text-sm font-semibold disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
