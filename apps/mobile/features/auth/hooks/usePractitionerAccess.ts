import { useAuthStore } from '../store/authStore'

export function usePractitionerAccess() {
  const { practitioner } = useAuthStore()
  const status = practitioner?.verification_status ?? 'pending'

  return {
    canAcceptPayments: status === 'approved',
    canStartConsultation: status === 'approved',
    isPending: status === 'pending' || status === 'under_review',
    isApproved: status === 'approved',
    isRejected: status === 'rejected',
    status,
  }
}
