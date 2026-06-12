'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Role = 'patient' | 'practitioner'
type PractType = 'healthcare' | 'wellness'

const HEALTHCARE_SPECIALITIES = [
  'Médecin généraliste', 'Psychiatre', 'Psychologue clinicien', 'Neurologue',
  'Pédiatre', 'Gynécologue', 'Cardiologue', 'Dermatologue', 'Infirmier(e)',
  'Sage-femme', 'Kinésithérapeute', 'Orthophoniste',
]

const WELLNESS_SPECIALITIES = [
  'Coach de vie', 'Coach bien-être', 'Relaxologue', 'Thérapeute',
  'Nutritionniste', 'Naturopathe', 'Hypnothérapeute', 'Sophrologue',
  'Méditation & pleine conscience', 'Yoga-thérapeute',
]

function translateError(msg: string): string {
  if (msg.includes('already registered') || msg.includes('User already registered')) return 'Un compte existe déjà avec cet email.'
  if (msg.includes('Password should be'))  return 'Le mot de passe doit contenir au moins 6 caractères.'
  if (msg.includes('Unable to validate'))  return 'Email invalide. Vérifiez l\'adresse saisie.'
  if (msg.includes('Too many requests'))   return 'Trop de tentatives. Réessayez dans quelques minutes.'
  return msg
}

export default function SignupPage() {
  const router = useRouter()
  const [role, setRole]               = useState<Role>('patient')
  const [practType, setPractType]     = useState<PractType>('healthcare')
  const [fullName, setFullName]       = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPwd, setShowPwd]         = useState(false)
  const [speciality, setSpeciality]   = useState('')
  const [acceptedCGU, setAcceptedCGU] = useState(false)
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)

  const specialityList = practType === 'healthcare' ? HEALTHCARE_SPECIALITIES : WELLNESS_SPECIALITIES

  const handleRoleChange = (newRole: Role) => {
    setRole(newRole)
    setSpeciality('')
    setPractType('healthcare')
  }

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

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: fullName } },
    })

    if (authError) {
      setError(translateError(authError.message))
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
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl bg-[#006685] flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-white" style={{ fontSize: '20px' }}>medical_services</span>
            </div>
            <div className="text-left">
              <p className="text-lg font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</p>
              <p className="text-[10px] text-[#006685] font-semibold uppercase tracking-widest leading-none mt-0.5">Health Sanctuary</p>
            </div>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>
          <h1 className="text-2xl font-black text-[#0b1c30] mb-1">Inscription</h1>
          <p className="text-sm text-slate-400 mb-6">Rejoignez la plateforme M-Santé</p>

          {/* Choix rôle */}
          <div className="flex gap-2 mb-6 p-1 bg-[#e5eeff] rounded-xl">
            {([
              { value: 'patient',      label: 'Patient',   icon: 'person' },
              { value: 'practitioner', label: 'Praticien', icon: 'medical_services' },
            ] as { value: Role; label: string; icon: string }[]).map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleRoleChange(value)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  role === value ? 'bg-white text-[#006685] shadow-sm' : 'text-slate-500 hover:text-[#006685]'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Type praticien */}
          {role === 'practitioner' && (
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Type de pratique</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'healthcare', label: 'Professionnel de santé', icon: 'local_hospital', desc: 'Médecins, psychiatres, infirmiers…' },
                  { value: 'wellness',   label: 'Praticien bien-être',     icon: 'self_improvement', desc: 'Coachs, relaxologues, thérapeutes…' },
                ] as { value: PractType; label: string; icon: string; desc: string }[]).map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePractTypeChange(value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      practType === value
                        ? 'border-[#006685] bg-[#e5eeff]'
                        : 'border-[#bec8ce] bg-[#f8f9ff] hover:border-[#006685]/40'
                    }`}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '22px', color: practType === value ? '#006685' : '#6f787e' }}>{icon}</span>
                    <p className={`text-sm font-bold mt-1 ${practType === value ? 'text-[#006685]' : 'text-[#0b1c30]'}`}>{label}</p>
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
                placeholder={role === 'practitioner' ? 'Aminata Diallo' : 'Moussa Ndiaye'}
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
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
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
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
                  className="w-full px-4 py-3 pr-12 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f787e] hover:text-[#006685] transition-colors"
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
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
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

            {/* CGU */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedCGU}
                onChange={e => setAcceptedCGU(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-[#bec8ce] text-[#006685] accent-[#006685] flex-shrink-0"
              />
              <span className="text-xs text-slate-500 leading-relaxed">
                En validant votre inscription, vous acceptez les{' '}
                <Link href="/cgu" target="_blank" className="text-[#006685] font-semibold hover:underline">
                  Conditions Générales d&apos;Utilisation
                </Link>
                {' '}de M-Santé.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptedCGU}
              className="w-full py-3.5 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Création du compte...' : `Créer mon compte ${role === 'practitioner' ? 'praticien' : 'patient'}`}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-[#006685] font-semibold hover:underline">Se connecter</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
