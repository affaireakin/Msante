'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push(`/auth/reset-otp?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Mot de passe oublié</h2>
        <p className="text-slate-500 text-sm mt-1">
          Entrez votre email pour recevoir un code de vérification.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            placeholder="votre@email.com"
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50"
        >
          {loading ? 'Envoi...' : 'Recevoir le code'}
        </button>
      </form>
      <a href="/auth/login" className="block text-center text-slate-500 text-sm hover:text-slate-700">
        ← Retour à la connexion
      </a>
    </div>
  )
}
