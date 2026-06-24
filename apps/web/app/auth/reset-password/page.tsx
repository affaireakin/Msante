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
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // After OTP verify, Supabase sets a recovery session in cookies.
    // Just check if the session exists.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session)
      setChecking(false)
    })
  }, [])

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
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    await supabase.auth.signOut()
    setTimeout(() => router.push('/auth/login'), 2000)
    setLoading(false)
  }

  if (done) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <span className="material-symbols-outlined text-emerald-500 text-5xl">check_circle</span>
      <h2 className="text-xl font-bold text-slate-900">Mot de passe mis à jour !</h2>
      <p className="text-slate-500 text-sm">Redirection vers la connexion...</p>
    </div>
  )

  if (checking) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <div className="w-10 h-10 border-2 border-[#006685] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-slate-500 text-sm">Chargement…</p>
    </div>
  )

  if (!ready) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-amber-500 text-3xl">link</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Session expirée</h2>
      <p className="text-slate-500 text-sm leading-relaxed">
        Le code a expiré ou la session est invalide. Recommencez depuis le début.
      </p>
      <a
        href="/auth/forgot-password"
        className="inline-block bg-[#006685] text-white rounded-lg px-6 py-3 font-semibold text-sm hover:bg-[#005470] transition"
      >
        Réinitialiser à nouveau
      </a>
    </div>
  )

  return (
    <div className="glass-card rounded-xl p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900">Nouveau mot de passe</h2>
        <p className="text-slate-500 text-sm mt-1">Choisissez un mot de passe sécurisé.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm font-semibold text-slate-700">Nouveau mot de passe</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Confirmer</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <p className="text-xs text-slate-400">Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </form>
    </div>
  )
}
