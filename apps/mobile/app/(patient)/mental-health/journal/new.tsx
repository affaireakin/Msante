import { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { EmotionPicker } from '@/features/mental-health/mood/components/EmotionPicker'
import { useCreateJournalEntry } from '@/features/mental-health/journal/hooks/useJournalEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'
import type { EmotionId } from '@/types/mentalHealth'

const REFLECTION_PROMPTS = [
  'Quelle sensation physique est la plus présente en ce moment ?',
  'Identifiez une petite victoire des dernières 24 heures.',
  'Si votre humeur avait une couleur, laquelle serait-ce ?',
]

export default function JournalNew() {
  const router = useRouter()
  const { profile } = useAuth()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [emotions, setEmotions] = useState<EmotionId[]>([])
  const createEntry = useCreateJournalEntry()

  const toggleEmotion = (id: EmotionId) =>
    setEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const handleSave = async () => {
    if (!content.trim() || !profile?.id) return
    const id = await createEntry.mutateAsync({
      patientId: profile.id,
      title: title.trim() || undefined,
      content: content.trim(),
      emotions,
    })
    router.replace(`/(patient)/mental-health/journal/${id}`)
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="px-6 pt-6 pb-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!content.trim() || createEntry.isPending}
            className="bg-primary px-5 py-2 rounded-full"
            style={{ opacity: !content.trim() || createEntry.isPending ? 0.5 : 1 }}
          >
            <Text className="text-white text-sm font-semibold font-manrope">Enregistrer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
          <View
            className="bg-white/60 rounded-3xl p-6 border border-white/50"
            style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.06, shadowRadius: 40, elevation: 4, gap: 16 }}
          >
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Titre de l'entrée..."
              placeholderTextColor="#6f787e66"
              className="text-on-surface font-manrope border-b border-outline-variant/30 pb-3"
              style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: '600' }}
            />
            <View className="gap-2">
              <Text className="text-xs text-on-surface-variant font-manrope uppercase tracking-wider">Vos émotions</Text>
              <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
            </View>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Écrivez librement. Comment votre esprit traite-t-il la journée ?"
              placeholderTextColor="#6f787e44"
              multiline
              className="text-base text-on-surface-variant font-manrope"
              style={{ fontFamily: 'Manrope', minHeight: 180, textAlignVertical: 'top', lineHeight: 24 }}
            />
          </View>
          <View className="bg-primary-fixed/30 rounded-2xl p-5 gap-3 border border-white/60">
            <Text className="text-xs text-on-surface-variant font-manrope uppercase tracking-wider">Réflexions guidées</Text>
            {REFLECTION_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setContent(prev => prev + (prev ? '\n\n' : '') + p + '\n')}
                className="bg-white/50 rounded-xl p-4 border border-white/40"
              >
                <Text className="text-sm text-on-surface font-manrope">{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
