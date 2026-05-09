import { View, Text, TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'

interface AppTextInputProps extends TextInputProps {
  label: string
  error?: string
}

export function AppTextInput({ label, error, style, ...props }: AppTextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '500', color: '#3f484d' }}>
        {label}
      </Text>
      <TextInput
        style={[{
          borderWidth: 1,
          borderColor: error ? '#ba1a1a' : '#bec8ce',
          borderRadius: 10,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 15,
          fontFamily: 'Manrope',
          color: '#0b1c30',
          backgroundColor: '#eff4ff',
        }, style]}
        placeholderTextColor="#6f787e"
        {...props}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: '#ba1a1a', fontFamily: 'Manrope' }}>{error}</Text>
      ) : null}
    </View>
  )
}
