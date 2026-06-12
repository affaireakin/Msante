'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function VerifyOtpContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const email      = searchParams.get('email') ?? ''
  const role       = (searchParams.get('role') ?? 'patient') as 'patient' | 'practitioner'
  const speciality = searchParams.get('speciality') ?? ''
  const practType  = searchParams.get('practType') ?? 'healthcare'

  const [digits, setDigits]     = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState(false)
  const [cooldown, setCooldown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null))

  // Focus first input on mount
  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 100) }, [])

  // Resend cooldown
  useEffect(() => {
    if (cooldown <= 0) { setCanResend(true); return }
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = useCallback(async (code: string) => {
    if (loading) return
    setLoading(true)
    setError('')

    const { data, error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (verifyErr || !data.user) {
      setError('Code incorrect ou expiré. Vérifiez le code reçu par email.')
      setDigits(Array(6).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      setLoading(false)
      return
    }

    // Create practitioner profile after confirmed session
    if (role === 'practitioner' && speciality) {
      await supabase.from('practitioners').insert({
        user_id: data.user.id,
        speciality,
        practitioner_type: practType,
        verification_status: 'pending',
      })
    }

    setSuccess(true)
    setTimeout(() => {
      router.push(role === 'practitioner' ? '/onboarding/practitioner' : '/onboarding/patient')
    }, 800)
  }, [email, loading, practType, role, router, speciality])

  const handleInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    setDigits(next)
    setError('')

    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus()
    }
    if (idx === 5 && digit) {
      const code = next.join('')
      if (code.length === 6) void verify(code)
    }
  }

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft' && idx > 0)  inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      void verify(text)
    } else if (text.length > 0) {
      const next = Array(6).fill('')
      text.split('').forEach((c, i) => { next[i] = c })
      setDigits(next)
      inputRefs.current[Math.min(text.length, 5)]?.focus()
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    const { error: resendErr } = await supabase.auth.resend({ type: 'signup', email })
    if (resendErr) { setError('Erreur lors du renvoi. Réessayez dans un instant.'); return }
    setCanResend(false)
    setCooldown(60)
    setDigits(Array(6).fill(''))
    setError('')
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }

  const codeComplete = digits.join('').length === 6

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

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
        <div
          className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8"
          style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}
        >
          {success ? (
            /* Success state */
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: '36px' }}>check_circle</span>
              </div>
              <div>
                <p className="text-lg font-black text-[#0b1c30]">Email vérifié !</p>
                <p className="text-sm text-slate-400 mt-1">Redirection vers votre espace…</p>
              </div>
              <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[#006685]" style={{ fontSize: '28px' }}>mark_email_read</span>
                </div>
                <h1 className="text-xl font-black text-[#0b1c30]">Vérifiez votre email</h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Nous avons envoyé un code à 6 chiffres à
                </p>
                <p className="text-sm font-bold text-[#006685] mt-0.5">{email}</p>
              </div>

              {/* OTP boxes */}
              <div className="flex gap-2 justify-center mb-6">
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={el => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleInput(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    disabled={loading || success}
                    className="w-11 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all"
                    style={{
                      backgroundColor: '#f8f9ff',
                      borderColor: error ? '#ba1a1a' : d ? '#006685' : '#bec8ce',
                      color: '#0b1c30',
                      caretColor: '#006685',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#006685'
                      e.target.style.boxShadow = '0 0 0 3px rgba(0,102,133,0.1)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = error ? '#ba1a1a' : d ? '#006685' : '#bec8ce'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
                  {error}
                </div>
              )}

              {/* Submit button (when code complete but not auto-submitted) */}
              {codeComplete && !loading && !success && (
                <button
                  onClick={() => void verify(digits.join(''))}
                  disabled={loading}
                  className="w-full py-3.5 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all disabled:opacity-50 mb-4"
                >
                  Vérifier le code
                </button>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-3 mb-4">
                  <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[#006685] font-medium">Vérification…</span>
                </div>
              )}

              {/* Resend */}
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-2">Vous n&apos;avez pas reçu le code ?</p>
                <button
                  onClick={() => void handleResend()}
                  disabled={!canResend}
                  className="text-sm font-bold transition-all"
                  style={{ color: canResend ? '#006685' : '#bec8ce' }}
                >
                  {canResend ? 'Renvoyer le code' : `Renvoyer dans ${cooldown}s`}
                </button>
              </div>

              {/* Back link */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <Link href="/auth/signup" className="text-xs text-slate-400 hover:text-[#006685] transition-colors">
                  ← Modifier l&apos;adresse email
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Medical disclaimer */}
        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          Ce code est valable 60 minutes · En cas d&apos;urgence médicale : <span className="font-bold">15 (SAMU)</span>
        </p>
      </div>
    </div>
  )
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyOtpContent />
    </Suspense>
  )
}
