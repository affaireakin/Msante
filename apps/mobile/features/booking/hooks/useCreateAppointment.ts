import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { CreateAppointmentRequest, CreateAppointmentResponse } from '@/types/booking'

export function useCreateAppointment() {
  return useMutation({
    mutationFn: async (data: CreateAppointmentRequest): Promise<CreateAppointmentResponse> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-appointment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(data),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Failed to create appointment')
      return result
    },
  })
}
