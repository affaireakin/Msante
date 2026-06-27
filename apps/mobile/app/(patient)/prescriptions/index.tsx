import { useState } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'
import { useResponsive } from '@/hooks/useResponsive'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Rx {
  id: string
  diagnosis: string | null
  status: string
  created_at: string
  practitioner_name: string
  medications_count: number
  document_type: 'ordonnance' | 'recommandation'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TZ = { timeZone: 'Africa/Dakar' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...TZ,
  })
}

function statusInfo(s: string): { label: string; bg: string; color: string } {
  if (s === 'signed')    return { label: 'Signée',   bg: '#e5eeff', color: '#006685' }
  if (s === 'dispensed') return { label: 'Délivrée', bg: '#dcfce7', color: '#1d7a3a' }
  return { label: 'Autre', bg: '#f1f5f9', color: '#475569' }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard({ scale }: { scale: (n: number) => number }) {
  return (
    <View
      style={{
        backgroundColor: '#eff4ff',
        borderRadius: scale(16),
        height: scale(100),
        marginBottom: scale(12),
      }}
    />
  )
}

// ─── Rx Card ─────────────────────────────────────────────────────────────────

function RxCard({ rx, onPress }: { rx: Rx; onPress: () => void }) {
  const { fs, scale } = useResponsive()
  const { label, bg, color } = statusInfo(rx.status)
  const isReco = rx.document_type === 'recommandation'
  const doctorLabel = isReco
    ? rx.practitioner_name
    : rx.practitioner_name.startsWith('Dr')
      ? rx.practitioner_name
      : `Dr. ${rx.practitioner_name}`

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      style={{
        backgroundColor: 'rgba(255,255,255,0.90)',
        borderRadius: scale(16),
        borderWidth: 1,
        borderColor: '#e5eeff',
        marginBottom: scale(12),
        shadowColor: '#006685',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
        overflow: 'hidden',
      }}
    >
      {/* Top band */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: scale(14),
          paddingVertical: scale(8),
          backgroundColor: '#f8f9ff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5eeff',
        }}
      >
        {/* Badges */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), flexWrap: 'wrap' }}>
          {/* Type badge */}
          <View
            style={{
              backgroundColor: isReco ? '#fef9c3' : '#e5eeff',
              borderRadius: scale(20),
              paddingHorizontal: scale(8),
              paddingVertical: scale(2),
            }}
          >
            <Text
              style={{
                fontSize: scale(10),
                fontWeight: '700',
                color: isReco ? '#854d0e' : '#006685',
                fontFamily: 'Manrope',
                letterSpacing: 0.3,
              }}
            >
              {isReco ? 'Recommandation' : 'Ordonnance'}
            </Text>
          </View>
          {/* Status badge */}
          <View
            style={{
              backgroundColor: bg,
              borderRadius: scale(20),
              paddingHorizontal: scale(8),
              paddingVertical: scale(2),
            }}
          >
            <Text
              style={{
                fontSize: scale(10),
                fontWeight: '700',
                color,
                fontFamily: 'Manrope',
              }}
            >
              {label}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <MaterialIcons name="chevron-right" size={scale(20)} color="#006685" />
      </View>

      {/* Body */}
      <View style={{ padding: scale(14) }}>
        {/* Diagnosis or title */}
        <Text
          style={{
            fontSize: fs.md,
            fontWeight: '700',
            color: '#0b1c30',
            fontFamily: 'Manrope',
            marginBottom: scale(4),
          }}
          numberOfLines={1}
        >
          {rx.diagnosis ?? (isReco ? 'Recommandation médicale' : 'Ordonnance')}
        </Text>

        {/* Practitioner */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4), marginBottom: scale(4) }}>
          <MaterialIcons name="person" size={scale(13)} color="#6f787e" />
          <Text
            style={{
              fontSize: fs.sm,
              color: '#6f787e',
              fontFamily: 'Manrope',
              fontWeight: '600',
            }}
            numberOfLines={1}
          >
            {doctorLabel}
          </Text>
        </View>

        {/* Date + medications count */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
            <MaterialIcons name="calendar-today" size={scale(12)} color="#bec8ce" />
            <Text
              style={{
                fontSize: fs.xs,
                color: '#bec8ce',
                fontFamily: 'Manrope',
              }}
            >
              {formatDate(rx.created_at)}
            </Text>
          </View>
          {!isReco && rx.medications_count > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(4) }}>
              <MaterialIcons name="medication" size={scale(12)} color="#6f787e" />
              <Text
                style={{
                  fontSize: fs.xs,
                  color: '#6f787e',
                  fontFamily: 'Manrope',
                  fontWeight: '600',
                }}
              >
                {rx.medications_count} médicament{rx.medications_count > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PrescriptionsScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const { px, fs, scale } = useResponsive()
  const [refreshing, setRefreshing] = useState(false)

  const { data: prescriptions = [], isLoading, refetch } = useQuery<Rx[]>({
    queryKey: ['patient-prescriptions', profile?.id],
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id, diagnosis, status, created_at, medications, document_type,
          practitioner:practitioner_id ( user:user_id ( full_name ) )
        `)
        .eq('patient_id', user.id)
        .in('status', ['signed', 'dispensed'])
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => {
        const pract = r.practitioner as unknown as { user: { full_name: string } }
        const meds = Array.isArray(r.medications) ? r.medications : []
        const docType =
          (r.document_type as string) === 'recommandation' ? 'recommandation' : 'ordonnance'
        return {
          id: r.id,
          diagnosis: r.diagnosis,
          status: r.status,
          created_at: r.created_at,
          practitioner_name: pract?.user?.full_name ?? 'Médecin',
          medications_count: meds.length,
          document_type: docType as 'ordonnance' | 'recommandation',
        }
      })
    },
  })

  async function handleRefresh() {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: px,
          paddingTop: scale(16),
          paddingBottom: scale(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: scale(10),
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: scale(38),
            height: scale(38),
            borderRadius: scale(12),
            backgroundColor: 'rgba(255,255,255,0.88)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#e5eeff',
          }}
        >
          <MaterialIcons name="arrow-back" size={scale(20)} color="#0b1c30" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: fs.xxl,
              fontWeight: '800',
              color: '#0b1c30',
              fontFamily: 'Manrope',
              letterSpacing: -0.5,
            }}
          >
            Mes documents médicaux
          </Text>
          <Text
            style={{
              fontSize: fs.sm,
              color: '#6f787e',
              fontFamily: 'Manrope',
              marginTop: 1,
            }}
          >
            Ordonnances et recommandations
          </Text>
        </View>

        {/* Count badge */}
        {prescriptions.length > 0 && (
          <View
            style={{
              backgroundColor: '#e5eeff',
              borderRadius: scale(20),
              paddingHorizontal: scale(10),
              paddingVertical: scale(4),
              borderWidth: 1,
              borderColor: '#006685' + '30',
            }}
          >
            <Text
              style={{
                fontSize: fs.xs,
                fontWeight: '700',
                color: '#006685',
                fontFamily: 'Manrope',
              }}
            >
              {prescriptions.length}
            </Text>
          </View>
        )}
      </View>

      {/* Loading skeletons */}
      {isLoading ? (
        <View style={{ paddingHorizontal: px, paddingTop: scale(8) }}>
          {[1, 2, 3].map((k) => (
            <SkeletonCard key={k} scale={scale} />
          ))}
        </View>
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100, paddingTop: scale(4) }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#006685"
            />
          }
          renderItem={({ item }) => (
            <RxCard
              rx={item}
              onPress={() =>
                router.push(`/(patient)/prescriptions/${item.id}` as never)
              }
            />
          )}
          ListEmptyComponent={
            <View
              style={{
                alignItems: 'center',
                paddingTop: scale(60),
                paddingHorizontal: px,
              }}
            >
              <View
                style={{
                  width: scale(80),
                  height: scale(80),
                  borderRadius: scale(40),
                  backgroundColor: '#e5eeff',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: scale(16),
                }}
              >
                <MaterialIcons
                  name="receipt-long"
                  size={scale(38)}
                  color="#006685"
                />
              </View>
              <Text
                style={{
                  fontSize: fs.xl,
                  fontWeight: '700',
                  color: '#0b1c30',
                  fontFamily: 'Manrope',
                  marginBottom: scale(8),
                  textAlign: 'center',
                }}
              >
                Aucun document disponible
              </Text>
              <Text
                style={{
                  fontSize: fs.md,
                  color: '#6f787e',
                  fontFamily: 'Manrope',
                  textAlign: 'center',
                  lineHeight: scale(22),
                  paddingHorizontal: scale(20),
                }}
              >
                Vos ordonnances et recommandations médicales apparaîtront ici.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}
