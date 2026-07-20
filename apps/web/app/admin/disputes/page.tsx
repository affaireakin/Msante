import { redirect } from 'next/navigation'

// Litiges are now handled inside the unified "Gestion des incidents" board
// (apps/web/app/admin/tickets/) alongside tickets — this route stays as a
// redirect so any existing bookmark/link keeps working.
export default function AdminDisputesPage() {
  redirect('/admin/tickets')
}
