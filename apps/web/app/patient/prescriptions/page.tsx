'use client'

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-symbols-outlined" style={{ fontSize: `${size}px`, color, lineHeight: 1 }}>{name}</span>
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

interface Rx {
  id: string
  diagnosis: string | null
  status: string
  created_at: string
  practitioner_name: string
  medications_count: number
  document_type: 'ordonnance' | 'recommandation'
}

function statusInfo(s: string) {
  if (s === 'signed')    return { label: 'Signée',    bg: '#e5eeff', color: '#82d8ff' }
  if (s === 'dispensed') return { label: 'Délivrée',  bg: '#dcfce7', color: '#1d7a3a' }
  if (s === 'cancelled') return { label: 'Annulée',   bg: '#ffdad6', color: '#ba1a1a' }
  return { label: 'Brouillon', bg: '#f1f5f9', color: '#475569' }
}

export default function PatientPrescriptionsPage() {
  const { data: prescriptions = [], isLoading } = useQuery<Rx[]>({
    queryKey: ['patient-prescriptions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id, diagnosis, status, created_at, medications, document_type,
          practitioner:practitioner_id ( user:user_id ( full_name ) )
        `)
        .eq('patient_id', user.id)
        .in('status', ['signed', 'dispensed'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map(r => {
        const pract = r.practitioner as unknown as { user: { full_name: string } }
        const meds = Array.isArray(r.medications) ? r.medications : []
        const docType = (r.document_type as string) === 'recommandation' ? 'recommandation' : 'ordonnance'
        return {
          id: r.id,
          diagnosis: r.diagnosis,
          status: r.status,
          created_at: r.created_at,
          practitioner_name: pract?.user?.full_name ?? 'Médecin',
          medications_count: meds.length,
          document_type: docType as 'ordonnance' | 'recommandation',
        }
      })
    },
    staleTime: 2 * 60 * 1000,
  })

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-[#0b1c30] tracking-tight">Mes documents médicaux</h1>
        <p className="text-sm text-slate-500 mt-1">Ordonnances et recommandations de vos praticiens</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-xl" />)}
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-10 text-center">
          <Icon name="receipt_long" size={40} color="#cbd5e1" />
          <p className="mt-3 text-slate-400 text-sm">Aucun document disponible</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(prescriptions as Rx[]).map(rx => {
            const { label, bg, color } = statusInfo(rx.status)
            const isReco = rx.document_type === 'recommandation'
            return (
              <Link key={rx.id} href={`/patient/prescriptions/${rx.id}`}
                className="block bg-white/60 backdrop-blur-sm border border-white/80 rounded-xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: isReco ? '#fef9c3' : '#e5eeff', color: isReco ? '#854d0e' : '#82d8ff' }}>
                        {isReco ? 'Recommandation' : 'Ordonnance'}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{label}</span>
                      <span className="text-xs text-slate-400">{fmt(rx.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#0b1c30]">
                      {isReco ? rx.practitioner_name : (rx.practitioner_name.startsWith('Dr') ? rx.practitioner_name : `Dr. ${rx.practitioner_name}`)}
                    </p>
                    {rx.diagnosis && <p className="text-xs text-slate-500 mt-0.5 truncate">{rx.diagnosis}</p>}
                    {!isReco && <p className="text-xs text-slate-400 mt-0.5">{rx.medications_count} médicament{rx.medications_count > 1 ? 's' : ''}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#82d8ff] bg-[#e5eeff] flex-shrink-0">
                    <Icon name="visibility" size={14} color="#82d8ff" />
                    Voir
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
