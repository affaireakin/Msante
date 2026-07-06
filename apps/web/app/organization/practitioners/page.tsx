'use client'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'

interface OrgPractitioner {
  id: string
  speciality: string
  verification_status: VerifStatus
  account_status: string | null
  created_at: string
  users: { full_name: string } | null
}

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

function useOrgPractitioners() {
  return useQuery<OrgPractitioner[]>({
    queryKey: ['org-practitioners'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile?.organization_id) return []

      const { data, error } = await supabase
        .from('practitioners')
        .select('id, speciality, verification_status, account_status, created_at, users!user_id(full_name)')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrgPractitioner[]
    },
    staleTime: 30_000,
  })
}

export default function OrganizationPractitionersPage() {
  const { data: practitioners, isLoading, error } = useOrgPractitioners()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Praticiens</h1>
        <p className="text-sm text-[#6f787e] mt-1">Membres de votre organisation</p>
      </div>

      {error && (
        <div className="rounded-2xl px-5 py-4 bg-red-50 border border-red-100 text-sm text-red-700">
          Erreur de chargement : {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl h-24 animate-pulse bg-white/40" />)}
        </div>
      ) : (practitioners ?? []).length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.80)' }}>
          <Icon name="group" style={{ fontSize: '48px', color: '#bec8ce' }} />
          <p className="font-semibold text-[#0b1c30] mt-3">Aucun praticien pour le moment</p>
          <p className="text-sm text-[#6f787e] mt-1">L&apos;invitation de praticiens sera bientôt disponible depuis cet écran.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(practitioners ?? []).map(p => (
            <div key={p.id} className="rounded-2xl p-5 flex items-center gap-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.60)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.80)' }}>
              <div className="w-11 h-11 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] font-bold text-sm flex-shrink-0">
                {(p.users?.full_name ?? 'P').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#0b1c30] truncate">{p.users?.full_name ?? '—'}</p>
                <p className="text-sm text-[#6f787e] truncate">{p.speciality}</p>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[p.verification_status]}`}>
                {STATUS_LABELS[p.verification_status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
