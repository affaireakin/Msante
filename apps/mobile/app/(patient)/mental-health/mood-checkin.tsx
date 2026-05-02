import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { MoodSlider } from '@/features/mental-health/mood/components/MoodSlider'
import { EmotionPicker } from '@/features/mental-health/mood/components/EmotionPicker'
import { useAddMoodEntry } from '@/features/mental-health/mood/hooks/useMoodEntries'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { PrimaryButton } from '@/components/ui'
import type { EmotionId } from '@/types/mentalHealth'

export default function MoodCheckin() {
  const router = useRouter()
  const { profile } = useAuth()
  const [score, setScore] = useState(6)
  const [emotions, setEmotions] = useState<EmotionId[]>([])
  const addMood = useAddMoodEntry()

  const toggleEmotion = (id: EmotionId) =>
    setEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const handleSave = async () => {
    if (!profile?.id) return
    await addMood.mutateAsync({ patientId: profile.id, score, emotions })
    if (score < 3) {
      Alert.alert(
        'Prendre soin de soi 💙',
        'Votre humeur semble basse. Parler à un praticien peut aider.',
        [
          { text: 'Plus tard', onPress: () => router.back() },
          { text: 'Trouver un praticien', onPress: () => router.push('/(patient)/find-practitioners') },
        ]
      )
    } else {
      router.back()
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="pt-8 pb-6 flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary text-2xl">←</Text>
          </TouchableOpacity>
          <Text className="text-xl font-bold text-on-surface font-manrope flex-1">Comment vous sentez-vous ?</Text>
        </View>
        <View
          className="bg-white/60 rounded-3xl p-6 gap-8 border border-white/50"
          style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }}
        >
          <MoodSlider value={score} onChange={setScore} />
          <View className="gap-3">
            <Text className="text-xs font-semibold text-on-surface-variant font-manrope uppercase tracking-wider">Vos émotions</Text>
            <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
          </View>
        </View>
        <View className="mt-6">
          <PrimaryButton label="Enregistrer" onPress={handleSave} loading={addMood.isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
