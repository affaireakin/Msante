import { View, Text } from 'react-native'
import type { MounimaMessage } from '@/types/mentalHealth'

interface Props {
  message: MounimaMessage
}

export function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user'
  const time = new Date(message.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  if (isUser) {
    return (
      <View className="self-end max-w-[85%]">
        <View
          className="bg-surface-container-low/80 rounded-2xl rounded-tr-none p-5 border border-white/50"
          style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}
        >
          <Text className="text-sm text-on-surface font-manrope">{message.content}</Text>
        </View>
        <Text className="text-right text-[10px] text-outline font-manrope mt-1 mr-2">{time}</Text>
      </View>
    )
  }

  return (
    <View className="self-start max-w-[90%] mt-4">
      <View
        className="bg-surface-container/60 rounded-2xl rounded-tl-none p-5 border border-white/50 border-l-4 border-l-primary-container"
        style={{ shadowColor: '#006685', shadowOpacity: 0.05, shadowRadius: 8, elevation: 1 }}
      >
        <View className="flex-row items-center gap-2 mb-2">
          <Text className="text-xs font-semibold text-primary font-manrope uppercase tracking-wider">M-Santé Assistant</Text>
        </View>
        <Text className="text-sm text-on-surface font-manrope leading-relaxed">{message.content}</Text>
      </View>
    </View>
  )
}
