import { View, Text, TextInput } from 'react-native'
import type { TextInputProps } from 'react-native'
import type React from 'react'

interface AppTextInputProps extends TextInputProps {
  label: string
  error?: string
  rightElement?: React.ReactNode
  /** Affiche un astérisque : le champ bloque la soumission tant qu'il est vide. */
  required?: boolean
  /** Précision sous le champ (format attendu, usage de la donnée…). */
  hint?: string
}

export function AppTextInput({ label, error, style, rightElement, required, hint, ...props }: AppTextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontFamily: 'Manrope', fontWeight: '500', color: '#3f484d' }}>
        {label}
        {required ? <Text style={{ color: '#ba1a1a' }}> *</Text> : null}
      </Text>
      <View style={{ position: 'relative' }}>
        <TextInput
          style={[{
            borderWidth: 1,
            borderColor: error ? '#ba1a1a' : '#bec8ce',
            borderRadius: 10,
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingRight: rightElement ? 48 : 16,
            fontSize: 15,
            fontFamily: 'Manrope',
            color: '#0b1c30',
            backgroundColor: '#eff4ff',
          }, style]}
          placeholderTextColor="#6f787e"
          {...props}
        />
        {rightElement ? (
          <View style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
            {rightElement}
          </View>
        ) : null}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: '#ba1a1a', fontFamily: 'Manrope' }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 12, color: '#6f787e', fontFamily: 'Manrope' }}>{hint}</Text>
      ) : null}
    </View>
  )
}
