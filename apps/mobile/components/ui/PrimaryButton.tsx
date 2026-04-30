import { TouchableOpacity, Text, ActivityIndicator } from 'react-native'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'outline'
  className?: string
}

export function PrimaryButton({
  label, onPress, loading, disabled, variant = 'primary', className = '',
}: PrimaryButtonProps) {
  const isPrimary = variant === 'primary'
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      className={`rounded-lg py-4 items-center justify-center ${
        isPrimary ? 'bg-primary' : 'border border-primary bg-transparent'
      } ${disabled || loading ? 'opacity-60' : ''} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#ffffff' : '#006685'} />
      ) : (
        <Text className={`font-manrope font-semibold text-base ${isPrimary ? 'text-white' : 'text-primary'}`}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  )
}
