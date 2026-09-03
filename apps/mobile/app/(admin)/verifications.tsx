import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface PendingPractitioner {
  id: string
  user_id: string
  speciality: string
  practitioner_type: string | null
  created_at: string
  users: { full_name: string } | null
}

interface PendingOrganization {
  id: string
  name: string
  email: string
  city: string | null
  created_at: string
}

function usePendingPractitioners() {
  return useQuery<PendingPractitioner[]>({
    queryKey: ['admin-pending-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, practitioner_type, created_at, users!user_id(full_name)')
        .eq('verification_status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as PendingPractitioner[]
    },
  })
}

function usePendingOrganizations() {
  return useQuery<PendingOrganization[]>({
    queryKey: ['admin-pending-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name, email, city, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

function RejectModal({ title, onCancel, onConfirm }: { title: string; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const { fs, scale } = useResponsive()
  const [reason, setReason] = useState('')
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', backgroundColor: '#fff', borderRadius: scale(18), padding: scale(20), gap: scale(12) }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#0b1c30' }}>{title}</Text>
          <TextInput
            value={reason} onChangeText={setReason} placeholder="Motif du refus..." multiline numberOfLines={3}
            style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#e5eeff', borderRadius: 10, padding: scale(12), minHeight: scale(70), textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: scale(10) }}>
            <TouchableOpacity onPress={onCancel} style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, borderWidth: 1, borderColor: '#bec8ce', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e' }}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => reason.trim() && onConfirm(reason.trim())}
              disabled={!reason.trim()}
              style={{ flex: 1, paddingVertical: scale(12), borderRadius: 999, backgroundColor: '#ba1a1a', alignItems: 'center', opacity: reason.trim() ? 1 : 0.5 }}
            >
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#fff' }}>Refuser</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default function AdminVerificationsScreen() {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'practitioners' | 'organizations'>('practitioners')
  const [rejectingPract, setRejectingPract] = useState<{ id: string; userId: string } | null>(null)
  const [rejectingOrg, setRejectingOrg] = useState<string | null>(null)

  const { data: practitioners = [], isLoading: loadingPract } = usePendingPractitioners()
  const { data: organizations = [], isLoading: loadingOrgs } = usePendingOrganizations()

  const approvePract = useMutation({
    mutationFn: async ({ practId, userId }: { practId: string; userId: string }) => {
      const { error } = await supabase.from('practitioners').update({ verification_status: 'approved', is_verified: true }).eq('id', practId)
      if (error) throw error
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await supabase.functions.invoke('notify-practitioner-approved', { body: { practitionerUserId: userId } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-pending-practitioners'] }),
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  const rejectPract = useMutation({
    mutationFn: async ({ practId, userId, reason }: { practId: string; userId: string; reason: string }) => {
      const { error } = await supabase.from('practitioners').update({ verification_status: 'rejected' }).eq('id', practId)
      if (error) throw error
      const { data: { session } } = await supabase.auth.getSession()
      if (session) await supabase.functions.invoke('notify-practitioner-rejected', { body: { practitionerUserId: userId, reason } })
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-practitioners'] }); setRejectingPract(null) },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  const validateOrg = useMutation({
    mutationFn: async (body: { organization_id: string; action: 'approve' | 'reject'; note?: string }) => {
      const { error } = await supabase.functions.invoke('validate-organization', { body })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-pending-organizations'] }); setRejectingOrg(null) },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {rejectingPract && (
        <RejectModal
          title="Refuser ce praticien"
          onCancel={() => setRejectingPract(null)}
          onConfirm={reason => rejectPract.mutate({ practId: rejectingPract.id, userId: rejectingPract.userId, reason })}
        />
      )}
      {rejectingOrg && (
        <RejectModal
          title="Refuser cette organisation"
          onCancel={() => setRejectingOrg(null)}
          onConfirm={reason => validateOrg.mutate({ organization_id: rejectingOrg, action: 'reject', note: reason })}
        />
      )}

      <View style={{ paddingHorizontal: scale(20), paddingTop: scale(14), paddingBottom: scale(10), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', marginBottom: scale(12) }}>Vérifications</Text>
        <View style={{ flexDirection: 'row', gap: scale(8) }}>
          {[
            { key: 'practitioners' as const, label: `Praticiens${practitioners.length ? ` (${practitioners.length})` : ''}` },
            { key: 'organizations' as const, label: `Organisations${organizations.length ? ` (${organizations.length})` : ''}` },
          ].map(t => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)}
              style={{ paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: tab === t.key ? '#82d8ff' : '#e5eeff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: tab === t.key ? '#fff' : '#82d8ff' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12), paddingBottom: scale(100) }} showsVerticalScrollIndicator={false}>
        {tab === 'practitioners' ? (
          loadingPract ? (
            <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
          ) : practitioners.length === 0 ? (
            <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
              <MaterialIcons name="check-circle-outline" size={scale(36)} color="#1d7a3a" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun praticien en attente</Text>
            </View>
          ) : practitioners.map(p => (
            <View key={p.id} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{p.users?.full_name ?? 'Praticien'}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{p.speciality} · {p.practitioner_type === 'wellness' ? 'Bien-être' : 'Santé'}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: scale(8) }}>
                <TouchableOpacity
                  onPress={() => approvePract.mutate({ practId: p.id, userId: p.user_id })}
                  disabled={approvePract.isPending}
                  style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>Approuver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRejectingPract({ id: p.id, userId: p.user_id })}
                  style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, borderWidth: 1, borderColor: '#ba1a1a', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>Refuser</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          loadingOrgs ? (
            <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
          ) : organizations.length === 0 ? (
            <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
              <MaterialIcons name="check-circle-outline" size={scale(36)} color="#1d7a3a" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucune organisation en attente</Text>
            </View>
          ) : organizations.map(o => (
            <View key={o.id} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
              <View>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{o.name}</Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{o.email}{o.city ? ` · ${o.city}` : ''}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: scale(8) }}>
                <TouchableOpacity
                  onPress={() => validateOrg.mutate({ organization_id: o.id, action: 'approve' })}
                  disabled={validateOrg.isPending}
                  style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>Approuver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRejectingOrg(o.id)}
                  style={{ flex: 1, paddingVertical: scale(10), borderRadius: 999, borderWidth: 1, borderColor: '#ba1a1a', alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>Refuser</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
