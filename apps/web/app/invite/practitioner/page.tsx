'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function translateError(msg: string): string {
  if (msg.includes('already registered') || msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('Password should be')) return 'Le mot de passe doit contenir au moins 6 caractères.'
  return msg
}

function InvitePractitionerContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const invitationId = searchParams.get('invitation_id') ?? ''

  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [orgName, setOrgName] = useState('')
  const [practitionerName, setPractitionerName] = useState('')
  const [accountType, setAccountType] = useState<'practitioner' | 'collaborator' | 'secretary'>('practitioner')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!invitationId) {
    return (
      <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8 text-center">
        <p className="text-sm text-[#6f787e]">Lien d&apos;invitation invalide.</p>
      </div>
    )
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (otp.trim().length !== 8) { setError('Le code doit contenir 8 chiffres.'); return }
    setVerifying(true)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-practitioner-invitation', {
        body: { invitation_id: invitationId, otp: otp.trim() },
      })
      if (fnError || !data?.success) {
        setError((data as { error?: string })?.error ?? 'Code incorrect ou expiré.')
        return
      }
      setFirstname(data.firstname)
      setLastname(data.lastname)
      setEmail(data.email)
      setOrgName(data.organization_name)
      setPractitionerName(data.practitioner_name ?? '')
      setAccountType(data.account_type === 'collaborator' ? 'collaborator' : data.account_type === 'secretary' ? 'secretary' : 'practitioner')
      setVerified(true)
    } catch {
      setError('Une erreur est survenue. Réessayez.')
    } finally {
      setVerifying(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return }

    setSubmitting(true)
    const dbRole = accountType === 'practitioner' ? 'practitioner' : accountType === 'secretary' ? 'secretary' : 'organization_member'
    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: dbRole, full_name: `${firstname} ${lastname}` } },
    })

    if (authError) {
      setError(translateError(authError.message))
      setSubmitting(false)
      return
    }
    if (!signUpData.user || (signUpData.user.identities?.length ?? 0) === 0) {
      setError('Un compte existe déjà avec cet email. Connectez-vous ou utilisez "Mot de passe oublié".')
      setSubmitting(false)
      return
    }

    const params = new URLSearchParams({ email, role: 'practitioner', orgInvitationId: invitationId, accountType })
    router.push(`/auth/verify-otp?${params.toString()}`)
  }

  return (
    <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>
      {!verified ? (
        <form onSubmit={handleVerify} className="space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#82d8ff]" style={{ fontSize: '28px' }}>mail</span>
            </div>
            <h1 className="text-xl font-black text-[#0b1c30]">Invitation praticien</h1>
            <p className="text-sm text-slate-400 mt-2">Saisissez le code à 8 chiffres reçu par email</p>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={8}
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="00000000"
            className="w-full text-center text-2xl font-black tracking-[0.5em] text-[#0b1c30] rounded-xl border-2 border-slate-200 py-4 outline-none focus:border-[#82d8ff]"
          />
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button type="submit" disabled={verifying || otp.length !== 8}
            className="w-full py-3.5 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
            {verifying ? 'Vérification...' : 'Vérifier le code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleCreateAccount} className="space-y-4">
          <div className="text-center mb-2">
            <h1 className="text-xl font-black text-[#0b1c30]">Bienvenue, {firstname} !</h1>
            <p className="text-sm text-slate-400 mt-1">
              Créez votre compte pour rejoindre <strong>{orgName || practitionerName}</strong>
            </p>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Email</label>
            <input value={email} disabled className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm bg-slate-50 text-slate-500" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-11 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" tabIndex={-1}>
                <span className="material-symbols-outlined text-xl">{showPwd ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Confirmer le mot de passe</label>
            <input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full py-3.5 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg transition-all disabled:opacity-50">
            {submitting ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>
      )}
    </div>
  )
}

export default function InvitePractitionerPage() {
  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
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
        <Suspense fallback={<div className="flex justify-center"><div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" /></div>}>
          <InvitePractitionerContent />
        </Suspense>
      </div>
    </div>
  )
}
