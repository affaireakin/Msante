'use client'
import { UrgentItemsPanel } from './UrgentItemsPanel'

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#0b1c30]">Tableau de bord</h1>
        <p className="text-sm text-[#6f787e] mt-1">Ce qui nécessite votre attention aujourd&apos;hui</p>
      </div>

      <UrgentItemsPanel />
    </div>
  )
}
