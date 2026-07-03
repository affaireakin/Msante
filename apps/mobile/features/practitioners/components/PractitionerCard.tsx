import { View, Text, TouchableOpacity } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { PractitionerWithUser } from '../hooks/usePractitioners'

interface PractitionerCardProps {
  practitioner: PractitionerWithUser
  onPress: () => void
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

const AVATAR_COLORS = ['#82d8ff', '#705d00', '#1d7a3a', '#5c5f61', '#c2185b']

export function PractitionerCard({ practitioner, onPress }: PractitionerCardProps) {
  const name = practitioner.users?.full_name ?? 'Praticien'
  const isVerified = practitioner.verification_status === 'approved'
  const price = practitioner.session_price
  const currency = practitioner.session_currency ?? 'XOF'
  const duration = practitioner.session_duration_min ?? 60
  const langs = (practitioner.languages ?? ['fr']).slice(0, 2)
  const colorIndex = name.charCodeAt(0) % AVATAR_COLORS.length
  const avatarColor = AVATAR_COLORS[colorIndex]

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#82d8ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(229,238,255,0.8)',
      }}
    >
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        {/* Avatar */}
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: avatarColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ color: '#fff', fontFamily: 'Manrope', fontWeight: '800', fontSize: 18 }}>{getInitials(name)}</Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, gap: 4 }}>
          {/* Name + verified */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', flex: 1, marginRight: 8 }} numberOfLines={1}>
              {name}
            </Text>
            {isVerified && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#e8f5e9', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 }}>
                <MaterialIcons name="verified" size={11} color="#1d7a3a" />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#1d7a3a', fontFamily: 'Manrope' }}>Certifié</Text>
              </View>
            )}
          </View>

          {/* Speciality */}
          <Text style={{ fontSize: 13, color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '600' }}>{practitioner.speciality}</Text>

          {/* Rating + languages */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {practitioner.rating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ color: '#f59e0b', fontSize: 13 }}>★</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#0b1c30', fontFamily: 'Manrope' }}>
                  {Number(practitioner.rating).toFixed(1)}
                </Text>
                <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>
                  ({practitioner.total_reviews})
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>Nouveau</Text>
            )}
            <View style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#bec8ce' }} />
            <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope' }}>
              {langs.map(l => l.toUpperCase()).join(' · ')}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom row: price + duration + book button */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
        <View>
          {price ? (
            <Text style={{ fontSize: 16, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
              {new Intl.NumberFormat('fr-FR').format(price)} <Text style={{ fontSize: 11, fontWeight: '600', color: '#6f787e' }}>{currency}</Text>
            </Text>
          ) : (
            <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope' }}>Tarif à définir</Text>
          )}
          <Text style={{ fontSize: 10, color: '#6f787e', fontFamily: 'Manrope', marginTop: 1 }}>{duration} min · séance</Text>
        </View>
        <TouchableOpacity onPress={onPress} style={{ backgroundColor: '#82d8ff', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontFamily: 'Manrope' }}>Réserver</Text>
          <MaterialIcons name="arrow-forward" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
}
