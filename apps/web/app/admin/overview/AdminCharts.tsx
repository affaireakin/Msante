'use client'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useAdminCharts } from './useAdminCharts'

const COLORS = ['#006685', '#ffde5c', '#82d8ff', '#ba1a1a', '#1d7a3a']
const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé',
  cancelled: 'Annulé', no_show: 'No-show',
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <h3 className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-6">{title}</h3>
      {children}
    </div>
  )
}

export function AdminCharts() {
  const { data, isLoading } = useAdminCharts()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl h-64 animate-pulse bg-white/40" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Revenus 7j */}
      <ChartCard title="Revenus 7 derniers jours (XOF)">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data?.revenue7d ?? []}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#006685" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#006685" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6f787e' }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} />
            <Tooltip formatter={(v: number) => [`${v.toLocaleString()} XOF`, 'Revenus']} />
            <Area type="monotone" dataKey="revenue" stroke="#006685" strokeWidth={2} fill="url(#revenueGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Nouveaux utilisateurs 7j */}
      <ChartCard title="Nouveaux utilisateurs 7j">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data?.users7d ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6f787e' }} tickFormatter={(v: string) => v.slice(5)} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" name="Nouveaux" stroke="#ffde5c" strokeWidth={2} dot={{ fill: '#ffde5c' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* RDV par statut */}
      <ChartCard title="Rendez-vous par statut">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={(data?.appointmentsByStatus ?? []).map((d) => ({ ...d, label: STATUS_LABELS[d.status] ?? d.status }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(190,200,206,0.3)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#6f787e' }} />
            <YAxis tick={{ fontSize: 11, fill: '#6f787e' }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="RDV" fill="#006685" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Providers paiement */}
      <ChartCard title="Paiements par provider">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data?.paymentsByProvider ?? []}
              dataKey="count"
              nameKey="provider"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ provider, percent }: { provider: string; percent: number }) =>
                `${provider} ${(percent * 100).toFixed(0)}%`
              }
            >
              {(data?.paymentsByProvider ?? []).map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
