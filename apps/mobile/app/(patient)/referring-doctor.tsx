import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { useReferringDoctor } from '@/features/patient/hooks/useReferringDoctor'
import { useAuthStore } from '@/features/auth/store/authStore'
import { supabase } from '@/services/supabase'
import { GlassCard } from '@/components/ui/GlassCard'

type ReferringStatus = 'none' | 'pending' | 'accepted' | 'refused'

interface CurrentDoctor {
  referring_doctor_id: string | null
  referring_doctor_status: ReferringStatus
  practitioner: { full_name: string; speciality: string } | null
}

export default function ReferringDoctorScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { generalPractitioners, setReferringDoctor, removeReferringDoctor } = useReferringDoctor()
  const [selecting, setSelecting] = useState(false)

  const { data: current, isLoading: loadingCurrent } = useQuery<CurrentDoctor>({
    queryKey: ['referring-doctor-current', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select(`
          referring_doctor_id,
          referring_doctor_status,
          referring:practitioners!users_referring_doctor_id_fkey(
            speciality,
            users!inner(full_name)
          )
        `)
        .eq('id', profile!.id)
        .single()

      if (!data) return { referring_doctor_id: null, referring_doctor_status: 'none', practitioner: null }

      const ref = (data as any).referring
      return {
        referring_doctor_id: (data as any).referring_doctor_id ?? null,
        referring_doctor_status: ((data as any).referring_doctor_status ?? 'none') as ReferringStatus,
        practitioner: ref ? { full_name: ref.users?.full_name ?? '—', speciality: ref.speciality } : null,
      }
    },
  })

  const handleSelect = (practitionerId: string) => {
    setReferringDoctor.mutate(practitionerId)
    setSelecting(false)
  }

  const handleRemove = () => {
    removeReferringDoctor.mutate()
  }

  const statusBadge = (status: ReferringStatus) => {
    const map = {
      none: null,
      pending: { label: 'En attente', bg: '#ffe170', text: '#705d00' },
      accepted: { label: 'Accepté', bg: '#d1fae5', text: '#1d7a3a' },
      refused: { label: 'Refusé', bg: '#ffdad6', text: '#ba1a1a' },
    }
    return map[status]
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16, marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <MaterialIcons name="arrow-back" size={20} color="#82d8ff" />
            <Text style={{ color: '#82d8ff', fontFamily: 'Manrope', fontWeight: '500' }}>Retour</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0b1c30', fontFamily: 'Manrope' }}>
            Mon médecin traitant
          </Text>
          <Text style={{ fontSize: 14, color: '#3f484d', fontFamily: 'Manrope', marginTop: 4 }}>
            Votre médecin généraliste de référence sur M-Santé
          </Text>
        </View>

        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          {/* Current doctor state */}
          {loadingCurrent ? (
            <View style={{ height: 100, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#82d8ff" />
            </View>
          ) : current?.referring_doctor_id && current.practitioner ? (
            <GlassCard style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: '#82d8ff',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MaterialIcons name="medical-services" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#0b1c30' }}>
                    {current.practitioner.full_name}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', marginTop: 1 }}>
                    {current.practitioner.speciality}
                  </Text>
                </View>
                {(() => {
                  const badge = statusBadge(current.referring_doctor_status)
                  return badge ? (
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: badge.bg }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: badge.text }}>
                        {badge.label}
                      </Text>
                    </View>
                  ) : null
                })()}
              </View>

              {current.referring_doctor_status === 'pending' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: 'rgba(255,225,112,0.20)',
                  }}
                >
                  <MaterialIcons name="schedule" size={14} color="#705d00" />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#705d00', flex: 1 }}>
                    Demande envoyée · en attente de confirmation du médecin
                  </Text>
                </View>
              )}

              {current.referring_doctor_status === 'refused' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 12,
                    borderRadius: 10,
                    backgroundColor: 'rgba(186,26,26,0.06)',
                  }}
                >
                  <MaterialIcons name="info" size={14} color="#ba1a1a" />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a', flex: 1 }}>
                    Ce médecin a refusé votre demande. Vous pouvez en choisir un autre.
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  onPress={() => setSelecting(true)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#82d8ff',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0,102,133,0.06)',
                  }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#82d8ff' }}>
                    Changer
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleRemove}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#bec8ce',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.60)',
                  }}
                >
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#6f787e' }}>
                    Supprimer
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={{ gap: 12, alignItems: 'center', paddingVertical: 32 }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(0,102,133,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="person-search" size={30} color="#82d8ff" />
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#0b1c30' }}>
                  Aucun médecin traitant
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center' }}>
                  Désignez un médecin généraliste pour faciliter{'\n'}le suivi de votre parcours de soin.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelecting(true)}
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 999,
                  backgroundColor: '#82d8ff',
                  marginTop: 4,
                }}
              >
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>
                  Choisir mon médecin traitant
                </Text>
              </TouchableOpacity>
            </GlassCard>
          )}

          {/* GP list */}
          {selecting && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
                  Médecins généralistes
                </Text>
                <TouchableOpacity onPress={() => setSelecting(false)}>
                  <MaterialIcons name="close" size={20} color="#6f787e" />
                </TouchableOpacity>
              </View>

              {generalPractitioners.isLoading ? (
                <ActivityIndicator color="#82d8ff" />
              ) : (generalPractitioners.data ?? []).length === 0 ? (
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e', textAlign: 'center', paddingVertical: 24 }}>
                  Aucun médecin généraliste disponible pour le moment
                </Text>
              ) : (
                (generalPractitioners.data ?? []).map((gp) => (
                  <TouchableOpacity
                    key={gp.id}
                    onPress={() => handleSelect(gp.id)}
                    disabled={setReferringDoctor.isPending}
                  >
                    <GlassCard style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: '#82d8ff',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '700', color: '#fff' }}>
                          {gp.users.full_name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: 'Manrope', fontSize: 15, fontWeight: '700', color: '#0b1c30' }}>
                          {gp.users.full_name}
                        </Text>
                        <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 1 }}>
                          {gp.speciality}
                          {gp.session_price ? ` · ${gp.session_price.toLocaleString('fr-FR')} XOF` : ''}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color="#bec8ce" />
                    </GlassCard>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
