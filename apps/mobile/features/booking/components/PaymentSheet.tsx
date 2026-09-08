import { View, Text, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { useState } from 'react'
import type { PaymentProvider } from '@/types/booking'
import { PrimaryButton } from '@/components/ui'

interface PaymentSheetProps {
  visible: boolean
  amount: number
  currency: string
  onConfirm: (provider: PaymentProvider, phone: string | undefined) => void
  onClose: () => void
}

const PROVIDERS: Array<{
  id: PaymentProvider
  label: string
  emoji: string
  placeholder: string | null
}> = [
  { id: 'wave',         label: 'Wave',          emoji: '💙', placeholder: '+221 77 000 00 00' },
  { id: 'orange_money', label: 'Orange Money',   emoji: '🟠', placeholder: '+221 77 000 00 00' },
  { id: 'card',         label: 'Carte bancaire', emoji: '💳', placeholder: null },
]

export function PaymentSheet({ visible, amount, currency, onConfirm, onClose }: PaymentSheetProps) {
  const [selected, setSelected] = useState<PaymentProvider | null>(null)
  const [phone, setPhone] = useState('')

  const selectedProvider = PROVIDERS.find(p => p.id === selected)
  const needsPhone = selected !== null && selected !== 'card'
  const canPay = selected !== null && (needsPhone ? phone.trim().length >= 9 : true)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Bug remonté : au moment de saisir le numéro pour Wave/Orange Money,
          le clavier recouvrait le champ — on ne voyait pas ce qu'on tapait.
          Même correctif que la saisie des créneaux praticien. */}
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
              onPress={() => { setSelected(p.id); setPhone('') }}
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

        {/* Phone number — required for Wave / Orange Money only */}
        {needsPhone && (
          <View className="mb-6 gap-1.5">
            <Text className="text-sm font-manrope font-semibold text-on-surface-variant">
              Numéro {selectedProvider?.label}
            </Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={selectedProvider?.placeholder ?? ''}
              keyboardType="phone-pad"
              className="border border-outline-variant rounded-xl px-4 py-3 text-base font-manrope text-on-surface bg-surface-container-low"
              placeholderTextColor="#6f787e"
            />
            <Text className="text-xs text-on-surface-variant font-manrope">
              Vous recevrez une invitation de paiement via PayDunya
            </Text>
          </View>
        )}

        {/* Card info banner */}
        {selected === 'card' && (
          <View className="mb-6 p-3 rounded-xl bg-primary-container/20">
            <Text className="text-xs text-on-surface-variant font-manrope text-center">
              Vous serez redirigé vers le formulaire sécurisé PayDunya pour saisir vos coordonnées bancaires (VISA / Mastercard).
            </Text>
          </View>
        )}

        <PrimaryButton
          label={`Payer ${amount?.toLocaleString()} ${currency}`}
          onPress={() => selected && onConfirm(selected, needsPhone ? phone.trim() : undefined)}
          disabled={!canPay}
        />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
