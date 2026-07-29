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
  partnerRole: string
  lastMessage: string
  lastAt: string
  unread: number
}

interface DirectoryUser { id: string; full_name: string; role: string }

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin', organization_admin: "Admin d'org", organization_member: 'Collaborateur', secretary: 'Secrétaire',
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

function NewMessageModal({ myId, onClose }: { myId: string; onClose: () => void }) {
  const router = useRouter()
  const { data: directory = [], isLoading } = useQuery<DirectoryUser[]>({
    queryKey: ['admin-internal-directory', myId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('role', ['admin', 'organization_admin', 'organization_member', 'secretary'])
        .order('full_name')
      if (error) throw error
      return (data ?? []).filter(u => u.id !== myId)
    },
  })

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <Text style={{ fontSize: 17, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Nouveau message</Text>
          <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
        </View>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#82d8ff" size="large" />
          </View>
        ) : (
          <FlatList
            data={directory}
            keyExtractor={u => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onClose()
                  router.push({ pathname: '/(admin)/messages/[id]', params: { id: item.id, name: item.full_name } })
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 15, color: '#82d8ff' }}>{getInitials(item.full_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{item.full_name}</Text>
                  <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>{ROLE_LABELS[item.role] ?? item.role}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

export default function AdminMessagesScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const [showNewMessage, setShowNewMessage] = useState(false)

  const { data: conversations = [], isLoading, isError, refetch, isRefetching } = useQuery<ConversationPreview[]>({
    queryKey: ['admin-conversations', profile?.id],
    enabled: !!profile?.id,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, read_at, created_at, sender:users!messages_sender_id_fkey(id, full_name, role), receiver:users!messages_receiver_id_fkey(id, full_name, role)')
        .or(`sender_id.eq.${profile!.id},receiver_id.eq.${profile!.id}`)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error

      const map = new Map<string, ConversationPreview>()
      for (const msg of (msgs ?? [])) {
        const isMe = msg.sender_id === profile!.id
        const partner = isMe
          ? (msg.receiver as unknown as { id: string; full_name: string; role: string })
          : (msg.sender as unknown as { id: string; full_name: string; role: string })
        if (!partner || map.has(partner.id)) continue
        const unread = (msgs ?? []).filter(
          m => m.sender_id === partner.id && m.receiver_id === profile!.id && !m.read_at
        ).length
        map.set(partner.id, {
          partnerId: partner.id,
          partnerName: partner.full_name,
          partnerRole: partner.role,
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.70)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Messages internes</Text>
        <TouchableOpacity onPress={() => setShowNewMessage(true)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="add" size={20} color="#0b1c30" />
        </TouchableOpacity>
      </View>

      {showNewMessage && profile?.id && <NewMessageModal myId={profile.id} onClose={() => setShowNewMessage(false)} />}

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
            <MaterialIcons name="forum" size={36} color="#82d8ff" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>Aucune conversation</Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
            Échangez avec l&apos;équipe M-Santé et les organisations.
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
              onPress={() => router.push({ pathname: '/(admin)/messages/[id]', params: { id: item.partnerId, name: item.partnerName } })}
              activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: item.unread > 0 ? 'rgba(0,102,133,0.03)' : 'transparent' }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 16, color: '#82d8ff' }}>{getInitials(item.partnerName)}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontFamily: 'Manrope', fontWeight: item.unread > 0 ? '700' : '600', color: '#0b1c30' }}>
                    {item.partnerName}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>{relativeTime(item.lastAt)}</Text>
                </View>
                <Text style={{ fontSize: 13, color: item.unread > 0 ? '#0b1c30' : '#6f787e', fontFamily: 'Manrope', fontWeight: item.unread > 0 ? '600' : '400' }} numberOfLines={1}>
                  {item.lastMessage}
                </Text>
              </View>
              {item.unread > 0 && (
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', fontFamily: 'Manrope' }}>{item.unread > 9 ? '9+' : item.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  )
}
