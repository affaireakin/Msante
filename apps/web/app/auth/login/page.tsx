'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials'))   return 'Email ou mot de passe incorrect.'
  if (msg.includes('Email not confirmed'))          return 'Confirmez votre email avant de vous connecter.'
  if (msg.includes('Too many requests'))            return 'Trop de tentatives. Réessayez dans quelques minutes.'
  if (msg.includes('User not found'))               return 'Aucun compte associé à cet email.'
  return msg
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    const urlError = searchParams.get('error')
    if (urlError) setError(decodeURIComponent(urlError))
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(translateError(authError.message))
      setLoading(false)
      return
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role, onboarding_completed')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      setError(`Profil introuvable${profileError ? ` : ${profileError.message}` : ''}. Réessayez ou contactez le support.`)
      await supabase.auth.signOut()
      setLoading(false)
      return
    }

    if (profile.role === 'admin') {
      router.push('/admin/overview')
    } else if (profile.role === 'organization_admin') {
      router.push('/organization')
    } else if (profile.role === 'organization_member') {
      router.push('/organization-member')
    } else if (profile.role === 'secretary') {
      router.push('/secretary')
    } else if (profile.role === 'practitioner') {
      router.push(profile.onboarding_completed ? '/practitioner' : '/onboarding/practitioner')
    } else if (profile.role === 'patient') {
      // A patient-role account may actually be an organization creator awaiting
      // Super Admin approval (role only flips to organization_admin on approval).
      const { data: pendingOrg } = await supabase
        .from('organizations')
        .select('id')
        .eq('created_by', data.user.id)
        .maybeSingle()
      if (pendingOrg) {
        router.push('/onboarding/organization')
      } else {
        router.push(profile.onboarding_completed ? '/patient' : '/onboarding/patient')
      }
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
          <Link href="/" className="inline-flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#82d8ff] flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>medical_services</span>
            </div>
            <div className="text-left">
              <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
              <p className="text-[10px] text-[#82d8ff] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>
          <h1 className="text-2xl font-black text-[#0b1c30] mb-1">Connexion</h1>
          <p className="text-sm text-slate-400 mb-8">Connectez-vous à votre espace M-Santé</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@example.com"
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] focus:ring-2 focus:ring-[#82d8ff]/10 transition-all"
              />
            </div>

            {/* Mot de passe + œil */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mot de passe</label>
                <Link href="/auth/forgot-password" className="text-xs text-[#82d8ff] hover:underline">Mot de passe oublié ?</Link>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 pr-12 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] focus:ring-2 focus:ring-[#82d8ff]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f787e] hover:text-[#82d8ff] transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                    {showPwd ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center space-y-2">
            <p className="text-sm text-slate-400">
              Pas encore de compte ?{' '}
              <Link href="/auth/signup" className="text-[#82d8ff] font-semibold hover:underline">S&apos;inscrire</Link>
            </p>
            <p className="text-xs text-slate-400">
              Vous représentez un cabinet ou une clinique ?{' '}
              <Link href="/auth/signup?role=organization" className="text-[#005e7a] font-semibold hover:underline">Créer une organisation</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Pour une expérience optimale, les patients peuvent aussi utiliser{' '}
          <span className="text-[#82d8ff] font-medium">l&apos;application mobile M-Santé</span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
