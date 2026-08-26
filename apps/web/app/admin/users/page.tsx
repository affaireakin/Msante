'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSignedDocumentUrl } from '@/lib/signedDocumentUrl'

type Role = 'all' | 'patient' | 'practitioner' | 'admin'
type AccountStatus = 'active' | 'suspended' | 'blocked'
type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected'
type DocumentStatus = 'pending' | 'approved' | 'rejected'
type DocumentType = 'diploma' | 'license' | 'id_card' | 'order_certificate' | 'professional_insurance' | 'other'

interface UserRow {
  id: string
  full_name: string
  role: string
  country: string | null
  onboarding_completed: boolean
  created_at: string
  account_status: AccountStatus | null
  prefix_id: string | null
  phone: string | null
  email: string | null
}

interface PrefixOption {
  id: string
  prefix: string
  label: string
  allowed_roles: string[]
}

interface PractitionerProfile {
  id: string
  speciality: string
  is_verified: boolean
  verification_status: VerificationStatus
  bio: string | null
  rating: number | null
  total_reviews: number
  organization_id: string | null
  organizations: { name: string } | null
}

interface VerificationDocument {
  id: string
  document_type: DocumentType
  file_url: string
  status: DocumentStatus
  created_at: string
}

const PAGE_SIZE = 10

// ─── Role colors ────────────────────────────────────────────────────────────
const roleColors: Record<string, { bg: string; text: string }> = {
  admin:        { bg: '#ede9fe', text: '#7c3aed' },
  practitioner: { bg: '#e5eeff', text: '#82d8ff' },
  patient:      { bg: '#e8f5e9', text: '#1d7a3a' },
}

// ─── Verification status style ───────────────────────────────────────────────
const verificationColors: Record<VerificationStatus, { bg: string; text: string }> = {
  pending:      { bg: '#fff8e1', text: '#705d00' },
  under_review: { bg: '#e5eeff', text: '#82d8ff' },
  approved:     { bg: '#e8f5e9', text: '#1d7a3a' },
  rejected:     { bg: '#ffdad6', text: '#ba1a1a' },
}

// ─── Account status style ────────────────────────────────────────────────────
const accountStatusColors: Record<string, { bg: string; text: string }> = {
  active:    { bg: '#e8f5e9', text: '#1d7a3a' },
  suspended: { bg: '#ffdad6', text: '#ba1a1a' },
  blocked:   { bg: '#fce4ec', text: '#880e4f' },
}

const docTypeLabels: Record<DocumentType, string> = {
  diploma:                'Diplôme',
  license:                'Licence professionnelle',
  id_card:                'Carte d\'identité',
  order_certificate:      'Certificat de l\'Ordre professionnel',
  professional_insurance: 'Assurance professionnelle',
  other:                  'Autre document',
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useUsers(role: Role, search: string, page: number) {
  return useQuery({
    queryKey: ['admin-users', role, search, page],
    queryFn: async () => {
      let query = supabase
        .from('users')
        .select('id, full_name, role, country, onboarding_completed, created_at, account_status, prefix_id, phone, email', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (role !== 'all') query = query.eq('role', role)
      if (search.trim()) query = query.ilike('full_name', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error
      return { users: (data ?? []) as UserRow[], total: count ?? 0 }
    },
    staleTime: 30_000,
  })
}

function useSuspendedCount() {
  return useQuery({
    queryKey: ['admin-users-suspended-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('account_status', 'suspended')
      if (error) throw error
      return count ?? 0
    },
    staleTime: 60_000,
  })
}

function usePractitionerProfile(userId: string | null) {
  return useQuery({
    queryKey: ['practitioner-profile', userId],
    queryFn: async () => {
      if (!userId) return null
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, speciality, is_verified, verification_status, bio, rating, total_reviews, organization_id, organizations(name)')
        .eq('user_id', userId)
        .single()
      if (error) return null
      return data as unknown as PractitionerProfile
    },
    enabled: !!userId,
    staleTime: 30_000,
  })
}

function useVerificationDocuments(practitionerId: string | null) {
  return useQuery({
    queryKey: ['verification-documents', practitionerId],
    queryFn: async () => {
      if (!practitionerId) return []
      const { data, error } = await supabase
        .from('verification_documents')
        .select('id, document_type, file_url, status, created_at')
        .eq('practitioner_id', practitionerId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VerificationDocument[]
    },
    enabled: !!practitionerId,
    staleTime: 30_000,
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const c = roleColors[role] ?? { bg: '#f1f5f9', text: '#64748b' }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {role}
    </span>
  )
}

function AccountStatusBadge({ status }: { status: AccountStatus | null }) {
  const resolved = status ?? 'active'
  const c = accountStatusColors[resolved] ?? accountStatusColors.active
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {resolved === 'active' ? 'Actif' : resolved === 'suspended' ? 'Suspendu' : 'Bloqué'}
    </span>
  )
}

function VerificationBadge({ status }: { status: VerificationStatus }) {
  const c = verificationColors[status]
  const labels: Record<VerificationStatus, string> = {
    pending:      'En attente',
    under_review: 'En révision',
    approved:     'Approuvé',
    rejected:     'Rejeté',
  }
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      {labels[status]}
    </span>
  )
}

function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const map: Record<DocumentStatus, { bg: string; text: string; label: string }> = {
    pending:  { bg: '#fff8e1', text: '#705d00', label: 'En attente' },
    approved: { bg: '#e8f5e9', text: '#1d7a3a', label: 'Approuvé' },
    rejected: { bg: '#ffdad6', text: '#ba1a1a', label: 'Rejeté' },
  }
  const s = map[status]
  return (
    <span
      className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  )
}

// ─── Practitioner Panel Section ───────────────────────────────────────────────

function PractitionerSection({ userId }: { userId: string }) {
  const queryClient = useQueryClient()

  const { data: practitioner, isLoading: loadingPrac } = usePractitionerProfile(userId)
  const { data: documents, isLoading: loadingDocs } = useVerificationDocuments(practitioner?.id ?? null)

  const approveMutation = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ is_verified: true, verification_status: 'approved' })
        .eq('id', practitionerId)
      if (error) throw error
      return practitionerId
    },
    onSuccess: async (practitionerId: string) => {
      try {
        // Missing actor_id used to mean these two logs had no "auteur" at all.
        const { data: { user: actor } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          actor_id: actor?.id ?? null,
          action: 'practitioner.approved',
          resource_type: 'practitioner',
          resource_id: practitionerId,
          new_values: { verification_status: 'approved', is_verified: true },
          module: 'practitioner',
          target_user_id: userId,
          target_role: 'practitioner',
        })
      } catch {
        // audit log failure is non-blocking
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['practitioner-profile', userId] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { error } = await supabase
        .from('practitioners')
        .update({ verification_status: 'rejected' })
        .eq('id', practitionerId)
      if (error) throw error
      return practitionerId
    },
    onSuccess: async (practitionerId: string) => {
      try {
        const { data: { user: actor } } = await supabase.auth.getUser()
        await supabase.from('audit_logs').insert({
          actor_id: actor?.id ?? null,
          action: 'practitioner.rejected',
          resource_type: 'practitioner',
          resource_id: practitionerId,
          new_values: { verification_status: 'rejected' },
          module: 'practitioner',
          target_user_id: userId,
          target_role: 'practitioner',
        })
      } catch {
        // audit log failure is non-blocking
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['practitioner-profile', userId] })
    },
  })

  // Individual document review never existed — the admin could only
  // approve/reject the practitioner's profile as a whole, with no way to
  // record a decision on any specific uploaded document.
  const reviewDocumentMutation = useMutation({
    mutationFn: async ({ docId, decision }: { docId: string; decision: 'approved' | 'rejected' }) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase
        .from('verification_documents')
        .update({ status: decision, reviewed_by: session?.user.id ?? null, reviewed_at: new Date().toISOString() })
        .eq('id', docId)
      if (error) throw error
      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'document_reviewed',
        title: decision === 'approved' ? 'Document validé ✓' : 'Document rejeté',
        body: decision === 'approved' ? 'Un de vos documents a été validé par un administrateur.' : 'Un de vos documents a été rejeté — vérifiez votre profil pour le remplacer.',
        channel: 'push',
        data: {},
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['verification-documents', practitioner?.id ?? null] }),
  })

  if (loadingPrac) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-4 bg-slate-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (!practitioner) {
    return (
      <div className="text-sm text-[#6f787e] italic">Profil praticien introuvable.</div>
    )
  }

  const canAct = practitioner.verification_status === 'pending' || practitioner.verification_status === 'under_review'
  const isBusy = approveMutation.isPending || rejectMutation.isPending

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#82d8ff] text-base">medical_services</span>
        <span className="text-sm font-bold text-[#0b1c30] uppercase tracking-wide">Vérification praticien</span>
      </div>

      {/* Status + Speciality */}
      <div className="space-y-3 rounded-xl p-4" style={{ backgroundColor: '#f8f9ff', border: '1px solid #e5eeff' }}>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6f787e]">Statut vérification</span>
          <VerificationBadge status={practitioner.verification_status} />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6f787e]">Spécialité</span>
          <span className="text-xs font-medium text-[#0b1c30]">{practitioner.speciality}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-[#6f787e]">Organisation</span>
          {practitioner.organization_id ? (
            <Link
              href={`/admin/organizations/${practitioner.organization_id}`}
              className="text-xs font-semibold text-[#005e7a] hover:underline"
            >
              {practitioner.organizations?.name ?? 'Voir l\'organisation'}
            </Link>
          ) : (
            <span className="text-xs text-[#6f787e] italic">Indépendant</span>
          )}
        </div>
        {practitioner.rating !== null && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-[#6f787e]">Note</span>
            <span className="text-xs font-medium text-[#0b1c30]">
              ★ {practitioner.rating.toFixed(1)} ({practitioner.total_reviews} avis)
            </span>
          </div>
        )}
      </div>

      {/* Approve / Reject actions */}
      {canAct && (
        <div className="flex gap-2">
          <button
            onClick={() => approveMutation.mutate(practitioner.id)}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#e8f5e9', color: '#1d7a3a' }}
          >
            <span className="material-symbols-outlined text-sm">check_circle</span>
            {approveMutation.isPending ? 'Approbation…' : 'Approuver'}
          </button>
          <button
            onClick={() => rejectMutation.mutate(practitioner.id)}
            disabled={isBusy}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}
          >
            <span className="material-symbols-outlined text-sm">cancel</span>
            {rejectMutation.isPending ? 'Rejet…' : 'Rejeter'}
          </button>
        </div>
      )}
      {(approveMutation.isError || rejectMutation.isError) && (
        <p style={{ color: '#ba1a1a', fontSize: '12px', marginTop: '6px' }}>
          {approveMutation.isError
            ? (approveMutation.error instanceof Error ? approveMutation.error.message : 'Erreur approbation')
            : (rejectMutation.error instanceof Error ? rejectMutation.error.message : 'Erreur rejet')}
        </p>
      )}

      {/* Documents */}
      <div>
        <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-2">
          Documents ({documents?.length ?? 0})
        </p>
        {loadingDocs ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (documents ?? []).length === 0 ? (
          <p className="text-xs text-[#6f787e] italic">Aucun document soumis.</p>
        ) : (
          <div className="space-y-2">
            {(documents ?? []).map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[#82d8ff] text-sm flex-shrink-0">description</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#0b1c30] truncate">
                      {docTypeLabels[doc.document_type] ?? doc.document_type}
                    </p>
                    <p className="text-xs text-[#6f787e]">
                      {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <DocStatusBadge status={doc.status as DocumentStatus} />
                  {doc.status === 'pending' && (
                    <>
                      <button
                        onClick={() => reviewDocumentMutation.mutate({ docId: doc.id, decision: 'approved' })}
                        disabled={reviewDocumentMutation.isPending}
                        title="Valider ce document"
                        className="text-[#1d7a3a] hover:text-[#145c2c] transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                      </button>
                      <button
                        onClick={() => reviewDocumentMutation.mutate({ docId: doc.id, decision: 'rejected' })}
                        disabled={reviewDocumentMutation.isPending}
                        title="Rejeter ce document"
                        className="text-[#ba1a1a] hover:text-[#930009] transition-colors disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const url = await getSignedDocumentUrl(doc.file_url)
                      if (url) window.open(url, '_blank', 'noopener,noreferrer')
                    }}
                    className="text-[#82d8ff] hover:text-[#004d65] transition-colors"
                    title="Ouvrir le document"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Prefix Section ───────────────────────────────────────────────────────────

function PrefixSection({ user }: { user: UserRow }) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string>(user.prefix_id ?? '')

  const { data: prefixes = [] } = useQuery<PrefixOption[]>({
    queryKey: ['prefixes-for-role', user.role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_prefixes')
        .select('id, prefix, label, allowed_roles')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
      if (error) throw error
      return (data ?? []).filter(p =>
        (p.allowed_roles as string[]).includes(user.role)
      ) as PrefixOption[]
    },
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: async (prefixId: string | null) => {
      const { error } = await supabase
        .from('users')
        .update({ prefix_id: prefixId })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    },
  })

  const handleSave = () => {
    const val = selected === '' ? null : selected
    saveMutation.mutate(val)
  }

  const currentPrefix = prefixes.find(p => p.id === selected)
  const isDirty = selected !== (user.prefix_id ?? '')

  return (
    <div>
      <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-2">Préfixe professionnel</p>
      <div className="flex gap-2 items-center">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="flex-1 px-3 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-colors"
        >
          <option value="">— Aucun préfixe —</option>
          {prefixes.map(p => (
            <option key={p.id} value={p.id}>{p.prefix} — {p.label}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          style={{ backgroundColor: '#82d8ff', color: '#fff' }}
        >
          {saveMutation.isPending ? '…' : 'OK'}
        </button>
      </div>
      {currentPrefix && (
        <p className="text-[10px] text-[#82d8ff] mt-1.5 px-1 font-medium">
          Affiché : <strong>{currentPrefix.prefix} {user.full_name}</strong>
        </p>
      )}
      {saveMutation.isSuccess && (
        <p className="text-[10px] text-emerald-600 mt-1 px-1">Préfixe enregistré ✓</p>
      )}
      {saveMutation.isError && (
        <p className="text-[10px] text-[#ba1a1a] mt-1 px-1">Erreur lors de l&apos;enregistrement</p>
      )}
    </div>
  )
}

// ─── User Profile Slide-out ───────────────────────────────────────────────────

function UserProfilePanel({
  user,
  onClose,
}: {
  user: UserRow
  onClose: () => void
}) {
  const queryClient = useQueryClient()

  const isSuspended = user.account_status === 'suspended'
  const [showSuspendForm, setShowSuspendForm] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')

  // Section 21.3 : le nom doit pouvoir être consulté, modifié et enregistré
  // depuis la fiche utilisateur.
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(user.full_name)

  const renameMutation = useMutation({
    mutationFn: async (fullName: string) => {
      const { error } = await supabase.from('users').update({ full_name: fullName }).eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setEditingName(false)
    },
  })

  const suspendMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const newStatus: AccountStatus = isSuspended ? 'active' : 'suspended'
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée, reconnectez-vous.')
      // Suspending must actually lock the account out (Supabase Auth ban), not
      // just flip a display-only column — see set-account-status. The reason
      // is now required so set-account-status can send the patient/practitioner
      // a real email/WhatsApp notification (motif, actions possibles, recours).
      const { data, error } = await supabase.functions.invoke('set-account-status', {
        body: { user_id: user.id, new_status: newStatus, reason },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
      return newStatus
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users-suspended-count'] })
      setShowSuspendForm(false)
      setSuspendReason('')
    },
  })

  const [showDeleteForm, setShowDeleteForm] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-account', {
        body: { target_user_id: user.id, reason },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users-suspended-count'] })
      onClose()
    },
  })

  const avatarBg = roleColors[user.role]?.bg ?? '#e5eeff'
  const avatarText = roleColors[user.role]?.text ?? '#82d8ff'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full sm:w-96 h-full flex flex-col overflow-y-auto"
        style={{
          backgroundColor: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '-10px 0 40px rgba(0,102,133,0.08)',
          fontFamily: 'Manrope',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-[#0b1c30]">Profil utilisateur</h2>
          <button
            onClick={onClose}
            aria-label="Fermer le panneau"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            <span className="material-symbols-outlined text-[#6f787e] text-lg">close</span>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ backgroundColor: avatarBg, color: avatarText }}
            >
              {initials(user.full_name)}
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              {editingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-[#82d8ff] text-sm text-[#0b1c30] outline-none focus:ring-2 focus:ring-[#82d8ff]/20"
                    autoFocus
                  />
                  {renameMutation.isError && (
                    <p className="text-xs text-red-500">{(renameMutation.error as Error).message}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingName(false)}
                      className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-[#6f787e] hover:bg-slate-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={() => renameMutation.mutate(nameDraft.trim())}
                      disabled={!nameDraft.trim() || renameMutation.isPending}
                      className="px-3 py-1 rounded-lg bg-[#82d8ff] text-xs font-bold text-[#0b1c30] hover:shadow-md transition-all disabled:opacity-50"
                    >
                      {renameMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold text-[#0b1c30] leading-tight truncate">{user.full_name}</p>
                  <button
                    onClick={() => { setNameDraft(user.full_name); setEditingName(true) }}
                    aria-label="Modifier le nom"
                    className="text-[#6f787e] hover:text-[#82d8ff] transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <RoleBadge role={user.role} />
                <AccountStatusBadge status={user.account_status} />
              </div>
            </div>
          </div>

          {/* Contact info (admin only) */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5eeff' }}>
            <div className="px-4 py-2 bg-[#e5eeff]">
              <p className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-widest">Informations de contact</p>
            </div>
            {[
              { label: 'E-mail', value: user.email ?? '—', icon: 'mail', copyable: true },
              { label: 'Téléphone', value: user.phone ?? '—', icon: 'phone', copyable: true },
              { label: 'Pays', value: user.country ?? '—', icon: 'location_on', copyable: false },
              { label: 'Inscrit le', value: new Date(user.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }), icon: 'calendar_today', copyable: false },
              { label: 'Onboarding', value: user.onboarding_completed ? 'Complété ✓' : 'En cours…', icon: 'checklist', copyable: false },
              { label: 'ID', value: user.id.slice(0, 12) + '…', icon: 'tag', copyable: false },
            ].map(({ label, value, icon, copyable }, idx, arr) => (
              <div key={label} className="flex items-center justify-between px-4 py-3 gap-2"
                style={{ borderBottom: idx < arr.length - 1 ? '1px solid #f0f4ff' : 'none', backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.60)' : '#f8f9ff' }}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-[#6f787e] flex-shrink-0" style={{ fontSize: '14px' }}>{icon}</span>
                  <span className="text-xs text-[#6f787e]">{label}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-medium text-[#0b1c30] max-w-[140px] truncate text-right">{value}</span>
                  {copyable && value !== '—' && (
                    <button onClick={() => navigator.clipboard.writeText(value)}
                      className="text-[#6f787e] hover:text-[#82d8ff] transition-colors" title="Copier">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>content_copy</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Prefix selector */}
          <PrefixSection user={user} />

          {/* Suspend / Unsuspend */}
          {user.role !== 'admin' && (
            <div>
              <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-2">Actions compte</p>
              {isSuspended || !showSuspendForm ? (
                <button
                  onClick={() => isSuspended ? suspendMutation.mutate(undefined) : setShowSuspendForm(true)}
                  disabled={suspendMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                  style={
                    isSuspended
                      ? { backgroundColor: '#e8f5e9', color: '#1d7a3a' }
                      : { backgroundColor: '#ffdad6', color: '#ba1a1a' }
                  }
                >
                  <span className="material-symbols-outlined text-base">
                    {isSuspended ? 'lock_open' : 'lock'}
                  </span>
                  {suspendMutation.isPending
                    ? 'Mise à jour…'
                    : isSuspended
                    ? 'Réactiver le compte'
                    : 'Suspendre le compte'}
                </button>
              ) : (
                <div className="space-y-2 p-3 rounded-xl bg-[#ffdad6]/40 border border-[#ba1a1a]/20">
                  <label className="text-xs font-semibold text-[#930009] uppercase tracking-wide">Motif de suspension (obligatoire)</label>
                  <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={2}
                    placeholder="Ce motif sera envoyé par email/WhatsApp à l'utilisateur"
                    className="w-full px-3 py-2 border border-[#ba1a1a]/30 rounded-lg text-sm text-[#0b1c30] outline-none focus:border-[#ba1a1a] resize-none" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowSuspendForm(false)} className="flex-1 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500">
                      Annuler
                    </button>
                    <button
                      onClick={() => suspendMutation.mutate(suspendReason.trim())}
                      disabled={suspendMutation.isPending || !suspendReason.trim()}
                      className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#ba1a1a' }}>
                      Suspendre
                    </button>
                  </div>
                </div>
              )}
              {suspendMutation.isError && (
                <p className="text-xs text-[#ba1a1a] mt-1.5">
                  Erreur : {(suspendMutation.error as Error).message}
                </p>
              )}

              {/* Delete account */}
              <div className="mt-3">
                {!showDeleteForm ? (
                  <button
                    onClick={() => setShowDeleteForm(true)}
                    disabled={deleteMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold border-2 border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/30 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    Supprimer le compte
                  </button>
                ) : (
                  <div className="space-y-2 p-3 rounded-xl bg-[#ffdad6]/40 border border-[#ba1a1a]/20">
                    <p className="text-xs font-semibold text-[#930009]">
                      Le compte sera immédiatement bloqué et les données effacées sous 30 jours (RGPD). Cette action est irréversible.
                    </p>
                    <label className="text-xs font-semibold text-[#930009] uppercase tracking-wide">Motif (obligatoire)</label>
                    <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={2}
                      placeholder="Ce motif sera envoyé par email/WhatsApp à l'utilisateur"
                      className="w-full px-3 py-2 border border-[#ba1a1a]/30 rounded-lg text-sm text-[#0b1c30] outline-none focus:border-[#ba1a1a] resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowDeleteForm(false); setDeleteReason('') }} className="flex-1 py-2 rounded-lg text-xs font-semibold border border-slate-200 text-slate-500">
                        Annuler
                      </button>
                      <button
                        onClick={() => { if (confirm(`Confirmer la suppression définitive du compte de ${user.full_name} ?`)) deleteMutation.mutate(deleteReason.trim()) }}
                        disabled={deleteMutation.isPending || !deleteReason.trim()}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50" style={{ backgroundColor: '#ba1a1a' }}>
                        {deleteMutation.isPending ? 'Suppression…' : 'Supprimer définitivement'}
                      </button>
                    </div>
                  </div>
                )}
                {deleteMutation.isError && (
                  <p className="text-xs text-[#ba1a1a] mt-1.5">
                    Erreur : {(deleteMutation.error as Error).message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Practitioner verification section */}
          {user.role === 'practitioner' && (
            <div
              className="rounded-xl p-4 space-y-4"
              style={{
                backgroundColor: 'rgba(255,255,255,0.70)',
                border: '1px solid rgba(255,255,255,0.80)',
              }}
            >
              <PractitionerSection userId={user.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersPageInner />
    </Suspense>
  )
}

function UsersPageInner() {
  const searchParams = useSearchParams()
  // QA finding (section 21.2) : arriver ici via le lien "Patients" de la barre
  // latérale affichait quand même les onglets Praticiens/Admins — redondant
  // avec leurs propres pages dédiées (/admin/practitioners, /admin/collaborators)
  // et source de confusion. Un rôle précisé dans l'URL verrouille la vue sur
  // ce rôle sans proposer de bascule ; seule "Vue d'ensemble" (sans paramètre)
  // garde les onglets, qui ont un sens pour une vue combinée.
  const lockedRole = (() => {
    const fromUrl = searchParams.get('role') as Role | null
    return fromUrl && ['patient', 'practitioner', 'admin'].includes(fromUrl) ? fromUrl : null
  })()
  const [role, setRole] = useState<Role>(lockedRole ?? 'all')
  // "Vue d'ensemble" et "Patients" pointent vers la même route
  // (/admin/users vs /admin/users?role=patient) — Next.js ne remonte donc
  // pas le composant en cliquant de l'un à l'autre, seul le paramètre d'URL
  // change. Sans cet effet, `role` restait figé sur sa valeur initiale : le
  // titre/les onglets suivaient bien l'URL mais la liste affichée non,
  // donnant l'impression que les deux écrans étaient mélangés.
  useEffect(() => {
    setRole(lockedRole ?? 'all')
  }, [lockedRole])
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleSearch = (value: string) => {
    setSearch(value)
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => { setDebouncedSearch(value); setPage(0) }, 300)
  }

  const { data, isLoading } = useUsers(role, debouncedSearch, page)
  const { data: suspendedCount } = useSuspendedCount()
  const totalPages = Math.ceil((data?.total ?? 0) / PAGE_SIZE)

  const filters: { label: string; value: Role }[] = [
    { label: 'Tous', value: 'all' },
    { label: 'Patients', value: 'patient' },
    { label: 'Praticiens', value: 'practitioner' },
    { label: 'Admins', value: 'admin' },
  ]

  const pageTitle = lockedRole ? (filters.find(f => f.value === lockedRole)?.label ?? 'Utilisateurs') : 'Utilisateurs'

  return (
    <div className="space-y-6" style={{ fontFamily: 'Manrope' }}>
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#0b1c30]">{pageTitle}</h1>
            {(suspendedCount ?? 0) > 0 && (
              <span
                className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}
                title="Comptes suspendus"
              >
                <span className="material-symbols-outlined text-xs">lock</span>
                {suspendedCount} suspendu{(suspendedCount ?? 0) > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-[#6f787e] mt-1">{data?.total ?? 0} utilisateurs au total</p>
        </div>
        <Link
          href="/admin/collaborators"
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          <span className="hidden sm:inline">Inviter un admin</span>
          <span className="sm:hidden">Inviter</span>
        </Link>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {!lockedRole && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => { setRole(f.value); setPage(0) }}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={
                  role === f.value
                    ? { backgroundColor: '#82d8ff', color: '#ffffff' }
                    : { backgroundColor: 'rgba(255,255,255,0.60)', color: '#3f484d', border: '1px solid rgba(203,216,254,0.50)' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher par nom…"
          className="w-full sm:w-64 px-4 py-2 rounded-full text-sm outline-none transition-colors"
          style={{
            backgroundColor: 'rgba(255,255,255,0.60)',
            border: '1px solid rgba(203,216,254,0.50)',
            color: '#0b1c30',
          }}
        />
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden overflow-x-auto"
        style={{
          backgroundColor: 'rgba(255,255,255,0.60)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.80)',
          boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100/60">
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Utilisateur</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Rôle</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Pays</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Téléphone</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Onboarding</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Statut</th>
              <th className="text-left px-6 py-4 text-xs font-bold text-[#82d8ff] uppercase tracking-widest">Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50/60">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 bg-slate-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : (data?.users ?? []).map((user) => (
              <tr
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="border-b border-slate-50/60 hover:bg-white/40 cursor-pointer transition-colors"
                style={selectedUser?.id === user.id ? { backgroundColor: 'rgba(0,102,133,0.04)' } : undefined}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        backgroundColor: roleColors[user.role]?.bg ?? '#e5eeff',
                        color: roleColors[user.role]?.text ?? '#82d8ff',
                      }}
                    >
                      {initials(user.full_name)}
                    </div>
                    <span className="text-sm font-medium text-[#0b1c30]">{user.full_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4"><RoleBadge role={user.role} /></td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{user.country ?? '—'}</td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">{user.phone ?? '—'}</td>
                <td className="px-6 py-4">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={
                      user.onboarding_completed
                        ? { backgroundColor: '#e8f5e9', color: '#1d7a3a' }
                        : { backgroundColor: '#fff8e1', color: '#705d00' }
                    }
                  >
                    {user.onboarding_completed ? 'Complété' : 'En cours'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <AccountStatusBadge status={user.account_status} />
                </td>
                <td className="px-6 py-4 text-sm text-[#6f787e]">
                  {new Date(user.created_at).toLocaleDateString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100/60">
          <p className="text-sm text-[#6f787e]">
            {(data?.total ?? 0) === 0
              ? 'Aucun résultat'
              : `Affichage ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, data!.total)} sur ${data!.total}`}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              ←
            </button>
            <span className="px-3 py-1.5 text-sm text-[#0b1c30]">{page + 1} / {totalPages || 1}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-200/50 disabled:opacity-40 hover:bg-white transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Profile slide-out panel */}
      {selectedUser && (
        <UserProfilePanel
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}
