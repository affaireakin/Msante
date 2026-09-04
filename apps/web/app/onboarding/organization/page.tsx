'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const STEPS = ['Organisation', 'Documents', 'Confirmation']

const DOC_TYPES = [
  { value: 'siret_extract', label: 'Extrait SIRET / Kbis' },
  { value: 'id_responsable', label: 'Pièce d\'identité du responsable' },
  { value: 'autre', label: 'Autre document' },
]

interface DocFile { file: File | null; type: string; uploading: boolean; uploaded: boolean; url: string }
const emptyDoc = (type: string): DocFile => ({ file: null, type, uploading: false, uploaded: false, url: '' })

function slugify(name: string): string {
  const stripDiacritics = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const base = stripDiacritics(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'organisation'}-${suffix}`
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'En attente de validation',
  rejected: 'Demande refusée',
  suspended: 'Organisation suspendue',
  archived: 'Organisation archivée',
}

export default function OrganizationOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [requesterName, setRequesterName] = useState('')
  const [requesterEmail, setRequesterEmail] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [existingRequest, setExistingRequest] = useState<{ name: string; status: string } | null>(null)

  // Step 0 — organisation
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [country, setCountry] = useState('SN')
  const [siret, setSiret] = useState('')

  // Step 1 — documents
  const [docs, setDocs] = useState<DocFile[]>([emptyDoc('siret_extract')])
  const fileInputs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push(`/auth/login?redirect=${encodeURIComponent('/onboarding/organization')}`); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('users').select('full_name, email, organization_id, role').eq('id', user.id).single()

      // Already approved & attached (role flipped to organization_admin) — safety
      // net in case the client landed here from a stale link.
      if (profile?.organization_id && profile.role === 'organization_admin') {
        router.push('/organization')
        return
      }

      // Already submitted a request — show its current status instead of the form.
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('name, status')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .maybeSingle()
      if (existingOrg) {
        setExistingRequest({ name: existingOrg.name, status: existingOrg.status })
        setChecking(false)
        return
      }

      setRequesterName(profile?.full_name ?? '')
      setRequesterEmail(profile?.email ?? user.email ?? '')
      if (!email && (profile?.email ?? user.email)) setEmail(profile?.email ?? user.email ?? '')
      setChecking(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const addDoc = () => setDocs(d => [...d, emptyDoc('autre')])
  const removeDoc = (idx: number) => setDocs(d => d.filter((_, i) => i !== idx))

  const handleFileSelect = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop volumineux (max 10 Mo)'); return }
    setError('')
    setDocs(d => d.map((doc, i) => i === idx ? { ...doc, file, uploaded: false, url: '' } : doc))
  }

  const handleNext = () => {
    setError('')
    if (step === 0) {
      if (!name.trim() || !email.trim() || !address.trim() || !city.trim() || !phone.trim()) {
        setError('Merci de compléter tous les champs obligatoires.')
        return
      }
      setStep(1)
    } else if (step === 1) {
      if (!docs.some(d => d.file)) { setError('Au moins un document justificatif est requis.'); return }
      setStep(2)
    } else {
      void handleSubmit()
    }
  }

  const handleSubmit = async () => {
    if (!userId) return
    setSaving(true)
    setError('')
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: name.trim(),
          slug: slugify(name),
          email: email.trim(),
          phone: phone.trim(),
          address: address.trim(),
          city: city.trim(),
          postal_code: postalCode.trim() || null,
          country,
          siret: siret.trim() || null,
          status: 'pending',
          created_by: userId,
        })
        .select('id')
        .single()

      if (orgError || !org) throw new Error(orgError?.message ?? 'Impossible de créer l\'organisation')

      // Upload documents
      for (const doc of docs) {
        if (!doc.file) continue
        const ext = doc.file.name.split('.').pop()
        const path = `${userId}/org_${doc.type}_${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, doc.file, { upsert: true })
        if (uploadError) continue
        await supabase.from('organization_documents').insert({
          organization_id: org.id,
          document_type: doc.type,
          file_url: path,
        })
      }

      // Notify all super admins (in-app notification)
      const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin')
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map(a => ({
            user_id: a.id,
            type: 'organization_pending',
            title: 'Nouvelle organisation à valider',
            body: `${name.trim()} a soumis une demande de création.`,
            data: { organization_id: org.id },
            channel: 'push',
            status: 'pending',
          }))
        )
      }

      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
    } finally {
      setSaving(false)
    }
  }

  if (checking) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (existingRequest) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
          existingRequest.status === 'rejected' ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          <Icon
            name={existingRequest.status === 'rejected' ? 'cancel' : existingRequest.status === 'suspended' ? 'block' : 'pending_actions'}
            size={32}
            color={existingRequest.status === 'rejected' ? '#dc2626' : '#d97706'}
          />
        </div>
        <h2 className="text-xl font-black text-[#0b1c30]">
          {STATUS_LABELS[existingRequest.status] ?? existingRequest.status}
        </h2>
        <p className="text-sm text-[#6f787e]">
          Votre demande pour <strong>{existingRequest.name}</strong>{' '}
          {existingRequest.status === 'pending' && 'est en cours d\'examen par notre équipe. Vous serez notifié dès sa validation.'}
          {existingRequest.status === 'rejected' && 'n\'a pas été retenue. Contactez notre équipe pour plus d\'informations.'}
          {existingRequest.status === 'suspended' && 'a été suspendue. Contactez notre équipe pour plus d\'informations.'}
          {existingRequest.status === 'archived' && 'est archivée et n\'est plus active.'}
        </p>
        <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-[#82d8ff] text-[#0b1c30] font-bold text-sm">
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  if (step === 3) return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-10 max-w-md w-full text-center space-y-5 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-[#e5eeff] flex items-center justify-center mx-auto">
          <Icon name="check_circle" size={32} color="#82d8ff" />
        </div>
        <h2 className="text-xl font-black text-[#0b1c30]">Demande envoyée !</h2>
        <p className="text-sm text-[#6f787e]">
          Votre demande de création pour <strong>{name}</strong> a été transmise à notre équipe.
          Vous recevrez une notification dès qu&apos;elle sera validée.
        </p>
        <button onClick={() => router.push('/auth/login')} className="w-full py-3 rounded-xl bg-[#82d8ff] text-[#0b1c30] font-bold text-sm">
          Retour à la connexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff] py-10 px-6" style={{ fontFamily: 'Manrope' }}>
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-[#0b1c30]">Créer une organisation</h1>
          <p className="text-sm text-[#6f787e] mt-1">Cabinet, clinique ou centre médical</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i <= step ? 'bg-[#82d8ff] text-[#0b1c30]' : 'bg-slate-200 text-slate-400'}`}>
                {i + 1}
              </div>
              <span className={`text-xs font-semibold ${i <= step ? 'text-[#0b1c30]' : 'text-slate-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-slate-200 ml-2" />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-sm space-y-5">
          {requesterName && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#e5eeff]">
              <Icon name="person" size={18} color="#005e7a" />
              <p className="text-xs text-[#3f484d]">
                Vous serez l&apos;administrateur de cette organisation : <strong>{requesterName}</strong> ({requesterEmail})
              </p>
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nom de l&apos;organisation *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Cabinet Médical Diallo"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Email *</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Téléphone *</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 7X XXX XX XX"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">Adresse *</label>
                <input value={address} onChange={e => setAddress(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Ville *</label>
                  <input value={city} onChange={e => setCity(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Code postal</label>
                  <input value={postalCode} onChange={e => setPostalCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Pays</label>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <option value="SN">Sénégal</option>
                    <option value="CI">Côte d&apos;Ivoire</option>
                    <option value="CM">Cameroun</option>
                    <option value="FR">France</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700">SIRET <span className="text-slate-400 font-normal">(optionnel selon le pays)</span></label>
                <input value={siret} onChange={e => setSiret(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-sky-500" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-[#6f787e]">Au moins un document justificatif est requis (extrait SIRET/Kbis recommandé).</p>
              {docs.map((doc, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                  <select value={doc.type} onChange={e => setDocs(d => d.map((x, i) => i === idx ? { ...x, type: e.target.value } : x))}
                    className="text-sm border border-slate-200 rounded-lg px-2 py-2 flex-shrink-0">
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input ref={el => { fileInputs.current[idx] = el }} type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => handleFileSelect(idx, e)} />
                  <button onClick={() => fileInputs.current[idx]?.click()}
                    className="flex-1 text-left text-sm px-3 py-2 rounded-lg bg-slate-50 text-slate-500 truncate hover:bg-slate-100">
                    {doc.file ? doc.file.name : 'Choisir un fichier...'}
                  </button>
                  {docs.length > 1 && (
                    <button onClick={() => removeDoc(idx)} className="text-red-400 hover:text-red-600">
                      <Icon name="close" size={18} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addDoc} className="text-sm font-semibold text-[#005e7a] hover:underline flex items-center gap-1">
                <Icon name="add" size={16} /> Ajouter un document
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm font-bold text-[#0b1c30]">Récapitulatif</p>
              {[
                { label: 'Nom', value: name },
                { label: 'Email', value: email },
                { label: 'Téléphone', value: phone },
                { label: 'Adresse', value: `${address}, ${city} ${postalCode}` },
                { label: 'SIRET', value: siret || 'Non renseigné' },
                { label: 'Documents', value: `${docs.filter(d => d.file).length} fichier(s)` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <span className="text-[#6f787e]">{label}</span>
                  <span className="font-medium text-[#0b1c30] text-right max-w-[60%]">{value}</span>
                </div>
              ))}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 mt-2">
                Votre demande sera examinée par notre équipe. Vous serez notifié(e) par email dès sa validation.
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-medium text-[#6f787e] hover:bg-slate-50">
                Retour
              </button>
            )}
            <button onClick={handleNext} disabled={saving}
              className="flex-1 py-3 bg-[#82d8ff] text-[#0b1c30] font-bold rounded-xl hover:shadow-lg transition-all text-sm disabled:opacity-50">
              {saving ? 'Envoi...' : step === 2 ? 'Soumettre la demande' : 'Continuer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
