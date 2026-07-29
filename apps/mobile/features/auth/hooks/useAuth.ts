import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const { user, profile, practitioner, pendingOrganization, isLoading, isAuthenticated } = useAuthStore()
  return { user, profile, practitioner, pendingOrganization, isLoading, isAuthenticated }
}
