'use client'

import { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const OTP_LENGTH = 8

function ResetOtpContent() {
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

  useEffect(() => {
    if (!email) { router.replace('/auth/forgot-password'); return }
    setTimeout(() => inputRefs.current[0]?.focus(), 100)
  }, [email, router])

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
      type: 'recovery',
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
    const { error: resendErr } = await supabase.auth.resetPasswordForEmail(email)
    if (resendErr) { setError('Erreur lors du renvoi. Réessayez.'); return }
    setCanResend(false)
    setCooldown(60)
    setDigits(Array(OTP_LENGTH).fill(''))
    setError('')
    setTimeout(() => inputRefs.current[0]?.focus(), 50)
  }

  const codeComplete = digits.join('').length === OTP_LENGTH

  return (
    <div className="glass-card rounded-2xl p-8">
      {success ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: '36px' }}>check_circle</span>
          </div>
          <div>
            <p className="text-lg font-black text-[#0b1c30]">Code vérifié !</p>
            <p className="text-sm text-slate-400 mt-1">Choisissez votre nouveau mot de passe…</p>
          </div>
          <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="text-center mb-7">
            <div className="w-14 h-14 rounded-2xl bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[#006685]" style={{ fontSize: '28px' }}>lock_reset</span>
            </div>
            <h1 className="text-xl font-black text-[#0b1c30]">Code de vérification</h1>
            <p className="text-sm text-slate-400 mt-2">Code envoyé à</p>
            <p className="text-sm font-bold text-[#006685] mt-0.5">{email}</p>
          </div>

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
                className="w-11 h-14 text-center text-2xl font-black rounded-xl border-2 outline-none transition-all bg-[#f8f9ff]"
                style={{
                  borderColor: error ? '#ba1a1a' : d ? '#006685' : '#bec8ce',
                  color: '#0b1c30',
                }}
                onFocus={e => { e.target.style.borderColor = '#006685'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,133,0.1)' }}
                onBlur={e => { e.target.style.borderColor = error ? '#ba1a1a' : d ? '#006685' : '#bec8ce'; e.target.style.boxShadow = 'none' }}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600 flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: '16px' }}>error</span>
              {error}
            </div>
          )}

          {codeComplete && !loading && !success && (
            <button
              onClick={() => void verify(digits.join(''))}
              className="w-full py-3.5 bg-[#006685] text-white font-bold rounded-xl hover:shadow-lg transition-all mb-4"
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

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link href="/auth/forgot-password" className="text-xs text-slate-400 hover:text-[#006685] transition-colors">
              ← Modifier l&apos;adresse email
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function ResetOtpPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center p-8">
        <div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetOtpContent />
    </Suspense>
  )
}
