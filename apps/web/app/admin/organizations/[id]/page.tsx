'use client'
import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSignedDocumentUrl } from '@/lib/signedDocumentUrl'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface OrgDetail {
  id: string
  name: string
  slug: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  siret: string | null
  logo_url: string | null
  status: string
  created_at: string
  validated_at: string | null
  creator: { full_name: string; email: string | null } | null
  validator: { full_name: string } | null
}

interface OrgAdmin { id: string; full_name: string; email: string | null; created_at: string }
interface OrgPractitioner {
  id: string; user_id: string; speciality: string; verification_status: string
  org_validated_at: string | null; users: { full_name: string } | null
}
interface OrgMember { id: string; full_name: string; email: string | null; role: string; created_at: string }
interface OrgDocument { id: string; document_type: string; file_url: string }
interface OrgRolePerm { id: string; name: string; description: string | null; memberCount: number }
interface AuditLogRow {
  id: string; action: string; created_at: string
  old_values: unknown; new_values: unknown
  actor: { full_name: string } | null
}

function useOrganizationDetail(orgId: string) {
  return useQuery({
    queryKey: ['admin-organization-detail', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const [
        { data: org, error: orgError },
        { data: admins },
        { data: practitioners },
        { data: members },
        { data: documents },
        { data: orgRoles },
        { data: userRoles },
        { data: history },
      ] = await Promise.all([
        supabase.from('organizations')
          .select('id, name, slug, email, phone, address, city, postal_code, country, siret, logo_url, status, created_at, validated_at, creator:users!created_by(full_name, email), validator:users!validated_by(full_name)')
          .eq('id', orgId).single(),
        supabase.from('users').select('id, full_name, email, created_at').eq('organization_id', orgId).eq('role', 'organization_admin'),
        supabase.from('practitioners').select('id, user_id, speciality, verification_status, org_validated_at, users!user_id(full_name)').eq('organization_id', orgId),
        supabase.from('users').select('id, full_name, email, role, created_at').eq('organization_id', orgId).in('role', ['organization_member', 'secretary']),
        supabase.from('organization_documents').select('id, document_type, file_url').eq('organization_id', orgId),
        supabase.from('org_roles').select('id, name, description').eq('organization_id', orgId),
        supabase.from('user_roles').select('role_id').eq('organization_id', orgId),
        supabase.from('audit_logs')
          .select('id, action, created_at, old_values, new_values, actor:users!actor_id(full_name)')
          .eq('resource_type', 'organization').eq('resource_id', orgId)
          .order('created_at', { ascending: false }).limit(20),
      ])
      if (orgError || !org) throw orgError ?? new Error('Organisation introuvable')

      const memberIds = [
        ...(admins ?? []).map(a => a.id),
        ...(members ?? []).map(m => m.id),
      ]
      const [{ count: appointmentsCount }, { data: payments }, { data: activityLog }] = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('payments').select('amount').eq('organization_id', orgId).eq('status', 'completed'),
        memberIds.length > 0
          ? supabase.from('audit_logs')
              .select('id, action, created_at, old_values, new_values, actor:users!actor_id(full_name)')
              .in('actor_id', memberIds)
              .order('created_at', { ascending: false }).limit(30)
          : Promise.resolve({ data: [] as AuditLogRow[] }),
      ])

      const roleCounts = new Map<string, number>()
      for (const ur of userRoles ?? []) roleCounts.set(ur.role_id, (roleCounts.get(ur.role_id) ?? 0) + 1)
      const permissions: OrgRolePerm[] = (orgRoles ?? []).map(r => ({
        id: r.id, name: r.name, description: r.description, memberCount: roleCounts.get(r.id) ?? 0,
      }))

      return {
        org: org as unknown as OrgDetail,
        admins: (admins ?? []) as OrgAdmin[],
        practitioners: (practitioners ?? []) as unknown as OrgPractitioner[],
        members: (members ?? []) as OrgMember[],
        documents: (documents ?? []) as OrgDocument[],
        permissions,
        history: (history ?? []) as unknown as AuditLogRow[],
        activityLog: (activityLog ?? []) as unknown as AuditLogRow[],
        stats: {
          practitionersCount: (practitioners ?? []).length,
          membersCount: (members ?? []).length,
          appointmentsCount: appointmentsCount ?? 0,
          revenue: (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0),
        },
      }
    },
  })
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', active: 'Active', suspended: 'Suspendue', rejected: 'Rejetée', archived: 'Archivée',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-orange-100 text-orange-700', rejected: 'bg-red-100 text-red-700', archived: 'bg-slate-100 text-slate-500',
}
const VERIF_LABELS: Record<string, string> = {
  pending: 'En attente', under_review: 'En revue', approved: 'Approuvé', rejected: 'Rejeté',
}
const ACTION_LABELS: Record<string, string> = {
  'organization.approve': 'Organisation validée',
  'organization.reject': 'Organisation refusée',
  'organization.request_info': 'Informations complémentaires demandées',
  'organization.suspend': 'Organisation suspendue',
  'organization.reactivate': 'Organisation réactivée',
  'organization.archive': 'Organisation archivée',
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
      <div className="flex items-center gap-2">
        <Icon name={icon} style={{ fontSize: '20px', color: '#82d8ff' }} />
        <h2 className="text-base font-bold text-[#0b1c30]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

function formatXOF(amount: number) {
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount)
}

function describeLogChange(row: AuditLogRow): string | null {
  const oldV = row.old_values as { status?: string; reason?: string; note?: string } | null
  const newV = row.new_values as { status?: string; reason?: string; note?: string } | null
  if (newV?.status && oldV?.status) return `${STATUS_LABELS[oldV.status] ?? oldV.status} → ${STATUS_LABELS[newV.status] ?? newV.status}`
  if (newV?.reason) return `Motif : ${newV.reason}`
  if (newV?.note) return `Note : ${newV.note}`
  return null
}

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading, isError, error } = useOrganizationDetail(params.id)

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse" />)}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
        Erreur de chargement : {(error as Error)?.message ?? 'Organisation introuvable'}
      </div>
    )
  }

  const { org, admins, practitioners, members, documents, permissions, history, activityLog, stats } = data

  return (
    <div className="space-y-6">
      <button onClick={() => router.push('/admin/organizations')} className="flex items-center gap-1.5 text-sm font-semibold text-[#6f787e] hover:text-[#0b1c30] transition-colors">
        <Icon name="arrow_back" style={{ fontSize: '18px' }} />
        Organisations
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-bold text-xl flex-shrink-0 overflow-hidden">
            {org.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
            ) : initials(org.name)}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0b1c30]">{org.name}</h1>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[org.status] ?? 'bg-slate-100 text-slate-600'}`}>
                {STATUS_LABELS[org.status] ?? org.status}
              </span>
            </div>
            <p className="text-sm text-[#6f787e] mt-0.5">{org.city ?? '—'} · {org.email}</p>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Praticiens', value: stats.practitionersCount, icon: 'medical_services' },
          { label: 'Collaborateurs', value: stats.membersCount, icon: 'group' },
          { label: 'Rendez-vous', value: stats.appointmentsCount, icon: 'event' },
          { label: 'Revenus (complétés)', value: formatXOF(stats.revenue), icon: 'payments' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
            <Icon name={k.icon} style={{ fontSize: '18px', color: '#82d8ff' }} />
            <p className="text-xl font-black text-[#0b1c30] mt-1">{k.value}</p>
            <p className="text-xs font-semibold text-[#6f787e]">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Informations générales */}
      <Section title="Informations générales" icon="storefront">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div><p className="text-xs text-[#6f787e]">Email</p><p className="text-[#0b1c30] font-medium">{org.email}</p></div>
          <div><p className="text-xs text-[#6f787e]">Téléphone</p><p className="text-[#0b1c30] font-medium">{org.phone ?? '—'}</p></div>
          <div><p className="text-xs text-[#6f787e]">Adresse</p><p className="text-[#0b1c30] font-medium">{org.address ?? '—'}{org.postal_code ? `, ${org.postal_code}` : ''} {org.city ?? ''}</p></div>
          <div><p className="text-xs text-[#6f787e]">Pays</p><p className="text-[#0b1c30] font-medium">{org.country ?? '—'}</p></div>
          <div><p className="text-xs text-[#6f787e]">SIRET</p><p className="text-[#0b1c30] font-medium">{org.siret ?? '—'}</p></div>
          <div><p className="text-xs text-[#6f787e]">Créée le</p><p className="text-[#0b1c30] font-medium">{new Date(org.created_at).toLocaleDateString('fr-FR')}</p></div>
          <div><p className="text-xs text-[#6f787e]">Demandée par</p><p className="text-[#0b1c30] font-medium">{org.creator?.full_name ?? '—'}</p></div>
          {org.validated_at && (
            <div><p className="text-xs text-[#6f787e]">Validée le</p><p className="text-[#0b1c30] font-medium">{new Date(org.validated_at).toLocaleDateString('fr-FR')} {org.validator?.full_name ? `par ${org.validator.full_name}` : ''}</p></div>
          )}
        </div>
      </Section>

      {/* Administrateur de l'organisation */}
      <Section title="Administrateur de l'organisation" icon="admin_panel_settings">
        {admins.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun administrateur rattaché.</p>
        ) : (
          <div className="space-y-2">
            {admins.map(a => (
              <div key={a.id} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#e5eeff] flex items-center justify-center text-xs font-bold text-[#005e7a]">{initials(a.full_name)}</div>
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">{a.full_name}</p>
                  <p className="text-xs text-[#6f787e]">{a.email ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Praticiens rattachés */}
      <Section title={`Praticiens rattachés (${practitioners.length})`} icon="medical_services">
        {practitioners.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun praticien rattaché.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {practitioners.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 flex-wrap">
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">{p.users?.full_name ?? '—'}</p>
                  <p className="text-xs text-[#6f787e]">{p.speciality}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                    M-Santé : {VERIF_LABELS[p.verification_status] ?? p.verification_status}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${p.org_validated_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    Organisation : {p.org_validated_at ? 'Validé' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Collaborateurs & secrétaires */}
      <Section title={`Collaborateurs & secrétaires (${members.length})`} icon="badge">
        {members.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun collaborateur rattaché.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#e5eeff] flex items-center justify-center text-xs font-bold text-[#005e7a]">{initials(m.full_name)}</div>
                  <div>
                    <p className="text-sm font-semibold text-[#0b1c30]">{m.full_name}</p>
                    <p className="text-xs text-[#6f787e]">{m.email ?? '—'}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {m.role === 'secretary' ? 'Secrétaire' : 'Collaborateur'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Permissions (rôles granulaires) */}
      <Section title="Rôles & permissions" icon="shield">
        {permissions.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun rôle personnalisé défini pour cette organisation.</p>
        ) : (
          <div className="space-y-2">
            {permissions.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0b1c30]">{p.name}</p>
                  {p.description && <p className="text-xs text-[#6f787e]">{p.description}</p>}
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#e5eeff] text-[#005e7a]">
                  {p.memberCount} membre{p.memberCount > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Documents */}
      <Section title={`Documents (${documents.length})`} icon="description">
        {documents.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun document fourni.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {documents.map(doc => (
              <button
                key={doc.id}
                type="button"
                onClick={async () => {
                  const url = await getSignedDocumentUrl(doc.file_url)
                  if (url) window.open(url, '_blank', 'noopener,noreferrer')
                }}
                className="text-xs font-bold text-[#005e7a] bg-[#e5eeff] px-3 py-1.5 rounded-full hover:bg-[#d3e4fe] transition-colors flex items-center gap-1.5">
                <Icon name="description" style={{ fontSize: '14px' }} />
                {doc.document_type}
              </button>
            ))}
          </div>
        )}
      </Section>

      {/* Historique (statut de l'organisation) */}
      <Section title="Historique" icon="history">
        {history.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucun évènement enregistré.</p>
        ) : (
          <div className="space-y-3 border-l-2 border-slate-100 pl-4">
            {history.map(h => (
              <div key={h.id}>
                <p className="text-sm font-semibold text-[#0b1c30]">{ACTION_LABELS[h.action] ?? h.action}</p>
                <p className="text-xs text-[#6f787e]">
                  {new Date(h.created_at).toLocaleString('fr-FR')}{h.actor?.full_name ? ` · ${h.actor.full_name}` : ''}
                </p>
                {describeLogChange(h) && <p className="text-xs text-[#3f484d] mt-0.5">{describeLogChange(h)}</p>}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Journal d'activité (actions des membres de l'organisation) */}
      <Section title="Journal d'activité" icon="receipt_long">
        {activityLog.length === 0 ? (
          <p className="text-sm text-[#6f787e]">Aucune activité enregistrée pour les membres de cette organisation.</p>
        ) : (
          <div className="space-y-3 border-l-2 border-slate-100 pl-4 max-h-96 overflow-y-auto">
            {activityLog.map(a => (
              <div key={a.id}>
                <p className="text-sm font-semibold text-[#0b1c30]">{a.action}</p>
                <p className="text-xs text-[#6f787e]">
                  {new Date(a.created_at).toLocaleString('fr-FR')}{a.actor?.full_name ? ` · ${a.actor.full_name}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
