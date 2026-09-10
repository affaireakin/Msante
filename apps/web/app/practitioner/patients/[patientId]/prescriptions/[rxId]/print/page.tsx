'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getSignedPractitionerAssetUrl } from '@/lib/practitionerAssetUrl'

interface Medication { name: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }
interface RxData {
  medications: Medication[]
  instructions: string | null
  valid_until: string | null
  status: string
  created_at: string
  patient_name: string
  practitioner_name: string
  practitioner_title: string
  practitioner_speciality: string
  registration_number: string
  clinic_address: string
  practitioner_phone: string
  signature_url: string | null
  stamp_url: string | null
}

export default function PrescriptionPrintPage() {
  const { rxId } = useParams<{ rxId: string }>()
  const [data, setData] = useState<RxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: rx, error: rxErr } = await supabase
        .from('prescriptions')
        .select(`
          medications, instructions, valid_until, status, created_at,
          patient:patient_id ( full_name ),
          practitioner:practitioner_id (
            speciality, professional_title, registration_number, clinic_address, signature_url, stamp_url,
            pract_user:user_id ( full_name, phone )
          )
        `)
        .eq('id', rxId)
        .single()

      if (rxErr || !rx) { setError('Ordonnance introuvable.'); setLoading(false); return }

      const p = rx.practitioner as unknown as {
        speciality: string; professional_title: string | null; registration_number: string | null
        clinic_address: string | null; signature_url: string | null; stamp_url: string | null
        pract_user: { full_name: string; phone: string | null }
      }
      const patient = rx.patient as unknown as { full_name: string }

      setData({
        medications: (rx.medications as Medication[]) ?? [],
        instructions: rx.instructions,
        valid_until: rx.valid_until,
        status: rx.status,
        created_at: rx.created_at,
        patient_name: patient?.full_name ?? 'Patient',
        practitioner_name: p?.pract_user?.full_name ?? 'Praticien',
        practitioner_title: p?.professional_title ?? '',
        practitioner_speciality: p?.speciality ?? '',
        registration_number: p?.registration_number ?? '',
        clinic_address: p?.clinic_address ?? '',
        practitioner_phone: p?.pract_user?.phone ?? '',
        // Bucket privé : la valeur en base est un chemin, à signer pour l'afficher.
        signature_url: await getSignedPractitionerAssetUrl(p?.signature_url ?? null),
        stamp_url: await getSignedPractitionerAssetUrl(p?.stamp_url ?? null),
      })
      setLoading(false)
    }
    void load()
  }, [rxId])

  if (loading) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#82d8ff] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (error || !data) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 text-center shadow-lg max-w-sm">
        <p className="text-[#ba1a1a] font-semibold">{error ?? 'Erreur'}</p>
      </div>
    </div>
  )

  const dateConsult = new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  const validStr = data.valid_until ? new Date(data.valid_until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const fullTitle = data.practitioner_title ? `${data.practitioner_title} ${data.practitioner_name}` : data.practitioner_name

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .rx-page { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: 100% !important; }
          @page { margin: 0; size: A4; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200 px-6 py-3 flex items-center justify-between font-[Manrope]">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#82d8ff] transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Retour
          </button>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-500 font-medium">Ordonnance — {data.patient_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {data.status === 'draft' && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
              Brouillon — non signé
            </span>
          )}
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl hover:bg-[#5ab8e0] transition-colors shadow-[0_2px_8px_rgba(0,102,133,0.25)]">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>print</span>
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Document A4 */}
      <div className="min-h-screen bg-slate-100 pt-20 pb-12 px-4 font-[Manrope]">
        <div className="rx-page bg-white max-w-[700px] mx-auto rounded-lg shadow-2xl overflow-hidden" style={{ minHeight: '990px' }}>
          <div className="flex">
            {/* Barre latérale bleue */}
            <div className="w-2 bg-[#82d8ff] flex-shrink-0" />
            <div className="flex-1 p-10">

              {/* En-tête praticien */}
              <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-[#e5eeff]">
                <div>
                  <p className="text-xl font-black text-[#0b1c30] leading-tight">{fullTitle}</p>
                  <p className="text-sm font-semibold text-[#82d8ff] mt-1">{data.practitioner_speciality}</p>
                  {data.registration_number && <p className="text-xs text-[#6f787e] mt-1">N° Ordre : {data.registration_number}</p>}
                  {data.clinic_address && <p className="text-xs text-[#6f787e]">{data.clinic_address}</p>}
                  {data.practitioner_phone && <p className="text-xs text-[#6f787e]">Tél : {data.practitioner_phone}</p>}
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 bg-[#e5eeff] px-3 py-1 rounded-full mb-2">
                    <span className="text-[10px] font-bold text-[#82d8ff] uppercase tracking-wide">M-Santé</span>
                  </div>
                  <p className="text-sm text-[#6f787e] whitespace-nowrap">Dakar, le {dateConsult}</p>
                </div>
              </div>

              {/* Titre */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-black tracking-widest text-[#0b1c30] uppercase border-b-2 border-[#82d8ff] pb-2 inline-block">
                  ORDONNANCE
                </h1>
              </div>

              {/* Patient */}
              <div className="mb-6 bg-[#f8f9ff] rounded-xl px-5 py-3">
                <p className="text-[10px] font-bold text-[#6f787e] uppercase tracking-widest mb-0.5">Patient</p>
                <p className="text-base font-bold text-[#0b1c30]">{data.patient_name}</p>
              </div>

              {/* Le diagnostic n'apparaît volontairement pas sur ce document : c'est
                  une donnée confidentielle qui n'a pas sa place sur une ordonnance
                  remise au patient/à la pharmacie. */}

              {/* Médicaments */}
              <div className="mb-6 space-y-4">
                {data.medications.map((med, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[#82d8ff] font-black text-base leading-tight mt-0.5">{i + 1}.</span>
                    <div>
                      <p className="text-sm font-bold text-[#0b1c30]">{med.name}{med.dosage ? ` ${med.dosage}` : ''}</p>
                      {med.frequency && <p className="text-sm text-[#3f484d]">{med.frequency}</p>}
                      {med.duration && <p className="text-sm text-[#6f787e]">{med.duration}</p>}
                      {med.instructions && <p className="text-xs text-[#6f787e] italic mt-0.5">{med.instructions}</p>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Instructions générales */}
              {data.instructions && (
                <div className="mb-6 bg-[#eff4ff] rounded-xl px-5 py-3">
                  <p className="text-[10px] font-bold text-[#6f787e] uppercase tracking-widest mb-1">Instructions</p>
                  <p className="text-sm text-[#0b1c30]">{data.instructions}</p>
                </div>
              )}

              {/* Validité */}
              {validStr && (
                <p className="text-xs text-[#6f787e] mb-6">Valable jusqu&apos;au : <strong>{validStr}</strong></p>
              )}

              {/* Signature & Cachet */}
              <div className="flex justify-between items-end mt-16 pt-8 border-t border-[#e5eeff]">
                <div className="w-36 h-36 flex items-center justify-center">
                  {data.stamp_url ? (
                    <img src={data.stamp_url} alt="cachet" className="max-w-full max-h-full object-contain opacity-85" />
                  ) : (
                    <div className="w-32 h-32 rounded-full border-2 border-dashed border-[#bec8ce] flex items-center justify-center">
                      <p className="text-[10px] text-[#bec8ce] text-center leading-tight">Cachet<br />praticien</p>
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="w-52 h-20 flex items-end justify-end mb-2">
                    {data.signature_url ? (
                      <img src={data.signature_url} alt="signature" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-full h-full border-b-2 border-[#0b1c30]/20" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#0b1c30]">{fullTitle}</p>
                  <p className="text-xs text-[#6f787e]">{data.practitioner_speciality}</p>
                </div>
              </div>

              {/* Pied de page */}
              <div className="mt-10 pt-4 border-t border-[#e5eeff]">
                <p className="text-[10px] text-[#bec8ce] text-center">
                  Document généré via M-Santé · Plateforme de santé numérique
                  {data.status === 'draft' ? ' · BROUILLON — non validé cliniquement' : ' · Document signé électroniquement'}
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
