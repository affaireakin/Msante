'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const STEPS = ['Votre profil', 'Votre pratique', 'Documents', 'Confirmation']

const LANGUAGES = ['Français', 'Wolof', 'Anglais', 'Arabe', 'Diola', 'Mandingue', 'Pulaar']
const LANGUAGE_CODE_MAP: Record<string, string> = { fr: 'Français', en: 'Anglais', ar: 'Arabe', wo: 'Wolof' }
// Older rows carry raw codes (DB column default used to be ARRAY['fr']) which never
// match a toggle button above, so they'd sit invisibly in the array forever.
function normalizeLanguages(langs: string[]): string[] {
  return Array.from(new Set(langs.map(l => LANGUAGE_CODE_MAP[l] ?? l)))
}
const DURATIONS = [{ value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '1h' }, { value: 90, label: '1h30' }]
const SESSION_TYPES = [
  { value: 'video', icon: 'videocam', label: 'Vidéo' },
]

interface DocFile { file: File | null; url: string; uploading: boolean; uploaded: boolean }
const emptyDoc = (): DocFile => ({ file: null, url: '', uploading: false, uploaded: false })

export default function PractitionerOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [practitionerId, setPractitionerId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')

  // Step 0 — profil
  const [bio, setBio] = useState('')
  const [languages, setLanguages] = useState<string[]>(['Français'])
  const [speciality, setSpeciality] = useState('')
  const [phone, setPhone] = useState('')
  const [cguAccepted, setCguAccepted] = useState(false)

  // Step 1 — pratique
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('XOF')
  const [duration, setDuration] = useState(60)
  const [sessionTypes] = useState<string[]>(['video'])
  const [timezone, setTimezone] = useState('Africa/Dakar')

  // Step 2 — documents
  const [diploma, setDiploma] = useState<DocFile>(emptyDoc())
  const [idCard, setIdCard] = useState<DocFile>(emptyDoc())
  const [license, setLicense] = useState<DocFile>(emptyDoc())
  const [docError, setDocError] = useState('')

  const diplomaRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const licenseRef = useRef<HTMLInputElement>(null)

  const [specialities, setSpecialities] = useState<string[]>([])

  useEffect(() => {
    supabase.from('profession_permissions').select('profession_label').order('profession_label')
      .then(({ data }) => {
        if (data?.length) setSpecialities(data.map(r => r.profession_label))
      })
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase.from('users').select('full_name, onboarding_completed').eq('id', user.id).single()
      if (profile?.onboarding_completed) { router.push('/practitioner'); return }
      if (profile?.full_name) setFullName(profile.full_name)

      const { data: pract } = await supabase.from('practitioners').select('*').eq('user_id', user.id).single()
      if (pract) {
        setPractitionerId(pract.id)
        if (pract.speciality) setSpeciality(pract.speciality)
        if (pract.bio) setBio(pract.bio)
        if (pract.languages?.length) setLanguages(normalizeLanguages(pract.languages))
        if (pract.session_price) setPrice(String(pract.session_price))
        if (pract.session_currency) setCurrency(pract.session_currency)
        if (pract.session_duration_min) setDuration(pract.session_duration_min)
        if (pract.timezone) setTimezone(pract.timezone)
      }
    })
  }, [router])

  const toggle = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const uploadDoc = async (docState: DocFile, setDoc: (d: DocFile) => void, type: string) => {
    if (!docState.file || !userId) return ''
    setDoc({ ...docState, uploading: true })
    const ext = docState.file.name.split('.').pop()
    const path = `${userId}/${type}_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, docState.file, { upsert: true })
    if (error) { setDoc({ ...docState, uploading: false }); throw error }
    setDoc({ ...docState, url: path, uploading: false, uploaded: true })
    return path
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, setDoc: (d: DocFile) => void) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setDocError('Fichier trop volumineux (max 10 Mo)'); return }
    setDocError('')
    setDoc({ file, url: '', uploading: false, uploaded: false })
  }

  const handleNext = async () => {
    if (step === 0) {
      if (!bio.trim() || !speciality || !phone.trim()) return
      setStep(1)
    } else if (step === 1) {
      if (!price || sessionTypes.length === 0) return
      setStep(2)
    } else if (step === 2) {
      if (!diploma.file || !idCard.file) { setDocError('Le diplôme et la carte d\'identité sont obligatoires'); return }
      setStep(3)
    } else {
      await handleComplete()
    }
  }

  const handleComplete = async () => {
    if (!userId) return
    setSaving(true)
    try {
      const practUpdate = { bio, languages, speciality, session_price: parseFloat(price), session_currency: currency, session_duration_min: duration, timezone }

      let pid = practitionerId
      if (pid) {
        await supabase.from('practitioners').update(practUpdate).eq('id', pid)
      } else {
        const { data } = await supabase.from('practitioners').insert({ user_id: userId, ...practUpdate, verification_status: 'pending' }).select('id').single()
        pid = data?.id ?? null
      }

      if (phone) await supabase.from('users').update({ phone }).eq('id', userId)

      if (pid) {
        const docs: { type: string; docState: DocFile; setDoc: (d: DocFile) => void }[] = [
          { type: 'diploma', docState: diploma, setDoc: setDiploma },
          { type: 'id_card', docState: idCard, setDoc: setIdCard },
          { type: 'license', docState: license, setDoc: setLicense },
        ]
        for (const d of docs) {
          if (d.docState.file) {
            const url = await uploadDoc(d.docState, d.setDoc, d.type)
            if (url) {
              await supabase.from('verification_documents').insert({
                practitioner_id: pid,
                document_type: d.type,
                file_url: url,
                status: 'pending',
              })
            }
          }
        }
      }

      await supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
      router.push('/practitioner')
    } catch {
      setDocError('Erreur lors de la sauvegarde. Réessayez.')
      setSaving(false)
    }
  }

  const DocUploadZone = ({
    label, required, docState, setDoc, inputRef, icon,
  }: {
    label: string; required?: boolean; docState: DocFile
    setDoc: (d: DocFile) => void; inputRef: React.RefObject<HTMLInputElement | null>; icon: string
  }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">
        {label} {required && <span className="text-[#ba1a1a]">*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-4 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#82d8ff] hover:bg-[#e5eeff]/30"
        style={{ borderColor: docState.uploaded ? '#1d7a3a' : docState.file ? '#82d8ff' : '#bec8ce', backgroundColor: docState.uploaded ? '#e8f5e9' : 'transparent' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: docState.uploaded ? '#e8f5e9' : '#e5eeff' }}>
          <Icon name={docState.uploaded ? 'check_circle' : icon} color={docState.uploaded ? '#1d7a3a' : '#82d8ff'} />
        </div>
        <div className="flex-1 min-w-0">
          {docState.file ? (
            <>
              <p className="text-sm font-semibold text-[#0b1c30] truncate">{docState.file.name}</p>
              <p className="text-xs text-[#6f787e]">{(docState.file.size / 1024).toFixed(0)} Ko</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-[#0b1c30]">Cliquez pour sélectionner</p>
              <p className="text-xs text-[#6f787e]">PDF, JPG, PNG — max 10 Mo</p>
            </>
          )}
        </div>
        {docState.file && !docState.uploaded && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); setDoc(emptyDoc()) }}
            className="text-[#6f787e] hover:text-[#ba1a1a] transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => handleFileSelect(e, setDoc)} />
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <span className="text-3xl font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
          <p className="text-xs text-[#6f787e] font-medium mt-1">Configuration de votre profil praticien</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{ backgroundColor: i <= step ? '#82d8ff' : '#e5eeff', color: i <= step ? '#fff' : '#6f787e' }}
                >
                  {i < step ? <Icon name="check" size={14} color="#fff" /> : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: i === step ? '#82d8ff' : '#6f787e' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: i < step ? '#82d8ff' : '#e5eeff' }} />}
            </div>
          ))}
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>

          {/* STEP 0 — Profil */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0b1c30]">Bonjour{fullName ? `, ${fullName.split(' ')[0]}` : ''} 👋</h2>
                <p className="text-sm text-[#6f787e] mt-1">Complétez votre profil pour être visible par les patients</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Spécialité *</label>
                <select value={speciality} onChange={e => setSpeciality(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all">
                  <option value="">Sélectionnez</option>
                  {specialities.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Biographie *</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} maxLength={500}
                  placeholder="Expérience, approche thérapeutique, domaines d'expertise..."
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
                <span className="text-xs text-[#6f787e] text-right">{bio.length}/500</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Téléphone <span className="text-[#ba1a1a]">*</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00" required
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
                <p className="text-xs text-[#6f787e]">Nécessaire pour la vérification de votre compte et les notifications patients</p>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#e5eeff] border border-[#bee9ff]">
                <input type="checkbox" id="cgu" checked={cguAccepted} onChange={e => setCguAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-[#82d8ff] text-[#82d8ff] accent-[#82d8ff] cursor-pointer flex-shrink-0" />
                <label htmlFor="cgu" className="text-sm text-[#0b1c30] cursor-pointer">
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <a href="/cgu" target="_blank" rel="noopener noreferrer" className="font-bold text-[#82d8ff] underline hover:text-[#004d65]">
                    Conditions Générales d&apos;Utilisation
                  </a>{' '}
                  de M-Santé <span className="text-[#ba1a1a]">*</span>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Langues parlées</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button key={lang} type="button" onClick={() => setLanguages(toggle(languages, lang))}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                      style={{ backgroundColor: languages.includes(lang) ? '#82d8ff' : '#e5eeff', color: languages.includes(lang) ? '#fff' : '#82d8ff' }}>
                      {lang}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Pratique */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0b1c30]">Votre pratique</h2>
                <p className="text-sm text-[#6f787e] mt-1">Définissez vos conditions de consultation</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Tarif par séance *</label>
                <div className="flex gap-2">
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15000" min="0"
                    className="flex-1 px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                  <select value={currency} onChange={e => setCurrency(e.target.value)}
                    className="px-3 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all">
                    <option>XOF</option><option>EUR</option><option>USD</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Durée des séances</label>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map(d => (
                    <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                      className="py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{ backgroundColor: duration === d.value ? '#82d8ff' : '#e5eeff', color: duration === d.value ? '#fff' : '#82d8ff' }}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Type de consultation</label>
                <div className="flex items-center gap-2 p-4 rounded-xl border-2" style={{ backgroundColor: '#e5eeff', borderColor: '#82d8ff' }}>
                  <Icon name={SESSION_TYPES[0].icon} color="#82d8ff" />
                  <span className="text-xs font-bold" style={{ color: '#82d8ff' }}>{SESSION_TYPES[0].label}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Fuseau horaire</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all">
                  <option value="Africa/Dakar">Dakar (GMT+0)</option>
                  <option value="Africa/Abidjan">Abidjan (GMT+0)</option>
                  <option value="Africa/Douala">Douala (GMT+1)</option>
                  <option value="Europe/Paris">Paris (GMT+1/+2)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2 — Documents */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0b1c30]">Documents de vérification</h2>
                <p className="text-sm text-[#6f787e] mt-1">Ces documents sont requis pour valider votre identité et vos qualifications</p>
              </div>

              <DocUploadZone label="Diplôme / Certificat" required docState={diploma} setDoc={setDiploma} inputRef={diplomaRef} icon="school" />
              <DocUploadZone label="Carte d'identité nationale" required docState={idCard} setDoc={setIdCard} inputRef={idRef} icon="badge" />
              <DocUploadZone label="Justificatif professionnel" docState={license} setDoc={setLicense} inputRef={licenseRef} icon="verified" />

              {docError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-[#ba1a1a] flex items-center gap-2">
                  <Icon name="error" color="#ba1a1a" size={16} />
                  {docError}
                </div>
              )}

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
                <Icon name="info" size={15} color="#d97706" />
                <span>Vos documents sont chiffrés et ne seront consultés que par notre équipe de vérification. Délai de traitement : 24 à 48h.</span>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirmation */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#e8f5e9] flex items-center justify-center mx-auto mb-3">
                  <Icon name="check_circle" size={32} color="#1d7a3a" />
                </div>
                <h2 className="text-xl font-black text-[#0b1c30]">Tout est prêt !</h2>
                <p className="text-sm text-[#6f787e] mt-1">Résumé de votre profil praticien</p>
              </div>

              <div className="space-y-2">
                {[
                  { icon: 'medical_services', label: 'Spécialité', value: speciality },
                  { icon: 'payments', label: 'Tarif', value: `${parseFloat(price || '0').toLocaleString('fr-FR')} ${currency} / séance` },
                  { icon: 'schedule', label: 'Durée', value: `${duration} min` },
                  { icon: 'language', label: 'Langues', value: languages.join(', ') },
                  { icon: 'description', label: 'Documents', value: `${[diploma.file, idCard.file, license.file].filter(Boolean).length} fichier(s) à envoyer` },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f8f9ff]">
                    <Icon name={row.icon} color="#82d8ff" />
                    <div>
                      <p className="text-xs text-[#6f787e]">{row.label}</p>
                      <p className="text-sm font-semibold text-[#0b1c30]">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {docError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-[#ba1a1a]">{docError}</div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button type="button" onClick={() => step > 0 ? setStep(step - 1) : router.push('/')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#6f787e] hover:bg-slate-100 transition-all">
              <Icon name="arrow_back" />
              {step === 0 ? 'Accueil' : 'Retour'}
            </button>

            <button type="button" onClick={handleNext}
              disabled={saving || (step === 0 && (!bio.trim() || !speciality || !phone.trim() || !cguAccepted)) || (step === 1 && (!price || sessionTypes.length === 0))}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg hover:shadow-sky-500/20 disabled:opacity-50"
              style={{ backgroundColor: '#82d8ff' }}>
              {saving ? 'Envoi en cours...' : step === STEPS.length - 1 ? 'Accéder à mon espace' : 'Suivant'}
              {!saving && <Icon name={step === STEPS.length - 1 ? 'rocket_launch' : 'arrow_forward'} color="#fff" />}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#6f787e] mt-6">Étape {step + 1} sur {STEPS.length} · Vous pourrez compléter votre profil à tout moment</p>
      </div>
    </div>
  )
}
