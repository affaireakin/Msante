import { View, Text, TouchableOpacity } from 'react-native'
import type { PractitionerWithUser } from '../hooks/usePractitioners'

interface PractitionerCardProps {
  practitioner: PractitionerWithUser
  onPress: () => void
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

export function PractitionerCard({ practitioner, onPress }: PractitionerCardProps) {
  const name = practitioner.users?.full_name ?? 'Praticien'
  const isAvailable = practitioner.verification_status === 'approved'

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className="bg-white/60 rounded-xl p-4 border border-white/80 flex-row gap-3 items-start"
      style={{ shadowColor: '#006685', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}
    >
      <View className="w-14 h-14 rounded-xl bg-primary-container items-center justify-center">
        <Text className="text-primary font-manrope font-bold text-lg">{getInitials(name)}</Text>
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-on-surface font-manrope" numberOfLines={1}>
            {name}
          </Text>
          {isAvailable && (
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-emerald-600 font-manrope font-medium">Disponible</Text>
            </View>
          )}
        </View>

        <Text className="text-sm text-on-surface-variant font-manrope">{practitioner.speciality}</Text>

        <View className="flex-row items-center mt-1">
          <View className="flex-row items-center gap-1">
            <Text className="text-amber-400 text-sm">★</Text>
            <Text className="text-sm text-on-surface-variant font-manrope">
              {practitioner.rating?.toFixed(1) ?? 'N/A'}
            </Text>
            <Text className="text-xs text-outline font-manrope">
              ({practitioner.total_reviews})
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  )
}
