'use client'
import InternalMessaging from '@/app/admin/messages/InternalMessaging'

export default function OrganizationMessagesPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30]">Messages</h1>
        <p className="text-sm text-[#6f787e] mt-1">Échangez avec l&apos;équipe M-Santé et vos collaborateurs</p>
      </div>
      <InternalMessaging />
    </div>
  )
}
