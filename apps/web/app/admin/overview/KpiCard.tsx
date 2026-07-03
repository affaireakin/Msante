interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  subtitle?: string
  trend?: string
  trendUp?: boolean
}

export function KpiCard({ title, value, icon, subtitle, trend, trendUp }: KpiCardProps) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#82d8ff] uppercase tracking-widest">{title}</span>
        <span className="text-[#82d8ff]">{icon}</span>
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0b1c30]">{value}</p>
        {subtitle && <p className="text-sm text-[#6f787e] mt-1">{subtitle}</p>}
      </div>
      {trend && (
        <span
          className={`text-xs font-semibold px-2 py-1 rounded-full w-fit ${
            trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}
        >
          {trend}
        </span>
      )}
    </div>
  )
}
