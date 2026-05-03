'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useEffect } from 'react'
import type { Workflow, CronTriggerConfig, MoodTriggerConfig, PaymentTriggerConfig } from '@/types/workflows'

// ── Zod schemas ───────────────────────────────────────────────────────────────

const cronSchema = z.object({
  send_hour: z.number().int().min(0).max(23),
})

const moodSchema = z.object({
  mood_threshold: z.number().int().min(1).max(10),
  streak_days: z.number().int().min(1).max(14),
})

const paymentSchema = z.object({
  delay_hours: z.number().int().min(1).max(48),
  max_retries: z.number().int().min(1).max(10),
})

type CronForm = z.infer<typeof cronSchema>
type MoodForm = z.infer<typeof moodSchema>
type PaymentForm = z.infer<typeof paymentSchema>

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  label,
  children,
  error,
}: {
  label: string
  children: React.ReactNode
  error?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-[#006685] uppercase tracking-widest">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = "w-full px-4 py-2.5 rounded-xl border border-slate-200/60 bg-white/60 text-sm text-[#0b1c30] outline-none focus:border-[#006685] transition-colors"

// ── Sub-forms ─────────────────────────────────────────────────────────────────

function CronConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: CronTriggerConfig
  onSave: (data: CronTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CronForm>({
    resolver: zodResolver(cronSchema),
    defaultValues: { send_hour: config.send_hour },
  })
  useEffect(() => { reset({ send_hour: config.send_hour }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, send_hour: d.send_hour }))} className="space-y-5">
      <FieldRow label="Heure d'envoi (0–23h)" error={errors.send_hour?.message}>
        <input
          type="number"
          min={0}
          max={23}
          {...register('send_hour', { valueAsNumber: true })}
          className={inputCls}
        />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function MoodConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: MoodTriggerConfig
  onSave: (data: MoodTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<MoodForm>({
    resolver: zodResolver(moodSchema),
    defaultValues: { mood_threshold: config.mood_threshold, streak_days: config.streak_days },
  })
  useEffect(() => { reset({ mood_threshold: config.mood_threshold, streak_days: config.streak_days }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, ...d }))} className="space-y-5">
      <FieldRow label="Seuil score mood (≤)" error={errors.mood_threshold?.message}>
        <input type="number" min={1} max={10} {...register('mood_threshold', { valueAsNumber: true })} className={inputCls} />
      </FieldRow>
      <FieldRow label="Streak (jours consécutifs)" error={errors.streak_days?.message}>
        <input type="number" min={1} max={14} {...register('streak_days', { valueAsNumber: true })} className={inputCls} />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

function PaymentConfigForm({
  config,
  onSave,
  isPending,
}: {
  config: PaymentTriggerConfig
  onSave: (data: PaymentTriggerConfig) => void
  isPending: boolean
}) {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { delay_hours: config.delay_hours, max_retries: config.max_retries },
  })
  useEffect(() => { reset({ delay_hours: config.delay_hours, max_retries: config.max_retries }) }, [config, reset])

  return (
    <form onSubmit={handleSubmit((d) => onSave({ ...config, ...d }))} className="space-y-5">
      <FieldRow label="Délai avant retry (heures)" error={errors.delay_hours?.message}>
        <input type="number" min={1} max={48} {...register('delay_hours', { valueAsNumber: true })} className={inputCls} />
      </FieldRow>
      <FieldRow label="Max retries" error={errors.max_retries?.message}>
        <input type="number" min={1} max={10} {...register('max_retries', { valueAsNumber: true })} className={inputCls} />
      </FieldRow>
      <button type="submit" disabled={isPending} className="w-full py-2.5 bg-[#006685] text-white text-sm font-semibold rounded-full hover:bg-[#005070] disabled:opacity-50 transition-colors">
        {isPending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  )
}

// ── Main ConfigPanel ──────────────────────────────────────────────────────────

interface ConfigPanelProps {
  workflow: Workflow
  onSaveConfig: (config: Workflow['trigger_config']) => void
  onToggleActive: () => void
  isPending: boolean
}

export function ConfigPanel({ workflow, onSaveConfig, onToggleActive, isPending }: ConfigPanelProps) {
  const isMoodConfig = workflow.trigger_type === 'postgres_changes' &&
    (workflow.trigger_config as MoodTriggerConfig).mood_threshold !== undefined

  const isPaymentConfig = workflow.trigger_type === 'postgres_changes' &&
    (workflow.trigger_config as PaymentTriggerConfig).max_retries !== undefined

  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-6 h-full"
      style={{
        backgroundColor: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.80)',
        boxShadow: '0 10px 30px -10px rgba(0,102,133,0.05)',
      }}
    >
      <div>
        <h2 className="text-xs font-bold text-[#006685] uppercase tracking-widest mb-1">Configuration</h2>
        <p className="text-sm text-[#6f787e]">{workflow.name}</p>
      </div>

      {workflow.trigger_type === 'schedule.cron' && (
        <CronConfigForm
          config={workflow.trigger_config as CronTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}
      {isMoodConfig && (
        <MoodConfigForm
          config={workflow.trigger_config as MoodTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}
      {isPaymentConfig && (
        <PaymentConfigForm
          config={workflow.trigger_config as PaymentTriggerConfig}
          onSave={onSaveConfig}
          isPending={isPending}
        />
      )}

      {/* Toggle active */}
      <div className="mt-auto pt-4 border-t border-slate-100/60">
        <button
          onClick={onToggleActive}
          disabled={isPending}
          className={`w-full py-3 rounded-full text-sm font-bold transition-colors disabled:opacity-50 ${
            workflow.is_active
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-emerald-500 text-white hover:bg-emerald-600'
          }`}
        >
          {workflow.is_active ? 'Désactiver le workflow' : 'Activer le workflow'}
        </button>
      </div>
    </div>
  )
}
