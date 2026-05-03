interface StatusBadgeProps {
  isActive: boolean
  lastRunStatus?: string | null
}

export function StatusBadge({ isActive, lastRunStatus }: StatusBadgeProps) {
  if (lastRunStatus === 'running') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        En cours
      </span>
    )
  }
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Actif
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Inactif
    </span>
  )
}
