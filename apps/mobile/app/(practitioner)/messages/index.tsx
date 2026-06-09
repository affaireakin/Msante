import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
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

export default function PractitionerMessagesScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()

  const { data: conversations = [], isLoading } = useQuery<ConversationPreview[]>({
    queryKey: ['practitioner-conversations', profile?.id],
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
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
          Messages patients
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#e5eeff' }}>
          <MaterialIcons name="lock" size={12} color="#006685" />
          <Text style={{ fontSize: 11, fontFamily: 'Manrope', fontWeight: '600', color: '#006685' }}>Sécurisé</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#006685" size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="forum" size={36} color="#006685" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Aucune conversation
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
            Les messages de vos patients apparaîtront ici.
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.partnerId}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: 'rgba(226,232,240,0.5)', marginLeft: 76 }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(practitioner)/messages/[id]', params: { id: item.partnerId, name: item.partnerName } })}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item.unread > 0 ? 'rgba(0,102,133,0.03)' : 'transparent' }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 16, color: '#005e7a' }}>
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
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center' }}>
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
