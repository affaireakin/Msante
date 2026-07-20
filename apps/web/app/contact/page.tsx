import type { Metadata } from 'next'
import ContactClient from './ContactClient'

export const metadata: Metadata = {
  title: 'Nous contacter | M-Santé',
  description: 'Contactez l\'équipe M-Santé par téléphone, WhatsApp ou email pour toute question sur la plateforme.',
}

export default function ContactPage() {
  return <ContactClient />
}
