'use client'
import { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Modal, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'

const REASONS = [
  'Annulation non justifiée du praticien',
  'Praticien absent lors de la consultation',
  'Problème de paiement / remboursement',
  'Qualité de soin insuffisante',
  'Comportement inapproprié',
  'Autre',
]

const STATUS_META: Record<string, { label: string; bg: string; text: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }> = {
  open:         { label: 'Ouvert',    bg: '#fff8e1', text: '#705d00', icon: 'pending' },
  under_review: { label: 'En revue', bg: '#e5eeff', text: '#82d8ff', icon: 'manage-search' },
  resolved:     { label: 'Résolu',   bg: '#e8f5e9', text: '#1d7a3a', icon: 'check-circle' },
  closed:       { label: 'Clôturé',  bg: '#f5f5f5', text: '#6f787e', icon: 'lock' },
}

interface Dispute {
  id: string
  case_number: string
  reason: string
  description: string | null
  status: string
  priority: string
  created_at: string
  practitioner: { full_name: string } | null
}

interface DisputeEvent {
  id: string
  type: string
  actor_role: string
  content: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DisputesScreen() {
  const { profile } = useAuthStore()
  const { px, fs, scale } = useResponsive()
  const qc = useQueryClient()

  const [selected, setSelected] = useState<Dispute | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [description, setDescription] = useState('')
  const [comment, setComment] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const { data: disputes = [], isLoading, refetch, isRefetching } = useQuery<Dispute[]>({
    queryKey: ['patient-disputes', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disputes')
        .select('id, case_number, reason, description, status, priority, created_at, practitioner:practitioner_id(full_name)')
        .eq('patient_id', profile!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Dispute[]
    },
  })

  const { data: events = [] } = useQuery<DisputeEvent[]>({
    queryKey: ['dispute-events', selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_events')
        .select('id, type, actor_role, content, created_at')
        .eq('dispute_id', selected!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as DisputeEvent[]
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('disputes').insert({
        patient_id: profile!.id,
        practitioner_id: profile!.id, // placeholder — idéalement sélectionner le praticien
        reason,
        description: description.trim() || null,
        case_number: '',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patient-disputes'] })
      setShowNew(false)
      setDescription('')
      setReason(REASONS[0])
      setSubmitError(null)
    },
    onError: (e: Error) => setSubmitError(e.message),
  })

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!selected || !comment.trim()) return
      const { error } = await supabase.from('dispute_events').insert({
        dispute_id: selected.id,
        type: 'comment',
        actor_role: 'patient',
        content: comment.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dispute-events', selected?.id] })
      setComment('')
    },
  })

  const ROLE_LABEL: Record<string, string> = {
    patient: 'Vous',
    admin: 'Support M-Santé',
    practitioner: 'Praticien',
    system: 'Système',
  }

  const ROLE_COLOR: Record<string, string> = {
    patient: '#82d8ff',
    admin: '#705d00',
    practitioner: '#5c5f61',
    system: '#bec8ce',
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: px, paddingTop: scale(20), paddingBottom: scale(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.5 }}>
            Mes litiges
          </Text>
          <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>
            {disputes.length} dossier{disputes.length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowNew(true)}
          style={{ backgroundColor: '#82d8ff', borderRadius: scale(14), paddingHorizontal: scale(14), paddingVertical: scale(10), flexDirection: 'row', alignItems: 'center', gap: scale(6) }}
        >
          <MaterialIcons name="add" size={scale(18)} color="#0b1c30" />
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.sm, fontFamily: 'Manrope' }}>Ouvrir</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, gap: scale(12) }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#82d8ff" />}
        >
          {disputes.length === 0 && (
            <View style={{ alignItems: 'center', paddingTop: scale(60), gap: scale(12) }}>
              <View style={{ width: scale(72), height: scale(72), borderRadius: scale(36), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="gavel" size={scale(34)} color="#82d8ff" />
              </View>
              <Text style={{ fontSize: fs.xl, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Aucun litige</Text>
              <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
                Vous n'avez pas encore ouvert de réclamation.
              </Text>
            </View>
          )}

          {disputes.map(d => {
            const meta = STATUS_META[d.status] ?? STATUS_META.open
            return (
              <TouchableOpacity
                key={d.id}
                onPress={() => setSelected(d)}
                style={{ backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', overflow: 'hidden', shadowColor: '#82d8ff', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
              >
                <View style={{ padding: scale(16), gap: scale(10) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', letterSpacing: 0.5 }}>
                      {d.case_number}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: scale(6) }}>
                      {d.priority === 'urgent' && (
                        <View style={{ backgroundColor: '#fce4ec', borderRadius: scale(8), paddingHorizontal: scale(8), paddingVertical: scale(3) }}>
                          <Text style={{ fontSize: fs.xs, color: '#ba1a1a', fontWeight: '700', fontFamily: 'Manrope' }}>URGENT</Text>
                        </View>
                      )}
                      <View style={{ backgroundColor: meta.bg, borderRadius: scale(8), paddingHorizontal: scale(8), paddingVertical: scale(3), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <MaterialIcons name={meta.icon} size={scale(12)} color={meta.text} />
                        <Text style={{ fontSize: fs.xs, color: meta.text, fontWeight: '700', fontFamily: 'Manrope' }}>{meta.label}</Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ fontSize: fs.md, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }} numberOfLines={2}>
                    {d.reason}
                  </Text>
                  {d.practitioner && (
                    <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>
                      Praticien : {d.practitioner.full_name}
                    </Text>
                  )}
                  <Text style={{ fontSize: fs.xs, color: '#bec8ce', fontFamily: 'Manrope' }}>
                    Ouvert le {formatDate(d.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      )}

      {/* Modal détail litige */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
          <View style={{ paddingHorizontal: px, paddingVertical: scale(16), flexDirection: 'row', alignItems: 'center', gap: scale(12), borderBottomWidth: 1, borderBottomColor: '#e5eeff' }}>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <MaterialIcons name="close" size={scale(22)} color="#6f787e" />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: fs.lg, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
              {selected?.case_number}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 120, paddingTop: scale(16), gap: scale(16) }}>
            {/* Raison */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), padding: scale(16), gap: scale(6), borderWidth: 1, borderColor: '#e5eeff' }}>
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 0.5 }}>Motif</Text>
              <Text style={{ fontSize: fs.md, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>{selected?.reason}</Text>
              {selected?.description && (
                <Text style={{ fontSize: fs.sm, color: '#3f484d', fontFamily: 'Manrope', lineHeight: scale(20), marginTop: 4 }}>{selected.description}</Text>
              )}
            </View>

            {/* Timeline événements */}
            <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
              Historique
            </Text>
            <View style={{ gap: scale(10) }}>
              {events.map(ev => (
                <View key={ev.id} style={{ flexDirection: 'row', gap: scale(12) }}>
                  <View style={{ width: 2, backgroundColor: '#e5eeff', alignSelf: 'stretch', marginTop: scale(4) }} />
                  <View style={{ flex: 1, gap: scale(2) }}>
                    <Text style={{ fontSize: fs.xs, fontWeight: '700', fontFamily: 'Manrope', color: ROLE_COLOR[ev.actor_role] ?? '#6f787e' }}>
                      {ROLE_LABEL[ev.actor_role] ?? ev.actor_role}
                    </Text>
                    <Text style={{ fontSize: fs.sm, color: '#0b1c30', fontFamily: 'Manrope', lineHeight: scale(20) }}>{ev.content}</Text>
                    <Text style={{ fontSize: scale(10), color: '#bec8ce', fontFamily: 'Manrope' }}>{formatDate(ev.created_at)}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Ajouter un commentaire */}
            {selected && (selected.status === 'open' || selected.status === 'under_review') && (
              <View style={{ gap: scale(10) }}>
                <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Manrope' }}>
                  Ajouter un commentaire
                </Text>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Votre message..."
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#bec8ce"
                  style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(12), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), fontSize: fs.sm, fontFamily: 'Manrope', color: '#0b1c30', minHeight: scale(100), textAlignVertical: 'top' }}
                />
                <TouchableOpacity
                  onPress={() => commentMutation.mutate()}
                  disabled={!comment.trim() || commentMutation.isPending}
                  style={{ backgroundColor: comment.trim() ? '#82d8ff' : '#bec8ce', borderRadius: scale(12), paddingVertical: scale(13), alignItems: 'center' }}
                >
                  <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.md, fontFamily: 'Manrope' }}>
                    {commentMutation.isPending ? 'Envoi…' : 'Envoyer'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal nouveau litige */}
      <Modal visible={showNew} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowNew(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
          <View style={{ paddingHorizontal: px, paddingVertical: scale(16), flexDirection: 'row', alignItems: 'center', gap: scale(12), borderBottomWidth: 1, borderBottomColor: '#e5eeff' }}>
            <TouchableOpacity onPress={() => setShowNew(false)}>
              <MaterialIcons name="close" size={scale(22)} color="#6f787e" />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: fs.lg, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>
              Ouvrir un litige
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, paddingTop: scale(20), gap: scale(16) }}>
            <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope', lineHeight: scale(20) }}>
              Décrivez votre problème. Notre équipe examinera votre demande sous 48h.
            </Text>

            {/* Motif */}
            <View style={{ gap: scale(8) }}>
              <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Motif *</Text>
              {REASONS.map(r => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setReason(r)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), padding: scale(14), backgroundColor: reason === r ? '#e5eeff' : 'rgba(255,255,255,0.9)', borderRadius: scale(12), borderWidth: 1, borderColor: reason === r ? '#82d8ff' : '#e5eeff' }}
                >
                  <View style={{ width: scale(18), height: scale(18), borderRadius: scale(9), borderWidth: 2, borderColor: reason === r ? '#82d8ff' : '#bec8ce', alignItems: 'center', justifyContent: 'center' }}>
                    {reason === r && <View style={{ width: scale(9), height: scale(9), borderRadius: scale(5), backgroundColor: '#82d8ff' }} />}
                  </View>
                  <Text style={{ flex: 1, fontSize: fs.sm, fontFamily: 'Manrope', color: '#0b1c30', fontWeight: reason === r ? '600' : '400' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <View style={{ gap: scale(8) }}>
              <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Description (optionnel)</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez les faits en détail..."
                multiline
                numberOfLines={5}
                placeholderTextColor="#bec8ce"
                style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(12), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), fontSize: fs.sm, fontFamily: 'Manrope', color: '#0b1c30', minHeight: scale(120), textAlignVertical: 'top' }}
              />
            </View>

            {submitError && (
              <Text style={{ fontSize: fs.sm, color: '#ba1a1a', fontFamily: 'Manrope' }}>{submitError}</Text>
            )}

            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#82d8ff', borderRadius: scale(14), paddingVertical: scale(15), alignItems: 'center' }}
            >
              <Text style={{ color: '#0b1c30', fontWeight: '800', fontSize: fs.md, fontFamily: 'Manrope' }}>
                {createMutation.isPending ? 'Envoi…' : 'Soumettre le litige'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}
