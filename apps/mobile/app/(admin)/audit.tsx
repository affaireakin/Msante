import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

type IconName = React.ComponentProps<typeof MaterialIcons>['name']

const ACTION_META: Record<string, { label: string; bg: string; color: string; icon: IconName }> = {
  'collaborator.invited':            { label: 'Invitation envoyée',        bg: '#e0f2fe', color: '#0369a1', icon: 'mail' },
  'collaborator.suspended':          { label: 'Compte suspendu',           bg: '#ffdad6', color: '#ba1a1a', icon: 'pause-circle-outline' },
  'collaborator.reactivated':        { label: 'Compte réactivé',           bg: '#dcfce7', color: '#166534', icon: 'play-circle-outline' },
  'collaborator.role_changed':       { label: 'Rôle modifié',              bg: '#fef3c7', color: '#92400e', icon: 'manage-accounts' },
  'collaborator.deleted':            { label: 'Compte supprimé',           bg: '#ffdad6', color: '#991b1b', icon: 'delete' },
  'collaborator.revoked':            { label: 'Collaborateur révoqué',     bg: '#ffdad6', color: '#ba1a1a', icon: 'person-remove' },
  'collaborator.accept_invitation':  { label: 'Invitation acceptée',       bg: '#dcfce7', color: '#166534', icon: 'check-circle' },
  'user.suspended':                  { label: 'Compte suspendu',           bg: '#ffdad6', color: '#ba1a1a', icon: 'pause-circle-outline' },
  'user.unsuspended':                { label: 'Compte réactivé',           bg: '#dcfce7', color: '#166534', icon: 'play-circle-outline' },
  'user.deletion_requested':         { label: 'Suppression demandée',      bg: '#ffdad6', color: '#ba1a1a', icon: 'delete-forever' },
  'practitioner.approved':           { label: 'Praticien approuvé',        bg: '#dcfce7', color: '#166534', icon: 'verified' },
  'practitioner.rejected':           { label: 'Praticien refusé',          bg: '#ffdad6', color: '#ba1a1a', icon: 'block' },
  'practitioner.document_changed':   { label: 'Document modifié',          bg: '#fef3c7', color: '#92400e', icon: 'description' },
  'practitioner.speciality_changed': { label: 'Spécialité modifiée',       bg: '#fef3c7', color: '#92400e', icon: 'edit' },
  'practitioner.org_detach':         { label: "Détaché d'une organisation", bg: '#fef3c7', color: '#92400e', icon: 'link-off' },
  'practitioner.org_validate':       { label: "Validé par l'organisation", bg: '#dcfce7', color: '#166534', icon: 'verified' },
  'practitioner.invite':             { label: 'Praticien invité',          bg: '#e0f2fe', color: '#0369a1', icon: 'mail' },
  'practitioner.accept_invitation':  { label: 'Invitation acceptée',       bg: '#dcfce7', color: '#166534', icon: 'check-circle' },
  'secretary.invite':                { label: 'Secrétaire invité(e)',      bg: '#e0f2fe', color: '#0369a1', icon: 'mail' },
  'secretary.accept_invitation':     { label: 'Invitation acceptée',       bg: '#dcfce7', color: '#166534', icon: 'check-circle' },
  'secretary.approved':              { label: 'Secrétaire approuvé(e)',    bg: '#dcfce7', color: '#166534', icon: 'verified' },
  'secretary.rejected':              { label: 'Secrétaire refusé(e)',      bg: '#ffdad6', color: '#ba1a1a', icon: 'block' },
  'secretary.revoked':               { label: 'Accès révoqué',             bg: '#ffdad6', color: '#ba1a1a', icon: 'person-remove' },
  'secretary.reactivated':           { label: 'Accès réactivé',            bg: '#dcfce7', color: '#166534', icon: 'play-circle-outline' },
  'organization.create':             { label: 'Organisation créée',        bg: '#e0f2fe', color: '#0369a1', icon: 'business' },
  'organization.approve':            { label: 'Organisation approuvée',    bg: '#dcfce7', color: '#166534', icon: 'verified' },
  'organization.reject':             { label: 'Organisation refusée',      bg: '#ffdad6', color: '#ba1a1a', icon: 'block' },
  'organization.request_info':       { label: 'Complément demandé',        bg: '#fef3c7', color: '#92400e', icon: 'help-outline' },
  'organization.suspend':            { label: 'Organisation suspendue',    bg: '#ffdad6', color: '#ba1a1a', icon: 'pause-circle-outline' },
  'organization.reactivate':         { label: 'Organisation réactivée',    bg: '#dcfce7', color: '#166534', icon: 'play-circle-outline' },
  'organization.archive':            { label: 'Organisation archivée',     bg: '#f1f5f9', color: '#475569', icon: 'archive' },
  'appointment.created_by_practitioner': { label: 'RDV créé par le praticien', bg: '#e0f2fe', color: '#0369a1', icon: 'event' },
  'payment.completed':               { label: 'Paiement complété',         bg: '#dcfce7', color: '#166534', icon: 'payments' },
  'consultation.ended':              { label: 'Consultation terminée',     bg: '#f1f5f9', color: '#475569', icon: 'call-end' },
  'role_permission.grant':           { label: 'Permission accordée',       bg: '#dcfce7', color: '#166534', icon: 'add-moderator' },
  'role_permission.revoke':          { label: 'Permission retirée',        bg: '#ffdad6', color: '#ba1a1a', icon: 'remove-moderator' },
  'user_role.assign':                { label: 'Rôle assigné',              bg: '#fef3c7', color: '#92400e', icon: 'assignment-ind' },
  'user_role.unassign':              { label: 'Rôle retiré',               bg: '#fef3c7', color: '#92400e', icon: 'assignment-ind' },
}

const RESOURCE_LABELS: Record<string, string> = {
  user: 'Utilisateur', invitation: 'Invitation', practitioner: 'Praticien',
  practitioner_invitation: 'Invitation praticien', practitioner_secretary: 'Secrétaire',
  organization: 'Organisation', org_role: 'Rôle organisation', payment: 'Paiement',
  appointment: 'Rendez-vous', consultation: 'Consultation',
}

interface AuditLog {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  target_role: string | null
  reason: string | null
  created_at: string
  actor: { full_name: string } | null
  target: { full_name: string } | null
}

// Même approche que web (diff générique ancien → nouvel état plutôt qu'une
// liste de champs codée en dur, puisque les clés varient selon l'action).
function describeChange(log: AuditLog): string | null {
  const parts: string[] = []
  const { old_values: oldV, new_values: newV } = log
  if (oldV && newV) {
    for (const k of Object.keys(newV)) {
      if (k in oldV && oldV[k] !== newV[k] && k !== 'reason' && k !== 'note') {
        parts.push(`${k} : ${oldV[k]} → ${newV[k]}`)
      }
    }
  }
  if (log.reason) parts.push(`Motif : ${log.reason}`)
  return parts.length > 0 ? parts.join(' · ') : null
}

function useAuditLogs() {
  return useQuery<AuditLog[]>({
    queryKey: ['admin-audit-logs-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, action, resource_type, resource_id, old_values, new_values, target_role, reason, created_at, actor:actor_id(full_name), target:target_user_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as AuditLog[]
    },
  })
}

export default function AdminAuditScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { data: logs = [], isLoading } = useAuditLogs()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Journal d&apos;audit</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(10) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : logs.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="history" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucune entrée dans le journal</Text>
          </View>
        ) : logs.map(log => {
          const meta = ACTION_META[log.action]
          const change = describeChange(log)
          return (
            <View key={log.id} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(8) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {meta ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 999, backgroundColor: meta.bg }}>
                    <MaterialIcons name={meta.icon} size={scale(13)} color={meta.color} />
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                  </View>
                ) : (
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{log.action}</Text>
                )}
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                  {new Date(log.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} · {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                {RESOURCE_LABELS[log.resource_type] ?? log.resource_type}
                {log.resource_id ? ` · ${log.resource_id.slice(0, 8)}…` : ''}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#3f484d' }}>
                  Par <Text style={{ fontWeight: '700' }}>{log.actor?.full_name ?? '—'}</Text>
                </Text>
                {log.target?.full_name && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#3f484d' }}>
                    Concerné : <Text style={{ fontWeight: '700' }}>{log.target.full_name}</Text>
                  </Text>
                )}
              </View>
              {change && (
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', fontStyle: 'italic' }} numberOfLines={2}>
                  {change}
                </Text>
              )}
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
