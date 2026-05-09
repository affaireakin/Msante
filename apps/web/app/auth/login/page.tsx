'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // Vérifie le rôle et l'onboarding en base (source de vérité)
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, onboarding_completed')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      setError('Impossible de charger votre profil. Réessayez.')
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile.role === 'admin') {
      router.push('/admin/overview')
    } else if (profile.role === 'practitioner') {
      router.push(profile.onboarding_completed ? '/practitioner' : '/onboarding/practitioner')
    } else if (profile.role === 'patient') {
      router.push(profile.onboarding_completed ? '/patient' : '/onboarding/patient')
    } else {
      setError('Rôle inconnu. Contactez le support.')
      await supabase.auth.signOut()
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-3xl font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
            <span className="text-xs text-slate-400 font-medium">Admin Console</span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8"
          style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}
        >
          <h1 className="text-2xl font-black text-[#0b1c30] mb-1">Connexion</h1>
          <p className="text-sm text-slate-400 mb-8">Connectez-vous à votre espace M-Santé</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@example.com"
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">
              Pas encore de compte ?{' '}
              <Link href="/auth/signup" className="text-[#006685] font-semibold hover:underline">
                S&apos;inscrire
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Pour une expérience optimale, les patients peuvent aussi utiliser{' '}
          <span className="text-[#006685] font-medium">l&apos;application mobile M-Santé</span>
        </p>
      </div>
    </div>
  )
}
