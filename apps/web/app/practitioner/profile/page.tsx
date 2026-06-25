'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const SPECIALITIES = ['Psychologue', 'Psychiatre', 'Thérapeute', 'Coach bien-être', 'Nutritionniste', 'Médecin généraliste', 'Sage-femme', 'Infirmier(e)']
const LANGUAGES = ['Français', 'Wolof', 'Anglais', 'Arabe', 'Diola', 'Mandingue', 'Pulaar']
const DURATIONS = [{ value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '1h' }, { value: 90, label: '1h30' }]
const SESSION_TYPES = [
  { value: 'video', icon: 'videocam', label: 'Vidéo' },
  { value: 'audio', icon: 'mic', label: 'Audio' },
  { value: 'chat', icon: 'chat_bubble', label: 'Chat' },
]

const STATUS_CFG: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  pending:      { bg: '#fff8e1', color: '#705d00', label: 'En attente',    icon: 'hourglass_top' },
  under_review: { bg: '#e5eeff', color: '#006685', label: 'En examen',     icon: 'visibility' },
  approved:     { bg: '#e8f5e9', color: '#1d7a3a', label: 'Approuvé',      icon: 'verified' },
  rejected:     { bg: '#ffdad6', color: '#ba1a1a', label: 'Refusé',        icon: 'cancel' },
}

function usePractitionerProfile() {
  return useQuery({
    queryKey: ['practitioner-full-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const [{ data: profile }, { data: pract }] = await Promise.all([
        supabase.from('users').select('full_name, phone, country, avatar_url').eq('id', user.id).single(),
        supabase.from('practitioners').select('*, verification_documents(*)').eq('user_id', user.id).single(),
      ])
      return { user, profile, pract }
    },
  })
}

export default function PractitionerProfilePage() {
  const { data, isLoading } = usePractitionerProfile()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'profile' | 'practice' | 'documents' | 'signature'>('profile')
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [speciality, setSpeciality] = useState('')
  const [languages, setLanguages] = useState<string[]>(['Français'])
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('XOF')
  const [duration, setDuration] = useState(60)
  const [sessionTypes, setSessionTypes] = useState<string[]>(['video'])
  const [timezone, setTimezone] = useState('Africa/Dakar')
  const [acceptingNewPatients, setAcceptingNewPatients] = useState(true)

  // professional info (for prescription letterhead)
  const [professionalTitle, setProfessionalTitle] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [clinicAddress, setClinicAddress] = useState('')
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [stampUrl, setStampUrl] = useState<string | null>(null)
  const [sigUploading, setSigUploading] = useState<'signature' | 'stamp' | null>(null)
  const signatureRef = useRef<HTMLInputElement>(null)
  const stampRef = useRef<HTMLInputElement>(null)

  // doc upload
  const diplomaRef = useRef<HTMLInputElement>(null)
  const idRef = useRef<HTMLInputElement>(null)
  const licenseRef = useRef<HTMLInputElement>(null)
  const orderRef = useRef<HTMLInputElement>(null)
  const insuranceRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [docError, setDocError] = useState('')

  useEffect(() => {
    if (!data) return
    const { profile, pract } = data
    if (profile) {
      setFullName(profile.full_name ?? '')
      setPhone(profile.phone ?? '')
      setAvatarUrl((profile as { avatar_url?: string | null }).avatar_url ?? null)
    }
    if (pract) {
      setBio(pract.bio ?? '')
      setSpeciality(pract.speciality ?? '')
      setLanguages(pract.languages ?? ['Français'])
      setPrice(pract.session_price ? String(pract.session_price) : '')
      setCurrency(pract.session_currency ?? 'XOF')
      setDuration(pract.session_duration_min ?? 60)
      setTimezone(pract.timezone ?? 'Africa/Dakar')
      setAcceptingNewPatients((pract as unknown as Record<string, boolean>).accepting_new_patients ?? true)
      setProfessionalTitle((pract as unknown as Record<string, string>).professional_title ?? '')
      setRegistrationNumber((pract as unknown as Record<string, string>).registration_number ?? '')
      setClinicAddress((pract as unknown as Record<string, string>).clinic_address ?? '')
      setSignatureUrl((pract as unknown as Record<string, string | null>).signature_url ?? null)
      setStampUrl((pract as unknown as Record<string, string | null>).stamp_url ?? null)
    }
  }, [data])

  const toggle = <T,>(arr: T[], item: T): T[] => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = data?.user.id
      const practId = data?.pract?.id
      if (!userId || !practId) throw new Error('Non connecté')

      await supabase.from('users').update({ full_name: fullName, phone: phone || null }).eq('id', userId)
      await supabase.from('practitioners').update({
        bio, speciality, languages,
        session_price: parseFloat(price) || null,
        session_currency: currency,
        session_duration_min: duration,
        timezone,
        accepting_new_patients: acceptingNewPatients,
        professional_title: professionalTitle || null,
        registration_number: registrationNumber || null,
        clinic_address: clinicAddress || null,
      }).eq('id', practId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['practitioner-full-profile'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleAvatarUpload = async (file: File) => {
    const userId = data?.user.id
    if (!userId) return
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', userId)
      setAvatarUrl(publicUrl)
      queryClient.invalidateQueries({ queryKey: ['practitioner-full-profile'] })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSigUpload = async (file: File, kind: 'signature' | 'stamp') => {
    const userId = data?.user.id
    const practId = data?.pract?.id
    if (!userId || !practId) return
    setSigUploading(kind)
    try {
      const ext = file.name.split('.').pop() ?? 'png'
      const path = `${userId}/${kind}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('practitioners').update(
        kind === 'signature' ? { signature_url: publicUrl } : { stamp_url: publicUrl }
      ).eq('id', practId)
      if (kind === 'signature') setSignatureUrl(publicUrl)
      else setStampUrl(publicUrl)
      queryClient.invalidateQueries({ queryKey: ['practitioner-full-profile'] })
    } finally {
      setSigUploading(null)
    }
  }

  const uploadDoc = async (file: File, type: 'diploma' | 'id_card' | 'license' | 'order_certificate' | 'professional_insurance') => {
    const practId = data?.pract?.id
    const userId = data?.user.id
    if (!practId || !userId) return
    if (file.size > 10 * 1024 * 1024) { setDocError('Fichier trop volumineux (max 10 Mo)'); return }
    setDocError('')
    setUploading(type)
    try {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${type}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      await supabase.from('verification_documents').insert({ practitioner_id: practId, document_type: type, file_url: publicUrl, status: 'pending' })
      queryClient.invalidateQueries({ queryKey: ['practitioner-full-profile'] })
    } catch {
      setDocError('Erreur lors du téléchargement. Réessayez.')
    } finally {
      setUploading(null)
    }
  }

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      {[1, 2].map(i => <div key={i} className="h-32 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  const { profile, pract } = data ?? {}
  const statusCfg = STATUS_CFG[pract?.verification_status ?? 'pending']
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P'
  const docs: any[] = pract?.verification_documents ?? []

  const TABS = [
    { key: 'profile' as const, label: 'Profil', icon: 'person' },
    { key: 'practice' as const, label: 'Pratique', icon: 'medical_services' },
    { key: 'documents' as const, label: 'Documents', icon: 'description' },
    { key: 'signature' as const, label: 'Signature', icon: 'draw' },
  ]

  const DOC_LABELS: Record<string, string> = {
    diploma: 'Diplôme universitaire',
    id_card: "Carte nationale d'identité",
    license: "Licence d'exercice / Autorisation",
    order_certificate: "Attestation Ordre professionnel",
    professional_insurance: "Assurance RC professionnelle",
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mon profil</h1>
          <p className="text-sm text-[#6f787e] mt-1">Vos informations sont visibles par les patients</p>
        </div>
        {tab !== 'documents' && (
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 flex-shrink-0"
            style={{ backgroundColor: saved ? '#1d7a3a' : '#006685' }}>
            <Icon name={saved ? 'check' : 'save'} size={18} color="#fff" />
            {saveMutation.isPending ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        )}
      </div>

      {/* Header card */}
      <div className="rounded-2xl p-6 flex items-center gap-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            disabled={avatarUploading}
            className="relative w-16 h-16 rounded-full group"
            title="Photo obligatoire — cliquez pour modifier"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#006685] flex items-center justify-center text-white text-2xl font-bold">{initials}</div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              {avatarUploading
                ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : <Icon name="photo_camera" size={20} color="#fff" />}
            </div>
          </button>
          {!avatarUrl && (
            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center" title="Photo obligatoire">
              <span className="text-white text-[10px] font-bold">!</span>
            </span>
          )}
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-[#0b1c30]">{fullName || '—'}</p>
          <p className="text-sm text-[#6f787e]">{speciality || 'Praticien'}</p>
          {!avatarUrl && <p className="text-xs text-red-500 font-semibold mt-0.5">Photo de profil requise</p>}
          {pract?.rating && <p className="text-xs text-[#705d00] font-semibold mt-0.5">★ {pract.rating}/5 · {pract.total_reviews} avis</p>}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0" style={{ backgroundColor: statusCfg.bg, color: statusCfg.color }}>
          <Icon name={statusCfg.icon} size={14} color={statusCfg.color} />
          {statusCfg.label}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/60" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ backgroundColor: tab === t.key ? '#006685' : 'transparent', color: tab === t.key ? '#fff' : '#6f787e' }}>
            <Icon name={t.icon} size={15} color={tab === t.key ? '#fff' : '#6f787e'} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>

        {/* TAB — Profil */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Nom complet</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Téléphone</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Spécialité</label>
              <select value={speciality} onChange={e => setSpeciality(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all">
                <option value="">Sélectionnez</option>
                {SPECIALITIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Biographie</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} rows={4} maxLength={500}
                placeholder="Expérience, approche thérapeutique, domaines d'expertise..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all resize-none" />
              <span className="text-xs text-[#6f787e] text-right">{bio.length}/500</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Langues parlées</label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <button key={lang} type="button" onClick={() => setLanguages(toggle(languages, lang))}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{ backgroundColor: languages.includes(lang) ? '#006685' : '#e5eeff', color: languages.includes(lang) ? '#fff' : '#006685' }}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB — Pratique */}
        {tab === 'practice' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Tarif par séance</label>
              <div className="flex gap-2">
                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15000" min="0"
                  className="flex-1 px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all" />
                <select value={currency} onChange={e => setCurrency(e.target.value)}
                  className="px-3 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all">
                  <option>XOF</option><option>EUR</option><option>USD</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Durée des séances</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {DURATIONS.map(d => (
                  <button key={d.value} type="button" onClick={() => setDuration(d.value)}
                    className="py-2.5 rounded-xl text-sm font-bold transition-all"
                    style={{ backgroundColor: duration === d.value ? '#006685' : '#e5eeff', color: duration === d.value ? '#fff' : '#006685' }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Types de consultation</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {SESSION_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setSessionTypes(toggle(sessionTypes, t.value))}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all border-2"
                    style={{ backgroundColor: sessionTypes.includes(t.value) ? '#e5eeff' : '#f8f9ff', borderColor: sessionTypes.includes(t.value) ? '#006685' : '#bec8ce' }}>
                    <Icon name={t.icon} color={sessionTypes.includes(t.value) ? '#006685' : '#6f787e'} />
                    <span className="text-xs font-bold" style={{ color: sessionTypes.includes(t.value) ? '#006685' : '#6f787e' }}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Fuseau horaire</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all">
                <option value="Africa/Dakar">Dakar (GMT+0)</option>
                <option value="Africa/Abidjan">Abidjan (GMT+0)</option>
                <option value="Africa/Douala">Douala (GMT+1)</option>
                <option value="Europe/Paris">Paris (GMT+1/+2)</option>
              </select>
            </div>

            {/* Acceptation nouveaux patients */}
            <div className={`flex items-center justify-between gap-4 px-4 py-4 rounded-xl border-2 transition-colors ${acceptingNewPatients ? 'border-[#006685] bg-[#e5eeff]/50' : 'border-[#ba1a1a] bg-[#ffdad6]/30'}`}>
              <div>
                <p className="text-sm font-bold text-[#0b1c30]">Accepter de nouveaux patients</p>
                <p className="text-xs text-[#6f787e] mt-0.5">
                  {acceptingNewPatients
                    ? 'Votre profil est visible dans les résultats de recherche.'
                    : 'Votre profil est masqué des nouvelles recherches. Vos patients existants restent actifs.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAcceptingNewPatients(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${acceptingNewPatients ? 'bg-[#006685]' : 'bg-[#ba1a1a]'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${acceptingNewPatients ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {/* TAB — Documents */}
        {tab === 'documents' && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-[#0b1c30]">Documents de vérification</p>
              <p className="text-xs text-[#6f787e] mt-0.5">Ajoutez ou remplacez vos documents. Chaque soumission passe en révision.</p>
            </div>

            {/* Existing docs */}
            {docs.length > 0 && (
              <div className="space-y-2">
                {docs.map((doc: any) => {
                  const docStatus = STATUS_CFG[doc.status] ?? STATUS_CFG.pending
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8f9ff] border border-[#bec8ce]">
                      <Icon name="description" color="#006685" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0b1c30]">{DOC_LABELS[doc.document_type] ?? doc.document_type}</p>
                        <p className="text-xs text-[#6f787e]">{new Date(doc.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0" style={{ backgroundColor: docStatus.bg, color: docStatus.color }}>
                        <Icon name={docStatus.icon} size={12} color={docStatus.color} />
                        {docStatus.label}
                      </span>
                      <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-[#6f787e] hover:text-[#006685] transition-colors">
                        <Icon name="open_in_new" size={16} />
                      </a>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Upload zones */}
            <div className="space-y-3">
              {[
                { type: 'diploma' as const, label: 'Diplôme universitaire', icon: 'school', ref: diplomaRef },
                { type: 'id_card' as const, label: "Carte nationale d'identité", icon: 'badge', ref: idRef },
                { type: 'license' as const, label: "Licence / Autorisation d'exercice", icon: 'verified', ref: licenseRef },
                { type: 'order_certificate' as const, label: 'Attestation Ordre professionnel', icon: 'workspace_premium', ref: orderRef },
                { type: 'professional_insurance' as const, label: 'Assurance RC professionnelle', icon: 'security', ref: insuranceRef },
              ].map(({ type, label, icon, ref }) => (
                <div key={type}>
                  <div onClick={() => ref.current?.click()}
                    className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:border-[#006685] hover:bg-[#e5eeff]/20"
                    style={{ borderColor: uploading === type ? '#006685' : '#bec8ce' }}>
                    <div className="w-10 h-10 rounded-xl bg-[#e5eeff] flex items-center justify-center flex-shrink-0">
                      {uploading === type
                        ? <div className="w-5 h-5 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                        : <Icon name={icon} color="#006685" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0b1c30]">{label}</p>
                      <p className="text-xs text-[#6f787e]">PDF, JPG, PNG — max 10 Mo</p>
                    </div>
                    <Icon name="upload" color="#6f787e" size={18} />
                  </div>
                  <input ref={ref} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(f, type) }} />
                </div>
              ))}
            </div>

            {docError && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-[#ba1a1a] flex items-center gap-2">
                <Icon name="error" color="#ba1a1a" size={16} />
                {docError}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700 flex items-start gap-2">
              <Icon name="info" size={14} color="#d97706" />
              <span>Chaque nouveau document soumis repasse en revue. Délai de vérification : 24 à 48h.</span>
            </div>
          </div>
        )}

        {/* TAB — Signature & Cachet */}
        {tab === 'signature' && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-[#0b1c30]">Informations professionnelles</p>
              <p className="text-xs text-[#6f787e] mt-0.5">Apparaissent sur l&apos;en-tête de vos ordonnances et comptes-rendus.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Titre professionnel</label>
                <input value={professionalTitle} onChange={e => setProfessionalTitle(e.target.value)}
                  placeholder="Psychologue Clinicien, Dr., Coach..."
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">N° Ordre / Référence</label>
                <input value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)}
                  placeholder="No. 12345"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Adresse du cabinet</label>
              <input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)}
                placeholder="12 Rue de la Santé, Dakar, Sénégal"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
            </div>

            <div className="border-t border-[#bec8ce]/40 pt-5">
              <p className="text-sm font-semibold text-[#0b1c30] mb-1">Signature &amp; Cachet</p>
              <p className="text-xs text-[#6f787e] mb-4">Images PNG/JPG sur fond transparent recommandé. Apposées sur chaque document.</p>

              <div className="grid grid-cols-2 gap-4">
                {/* Signature */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Signature</label>
                  <div
                    onClick={() => signatureRef.current?.click()}
                    className="h-32 rounded-xl border-2 border-dashed border-[#bec8ce] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#006685] hover:bg-[#e5eeff]/20 transition-all relative overflow-hidden"
                  >
                    {sigUploading === 'signature' ? (
                      <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                    ) : signatureUrl ? (
                      <>
                        <img src={signatureUrl} alt="signature" className="max-h-24 max-w-full object-contain" />
                        <span className="text-[10px] text-[#006685] font-semibold">Cliquer pour remplacer</span>
                      </>
                    ) : (
                      <>
                        <Icon name="draw" color="#6f787e" size={28} />
                        <span className="text-xs text-[#6f787e]">Télécharger la signature</span>
                      </>
                    )}
                  </div>
                  <input ref={signatureRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleSigUpload(f, 'signature') }} />
                </div>

                {/* Stamp/Cachet */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Cachet / Tampon</label>
                  <div
                    onClick={() => stampRef.current?.click()}
                    className="h-32 rounded-xl border-2 border-dashed border-[#bec8ce] flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#006685] hover:bg-[#e5eeff]/20 transition-all relative overflow-hidden"
                  >
                    {sigUploading === 'stamp' ? (
                      <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                    ) : stampUrl ? (
                      <>
                        <img src={stampUrl} alt="cachet" className="max-h-24 max-w-full object-contain" />
                        <span className="text-[10px] text-[#006685] font-semibold">Cliquer pour remplacer</span>
                      </>
                    ) : (
                      <>
                        <Icon name="verified" color="#6f787e" size={28} />
                        <span className="text-xs text-[#6f787e]">Télécharger le cachet</span>
                      </>
                    )}
                  </div>
                  <input ref={stampRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleSigUpload(f, 'stamp') }} />
                </div>
              </div>
            </div>

            <div className="bg-[#e5eeff]/60 border border-[#d3e4fe] rounded-xl px-4 py-3 text-xs text-[#006685] flex items-start gap-2">
              <Icon name="info" size={14} color="#006685" />
              <span>Ces images apparaîtront sur les ordonnances et comptes-rendus que vous générez après chaque consultation. Cliquez <strong>Sauvegarder</strong> pour enregistrer les informations professionnelles.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
