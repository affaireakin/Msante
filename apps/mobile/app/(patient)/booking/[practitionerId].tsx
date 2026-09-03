import { useState, useMemo, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { usePractitioner } from '@/features/practitioners/hooks/usePractitioner'
import { useAvailability, type ConsultationType } from '@/features/practitioners/hooks/useAvailability'
import { WeekCalendar } from '@/features/practitioners/components/WeekCalendar'
import { SlotPicker } from '@/features/practitioners/components/SlotPicker'
import { PrimaryButton } from '@/components/ui'
import { useBookingStore } from '@/features/booking/store/bookingStore'
import { supabase } from '@/services/supabase'
import type { SessionType, TimeSlot } from '@/types/booking'

export default function BookingScreen() {
  const { practitionerId } = useLocalSearchParams<{ practitionerId: string }>()
  const router = useRouter()
  const { data: practitioner } = usePractitioner(practitionerId)

  const { data: isBlocked } = useQuery({
    queryKey: ['patient-block', practitionerId],
    enabled: !!practitionerId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const { data } = await supabase
        .from('practitioner_patient_blocks')
        .select('id, unblocked_at')
        .eq('practitioner_id', practitionerId)
        .eq('patient_id', user.id)
        .maybeSingle()
      return !!data && !data.unblocked_at
    },
  })

  // Types de consultation configurés par le praticien (consultation_types) —
  // remplace l'ancien sélecteur fixe Vidéo/Audio/Présentiel : plus d'Audio
  // (retiré du mobile, section 11 du cahier des charges), et les types
  // affichés sont réellement ceux que CE praticien propose.
  const { data, isLoading } = useAvailability(practitionerId)
  const types = data?.types ?? []
  const allSlots = data?.slots ?? []

  const [selectedType, setSelectedType] = useState<ConsultationType | null>(null)
  const [selectedSubMode, setSelectedSubMode] = useState<'presentiel' | 'video' | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)

  // Sélectionne le premier type dès que la liste charge.
  useEffect(() => {
    if (!selectedType && types.length > 0) setSelectedType(types[0])
  }, [types, selectedType])

  useEffect(() => {
    setSelectedSubMode(selectedType?.mode === 'both' ? 'video' : null)
  }, [selectedType])

  const typeSlots = useMemo(
    () => selectedType ? allSlots.filter(s => s.type.id === selectedType.id) : [],
    [allSlots, selectedType],
  )

  const slots: TimeSlot[] = useMemo(
    () => typeSlots.map(s => ({ date: s.date, start_time: s.start_time, end_time: s.end_time, available: !s.taken })),
    [typeSlots],
  )

  const { setSlot, setSessionType: storeSetSessionType, setPractitioner, setAmount } = useBookingStore()

  const availableDates = [...new Set(slots.filter(s => s.available).map(s => s.date))]

  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlotKey(`${slot.date}-${slot.start_time}`)
    setSelectedSlot(slot)
  }

  const handleConfirm = () => {
    if (!selectedSlot || !practitioner || !selectedType) return
    const finalType: SessionType = selectedType.mode === 'both' ? (selectedSubMode ?? 'video') : (selectedType.mode as SessionType)
    setPractitioner(practitionerId, practitioner.users?.full_name ?? 'Praticien')
    setSlot({
      date: selectedSlot.date,
      startTime: selectedSlot.start_time,
      endTime: selectedSlot.end_time,
    })
    storeSetSessionType(finalType)
    if (selectedType.price) {
      setAmount(selectedType.price, selectedType.currency)
    }
    router.push('/(patient)/confirm-session')
  }

  if (isBlocked) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fce4ec', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <MaterialIcons name="block" size={36} color="#ba1a1a" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center', marginBottom: 8 }}>
          Réservation impossible
        </Text>
        <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 22 }}>
          Ce praticien ne peut pas vous recevoir en consultation pour le moment.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: '#82d8ff', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontFamily: 'Manrope' }}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (practitioner && practitioner.accepting_new_patients === false) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff8e1', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <MaterialIcons name="person-off" size={36} color="#705d00" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center', marginBottom: 8 }}>
          Nouveaux patients non acceptés
        </Text>
        <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 22 }}>
          Ce praticien n'accepte pas de nouveaux patients actuellement. Consultez d'autres professionnels disponibles.
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 24, backgroundColor: '#82d8ff', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}>
          <Text style={{ color: '#0b1c30', fontWeight: '800', fontFamily: 'Manrope' }}>Voir d'autres praticiens</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Choisir un créneau
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            {practitioner?.users?.full_name}{selectedType ? ` · ${selectedType.duration_min} min` : ''}
          </Text>
        </View>

        {/* Type de consultation (prestations réellement configurées par ce praticien) */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', marginBottom: 12 }}>
            Type de consultation
          </Text>
          {types.length === 0 && !isLoading ? (
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', fontStyle: 'italic' }}>
              Ce praticien n&apos;a pas encore configuré ses prestations.
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {types.map(t => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => { setSelectedType(t); setSelectedDate(null); setSelectedSlot(null); setSelectedSlotKey(null) }}
                  style={{
                    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 4,
                    backgroundColor: selectedType?.id === t.id ? '#82d8ff' : 'rgba(255,255,255,0.6)',
                    borderColor: selectedType?.id === t.id ? '#82d8ff' : 'rgba(255,255,255,0.8)',
                  }}
                >
                  <MaterialIcons
                    name={t.mode === 'video' ? 'videocam' : t.mode === 'presentiel' ? 'location-on' : 'sync-alt'}
                    size={20}
                    color={selectedType?.id === t.id ? '#ffffff' : '#0b1c30'}
                  />
                  <Text style={{ fontSize: 12, fontFamily: 'Manrope', fontWeight: '500', color: selectedType?.id === t.id ? '#ffffff' : '#0b1c30' }}>
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedType?.mode === 'both' && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              {(['video', 'presentiel'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setSelectedSubMode(m)}
                  style={{
                    flex: 1, paddingVertical: 8, borderRadius: 999, alignItems: 'center',
                    backgroundColor: selectedSubMode === m ? '#e5eeff' : 'transparent',
                    borderWidth: 1, borderColor: selectedSubMode === m ? '#82d8ff' : '#bec8ce',
                  }}
                >
                  <Text style={{ fontSize: 12, fontFamily: 'Manrope', fontWeight: '700', color: selectedSubMode === m ? '#82d8ff' : '#6f787e' }}>
                    {m === 'video' ? 'Vidéo' : 'Présentiel'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Calendrier */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope', paddingHorizontal: 24, marginBottom: 12 }}>
            Choisir une date
          </Text>
          {isLoading ? (
            <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#82d8ff" />
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
