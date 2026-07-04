import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'outline'
}

export function PrimaryButton({
  label, onPress, loading, disabled, variant = 'primary',
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary'
  const isDisabled = disabled || loading
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={{
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isPrimary ? '#82d8ff' : 'transparent',
        borderWidth: isPrimary ? 0 : 1.5,
        borderColor: '#82d8ff',
        opacity: isDisabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#0b1c30' : '#82d8ff'} />
      ) : (
        <Text style={{
          fontFamily: 'Manrope',
          fontWeight: '800',
          fontSize: 15,
          color: isPrimary ? '#0b1c30' : '#005e7a',
        }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}
