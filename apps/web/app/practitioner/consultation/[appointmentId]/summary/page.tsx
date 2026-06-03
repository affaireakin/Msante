'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { ChatMessage } from '@/types/consultation'

type DocType = 'prescription' | 'report' | 'appreciation' | 'certificate'

const DOC_TYPE_LABELS: Record<DocType, string> = {
  prescription:  'Ordonnance',
  report:        'Compte-rendu',
  appreciation:  'Appréciation',
  certificate:   'Certificat médical',
}

const DOC_ICONS: Record<DocType, string> = {
  prescription: 'medication',
  report:       'summarize',
  appreciation: 'star',
  certificate:  'verified',
}

const DOC_COLORS: Record<DocType, { bg: string; text: string }> = {
  prescription: { bg: '#e5eeff', text: '#006685' },
  report:       { bg: '#e8f5e9', text: '#1d7a3a' },
  appreciation: { bg: '#fff8e1', text: '#705d00' },
  certificate:  { bg: '#fce4ec', text: '#880e4f' },
}

interface PractDocument {
  id: string
  document_type: DocType
  content: string
  created_at: string
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

  // Notes
  const [practNotes, setPractNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)

  // Documents
  const [documents, setDocuments] = useState<PractDocument[]>([])
  const [newDocType, setNewDocType] = useState<DocType>('prescription')
  const [newDocContent, setNewDocContent] = useState('')
  const [docSaving, setDocSaving] = useState(false)
  const [docSaved, setDocSaved] = useState(false)
  const [showNewForm, setShowNewForm] = useState(true)

  useEffect(() => {
    if (!consultationId) return
    async function load() {
      const [{ data: consult }, { data: docs }] = await Promise.all([
        supabase
          .from('consultations')
          .select('chat_history, ai_summary, practitioner_notes')
          .eq('id', consultationId)
          .single(),
        supabase
          .from('practitioner_documents')
          .select('id, document_type, content, created_at')
          .eq('consultation_id', consultationId)
          .order('created_at', { ascending: false }),
      ])

      if (consult) {
        const history = consult.chat_history as ChatMessage[] | null
        if (Array.isArray(history)) setChatHistory(history)
        if (!aiSummaryParam && consult.ai_summary) setAiSummary(consult.ai_summary as string)
        if (consult.practitioner_notes) setPractNotes(consult.practitioner_notes as string)
      }
      setDocuments((docs ?? []) as PractDocument[])
    }
    void load()
  }, [consultationId, aiSummaryParam])

  async function saveNotes() {
    if (!consultationId) return
    setNotesSaving(true)
    await supabase.from('consultations').update({ practitioner_notes: practNotes }).eq('id', consultationId)
    setNotesSaving(false)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 3000)
  }

  async function saveDocument() {
    if (!consultationId || !newDocContent.trim()) return
    setDocSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setDocSaving(false); return }

    const [{ data: pract }, { data: apt }] = await Promise.all([
      supabase.from('practitioners').select('id').eq('user_id', user.id).single(),
      supabase.from('appointments').select('patient_id').eq('id', appointmentId).single(),
    ])

    if (!pract || !apt) { setDocSaving(false); return }

    const { data: newDoc } = await supabase
      .from('practitioner_documents')
      .insert({
        consultation_id: consultationId,
        patient_id: apt.patient_id,
        practitioner_id: pract.id,
        document_type: newDocType,
        content: newDocContent,
      })
      .select('id, document_type, content, created_at')
      .single()

    if (newDoc) {
      setDocuments(prev => [newDoc as PractDocument, ...prev])
      setNewDocContent('')
      setDocSaved(true)
      setShowNewForm(false)
      setTimeout(() => setDocSaved(false), 3000)
    }
    setDocSaving(false)
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dakar',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f9ff] to-[#eff4ff] font-[Manrope]">
      <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet" />

      <header className="fixed top-0 w-full z-50 flex items-center justify-between px-6 py-4 bg-white/70 backdrop-blur-xl border-b border-sky-100/20 shadow-[0_8px_32px_0_rgba(130,216,255,0.08)]">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#006685] text-3xl select-none">medical_services</span>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-[#0b1c30] leading-none">M-Santé</h1>
            <p className="text-xs text-slate-500 font-medium">Clinical Portal</p>
          </div>
          <div className="ml-3 flex items-center gap-1.5 bg-[#e5eeff]/50 border border-[#d3e4fe] px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-[#006685] inline-block" />
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[#006685]">Portail Praticien</span>
          </div>
        </div>
      </header>

      <main className="pt-[88px] max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Hero */}
        <div className="flex items-center gap-4 bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex-shrink-0 w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-600 text-4xl select-none" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
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

        {/* AI Summary */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">psychology</span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Résumé IA</h3>
            <span className="text-[11px] font-bold uppercase tracking-[0.05em] bg-sky-50 text-sky-600 border border-sky-100 px-2.5 py-1 rounded-full">claude-haiku-4-5</span>
          </div>
          {aiSummary ? (
            <p className="text-sm text-[#3f484d] leading-relaxed italic">{aiSummary}</p>
          ) : (
            <p className="text-sm text-[#6f787e] italic">Aucun résumé disponible.</p>
          )}
          <div className="border-t border-[#bec8ce]/40 pt-3 mt-3">
            <p className="text-xs text-[#6f787e]">Ce résumé ne remplace pas les notes cliniques du praticien.</p>
          </div>
        </div>

        {/* Chat transcript */}
        {chatHistory.length > 0 && (
          <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-[#006685] text-2xl select-none">chat</span>
              <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Transcript de session</h3>
              <span className="material-symbols-outlined text-[#6f787e] text-xl select-none">lock</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
              {chatHistory.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'practitioner' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${msg.role === 'patient' ? 'bg-[#e5eeff]/50 text-[#0b1c30] rounded-tl-none' : 'bg-[#006685] text-white rounded-tr-none'}`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[10px] mt-1 ${msg.role === 'patient' ? 'text-[#6f787e]' : 'text-white/70'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes de suivi (privées) */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">edit_note</span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Notes de suivi</h3>
            <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-1 rounded-full">
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

        {/* Documents patient — multi */}
        <div className="bg-white/60 backdrop-blur-2xl rounded-2xl border border-white/80 shadow-xl shadow-sky-900/5 p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="material-symbols-outlined text-[#006685] text-2xl select-none">description</span>
            <h3 className="text-base font-semibold text-[#0b1c30] flex-1">Documents patient</h3>
            <span className="text-xs font-bold bg-[#e5eeff] text-[#006685] px-2.5 py-1 rounded-full">
              {documents.length} émis
            </span>
          </div>

          {/* Liste documents existants */}
          {documents.length > 0 && (
            <div className="space-y-2 mb-5">
              {documents.map(doc => {
                const colors = DOC_COLORS[doc.document_type]
                const icon = DOC_ICONS[doc.document_type]
                const dt = new Date(doc.created_at)
                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ backgroundColor: colors.bg + '80', borderColor: colors.bg }}>
                    <span className="material-symbols-outlined text-lg select-none" style={{ color: colors.text }}>{icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold" style={{ color: colors.text }}>{DOC_TYPE_LABELS[doc.document_type]}</p>
                      <p className="text-xs text-[#6f787e]">
                        {dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Dakar' })} à {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar' })}
                      </p>
                    </div>
                    <button
                      onClick={() => window.open(`/patient/document/${doc.id}`, '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: colors.text }}
                    >
                      <span className="material-symbols-outlined text-sm select-none">open_in_new</span>
                      Aperçu
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Bouton + Nouveau document */}
          {!showNewForm && (
            <button
              onClick={() => setShowNewForm(true)}
              className="w-full py-3 border-2 border-dashed border-[#bec8ce] rounded-xl text-sm font-semibold text-[#006685] hover:border-[#006685] hover:bg-[#eff4ff] transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-base select-none">add</span>
              Nouveau document
            </button>
          )}

          {/* Formulaire nouveau document */}
          {showNewForm && (
            <div className="border-2 border-[#d3e4fe] rounded-xl p-4 bg-[#f8f9ff]">
              <p className="text-sm font-bold text-[#0b1c30] mb-3">Nouveau document</p>

              {/* Type selector */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map(type => {
                  const c = DOC_COLORS[type]
                  return (
                    <button
                      key={type}
                      onClick={() => setNewDocType(type)}
                      className="px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5"
                      style={{
                        backgroundColor: newDocType === type ? c.text : c.bg,
                        color: newDocType === type ? '#fff' : c.text,
                      }}
                    >
                      <span className="material-symbols-outlined text-sm select-none">{DOC_ICONS[type]}</span>
                      {DOC_TYPE_LABELS[type]}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={newDocContent}
                onChange={e => setNewDocContent(e.target.value)}
                rows={6}
                placeholder={
                  newDocType === 'prescription'
                    ? 'Ex : Paracétamol 500mg — 1 comprimé matin et soir pendant 7 jours...'
                    : newDocType === 'appreciation'
                    ? 'Ex : Séance productive. Le patient montre des progrès dans la gestion du stress...'
                    : newDocType === 'report'
                    ? 'Compte-rendu de la séance du jour...'
                    : 'Contenu du certificat médical...'
                }
                className="w-full px-4 py-3 bg-white border border-[#bec8ce] rounded-xl text-[#0b1c30] placeholder-[#6f787e] text-sm focus:outline-none focus:border-[#006685] transition-all resize-none"
              />

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => void saveDocument()}
                  disabled={docSaving || !newDocContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-40"
                  style={{ backgroundColor: docSaved ? '#1d7a3a' : '#006685' }}
                >
                  <span className="material-symbols-outlined text-base select-none">{docSaved ? 'check' : 'send'}</span>
                  {docSaving ? 'Émission...' : 'Émettre le document'}
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setNewDocContent('') }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-[#bec8ce] text-[#6f787e] hover:bg-white transition-all"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pb-8">
          <button
            onClick={() => router.push('/practitioner/appointments')}
            className="flex-1 py-3 rounded-xl bg-[#006685] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#005575] transition-colors shadow-[0_4px_16px_rgba(0,102,133,0.2)]"
          >
            <span className="material-symbols-outlined text-xl select-none">calendar_today</span>
            Retour aux rendez-vous
          </button>
          <button
            onClick={() => router.push('/practitioner')}
            className="flex-1 py-3 rounded-xl border-2 border-[#006685] text-[#006685] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#eff4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-xl select-none">dashboard</span>
            Tableau de bord
          </button>
        </div>
      </main>
    </div>
  )
}
