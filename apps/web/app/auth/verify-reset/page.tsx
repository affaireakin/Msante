'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const OTP_LENGTH = 8

function VerifyResetContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const email = searchParams.get('email') ?? ''

  const [digits, setDigits]       = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState(false)
  const [cooldown, setCooldown]   = useState(60)
  const [canResend, setCanResend] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>(Array(OTP_LENGTH).fill(null))

  useEffect(() => { setTimeout(() => inputRefs.current[0]?.focus(), 100) }, [])

  useEffect(() => {
    if (cooldown <= 0) { setCanResend(true); return }
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const verify = useCallback(async (code: string) => {
    if (loading) return
    setLoading(true)
    setError('')

    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    })

    if (verifyErr) {
      setError('Code incorrect ou expiré. Vérifiez le code reçu par email.')
      setDigits(Array(OTP_LENGTH).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/auth/reset-password'), 800)
  }, [email, loading, router])

  const handleInput = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[idx] = digit
    setDigits(next)
    setError('')

    if (digit && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus()
    if (idx === OTP_LENGTH - 1 && digit) {
      const code = next.join('')
      if (code.length === OTP_LENGTH) void verify(code)
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
    if (e.key === 'ArrowLeft' && idx > 0)               inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < OTP_LENGTH - 1) inputRefs.current[idx + 1]?.focus()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (text.length === OTP_LENGTH) {
      setDigits(text.split(''))
      void verify(text)
    } else if (text.length > 0) {
      const next = Array(OTP_LENGTH).fill('')
      text.split('').forEach((c, i) => { next[i] = c })
      setDigits(next)
      inputRefs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus()
    }
  }

  const handleResend = async () => {
    if (!canResend) return
    const { error: resendErr } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (resendErr && resendErr.status !== 422) {
      setError('Erreur lors du renvoi. Réessayez.')
      return
    }
    setCanResend(false)
    setCooldown(60)
    setDigits(Array(OTP_LENGTH).fill(''))
    setError('')
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }

  const codeComplete = digits.join('').length === OTP_LENGTH

  return (
    <>
        {/* Card */}
        <div
          className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8"
          style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}
        >
          {success ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: '36px' }}>check_circle</span>
              </div>
              <div>
                <p className="text-lg font-black text-[#0b1c30]">Code vérifié !</p>
                <p className="text-sm text-slate-400 mt-1">Choisissez votre nouveau mot de passe…</p>
              </div>
              <div className="w-5 h-5 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-7">
                <div className="w-14 h-14 rounded-2xl bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-[#82d8ff]" style={{ fontSize: '28px' }}>lock_reset</span>
                </div>
                <h1 className="text-xl font-black text-[#0b1c30]">Réinitialisation</h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                  Code de vérification envoyé à
                </p>
                <p className="text-sm font-bold text-[#82d8ff] mt-0.5">{email}</p>
              </div>

              {/* OTP boxes */}
              <div className="flex gap-1.5 justify-center mb-6">
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
                    className="w-9 h-12 text-center text-xl font-black rounded-xl border-2 outline-none transition-all"
                    style={{
                      backgroundColor: '#f8f9ff',
                      borderColor: error ? '#ba1a1a' : d ? '#82d8ff' : '#bec8ce',
                      color: '#0b1c30',
                      caretColor: '#82d8ff',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#82d8ff'
                      e.target.style.boxShadow = '0 0 0 3px rgba(0,102,133,0.1)'
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = error ? '#ba1a1a' : d ? '#82d8ff' : '#bec8ce'
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

              {codeComplete && !loading && !success && (
                <button
                  onClick={() => void verify(digits.join(''))}
                  className="w-full py-3.5 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg hover:shadow-sky-500/20 transition-all mb-4"
                >
                  Vérifier le code
                </button>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-3 mb-4">
                  <div className="w-5 h-5 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[#82d8ff] font-medium">Vérification…</span>
                </div>
              )}

              {/* Resend */}
              <div className="text-center">
                <p className="text-xs text-slate-400 mb-2">Code à {OTP_LENGTH} chiffres · Vous n&apos;avez pas reçu le code ?</p>
                <button
                  onClick={() => void handleResend()}
                  disabled={!canResend}
                  className="text-sm font-bold transition-all"
                  style={{ color: canResend ? '#82d8ff' : '#bec8ce' }}
                >
                  {canResend ? 'Renvoyer le code' : `Renvoyer dans ${cooldown}s`}
                </button>
              </div>

              {/* Back */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <Link href="/auth/forgot-password" className="text-xs text-slate-400 hover:text-[#82d8ff] transition-colors">
                  ← Modifier l&apos;adresse email
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-4 leading-relaxed">
          Ce code est valable 10 minutes · En cas d&apos;urgence médicale : <span className="font-bold">15 (SAMU)</span>
        </p>
    </>
  )
}

export default function VerifyResetPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyResetContent />
    </Suspense>
  )
}
