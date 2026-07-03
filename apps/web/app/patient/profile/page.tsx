'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']
const COMMON_ALLERGIES = ['Pénicilline', 'Aspirine', 'Ibuprofène', 'Latex', 'Arachides', 'Fruits de mer', 'Gluten', 'Lactose', 'Pollen', 'Poussière']
const KNOWN_CONDITIONS = ['Diabète', 'Hypertension', 'Asthme', 'Dépression', 'Anxiété', 'Épilepsie', 'Migraine', 'Arthrite', 'Thyroïde']
const DIAL_CODES = [
  { code: '+221', flag: '🇸🇳', label: 'SN' },
  { code: '+225', flag: '🇨🇮', label: 'CI' },
  { code: '+237', flag: '🇨🇲', label: 'CM' },
  { code: '+33',  flag: '🇫🇷', label: 'FR' },
  { code: '+212', flag: '🇲🇦', label: 'MA' },
  { code: '+1',   flag: '🇺🇸', label: 'US' },
]

function useProfile() {
  return useQuery({
    queryKey: ['patient-full-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const [{ data: profile }, { data: med }] = await Promise.all([
        supabase.from('users').select('full_name, phone, country, language, reminder_email, avatar_url').eq('id', user.id).single(),
        supabase.from('patient_medical_profiles').select('*').eq('patient_id', user.id).maybeSingle(),
      ])
      return { user, profile, med }
    },
  })
}

export default function PatientProfilePage() {
  const { data, isLoading } = useProfile()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'personal' | 'medical' | 'emergency' | 'privacy'>('personal')
  const [exportLoading, setExportLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [avatarUrl, setAvatarUrl]       = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Personal
  const [fullName, setFullName]         = useState('')
  const [dialCode, setDialCode]         = useState('+221')
  const [phoneLocal, setPhoneLocal]     = useState('')
  const [country, setCountry]           = useState('SN')
  const [language, setLanguage]         = useState('fr')
  const [reminderEmail, setReminderEmail] = useState('')

  // Medical
  const [bloodType, setBloodType]         = useState('')
  const [allergies, setAllergies]         = useState<string[]>([])
  const [customAllergy, setCustomAllergy] = useState('')
  const [conditions, setConditions]       = useState<string[]>([])
  const [medications, setMedications]     = useState('')
  const [heightCm, setHeightCm]           = useState('')
  const [weightKg, setWeightKg]           = useState('')
  const [priorities, setPriorities]       = useState('')
  const [notes, setNotes]                 = useState('')

  // Emergency
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  useEffect(() => {
    if (!data) return
    const { profile, med } = data
    if (profile) {
      setFullName(profile.full_name ?? '')
      setAvatarUrl((profile as { avatar_url?: string | null }).avatar_url ?? null)
      setReminderEmail(profile.reminder_email ?? '')
      setCountry(profile.country ?? 'SN')
      setLanguage(profile.language ?? 'fr')
      // Split stored phone into dial code + local number
      const storedPhone = profile.phone ?? ''
      const matched = DIAL_CODES.find(d => storedPhone.startsWith(d.code))
      if (matched) { setDialCode(matched.code); setPhoneLocal(storedPhone.slice(matched.code.length).trim()) }
      else setPhoneLocal(storedPhone)
    }
    if (med) {
      setBloodType(med.blood_type ?? '')
      setAllergies(med.allergies ?? [])
      setConditions(med.chronic_conditions ?? [])
      setMedications(med.current_medications ?? '')
      setHeightCm(med.height_cm ? String(med.height_cm) : '')
      setWeightKg(med.weight_kg ? String(med.weight_kg) : '')
      setPriorities(med.current_priorities ?? '')
      setEmergencyName(med.emergency_contact_name ?? '')
      setEmergencyPhone(med.emergency_contact_phone ?? '')
      setNotes(med.notes ?? '')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = data?.user.id
      if (!userId) throw new Error('Non connecté')

      const fullPhone = phoneLocal.trim() ? `${dialCode} ${phoneLocal.trim()}` : null
      await supabase.from('users').update({ full_name: fullName, phone: fullPhone, country, language, reminder_email: reminderEmail || null }).eq('id', userId)

      await supabase.from('patient_medical_profiles').upsert({
        patient_id: userId,
        blood_type: bloodType || null,
        allergies,
        chronic_conditions: conditions,
        current_medications: medications || null,
        current_priorities: priorities || null,
        emergency_contact_name: emergencyName || null,
        emergency_contact_phone: emergencyPhone || null,
        height_cm: heightCm ? parseInt(heightCm) : null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        notes: notes || null,
      }, { onConflict: 'patient_id' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-full-profile'] })
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
      queryClient.invalidateQueries({ queryKey: ['patient-full-profile'] })
    } finally {
      setAvatarUploading(false)
    }
  }

  const toggle = <T,>(arr: T[], item: T): T[] => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const addCustomAllergy = () => {
    const val = customAllergy.trim()
    if (val && !allergies.includes(val)) { setAllergies([...allergies, val]); setCustomAllergy('') }
  }

  if (isLoading) return (
    <div className="space-y-4 max-w-2xl">
      {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-white/40 animate-pulse" />)}
    </div>
  )

  const TABS = [
    { key: 'personal' as const, label: 'Informations', icon: 'person' },
    { key: 'medical' as const, label: 'Profil médical', icon: 'medical_information' },
    { key: 'emergency' as const, label: 'Urgence', icon: 'emergency' },
    { key: 'privacy' as const, label: 'Confidentialité', icon: 'shield' },
  ]

  const handleExportData = async () => {
    setExportLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setExportLoading(false); return }
    const [{ data: profile }, { data: med }, { data: moods }, { data: journals }, { data: appts }] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('patient_medical_profiles').select('*').eq('patient_id', user.id).maybeSingle(),
      supabase.from('mood_entries').select('*').eq('patient_id', user.id).order('entry_date', { ascending: false }),
      supabase.from('journal_entries').select('id, title, content, mood_score, tags, created_at').eq('patient_id', user.id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('id, scheduled_at, status, type, created_at').eq('patient_id', user.id).order('scheduled_at', { ascending: false }),
    ])
    const payload = { exported_at: new Date().toISOString(), profile, medical_profile: med, mood_entries: moods ?? [], journal_entries: journals ?? [], appointments: appts ?? [] }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `m-sante-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setExportLoading(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'SUPPRIMER') { setDeleteError('Tapez SUPPRIMER pour confirmer'); return }
    setDeleteLoading(true); setDeleteError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDeleteLoading(false); return }
    await supabase.from('users').update({ status: 'suspended' } as never).eq('id', user.id)
    await supabase.auth.signOut()
    window.location.href = '/auth/login?deleted=1'
  }

  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mon profil</h1>
          <p className="text-sm text-[#6f787e] mt-1">Gérez vos informations personnelles et médicales</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50 flex-shrink-0"
          style={{ backgroundColor: saved ? '#1d7a3a' : '#82d8ff' }}
        >
          <Icon name={saved ? 'check' : 'save'} size={18} color="#fff" />
          {saveMutation.isPending ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Avatar + nom */}
      <div className="rounded-2xl p-6 flex items-center gap-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={avatarUploading}
          className="relative w-16 h-16 rounded-full flex-shrink-0 group"
          title="Changer la photo de profil"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#82d8ff] flex items-center justify-center text-[#0b1c30] text-2xl font-bold">{initials}</div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {avatarUploading
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Icon name="photo_camera" size={20} color="#fff" />}
          </div>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
        />
        <div>
          <p className="text-lg font-bold text-[#0b1c30]">{fullName || '—'}</p>
          <p className="text-sm text-[#6f787e]">Compte patient · {country}</p>
          <p className="text-xs text-[#6f787e] mt-0.5">Cliquez sur l&apos;avatar pour changer la photo</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/60" style={{ border: '1px solid rgba(255,255,255,0.80)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ backgroundColor: tab === t.key ? '#82d8ff' : 'transparent', color: tab === t.key ? '#fff' : '#6f787e' }}>
            <Icon name={t.icon} size={15} color={tab === t.key ? '#fff' : '#6f787e'} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl p-6 space-y-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>

        {/* TAB — Informations personnelles */}
        {tab === 'personal' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Nom complet</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Téléphone</label>
              <div className="flex gap-2">
                <select value={dialCode} onChange={e => setDialCode(e.target.value)}
                  className="px-3 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all text-sm">
                  {DIAL_CODES.map(d => (
                    <option key={d.code} value={d.code}>{d.flag} {d.code}</option>
                  ))}
                </select>
                <input type="tel" value={phoneLocal} onChange={e => setPhoneLocal(e.target.value)} placeholder="77 000 00 00"
                  className="flex-1 px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Email pour les rappels</label>
              <input type="email" value={reminderEmail} onChange={e => setReminderEmail(e.target.value)} placeholder="rappels@example.com"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
              <p className="text-xs text-[#6f787e]">Laissez vide pour utiliser votre email de connexion</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Pays</label>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all">
                  <option value="SN">🇸🇳 Sénégal</option>
                  <option value="CI">🇨🇮 Côte d&apos;Ivoire</option>
                  <option value="CM">🇨🇲 Cameroun</option>
                  <option value="FR">🇫🇷 France</option>
                  <option value="MA">🇲🇦 Maroc</option>
                  <option value="Other">Autre</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Langue</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all">
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                  <option value="ar">العربية</option>
                  <option value="wo">Wolof</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* TAB — Profil médical */}
        {tab === 'medical' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Groupe sanguin</label>
              <div className="flex flex-wrap gap-2">
                {BLOOD_TYPES.map(bt => (
                  <button key={bt} type="button" onClick={() => setBloodType(bt === bloodType ? '' : bt)}
                    className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                    style={{ backgroundColor: bloodType === bt ? '#82d8ff' : '#e5eeff', color: bloodType === bt ? '#fff' : '#82d8ff' }}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Taille (cm)</label>
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Poids (kg)</label>
                <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Allergies</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map(a => (
                  <button key={a} type="button" onClick={() => setAllergies(toggle(allergies, a))}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: allergies.includes(a) ? '#ffdad6' : '#f8f9ff', color: allergies.includes(a) ? '#ba1a1a' : '#6f787e', border: `1px solid ${allergies.includes(a) ? '#ba1a1a' : '#bec8ce'}` }}>
                    {a}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={customAllergy} onChange={e => setCustomAllergy(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomAllergy())}
                  placeholder="Autre allergie..."
                  className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                <button type="button" onClick={addCustomAllergy} className="px-3 py-2 rounded-xl" style={{ backgroundColor: '#82d8ff' }}>
                  <Icon name="add" size={18} color="#fff" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {allergies.filter(a => !COMMON_ALLERGIES.includes(a)).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}>
                    {a}
                    <button type="button" onClick={() => setAllergies(allergies.filter(x => x !== a))}><Icon name="close" size={11} color="#ba1a1a" /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Maladies connues</label>
              <div className="flex flex-wrap gap-2">
                {KNOWN_CONDITIONS.map((c: string) => (
                  <button key={c} type="button" onClick={() => setConditions(toggle(conditions, c))}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: conditions.includes(c) ? '#fff8e1' : '#f8f9ff', color: conditions.includes(c) ? '#705d00' : '#6f787e', border: `1px solid ${conditions.includes(c) ? '#705d00' : '#bec8ce'}` }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Mes priorités en ce moment</label>
              <textarea value={priorities} onChange={e => setPriorities(e.target.value)} rows={3}
                placeholder="Ex: Gérer mon stress, améliorer mon sommeil, retrouver de l'énergie..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Médicaments actuels</label>
              <textarea value={medications} onChange={e => setMedications(e.target.value)} rows={2} placeholder="Ex: Sertraline 50mg..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Notes médicales</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Antécédents, informations importantes pour votre praticien..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none" />
            </div>
          </div>
        )}

        {/* TAB — Confidentialité & RGPD */}
        {tab === 'privacy' && (
          <div className="space-y-5">
            {/* Export */}
            <div className="rounded-xl border border-[#bec8ce] p-5 space-y-3">
              <div className="flex items-start gap-3">
                <Icon name="download" color="#82d8ff" size={22} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#0b1c30]">Télécharger mes données</p>
                  <p className="text-xs text-[#6f787e] mt-0.5">Exportez l&apos;ensemble de vos données personnelles et médicales (RGPD art. 15). Fichier JSON incluant profil, humeurs, journal et rendez-vous.</p>
                </div>
              </div>
              <button
                onClick={handleExportData}
                disabled={exportLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#82d8ff] text-[#0b1c30] rounded-xl py-3 text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-[#82d8ff]/20 transition"
              >
                <Icon name="download" size={16} />
                {exportLoading ? 'Préparation...' : 'Exporter mes données'}
              </button>
            </div>

            {/* Infos légales */}
            <div className="rounded-xl bg-[#e5eeff] p-4 space-y-2 text-xs text-[#3f484d]">
              <p className="font-bold text-[#82d8ff]">Vos droits RGPD</p>
              <p>• <strong>Art. 15</strong> — Droit d&apos;accès : télécharger vos données ci-dessus</p>
              <p>• <strong>Art. 16</strong> — Droit de rectification : modifiez vos informations dans l&apos;onglet &quot;Informations&quot;</p>
              <p>• <strong>Art. 17</strong> — Droit à l&apos;effacement : supprimez votre compte ci-dessous</p>
              <p>• <strong>Art. 20</strong> — Portabilité : vos données sont exportées au format JSON standard</p>
              <p className="pt-1">Contact DPO : <span className="font-medium">privacy@m-sante.com</span></p>
            </div>

            {/* Suppression */}
            <div className="rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6]/20 p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Icon name="delete_forever" color="#ba1a1a" size={22} />
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">Supprimer mon compte</p>
                  <p className="text-xs text-[#6f787e] mt-0.5">Cette action est irréversible. Toutes vos données seront supprimées sous 30 jours conformément au RGPD.</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">
                  Tapez <span className="text-[#ba1a1a]">SUPPRIMER</span> pour confirmer
                </label>
                <input
                  value={deleteConfirm}
                  onChange={e => { setDeleteConfirm(e.target.value); setDeleteError(null) }}
                  placeholder="SUPPRIMER"
                  className="mt-1 w-full px-4 py-3 bg-white border border-[#ba1a1a]/40 rounded-xl text-[#0b1c30] placeholder-[#6f787e]/50 focus:outline-none focus:border-[#ba1a1a] transition-all text-sm"
                />
              </div>
              {deleteError && <p className="text-xs text-[#ba1a1a]">{deleteError}</p>}
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirm !== 'SUPPRIMER'}
                className="w-full flex items-center justify-center gap-2 bg-[#ba1a1a] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-40 hover:shadow-lg hover:shadow-[#ba1a1a]/20 transition"
              >
                <Icon name="delete_forever" size={16} />
                {deleteLoading ? 'Suppression...' : 'Supprimer définitivement mon compte'}
              </button>
            </div>
          </div>
        )}

        {/* TAB — Contact d'urgence */}
        {tab === 'emergency' && (
          <div className="space-y-5">
            <div className="bg-[#ffdad6]/40 border border-[#ba1a1a]/20 rounded-xl p-4 flex items-start gap-3">
              <Icon name="emergency" color="#ba1a1a" />
              <div>
                <p className="text-sm font-bold text-[#0b1c30]">Contact d&apos;urgence</p>
                <p className="text-xs text-[#6f787e] mt-0.5">Personne à contacter en cas de situation d&apos;urgence médicale</p>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Nom complet</label>
              <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Prénom Nom"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Numéro de téléphone</label>
              <input type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+221 77 000 00 00"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
            </div>

            <div className="bg-[#f8f9ff] border border-[#bec8ce] rounded-xl p-4 text-xs text-[#6f787e] space-y-1">
              <p className="font-bold text-[#0b1c30]">Ligne d&apos;urgence nationale</p>
              <p>🚑 SAMU Sénégal : <strong>15</strong></p>
              <p>🆘 SOS Amitié : <strong>+221 33 823 8020</strong></p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
