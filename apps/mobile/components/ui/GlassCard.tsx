import { View } from 'react-native'
import type { ViewProps } from 'react-native'

interface GlassCardProps extends ViewProps {
  children: React.ReactNode
}

export function GlassCard({ children, style, ...props }: GlassCardProps) {
  return (
    <View
      style={[{
        backgroundColor: 'rgba(255,255,255,0.7)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.85)',
        shadowColor: '#82d8ff',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.06,
        shadowRadius: 30,
        elevation: 3,
      }, style]}
      {...props}
    >
      {children}
    </View>
  )
}
