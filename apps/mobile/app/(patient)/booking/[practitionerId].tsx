import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { useAvailability } from '@/features/practitioners/hooks/useAvailability'
import { WeekCalendar } from '@/features/practitioners/components/WeekCalendar'
import { SlotPicker } from '@/features/practitioners/components/SlotPicker'
import { PrimaryButton } from '@/components/ui'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import type { SessionType, TimeSlot } from '@/types/booking'

type SessionTypeItem = { id: SessionType; label: string; iconName: 'videocam' | 'mic' | 'location-on' }

const SESSION_TYPES: SessionTypeItem[] = [
  { id: 'video',      label: 'Vidéo',       iconName: 'videocam' },
  { id: 'audio',      label: 'Audio',        iconName: 'mic' },
  { id: 'presentiel', label: 'Présentiel',   iconName: 'location-on' },
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#006685" />
            <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Choisir un créneau
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            {practitioner?.users?.full_name} · {practitioner?.session_duration_min} min
          </Text>
        </View>

        {/* Type de session */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 12 }}>
            Type de consultation
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SESSION_TYPES.map(t => (
              <TouchableOpacity
                key={t.id}
                onPress={() => setSessionType(t.id)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor: sessionType === t.id ? '#006685' : 'rgba(255,255,255,0.6)',
                  borderColor: sessionType === t.id ? '#006685' : 'rgba(255,255,255,0.8)',
                }}
              >
                <MaterialIcons name={t.iconName} size={20} color={sessionType === t.id ? '#ffffff' : '#0b1c30'} />
                <Text style={{ fontSize: 12, fontFamily: 'Manrope', fontWeight: '500', color: sessionType === t.id ? '#ffffff' : '#0b1c30' }}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Calendrier */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', paddingHorizontal: 24, marginBottom: 12 }}>
            Choisir une date
          </Text>
          {isLoading ? (
            <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
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
          <View style={{ paddingHorizontal: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 12 }}>
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
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 24, paddingBottom: 32, paddingTop: 16, backgroundColor: 'rgba(248,249,255,0.9)' }}>
          <PrimaryButton
            label={`Confirmer — ${selectedSlot.start_time} le ${selectedSlot.date}`}
            onPress={handleConfirm}
          />
        </View>
      )}
    </SafeAreaView>
  )
}
