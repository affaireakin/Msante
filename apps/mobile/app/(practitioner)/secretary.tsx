import { useState } from 'react'
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useResponsive } from '@/hooks/useResponsive'

interface Secretary {
  id: string
  status: 'active' | 'revoked'
  user: { full_name: string; email: string | null } | null
}

function useSecretaries(practitionerId: string | undefined) {
  return useQuery<Secretary[]>({
    queryKey: ['practitioner-secretaries', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioner_secretaries')
        .select('id, status, user:user_id(full_name, email)')
        .eq('practitioner_id', practitionerId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Secretary[]
    },
  })
}

export default function ManageSecretariesScreen() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const { practitioner } = useAuth()
  const queryClient = useQueryClient()
  const { data: secretaries, isLoading } = useSecretaries(practitioner?.id)

  const [inviting, setInviting] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('invite-practitioner', {
        body: { firstname, lastname, email, phone, account_type: 'secretary' },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
    },
    onSuccess: () => {
      Alert.alert('Invitation envoyée', `${firstname} recevra un email avec un code de vérification.`)
      setInviting(false)
      setFirstname(''); setLastname(''); setEmail(''); setPhone('')
      queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] })
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message || "Impossible d'envoyer l'invitation."),
  })

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioner_secretaries').update({ status: 'revoked' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] }),
  })

  const reactivate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioner_secretaries').update({ status: 'active' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['practitioner-secretaries'] }),
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), paddingHorizontal: px, paddingTop: scale(16), paddingBottom: scale(12) }}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5eeff' }}
        >
          <MaterialIcons name="arrow-back" size={scale(20)} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xl, fontWeight: '800', color: '#0b1c30' }}>Mes secrétaires</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, gap: scale(14) }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>
          Déléguez la gestion de vos rendez-vous (confirmer, reporter, annuler) à un(e) assistant(e).
        </Text>

        {inviting ? (
          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(10) }}>
            <View style={{ flexDirection: 'row', gap: scale(10) }}>
              <TextInput value={firstname} onChangeText={setFirstname} placeholder="Prénom" placeholderTextColor="#bec8ce"
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }} />
              <TextInput value={lastname} onChangeText={setLastname} placeholder="Nom" placeholderTextColor="#bec8ce"
                style={{ flex: 1, borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }} />
            </View>
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#bec8ce" keyboardType="email-address" autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }} />
            <TextInput value={phone} onChangeText={setPhone} placeholder="Téléphone (optionnel)" placeholderTextColor="#bec8ce" keyboardType="phone-pad"
              style={{ borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(10), paddingHorizontal: scale(12), paddingVertical: scale(10), fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }} />
            <View style={{ flexDirection: 'row', gap: scale(10), marginTop: scale(4) }}>
              <TouchableOpacity onPress={() => setInviting(false)} style={{ flex: 1, paddingVertical: scale(12), borderRadius: 9999, alignItems: 'center', borderWidth: 1, borderColor: '#e5eeff' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#6f787e' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => invite.mutate()}
                disabled={invite.isPending || !firstname.trim() || !lastname.trim() || !email.trim()}
                style={{ flex: 1, paddingVertical: scale(12), borderRadius: 9999, alignItems: 'center', backgroundColor: '#82d8ff', opacity: (!firstname.trim() || !lastname.trim() || !email.trim()) ? 0.5 : 1 }}
              >
                {invite.isPending ? <ActivityIndicator color="#0b1c30" /> : (
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Envoyer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setInviting(true)}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingVertical: scale(14), borderRadius: 9999, backgroundColor: '#82d8ff' }}
          >
            <MaterialIcons name="person-add" size={scale(18)} color="#0b1c30" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Inviter un(e) secrétaire</Text>
          </TouchableOpacity>
        )}

        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : (secretaries ?? []).length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingTop: scale(32) }}>
            <MaterialIcons name="support-agent" size={scale(40)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '700', color: '#0b1c30' }}>Aucun(e) secrétaire</Text>
          </View>
        ) : (
          (secretaries ?? []).map(s => (
            <View key={s.id} style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff',
              padding: scale(14),
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), flex: 1 }}>
                <View style={{ width: scale(38), height: scale(38), borderRadius: scale(12), backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="support-agent" size={scale(18)} color="#005e7a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{s.user?.full_name ?? '—'}</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{s.user?.email ?? ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => (s.status === 'active' ? revoke : reactivate).mutate(s.id)}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: s.status === 'active' ? '#ba1a1a' : '#005e7a' }}>
                  {s.status === 'active' ? 'Révoquer' : 'Réactiver'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
