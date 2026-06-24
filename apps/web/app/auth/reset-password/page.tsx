'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // If Supabase redirected here with an error in the hash (token expired/consumed),
    // send the user to login with the error message instead of showing a broken form.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const hashError = hash.get('error')
    if (hashError) {
      const msg = hash.get('error_description') ?? 'Lien invalide ou expiré.'
      router.replace(`/auth/login?error=${encodeURIComponent(msg)}`)
      return
    }

    // PKCE: exchange code from URL if present — createBrowserClient handles this automatically
    // then fires PASSWORD_RECOVERY or SIGNED_IN
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session) setReady(true)
    })
    // Also check existing session (case where callback route already exchanged the code)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [router])

  const validate = () => {
    if (password.length < 8) return 'Minimum 8 caractères'
    if (!/[A-Z]/.test(password)) return 'Au moins une majuscule'
    if (!/[0-9]/.test(password)) return 'Au moins un chiffre'
    if (!/[^A-Za-z0-9]/.test(password)) return 'Au moins un caractère spécial'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2000)
  }

  if (done) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <span className="material-symbols-outlined text-emerald-500 text-5xl">check_circle</span>
      <h2 className="text-xl font-bold text-slate-900">Mot de passe mis à jour !</h2>
      <p className="text-slate-500 text-sm">Redirection vers la connexion...</p>
    </div>
  )

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Nouveau mot de passe</h2>
        <p className="text-slate-500 text-sm mt-1">Choisissez un mot de passe sécurisé.</p>
      </div>
      {!ready && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          En attente du lien... Assurez-vous d'avoir cliqué sur le lien dans votre email.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Nouveau mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            disabled={!ready}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Confirmer</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            disabled={!ready}
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
          />
        </div>
        <p className="text-xs text-slate-400">Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading || !ready}
          className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
