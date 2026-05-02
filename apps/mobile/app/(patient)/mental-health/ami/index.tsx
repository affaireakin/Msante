import { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChatBubble } from '@/features/mental-health/ai-companion/components/ChatBubble'
import { ActionCards } from '@/features/mental-health/ai-companion/components/ActionCards'
import { useAmiFriend } from '@/features/mental-health/ai-companion/hooks/useAmiFriend'
import type { AmiMessage } from '@/types/mentalHealth'

export default function AmiChat() {
  const [input, setInput] = useState('')
  const { messages, isLoading, showCrisis, sendMessage } = useAmiFriend()
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
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="px-6 pt-6 pb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-xs text-primary font-manrope uppercase tracking-wider">M-Santé</Text>
            <Text className="text-xl font-bold text-on-surface font-manrope">Ami 💙</Text>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 4 }}
          ListHeaderComponent={
            showWelcome ? (
              <View className="items-center py-8 gap-6">
                <View
                  className="w-32 h-32 rounded-full items-center justify-center"
                  style={{
                    backgroundColor: '#006685',
                    shadowColor: '#82d8ff',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 1,
                    shadowRadius: 40,
                    elevation: 10,
                  }}
                >
                  <Text className="text-5xl">🌊</Text>
                </View>
                <View className="items-center gap-2">
                  <Text className="text-2xl font-semibold text-on-surface font-manrope text-center">
                    Comment vous sentez-vous ?
                  </Text>
                  <Text className="text-base text-outline font-manrope">Je vous écoute...</Text>
                </View>
                <ActionCards showCrisis={false} />
              </View>
            ) : null
          }
          ListFooterComponent={
            <>
              {showCrisis && messages.length > 0 && <ActionCards showCrisis={true} />}
              {isLoading && (
                <View className="self-start bg-surface-container/60 rounded-2xl rounded-tl-none px-5 py-3 mt-4 border-l-4 border-l-primary-container">
                  <Text className="text-sm text-outline font-manrope">Ami écrit...</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => <ChatBubble message={item} />}
          onContentSizeChange={() => messages.length > 0 && listRef.current?.scrollToEnd()}
        />

        <View className="px-6 pb-4">
          <Text className="text-xs text-outline font-manrope text-center mb-3">
            Cet espace ne remplace pas un professionnel de santé
          </Text>
          <View className="flex-row items-center gap-3 bg-surface-container-high/90 rounded-full px-5 py-3 border border-white/40">
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Partagez ce que vous ressentez..."
              placeholderTextColor="#6f787e"
              className="flex-1 text-sm text-on-surface font-manrope"
              style={{ fontFamily: 'Manrope' }}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-full bg-primary items-center justify-center"
              style={{ opacity: !input.trim() || isLoading ? 0.4 : 1 }}
            >
              <Text className="text-white font-bold">→</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
