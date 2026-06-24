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
  const [pageError, setPageError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function detectSession() {
      // 1. Implicit flow: #access_token=xxx&type=recovery (magic link)
      //    @supabase/ssr has detectSessionInUrl:false — must call setSession manually
      const hash = window.location.hash
      if (hash && hash.includes('access_token')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''))
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token') ?? ''
        if (accessToken) {
          const { error: sessErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          window.history.replaceState({}, '', window.location.pathname)
          if (sessErr) {
            setPageError('Lien invalide ou expiré. Demandez un nouveau lien.')
          } else {
            setReady(true)
          }
          setChecking(false)
          return
        }
      }

      // 2. Error in hash: #error=access_denied
      if (hash && hash.includes('error=')) {
        const params = new URLSearchParams(hash.replace(/^#/, ''))
        const desc = params.get('error_description') ?? 'Lien invalide ou expiré.'
        setPageError(decodeURIComponent(desc.replace(/\+/g, ' ')))
        window.history.replaceState({}, '', window.location.pathname)
        setChecking(false)
        return
      }

      // 3. PKCE flow: ?code=xxx
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      if (code) {
        const { data, error: exchErr } = await supabase.auth.exchangeCodeForSession(code)
        window.history.replaceState({}, '', window.location.pathname)
        if (exchErr || !data.session) {
          setPageError('Lien invalide ou expiré. Demandez un nouveau lien.')
        } else {
          setReady(true)
        }
        setChecking(false)
        return
      }

      // 4. Existing session (from OTP verify-reset or already signed in)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
        setChecking(false)
        return
      }

      // 5. No token found — wait briefly for onAuthStateChange (PASSWORD_RECOVERY event)
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') && session) {
          setReady(true)
          setChecking(false)
          subscription.unsubscribe()
        }
      })

      // If no event after 3s, show helpful error
      setTimeout(() => {
        setChecking(false)
        subscription.unsubscribe()
      }, 3000)
    }

    void detectSession()
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

  if (checking) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <div className="w-10 h-10 border-2 border-[#006685] border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-slate-500 text-sm">Vérification du lien…</p>
    </div>
  )

  if (pageError) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-red-500 text-3xl">link_off</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Lien invalide</h2>
      <p className="text-slate-500 text-sm leading-relaxed">{pageError}</p>
      <a
        href="/auth/forgot-password"
        className="inline-block bg-[#006685] text-white rounded-lg px-6 py-3 font-semibold text-sm hover:bg-[#005470] transition"
      >
        Demander un nouveau lien
      </a>
    </div>
  )

  if (!ready) return (
    <div className="glass-card rounded-xl p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-amber-500 text-3xl">link</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Lien requis</h2>
      <p className="text-slate-500 text-sm leading-relaxed">
        Cliquez sur le lien reçu par email pour accéder à cette page.
      </p>
      <a
        href="/auth/forgot-password"
        className="inline-block bg-[#006685] text-white rounded-lg px-6 py-3 font-semibold text-sm hover:bg-[#005470] transition"
      >
        Demander un lien
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
