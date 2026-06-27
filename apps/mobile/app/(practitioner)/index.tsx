import { ScrollView, View, Text, TouchableOpacity, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useDashboard } from '@/features/practitioner/hooks/useDashboard'
import { GlassCard } from '@/components/ui/GlassCard'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return "À l'instant"
  if (h < 24) return `Il y a ${h}h`
  return 'Hier'
}

function InitialsAvatar({ initials, size = 44 }: { initials: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#006685',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontFamily: 'Manrope',
          fontWeight: '700',
          fontSize: size * 0.36,
        }}
      >
        {initials}
      </Text>
    </View>
  )
}

export default function DashboardScreen() {
  const router = useRouter()
  const { profile, practitioner } = useAuth()
  const { data, isLoading } = useDashboard(practitioner?.id ?? '', profile?.id ?? '')

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Praticien'
  const headerInitials = (profile?.full_name ?? 'P')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          paddingVertical: 12,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <InitialsAvatar initials={headerInitials} size={40} />
          <View>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontWeight: '700',
                fontSize: 16,
                color: '#0284c7',
              }}
            >
              {firstName}
            </Text>
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 11,
                color: '#6f787e',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              Practitioner Portal
            </Text>
          </View>
        </View>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.50)',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.40)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="notifications-none" size={22} color="#0b1c30" />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 24, gap: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI Bento Grid */}
        <View style={{ gap: 12 }}>
          {/* Earnings — full width */}
          <GlassCard style={{ backgroundColor: 'rgba(0,102,133,0.06)', borderColor: 'rgba(0,102,133,0.12)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#006685', alignItems: 'center', justifyContent: 'center' }}>
                  <MaterialIcons name="account-balance-wallet" size={18} color="#fff" />
                </View>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#006685', letterSpacing: 1, textTransform: 'uppercase' }}>
                  Revenus ce mois
                </Text>
              </View>
            </View>
            {isLoading ? (
              <View
                style={{ height: 40, backgroundColor: '#f1f5f9', borderRadius: 8 }}
              />
            ) : (
              <>
                <Text
                  style={{
                    fontFamily: 'Manrope',
                    fontSize: 32,
                    fontWeight: '700',
                    color: '#006685',
                    letterSpacing: -1,
                  }}
                >
                  {new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
                    data?.earningsThisMonth ?? 0,
                  )}{' '}
                  XOF
                </Text>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
                >
                  <MaterialIcons
                    name={(data?.earningsTrend ?? 0) >= 0 ? 'trending-up' : 'trending-down'}
                    size={14}
                    color={(data?.earningsTrend ?? 0) >= 0 ? '#16a34a' : '#dc2626'}
                  />
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: 13,
                      color: (data?.earningsTrend ?? 0) >= 0 ? '#16a34a' : '#dc2626',
                    }}
                  >
                    {(data?.earningsTrend ?? 0) >= 0 ? '+' : ''}
                    {data?.earningsTrend ?? 0}% ce mois
                  </Text>
                </View>
              </>
            )}
          </GlassCard>

          {/* Consultations + Rating + Pending */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <GlassCard style={{ flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <MaterialIcons name="video-camera-front" size={17} color="#006685" />
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Consultations
              </Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: 26, fontWeight: '800', color: '#0b1c30' }}>
                {data?.consultationsTotal ?? '—'}
              </Text>
            </GlassCard>
            <GlassCard style={{ flex: 1 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#fff8e1', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <MaterialIcons name="star" size={17} color="#705d00" />
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                Note
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 26, fontWeight: '800', color: '#0b1c30' }}>
                  {data?.rating ? Number(data.rating).toFixed(1) : '—'}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}>/5</Text>
              </View>
            </GlassCard>
          </View>
        </View>

        {/* Today's Agenda */}
        <View style={{ gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: 20,
                fontWeight: '600',
                color: '#0b1c30',
                letterSpacing: -0.3,
              }}
            >
              Agenda du jour
            </Text>
            <TouchableOpacity onPress={() => router.push('/(practitioner)/agenda')}>
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#006685',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                VOIR TOUT
              </Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <GlassCard>
              <View style={{ height: 80, backgroundColor: '#f1f5f9', borderRadius: 8 }} />
            </GlassCard>
          ) : (data?.todayAppointments ?? []).length === 0 ? (
            <GlassCard>
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: 14,
                  color: '#6f787e',
                  textAlign: 'center',
                }}
              >
                Aucun rendez-vous aujourd'hui
              </Text>
            </GlassCard>
          ) : (
            (data?.todayAppointments ?? []).map((appt, index) => (
              <GlassCard key={appt.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <InitialsAvatar initials={appt.patientInitials} size={44} />
                    <View>
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#0b1c30',
                        }}
                      >
                        {appt.patientName}
                      </Text>
                      <Text
                        style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e' }}
                      >
                        {appt.type}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: '#82d8ff',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <MaterialIcons name="schedule" size={13} color="#005e7a" />
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: 11,
                        fontWeight: '700',
                        color: '#005e7a',
                      }}
                    >
                      {formatTime(appt.scheduledAt)}
                    </Text>
                  </View>
                </View>

                {index === 0 && (
                  <>
                    <View
                      style={{ height: 1, backgroundColor: '#f1f5f9', marginBottom: 12 }}
                    />
                    <TouchableOpacity
                      onPress={() => router.push(`/(practitioner)/consultation/${appt.id}` as never)}
                      style={{
                        width: '100%',
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 8,
                        backgroundColor: '#006685',
                      }}
                    >
                      <MaterialIcons name="videocam" size={20} color="#fff" />
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 15,
                          fontWeight: '600',
                          color: '#fff',
                        }}
                      >
                        Démarrer la session
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </GlassCard>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={{ gap: 10 }}>
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 20,
              fontWeight: '600',
              color: '#0b1c30',
              letterSpacing: -0.3,
              paddingHorizontal: 4,
            }}
          >
            Raccourcis
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.push('/(practitioner)/analytics')}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.90)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e5eeff',
                padding: 16,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="bar-chart" size={22} color="#006685" />
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', textAlign: 'center' }}>
                Analytics
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/(practitioner)/notes-cliniques')}
              style={{
                flex: 1,
                backgroundColor: 'rgba(255,255,255,0.90)',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#e5eeff',
                padding: 16,
                alignItems: 'center',
                gap: 8,
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
                <MaterialIcons name="description" size={22} color="#006685" />
              </View>
              <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: '#0b1c30', textAlign: 'center' }}>
                Notes cliniques
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={{ gap: 12 }}>
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: 20,
              fontWeight: '600',
              color: '#0b1c30',
              letterSpacing: -0.3,
              paddingHorizontal: 4,
            }}
          >
            Activité récente
          </Text>
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.40)',
              overflow: 'hidden',
              padding: 8,
              backgroundColor: 'rgba(255,255,255,0.50)',
            }}
          >
            {(data?.recentActivity ?? []).length === 0 ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#6f787e' }}>
                  Aucune activité récente
                </Text>
              </View>
            ) : (
              (data?.recentActivity ?? []).map((item, i) => (
                <View key={item.id}>
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 16,
                      alignItems: 'flex-start',
                      padding: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.50)',
                        backgroundColor: item.type?.includes('payment') ? '#ffde5c' : '#e5eeff',
                      }}
                    >
                      <MaterialIcons
                        name={item.type?.includes('payment') ? 'credit-card' : 'mail'}
                        size={18}
                        color={item.type?.includes('payment') ? '#705d00' : '#006685'}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 14,
                          fontWeight: '500',
                          color: '#0b1c30',
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e' }}
                        numberOfLines={1}
                      >
                        {item.body}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'Manrope',
                          fontSize: 11,
                          color: '#5c5f61',
                          marginTop: 2,
                        }}
                      >
                        {relativeTime(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                  {i < (data?.recentActivity ?? []).length - 1 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: 'rgba(241,245,249,0.60)',
                        marginLeft: 64,
                      }}
                    />
                  )}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  )
}
