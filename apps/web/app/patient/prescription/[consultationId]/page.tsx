'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface PrescriptionData {
  content: string
  documentType: string
  consultationDate: string
  patientName: string
  practitionerName: string
  practitionerTitle: string
  speciality: string
  registrationNumber: string
  clinicAddress: string
  practitionerPhone: string
  signatureUrl: string | null
  stampUrl: string | null
}

const DOC_TITLES: Record<string, string> = {
  prescription: 'ORDONNANCE',
  report: 'COMPTE-RENDU DE SÉANCE',
  appreciation: 'APPRÉCIATION PROFESSIONNELLE',
  certificate: 'CERTIFICAT MÉDICAL',
}

export default function PatientPrescriptionPage() {
  const params = useParams()
  const consultationId = params.consultationId as string
  const [data, setData] = useState<PrescriptionData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setIsLoading(true)

      const { data: consultation, error: cErr } = await supabase
        .from('consultations')
        .select(`
          prescription_content,
          document_type,
          created_at,
          appointments!inner (
            patient_id,
            scheduled_at,
            practitioners!inner (
              speciality,
              professional_title,
              registration_number,
              clinic_address,
              signature_url,
              stamp_url,
              users!user_id ( full_name, phone )
            ),
            users!patient_id ( full_name )
          )
        `)
        .eq('id', consultationId)
        .single()

      if (cErr || !consultation) {
        setError('Document introuvable ou accès non autorisé.')
        setIsLoading(false)
        return
      }

      if (!consultation.prescription_content) {
        setError('Aucun document n\'a encore été émis pour cette consultation.')
        setIsLoading(false)
        return
      }

      const appt = consultation.appointments as unknown as {
        scheduled_at: string
        practitioners: {
          speciality: string
          professional_title: string | null
          registration_number: string | null
          clinic_address: string | null
          signature_url: string | null
          stamp_url: string | null
          users: { full_name: string; phone: string | null }
        }
        users: { full_name: string }
      }

      setData({
        content: consultation.prescription_content,
        documentType: consultation.document_type ?? 'prescription',
        consultationDate: appt.scheduled_at,
        patientName: appt.users?.full_name ?? 'Patient',
        practitionerName: appt.practitioners?.users?.full_name ?? 'Praticien',
        practitionerTitle: appt.practitioners?.professional_title ?? '',
        speciality: appt.practitioners?.speciality ?? '',
        registrationNumber: appt.practitioners?.registration_number ?? '',
        clinicAddress: appt.practitioners?.clinic_address ?? '',
        practitionerPhone: appt.practitioners?.users?.phone ?? '',
        signatureUrl: appt.practitioners?.signature_url ?? null,
        stampUrl: appt.practitioners?.stamp_url ?? null,
      })
      setIsLoading(false)
    }

    void load()
  }, [consultationId])

  const formattedDate = data
    ? new Date(data.consultationDate).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : ''

  const docTitle = data ? (DOC_TITLES[data.documentType] ?? 'DOCUMENT MÉDICAL') : ''

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center font-[Manrope]">
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6 font-[Manrope]">
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-lg">
          <p className="text-[#ba1a1a] font-semibold">{error}</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .prescription-page { box-shadow: none !important; border: none !important; margin: 0 !important; }
        }
      `}</style>

      {/* Print toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-6 py-3 flex items-center justify-between font-[Manrope]">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="M-Santé" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-xs text-[#6f787e]">Document patient</span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2 bg-[#006685] text-white text-sm font-bold rounded-xl hover:bg-[#005575] transition-colors shadow-[0_2px_8px_rgba(0,102,133,0.25)]"
        >
          <span style={{ fontFamily: 'Material Symbols Outlined', fontSize: '18px' }}>print</span>
          Imprimer / Télécharger PDF
        </button>
      </div>

      {/* Prescription document */}
      <div className="min-h-screen bg-slate-100 pt-20 pb-12 px-4 font-[Manrope] no-print-bg">
        <div
          className="prescription-page bg-white max-w-2xl mx-auto rounded-lg shadow-2xl overflow-hidden"
          style={{ minHeight: '842px' }}
        >
          {/* Left accent bar */}
          <div className="flex">
            <div className="w-2 bg-[#006685] flex-shrink-0" />
            <div className="flex-1 p-10">

              {/* Header */}
              <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-[#e5eeff]">
                <div>
                  <p className="text-lg font-black text-[#0b1c30] leading-tight">
                    {data.practitionerTitle ? `${data.practitionerTitle} ` : ''}{data.practitionerName}
                  </p>
                  <p className="text-sm font-semibold text-[#006685] mt-0.5">{data.speciality}</p>
                  {data.registrationNumber && (
                    <p className="text-xs text-[#6f787e] mt-1">N° Ordre : {data.registrationNumber}</p>
                  )}
                  {data.clinicAddress && (
                    <p className="text-xs text-[#6f787e]">{data.clinicAddress}</p>
                  )}
                  {data.practitionerPhone && (
                    <p className="text-xs text-[#6f787e]">Tél : {data.practitionerPhone}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="inline-flex items-center gap-1.5 bg-[#e5eeff] px-3 py-1 rounded-full mb-2">
                    <span className="text-[10px] font-bold text-[#006685] uppercase tracking-wide">M-Santé</span>
                  </div>
                  <p className="text-sm text-[#6f787e]">Dakar, le {formattedDate}</p>
                </div>
              </div>

              {/* Document title */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-black tracking-widest text-[#0b1c30] uppercase border-b-2 border-[#006685] pb-2 inline-block">
                  {docTitle}
                </h1>
              </div>

              {/* Patient info */}
              <div className="mb-6 bg-[#f8f9ff] rounded-xl px-5 py-3">
                <p className="text-xs font-bold text-[#6f787e] uppercase tracking-wide mb-0.5">Patient</p>
                <p className="text-base font-bold text-[#0b1c30]">{data.patientName}</p>
              </div>

              {/* Prescription content */}
              <div className="mb-12 min-h-[200px]">
                <div className="whitespace-pre-wrap text-sm text-[#0b1c30] leading-relaxed">
                  {data.content}
                </div>
              </div>

              {/* Signature & Stamp area */}
              <div className="flex justify-between items-end mt-auto pt-8 border-t border-[#e5eeff]">
                {/* Stamp left */}
                <div className="w-32 h-32 flex items-center justify-center">
                  {data.stampUrl ? (
                    <img src={data.stampUrl} alt="cachet" className="max-w-full max-h-full object-contain opacity-80" />
                  ) : (
                    <div className="w-28 h-28 rounded-full border-2 border-dashed border-[#bec8ce] flex items-center justify-center">
                      <p className="text-[10px] text-[#bec8ce] text-center leading-tight">Cachet<br/>praticien</p>
                    </div>
                  )}
                </div>

                {/* Signature right */}
                <div className="text-right">
                  <div className="w-48 h-20 flex items-end justify-end mb-2">
                    {data.signatureUrl ? (
                      <img src={data.signatureUrl} alt="signature" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="w-full h-full border-b-2 border-[#0b1c30]/20" />
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#0b1c30]">
                    {data.practitionerTitle ? `${data.practitionerTitle} ` : ''}{data.practitionerName}
                  </p>
                  <p className="text-xs text-[#6f787e]">{data.speciality}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-[#e5eeff]">
                <p className="text-[10px] text-[#bec8ce] text-center">
                  Document généré via M-Santé · Plateforme de santé numérique · Ce document ne remplace pas une consultation en présentiel en cas d&apos;urgence.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
