import { ScrollView, TouchableOpacity, Text, View } from 'react-native'

const SPECIALITIES = [
  'Psychologue', 'Psychiatre', 'Thérapeute', 'Coach bien-être', 'Nutritionniste',
  'Médecin généraliste', 'Sophrologue', 'Kinésithérapeute', 'Sage-femme',
  'Cardiologue', 'Dermatologue', 'Gynécologue', 'Pédiatre', 'Ophtalmologue',
  'Infirmier(e)', 'Dentiste',
]
const LANGUAGES = ['Français', 'English', 'Wolof']

interface FilterBarProps {
  activeSpeciality: string | null
  activeLanguage: string | null
  onSpecialityChange: (s: string | null) => void
  onLanguageChange: (l: string | null) => void
}

export function FilterBar({ activeSpeciality, activeLanguage, onSpecialityChange, onLanguageChange }: FilterBarProps) {
  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 px-1 py-1">
          {SPECIALITIES.map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => onSpecialityChange(activeSpeciality === s ? null : s)}
              className={`px-3 py-1.5 rounded-full border ${
                activeSpeciality === s ? 'bg-primary border-primary' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className={`text-xs font-manrope font-medium ${activeSpeciality === s ? 'text-white' : 'text-on-surface'}`}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 px-1 pb-1">
          {LANGUAGES.map(l => (
            <TouchableOpacity
              key={l}
              onPress={() => onLanguageChange(activeLanguage === l ? null : l)}
              className={`px-3 py-1.5 rounded-full border ${
                activeLanguage === l ? 'bg-secondary-container border-secondary-container' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className="text-xs font-manrope font-medium text-on-surface">
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
