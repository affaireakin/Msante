'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

function Icon({ name, style }: { name: string; style?: React.CSSProperties }) {
  return <span className="material-symbols-outlined" style={style}>{name}</span>
}

// ─── Template catalogue ───────────────────────────────────────────────────────

interface Template {
  key: string
  name: string
  description: string
  icon: string
  color: string
  bgColor: string
  recipients: string
  triggerLabel: string
  triggerType: string
  exampleMsg: string
}

const TEMPLATES: Template[] = [
  {
    key: 'appointment.confirmed',
    name: 'RDV Confirmé',
    description: 'Envoyé dès qu\'un rendez-vous est confirmé par le praticien.',
    icon: 'event_available',
    color: '#82d8ff',
    bgColor: '#e5eeff',
    recipients: 'Patient + Praticien',
    triggerLabel: 'Événement DB',
    triggerType: 'postgres_changes',
    exampleMsg: 'Votre RDV du [DATE] avec Dr [NOM] est confirmé. Lien de consultation : [URL]',
  },
  {
    key: 'appointment.reminder_24h',
    name: 'Rappel RDV 24h avant',
    description: 'Rappel automatique envoyé 24h avant chaque consultation.',
    icon: 'alarm',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    recipients: 'Patient + Praticien',
    triggerLabel: 'Cron 09h00',
    triggerType: 'schedule.cron',
    exampleMsg: 'Rappel : votre consultation avec Dr [NOM] est demain à [HEURE]. Pensez à vous connecter.',
  },
  {
    key: 'appointment.cancelled',
    name: 'RDV Annulé',
    description: 'Notification immédiate en cas d\'annulation d\'un rendez-vous.',
    icon: 'event_busy',
    color: '#ba1a1a',
    bgColor: '#ffdad6',
    recipients: 'Patient + Praticien',
    triggerLabel: 'Événement DB',
    triggerType: 'postgres_changes',
    exampleMsg: 'Votre RDV du [DATE] a été annulé. Motif : [RAISON]. Reprenez rendez-vous dès que possible.',
  },
  {
    key: 'prescription.created',
    name: 'Nouvelle Ordonnance',
    description: 'Alerte patient dès qu\'un praticien crée une ordonnance.',
    icon: 'receipt_long',
    color: '#1d7a3a',
    bgColor: '#dcfce7',
    recipients: 'Patient',
    triggerLabel: 'Événement DB',
    triggerType: 'postgres_changes',
    exampleMsg: "Dr [NOM] vient de vous créer une ordonnance. Consultez-la dans l'application M-Santé.",
  },
  {
    key: 'payment.completed',
    name: 'Paiement Confirmé',
    description: 'Reçu envoyé au patient dès confirmation du paiement.',
    icon: 'payments',
    color: '#92400e',
    bgColor: '#fef3c7',
    recipients: 'Patient',
    triggerLabel: 'Événement DB',
    triggerType: 'postgres_changes',
    exampleMsg: 'Paiement de [MONTANT] XOF reçu via [PROVIDER]. Votre RDV est maintenant confirmé.',
  },
  {
    key: 'payment.failed',
    name: 'Paiement Échoué',
    description: 'Alerte + lien de retry envoyé au patient après un échec de paiement.',
    icon: 'credit_card_off',
    color: '#c2410c',
    bgColor: '#fff7ed',
    recipients: 'Patient',
    triggerLabel: 'Événement DB',
    triggerType: 'postgres_changes',
    exampleMsg: 'Votre paiement de [MONTANT] XOF a échoué. Réessayez dans l\'application : [LIEN]',
  },
  {
    key: 'account.welcome',
    name: 'Bienvenue',
    description: 'Envoyé une fois, juste après confirmation de l\'email d\'un nouveau patient.',
    icon: 'waving_hand',
    color: '#005e7a',
    bgColor: '#e0f2fe',
    recipients: 'Patient',
    triggerLabel: 'Inscription confirmée',
    triggerType: 'postgres_changes',
    exampleMsg: 'Bienvenue sur M-Santé ! Votre compte est prêt.',
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowRow {
  id: string
  name: string
  is_active: boolean
  trigger_config: { template_key?: string; channels?: string[] }
  created_at: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useSimpleWorkflows() {
  return useQuery({
    queryKey: ['admin-simple-workflows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, is_active, trigger_config, created_at')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WorkflowRow[]
    },
  })
}

function useToggleWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      templateKey,
      existingId,
      activate,
      template,
    }: {
      templateKey: string
      existingId: string | null
      activate: boolean
      template: Template
    }) => {
      if (existingId) {
        const { error } = await supabase
          .from('workflows')
          .update({ is_active: activate, updated_at: new Date().toISOString() })
          .eq('id', existingId)
        if (error) throw error
      } else if (activate) {
        const { error } = await supabase.from('workflows').insert({
          name: template.name,
          description: template.description,
          trigger_type: template.triggerType,
          trigger_config: {
            template_key: templateKey,
            channels: ['whatsapp', 'email'],
            recipients: template.recipients,
          },
          nodes: [],
          edges: [],
          is_active: true,
        })
        if (error) throw error
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-simple-workflows'] }),
  })
}

// ─── Channel badge ────────────────────────────────────────────────────────────

function ChannelBadge({ channel, active }: { channel: 'whatsapp' | 'email'; active: boolean }) {
  const cfg = {
    whatsapp: { icon: 'chat', label: 'WhatsApp', color: '#1d7a3a', bg: '#dcfce7' },
    email:    { icon: 'email', label: 'Email',    color: '#82d8ff', bg: '#e5eeff' },
  }[channel]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: active ? cfg.bg : '#f1f5f9',
        color: active ? cfg.color : '#94a3b8',
      }}
    >
      <Icon name={cfg.icon} style={{ fontSize: '11px' }} />
      {cfg.label}
    </span>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 focus:outline-none disabled:opacity-40"
      style={{ width: 44, height: 24 }}
      aria-checked={checked}
    >
      <span
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked ? '#82d8ff' : '#cbd5e1' }}
      />
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  )
}

// ─── Template card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  workflow,
}: {
  template: Template
  workflow: WorkflowRow | undefined
}) {
  const toggle = useToggleWorkflow()
  const [showMsg, setShowMsg] = useState(false)

  const isActive = workflow?.is_active ?? false
  const isLoading = toggle.isPending

  const handleToggle = (active: boolean) => {
    toggle.mutate({
      templateKey: template.key,
      existingId: workflow?.id ?? null,
      activate: active,
      template,
    })
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={{
        backgroundColor: 'rgba(255,255,255,0.75)',
        border: isActive ? `1.5px solid ${template.color}30` : '1px solid rgba(255,255,255,0.80)',
        backdropFilter: 'blur(16px)',
        boxShadow: isActive
          ? `0 4px 20px ${template.color}12`
          : '0 2px 8px rgba(0,102,133,0.04)',
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: template.bgColor }}
        >
          <Icon name={template.icon} style={{ fontSize: 20, color: template.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#0b1c30]">{template.name}</p>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: template.bgColor, color: template.color }}
            >
              {template.triggerLabel}
            </span>
          </div>
          <p className="text-xs text-[#6f787e] mt-0.5">{template.description}</p>
        </div>
        <Toggle checked={isActive} onChange={handleToggle} disabled={isLoading} />
      </div>

      {/* Channel + recipients */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChannelBadge channel="whatsapp" active={isActive} />
        <ChannelBadge channel="email" active={isActive} />
        <span className="text-[#bec8ce] text-xs">→</span>
        <span
          className="flex items-center gap-1 text-xs font-medium"
          style={{ color: '#6f787e' }}
        >
          <Icon name="people" style={{ fontSize: '12px' }} />
          {template.recipients}
        </span>
      </div>

      {/* Message preview */}
      <div>
        <button
          type="button"
          onClick={() => setShowMsg(v => !v)}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#82d8ff] hover:underline"
        >
          <Icon name={showMsg ? 'expand_less' : 'expand_more'} style={{ fontSize: '14px' }} />
          Aperçu du message
        </button>
        {showMsg && (
          <div
            className="mt-2 px-3 py-2.5 rounded-xl text-xs text-[#3f484d] leading-relaxed"
            style={{ backgroundColor: '#f8f9ff', border: '1px solid #e5eeff', fontStyle: 'italic' }}
          >
            {template.exampleMsg}
          </div>
        )}
      </div>

      {/* Status footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100/60">
        <span
          className="flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: isActive ? '#1d7a3a' : '#94a3b8' }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: isActive ? '#1d7a3a' : '#94a3b8' }}
          />
          {isLoading ? 'Mise à jour…' : isActive ? 'Actif' : 'Inactif'}
        </span>
        {workflow && (
          <span className="text-[10px] text-[#bec8ce]">
            depuis le {new Date(workflow.created_at).toLocaleDateString('fr-FR')}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Config pill ──────────────────────────────────────────────────────────────

function ConfigPill({ label, configured }: { label: string; configured: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
      style={{
        backgroundColor: configured ? '#dcfce7' : '#fef3c7',
        color: configured ? '#1d7a3a' : '#92400e',
        border: `1px solid ${configured ? '#bbf7d0' : '#fde68a'}`,
      }}
    >
      <Icon name={configured ? 'check_circle' : 'warning'} style={{ fontSize: '14px' }} />
      {label}
      <span className="font-normal opacity-70">{configured ? 'configuré' : 'à configurer'}</span>
    </div>
  )
}

// ─── Test d'envoi WhatsApp ────────────────────────────────────────────────────
// Diagnostic direct : envoie le message générique à un numéro donné, sans
// passer par la gate "workflow actif" ni déclencher un vrai événement métier
// (RDV, message...) juste pour vérifier que la config Meta fonctionne.
// Affiche la réponse brute de l'API — utile pour distinguer un vrai bug de
// code d'une restriction sandbox (numéro non ajouté comme testeur Meta).

interface WhatsAppTestResult {
  success: boolean
  status?: number
  sent_to?: string
  message_body?: string
  meta_response?: unknown
  error?: string
}

function WhatsAppTestCard() {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<WhatsAppTestResult | null>(null)

  const send = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-whatsapp-message', {
        body: { phone, name },
      })
      if (error) throw error
      return data as WhatsAppTestResult
    },
    onSuccess: (data) => setResult(data),
    onError: (e: Error) => setResult({ success: false, error: e.message }),
  })

  const metaError = result?.meta_response && typeof result.meta_response === 'object' && 'error' in (result.meta_response as object)
    ? (result.meta_response as { error?: { message?: string; error_data?: { details?: string } } }).error
    : null

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: 'rgba(255,255,255,0.70)', border: '1px solid rgba(255,255,255,0.80)', backdropFilter: 'blur(16px)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon name="science" style={{ fontSize: '16px', color: '#6f787e' }} />
        <p className="text-sm font-bold text-[#0b1c30]">Tester l&apos;envoi WhatsApp</p>
      </div>
      <p className="text-xs text-[#6f787e] mb-4">
        Envoie le message générique à un numéro précis, immédiatement — sans attendre un vrai RDV ou message.
        Utile pour vérifier la config Meta (token, numéro autorisé en sandbox).
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+221778806877"
          className="flex-1 px-4 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff]"
        />
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Prénom (optionnel)"
          className="w-full sm:w-48 px-4 py-2.5 bg-[#f8f9ff] border border-[#bec8ce] rounded-xl text-sm text-[#0b1c30] placeholder-[#6f787e] focus:outline-none focus:border-[#82d8ff]"
        />
        <button
          onClick={() => { setResult(null); send.mutate() }}
          disabled={send.isPending || !phone.trim()}
          className="px-5 py-2.5 bg-[#82d8ff] text-[#0b1c30] text-sm font-bold rounded-xl disabled:opacity-50 flex-shrink-0"
        >
          {send.isPending ? 'Envoi...' : 'Envoyer un test'}
        </button>
      </div>

      {result && (
        <div
          className="mt-4 rounded-xl p-4 text-sm"
          style={{
            backgroundColor: result.success && !metaError ? '#dcfce7' : '#ffdad6',
            color: result.success && !metaError ? '#1d7a3a' : '#ba1a1a',
          }}
        >
          {result.error ? (
            <p className="font-semibold">Erreur : {result.error}</p>
          ) : metaError ? (
            <>
              <p className="font-semibold">Rejeté par Meta : {metaError.message}</p>
              {metaError.error_data?.details && <p className="text-xs mt-1 opacity-80">{metaError.error_data.details}</p>}
              <p className="text-xs mt-2 opacity-80">
                Cause fréquente en mode test : ce numéro n&apos;est pas ajouté comme destinataire vérifié dans Meta Business Manager (WhatsApp → Configuration de l&apos;API → section &quot;Vers&quot;).
              </p>
            </>
          ) : (
            <p className="font-semibold">✓ Message accepté par Meta pour {result.sent_to} — vérifie le téléphone destinataire.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const { data: workflows = [], isLoading } = useSimpleWorkflows()

  const activeCount = workflows.filter(w => w.is_active).length

  // Map template keys to existing workflow rows
  const byKey = (key: string) =>
    workflows.find(w => (w.trigger_config as { template_key?: string })?.template_key === key)

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-black text-[#0b1c30]">Automatisations</h1>
          <p className="text-sm text-[#6f787e] mt-1">
            Activez les notifications WhatsApp + Email pour chaque événement clé.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: activeCount > 0 ? '#dcfce7' : '#f1f5f9', color: activeCount > 0 ? '#1d7a3a' : '#6f787e' }}
        >
          <Icon name="bolt" style={{ fontSize: '18px' }} />
          {activeCount} / {TEMPLATES.length} actifs
        </div>
      </div>

      {/* Channel config status */}
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: 'rgba(255,255,255,0.70)',
          border: '1px solid rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Icon name="settings" style={{ fontSize: '16px', color: '#6f787e' }} />
          <p className="text-sm font-bold text-[#0b1c30]">Canaux de communication</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ConfigPill label="WhatsApp Business API" configured />
          <ConfigPill label="Email (Resend)" configured />
        </div>
        <p className="text-xs text-[#6f787e] mt-3 leading-relaxed">
          Secrets Supabase utilisés : <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">WHATSAPP_TOKEN</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">WHATSAPP_PHONE_NUMBER_ID</code> et{' '}
          <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">RESEND_API_KEY</code>{' '}
          (Dashboard Supabase → Edge Functions → Secrets).
        </p>
      </div>

      {/* Test d'envoi WhatsApp — diagnostic direct, sans dépendre d'un
          événement métier réel ni d'un workflow actif */}
      <WhatsAppTestCard />

      {/* Template grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-white/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMPLATES.map(tpl => (
            <TemplateCard
              key={tpl.key}
              template={tpl}
              workflow={byKey(tpl.key)}
            />
          ))}
        </div>
      )}

      {/* How it works */}
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.60)',
          border: '1px solid rgba(255,255,255,0.80)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Icon name="info" style={{ fontSize: '18px', color: '#82d8ff' }} />
          <p className="text-sm font-bold text-[#0b1c30]">Comment ça fonctionne</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: 'database', step: '1', title: 'Événement DB', desc: 'Un rendez-vous, paiement ou ordonnance déclenche l\'événement dans Supabase.' },
            { icon: 'hub', step: '2', title: 'Edge Function', desc: 'La fonction send-workflow-notification vérifie les workflows actifs et récupère les contacts.' },
            { icon: 'send', step: '3', title: 'Envoi multi-canal', desc: 'WhatsApp via Twilio et email via Resend sont envoyés simultanément.' },
          ].map(item => (
            <div key={item.step} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                style={{ backgroundColor: '#e5eeff', color: '#82d8ff' }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-xs font-bold text-[#0b1c30]">{item.title}</p>
                <p className="text-xs text-[#6f787e] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
