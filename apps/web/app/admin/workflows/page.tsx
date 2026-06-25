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
    color: '#006685',
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
    email:    { icon: 'email', label: 'Email',    color: '#006685', bg: '#e5eeff' },
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
        style={{ backgroundColor: checked ? '#006685' : '#cbd5e1' }}
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
          className="flex items-center gap-1 text-[10px] font-semibold text-[#006685] hover:underline"
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
          <ConfigPill label="WhatsApp Business API" configured={false} />
          <ConfigPill label="Email (Resend)" configured={false} />
        </div>
        <p className="text-xs text-[#6f787e] mt-3 leading-relaxed">
          Configurez les variables <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">TWILIO_ACCOUNT_SID</code>,{' '}
          <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">TWILIO_AUTH_TOKEN</code> et{' '}
          <code className="px-1 py-0.5 rounded bg-slate-100 font-mono text-[10px]">RESEND_API_KEY</code>{' '}
          dans les secrets Supabase (Dashboard → Edge Functions → Secrets) pour activer les envois.
        </p>
      </div>

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
          <Icon name="info" style={{ fontSize: '18px', color: '#006685' }} />
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
                style={{ backgroundColor: '#e5eeff', color: '#006685' }}
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
