'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
  role_ids: string[] | null
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  moderator: 'Modérateur',
  accountant: 'Comptable',
  practitioner: 'Praticien',
}

function InviteForm() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token')

  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [roleNames, setRoleNames] = useState<string[]>([])

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return }
    supabase.from('invitations')
      .select('id, email, role, status, expires_at, role_ids')
      .eq('token', token)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false)
        if (e || !data) { setError('Invitation invalide ou introuvable'); return }
        if (data.status !== 'pending') { setError('Cette invitation a déjà été utilisée'); return }
        if (new Date(data.expires_at) < new Date()) { setError('Cette invitation a expiré'); return }
        setInvitation(data)
        if (data.role_ids?.length) {
          supabase.from('admin_roles').select('name').in('id', data.role_ids).then(({ data: roles }) => {
            if (roles) setRoleNames(roles.map(r => r.name))
          })
        }
      })
  }, [token])

  const validate = () => {
    if (!firstName.trim() || !lastName.trim()) return 'Prénom et nom requis'
    if (password.length < 8) return 'Minimum 8 caractères'
    if (!/[A-Z]/.test(password)) return 'Au moins une majuscule'
    if (!/[0-9]/.test(password)) return 'Au moins un chiffre'
    if (!/[^A-Za-z0-9]/.test(password)) return 'Au moins un caractère spécial'
    if (password !== confirm) return 'Les mots de passe ne correspondent pas'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validErr = validate()
    if (validErr) { setError(validErr); return }
    if (!invitation) return
    setSubmitting(true)
    setError(null)

    const userRole = invitation.role === 'practitioner' ? 'practitioner' : 'admin'
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
    const { data: signUpData, error: authErr } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: { data: { role: userRole, full_name: fullName } },
    })
    if (authErr) {
      setError(authErr.message ?? 'Erreur lors de la création du compte')
      setSubmitting(false)
      return
    }

    if (invitation.role_ids?.length && signUpData.user) {
      // No confirmed session yet at this point (OTP verification is still
      // pending) — auth.uid() would be null, so this has to happen via a
      // service-role function rather than a direct client-side write.
      const { error: acceptErr } = await supabase.functions.invoke('accept-admin-invitation', {
        body: { token, user_id: signUpData.user.id },
      })
      if (acceptErr) {
        setError("Compte créé, mais l'attribution des rôles a échoué — contactez un administrateur général.")
        setSubmitting(false)
        return
      }
    } else {
      await supabase.from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('token', token!)
    }

    setSubmitting(false)
    router.push(`/auth/verify-otp?email=${encodeURIComponent(invitation.email)}&role=${userRole}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error && !invitation) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="glass-card rounded-xl p-8 text-center max-w-md w-full space-y-4">
        <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
        <h2 className="text-xl font-bold text-slate-900">{error}</h2>
        <a href="/" className="block text-sky-600 text-sm font-semibold hover:underline">Retour à l'accueil</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-sky-500 text-3xl">medical_services</span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-slate-900">M-Santé</h1>
            <p className="text-xs text-slate-500 font-medium">Health Sanctuary</p>
          </div>
        </div>
        <div className="glass-card rounded-xl p-8 space-y-6">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {roleNames.length > 0 ? roleNames.map(name => (
                <span key={name} className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full">{name}</span>
              )) : (
                <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full">
                  {ROLE_LABELS[invitation?.role ?? ''] ?? invitation?.role}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">Créer votre compte</h2>
            <p className="text-slate-500 text-sm mt-1">{invitation?.email}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold text-[#0b1c30]">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className="w-full mt-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[#0b1c30] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82d8ff] focus:border-[#82d8ff]"
                  placeholder="Aminata"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-[#0b1c30]">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className="w-full mt-1 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-[#0b1c30] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82d8ff] focus:border-[#82d8ff]"
                  placeholder="Diallo"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#0b1c30]">Mot de passe</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-[#0b1c30] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82d8ff] focus:border-[#82d8ff]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#82d8ff] transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-[#0b1c30]">Confirmer</label>
              <div className="relative mt-1">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-[#0b1c30] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#82d8ff] focus:border-[#82d8ff]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#82d8ff] transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showConfirm} />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-400">Min. 8 caractères · 1 majuscule · 1 chiffre · 1 caractère spécial</p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#82d8ff] text-[#0b1c30] rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50"
            >
              {submitting ? 'Création...' : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>}>
      <InviteForm />
    </Suspense>
  )
}
