import { useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { ChatBubble } from '@/features/mental-health/ai-companion/components/ChatBubble'
import { ActionCards } from '@/features/mental-health/ai-companion/components/ActionCards'
import { useMounima } from '@/features/mental-health/ai-companion/hooks/useMounima'
import type { AmiMessage } from '@/types/mentalHealth'

export default function AssistantTab() {
  const [input, setInput] = useState('')
  const { messages, isLoading, showCrisis, sendMessage } = useMounima()
  const listRef = useRef<FlatList<AmiMessage>>(null)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    await sendMessage(text)
    listRef.current?.scrollToEnd({ animated: true })
  }

  const showWelcome = messages.length === 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontSize: 12, color: '#006685', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>M-Santé</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
              Mounima{' '}
              <MaterialIcons name="favorite" size={18} color="#006685" />
            </Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 4 }}
          ListHeaderComponent={
            showWelcome ? (
              <View style={{ alignItems: 'center', paddingVertical: 32, gap: 24 }}>
                <View
                  style={{
                    width: 128,
                    height: 128,
                    borderRadius: 64,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#006685',
                    shadowColor: '#82d8ff',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 40,
                    elevation: 10,
                  }}
                >
                  <MaterialIcons name="waves" size={48} color="#ffffff" />
                </View>
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 22, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
                    Comment vous sentez-vous ?
                  </Text>
                  <Text style={{ fontSize: 16, color: '#6f787e', fontFamily: 'Manrope' }}>Je vous écoute...</Text>
                </View>
                <ActionCards showCrisis={false} />
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {showCrisis && messages.length > 0 && <ActionCards showCrisis={true} />}
              {isLoading && (
                <View style={{
                  alignSelf: 'flex-start',
                  backgroundColor: 'rgba(229,238,255,0.6)',
                  borderRadius: 16,
                  borderTopLeftRadius: 0,
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  marginTop: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: '#82d8ff',
                }}>
                  <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope' }}>Mounima écrit...</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => <ChatBubble message={item} />}
          onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd()}
        />

        <View style={{ paddingHorizontal: 24, paddingBottom: 16 }}>
          <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', marginBottom: 12 }}>
            Cet espace ne remplace pas un professionnel de santé
          </Text>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: 'rgba(220,233,255,0.9)',
            borderRadius: 9999,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.4)',
          }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Partagez ce que vous ressentez..."
              placeholderTextColor="#6f787e"
              style={{ flex: 1, fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope' }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#006685',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !input.trim() || isLoading ? 0.4 : 1,
              }}
            >
              <MaterialIcons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
