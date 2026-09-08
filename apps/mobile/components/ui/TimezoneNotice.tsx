import { View, Text } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { deviceTimeZone, isDeviceOffPlatform, offsetLabel, PLATFORM_TZ_LABEL } from '@/services/timezone'

/**
 * Bandeau d'avertissement de fuseau horaire.
 *
 * Ne s'affiche QUE si l'appareil n'est pas sur l'heure du Sénégal — inutile
 * de polluer l'écran pour les utilisateurs sur place, qui sont la majorité.
 * Pour les autres (praticien en déplacement, patient de la diaspora), c'est
 * ce qui évite le décalage de 2h constaté sur un vrai rendez-vous.
 */
export function TimezoneNotice({ context = 'affichés', compact = false }: {
  /** "affichés" pour une lecture, "saisis" pour un formulaire. */
  context?: 'affichés' | 'saisis'
  compact?: boolean
}) {
  if (!isDeviceOffPlatform()) return null

  const offset = offsetLabel()
  const tz = deviceTimeZone()

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: '#fff8e1', borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: compact ? 8 : 10,
      borderWidth: 1, borderColor: 'rgba(112,93,0,0.20)',
    }}>
      <MaterialIcons name="public" size={15} color="#705d00" style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: 11, fontWeight: '600', color: '#705d00', lineHeight: 16 }}>
        Horaires {context} en {PLATFORM_TZ_LABEL}. Votre téléphone est sur {tz}
        {offset ? ` (${offset})` : ''} — l'heure locale est indiquée entre parenthèses.
      </Text>
    </View>
  )
}
