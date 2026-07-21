import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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
  const [note, setNote] = useState('')
  const addMood = useAddMoodEntry()

  const toggleEmotion = (id: EmotionId) =>
    setEmotions(prev => prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id])

  const handleSave = async () => {
    if (!profile?.id) return
    try {
      await addMood.mutateAsync({ patientId: profile.id, score, emotions, note: note.trim() || undefined })
    } catch {
      Alert.alert('Erreur', "L'enregistrement a échoué. Réessayez.")
      return
    }
    if (score < 3) {
      Alert.alert(
        'Prendre soin de soi',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingTop: 32, paddingBottom: 24, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#82d8ff" />
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', flex: 1 }}>Comment vous sentez-vous ?</Text>
        </View>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.6)',
          borderRadius: 24,
          padding: 24,
          gap: 32,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.5)',
          shadowColor: '#82d8ff',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.05,
          shadowRadius: 30,
          elevation: 3,
        }}>
          <MoodSlider value={score} onChange={setScore} />
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#3f484d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Vos émotions</Text>
            <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
          </View>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#3f484d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Note (optionnel)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Comment s'est passée votre journée ?"
              placeholderTextColor="#6f787e"
              multiline
              numberOfLines={3}
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(190,200,206,0.4)',
                backgroundColor: 'rgba(255,255,255,0.4)',
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                fontFamily: 'Manrope',
                color: '#0b1c30',
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
          </View>
        </View>
        <View style={{ marginTop: 24 }}>
          <PrimaryButton label="Enregistrer" onPress={handleSave} loading={addMood.isPending} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
