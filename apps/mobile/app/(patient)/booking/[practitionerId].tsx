import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { useAvailability } from '@/features/practitioners/hooks/useAvailability'
import { WeekCalendar } from '@/features/practitioners/components/WeekCalendar'
import { SlotPicker } from '@/features/practitioners/components/SlotPicker'
import { PrimaryButton } from '@/components/ui'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import type { SessionType, TimeSlot } from '@/types/booking'

const SESSION_TYPES: Array<{ id: SessionType; label: string; emoji: string }> = [
  { id: 'video', label: 'Vidéo', emoji: '📹' },
  { id: 'audio', label: 'Audio', emoji: '🎙️' },
  { id: 'chat', label: 'Chat', emoji: '💬' },
]

export default function BookingScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>()
  const router = useRouter()
  const { data: practitioner } = usePractitioner(practitionerId)
  const { data: slots, isLoading } = useAvailability(
    practitionerId,
    practitioner?.session_duration_min ?? 60
  )

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [sessionType, setSessionType] = useState<SessionType>('video')

  const { setSlot, setSessionType: storeSetSessionType, setPractitioner, setAmount } = useBookingStore()

  const availableDates = [...new Set((slots ?? []).filter(s => s.available).map(s => s.date))]

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlotKey(`${slot.date}-${slot.start_time}`)
    setSelectedSlot(slot)
  }

  const handleConfirm = () => {
    if (!selectedSlot || !practitioner) return
    setPractitioner(practitionerId, practitioner.users?.full_name ?? 'Praticien')
    setSlot({
      date: selectedSlot.date,
      startTime: selectedSlot.start_time,
      endTime: selectedSlot.end_time,
    })
    storeSetSessionType(sessionType)
    if (practitioner.session_price) {
      setAmount(practitioner.session_price, practitioner.session_currency)
    }
    router.push('/(patient)/confirm-session')
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="px-6 pt-4 mb-6">
          <TouchableOpacity onPress={() => router.back()} className="mb-4">
            <Text className="text-primary font-manrope font-medium">← Retour</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-on-surface font-manrope">
            Choisir un créneau
          </Text>
          <Text className="text-sm text-on-surface-variant font-manrope mt-1">
            {practitioner?.users?.full_name} · {practitioner?.session_duration_min} min
          </Text>
        </View>

        {/* Type de session */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-on-surface font-manrope mb-3">
            Type de consultation
          </Text>
          <View className="flex-row gap-2">
            {SESSION_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSessionType(t.id)}
                className={`flex-1 py-3 rounded-xl border items-center gap-1 ${
                  sessionType === t.id ? 'bg-primary border-primary' : 'bg-white/60 border-white/80'
                }`}
              >
                <Text className="text-lg">{t.emoji}</Text>
                <Text className={`text-xs font-manrope font-medium ${sessionType === t.id ? 'text-white' : 'text-on-surface'}`}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calendrier */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-on-surface font-manrope px-6 mb-3">
            Choisir une date
          </Text>
          {isLoading ? (
            <View className="h-20 items-center justify-center">
              <ActivityIndicator color="#006685" />
            </View>
          ) : (
            <WeekCalendar
              selectedDate={selectedDate}
              availableDates={availableDates}
              onSelectDate={setSelectedDate}
            />
          )}
        </View>

        {/* Créneaux */}
        {selectedDate && (
          <View className="px-6">
            <Text className="text-sm font-semibold text-on-surface font-manrope mb-3">
              Créneaux disponibles
            </Text>
            <SlotPicker
              slots={slots ?? []}
              selectedDate={selectedDate}
              selectedSlot={selectedSlotKey}
              onSelectSlot={handleSlotSelect}
            />
          </View>
        )}
      </ScrollView>

      {selectedSlot && (
        <View className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-4 bg-background/90">
          <PrimaryButton
            label={`Confirmer — ${selectedSlot.start_time} le ${selectedSlot.date}`}
            onPress={handleConfirm}
          />
        </View>
      )}
    </SafeAreaView>
  )
}
