'use client'
import Link from 'next/link'
import { useAdminUrgentItems } from './useAdminUrgentItems'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

interface UrgentCard {
  key: string
  label: string
  count: number
  href: string
  icon: string
  urgent: boolean
}

export function UrgentItemsPanel() {
  const { data, isLoading } = useAdminUrgentItems()

  const cards: UrgentCard[] = data ? [
    { key: 'suspended', label: 'Comptes suspendus', count: data.suspendedUsers, href: '/admin/users', icon: 'block', urgent: data.suspendedUsers > 0 },
    { key: 'urgent-disputes', label: 'Litiges urgents', count: data.urgentDisputes, href: '/admin/tickets', icon: 'gavel', urgent: data.urgentDisputes > 0 },
    { key: 'appeals', label: 'Appels à traiter', count: data.pendingAppeals, href: '/admin/appeals', icon: 'campaign', urgent: data.pendingAppeals > 0 },
    { key: 'disputes', label: 'Litiges ouverts', count: data.openDisputes, href: '/admin/tickets', icon: 'balance', urgent: false },
    { key: 'practitioners', label: 'Praticiens à valider', count: data.pendingPractitioners, href: '/admin/practitioners', icon: 'medical_services', urgent: false },
    { key: 'organizations', label: 'Organisations à valider', count: data.pendingOrganizations, href: '/admin/organizations', icon: 'storefront', urgent: false },
    { key: 'collaborators', label: 'Collaborateurs à valider', count: data.pendingCollaborators, href: '/admin/collaborators', icon: 'group_add', urgent: false },
    { key: 'no-show', label: 'RDV manqués (7j)', count: data.recentNoShows, href: '/admin/analytics', icon: 'event_busy', urgent: false },
    { key: 'tickets', label: 'Incidents ouverts', count: data.openTickets, href: '/admin/tickets', icon: 'confirmation_number', urgent: false },
  ] : []

  const totalUrgent = cards.reduce((sum, c) => sum + c.count, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30]">Actions urgentes</h2>
          <p className="text-sm text-[#6f787e] mt-0.5">Ce qui nécessite votre intervention en priorité</p>
        </div>
        {!isLoading && totalUrgent === 0 && (
          <span className="flex items-center gap-1.5 text-sm font-semibold text-[#1d7a3a]">
            <Icon name="check_circle" style={{ fontSize: '18px' }} />
            Tout est à jour
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {cards.map(card => (
            <Link key={card.key} href={card.href}
              className="rounded-2xl p-4 transition-all hover:shadow-lg hover:-translate-y-0.5"
              style={{
                backgroundColor: card.count > 0 && card.urgent ? 'rgba(186,26,26,0.06)' : 'rgba(255,255,255,0.70)',
                border: card.count > 0 && card.urgent ? '1px solid rgba(186,26,26,0.25)' : '1px solid rgba(255,255,255,0.80)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <Icon name={card.icon} style={{ fontSize: '20px', color: card.count > 0 && card.urgent ? '#ba1a1a' : '#82d8ff' }} />
                <span className="text-2xl font-black" style={{ color: card.count > 0 && card.urgent ? '#ba1a1a' : '#0b1c30' }}>
                  {card.count}
                </span>
              </div>
              <p className="text-xs font-semibold text-[#6f787e] leading-tight">{card.label}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
