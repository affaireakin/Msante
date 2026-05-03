import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Alert, Dimensions, Modal,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js'
import type { DailyCall } from '@daily-co/react-native-daily-js'
import type { MediaStreamTrack } from '@daily-co/react-native-webrtc'
import { useConsultationStore } from '@/features/consultation/store/consultationStore'
import { useSendChatMessage, useEndConsultation } from '@/features/consultation/hooks/useConsultation'
import { ConsultationTimer } from '@/features/consultation/components/ConsultationTimer'
import type { ChatMessage } from '@/types/consultation'

const { width } = Dimensions.get('window')

function SessionControls({
  onMute, onCamera, onChat, onEnd,
  isMuted, isCameraOff,
}: {
  onMute: () => void; onCamera: () => void
  onChat: () => void; onEnd: () => void
  isMuted: boolean; isCameraOff: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 40,
        marginHorizontal: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        backgroundColor: 'rgba(255,255,255,0.15)',
        shadowColor: '#006685',
        shadowOpacity: 0.15,
        shadowRadius: 40,
        elevation: 8,
      }}
    >
      <TouchableOpacity
        onPress={onMute}
        style={{
          width: 48, height: 48, borderRadius: 24,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
          backgroundColor: isMuted ? 'rgba(186,26,26,0.3)' : 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ fontSize: 20 }}>{isMuted ? '🔇' : '🎤'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onCamera}
        style={{
          width: 48, height: 48, borderRadius: 24,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
          backgroundColor: isCameraOff ? 'rgba(186,26,26,0.3)' : 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ fontSize: 20 }}>{isCameraOff ? '📵' : '📹'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onChat}
        style={{
          width: 48, height: 48, borderRadius: 24,
          alignItems: 'center', justifyContent: 'center',
          borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
          backgroundColor: 'rgba(255,255,255,0.15)',
        }}
      >
        <Text style={{ fontSize: 20 }}>💬</Text>
      </TouchableOpacity>

      <View style={{ width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.2)' }} />

      <TouchableOpacity
        onPress={onEnd}
        style={{
          width: 56, height: 56, borderRadius: 28,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: '#ba1a1a',
          shadowColor: '#ba1a1a',
          shadowOpacity: 0.4,
          shadowRadius: 20,
          elevation: 6,
        }}
      >
        <Text style={{ fontSize: 24 }}>📵</Text>
      </TouchableOpacity>
    </View>
  )
}

function ChatPanel({
  messages, onSend, onClose,
}: {
  messages: ChatMessage[]; onSend: (text: string) => void; onClose: () => void
}) {
  const [text, setText] = useState('')
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.95)' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.3)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14 }}>🔒</Text>
          <Text style={{ fontFamily: 'Manrope', fontWeight: '600', color: '#0b1c30', fontSize: 16 }}>Chat chiffré</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
          <Text style={{ fontFamily: 'Manrope', color: '#006685', fontWeight: '600' }}>Fermer</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={messages}
        keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => {
          const isPatient = item.role === 'patient'
          return (
            <View style={{ alignItems: isPatient ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  backgroundColor: isPatient ? '#006685' : 'rgba(229,238,255,1)',
                  borderRadius: 12,
                  borderTopRightRadius: isPatient ? 2 : 12,
                  borderTopLeftRadius: isPatient ? 12 : 2,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  maxWidth: width * 0.75,
                }}
              >
                <Text style={{ color: isPatient ? '#fff' : '#0b1c30', fontSize: 14, fontFamily: 'Manrope' }}>
                  {item.content}
                </Text>
                <Text style={{ color: isPatient ? 'rgba(255,255,255,0.6)' : '#6f787e', fontSize: 10, fontFamily: 'Manrope', marginTop: 2, textAlign: 'right' }}>
                  {new Date(item.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          )
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(190,200,206,0.2)' }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Écrire un message..."
          placeholderTextColor="#6f787e"
          style={{ flex: 1, backgroundColor: 'rgba(229,238,255,0.8)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, fontSize: 14, fontFamily: 'Manrope', color: '#0b1c30', borderWidth: 1, borderColor: 'rgba(190,200,206,0.3)' }}
          returnKeyType="send"
          onSubmitEditing={() => { if (text.trim()) { onSend(text.trim()); setText('') } }}
        />
        <TouchableOpacity
          onPress={() => { if (text.trim()) { onSend(text.trim()); setText('') } }}
          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.4 }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

export default function ConsultationSession() {
  const { practitionerName } = useLocalSearchParams<{ practitionerName: string }>()
  const router = useRouter()
  const { roomUrl, patientToken, consultationId, chatMessages, startedAt } = useConsultationStore()
  const sendMessage = useSendChatMessage(consultationId)
  const { endSession } = useEndConsultation()

  const callRef = useRef<DailyCall | null>(null)
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null)
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    if (!roomUrl || !patientToken) return

    const call = Daily.createCallObject()
    callRef.current = call

    function handleParticipantUpdate(event: { participant: { local: boolean; tracks: { video: { persistentTrack?: MediaStreamTrack }; audio: { persistentTrack?: MediaStreamTrack } } } }) {
      if (event.participant.local) {
        setLocalVideoTrack(event.participant.tracks.video.persistentTrack ?? null)
      } else {
        setRemoteVideoTrack(event.participant.tracks.video.persistentTrack ?? null)
        setRemoteAudioTrack(event.participant.tracks.audio.persistentTrack ?? null)
      }
    }

    call.on('participant-joined', handleParticipantUpdate)
    call.on('participant-updated', handleParticipantUpdate)
    call.on('participant-left', (event) => {
      if (!event.participant.local) {
        setRemoteVideoTrack(null)
        setRemoteAudioTrack(null)
      }
    })

    void call.join({ url: roomUrl, token: patientToken })

    return () => {
      void call.destroy()
      callRef.current = null
    }
  }, [roomUrl, patientToken])

  const handleMute = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    callRef.current?.setLocalAudio(!nextMuted)
  }

  const handleCamera = () => {
    const nextOff = !isCameraOff
    setIsCameraOff(nextOff)
    callRef.current?.setLocalVideo(!nextOff)
  }

  const handleEnd = () => {
    Alert.alert(
      'Terminer la consultation ?',
      'La session sera enregistrée et un résumé sera généré.',
      [
        { text: 'Continuer', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: async () => {
            await endSession()
            await callRef.current?.leave()
            router.replace('/(patient)/consultation/summary')
          },
        },
      ]
    )
  }

  if (!roomUrl || !patientToken) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213145' }}>
        <Text style={{ color: '#fff', fontFamily: 'Manrope' }}>Chargement de la salle…</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#213145' }}>
      {/* Vidéo praticien — plein écran */}
      {remoteVideoTrack ? (
        <DailyMediaView
          videoTrack={remoteVideoTrack}
          audioTrack={remoteAudioTrack}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}
          objectFit="cover"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 64 }}>👨‍⚕️</Text>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope', marginTop: 12 }}>
            En attente du praticien…
          </Text>
        </View>
      )}

      {/* Header — timer + nom praticien */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 52, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(33,49,69,0.6)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(130,216,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14 }}>👨‍⚕️</Text>
          </View>
          <View>
            <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '600', fontSize: 14 }}>{practitionerName ?? 'Praticien'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope', fontSize: 10 }}>Praticien de santé</Text>
          </View>
        </View>
        <View style={{ backgroundColor: 'rgba(33,49,69,0.6)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 9, fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1 }}>Durée</Text>
          <ConsultationTimer startedAt={startedAt} />
        </View>
      </View>

      {/* Self-view miniature — coin haut droit */}
      <View style={{ position: 'absolute', top: 120, right: 16, width: 100, height: 130, borderRadius: 12, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)', shadowColor: '#006685', shadowOpacity: 0.2, shadowRadius: 20, elevation: 6 }}>
        {localVideoTrack && (
          <DailyMediaView
            videoTrack={localVideoTrack}
            audioTrack={null}
            style={{ width: '100%', height: '100%' }}
            objectFit="cover"
            mirror
          />
        )}
        <View style={{ position: 'absolute', bottom: 4, left: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
            <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'Manrope' }}>Vous</Text>
          </View>
        </View>
      </View>

      {/* Bouton chat slide droit */}
      <TouchableOpacity
        onPress={() => setShowChat(true)}
        style={{
          position: 'absolute', right: 0, top: '45%',
          backgroundColor: 'rgba(255,255,255,0.15)',
          paddingVertical: 16, paddingHorizontal: 10,
          borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
          borderWidth: 1, borderRightWidth: 0, borderColor: 'rgba(255,255,255,0.5)',
          alignItems: 'center', gap: 4,
        }}
      >
        <Text style={{ fontSize: 20 }}>💬</Text>
        {chatMessages.length > 0 && (
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#006685' }} />
        )}
      </TouchableOpacity>

      {/* Contrôles bas */}
      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0 }}>
        <SessionControls
          onMute={handleMute}
          onCamera={handleCamera}
          onChat={() => setShowChat(true)}
          onEnd={handleEnd}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
        />
      </View>

      {/* Panel Chat (modal) */}
      <Modal visible={showChat} animationType="slide" presentationStyle="pageSheet">
        <ChatPanel
          messages={chatMessages}
          onSend={(text) => sendMessage(text, 'patient')}
          onClose={() => setShowChat(false)}
        />
      </Modal>
    </View>
  )
}
