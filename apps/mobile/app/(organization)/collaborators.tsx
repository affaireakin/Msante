import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'
import { AppTextInput } from '@/components/ui/AppTextInput'

interface Collaborator { id: string; full_name: string; email: string | null; created_at: string }
interface PendingInvitation { id: string; firstname: string; lastname: string; email: string; created_at: string }

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

function useCollaborators(organizationId: string | null | undefined) {
  return useQuery<Collaborator[]>({
    queryKey: ['org-collaborators', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, created_at')
        .eq('organization_id', organizationId as string)
        .in('role', ['organization_member', 'secretary'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Collaborator[]
    },
  })
}

function usePendingInvitations(organizationId: string | null | undefined) {
  return useQuery<PendingInvitation[]>({
    queryKey: ['org-pending-collaborator-invitations', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_invitations')
        .select('id, firstname, lastname, email, created_at')
        .eq('organization_id', organizationId as string)
        .eq('account_type', 'collaborator')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as PendingInvitation[]
    },
  })
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

function InviteModal({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [sent, setSent] = useState(false)

  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('invite-practitioner', {
        body: { firstname, lastname, email, phone, account_type: 'collaborator' },
      })
      if (error) throw error
    },
    onSuccess: () => {
      setSent(true)
      qc.invalidateQueries({ queryKey: ['org-pending-collaborator-invitations', organizationId] })
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingVertical: scale(16), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Inviter un collaborateur</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>

        {sent ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: scale(12), paddingHorizontal: 40 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="check-circle" size={32} color="#059669" />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Invitation envoyée !</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', textAlign: 'center' }}>
              {firstname} recevra un email avec un code de vérification.
            </Text>
            <TouchableOpacity onPress={onClose} style={{ width: '100%', paddingVertical: 14, borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Fermer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(12) }}>
            <AppTextInput label="Prénom" required placeholder="Ex. Aminata" value={firstname} onChangeText={setFirstname} />
            <AppTextInput label="Nom" required placeholder="Ex. Diallo" value={lastname} onChangeText={setLastname} />
            <AppTextInput label="Adresse email" required placeholder="Ex. a.diallo@exemple.sn"
              hint="L'invitation et le code de vérification y seront envoyés."
              value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <AppTextInput label="Téléphone" placeholder="Ex. +221 77 123 45 67"
              hint="Facultatif — utilisé uniquement pour vous joindre en cas de besoin."
              value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

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

export default function OrganizationCollaboratorsScreen() {
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const [showInvite, setShowInvite] = useState(false)

  const { data: organizationId } = useMyOrgId()
  const { data: collaborators = [], isLoading } = useCollaborators(organizationId)
  const { data: pending = [] } = usePendingInvitations(organizationId)

  const revoke = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.functions.invoke('revoke-collaborator', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { target_user_id: userId },
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['org-collaborators', organizationId] }),
    onError: (e: Error) => Alert.alert('Erreur', `Impossible de révoquer l'accès : ${e.message}`),
  })

  const handleRevoke = (id: string, name: string) => {
    Alert.alert(`Révoquer ${name}`, "Cette personne n'aura plus accès à l'organisation.", [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Révoquer', style: 'destructive', onPress: () => revoke.mutate(id) },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {organizationId && showInvite && <InviteModal organizationId={organizationId} onClose={() => setShowInvite(false)} />}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Mon équipe</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="add" size={20} color="#0b1c30" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : (
          <>
            {pending.length > 0 && (
              <View style={{ gap: scale(8) }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Invitations en attente</Text>
                {pending.map(inv => (
                  <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: '#fef3c7', borderRadius: scale(14), padding: scale(12) }}>
                    <MaterialIcons name="hourglass-empty" size={scale(16)} color="#92400e" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{inv.firstname} {inv.lastname}</Text>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{inv.email}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={{ gap: scale(8) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Collaborateurs</Text>
              {collaborators.length === 0 ? (
                <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(32) }}>
                  <MaterialIcons name="group" size={scale(36)} color="#bec8ce" />
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun collaborateur pour l&apos;instant</Text>
                </View>
              ) : collaborators.map(c => (
                <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14) }}>
                  <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: fs.sm, color: '#82d8ff' }}>{getInitials(c.full_name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{c.full_name}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{c.email}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRevoke(c.id, c.full_name)}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#ba1a1a' }}>Révoquer</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
