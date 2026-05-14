import { View, Text } from 'react-native'

interface Props {
  sentiment: string
  themes: string[]
  suggestion: string
}

export function AIInsightCard({ sentiment, themes, suggestion }: Props) {
  return (
    <View className="bg-primary-fixed/30 rounded-2xl p-4 gap-3 border border-white/60">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg">✨</Text>
        <Text className="text-xs font-semibold text-primary font-manrope uppercase tracking-wider">Insights Mounima</Text>
      </View>
      <View className="gap-1">
        <Text className="text-xs text-on-surface-variant font-manrope">Sentiment détecté</Text>
        <Text className="text-sm font-semibold text-on-surface font-manrope capitalize">{sentiment}</Text>
      </View>
      {themes.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {themes.map(t => (
            <View key={t} className="px-3 py-1 rounded-full bg-primary-container/40">
              <Text className="text-xs text-on-primary-container font-manrope">{t}</Text>
            </View>
          ))}
        </View>
      )}
      <Text className="text-sm text-on-surface font-manrope italic">{suggestion}</Text>
      <Text className="text-xs text-outline font-manrope">Cet espace ne remplace pas un professionnel de santé.</Text>
    </View>
  )
}
