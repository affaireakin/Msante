'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  if (sent) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <span className="material-symbols-outlined text-sky-500 text-5xl">mark_email_read</span>
      <h2 className="text-xl font-bold text-slate-900">Email envoyé !</h2>
      <p className="text-slate-500 text-sm">
        Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
      </p>
      <a href="/auth/login" className="block text-sky-600 text-sm font-semibold hover:underline">
        Retour à la connexion
      </a>
    </div>
  )

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Mot de passe oublié</h2>
        <p className="text-slate-500 text-sm mt-1">
          Entrez votre email pour recevoir un lien de réinitialisation.
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
          {loading ? 'Envoi...' : 'Envoyer le lien'}
        </button>
      </form>
      <a href="/auth/login" className="block text-center text-slate-500 text-sm hover:text-slate-700">
        ← Retour à la connexion
      </a>
    </div>
  )
}
