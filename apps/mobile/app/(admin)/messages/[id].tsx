import { useState, useEffect, useRef } from 'react'
import { View, Text, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  body: string | null
  read_at: string | null
  created_at: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// Version simplifiée du fil praticien (pas de pièces jointes médicales
// catégorisées, pas de liens ticket/litige) — mirrors la messagerie interne
// web (InternalMessaging), texte simple entre membres de l'équipe.
export default function InternalMessageThreadScreen() {
  const router = useRouter()
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const listRef = useRef<FlatList>(null)

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['admin-thread', profile?.id, id],
    enabled: !!profile?.id && !!id,
    refetchInterval: 5_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, body, read_at, created_at')
        .or(`and(sender_id.eq.${profile!.id},receiver_id.eq.${id}),and(sender_id.eq.${id},receiver_id.eq.${profile!.id})`)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Message[]
    },
  })

  const send = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('messages').insert({ sender_id: profile!.id, receiver_id: id, body })
      if (error) throw error
    },
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['admin-thread', profile?.id, id] })
      qc.invalidateQueries({ queryKey: ['admin-conversations', profile?.id] })
    },
  })

  useEffect(() => {
    if (!profile?.id || !id) return
    void supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('sender_id', id).eq('receiver_id', profile.id).is('read_at', null)
  }, [profile?.id, id])

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
          </TouchableOpacity>
          <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>{name ?? 'Conversation'}</Text>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#82d8ff" size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={m => m.id}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => {
              const isMe = item.sender_id === profile?.id
              return (
                <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  <View style={{
                    maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
                    backgroundColor: isMe ? '#82d8ff' : '#fff',
                    borderWidth: isMe ? 0 : 1, borderColor: 'rgba(226,232,240,0.8)',
                  }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Manrope', color: isMe ? '#0b1c30' : '#0b1c30' }}>{item.body}</Text>
                  </View>
                  <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', marginTop: 3 }}>{formatTime(item.created_at)}</Text>
                </View>
              )
            }}
          />
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)', backgroundColor: '#fff' }}>
          <TextInput
            value={text} onChangeText={setText} placeholder="Votre message..." multiline
            style={{ flex: 1, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', backgroundColor: '#f8f9ff', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100 }}
          />
          <TouchableOpacity
            onPress={() => text.trim() && send.mutate(text.trim())}
            disabled={!text.trim() || send.isPending}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.5 }}
          >
            <MaterialIcons name="send" size={18} color="#0b1c30" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  )
}
