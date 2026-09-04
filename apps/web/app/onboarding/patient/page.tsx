'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color }}>{name}</span>
}

const STEPS = ['Bienvenue', 'Profil médical', 'Vos besoins', 'C\'est parti !']

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Inconnu']

const COMMON_ALLERGIES = ['Pénicilline', 'Aspirine', 'Ibuprofène', 'Latex', 'Arachides', 'Fruits de mer', 'Gluten', 'Lactose', 'Pollen', 'Poussière']

const CHRONIC_CONDITIONS = ['Diabète', 'Hypertension', 'Asthme', 'Dépression', 'Anxiété', 'Épilepsie', 'Migraine', 'Arthrite', 'Thyroïde']

const GOALS = [
  { value: 'anxiety', icon: 'psychology', label: 'Anxiété & stress' },
  { value: 'depression', icon: 'sentiment_dissatisfied', label: 'Dépression' },
  { value: 'relationships', icon: 'favorite', label: 'Relations' },
  { value: 'sleep', icon: 'bedtime', label: 'Sommeil' },
  { value: 'grief', icon: 'healing', label: 'Deuil & perte' },
  { value: 'self_esteem', icon: 'self_improvement', label: 'Estime de soi' },
  { value: 'work', icon: 'work', label: 'Travail & burnout' },
  { value: 'trauma', icon: 'shield', label: 'Trauma' },
]

export default function PatientOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')

  // Step 0 — bienvenue
  const [phone, setPhone] = useState('')
  const [country, setCountry] = useState('SN')

  // Step 1 — profil médical
  const [bloodType, setBloodType] = useState('')
  const [allergies, setAllergies] = useState<string[]>([])
  const [customAllergy, setCustomAllergy] = useState('')
  const [conditions, setConditions] = useState<string[]>([])
  const [medications, setMedications] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')

  // Step 2 — besoins + urgence
  const [goals, setGoals] = useState<string[]>([])
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [firstTime, setFirstTime] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserId(user.id)
      const { data: profile } = await supabase.from('users').select('full_name, onboarding_completed, phone, country').eq('id', user.id).single()
      if (profile?.onboarding_completed) { router.push('/patient'); return }
      if (profile?.full_name) setFullName(profile.full_name)
      if (profile?.phone) setPhone(profile.phone)
      if (profile?.country) setCountry(profile.country)

      const { data: med } = await supabase.from('patient_medical_profiles').select('*').eq('patient_id', user.id).single()
      if (med) {
        if (med.blood_type) setBloodType(med.blood_type)
        if (med.allergies?.length) setAllergies(med.allergies)
        if (med.chronic_conditions?.length) setConditions(med.chronic_conditions)
        if (med.current_medications) setMedications(med.current_medications)
        if (med.height_cm) setHeightCm(String(med.height_cm))
        if (med.weight_kg) setWeightKg(String(med.weight_kg))
        if (med.emergency_contact_name) setEmergencyName(med.emergency_contact_name)
        if (med.emergency_contact_phone) setEmergencyPhone(med.emergency_contact_phone)
      }
    })
  }, [router])

  const toggle = <T,>(arr: T[], item: T): T[] => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

  const addCustomAllergy = () => {
    const val = customAllergy.trim()
    if (val && !allergies.includes(val)) { setAllergies([...allergies, val]); setCustomAllergy('') }
  }

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else handleComplete()
  }

  const handleComplete = async () => {
    if (!userId) return
    setSaving(true)
    setCompleteError(null)

    const { error: userError } = await supabase.from('users').update({ phone: phone || null, country, onboarding_completed: true }).eq('id', userId)
    if (userError) { setCompleteError('Une erreur est survenue lors de l\'enregistrement de votre profil. Réessayez.'); setSaving(false); return }

    // QA finding: allergies/contact d'urgence are emergency-relevant medical
    // data — a silent write failure here previously still redirected to the
    // dashboard as if everything had been saved.
    const { error: medError } = await supabase.from('patient_medical_profiles').upsert({
      patient_id: userId,
      blood_type: bloodType || null,
      allergies,
      chronic_conditions: conditions,
      current_medications: medications || null,
      emergency_contact_name: emergencyName || null,
      emergency_contact_phone: emergencyPhone || null,
      height_cm: heightCm ? parseInt(heightCm) : null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
    }, { onConflict: 'patient_id' })
    if (medError) { setCompleteError('Une erreur est survenue lors de l\'enregistrement de vos informations médicales. Réessayez.'); setSaving(false); return }

    router.push('/patient')
  }

  const firstName = fullName.split(' ')[0] || 'vous'

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <span className="text-3xl font-black tracking-tighter text-[#0b1c30]">M-Santé</span>
          <p className="text-xs text-[#6f787e] font-medium mt-1">MIND · CARE · CONNECT</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{ backgroundColor: i <= step ? '#82d8ff' : '#e5eeff', color: i <= step ? '#fff' : '#6f787e' }}>
                  {i < step ? <Icon name="check" size={14} color="#fff" /> : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block" style={{ color: i === step ? '#82d8ff' : '#6f787e' }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="flex-1 h-0.5 mx-2" style={{ backgroundColor: i < step ? '#82d8ff' : '#e5eeff' }} />}
            </div>
          ))}
        </div>

        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-8" style={{ boxShadow: '0 20px 60px rgba(0,102,133,0.08)' }}>

          {/* STEP 0 — Bienvenue */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
                  <Icon name="waving_hand" size={28} color="#82d8ff" />
                </div>
                <h2 className="text-2xl font-black text-[#0b1c30]">Bienvenue, {firstName} !</h2>
                <p className="text-sm text-[#6f787e] mt-2">M-Santé vous connecte aux meilleurs professionnels de santé mentale</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Téléphone (optionnel)</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+221 77 000 00 00"
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all" />
              </div>

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

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Avez-vous déjà consulté un professionnel de santé mentale ?</label>
                <div className="flex gap-2">
                  {[{ value: 'yes', label: 'Oui' }, { value: 'no', label: 'Première fois' }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setFirstTime(opt.value)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={{ backgroundColor: firstTime === opt.value ? '#e5eeff' : '#f8f9ff', borderColor: firstTime === opt.value ? '#82d8ff' : '#bec8ce', color: firstTime === opt.value ? '#82d8ff' : '#6f787e' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1 — Profil médical */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0b1c30]">Profil médical</h2>
                <p className="text-sm text-[#6f787e] mt-1">Ces informations aident votre praticien à mieux vous accompagner</p>
              </div>

              {/* Groupe sanguin */}
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

              {/* Taille / Poids */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Taille (cm)</label>
                  <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="170" min="100" max="250"
                    className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Poids (kg)</label>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="70" min="20" max="300"
                    className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                </div>
              </div>

              {/* Allergies */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Allergies connues</label>
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
                    placeholder="Autre allergie..." className="flex-1 px-3 py-2 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                  <button type="button" onClick={addCustomAllergy} className="px-3 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: '#82d8ff' }}>
                    <Icon name="add" size={18} color="#fff" />
                  </button>
                </div>
                {allergies.filter(a => !COMMON_ALLERGIES.includes(a)).map(a => (
                  <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit" style={{ backgroundColor: '#ffdad6', color: '#ba1a1a' }}>
                    {a}
                    <button type="button" onClick={() => setAllergies(allergies.filter(x => x !== a))}><Icon name="close" size={12} color="#ba1a1a" /></button>
                  </span>
                ))}
              </div>

              {/* Maladies chroniques */}
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

              {/* Médicaments */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Médicaments en cours (optionnel)</label>
                <textarea value={medications} onChange={e => setMedications(e.target.value)} rows={2}
                  placeholder="Ex: Sertraline 50mg, Doliprane 1g si besoin..."
                  className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff] transition-all resize-none text-sm" />
              </div>

              <div className="bg-[#e5eeff] border border-[#bee9ff] rounded-xl px-4 py-3 text-xs text-[#005e7a] flex items-start gap-2">
                <Icon name="lock" size={14} color="#82d8ff" />
                <span>Ces données sont chiffrées et accessibles uniquement par vous et votre praticien.</span>
              </div>
            </div>
          )}

          {/* STEP 2 — Vos besoins */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-black text-[#0b1c30]">Vos priorités</h2>
                <p className="text-sm text-[#6f787e] mt-1">Sélectionnez ce qui vous préoccupe (plusieurs choix possibles)</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {GOALS.map(goal => (
                  <button key={goal.value} type="button" onClick={() => setGoals(toggle(goals, goal.value))}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left"
                    style={{ backgroundColor: goals.includes(goal.value) ? '#e5eeff' : '#f8f9ff', borderColor: goals.includes(goal.value) ? '#82d8ff' : '#bec8ce' }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: goals.includes(goal.value) ? '#82d8ff' : '#e5eeff' }}>
                      <Icon name={goal.icon} size={18} color={goals.includes(goal.value) ? '#fff' : '#82d8ff'} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: goals.includes(goal.value) ? '#82d8ff' : '#3f484d' }}>{goal.label}</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Contact d&apos;urgence</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[#6f787e]">Nom</label>
                    <input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} placeholder="Prénom Nom"
                      className="w-full px-3 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-[#6f787e]">Téléphone</label>
                    <input type="tel" value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} placeholder="+221 77 000 00 00"
                      className="w-full px-3 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] focus:outline-none focus:border-[#82d8ff] transition-all" />
                  </div>
                </div>
              </div>

              <div className="bg-[#f8f9ff] border border-[#bec8ce] rounded-xl px-4 py-3 text-xs text-[#6f787e] flex items-start gap-2">
                <Icon name="lock" size={14} />
                <span>Ces informations sont confidentielles. Uniquement partagées avec votre praticien.</span>
              </div>
            </div>
          )}

          {/* STEP 3 — Confirmation */}
          {step === 3 && (
            <div className="space-y-5 text-center">
              <div>
                <div className="w-20 h-20 rounded-full bg-[#e5eeff] flex items-center justify-center mx-auto mb-4">
                  <Icon name="check_circle" size={40} color="#82d8ff" />
                </div>
                <h2 className="text-2xl font-black text-[#0b1c30]">Vous êtes prêt(e) !</h2>
                <p className="text-sm text-[#6f787e] mt-2 max-w-sm mx-auto">
                  Votre profil de santé est configuré. Vous pouvez maintenant trouver un praticien.
                </p>
              </div>

              <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide text-left">Comment ça marche</p>
              <div className="grid grid-cols-3 gap-3 text-left">
                {[
                  { icon: 'search', title: 'Trouver', desc: 'Parcourez nos praticiens' },
                  { icon: 'calendar_today', title: 'Réserver', desc: 'Choisissez un créneau' },
                  { icon: 'videocam', title: 'Consulter', desc: 'Séance sécurisée en ligne' },
                ].map(item => (
                  <div key={item.title} className="rounded-xl p-3 bg-[#e5eeff] flex flex-col items-center text-center gap-1">
                    <Icon name={item.icon} color="#82d8ff" />
                    <p className="text-xs font-bold text-[#0b1c30]">{item.title}</p>
                    <p className="text-xs text-[#6f787e]">{item.desc}</p>
                  </div>
                ))}
              </div>

              {(bloodType || allergies.length > 0 || conditions.length > 0) && (
                <div className="text-left space-y-2 bg-[#f8f9ff] rounded-xl p-4">
                  <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide">Profil médical enregistré</p>
                  {bloodType && <p className="text-sm text-[#0b1c30]">Groupe sanguin : <strong>{bloodType}</strong></p>}
                  {allergies.length > 0 && <p className="text-sm text-[#0b1c30]">Allergies : <strong>{allergies.join(', ')}</strong></p>}
                  {conditions.length > 0 && <p className="text-sm text-[#0b1c30]">Conditions : <strong>{conditions.join(', ')}</strong></p>}
                </div>
              )}

              <p className="text-xs text-[#6f787e]">
                M-Santé ne remplace pas un avis médical urgent.{' '}
                <span className="font-semibold text-[#ba1a1a]">En cas d&apos;urgence, appelez le 15.</span>
              </p>
            </div>
          )}

          {/* Navigation */}
          {completeError && (
            <p className="text-xs text-[#ba1a1a] mt-4 text-center">{completeError}</p>
          )}

          <div className="flex items-center justify-between mt-8">
            <button type="button" onClick={() => step > 0 ? setStep(step - 1) : router.push('/')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#6f787e] hover:bg-slate-100 transition-all">
              <Icon name="arrow_back" />
              {step === 0 ? 'Accueil' : 'Retour'}
            </button>

            <button type="button" onClick={handleNext} disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg disabled:opacity-50"
              style={{ backgroundColor: '#82d8ff' }}>
              {saving ? 'Enregistrement...' : step === STEPS.length - 1 ? 'Découvrir M-Santé' : 'Suivant'}
              {!saving && <Icon name={step === STEPS.length - 1 ? 'rocket_launch' : 'arrow_forward'} color="#fff" />}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[#6f787e] mt-6">
          Étape {step + 1} sur {STEPS.length} · Vous pouvez compléter votre profil à tout moment
        </p>
      </div>
    </div>
  )
}
