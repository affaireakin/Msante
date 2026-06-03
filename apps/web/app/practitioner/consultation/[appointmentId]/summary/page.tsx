'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/consultation'

type UploadProgress = 'idle' | 'uploading' | 'done' | 'error'
type DocType = 'prescription' | 'report' | 'appreciation' | 'certificate'

const DOC_TYPE_LABELS: Record<DocType, string> = {
  prescription: 'Ordonnance',
  report: 'Compte-rendu de séance',
  appreciation: 'Appréciation / Avis professionnel',
  certificate: 'Certificat médical',
}

export default function ConsultationSummaryPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()

  const appointmentId = params.appointmentId as string
  const consultationId = searchParams.get('consultationId') ?? ''
  const durationMin = searchParams.get('durationMin') ?? '0'
  const aiSummaryParam = searchParams.get('aiSummary')
    ? decodeURIComponent(searchParams.get('aiSummary')!)
    : null

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [aiSummary, setAiSummary] = useState<string | null>(aiSummaryParam)
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Notes & prescription state
  const [practNotes, setPractNotes] = useState('')
  const [docType, setDocType] = useState<DocType>('prescription')
  const [prescContent, setPrescContent] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [prescSaving, setPrescSaving] = useState(false)
  const [prescSaved, setPrescSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load consultation data from Supabase
  useEffect(() => {
    if (!consultationId) return

    async function loadConsultation() {
      const { data } = await supabase
        .from('consultations')
        .select('chat_history, prescription_url, ai_summary, practitioner_notes, prescription_content, document_type')
        .eq('id', consultationId)
        .single()

      if (data) {
        const history = data.chat_history as ChatMessage[] | null
        if (Array.isArray(history)) setChatHistory(history)
        if (data.prescription_url) setPrescriptionUrl(data.prescription_url as string)
        if (!aiSummaryParam && data.ai_summary) setAiSummary(data.ai_summary as string)
        if (data.practitioner_notes) setPractNotes(data.practitioner_notes as string)
        if (data.prescription_content) setPrescContent(data.prescription_content as string)
        if (data.document_type) setDocType(data.document_type as DocType)
      }
    }

    void loadConsultation()
  }, [consultationId, aiSummaryParam])

  async function saveNotes() {
    if (!consultationId) return
    setNotesSaving(true)
    await supabase.from('consultations').update({ practitioner_notes: practNotes }).eq('id', consultationId)
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 3000)
  }

  async function savePrescription() {
    if (!consultationId || !prescContent.trim()) return
    setPrescSaving(true)
    await supabase.from('consultations').update({
      prescription_content: prescContent,
      document_type: docType,
    }).eq('id', consultationId)
    setPrescSaving(false)
    setPrescSaved(true)
    setTimeout(() => setPrescSaved(false), 3000)
  }

  function openPrescriptionPreview() {
    window.open(`/patient/prescription/${consultationId}`, '_blank')
  }

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf') {
        setUploadError('Seuls les fichiers PDF sont acceptés.')
        return
      }

      setUploadProgress('uploading')
      setUploadError(null)

      const path = `${consultationId}/${consultationId}.pdf`

      const { error: storageError } = await supabase.storage
        .from('prescriptions')
        .upload(path, file, { contentType: 'application/pdf', upsert: true })

      if (storageError) {
        setUploadProgress('error')
        setUploadError(storageError.message)
        return
      }

      const { error: dbError } = await supabase
        .from('consultations')
        .update({ prescription_url: path })
        .eq('id', consultationId)

      if (dbError) {
        setUploadProgress('error')
        setUploadError(dbError.message)
        return
      }

      setPrescriptionUrl(path)
      setUploadProgress('done')
    },
    [consultationId]
  )

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      void handleFileUpload(file)
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      void handleFileUpload(file)
    }
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9ff] to-[#eff4ff] font-[Manrope]">
      {/* Google Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        rel="stylesheet"
      />

      {/* Fixed glassmorphic header */}
      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-sky-100/20 shadow-[0_8px_32px_0_rgba(130,216,255,0.08)]">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#006685] text-3xl select-none">
            medical_services
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#0b1c30] leading-none">
              M-Santé
            </h1>
            <p className="text-xs text-slate-500 font-medium">Clinical Portal</p>
          </div>
          <div className="ml-3 flex items-center gap-1.5 bg-[#e5eeff]/50 border border-[#d3e4fe] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006685] inline-block" />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#006685]">
              Portail Praticien
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            className="p-2 rounded-full hover:bg-sky-50/50 transition-colors"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined text-sky-500 text-2xl select-none">
              notifications
            </span>
          </button>
          <button
            className="p-2 rounded-full hover:bg-sky-50/50 transition-colors"
            aria-label="Compte"
          >
            <span className="material-symbols-outlined text-sky-500 text-2xl select-none">
              account_circle
            </span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="pt-[88px] max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Hero section */}
        <div className="flex items-center gap-4 bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <span
              className="material-symbols-outlined text-emerald-600 text-4xl select-none"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-[#0b1c30]">Consultation terminée</h2>
            <p className="text-sm text-[#6f787e] mt-0.5">Session enregistrée avec succès</p>
          </div>
          <div className="flex-shrink-0 flex flex-col gap-2 items-end">
            <span className="inline-flex items-center gap-1.5 bg-[#eff4ff] text-[#006685] border border-[#d3e4fe] text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm select-none">timer</span>
              {durationMin} min
            </span>
            <span className="inline-flex items-center gap-1.5 bg-[#eff4ff] text-[#006685] border border-[#d3e4fe] text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm select-none">calendar_today</span>
              {todayLabel}
            </span>
          </div>
        </div>

        {/* AI Summary card */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">
              psychology
            </span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Résumé IA</h3>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] bg-sky-50 text-sky-600 border border-sky-100 px-2.5 py-1 rounded-full">
              claude-haiku-4-5
            </span>
          </div>

          {aiSummary ? (
            <p className="text-sm text-[#3f484d] leading-relaxed italic">{aiSummary}</p>
          ) : (
            <p className="text-sm text-[#6f787e] italic">Aucun résumé disponible.</p>
          )}

          <div className="border-t border-[#bec8ce]/40 pt-3 mt-3">
            <p className="text-xs text-[#6f787e]">
              Ce résumé ne remplace pas les conseils de votre médecin.
            </p>
          </div>
        </div>

        {/* Chat transcript card */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">
              chat
            </span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">
              Transcript de session
            </h3>
            <span className="material-symbols-outlined text-[#6f787e] text-xl select-none">
              lock
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
            {chatHistory.length === 0 ? (
              <p className="text-sm text-[#6f787e] text-center py-4">Aucun message</p>
            ) : (
              chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'practitioner' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                      msg.role === 'patient'
                        ? 'bg-[#e5eeff]/50 text-[#0b1c30] rounded-tl-none'
                        : 'bg-[#006685] text-white rounded-tr-none'
                    }`}
                  >
                    <p className="leading-relaxed">{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.role === 'patient' ? 'text-[#6f787e]' : 'text-white/70'
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notes de suivi */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">edit_note</span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Notes de suivi</h3>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full">
              Privé — non visible par le patient
            </span>
          </div>
          <textarea
            value={practNotes}
            onChange={e => setPractNotes(e.target.value)}
            rows={4}
            placeholder="Observations cliniques, points de suivi, objectifs pour la prochaine séance..."
            className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] text-sm focus:outline-none focus:border-[#006685] transition-all resize-none"
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={() => void saveNotes()}
              disabled={notesSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: notesSaved ? '#1d7a3a' : '#006685' }}
            >
              <span className="material-symbols-outlined text-base select-none">{notesSaved ? 'check' : 'save'}</span>
              {notesSaving ? 'Sauvegarde...' : notesSaved ? 'Sauvegardé !' : 'Sauvegarder les notes'}
            </button>
          </div>
        </div>

        {/* Générateur d'ordonnance / document */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">description</span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Document patient</h3>
            {prescSaved && (
              <span className="text-[11px] font-bold uppercase tracking-[0.05em] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full">
                ✓ Enregistré
              </span>
            )}
          </div>

          {/* Document type selector */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(type => (
              <button
                key={type}
                onClick={() => setDocType(type)}
                className="px-3 py-1.5 rounded-full text-xs font-bold transition-all"
                style={{
                  backgroundColor: docType === type ? '#006685' : '#e5eeff',
                  color: docType === type ? '#fff' : '#006685',
                }}
              >
                {DOC_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <textarea
            value={prescContent}
            onChange={e => setPrescContent(e.target.value)}
            rows={6}
            placeholder={docType === 'prescription'
              ? 'Ex : Médicament 500mg — 1 comprimé matin et soir pendant 7 jours...'
              : docType === 'appreciation'
              ? 'Ex : Séance productive. Le patient montre des progrès dans la gestion du stress...'
              : 'Rédigez le contenu du document ici...'}
            className="w-full px-4 py-3 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] text-sm focus:outline-none focus:border-[#006685] transition-all resize-none"
          />

          <div className="flex gap-2 mt-3">
            <button
              onClick={() => void savePrescription()}
              disabled={prescSaving || !prescContent.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: prescSaved ? '#1d7a3a' : '#006685' }}
            >
              <span className="material-symbols-outlined text-base select-none">{prescSaved ? 'check' : 'save'}</span>
              {prescSaving ? 'Sauvegarde...' : prescSaved ? 'Enregistré !' : 'Enregistrer pour le patient'}
            </button>
            {prescSaved && (
              <button
                onClick={openPrescriptionPreview}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border-2 border-[#006685] text-[#006685] hover:bg-[#eff4ff] transition-all"
              >
                <span className="material-symbols-outlined text-base select-none">preview</span>
                Aperçu
              </button>
            )}
          </div>
        </div>

        {/* Prescription upload card */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">
              upload_file
            </span>
            <h3 className="text-base font-semibold text-[#0b1c30]">Ordonnance PDF</h3>
          </div>

          {/* Already uploaded indicator */}
          {prescriptionUrl && (
            <div className="flex items-center gap-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <span
                className="material-symbols-outlined text-emerald-600 text-xl select-none"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <span className="text-sm font-medium text-emerald-700 flex-1">
                Ordonnance disponible
              </span>
              <button
                onClick={() => {
                  setPrescriptionUrl(null)
                  setUploadProgress('idle')
                  setUploadError(null)
                }}
                className="text-xs text-[#006685] font-semibold underline underline-offset-2 hover:text-[#005575] transition-colors"
              >
                Remplacer
              </button>
            </div>
          )}

          {/* Dropzone — hidden when already uploaded and not replacing */}
          {(!prescriptionUrl || uploadProgress === 'idle') && !prescriptionUrl && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                isDragging
                  ? 'border-[#006685] bg-[#eff4ff]/70 scale-[1.01]'
                  : 'border-[#bec8ce] bg-white/40 hover:border-[#006685] hover:bg-[#eff4ff]/50'
              }`}
            >
              {uploadProgress === 'uploading' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#006685] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-[#006685] font-medium">Envoi en cours…</p>
                </div>
              ) : uploadProgress === 'done' ? (
                <div className="flex flex-col items-center gap-2">
                  <span
                    className="material-symbols-outlined text-emerald-600 text-3xl select-none"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                  <p className="text-sm font-semibold text-emerald-700">Ordonnance envoyée</p>
                </div>
              ) : (
                <>
                  <span className="material-symbols-outlined text-3xl text-[#6f787e] select-none mb-3 block">
                    upload_file
                  </span>
                  <p className="text-sm text-[#6f787e] mb-3">
                    Glissez un PDF ici ou{' '}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#006685] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#005575] transition-colors shadow-[0_2px_8px_rgba(0,102,133,0.2)]"
                  >
                    Parcourir
                  </button>
                </>
              )}
            </div>
          )}

          {/* Error message */}
          {uploadError && (
            <p className="mt-3 text-sm text-[#ba1a1a] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base select-none">error</span>
              {uploadError}
            </p>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>

        {/* Actions row */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => router.push(`/practitioner/patients/${appointmentId}`)}
            className="flex-1 py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#005575] transition-colors shadow-[0_4px_16px_rgba(0,102,133,0.2)]"
          >
            <span className="material-symbols-outlined text-xl select-none">folder_shared</span>
            Voir le dossier patient
          </button>
          <button
            onClick={() => router.push('/practitioner/dashboard')}
            className="flex-1 py-3 rounded-xl border-2 border-[#006685] text-[#006685] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#eff4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-xl select-none">dashboard</span>
            Retour au tableau de bord
          </button>
        </div>
      </main>
    </div>
  )
}
