import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: '#92400e', bg: '#fef3c7' },
  under_review: { label: 'En revue', color: '#0369a1', bg: '#e0f2fe' },
  resolved: { label: 'Résolu', color: '#166534', bg: '#dcfce7' },
  closed: { label: 'Clôturé', color: '#475569', bg: '#f1f5f9' },
}
const STATUS_TABS = ['all', 'open', 'under_review', 'resolved', 'closed'] as const
const ACTOR_LABEL: Record<string, string> = { patient: 'Patient', practitioner: 'Praticien', admin: 'Vous (Admin)', system: 'Système' }

interface Dispute {
  id: string
  case_number: string
  reason: string
  description: string | null
  status: string
  priority: string
  created_at: string
  patient: { full_name: string } | null
  practitioner: { full_name: string } | null
}

interface DisputeEvent {
  id: string
  type: string
  actor_role: string
  content: string
  created_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function useAllDisputes(statusFilter: string) {
  return useQuery<Dispute[]>({
    queryKey: ['admin-disputes-mobile', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, patient:patient_id(full_name), practitioner:practitioner_id(full_name)')
        .order('created_at', { ascending: false })
      if (statusFilter !== 'all') query = query.eq('status', statusFilter)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })
}

function useDisputeEvents(disputeId: string | null) {
  return useQuery<DisputeEvent[]>({
    queryKey: ['admin-dispute-events-mobile', disputeId],
    enabled: !!disputeId,
    queryFn: async () => {
      const { data } = await supabase
        .from('dispute_events')
        .select('id, type, actor_role, content, created_at')
        .eq('dispute_id', disputeId!)
        .order('created_at', { ascending: true })
      return (data ?? []) as DisputeEvent[]
    },
  })
}

function DisputeDetailModal({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) {
  const { px, fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data: events = [], isLoading } = useDisputeEvents(dispute.id)
  const [reply, setReply] = useState('')
  const meta = STATUS_META[dispute.status] ?? STATUS_META.open

  const sendReply = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: dispute.id,
        type: 'comment',
        actor_id: user?.id,
        actor_role: 'admin',
        content: reply.trim(),
      })
      if (error) throw error
      if (dispute.status === 'open') {
        await supabase.from('disputes').update({ status: 'under_review' }).eq('id', dispute.id)
      }
    },
    onSuccess: () => {
      setReply('')
      qc.invalidateQueries({ queryKey: ['admin-dispute-events-mobile', dispute.id] })
      qc.invalidateQueries({ queryKey: ['admin-disputes-mobile'] })
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  const resolve = useMutation({
    mutationFn: async (newStatus: 'resolved' | 'closed') => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('disputes').update({ status: newStatus, resolution_notes: reply.trim() || null }).eq('id', dispute.id)
      if (error) throw error
      await supabase.from('dispute_events').insert({
        dispute_id: dispute.id,
        type: 'status_changed',
        actor_id: user?.id,
        actor_role: 'admin',
        content: newStatus === 'resolved' ? 'Litige marqué comme résolu' : 'Litige clôturé',
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-dispute-events-mobile', dispute.id] })
      qc.invalidateQueries({ queryKey: ['admin-disputes-mobile'] })
      onClose()
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: px, paddingVertical: scale(14), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
            <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>{dispute.case_number}</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: px, gap: scale(16) }}>
            <View style={{ gap: scale(6) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 999, backgroundColor: meta.bg }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                </View>
                {dispute.priority === 'urgent' && (
                  <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 999, backgroundColor: '#fce4ec' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>Urgent</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>{dispute.reason}</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                Patient : {dispute.patient?.full_name ?? '—'} · Praticien : {dispute.practitioner?.full_name ?? '—'}
              </Text>
              {dispute.description ? (
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#3f484d', lineHeight: scale(20) }}>{dispute.description}</Text>
              ) : null}
            </View>

            <View style={{ gap: scale(10) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5 }}>Historique</Text>
              {isLoading ? (
                <ActivityIndicator color="#82d8ff" />
              ) : events.map(ev => (
                <View key={ev.id} style={{ borderLeftWidth: 2, borderLeftColor: '#e5eeff', paddingLeft: scale(12), paddingBottom: scale(4) }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>
                    {ACTOR_LABEL[ev.actor_role] ?? ev.actor_role} · {fmtDate(ev.created_at)}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#3f484d', marginTop: 2 }}>{ev.content}</Text>
                </View>
              ))}
            </View>

            {!['resolved', 'closed'].includes(dispute.status) && (
              <View style={{ gap: scale(10) }}>
                <TextInput
                  value={reply} onChangeText={setReply} placeholder="Répondre ou ajouter une note de résolution..."
                  multiline numberOfLines={3}
                  style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#e5eeff', borderRadius: 10, padding: scale(12), minHeight: scale(70), textAlignVertical: 'top' }}
                />
                <TouchableOpacity
                  onPress={() => reply.trim() && sendReply.mutate()}
                  disabled={!reply.trim() || sendReply.isPending}
                  style={{ paddingVertical: scale(12), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center', opacity: reply.trim() ? 1 : 0.5 }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Envoyer la réponse</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: scale(10) }}>
                  <TouchableOpacity onPress={() => resolve.mutate('resolved')} disabled={resolve.isPending}
                    style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, borderWidth: 1, borderColor: '#1d7a3a', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#1d7a3a' }}>Marquer résolu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => resolve.mutate('closed')} disabled={resolve.isPending}
                    style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, borderWidth: 1, borderColor: '#6f787e', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e' }}>Clôturer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export default function AdminDisputesScreen() {
  const { fs, scale } = useResponsive()
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_TABS[number]>('all')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const { data: disputes = [], isLoading } = useAllDisputes(statusFilter)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {selected && <DisputeDetailModal dispute={selected} onClose={() => setSelected(null)} />}

      <View style={{ paddingHorizontal: scale(20), paddingTop: scale(14), paddingBottom: scale(10), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', marginBottom: scale(12) }}>Litiges</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8) }}>
          {STATUS_TABS.map(s => (
            <TouchableOpacity key={s} onPress={() => setStatusFilter(s)}
              style={{ paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: statusFilter === s ? '#82d8ff' : '#e5eeff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: statusFilter === s ? '#fff' : '#82d8ff' }}>
                {s === 'all' ? 'Tous' : STATUS_META[s]?.label ?? s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(10) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : disputes.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="gavel" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun litige</Text>
          </View>
        ) : disputes.map(d => {
          const meta = STATUS_META[d.status] ?? STATUS_META.open
          return (
            <TouchableOpacity key={d.id} onPress={() => setSelected(d)}
              style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(6) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e' }}>{d.case_number}</Text>
                <View style={{ paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: 999, backgroundColor: meta.bg }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{d.reason}</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                {d.patient?.full_name ?? '—'} vs {d.practitioner?.full_name ?? '—'} · {fmtDate(d.created_at)}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
