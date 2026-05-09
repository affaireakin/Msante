import { View, Text } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'

export default function Support() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <MaterialIcons name="support-agent" size={52} color="#006685" />
      <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope', marginTop: 16, textAlign: 'center' }}>Support</Text>
      <Text style={{ fontSize: 14, color: '#6f787e', fontFamily: 'Manrope', marginTop: 8, textAlign: 'center' }}>
        Aide et ressources — à venir
      </Text>
      <Text style={{ fontSize: 14, color: '#006685', fontFamily: 'Manrope', marginTop: 24, fontWeight: '600', textAlign: 'center' }}>
        SOS Amitié Sénégal{'\n'}+221 33 823 8020
      </Text>
    </SafeAreaView>
  )
}
