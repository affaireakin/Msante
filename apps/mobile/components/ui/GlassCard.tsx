import { View } from 'react-native'
import type { ViewProps } from 'react-native'

interface GlassCardProps extends ViewProps {
  children: React.ReactNode
  className?: string
}

export function GlassCard({ children, className = '', style, ...props }: GlassCardProps) {
  return (
    <View
      className={`bg-white/60 rounded-xl p-5 border border-white/80 ${className}`}
      style={[{ shadowColor: '#006685', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 30, elevation: 3 }, style]}
      {...props}
    >
      {children}
    </View>
  )
}
