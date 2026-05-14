import { useState, useRef, useEffect, useCallback } from 'react'
import { View, Text, TouchableOpacity, Pressable, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Audio } from 'expo-av'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing, cancelAnimation,
} from 'react-native-reanimated'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'

interface Sentiment { score: number; stress: number; emotion: string; crisis: boolean }
interface Exchange {
  transcript: string
  response: string
  sentiment: Sentiment
  timestamp: number
}

function WaveRing({ isActive, color }: { isActive: boolean; color: string }) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    if (isActive) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      )
      opacity.value = withRepeat(
        withSequence(withTiming(1, { duration: 700 }), withTiming(0.3, { duration: 700 })),
        -1,
        false
      )
    } else {
      cancelAnimation(scale)
      cancelAnimation(opacity)
      scale.value = withTiming(1, { duration: 300 })
      opacity.value = withTiming(0.6, { duration: 300 })
    }
  }, [isActive, scale, opacity])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: color + '15',
          borderWidth: 1.5,
          borderColor: color,
          position: 'absolute',
        },
        animStyle,
      ]}
    />
  )
}

export default function VoiceSessionScreen() {
  const router = useRouter()
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [sentiment, setSentiment] = useState<Sentiment>({ score: 5, stress: 50, emotion: 'neutre', crisis: false })
  const [showCrisis, setShowCrisis] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const recordingRef = useRef<Audio.Recording | null>(null)
  const soundRef = useRef<Audio.Sound | null>(null)
  const sessionIdRef = useRef(`session_${Date.now()}`)
  const mountedRef = useRef(true)
  const sessionStart = useRef(Date.now())

  useEffect(() => {
    mountedRef.current = true
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setElapsed(Math.floor((Date.now() - sessionStart.current) / 1000))
      }
    }, 1000)
    return () => {
      mountedRef.current = false
      clearInterval(interval)
      soundRef.current?.unloadAsync().catch(() => {})
      recordingRef.current?.stopAndUnloadAsync().catch(() => {})
    }
  }, [])

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const startRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync()
      if (status !== 'granted') return

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      })

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      )
      recordingRef.current = recording
      if (mountedRef.current) setIsRecording(true)
    } catch (e) {
      console.warn('[voice] startRecording error:', e)
    }
  }, [])

  const stopAndSend = useCallback(async () => {
    if (!recordingRef.current || !mountedRef.current) return

    if (mountedRef.current) {
      setIsRecording(false)
      setIsProcessing(true)
    }

    try {
      await recordingRef.current.stopAndUnloadAsync()
      const uri = recordingRef.current.getURI()
      recordingRef.current = null

      if (!uri) throw new Error('No recording URI')

      // Convert to base64
      const response = await fetch(uri)
      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No session')

      // Build conversation history
      const history = exchanges.flatMap(e => ([
        { role: 'user' as const, content: e.transcript },
        { role: 'assistant' as const, content: e.response },
      ]))

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/mounima-voice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            audio_base64: base64,
            conversation_history: history,
            session_id: sessionIdRef.current,
          }),
        }
      )

      if (!res.ok) throw new Error(`API error ${res.status}`)

      const data = await res.json() as {
        transcript: string
        response: string
        sentiment: Sentiment
        audio_url: string | null
        crisis: boolean
      }

      if (!mountedRef.current) return

      const exchange: Exchange = {
        transcript: data.transcript,
        response: data.response,
        sentiment: data.sentiment,
        timestamp: Date.now(),
      }

      setExchanges(prev => [...prev, exchange])
      setSentiment(data.sentiment)
      if (data.crisis) setShowCrisis(true)

      // Play audio response
      if (data.audio_url) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })
        const { sound } = await Audio.Sound.createAsync({ uri: data.audio_url })
        soundRef.current = sound
        if (mountedRef.current) setIsPlaying(true)
        await sound.playAsync()
        sound.setOnPlaybackStatusUpdate(status => {
          if ('didJustFinish' in status && status.didJustFinish && mountedRef.current) {
            setIsPlaying(false)
          }
        })
      }
    } catch (e) {
      console.warn('[voice] stopAndSend error:', e)
    } finally {
      if (mountedRef.current) setIsProcessing(false)
    }
  }, [exchanges])

  const handleEndSession = useCallback(() => {
    soundRef.current?.stopAsync().catch(() => {})
    router.push({
      pathname: '/(patient)/mental-health/mounima/voice-insights',
      params: {
        exchanges: JSON.stringify(exchanges),
        duration: String(elapsed),
      },
    })
  }, [exchanges, elapsed, router])

  const isActive = isRecording || isPlaying || isProcessing
  const waveColor = isRecording ? '#ba1a1a' : isPlaying ? '#82d8ff' : '#006685'
  const micIcon = isRecording ? 'mic' : isProcessing ? 'hourglass-empty' : isPlaying ? 'volume-up' : 'mic-none'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0b1c30' }}>

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 }}>
        <View>
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Session vocale
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: '700', color: '#fff' }}>
            Mounima
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.60)' }}>
            {formatTime(elapsed)}
          </Text>
          <TouchableOpacity
            onPress={handleEndSession}
            style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.20)' }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.50)' }}>
              Terminer
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Crisis banner */}
      {showCrisis && (
        <Pressable
          onPress={() => Linking.openURL('tel:+221338238020')}
          style={{ marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 14, backgroundColor: '#ba1a1a', flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <MaterialIcons name="warning" size={20} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#fff' }}>
              Je détecte une détresse — tu n'es pas seul·e
            </Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: 'rgba(255,255,255,0.80)' }}>
              Appuie pour appeler SOS Amitié (+221 33 823 8020)
            </Text>
          </View>
        </Pressable>
      )}

      {/* Sentiment indicators */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 }}>
        <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Stress
          </Text>
          <Text style={{
            fontFamily: 'Manrope', fontSize: 20, fontWeight: '900',
            color: sentiment.stress > 70 ? '#ba1a1a' : sentiment.stress > 40 ? '#e4c546' : '#1d7a3a',
          }}>
            {sentiment.stress}%
          </Text>
        </View>
        <View style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Humeur
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '900', color: '#fff' }}>
            {sentiment.score}/10
          </Text>
        </View>
        <View style={{ flex: 2, padding: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', gap: 3 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Émotion
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#82d8ff', textTransform: 'capitalize' }} numberOfLines={1}>
            {sentiment.emotion}
          </Text>
        </View>
      </View>

      {/* Central wave area */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <WaveRing isActive={isActive} color={waveColor} />
        <View style={{
          width: 80, height: 80, borderRadius: 40,
          backgroundColor: isRecording ? '#ba1a1a' : isPlaying ? 'rgba(130,216,255,0.20)' : 'rgba(255,255,255,0.08)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <MaterialIcons
            name={micIcon}
            size={34}
            color={isActive ? '#fff' : 'rgba(255,255,255,0.35)'}
          />
        </View>
        <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 20, textAlign: 'center' }}>
          {isRecording ? "J'écoute..." : isProcessing ? 'Mounima réfléchit...' : isPlaying ? 'Mounima parle...' : 'Maintiens pour parler'}
        </Text>
      </View>

      {/* Disclaimer */}
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: 'rgba(255,255,255,0.18)', textAlign: 'center', paddingHorizontal: 32, paddingBottom: 10 }}>
        Mounima n'est pas un médecin ou thérapeute
      </Text>

      {/* Record button */}
      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <Pressable
          onPressIn={startRecording}
          onPressOut={stopAndSend}
          disabled={isProcessing || isPlaying}
          style={({ pressed }) => ({
            height: 64,
            borderRadius: 32,
            backgroundColor: isProcessing || isPlaying
              ? 'rgba(255,255,255,0.08)'
              : pressed || isRecording ? '#ba1a1a' : '#006685',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
          })}
        >
          <MaterialIcons
            name="mic"
            size={22}
            color={isProcessing || isPlaying ? 'rgba(255,255,255,0.25)' : '#fff'}
          />
          <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: isProcessing || isPlaying ? 'rgba(255,255,255,0.25)' : '#fff' }}>
            {isProcessing ? 'Traitement...' : isPlaying ? 'Écoute Mounima...' : isRecording ? 'Relâche pour envoyer' : 'Maintiens pour parler'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
