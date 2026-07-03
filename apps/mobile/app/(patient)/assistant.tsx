import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { ChatBubble } from '@/features/mental-health/ai-companion/components/ChatBubble'
import { useMounima } from '@/features/mental-health/ai-companion/hooks/useMounima'
import { useResponsive } from '@/hooks/useResponsive'
import type { MounimaMessage } from '@/types/mentalHealth'

const QUICK_ACTIONS = [
  {
    icon: 'air' as const,
    label: 'Respiration',
    desc: 'Cohérence cardiaque guidée',
    bg: '#e5eeff',
    accent: '#82d8ff',
    route: '/(patient)/mental-health/meditation/session',
    params: { technique: 'coherence', duration: '300', title: 'Cohérence cardiaque' },
  },
  {
    icon: 'medical-services' as const,
    label: 'Praticien',
    desc: '500+ experts disponibles',
    bg: '#fff8e1',
    accent: '#705d00',
    route: '/(patient)/find-practitioners',
    params: undefined,
  },
]

const CRISIS_PHONE = '+221338238020'

export default function AssistantTab() {
  const router = useRouter()
  const { px, fs, scale } = useResponsive()
  const [input, setInput] = useState('')
  const { messages, isLoading, showCrisis, sendMessage } = useMounima()
  const listRef = useRef<FlatList<MounimaMessage>>(null)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    listRef.current?.scrollToEnd({ animated: true })
  }

  const showWelcome = messages.length === 0

  const WelcomeHeader = (
    <View style={{ alignItems: 'center', paddingVertical: scale(28), paddingHorizontal: px, gap: scale(20) }}>
      {/* Avatar Mounima */}
      <View style={{
        width: scale(110),
        height: scale(110),
        borderRadius: scale(55),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#82d8ff',
        shadowColor: '#82d8ff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 30,
        elevation: 10,
      }}>
        <MaterialIcons name="waves" size={scale(46)} color="#ffffff" />
      </View>

      {/* Greeting */}
      <View style={{ alignItems: 'center', gap: scale(6) }}>
        <Text style={{ fontSize: fs.xxl, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
          Comment vous sentez-vous ?
        </Text>
        <Text style={{ fontSize: fs.md, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center' }}>
          Je vous écoute...
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: scale(4), backgroundColor: '#e5eeff', paddingHorizontal: scale(12), paddingVertical: scale(4), borderRadius: 20 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#82d8ff' }} />
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', fontFamily: 'Manrope', letterSpacing: 0.5 }}>MOUNIMA · IA BIENVEILLANTE</Text>
        </View>
      </View>

      {/* Quick action cards: Respiration + Praticien */}
      <View style={{ flexDirection: 'row', gap: scale(12), width: '100%' }}>
        {QUICK_ACTIONS.map(a => (
          <TouchableOpacity
            key={a.label}
            onPress={() => router.push({ pathname: a.route as never, ...(a.params ? { params: a.params } : {}) })}
            activeOpacity={0.85}
            style={{
              flex: 1,
              backgroundColor: a.bg,
              borderRadius: scale(16),
              padding: scale(14),
              gap: scale(8),
              borderWidth: 1,
              borderColor: `${a.accent}25`,
              shadowColor: a.accent,
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View style={{ width: scale(36), height: scale(36), borderRadius: scale(12), backgroundColor: `${a.accent}18`, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name={a.icon} size={scale(20)} color={a.accent} />
            </View>
            <View>
              <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>{a.label}</Text>
              <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope', marginTop: 2 }}>{a.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Crise banner — toujours visible */}
      <TouchableOpacity
        onPress={() => Linking.openURL(`tel:${CRISIS_PHONE}`)}
        activeOpacity={0.85}
        style={{
          width: '100%',
          backgroundColor: '#fce4ec',
          borderRadius: scale(14),
          padding: scale(14),
          flexDirection: 'row',
          alignItems: 'center',
          gap: scale(12),
          borderWidth: 1,
          borderColor: '#f8bbd9',
        }}
      >
        <View style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: '#ba1a1a', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="emergency" size={scale(18)} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a', fontFamily: 'Manrope' }}>Ligne de crise 24h/24</Text>
          <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope', marginTop: 1 }}>SOS Amitié · +221 33 823 8020</Text>
        </View>
        <MaterialIcons name="call" size={scale(18)} color="#ba1a1a" />
      </TouchableOpacity>
    </View>
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>

        {/* Header */}
        <View style={{ paddingHorizontal: px, paddingTop: scale(20), paddingBottom: scale(12), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10) }}>
            <View style={{ width: scale(36), height: scale(36), borderRadius: scale(10), backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="medical-services" size={scale(20)} color="#fff" />
            </View>
            <View>
              <Text style={{ fontSize: fs.lg, fontWeight: '900', color: '#0b1c30', fontFamily: 'Manrope', letterSpacing: -0.3 }}>M-Santé</Text>
              <Text style={{ fontSize: scale(9), color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>Health Sanctuary</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
            <Text style={{ fontSize: fs.md, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope' }}>Mounima</Text>
            <MaterialIcons name="favorite" size={scale(16)} color="#82d8ff" />
          </View>
        </View>

        {/* Messages */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: scale(16), gap: 4 }}
          ListHeaderComponent={showWelcome ? WelcomeHeader : null}
          ListFooterComponent={
            <>
              {showCrisis && messages.length > 0 && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${CRISIS_PHONE}`)}
                  style={{
                    marginTop: scale(12),
                    backgroundColor: '#fce4ec',
                    borderRadius: scale(14),
                    padding: scale(14),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: scale(10),
                    borderWidth: 1,
                    borderColor: '#f8bbd9',
                  }}
                >
                  <MaterialIcons name="emergency" size={scale(20)} color="#ba1a1a" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fs.sm, fontWeight: '700', color: '#ba1a1a', fontFamily: 'Manrope' }}>Ligne de crise disponible</Text>
                    <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope' }}>SOS Amitié · +221 33 823 8020</Text>
                  </View>
                  <MaterialIcons name="call" size={scale(18)} color="#ba1a1a" />
                </TouchableOpacity>
              )}
              {isLoading && (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(229,238,255,0.75)',
                  borderRadius: scale(16),
                  borderTopLeftRadius: 0,
                  paddingHorizontal: scale(20),
                  paddingVertical: scale(12),
                  marginTop: scale(16),
                  borderLeftWidth: 3,
                  borderLeftColor: '#82d8ff',
                }}>
                  <Text style={{ fontSize: fs.sm, color: '#6f787e', fontFamily: 'Manrope' }}>Mounima écrit...</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => <ChatBubble message={item} />}
          onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd()}
        />

        {/* Disclaimer + Input */}
        <View style={{ paddingHorizontal: px, paddingBottom: scale(16) }}>
          <Text style={{ fontSize: fs.xs, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', marginBottom: scale(10) }}>
            Cet espace ne remplace pas un professionnel de santé
          </Text>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(10),
            backgroundColor: 'rgba(220,233,255,0.9)',
            borderRadius: 9999,
            paddingHorizontal: scale(20),
            paddingVertical: scale(10),
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Partagez ce que vous ressentez..."
              placeholderTextColor="#bec8ce"
              style={{ flex: 1, fontSize: fs.md, color: '#0b1c30', fontFamily: 'Manrope' }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                width: scale(40),
                height: scale(40),
                borderRadius: scale(20),
                backgroundColor: '#82d8ff',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || isLoading ? 0.4 : 1,
              }}
            >
              <MaterialIcons name="send" size={scale(18)} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
