import { useState } from 'react'
import { View, Text, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#006685" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!content.trim() || createEntry.isPending}
            style={{
              backgroundColor: '#006685',
              paddingHorizontal: 20,
              paddingVertical: 8,
              borderRadius: 9999,
              opacity: !content.trim() || createEntry.isPending ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600', fontFamily: 'Manrope' }}>Enregistrer</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.6)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.5)',
            shadowColor: '#006685',
            shadowOffset: { width: 0, height: 16 },
            shadowOpacity: 0.06,
            shadowRadius: 40,
            elevation: 4,
            gap: 16,
          }}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Titre de l'entrée..."
              placeholderTextColor="rgba(111,120,126,0.4)"
              style={{ color: '#0b1c30', fontFamily: 'Manrope', borderBottomWidth: 1, borderBottomColor: 'rgba(190,200,206,0.3)', paddingBottom: 12, fontSize: 20, fontWeight: '600' }}
            />
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 12, color: '#3f484d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Vos émotions</Text>
              <EmotionPicker selected={emotions} onToggle={toggleEmotion} />
            </View>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Écrivez librement. Comment votre esprit traite-t-il la journée ?"
              placeholderTextColor="rgba(111,120,126,0.27)"
              multiline
              style={{ fontSize: 16, color: '#3f484d', fontFamily: 'Manrope', minHeight: 180, textAlignVertical: 'top', lineHeight: 24 }}
            />
          </View>
          <View style={{
            backgroundColor: 'rgba(190,233,255,0.3)',
            borderRadius: 16,
            padding: 20,
            gap: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.6)',
          }}>
            <Text style={{ fontSize: 12, color: '#3f484d', fontFamily: 'Manrope', textTransform: 'uppercase', letterSpacing: 1.2 }}>Réflexions guidées</Text>
            {REFLECTION_PROMPTS.map((p, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setContent(prev => prev + (prev ? '\n\n' : '') + p + '\n')}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.5)',
                  borderRadius: 12,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.4)',
                }}
              >
                <Text style={{ fontSize: 14, color: '#0b1c30', fontFamily: 'Manrope' }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
