import type { Metadata } from 'next'
import FaqClient from './FaqClient'

export const metadata: Metadata = {
  title: 'Questions fréquentes | M-Santé',
  description: 'Toutes les réponses à vos questions sur la réservation, le paiement, la téléconsultation et le bien-être sur M-Santé.',
}

export default function FaqPage() {
  return <FaqClient />
}
