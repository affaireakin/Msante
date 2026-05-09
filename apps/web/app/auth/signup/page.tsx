'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Role = 'patient' | 'practitioner'

export default function SignupPage() {
  const router = useRouter()
  const [role, setRole] = useState<Role>('patient')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [speciality, setSpeciality] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, full_name: fullName },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Vérifiez votre email pour confirmer votre inscription.')
      setLoading(false)
      return
    }

    if (role === 'practitioner' && speciality) {
      await supabase.from('practitioners').insert({
        user_id: data.user.id,
        speciality,
        verification_status: 'pending',
      })
    }

    router.push(role === 'practitioner' ? '/onboarding/practitioner' : '/onboarding/patient')

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-3xl font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
            <span className="text-xs text-slate-400 font-medium">Créer un compte</span>
          </Link>
        </div>

        {/* Card */}
        <div
          className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8"
          style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}
        >
          <h1 className="text-2xl font-black text-[#0b1c30] mb-1">Inscription</h1>
          <p className="text-sm text-slate-400 mb-6">Rejoignez la plateforme M-Santé</p>

          {/* Toggle rôle */}
          <div className="flex gap-2 mb-6 p-1 bg-[#e5eeff] rounded-xl">
            {([
              { value: 'patient', label: 'Patient', icon: 'person' },
              { value: 'practitioner', label: 'Praticien', icon: 'medical_services' },
            ] as { value: Role; label: string; icon: string }[]).map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => { setRole(value); setSpeciality('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  role === value
                    ? 'bg-white text-[#006685] shadow-sm'
                    : 'text-slate-500 hover:text-[#006685]'
                }`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder={role === 'practitioner' ? 'Dr. Aminata Diallo' : 'Moussa Ndiaye'}
                required
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
              />
            </div>

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
                placeholder="Minimum 6 caractères"
                required
                minLength={6}
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] focus:ring-2 focus:ring-[#006685]/10 transition-all"
              />
            </div>

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
                  <option>Psychologue</option>
                  <option>Psychiatre</option>
                  <option>Thérapeute</option>
                  <option>Coach bien-être</option>
                  <option>Nutritionniste</option>
                  <option>Médecin généraliste</option>
                </select>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {role === 'practitioner' && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>info</span>
                Votre compte sera examiné et validé par un administrateur avant activation.
              </div>
            )}

            {role === 'patient' && (
              <div className="bg-[#e5eeff] border border-[#bee9ff] rounded-xl px-4 py-3 text-xs text-[#005e7a] flex items-start gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }}>smartphone</span>
                Pour une expérience optimale avec le suivi bien-être, téléchargez aussi l&apos;application mobile M-Santé.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Création du compte...' : `Créer mon compte ${role === 'practitioner' ? 'praticien' : 'patient'}`}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-400">
              Déjà un compte ?{' '}
              <Link href="/auth/login" className="text-[#006685] font-semibold hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
