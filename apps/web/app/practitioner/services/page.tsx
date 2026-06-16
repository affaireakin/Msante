'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type SessionType = 'video' | 'audio' | 'presentiel'

interface PractitionerService {
  id: string
  name: string
  duration_min: number
  price: number | null
  session_types: SessionType[]
  is_active: boolean
}

const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  video: 'Vidéo',
  audio: 'Audio',
  presentiel: 'Présentiel',
}

const SESSION_TYPE_ICONS: Record<SessionType, string> = {
  video: 'videocam',
  audio: 'headset_mic',
  presentiel: 'location_on',
}

const EMPTY_FORM = { name: '', duration_min: 60, price: '', session_types: ['video'] as SessionType[] }

function usePractitionerServicesPage() {
  const qc = useQueryClient()

  const { data: practitioner } = useQuery({
    queryKey: ['current-practitioner'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', user.id).single()
      return data
    },
  })

  const services = useQuery<PractitionerService[]>({
    queryKey: ['practitioner-services-web', practitioner?.id],
    enabled: !!practitioner?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('practitioner_services')
        .select('*')
        .eq('practitioner_id', practitioner!.id)
        .eq('is_active', true)
        .order('created_at')
      return (data ?? []) as PractitionerService[]
    },
  })

  const createService = useMutation({
    mutationFn: async (service: Omit<PractitionerService, 'id' | 'is_active'>) => {
      const { error } = await supabase.from('practitioner_services').insert({
        ...service,
        practitioner_id: practitioner!.id,
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.refetchQueries({ queryKey: ['practitioner-services-web', practitioner?.id] })
    },
  })

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('practitioner_services')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.refetchQueries({ queryKey: ['practitioner-services-web', practitioner?.id] })
    },
  })

  return { services, createService, deleteService }
}

export default function ServicesPage() {
  const { services, createService, deleteService } = usePractitionerServicesPage()
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const toggleType = (type: SessionType) => {
    setForm(f => ({
      ...f,
      session_types: f.session_types.includes(type)
        ? f.session_types.filter(t => t !== type)
        : [...f.session_types, type],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setFormError('Le nom est requis'); return }
    if (form.session_types.length === 0) { setFormError('Sélectionnez au moins un type'); return }
    setFormError(null)
    try {
      await createService.mutateAsync({
        name: form.name.trim(),
        duration_min: form.duration_min,
        price: form.price ? parseFloat(form.price) : null,
        session_types: form.session_types,
      })
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Prestations</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez vos types de consultation et tarifs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-[#006685] text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#005470] transition"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nouvelle prestation
        </button>
      </div>

      {services.isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(services.data ?? []).map(service => (
            <div key={service.id} className="bg-white/60 backdrop-blur-md border border-white/80 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-bold text-slate-900">{service.name}</h3>
                <button
                  onClick={() => deleteService.mutate(service.id)}
                  className="text-slate-300 hover:text-red-400 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">schedule</span>
                  {service.duration_min} min
                </span>
                {service.price && (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">payments</span>
                    {service.price.toLocaleString('fr-FR')} XOF
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {service.session_types.map(type => (
                  <span
                    key={type}
                    className="flex items-center gap-1 bg-sky-50 text-sky-700 text-xs font-semibold px-2.5 py-1 rounded-full"
                  >
                    <span className="material-symbols-outlined text-[14px]">{SESSION_TYPE_ICONS[type]}</span>
                    {SESSION_TYPE_LABELS[type]}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {(services.data ?? []).length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400">
              <span className="material-symbols-outlined text-5xl block mb-3">medical_services</span>
              Aucune prestation configurée
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-7 w-full max-w-md space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-[#0b1c30]">Nouvelle prestation</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">
                  Nom de la prestation <span className="text-[#ba1a1a]">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base text-[#0b1c30] placeholder-slate-400 focus:outline-none focus:border-[#006685] transition-colors"
                  placeholder="Ex : Consultation initiale, Suivi hebdomadaire…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Durée (min) <span className="text-[#ba1a1a]">*</span></label>
                  <input
                    type="number"
                    value={form.duration_min}
                    onChange={e => setForm(f => ({ ...f, duration_min: parseInt(e.target.value) || 60 }))}
                    min={15}
                    step={15}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base text-[#0b1c30] font-semibold focus:outline-none focus:border-[#006685] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#0b1c30] mb-1.5">Prix (XOF)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    min={0}
                    className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-base text-[#0b1c30] font-semibold placeholder-slate-400 focus:outline-none focus:border-[#006685] transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-[#0b1c30] mb-2">
                  Types de session <span className="text-[#ba1a1a]">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {(['video', 'audio', 'presentiel'] as SessionType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${
                        form.session_types.includes(type)
                          ? 'bg-[#006685] text-white border-[#006685]'
                          : 'bg-white text-[#0b1c30] border-slate-300 hover:border-[#006685]'
                      }`}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{SESSION_TYPE_ICONS[type]}</span>
                      {SESSION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <span className="material-symbols-outlined text-[#ba1a1a]" style={{ fontSize: '18px' }}>error</span>
                  <p className="text-sm font-semibold text-[#ba1a1a]">{formError}</p>
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border-2 border-slate-200 text-[#0b1c30] rounded-xl py-3 text-sm font-bold hover:bg-slate-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createService.isPending}
                  className="flex-1 bg-[#006685] text-white rounded-xl py-3 text-sm font-bold hover:bg-[#005470] transition-colors disabled:opacity-50 shadow-[0_4px_12px_rgba(0,102,133,0.25)]"
                >
                  {createService.isPending ? 'Création…' : 'Créer la prestation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
