'use client'
import { useRouter } from 'next/navigation'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

// Écran affiché une seule fois juste après l'acceptation d'une invitation
// secrétaire — même carte/ton que l'organisation (onboarding/organization
// step 3) plutôt qu'une redirection silencieuse vers /secretary, qui
// n'affiche l'attente de validation qu'en bannière permanente du dashboard.
export default function SecretaryOnboardingConfirmationPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#e5eeff] flex items-center justify-center mx-auto">
          <Icon name="check_circle" size={32} color="#82d8ff" />
        </div>
        <h2 className="text-xl font-black text-[#0b1c30]">Demande envoyée !</h2>
        <p className="text-sm text-[#6f787e]">
          Votre compte secrétaire a été créé et transmis pour validation.
          Vous recevrez une notification dès qu&apos;il sera validé.
        </p>
        <button onClick={() => router.push('/secretary')} className="w-full py-3 rounded-xl bg-[#82d8ff] text-[#0b1c30] font-bold text-sm">
          Accéder à mon espace
        </button>
      </div>
    </div>
  )
}
