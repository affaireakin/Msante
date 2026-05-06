import { supabase } from '@/services/supabase'

export async function approveAppointment(appointmentId: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', appointmentId)
  if (error) throw error

  await supabase.from('notifications').insert({
    user_id: patientId,
    type: 'appointment_confirm',
    title: 'Rendez-vous confirmé',
    body: 'Votre rendez-vous a été confirmé par le praticien.',
    channel: 'push',
  })
}

export async function declineAppointment(appointmentId: string, patientId: string): Promise<void> {
  const { error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId)
  if (error) throw error

  await supabase.from('notifications').insert({
    user_id: patientId,
    type: 'appointment_cancelled',
    title: 'Rendez-vous annulé',
    body: 'Votre rendez-vous a été décliné par le praticien.',
    channel: 'push',
  })
}
