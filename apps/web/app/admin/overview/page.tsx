'use client'
import { useAdminKpis } from './useAdminKpis'
import { KpiCard } from './KpiCard'
import { AdminCharts } from './AdminCharts'

function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  )
}

function RevenueIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  )
}

export default function OverviewPage() {
  const { data: kpis, isLoading } = useAdminKpis()

  const formatXOF = (amount: number) =>
    new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Vue d&apos;ensemble</h1>
        <p className="text-sm text-[#6f787e] mt-1">Données en temps réel</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <KpiCard
          title="Utilisateurs actifs (30j)"
          value={isLoading ? '…' : (kpis?.activeUsers30d ?? 0)}
          icon={<UsersIcon />}
          subtitle="Derniers 30 jours"
        />
        <KpiCard
          title="Revenus du mois"
          value={isLoading ? '…' : formatXOF(kpis?.revenueThisMonth ?? 0)}
          icon={<RevenueIcon />}
          subtitle="Paiements complétés"
        />
        <KpiCard
          title="Praticiens en attente"
          value={isLoading ? '…' : (kpis?.pendingPractitioners ?? 0)}
          icon={<ClockIcon />}
          subtitle="Validation requise"
          trend={kpis && kpis.pendingPractitioners > 0 ? `${kpis.pendingPractitioners} en attente` : undefined}
          trendUp={false}
        />
        <KpiCard
          title="Taux de no-show"
          value={isLoading ? '…' : `${kpis?.noShowRate ?? 0}%`}
          icon={<CalendarIcon />}
          subtitle="Rendez-vous manqués"
        />
      </div>

      {/* Charts */}
      <AdminCharts />
    </div>
  )
}
