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
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services-web'] }),
  })

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('practitioner_services')
        .update({ is_active: false })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practitioner-services-web'] }),
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Nouvelle prestation</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">Nom</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="Ex: Consultation initiale"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Durée (min)</label>
                  <input
                    type="number"
                    value={form.duration_min}
                    onChange={e => setForm(f => ({ ...f, duration_min: parseInt(e.target.value) || 60 }))}
                    min={15}
                    step={15}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700">Prix (XOF)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    min={0}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">Types de session</label>
                <div className="flex gap-2 flex-wrap">
                  {(['video', 'audio', 'presentiel'] as SessionType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        form.session_types.includes(type)
                          ? 'bg-[#006685] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">{SESSION_TYPE_ICONS[type]}</span>
                      {SESSION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={createService.isPending}
                  className="flex-1 bg-[#006685] text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-[#005470] transition disabled:opacity-50"
                >
                  {createService.isPending ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
