import { View, Text, TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'

interface AppTextInputProps extends TextInputProps {
  label: string
  error?: string
}

export function AppTextInput({ label, error, className = '', ...props }: AppTextInputProps) {
  return (
    <View className="gap-1">
      <Text className="text-sm font-manrope font-medium text-on-surface-variant">{label}</Text>
      <TextInput
        className={`border rounded-lg px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low
          ${error ? 'border-error' : 'border-outline-variant'} ${className}`}
        placeholderTextColor="#6f787e"
        {...props}
      />
      {error ? <Text className="text-xs text-error font-manrope">{error}</Text> : null}
    </View>
  )
}
