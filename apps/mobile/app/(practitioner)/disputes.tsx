import { useState } from 'react'
import { View, Text, ScrollView, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

const PRACTITIONER_REASONS = [
  'Absence non justifiée du patient (no-show)',
  'Comportement inapproprié du patient',
  'Non-paiement',
  'Fausses informations fournies',
  'Autre',
]

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'Ouvert', color: '#92400e', bg: '#fef3c7' },
  under_review: { label: 'En revue', color: '#0369a1', bg: '#e0f2fe' },
  resolved: { label: 'Résolu', color: '#166534', bg: '#dcfce7' },
  closed: { label: 'Clôturé', color: '#475569', bg: '#f1f5f9' },
}

const ACTOR_LABEL: Record<string, string> = { patient: 'Patient', practitioner: 'Vous', admin: 'Admin', system: 'Système' }

interface Dispute {
  id: string
  case_number: string
  reason: string
  description: string | null
  status: string
  priority: string
  created_at: string
  patient: { full_name: string } | null
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

function useMyId() {
  return useQuery<string>({
    queryKey: ['my-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      return user!.id
    },
  })
}

function useMyPractId(myId: string | undefined) {
  return useQuery<string | null>({
    queryKey: ['my-pract-id', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data } = await supabase.from('practitioners').select('id').eq('user_id', myId!).single()
      return data?.id ?? null
    },
  })
}

function useDisputes(myId: string | undefined) {
  return useQuery<Dispute[]>({
    queryKey: ['practitioner-disputes-mobile', myId],
    enabled: !!myId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, patient:patient_id(full_name)')
        .eq('practitioner_id', myId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })
}

function useDisputeEvents(disputeId: string | null) {
  return useQuery<DisputeEvent[]>({
    queryKey: ['dispute-events-mobile', disputeId],
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

function useMyPatients(practId: string | undefined, enabled: boolean) {
  return useQuery<{ id: string; full_name: string }[]>({
    queryKey: ['practitioner-dispute-patients-mobile', practId],
    enabled: enabled && !!practId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('patient_id, users!patient_id(id, full_name)')
        .eq('practitioner_id', practId!)
      if (error) throw error
      const map = new Map<string, string>()
      for (const row of (data ?? []) as unknown as { patient_id: string; users: { id: string; full_name: string } | null }[]) {
        if (row.users) map.set(row.users.id, row.users.full_name)
      }
      return Array.from(map.entries()).map(([id, full_name]) => ({ id, full_name })).sort((a, b) => a.full_name.localeCompare(b.full_name))
    },
  })
}

function NewDisputeModal({ practId, onClose }: { practId: string | undefined; onClose: () => void }) {
  const { px, fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data: patients = [] } = useMyPatients(practId, true)
  const [patientId, setPatientId] = useState('')
  const [reason, setReason] = useState(PRACTITIONER_REASONS[0])
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  const create = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !patientId) throw new Error('Sélectionnez un patient')
      const { error: err } = await supabase.from('disputes').insert({
        patient_id: patientId,
        practitioner_id: user.id,
        reason,
        description: description.trim() || null,
        case_number: '',
      })
      if (err) throw err
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practitioner-disputes-mobile'] })
      onClose()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: px, paddingVertical: scale(14), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Ouvrir un litige</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: px, gap: scale(16) }}>
          <View>
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Patient concerné</Text>
            {patients.length === 0 ? (
              <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>Aucun patient éligible — un rendez-vous commun est requis.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {patients.map(p => (
                  <TouchableOpacity key={p.id} onPress={() => setPatientId(p.id)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      padding: scale(12), borderRadius: scale(12), borderWidth: 2,
                      borderColor: patientId === p.id ? '#82d8ff' : '#e5eeff',
                      backgroundColor: patientId === p.id ? '#eff4ff' : '#fff',
                    }}>
                    <Text style={{ fontSize: fs.sm, fontFamily: 'Manrope', color: '#0b1c30', fontWeight: '600' }}>{p.full_name}</Text>
                    {patientId === p.id && <MaterialIcons name="check-circle" size={18} color="#82d8ff" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View>
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Motif</Text>
            <View style={{ gap: 8 }}>
              {PRACTITIONER_REASONS.map(r => (
                <TouchableOpacity key={r} onPress={() => setReason(r)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    padding: scale(12), borderRadius: scale(12), borderWidth: 2,
                    borderColor: reason === r ? '#82d8ff' : '#e5eeff',
                    backgroundColor: reason === r ? '#eff4ff' : '#fff',
                  }}>
                  <Text style={{ fontSize: fs.sm, fontFamily: 'Manrope', color: '#0b1c30' }}>{r}</Text>
                  {reason === r && <MaterialIcons name="check-circle" size={18} color="#82d8ff" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Description</Text>
            <TextInput
              value={description} onChangeText={setDescription} multiline numberOfLines={4}
              placeholder="Détaillez la situation..."
              style={{ borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(12), padding: scale(12), fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', minHeight: 90, textAlignVertical: 'top', backgroundColor: '#fff' }}
            />
          </View>

          {error && <Text style={{ color: '#ba1a1a', fontSize: fs.sm, fontFamily: 'Manrope', fontWeight: '600' }}>{error}</Text>}

          <TouchableOpacity
            onPress={() => create.mutate()}
            disabled={!patientId || create.isPending}
            style={{ backgroundColor: '#82d8ff', borderRadius: scale(14), paddingVertical: scale(14), alignItems: 'center', opacity: (!patientId || create.isPending) ? 0.5 : 1 }}
          >
            {create.isPending ? <ActivityIndicator color="#0b1c30" /> : (
              <Text style={{ fontFamily: 'Manrope', fontWeight: '800', color: '#0b1c30', fontSize: fs.md }}>Créer le litige</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function DisputeDetailModal({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) {
  const { px, fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data: events = [] } = useDisputeEvents(dispute.id)
  const [comment, setComment] = useState('')
  const meta = STATUS_META[dispute.status] ?? STATUS_META.open
  const canReply = ['open', 'under_review'].includes(dispute.status)

  const sendComment = useMutation({
    mutationFn: async () => {
      if (!comment.trim()) return
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: dispute.id, type: 'comment', actor_role: 'practitioner', content: comment.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute-events-mobile', dispute.id] })
      setComment('')
    },
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ paddingHorizontal: px, paddingVertical: scale(14), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope' }}>{dispute.case_number}</Text>
                <Text style={{ fontSize: fs.md, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>{dispute.reason}</Text>
              </View>
              <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ backgroundColor: meta.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: meta.color, fontFamily: 'Manrope' }}>{meta.label}</Text>
              </View>
              <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope', alignSelf: 'center' }}>{dispute.patient?.full_name ?? '—'} · {fmtDate(dispute.created_at)}</Text>
            </View>
          </View>

          {dispute.description && (
            <View style={{ marginHorizontal: px, marginTop: scale(12), backgroundColor: '#f1f5f9', borderRadius: scale(12), padding: scale(12) }}>
              <Text style={{ fontSize: fs.sm, color: '#3f484d', fontFamily: 'Manrope' }}>{dispute.description}</Text>
            </View>
          )}

          <FlatList
            data={events}
            keyExtractor={e => e.id}
            contentContainerStyle={{ padding: px, gap: 12 }}
            style={{ flex: 1, marginTop: 8 }}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#6f787e', fontSize: fs.sm, fontFamily: 'Manrope', marginTop: 20 }}>Aucune activité</Text>}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ backgroundColor: '#e5eeff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#005e7a', fontFamily: 'Manrope' }}>{ACTOR_LABEL[item.actor_role] ?? item.actor_role}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs.sm, color: '#0b1c30', fontFamily: 'Manrope' }}>{item.content}</Text>
                  <Text style={{ fontSize: 10, color: '#bec8ce', fontFamily: 'Manrope', marginTop: 2 }}>{fmtDate(item.created_at)}</Text>
                </View>
              </View>
            )}
          />

          {canReply && (
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: px, paddingVertical: scale(12), borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)' }}>
              <TextInput
                value={comment} onChangeText={setComment} placeholder="Votre réponse..."
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5eeff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', backgroundColor: '#fff' }}
              />
              <TouchableOpacity onPress={() => sendComment.mutate()} disabled={!comment.trim() || sendComment.isPending}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center', opacity: (!comment.trim() || sendComment.isPending) ? 0.5 : 1 }}>
                <MaterialIcons name="send" size={18} color="#0b1c30" />
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

export default function PractitionerDisputesScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const { data: myId } = useMyId()
  const { data: practId } = useMyPractId(myId)
  const { data: disputes = [], isLoading } = useDisputes(myId)
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Dispute | null>(null)

  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ paddingHorizontal: px, paddingTop: scale(16), paddingBottom: scale(12) }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <MaterialIcons name="arrow-back" size={22} color="#82d8ff" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: fs.xl, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Litiges</Text>
            <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>Réclamations impliquant votre activité</Text>
          </View>
          <TouchableOpacity onPress={() => setShowNew(true)} style={{ backgroundColor: '#82d8ff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialIcons name="add" size={16} color="#0b1c30" />
            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Ouvrir</Text>
          </TouchableOpacity>
        </View>
        {openCount > 0 && (
          <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' }}>
            <MaterialIcons name="warning" size={14} color="#92400e" />
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#92400e', fontFamily: 'Manrope' }}>{openCount} en cours</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#82d8ff" style={{ marginTop: 40 }} />
      ) : disputes.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 60 }}>
          <MaterialIcons name="gavel" size={40} color="#bec8ce" />
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, color: '#6f787e' }}>Aucun litige</Text>
        </View>
      ) : (
        <FlatList
          data={disputes}
          keyExtractor={d => d.id}
          contentContainerStyle={{ paddingHorizontal: px, gap: 10, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.open
            return (
              <TouchableOpacity onPress={() => setSelected(item)}
                style={{ backgroundColor: '#fff', borderRadius: scale(16), padding: scale(14), borderWidth: 1, borderColor: '#e5eeff', gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>{item.case_number}</Text>
                    <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', marginTop: 2 }} numberOfLines={2}>{item.reason}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ backgroundColor: meta.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: meta.color, fontFamily: 'Manrope' }}>{meta.label}</Text>
                    </View>
                    {item.priority === 'urgent' && (
                      <View style={{ backgroundColor: '#ffdad6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#ba1a1a', fontFamily: 'Manrope' }}>Urgent</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>{item.patient?.full_name ?? '—'}</Text>
                  <Text style={{ fontSize: 11, color: '#bec8ce', fontFamily: 'Manrope' }}>{fmtDate(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}

      {showNew && <NewDisputeModal practId={practId ?? undefined} onClose={() => setShowNew(false)} />}
      {selected && <DisputeDetailModal dispute={selected} onClose={() => setSelected(null)} />}
    </SafeAreaView>
  )
}
