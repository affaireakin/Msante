import { View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { AppTextInput } from './AppTextInput'

export interface PhoneCountryOption {
  id: string
  flag: string
  dial: string
}

interface PhoneCountryFieldProps {
  countries: PhoneCountryOption[]
  selectedId: string
  onSelectCountry: (id: string) => void
  phone: string
  onChangePhone: (v: string) => void
  error?: string
  helperText?: string
}

export function PhoneCountryField({
  countries, selectedId, onSelectCountry, phone, onChangePhone, error, helperText,
}: PhoneCountryFieldProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '500', color: '#3f484d' }}>Indicatif pays</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
        {countries.map(c => (
          <TouchableOpacity
            key={c.id}
            onPress={() => onSelectCountry(c.id)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
              borderWidth: 1.5,
              borderColor: selectedId === c.id ? '#82d8ff' : '#bec8ce',
              backgroundColor: selectedId === c.id ? '#e5eeff' : '#eff4ff',
            }}
          >
            <Text style={{ fontSize: 16 }}>{c.flag}</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '700', color: selectedId === c.id ? '#82d8ff' : '#0b1c30' }}>
              {c.dial}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <AppTextInput
        label="Téléphone"
        value={phone}
        onChangeText={onChangePhone}
        keyboardType="phone-pad"
        placeholder="77 000 00 00"
        error={error}
      />
      {helperText && !error ? (
        <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>{helperText}</Text>
      ) : null}
    </View>
  )
}
