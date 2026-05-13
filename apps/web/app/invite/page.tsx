'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Invitation {
  id: string
  email: string
  role: string
  status: string
  expires_at: string
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
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setError('Token manquant'); setLoading(false); return }
    supabase.from('invitations')
      .select('id, email, role, status, expires_at')
      .eq('token', token)
      .single()
      .then(({ data, error: e }) => {
        setLoading(false)
        if (e || !data) { setError('Invitation invalide ou introuvable'); return }
        if (data.status !== 'pending') { setError('Cette invitation a déjà été utilisée'); return }
        if (new Date(data.expires_at) < new Date()) { setError('Cette invitation a expiré'); return }
        setInvitation(data)
      })
  }, [token])

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
    const validErr = validate()
    if (validErr) { setError(validErr); return }
    if (!invitation) return
    setSubmitting(true)
    setError(null)

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: invitation.email,
      password,
    })
    if (authErr || !authData.user) {
      setError(authErr?.message ?? 'Erreur lors de la création du compte')
      setSubmitting(false)
      return
    }

    await supabase.from('users').upsert({
      id: authData.user.id,
      full_name: '',
      role: invitation.role === 'practitioner' ? 'practitioner' : invitation.role === 'admin' ? 'admin' : 'patient',
      onboarding_completed: invitation.role !== 'practitioner',
    })

    await supabase.from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('token', token!)

    setSubmitting(false)
    if (invitation.role === 'practitioner') router.push('/practitioner/onboarding')
    else router.push('/admin')
  }

  if (loading) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
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
            <span className="inline-block bg-sky-100 text-sky-700 text-xs font-bold px-3 py-1 rounded-full mb-3">
              {ROLE_LABELS[invitation?.role ?? ''] ?? invitation?.role}
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">Créer votre compte</h2>
            <p className="text-slate-500 text-sm mt-1">{invitation?.email}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700">Mot de passe</label>
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
              disabled={submitting}
              className="w-full bg-[#006685] text-white rounded-lg py-3 font-semibold text-sm hover:bg-[#005470] transition disabled:opacity-50"
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
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" /></div>}>
      <InviteForm />
    </Suspense>
  )
}
