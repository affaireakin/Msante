import { View, Text, TouchableOpacity } from 'react-native'
import type { TimeSlot } from '@/types/booking'

interface SlotPickerProps {
  slots: TimeSlot[]
  selectedDate: string
  selectedSlot: string | null
  onSelectSlot: (slot: TimeSlot) => void
}

export function SlotPicker({ slots, selectedDate, selectedSlot, onSelectSlot }: SlotPickerProps) {
  const daySlots = slots.filter(s => s.date === selectedDate)

  if (daySlots.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-on-surface-variant font-manrope text-sm">
          Aucun créneau disponible ce jour
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-row flex-wrap gap-2">
      {daySlots.map(slot => {
        const key = `${slot.date}-${slot.start_time}`
        const isSelected = selectedSlot === key
        return (
          <TouchableOpacity
            key={key}
            onPress={() => slot.available && onSelectSlot(slot)}
            disabled={!slot.available}
            className={`px-4 py-2 rounded-lg border ${
              isSelected ? 'bg-primary border-primary' :
              slot.available ? 'bg-white/60 border-outline-variant' :
              'bg-surface-container border-outline-variant opacity-40'
            }`}
          >
            <Text className={`text-sm font-manrope font-medium ${isSelected ? 'text-white' : 'text-on-surface'}`}>
              {slot.start_time}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
