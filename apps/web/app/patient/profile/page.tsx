'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']
const COMMON_ALLERGIES = ['Pénicilline', 'Aspirine', 'Ibuprofène', 'Latex', 'Arachides', 'Fruits de mer', 'Gluten', 'Lactose', 'Pollen', 'Poussière']
const CHRONIC_CONDITIONS = ['Diabète', 'Hypertension', 'Asthme', 'Dépression', 'Anxiété', 'Épilepsie', 'Migraine', 'Arthrite', 'Thyroïde']

function useProfile() {
  return useQuery({
    queryKey: ['patient-full-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const [{ data: profile }, { data: med }] = await Promise.all([
        supabase.from('users').select('full_name, phone, country, language').eq('id', user.id).single(),
        supabase.from('patient_medical_profiles').select('*').eq('patient_id', user.id).maybeSingle(),
      ])
      return { user, profile, med }
    },
  })
}

export default function PatientProfilePage() {
  const { data, isLoading } = useProfile()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<'personal' | 'medical' | 'emergency'>('personal')
  const [saved, setSaved] = useState(false)

  // Personal
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('SN')
  const [language, setLanguage] = useState('fr')

  // Medical
  const [bloodType, setBloodType] = useState('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [customAllergy, setCustomAllergy] = useState('')
  const [conditions, setConditions] = useState<string[]>([])
  const [medications, setMedications] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [notes, setNotes] = useState('')

  // Emergency
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')

  useEffect(() => {
    if (!data) return
    const { profile, med } = data
    if (profile) {
      setFullName(profile.full_name ?? '')
      setPhone(profile.phone ?? '')
      setCountry(profile.country ?? 'SN')
      setLanguage(profile.language ?? 'fr')
    }
    if (med) {
      setBloodType(med.blood_type ?? '')
      setAllergies(med.allergies ?? [])
      setConditions(med.chronic_conditions ?? [])
      setMedications(med.current_medications ?? '')
      setHeightCm(med.height_cm ? String(med.height_cm) : '')
      setWeightKg(med.weight_kg ? String(med.weight_kg) : '')
      setEmergencyName(med.emergency_contact_name ?? '')
      setEmergencyPhone(med.emergency_contact_phone ?? '')
      setNotes(med.notes ?? '')
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const userId = data?.user.id
      if (!userId) throw new Error('Non connecté')

      await supabase.from('users').update({ full_name: fullName, phone: phone || null, country, language }).eq('id', userId)

      await supabase.from('patient_medical_profiles').upsert({
        patient_id: userId,
        blood_type: bloodType || null,
        allergies,
        chronic_conditions: conditions,
        current_medications: medications || null,
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
  ]

  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'P'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Mon profil</h1>
          <p className="text-sm text-[#6f787e] mt-1">Gérez vos informations personnelles et médicales</p>
        </div>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50"
          style={{ backgroundColor: saved ? '#1d7a3a' : '#006685' }}
        >
          <Icon name={saved ? 'check' : 'save'} size={18} color="#fff" />
          {saveMutation.isPending ? 'Sauvegarde...' : saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* Avatar + nom */}
      <div className="rounded-2xl p-6 flex items-center gap-5" style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)' }}>
        <div className="w-16 h-16 rounded-full bg-[#006685] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold text-[#0b1c30]">{fullName || '—'}</p>
          <p className="text-sm text-[#6f787e]">Compte patient · {country}</p>
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

        {/* TAB — Informations personnelles */}
        {tab === 'personal' && (
          <div className="space-y-4">
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
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Pays</label>
                <select value={country} onChange={e => setCountry(e.target.value)}
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all">
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
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all">
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
                    style={{ backgroundColor: bloodType === bt ? '#006685' : '#e5eeff', color: bloodType === bt ? '#fff' : '#006685' }}>
                    {bt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Taille (cm)</label>
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Poids (kg)</label>
                <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all" />
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
                  className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#006685] transition-all" />
                <button type="button" onClick={addCustomAllergy} className="px-3 py-2 rounded-xl" style={{ backgroundColor: '#006685' }}>
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
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Maladies chroniques</label>
              <div className="flex flex-wrap gap-2">
                {CHRONIC_CONDITIONS.map(c => (
                  <button key={c} type="button" onClick={() => setConditions(toggle(conditions, c))}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{ backgroundColor: conditions.includes(c) ? '#fff8e1' : '#f8f9ff', color: conditions.includes(c) ? '#705d00' : '#6f787e', border: `1px solid ${conditions.includes(c) ? '#705d00' : '#bec8ce'}` }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Médicaments actuels</label>
              <textarea value={medications} onChange={e => setMedications(e.target.value)} rows={2} placeholder="Ex: Sertraline 50mg..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all resize-none" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Notes médicales</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Antécédents, informations importantes pour votre praticien..."
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all resize-none" />
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
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Numéro de téléphone</label>
              <input type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+221 77 000 00 00"
                className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#006685] transition-all" />
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
