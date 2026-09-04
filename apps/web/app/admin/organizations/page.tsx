'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getSignedDocumentUrl } from '@/lib/signedDocumentUrl'

type OrgStatus = 'pending' | 'active' | 'suspended' | 'rejected' | 'archived' | 'deleted'

interface Organization {
  id: string
  name: string
  email: string
  phone: string | null
  city: string | null
  siret: string | null
  status: OrgStatus
  created_at: string
  users: { full_name: string; email: string | null } | null
  organization_documents: { id: string; document_type: string; file_url: string }[]
}

const STATUS_ORDER: OrgStatus[] = ['pending', 'active', 'suspended', 'rejected', 'archived', 'deleted']
const STATUS_LABELS: Record<OrgStatus, string> = {
  pending: 'En attente',
  active: 'Active',
  suspended: 'Suspendue',
  rejected: 'Rejetée',
  archived: 'Archivée',
  deleted: 'Supprimée',
}
const STATUS_COLORS: Record<OrgStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-orange-100 text-orange-700',
  rejected: 'bg-red-100 text-red-700',
  archived: 'bg-slate-100 text-slate-500',
  deleted: 'bg-red-100 text-red-800',
}

const STATUS_FILTERS = [
  { value: 'all', label: 'Toutes' },
  { value: 'pending', label: 'En attente' },
  { value: 'active', label: 'Actives' },
  { value: 'suspended', label: 'Suspendues' },
  { value: 'rejected', label: 'Rejetées' },
  { value: 'archived', label: 'Archivées' },
  { value: 'deleted', label: 'Supprimées' },
] as const

function useOrganizations() {
  return useQuery({
    queryKey: ['admin-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, email, phone, city, siret, status, created_at, users!created_by(full_name, email), organization_documents(id, document_type, file_url)')
        .order('created_at', { ascending: false })
      if (error) throw error
      const sorted = (data ?? []) as unknown as Organization[]
      sorted.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
      return sorted
    },
    staleTime: 30_000,
  })
}

export default function OrganizationsPage() {
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const { data: organizations, isLoading, error: queryError } = useOrganizations()

  const [rejectDialog, setRejectDialog] = useState<{ orgId: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [infoDialog, setInfoDialog] = useState<{ orgId: string } | null>(null)
  const [infoNote, setInfoNote] = useState('')
  const [statusDialog, setStatusDialog] = useState<{ orgId: string; action: 'suspend' | 'reactivate' | 'archive' | 'delete' } | null>(null)
  const [statusReason, setStatusReason] = useState('')

  const validate = useMutation({
    mutationFn: async (body: { organization_id: string; action: 'approve' | 'reject' | 'request_info'; note?: string }) => {
      const { error } = await supabase.functions.invoke('validate-organization', { body })
      if (error) {
        // .invoke() throws a generic "non-2xx status code" FunctionsHttpError
        // whose .message hides the function's real { error: "..." } JSON body
        // (e.g. the "aucun document soumis" guard) — read the actual response
        // so the admin sees why, instead of a meaningless generic message.
        const context = (error as { context?: Response }).context
        let parsedMessage: string | undefined
        if (context) {
          try {
            const responseBody = await context.json() as { error?: string }
            parsedMessage = responseBody?.error
          } catch {
            // response wasn't JSON — fall through to the generic error below
          }
        }
        throw parsedMessage ? new Error(parsedMessage) : error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] })
      setRejectDialog(null); setRejectReason('')
      setInfoDialog(null); setInfoNote('')
    },
  })

  const changeStatus = useMutation({
    mutationFn: async (body: { organization_id: string; action: 'suspend' | 'reactivate' | 'archive' | 'delete'; reason: string }) => {
      const { error } = await supabase.functions.invoke('suspend-organization', { body })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-organizations'] })
      setStatusDialog(null); setStatusReason('')
    },
  })

  const handleApprove = (orgId: string) => validate.mutate({ organization_id: orgId, action: 'approve' })
  const handleReject = () => {
    if (!rejectDialog || !rejectReason.trim()) return
    validate.mutate({ organization_id: rejectDialog.orgId, action: 'reject', note: rejectReason })
  }
  const handleRequestInfo = () => {
    if (!infoDialog || !infoNote.trim()) return
    validate.mutate({ organization_id: infoDialog.orgId, action: 'request_info', note: infoNote })
  }
  const handleStatusChange = () => {
    if (!statusDialog || !statusReason.trim()) return
    changeStatus.mutate({ organization_id: statusDialog.orgId, action: statusDialog.action, reason: statusReason })
  }

  const filtered = (organizations ?? []).filter(o => statusFilter === 'all' || o.status === statusFilter)
  const pendingCount = (organizations ?? []).filter(o => o.status === 'pending').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#0b1c30]">Organisations</h1>
          <p className="text-sm text-[#6f787e] mt-1">Cabinets, cliniques et centres médicaux — validation et supervision</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-sm font-bold text-amber-700">{pendingCount} en attente de validation</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => {
          const count = f.value === 'all'
            ? (organizations ?? []).length
            : (organizations ?? []).filter(o => o.status === f.value).length
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border"
              style={{
                backgroundColor: statusFilter === f.value ? '#82d8ff' : 'rgba(255,255,255,0.70)',
                color: statusFilter === f.value ? '#0b1c30' : '#475569',
                borderColor: statusFilter === f.value ? '#82d8ff' : 'rgba(190,200,206,0.40)',
              }}>
              {f.label}
              <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: statusFilter === f.value ? 'rgba(11,28,48,0.15)' : '#e5eeff', color: statusFilter === f.value ? '#0b1c30' : '#005e7a' }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {validate.error && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          {(validate.error as Error).message}
        </div>
      )}

      {queryError && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Erreur de chargement : {(queryError as Error).message}
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
          {filtered.map((org) => (
            <div key={org.id} className="rounded-2xl p-6"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)', boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)' }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-bold text-lg flex-shrink-0">
                    {org.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div>
                    <Link href={`/admin/organizations/${org.id}`} className="font-semibold text-[#0b1c30] hover:text-[#82d8ff] transition-colors hover:underline">
                      {org.name}
                    </Link>
                    <p className="text-sm text-[#6f787e]">{org.city ?? '—'} · {org.email}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5">
                      Demandé par {org.users?.full_name ?? '—'} le {new Date(org.created_at).toLocaleDateString('fr-FR')}
                      {org.siret && ` · SIRET ${org.siret}`}
                    </p>
                    {org.organization_documents.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {org.organization_documents.map(doc => (
                          <button
                            key={doc.id}
                            type="button"
                            onClick={async () => {
                              const url = await getSignedDocumentUrl(doc.file_url)
                              if (url) window.open(url, '_blank', 'noopener,noreferrer')
                            }}
                            className="text-xs font-bold text-[#005e7a] bg-[#e5eeff] px-2 py-0.5 rounded-full hover:bg-[#d3e4fe] transition-colors">
                            {doc.document_type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[org.status]}`}>
                    {STATUS_LABELS[org.status]}
                  </span>

                  {org.status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(org.id)} disabled={validate.isPending || org.organization_documents.length === 0}
                        title={org.organization_documents.length === 0 ? 'Aucun document soumis — impossible à valider' : undefined}
                        className="px-4 py-2 bg-emerald-500 text-white text-sm font-semibold rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        Valider
                      </button>
                      <button onClick={() => setInfoDialog({ orgId: org.id })}
                        className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full hover:bg-blue-200 transition-colors">
                        Demander des infos
                      </button>
                      <button onClick={() => setRejectDialog({ orgId: org.id })}
                        className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-full hover:bg-red-200 transition-colors">
                        Refuser
                      </button>
                    </>
                  )}

                  {org.status === 'active' && (
                    <button onClick={() => { setStatusDialog({ orgId: org.id, action: 'suspend' }); setStatusReason('') }}
                      className="px-4 py-2 bg-orange-100 text-orange-700 text-sm font-semibold rounded-full hover:bg-orange-200 transition-colors">
                      Suspendre
                    </button>
                  )}

                  {org.status === 'suspended' && (
                    <>
                      <button onClick={() => { setStatusDialog({ orgId: org.id, action: 'reactivate' }); setStatusReason('Réactivation après vérification') }}
                        className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-semibold rounded-full hover:bg-emerald-200 transition-colors">
                        Réactiver
                      </button>
                      <button onClick={() => { setStatusDialog({ orgId: org.id, action: 'archive' }); setStatusReason('') }}
                        className="px-4 py-2 bg-slate-100 text-slate-600 text-sm font-semibold rounded-full hover:bg-slate-200 transition-colors">
                        Archiver
                      </button>
                    </>
                  )}

                  {org.status !== 'deleted' && (
                    <button onClick={() => { setStatusDialog({ orgId: org.id, action: 'delete' }); setStatusReason('') }}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-full hover:bg-red-700 transition-colors">
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-[#6f787e]">
              <p className="text-lg font-medium">
                {statusFilter === 'all' ? 'Aucune organisation enregistrée' : `Aucune organisation avec le statut « ${STATUS_FILTERS.find(f => f.value === statusFilter)?.label ?? statusFilter} »`}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reject dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Motif de refus</h3>
            <p className="text-sm text-[#6f787e] mb-4">Envoyé par email au demandeur.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex : documents insuffisants, informations incohérentes..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRejectDialog(null)} className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleReject} disabled={!rejectReason.trim() || validate.isPending}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-full text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request info dialog */}
      {infoDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setInfoDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-4">Informations complémentaires</h3>
            <p className="text-sm text-[#6f787e] mb-4">Envoyé par email et notification au demandeur. Le statut reste « En attente ».</p>
            <textarea value={infoNote} onChange={(e) => setInfoNote(e.target.value)}
              placeholder="Ex : merci de fournir un extrait SIRET valide..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setInfoDialog(null)} className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50">
                Annuler
              </button>
              <button onClick={handleRequestInfo} disabled={!infoNote.trim() || validate.isPending}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change dialog (suspend / reactivate / archive) */}
      {statusDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setStatusDialog(null)} />
          <div className="relative bg-white rounded-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl mx-4">
            <h3 className="text-lg font-bold text-[#0b1c30] mb-2">
              {statusDialog.action === 'suspend' ? 'Suspendre l\'organisation'
                : statusDialog.action === 'archive' ? 'Archiver l\'organisation'
                : statusDialog.action === 'delete' ? 'Supprimer l\'organisation'
                : 'Réactiver l\'organisation'}
            </h3>
            <p className="text-sm text-[#6f787e] mb-4">
              {statusDialog.action === 'suspend'
                ? 'Les administrateurs et praticiens de cette organisation ne pourront plus se connecter, prendre de rendez-vous ni envoyer de messages. Les données sont conservées.'
                : statusDialog.action === 'delete'
                ? 'Le compte du créateur de l\'organisation sera immédiatement bloqué et les données effacées sous 30 jours (RGPD). Cette action est irréversible.'
                : 'Ce motif sera envoyé aux membres de l\'organisation par notification.'}
            </p>
            <textarea value={statusReason} onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Motif obligatoire..."
              className="w-full h-28 px-4 py-3 border border-slate-200 rounded-xl text-sm text-[#0b1c30] outline-none focus:border-[#82d8ff] resize-none" />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStatusDialog(null)} className="flex-1 py-2.5 border border-slate-200 rounded-full text-sm font-medium text-[#6f787e] hover:bg-slate-50">
                Annuler
              </button>
              <button
                onClick={() => {
                  if (statusDialog.action === 'delete' && !confirm('Confirmer la suppression définitive de cette organisation ?')) return
                  handleStatusChange()
                }}
                disabled={!statusReason.trim() || changeStatus.isPending}
                className={`flex-1 py-2.5 text-white rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
                  statusDialog.action === 'reactivate' ? 'bg-emerald-500 hover:bg-emerald-600' :
                  statusDialog.action === 'suspend' ? 'bg-orange-500 hover:bg-orange-600' :
                  statusDialog.action === 'delete' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-slate-500 hover:bg-slate-600'
                }`}>
                {changeStatus.isPending ? 'Traitement...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
