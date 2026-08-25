'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Role = 'patient' | 'practitioner' | 'organization'
type PractType = 'healthcare' | 'wellness'
type Step = 'select' | 'form'

const PROFILE_CARDS: { value: Role; label: string; desc: string; icon: string }[] = [
  { value: 'patient',      label: 'Patient',      desc: '', icon: 'person' },
  { value: 'practitioner', label: 'Praticien',     desc: '', icon: 'medical_services' },
  { value: 'organization', label: 'Organisation',  desc: '(Cabinet, clinique, hôpitaux)',  icon: 'business' },
]

function translateError(msg: string): string {
  if (msg.includes('already registered') || msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('Password should be'))  return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (msg.includes('Unable to validate'))  return 'Email invalide. Vérifiez l\'adresse saisie.'
  if (msg.includes('Too many requests'))   return 'Trop de tentatives. Réessayez dans quelques minutes.'
  return msg
}

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialRole = (searchParams.get('role') as Role | null)
  const hasPreselectedRole = initialRole === 'organization' || initialRole === 'practitioner' || initialRole === 'patient'
  const [step, setStep] = useState<Step>(hasPreselectedRole ? 'form' : 'select')
  const [role, setRole] = useState<Role>(hasPreselectedRole ? (initialRole as Role) : 'patient')
  const [practType, setPractType]     = useState<PractType>('healthcare')
  const [fullName, setFullName]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [speciality, setSpeciality]   = useState('')
  const [acceptedCGU, setAcceptedCGU] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const [specialities, setSpecialities] = useState<string[]>([])

  useEffect(() => {
    supabase.from('profession_permissions').select('profession_label').eq('category', practType).order('sort_order')
      .then(({ data }) => {
        setSpecialities(data?.length ? data.map(r => r.profession_label) : [])
      })
  }, [practType])

  const specialityList = specialities

  const chooseRole = (newRole: Role) => {
    setRole(newRole)
    setSpeciality('')
    setPractType('healthcare')
    setStep('form')
  }

  const backToSelection = () => setStep('select')

  const handlePractTypeChange = (t: PractType) => {
    setPractType(t)
    setSpeciality('')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!acceptedCGU) {
      setError('Vous devez accepter les Conditions Générales d\'Utilisation.')
      return
    }

    setLoading(true)

    // The DB role check only accepts patient/practitioner/admin/organization_admin.
    // A future org creator starts as a plain 'patient' — validate-organization
    // promotes them to 'organization_admin' once the Super Admin approves the org.
    const dbRole = role === 'organization' ? 'patient' : role

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: dbRole, full_name: fullName } },
    })

    if (authError) {
      setError(translateError(authError.message))
      setLoading(false)
      return
    }

    // Supabase v2 silently ignores duplicate emails (no error, no OTP sent)
    // Detect via empty identities array
    if (!signUpData.user || (signUpData.user.identities?.length ?? 0) === 0) {
      setError('Un compte existe déjà avec cet email. Connectez-vous ou utilisez "Mot de passe oublié".')
      setLoading(false)
      return
    }

    // Redirect to OTP verification — practitioner profile created after email confirmed
    const params = new URLSearchParams({ email, role })
    if (role === 'practitioner') {
      params.set('speciality', speciality)
      params.set('practType', practType)
    }
    router.push(`/auth/verify-otp?${params.toString()}`)
  }

  return (
    <>
        {step === 'select' ? (
          /* ── Étape 1 : sélection du profil ── */
          <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>
            <h1 className="text-2xl font-black text-[#0b1c30] mb-1">Inscription</h1>
            <p className="text-sm text-slate-400 mb-6">Quel est votre profil ?</p>

            <div className="flex flex-col gap-3">
              {PROFILE_CARDS.map(({ value, label, desc, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => chooseRole(value)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-[#bec8ce] bg-[#f8f9ff] text-left transition-all hover:border-[#82d8ff] hover:bg-[#e5eeff]"
                >
                  <div className="w-11 h-11 rounded-xl bg-[#82d8ff]/15 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[#82d8ff]" style={{ fontSize: '22px' }}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#0b1c30]">{label}</p>
                    {desc && <p className="text-xs text-[#6f787e] mt-0.5 leading-snug">{desc}</p>}
                  </div>
                  <span className="material-symbols-outlined text-[#bec8ce]" style={{ fontSize: '20px' }}>chevron_right</span>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100 text-center">
              <p className="text-sm text-slate-400">
                Déjà un compte ?{' '}
                <Link href="/auth/login" className="text-[#82d8ff] font-semibold hover:underline">Se connecter</Link>
              </p>
            </div>
          </div>
        ) : (
        /* ── Étape 2 : formulaire ── */
        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>
          <button
            type="button"
            onClick={backToSelection}
            className="flex items-center gap-1 text-sm font-semibold text-slate-400 hover:text-[#82d8ff] transition-colors mb-4"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Retour
          </button>

          <h1 className="text-2xl font-black text-[#0b1c30] mb-6">
            Inscription {role === 'practitioner' ? 'praticien' : role === 'organization' ? 'organisation' : 'patient'}
          </h1>

          {/* Type praticien */}
          {role === 'practitioner' && (
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type de pratique</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { value: 'healthcare', label: 'Professionnels de santé', icon: 'local_hospital', desc: 'Psychiatre, psychologue, médecin…' },
                  { value: 'wellness',   label: 'Praticiens bien-être',     icon: 'self_improvement', desc: 'Coach, coach de vie, développement personnel…' },
                ] as { value: PractType; label: string; icon: string; desc: string }[]).map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePractTypeChange(value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      practType === value
                        ? 'border-[#82d8ff] bg-[#e5eeff]'
                        : 'border-[#bec8ce] bg-[#f8f9ff] hover:border-[#82d8ff]/40'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: practType === value ? '#82d8ff' : '#6f787e' }}>{icon}</span>
                    <p className={`text-sm font-bold mt-1 ${practType === value ? 'text-[#82d8ff]' : 'text-[#0b1c30]'}`}>{label}</p>
                    <p className="text-xs text-[#6f787e] mt-0.5 leading-snug">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleSignup} className="flex flex-col gap-4">

            {/* Nom */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={role === 'practitioner' ? 'Aminata Diallo' : role === 'organization' ? 'Nom du responsable' : 'Moussa Ndiaye'}
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] focus:ring-2 focus:ring-[#82d8ff]/10 transition-all"
              />
            </div>

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
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 6 caractères"
                  required
                  minLength={6}
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

            {/* Spécialité praticien */}
            {role === 'practitioner' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Spécialité</label>
                <select
                  value={speciality}
                  onChange={e => setSpeciality(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] focus:ring-2 focus:ring-[#82d8ff]/10 transition-all"
                >
                  <option value="">Choisir une spécialité</option>
                  {specialityList.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
                {error}
              </div>
            )}

            {role === 'practitioner' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>info</span>
                Votre compte sera examiné et validé par un administrateur avant activation.
              </div>
            )}

            {role === 'organization' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>info</span>
                Après confirmation de votre email, vous renseignerez les informations de votre organisation (cabinet, clinique…).
                Une fois validée par notre équipe, vous pourrez inviter vos praticiens et collaborateurs.
              </div>
            )}

            {/* CGU */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedCGU}
                onChange={e => setAcceptedCGU(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#bec8ce] text-[#82d8ff] accent-[#82d8ff] flex-shrink-0"
              />
              <span className="text-xs text-slate-500 leading-relaxed">
                J&apos;accepte les{' '}
                <Link href="/cgu" target="_blank" className="text-[#82d8ff] font-semibold hover:underline">
                  Conditions Générales
                </Link>
                {' '}et le{' '}
                <Link href="/pages/confidentialite" target="_blank" className="text-[#82d8ff] font-semibold hover:underline">
                  traitement de mes données
                </Link>
                {' '}conformément à la politique de confidentialité.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedCGU}
              className="w-full py-3.5 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Création du compte...' : `Créer mon compte ${role === 'practitioner' ? 'praticien' : role === 'organization' ? 'organisation' : 'patient'}`}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-[#82d8ff] font-semibold hover:underline">Se connecter</Link>
            </p>
          </div>
        </div>
        )}
    </>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
