import { useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'

interface ConversationPreview {
  partnerId: string
  partnerName: string
  lastMessage: string
  lastAt: string
  unread: number
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'Hier' : `${days} j`
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

interface MyPractitioner {
  userId: string
  fullName: string
  speciality: string
}

// Nouveau message : on ne laisse choisir que des praticiens avec qui le
// patient a effectivement un rendez-vous — pas une recherche libre parmi
// tous les praticiens de la plateforme.
function useMyPractitioners(enabled: boolean) {
  const { profile } = useAuthStore()
  return useQuery<MyPractitioner[]>({
    queryKey: ['my-practitioners-for-message', profile?.id],
    enabled: enabled && !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('practitioners(user_id, speciality, users(full_name))')
        .eq('patient_id', profile!.id)
      if (error) throw error
      const map = new Map<string, MyPractitioner>()
      for (const row of (data ?? [])) {
        const pract = row.practitioners as unknown as { user_id: string; speciality: string; users: { full_name: string } } | null
        if (!pract || map.has(pract.user_id)) continue
        map.set(pract.user_id, { userId: pract.user_id, fullName: pract.users?.full_name ?? 'Praticien', speciality: pract.speciality })
      }
      return Array.from(map.values())
    },
  })
}

function NewMessageModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { data: practitioners = [], isLoading } = useMyPractitioners(true)

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Nouveau message</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#82d8ff" size="large" />
          </View>
        ) : practitioners.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 40 }}>
            <MaterialIcons name="medical-services" size={36} color="#bec8ce" />
            <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
              Vous pourrez contacter un praticien après un premier rendez-vous.
            </Text>
          </View>
        ) : (
          <FlatList
            data={practitioners}
            keyExtractor={p => p.userId}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onClose()
                  router.push({ pathname: '/(patient)/messages/[id]', params: { id: item.userId, name: item.fullName, speciality: item.speciality } })
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 15, color: '#82d8ff' }}>{getInitials(item.fullName)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{item.fullName}</Text>
                  <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>{item.speciality}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </Modal>
  )
}

export default function PatientMessagesScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const [showNewMessage, setShowNewMessage] = useState(false)

  const { data: conversations = [], isLoading, isError, refetch, isRefetching } = useQuery<ConversationPreview[]>({
    queryKey: ['conversations', profile?.id],
    enabled: !!profile?.id,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, read_at, created_at, sender:users!messages_sender_id_fkey(id, full_name), receiver:users!messages_receiver_id_fkey(id, full_name)')
        .or(`sender_id.eq.${profile!.id},receiver_id.eq.${profile!.id}`)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error

      const map = new Map<string, ConversationPreview>()
      for (const msg of (msgs ?? [])) {
        const isMe = msg.sender_id === profile!.id
        const partner = isMe
          ? (msg.receiver as unknown as { id: string; full_name: string })
          : (msg.sender as unknown as { id: string; full_name: string })
        if (!partner || map.has(partner.id)) continue
        const unread = (msgs ?? []).filter(
          m => m.sender_id === partner.id && m.receiver_id === profile!.id && !m.read_at
        ).length
        map.set(partner.id, {
          partnerId: partner.id,
          partnerName: partner.full_name,
          lastMessage: msg.body,
          lastAt: msg.created_at,
          unread,
        })
      }
      return Array.from(map.values())
    },
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header — écran racine de l'onglet Messagerie, plus de bouton retour */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
          Messagerie
        </Text>
        <TouchableOpacity onPress={() => setShowNewMessage(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="add" size={20} color="#0b1c30" />
        </TouchableOpacity>
      </View>

      {showNewMessage && <NewMessageModal onClose={() => setShowNewMessage(false)} />}

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" size="large" />
        </View>
      ) : isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontSize: 15, color: '#6f787e', fontFamily: 'Manrope' }}>Une erreur est survenue</Text>
          <TouchableOpacity onPress={() => refetch()} style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#82d8ff' }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#0b1c30' }}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="chat-bubble-outline" size={36} color="#82d8ff" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Aucun message
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
            Échangez en toute sécurité avec vos praticiens.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.partnerId}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(226,232,240,0.5)', marginLeft: 76 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(patient)/messages/[id]', params: { id: item.partnerId, name: item.partnerName } })}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item.unread > 0 ? 'rgba(0,102,133,0.03)' : 'transparent' }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 16, color: '#82d8ff' }}>
                  {getInitials(item.partnerName)}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Manrope', fontWeight: item.unread > 0 ? '700' : '600', color: '#0b1c30' }}>
                    {item.partnerName}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>
                    {relativeTime(item.lastAt)}
                  </Text>
                </View>
                <Text style={{ fontSize: 13, color: item.unread > 0 ? '#0b1c30' : '#6f787e', fontFamily: 'Manrope', fontWeight: item.unread > 0 ? '600' : '400' }} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              {item.unread > 0 && (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', fontFamily: 'Manrope' }}>
                    {item.unread > 9 ? '9+' : item.unread}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}
