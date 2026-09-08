import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

type VerifStatus = 'pending' | 'under_review' | 'approved' | 'rejected'

interface OrgPractitioner {
  id: string
  user_id: string
  speciality: string
  verification_status: VerifStatus
  org_validated_at: string | null
  users: { full_name: string } | null
}

const STATUS_LABELS: Record<VerifStatus, string> = {
  pending: 'En attente', under_review: 'En revue', approved: 'Validé', rejected: 'Rejeté',
}
const STATUS_META: Record<VerifStatus, { bg: string; color: string }> = {
  pending: { bg: '#fef3c7', color: '#92400e' },
  under_review: { bg: '#e0f2fe', color: '#0369a1' },
  approved: { bg: '#dcfce7', color: '#166534' },
  rejected: { bg: '#ffdad6', color: '#ba1a1a' },
}

function useMyOrgId() {
  return useQuery<string | null>({
    queryKey: ['my-org-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      return profile?.organization_id ?? null
    },
    staleTime: 5 * 60_000,
  })
}

function useOrgPractitioners(organizationId: string | null | undefined) {
  return useQuery<OrgPractitioner[]>({
    queryKey: ['org-practitioners-mobile', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('id, user_id, speciality, verification_status, org_validated_at, users!user_id(full_name)')
        .eq('organization_id', organizationId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as OrgPractitioner[]
    },
  })
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function InviteModal({ onClose, organizationId }: { onClose: () => void; organizationId: string }) {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('invite-practitioner', { body: { firstname, lastname, email, phone } })
      if (error) throw error
    },
    onSuccess: () => {
      setSent(true)
      qc.invalidateQueries({ queryKey: ['org-practitioners-mobile', organizationId] })
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingVertical: scale(16), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Inviter un praticien</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>
        {sent ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12), paddingHorizontal: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="check-circle" size={32} color="#059669" />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Invitation envoyée !</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', textAlign: 'center' }}>{firstname} recevra un email avec un code de vérification.</Text>
            <TouchableOpacity onPress={onClose} style={{ width: '100%', paddingVertical: 14, borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
            <TextInput placeholder="Prénom" value={firstname} onChangeText={setFirstname}
              style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }} />
            <TextInput placeholder="Nom" value={lastname} onChangeText={setLastname}
              style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }} />
            <TextInput placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"
              style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }} />
            <TextInput placeholder="Téléphone (optionnel)" value={phone} onChangeText={setPhone} keyboardType="phone-pad"
              style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }} />
            <TouchableOpacity
              onPress={() => invite.mutate()}
              disabled={!firstname.trim() || !lastname.trim() || !email.trim() || invite.isPending}
              style={{ paddingVertical: 14, borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center', opacity: (!firstname.trim() || !lastname.trim() || !email.trim()) ? 0.5 : 1, marginTop: scale(8) }}
            >
              {invite.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Envoyer l&apos;invitation</Text>}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  )
}

export default function OrganizationPractitionersScreen() {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)
  const { data: organizationId } = useMyOrgId()
  const { data: practitioners = [], isLoading } = useOrgPractitioners(organizationId)

  const validate = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { error } = await supabase.functions.invoke('validate-org-practitioner', { body: { practitioner_id: practitionerId } })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-practitioners-mobile', organizationId] }),
    onError: (e: Error) => Alert.alert('Erreur', `Impossible de valider : ${e.message}`),
  })

  const detach = useMutation({
    mutationFn: async (practitionerId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.functions.invoke('detach-org-practitioner', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { practitioner_id: practitionerId },
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-practitioners-mobile', organizationId] }),
    onError: (e: Error) => Alert.alert('Erreur', `Impossible de retirer ce praticien : ${e.message}`),
  })

  const handleDetach = (id: string, name: string) => {
    Alert.alert(`Retirer ${name}`, "Il/elle exercera ensuite en indépendant.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Retirer', style: 'destructive', onPress: () => detach.mutate(id) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {organizationId && showInvite && <InviteModal organizationId={organizationId} onClose={() => setShowInvite(false)} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Praticiens</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="person-add" size={18} color="#0b1c30" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), paddingBottom: scale(110), gap: scale(10) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : practitioners.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="group" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun praticien pour le moment</Text>
          </View>
        ) : practitioners.map(p => {
          const meta = STATUS_META[p.verification_status]
          const name = p.users?.full_name ?? '—'
          return (
            <View key={p.id} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(10) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
                <View style={{ width: scale(42), height: scale(42), borderRadius: scale(21), backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: fs.sm, color: '#0b1c30' }}>{getInitials(name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{name}</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{p.speciality || 'Spécialité non renseignée'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(6) }}>
                <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 999, backgroundColor: meta.bg }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>M-Santé : {STATUS_LABELS[p.verification_status]}</Text>
                </View>
                <View style={{ paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: 999, backgroundColor: p.org_validated_at ? '#dcfce7' : '#fef3c7' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: p.org_validated_at ? '#166534' : '#92400e' }}>
                    Organisation : {p.org_validated_at ? 'Validé' : 'En attente'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: scale(10) }}>
                {!p.org_validated_at && (
                  <TouchableOpacity onPress={() => validate.mutate(p.id)} disabled={validate.isPending}
                    style={{ flex: 1, paddingVertical: scale(9), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>Valider</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDetach(p.id, name)} disabled={detach.isPending}
                  style={{ flex: 1, paddingVertical: scale(9), borderRadius: 999, borderWidth: 1, borderColor: '#ba1a1a', alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>Retirer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}
