import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal, Linking, Image,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as DocumentPicker from 'expo-document-picker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'

type IconName = React.ComponentProps<typeof MaterialIcons>['name']

type DocTypeId = 'analyse' | 'ordonnance' | 'compte_rendu' | 'imagerie' | 'autre'

const DOC_TYPES: { id: DocTypeId; label: string; icon: IconName; color: string; bg: string }[] = [
  { id: 'analyse',      label: 'Résultat d\'analyse',  icon: 'science',      color: '#1d7a3a', bg: '#e8f5e9' },
  { id: 'ordonnance',   label: 'Ordonnance',            icon: 'medication',   color: '#705d00', bg: '#fff8e1' },
  { id: 'compte_rendu', label: 'Compte-rendu médical',  icon: 'description',  color: '#82d8ff', bg: '#e5eeff' },
  { id: 'imagerie',     label: 'Imagerie médicale',     icon: 'image',        color: '#5c5f61', bg: '#e0e3e5' },
  { id: 'autre',        label: 'Autre document',        icon: 'attach-file',  color: '#6f787e', bg: '#f1f5f9' },
]

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  appointment_id?: string | null
  body: string | null
  attachment_url: string | null
  attachment_name: string | null
  attachment_type: 'analyse' | 'ordonnance' | 'compte_rendu' | 'imagerie' | 'autre' | null
  read_at: string | null
  created_at: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
}

function groupByDay(messages: Message[]) {
  const groups: { date: string; items: Message[] }[] = []
  let lastDate = ''
  for (const m of messages) {
    const d = new Date(m.created_at).toDateString()
    if (d !== lastDate) { groups.push({ date: m.created_at, items: [m] }); lastDate = d }
    else groups[groups.length - 1].items.push(m)
  }
  return groups
}

function toStoragePath(urlOrPath: string): string {
  const marker = '/message-attachments/'
  const idx = urlOrPath.indexOf(marker)
  return idx >= 0 ? urlOrPath.slice(idx + marker.length) : urlOrPath
}

function DocCard({ msg, isMe, onOpen }: { msg: Message; isMe: boolean; onOpen: (path: string) => void }) {
  const docType = DOC_TYPES.find(d => d.id === msg.attachment_type) ?? DOC_TYPES[4]
  return (
    <View style={{
      borderRadius: 14, overflow: 'hidden',
      borderWidth: 1,
      borderColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(226,232,240,0.8)',
      backgroundColor: isMe ? 'rgba(255,255,255,0.10)' : '#ffffff',
      minWidth: 200,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: isMe ? 'rgba(255,255,255,0.08)' : docType.bg }}>
        <MaterialIcons name={docType.icon} size={14} color={isMe ? '#bee9ff' : docType.color} />
        <Text style={{ fontSize: 11, fontWeight: '700', fontFamily: 'Manrope', color: isMe ? '#bee9ff' : docType.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {docType.label}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <MaterialIcons name="picture-as-pdf" size={20} color={isMe ? 'rgba(255,255,255,0.7)' : '#6f787e'} />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: 'Manrope', fontWeight: '600', color: isMe ? '#fff' : '#0b1c30' }} numberOfLines={2}>
            {msg.attachment_name ?? 'Document'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => msg.attachment_url && onOpen(msg.attachment_url)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : '#e5eeff' }}
        >
          <MaterialIcons name="download" size={14} color={isMe ? '#bee9ff' : '#82d8ff'} />
          <Text style={{ fontSize: 12, fontWeight: '700', fontFamily: 'Manrope', color: isMe ? '#bee9ff' : '#82d8ff' }}>Ouvrir</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ImageCard({ msg, isMe, onOpenFullscreen }: { msg: Message; isMe: boolean; onOpenFullscreen: (signedUrl: string) => void }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!msg.attachment_url) { setLoading(false); setError(true); return }
    const path = toStoragePath(msg.attachment_url)
    supabase.storage.from('message-attachments').createSignedUrl(path, 3600).then(({ data, error: err }) => {
      if (err || !data) { setError(true) } else { setSignedUrl(data.signedUrl) }
      setLoading(false)
    })
  }, [msg.attachment_url])

  if (loading) {
    return <View style={{ width: 200, height: 140, borderRadius: 12, backgroundColor: '#e0e3e5' }} />
  }
  if (error || !signedUrl) {
    return <DocCard msg={msg} isMe={isMe} onOpen={(urlOrPath) => {
      const path = toStoragePath(urlOrPath)
      supabase.storage.from('message-attachments').createSignedUrl(path, 3600).then(({ data }) => {
        if (data) Linking.openURL(data.signedUrl).catch(() => {})
      })
    }} />
  }
  return (
    <TouchableOpacity onPress={() => onOpenFullscreen(signedUrl)} activeOpacity={0.85}>
      <Image
        source={{ uri: signedUrl }}
        style={{ width: 200, height: 140, borderRadius: 12 }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  )
}

export default function PractitionerMessageThreadScreen() {
  const { id: partnerId, name: partnerName } = useLocalSearchParams<{ id: string; name: string }>()
  const router = useRouter()
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()
  const listRef = useRef<FlatList>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [docPickerVisible, setDocPickerVisible] = useState(false)
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  const qKey = ['messages-thread', profile?.id, partnerId]

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: qKey,
    enabled: !!profile?.id && !!partnerId,
    refetchInterval: 5_000,
    queryFn: async () => {
      const uid = profile!.id
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, appointment_id, body, attachment_url, attachment_name, attachment_type, read_at, created_at')
        .or(`and(sender_id.eq.${uid},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${uid})`)
        .order('created_at', { ascending: true })
        .limit(100)
      if (error) throw error
      return (data ?? []) as Message[]
    },
  })

  useEffect(() => {
    if (!profile?.id || !partnerId) return
    supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', partnerId).eq('receiver_id', profile.id).is('read_at', null)
      .then(() => { void queryClient.invalidateQueries({ queryKey: ['practitioner-conversations', profile.id] }) })
  }, [profile?.id, partnerId, messages.length])

  // Thread closure — the practitioner can close a conversation, which blocks the
  // patient from sending new messages until it is reopened.
  const { data: threadStatus } = useQuery<{ closed_at: string | null }>({
    queryKey: ['pract-thread-status', profile?.id, partnerId],
    enabled: !!profile?.id && !!partnerId,
    refetchInterval: 5_000,
    queryFn: async () => {
      const a = profile!.id < partnerId! ? profile!.id : partnerId!
      const b = profile!.id < partnerId! ? partnerId! : profile!.id
      const { data } = await supabase
        .from('message_threads')
        .select('closed_at')
        .eq('participant_a', a).eq('participant_b', b)
        .maybeSingle()
      return { closed_at: data?.closed_at ?? null }
    },
  })
  const isClosed = !!threadStatus?.closed_at

  const closeConv = useMutation({
    mutationFn: async (close: boolean) => {
      const a = profile!.id < partnerId! ? profile!.id : partnerId!
      const b = profile!.id < partnerId! ? partnerId! : profile!.id
      if (close) {
        await supabase.from('message_threads').upsert(
          { participant_a: a, participant_b: b, closed_at: new Date().toISOString(), closed_by: profile!.id },
          { onConflict: 'participant_a,participant_b' },
        )
        await supabase.from('notifications').insert({
          user_id: partnerId,
          type: 'conversation_closed',
          title: 'Conversation clôturée',
          body: 'Votre praticien a clôturé cette conversation.',
          data: { closed_by: profile!.id },
          channel: 'push',
          status: 'pending',
        })
      } else {
        await supabase.from('message_threads')
          .update({ closed_at: null, closed_by: null })
          .eq('participant_a', a).eq('participant_b', b)
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pract-thread-status', profile?.id, partnerId] })
    },
    onError: () => Alert.alert('Erreur', 'Action impossible pour le moment.'),
  })

  const toggleClose = useCallback(() => {
    Alert.alert(
      isClosed ? 'Rouvrir la conversation' : 'Clôturer la conversation',
      isClosed
        ? 'Le patient pourra de nouveau vous envoyer des messages.'
        : 'Le patient ne pourra plus vous écrire tant que la conversation reste clôturée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: isClosed ? 'Rouvrir' : 'Clôturer', style: isClosed ? 'default' : 'destructive', onPress: () => closeConv.mutate(!isClosed) },
      ],
    )
  }, [isClosed, closeConv])

  const sendMessage = useMutation({
    mutationFn: async (payload: { body: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: DocTypeId }) => {
      const { error } = await supabase.from('messages').insert({
        sender_id: profile!.id,
        receiver_id: partnerId,
        body: payload.body,
        attachment_url: payload.attachmentUrl ?? null,
        attachment_name: payload.attachmentName ?? null,
        attachment_type: payload.attachmentType ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qKey })
      void queryClient.invalidateQueries({ queryKey: ['practitioner-conversations', profile?.id] })
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    },
    onError: () => Alert.alert('Erreur', 'Impossible d\'envoyer le message.'),
  })

  const handleSend = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setText('')
    setSending(true)
    await sendMessage.mutateAsync({ body: trimmed })
    setSending(false)
  }, [text, sending, sendMessage])

  const handleOpenDoc = useCallback(async (urlOrPath: string) => {
    const path = toStoragePath(urlOrPath)
    const { data, error } = await supabase.storage.from('message-attachments').createSignedUrl(path, 3600)
    if (error || !data) { Alert.alert('Erreur', 'Impossible d\'ouvrir le document.'); return }
    Linking.openURL(data.signedUrl).catch(() => {})
  }, [])

  const handlePickDoc = useCallback(async (docType: DocTypeId) => {
    setDocPickerVisible(false)
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    setSending(true)
    try {
      const filePath = `messages/${profile!.id}/${Date.now()}_${asset.name}`
      await uploadLocalFile('message-attachments', filePath, asset.uri, mimeFromUri(asset.name), { upsert: false })
      await sendMessage.mutateAsync({ body: asset.name, attachmentUrl: filePath, attachmentName: asset.name, attachmentType: docType })
    } catch {
      Alert.alert('Erreur', 'Impossible d\'envoyer le document.')
    } finally {
      setSending(false)
    }
  }, [profile, sendMessage])

  const grouped = groupByDay(messages)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.90)', borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: 13, color: '#82d8ff' }}>
            {(partnerName ?? 'P').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }} numberOfLines={1}>
            {partnerName ?? 'Patient'}
          </Text>
          <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>Patient</Text>
        </View>
        <TouchableOpacity
          onPress={toggleClose}
          disabled={closeConv.isPending}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: isClosed ? '#e8f5e9' : '#fff8e1' }}
        >
          <MaterialIcons name={isClosed ? 'lock-open' : 'lock'} size={13} color={isClosed ? '#1d7a3a' : '#705d00'} />
          <Text style={{ fontSize: 11, color: isClosed ? '#1d7a3a' : '#705d00', fontFamily: 'Manrope', fontWeight: '700' }}>
            {isClosed ? 'Rouvrir' : 'Clôturer'}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#82d8ff" size="large" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={grouped}
            keyExtractor={(g) => g.date}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item: group }) => (
              <View style={{ marginBottom: 8 }}>
                <View style={{ alignItems: 'center', marginVertical: 12 }}>
                  <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', fontWeight: '500', textTransform: 'capitalize' }}>
                    {formatDate(group.date)}
                  </Text>
                </View>
                <View style={{ gap: 6 }}>
                  {group.items.map((msg: Message) => {
                    const isMe = msg.sender_id === profile?.id
                    return (
                      <View key={msg.id} style={{ alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                        {msg.attachment_url ? (
                          <View style={{ maxWidth: '80%' }}>
                            {msg.attachment_type === 'imagerie'
                              ? <ImageCard msg={msg} isMe={isMe} onOpenFullscreen={setFullscreenImage} />
                              : <DocCard msg={msg} isMe={isMe} onOpen={handleOpenDoc} />
                            }
                            <Text style={{ fontSize: 10, fontFamily: 'Manrope', color: '#6f787e', marginTop: 4, alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                              {formatTime(msg.created_at)}
                            </Text>
                          </View>
                        ) : (
                          <View style={{
                            maxWidth: '80%',
                            paddingHorizontal: 14, paddingVertical: 10,
                            borderRadius: 16,
                            borderBottomRightRadius: isMe ? 4 : 16,
                            borderBottomLeftRadius: isMe ? 16 : 4,
                            backgroundColor: isMe ? '#82d8ff' : '#ffffff',
                            borderWidth: isMe ? 0 : 1,
                            borderColor: 'rgba(226,232,240,0.7)',
                          }}>
                            <Text style={{ fontSize: 14, fontFamily: 'Manrope', color: isMe ? '#fff' : '#0b1c30', lineHeight: 20 }}>
                              {msg.body}
                            </Text>
                            <Text style={{ fontSize: 10, fontFamily: 'Manrope', color: isMe ? 'rgba(255,255,255,0.55)' : '#6f787e', alignSelf: 'flex-end', marginTop: 4 }}>
                              {formatTime(msg.created_at)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
          />
        )}

        {/* Closed banner */}
        {isClosed && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff8e1', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)' }}>
            <MaterialIcons name="lock" size={14} color="#705d00" />
            <Text style={{ flex: 1, fontSize: 11, color: '#705d00', fontFamily: 'Manrope', lineHeight: 16 }}>
              Conversation clôturée — le patient ne peut plus vous écrire tant qu&apos;elle reste fermée.
            </Text>
          </View>
        )}

        {/* Input bar */}
        <View style={{ backgroundColor: 'rgba(255,255,255,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)', paddingHorizontal: 12, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 12 : 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Votre message..."
              placeholderTextColor="#6f787e"
              multiline
              style={{ flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f1f5f9', fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30', borderWidth: 1, borderColor: 'rgba(226,232,240,0.6)' }}
            />
            <TouchableOpacity
              onPress={() => void handleSend()}
              disabled={!text.trim() || sending}
              style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: text.trim() && !sending ? '#82d8ff' : '#e5eeff', alignItems: 'center', justifyContent: 'center' }}
            >
              {sending
                ? <ActivityIndicator size="small" color="#82d8ff" />
                : <MaterialIcons name="send" size={18} color={text.trim() ? '#fff' : '#82d8ff'} />
              }
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => setDocPickerVisible(true)}
            disabled={sending}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(0,102,133,0.25)', backgroundColor: 'rgba(0,102,133,0.04)' }}
          >
            <MaterialIcons name="attach-file" size={16} color="#82d8ff" />
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#82d8ff', fontFamily: 'Manrope' }}>Joindre un document médical</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Fullscreen image modal */}
      <Modal visible={!!fullscreenImage} transparent animationType="fade" onRequestClose={() => setFullscreenImage(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity
            style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
            onPress={() => setFullscreenImage(null)}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {fullscreenImage && (
            <Image
              source={{ uri: fullscreenImage }}
              style={{ width: '90%', height: '70%' }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Manrope', marginTop: 16 }}>
            Appuyez n'importe où pour fermer
          </Text>
          <TouchableOpacity
            onPress={() => setFullscreenImage(null)}
            style={{ position: 'absolute', inset: 0 } as any}
            activeOpacity={1}
          />
        </View>
      </Modal>

      {/* Document type picker modal */}
      <Modal visible={docPickerVisible} transparent animationType="slide" onRequestClose={() => setDocPickerVisible(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} activeOpacity={1} onPress={() => setDocPickerVisible(false)} />
        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#bec8ce', alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 4 }}>Quel type de document ?</Text>
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', marginBottom: 16 }}>PDF ou image (max 10 Mo)</Text>
          {DOC_TYPES.map(dt => (
            <TouchableOpacity
              key={dt.id}
              onPress={() => void handlePickDoc(dt.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: dt.bg, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name={dt.icon} size={20} color={dt.color} />
              </View>
              <Text style={{ fontSize: 15, fontFamily: 'Manrope', fontWeight: '600', color: '#0b1c30' }}>{dt.label}</Text>
              <MaterialIcons name="chevron-right" size={18} color="#bec8ce" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  )
}
