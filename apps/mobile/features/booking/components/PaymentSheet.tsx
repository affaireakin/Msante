import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native'
import { useState } from 'react'
import type { PaymentProvider } from '@/types/booking'
import { PrimaryButton } from '@/components/ui'

interface PaymentSheetProps {
  visible: boolean
  amount: number
  currency: string
  onConfirm: (provider: PaymentProvider, phone: string) => void
  onClose: () => void
}

const PROVIDERS: Array<{ id: PaymentProvider; label: string; emoji: string; placeholder: string }> = [
  { id: 'wave', label: 'Wave', emoji: '💙', placeholder: '+221 77 000 00 00' },
  { id: 'orange_money', label: 'Orange Money', emoji: '🟠', placeholder: '+221 77 000 00 00' },
]

export function PaymentSheet({ visible, amount, currency, onConfirm, onClose }: PaymentSheetProps) {
  const [selected, setSelected] = useState<PaymentProvider | null>(null)
  const [phone, setPhone] = useState('')

  const selectedProvider = PROVIDERS.find(p => p.id === selected)
  const canPay = !!selected && phone.trim().length >= 9

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity className="flex-1 bg-black/40" activeOpacity={1} onPress={onClose} />
      <View className="bg-background rounded-t-2xl px-6 pt-6 pb-10">
        <View className="w-10 h-1 bg-outline-variant rounded-full self-center mb-6" />
        <Text className="text-lg font-bold text-on-surface font-manrope mb-1">
          Moyen de paiement
        </Text>
        <Text className="text-2xl font-black text-primary font-manrope mb-6">
          {amount?.toLocaleString()} {currency}
        </Text>

        {/* Provider selection */}
        <View className="gap-3 mb-5">
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => setSelected(p.id)}
              className={`flex-row items-center gap-3 p-4 rounded-xl border ${
                selected === p.id ? 'border-primary bg-primary-container/30' : 'border-outline-variant bg-white/60'
              }`}
            >
              <Text className="text-2xl">{p.emoji}</Text>
              <Text className="flex-1 text-base font-manrope font-semibold text-on-surface">
                {p.label}
              </Text>
              <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                selected === p.id ? 'border-primary' : 'border-outline-variant'
              }`}>
                {selected === p.id && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Phone number — always required */}
        {selected && (
          <View className="mb-6 gap-1.5">
            <Text className="text-sm font-manrope font-semibold text-on-surface-variant">
              Numéro {selectedProvider?.label}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={selectedProvider?.placeholder}
              keyboardType="phone-pad"
              className="border border-outline-variant rounded-xl px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low"
              placeholderTextColor="#6f787e"
            />
            <Text className="text-xs text-on-surface-variant font-manrope">
              Vous recevrez une invitation de paiement via PayDunya
            </Text>
          </View>
        )}

        <PrimaryButton
          label={`Payer ${amount?.toLocaleString()} ${currency}`}
          onPress={() => selected && onConfirm(selected, phone.trim())}
          disabled={!canPay}
        />
      </View>
    </Modal>
  )
}
