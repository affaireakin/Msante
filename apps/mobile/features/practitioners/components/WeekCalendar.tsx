import { ScrollView, TouchableOpacity, Text, View } from 'react-native'

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

interface WeekCalendarProps {
  selectedDate: string | null
  availableDates: string[]
  onSelectDate: (date: string) => void
  daysAhead?: number
}

export function WeekCalendar({ selectedDate, availableDates, onSelectDate, daysAhead = 14 }: WeekCalendarProps) {
  const days = Array.from({ length: daysAhead }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 px-6 py-1">
        {days.map(d => {
          const dateStr = d.toISOString().split('T')[0]
          const isSelected = selectedDate === dateStr
          const hasSlots = availableDates.includes(dateStr)
          const isToday = dateStr === new Date().toISOString().split('T')[0]

          return (
            <TouchableOpacity
              key={dateStr}
              onPress={() => hasSlots && onSelectDate(dateStr)}
              disabled={!hasSlots}
              className={`w-14 py-2 rounded-xl items-center gap-0.5 ${
                isSelected ? 'bg-primary' :
                hasSlots ? 'bg-white/60 border border-white/80' :
                'bg-surface-container opacity-40'
              }`}
            >
              <Text className={`text-xs font-manrope ${isSelected ? 'text-white/70' : 'text-on-surface-variant'}`}>
                {DAY_NAMES[d.getDay()]}
              </Text>
              <Text className={`text-base font-bold font-manrope ${isSelected ? 'text-white' : 'text-on-surface'}`}>
                {d.getDate()}
              </Text>
              <Text className={`text-xs font-manrope ${isSelected ? 'text-white/70' : 'text-on-surface-variant'}`}>
                {MONTH_NAMES[d.getMonth()]}
              </Text>
              {isToday && !isSelected && (
                <View className="w-1 h-1 rounded-full bg-primary mt-0.5" />
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}
