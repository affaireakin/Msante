import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import type { ProcessPaymentRequest, ProcessPaymentResponse } from '@/types/booking'

export function usePayment() {
  return useMutation({
    mutationFn: async (data: ProcessPaymentRequest): Promise<ProcessPaymentResponse> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/process-payment`,
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
      if (!response.ok) throw new Error(result.error ?? 'Payment failed')
      return result
    },
  })
}
