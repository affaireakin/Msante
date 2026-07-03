import { ScrollView, View, Text, TouchableOpacity, RefreshControl, StatusBar } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalyticsData {
  thisMonth: number
  lastMonth: number
  growth: number
  avgPerSession: number
  revenueChart: { month: string; revenue: number }[]
  typeChart: { name: string; value: number; color: string }[]
  noShowRate: number
  rebookingRate: number
  newCount: number
  recurringCount: number
  occupancyRate: number
  occupancyByDay: { day: string; count: number }[]
}

// ─── Analytics Query ──────────────────────────────────────────────────────────

function useAnalytics(practId: string | null) {
  return useQuery<AnalyticsData>({
    queryKey: ['practitioner-analytics-mobile', practId],
    enabled: !!practId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

      const [
        { data: allPayments, error: e1 },
        { data: thisMonthPay, error: e2 },
        { data: lastMonthPay, error: e3 },
        { data: allAppts, error: e4 },
        { data: thisMonthAppts, error: e5 },
        { data: avails, error: e6 },
      ] = await Promise.all([
        supabase
          .from('payments')
          .select('amount, created_at')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', sixMonthsAgo),
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', monthStart),
        supabase
          .from('payments')
          .select('amount')
          .eq('practitioner_id', practId!)
          .eq('status', 'completed')
          .gte('created_at', lastMonthStart)
          .lte('created_at', lastMonthEnd),
        supabase
          .from('appointments')
          .select('patient_id, status, type, scheduled_at')
          .eq('practitioner_id', practId!),
        supabase
          .from('appointments')
          .select('patient_id, status, type')
          .eq('practitioner_id', practId!)
          .gte('scheduled_at', monthStart),
        supabase
          .from('availabilities')
          .select('slot_date, start_time, end_time, duration_min')
          .eq('practitioner_id', practId!)
          .eq('is_active', true)
          .gte('slot_date', monthStart.substring(0, 10))
          .lte(
            'slot_date',
            new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().substring(0, 10),
          ),
      ])

      const firstError = e1 ?? e2 ?? e3 ?? e4 ?? e5 ?? e6
      if (firstError) throw firstError

      // Revenue by month (6 months)
      const monthlyMap: Record<string, number> = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        monthlyMap[key] = 0
      }
      for (const p of allPayments ?? []) {
        const d = new Date(p.created_at as string)
        const key = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
        if (key in monthlyMap) monthlyMap[key] += (p.amount as number) ?? 0
      }
      const revenueChart = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue }))

      const thisMonth = (thisMonthPay ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
      const lastMonth = (lastMonthPay ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0)
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0
      const completedThisMonth = (thisMonthAppts ?? []).filter((a) => a.status === 'completed').length
      const avgPerSession = completedThisMonth > 0 ? Math.round(thisMonth / completedThisMonth) : 0

      // Session type breakdown
      const typeMap: Record<string, number> = { video: 0, audio: 0, chat: 0 }
      for (const a of allAppts ?? []) {
        if (a.status === 'completed') {
          const t = a.type as string
          if (t in typeMap) typeMap[t]++
        }
      }
      const typeChart = [
        { name: 'Vidéo', value: typeMap['video'], color: '#82d8ff' },
        { name: 'Audio', value: typeMap['audio'], color: '#82d8ff' },
        { name: 'Présentiel', value: typeMap['chat'], color: '#ffde5c' },
      ].filter((t) => t.value > 0)

      // No-show rate
      const relevant = (allAppts ?? []).filter((a) =>
        ['confirmed', 'completed', 'no_show'].includes(a.status as string),
      )
      const noShowCount = (allAppts ?? []).filter((a) => a.status === 'no_show').length
      const noShowRate = relevant.length > 0 ? Math.round((noShowCount / relevant.length) * 100) : 0

      // Rebooking rate
      const patientCounts: Record<string, number> = {}
      for (const a of allAppts ?? []) {
        patientCounts[a.patient_id as string] = (patientCounts[a.patient_id as string] ?? 0) + 1
      }
      const totalPatients = Object.keys(patientCounts).length
      const rebookedPatients = Object.values(patientCounts).filter((c) => c >= 2).length
      const rebookingRate =
        totalPatients > 0 ? Math.round((rebookedPatients / totalPatients) * 100) : 0

      // New vs returning this month
      const thisMonthPatientIds = new Set(
        (thisMonthAppts ?? []).map((a) => a.patient_id as string),
      )
      const prevPatientIds = new Set(
        (allAppts ?? [])
          .filter((a) => new Date(a.scheduled_at as string) < new Date(monthStart))
          .map((a) => a.patient_id as string),
      )
      let newCount = 0
      let recurringCount = 0
      thisMonthPatientIds.forEach((pid) => {
        if (prevPatientIds.has(pid)) recurringCount++
        else newCount++
      })

      // Occupancy rate
      let totalSlots = 0
      for (const avail of avails ?? []) {
        const [sh, sm] = (avail.start_time as string).split(':').map(Number)
        const [eh, em] = (avail.end_time as string).split(':').map(Number)
        const dur = (avail.duration_min as number) || 60
        const start = sh * 60 + sm
        const end = eh * 60 + em
        totalSlots += Math.floor((end - start) / dur)
      }
      const bookedThisMonth = (thisMonthAppts ?? []).filter((a) =>
        ['confirmed', 'completed', 'pending'].includes(a.status as string),
      ).length
      const occupancyRate =
        totalSlots > 0 ? Math.round((bookedThisMonth / totalSlots) * 100) : 0

      // By day of week
      const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
      const byDow: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      for (const a of allAppts ?? []) {
        if (['confirmed', 'completed'].includes(a.status as string)) {
          byDow[new Date(a.scheduled_at as string).getDay()]++
        }
      }
      const occupancyByDay = DAYS_FR.map((day, i) => ({ day, count: byDow[i] }))

      return {
        thisMonth,
        lastMonth,
        growth,
        avgPerSession,
        revenueChart,
        typeChart,
        noShowRate,
        rebookingRate,
        newCount,
        recurringCount,
        occupancyRate,
        occupancyByDay,
      }
    },
  })
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: 'Manrope',
        fontSize: 10,
        fontWeight: '700',
        color: '#82d8ff',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {children}
    </Text>
  )
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  trendValue?: number
}

function KpiCard({ label, value, sub, icon, trendValue }: KpiCardProps) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.90)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5eeff',
        padding: 14,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          backgroundColor: '#e5eeff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
        <MaterialIcons name={icon} size={18} color="#82d8ff" />
      </View>
      <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', fontWeight: '500', marginBottom: 2 }}>
        {label}
      </Text>
      <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30', marginBottom: 2 }}>
        {value}
      </Text>
      {sub && (
        <Text style={{ fontFamily: 'Manrope', fontSize: 10, color: '#6f787e' }} numberOfLines={1}>
          {sub}
        </Text>
      )}
      {trendValue !== undefined && (
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: 10,
            fontWeight: '700',
            color: trendValue >= 0 ? '#1d7a3a' : '#ba1a1a',
            marginTop: 2,
          }}
        >
          {trendValue >= 0 ? '+' : ''}{trendValue}% vs mois préc.
        </Text>
      )}
    </View>
  )
}

interface BarChartViewProps {
  data: { label: string; value: number }[]
  maxHeight?: number
  barColor?: string
  direction?: 'vertical' | 'horizontal'
}

function BarChartView({ data, maxHeight = 120, barColor = '#82d8ff', direction = 'vertical' }: BarChartViewProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)

  if (direction === 'horizontal') {
    return (
      <View style={{ gap: 8 }}>
        {data.map((item) => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e', width: 30 }}>
              {item.label}
            </Text>
            <View style={{ flex: 1, height: 8, backgroundColor: '#e5eeff', borderRadius: 4, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${(item.value / maxVal) * 100}%`,
                  height: '100%',
                  backgroundColor: barColor,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: barColor, width: 24, textAlign: 'right' }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    )
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
      {data.map((item) => {
        const barH = maxVal > 0 ? Math.round((item.value / maxVal) * maxHeight) : 4
        return (
          <View key={item.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <View
              style={{
                width: '100%',
                height: Math.max(barH, 4),
                backgroundColor: barColor,
                borderRadius: 4,
                opacity: item.value === 0 ? 0.15 : 1,
              }}
            />
            <Text style={{ fontFamily: 'Manrope', fontSize: 9, color: '#6f787e' }} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <View
      style={{
        height,
        backgroundColor: 'rgba(229,238,255,0.60)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e5eeff',
      }}
    />
  )
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function PractitionerAnalyticsScreen() {
  const { px, fs } = useResponsive()

  // Practitioner info
  const { data: practInfo } = useQuery({
    queryKey: ['my-pract-info'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null
      const { data } = await supabase
        .from('practitioners')
        .select('id, rating')
        .eq('user_id', user.id)
        .single()
      return data as { id: string; rating: number | null } | null
    },
  })

  const { data, isLoading, isError, refetch, isFetching } = useAnalytics(practInfo?.id ?? null)

  const fmtXOF = (n: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' XOF'

  if (isError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: px }}>
          <MaterialIcons name="error-outline" size={40} color="#ba1a1a" />
          <Text style={{ fontFamily: 'Manrope', fontSize: 14, color: '#ba1a1a', marginTop: 12, textAlign: 'center' }}>
            Impossible de charger les données.
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            style={{
              marginTop: 16,
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: '#82d8ff',
              borderRadius: 12,
            }}
          >
            <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '700', color: '#fff' }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8f9ff" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: px,
          paddingVertical: 14,
          backgroundColor: 'rgba(255,255,255,0.70)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(229,238,255,0.60)',
        }}
      >
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <MaterialIcons name="bar-chart" size={20} color="#82d8ff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Manrope', fontSize: 18, fontWeight: '800', color: '#0b1c30', letterSpacing: -0.3 }}>
            Analytics
          </Text>
          <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#6f787e' }}>
            Revenus, agenda et patients
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: px, paddingBottom: 40, gap: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor="#82d8ff"
          />
        }
      >
        {/* ── Section 1 : KPI Cards ─────────────────────────────────────── */}
        <View>
          <SectionTitle>Chiffres clés</SectionTitle>
          {isLoading ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SkeletonCard height={110} />
                <SkeletonCard height={110} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SkeletonCard height={110} />
                <SkeletonCard height={110} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <SkeletonCard height={110} />
                <SkeletonCard height={110} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KpiCard
                  label="CA ce mois"
                  value={fmtXOF(data?.thisMonth ?? 0)}
                  icon="payments"
                  trendValue={data?.growth}
                />
                <KpiCard
                  label="Mois précédent"
                  value={fmtXOF(data?.lastMonth ?? 0)}
                  icon="history"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KpiCard
                  label="Moy. par séance"
                  value={fmtXOF(data?.avgPerSession ?? 0)}
                  icon="receipt-long"
                />
                <KpiCard
                  label="Taux rebooking"
                  value={`${data?.rebookingRate ?? 0}%`}
                  icon="replay"
                  sub="patients ayant reconsulté"
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <KpiCard
                  label="Taux no-show"
                  value={`${data?.noShowRate ?? 0}%`}
                  icon="event-busy"
                />
                <KpiCard
                  label="Taux d'occupation"
                  value={`${Math.min(data?.occupancyRate ?? 0, 100)}%`}
                  icon="event-available"
                  sub="créneaux réservés"
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Section 2 : Revenus 6 mois ───────────────────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.90)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e5eeff',
            padding: 16,
          }}
        >
          <SectionTitle>Évolution revenus — 6 mois</SectionTitle>
          {isLoading ? (
            <SkeletonCard height={120} />
          ) : (
            <BarChartView
              data={(data?.revenueChart ?? []).map((r) => ({
                label: r.month,
                value: r.revenue,
              }))}
              maxHeight={120}
              barColor="#82d8ff"
              direction="vertical"
            />
          )}
        </View>

        {/* ── Section 3 : Types de séances ─────────────────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.90)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e5eeff',
            padding: 16,
          }}
        >
          <SectionTitle>Types de séances</SectionTitle>
          {isLoading ? (
            <SkeletonCard height={60} />
          ) : (data?.typeChart ?? []).length === 0 ? (
            <Text style={{ fontFamily: 'Manrope', fontSize: 13, color: '#6f787e', textAlign: 'center', paddingVertical: 16 }}>
              Aucune séance terminée
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {(data?.typeChart ?? []).map((t) => (
                <View
                  key={t.name}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: t.color === '#82d8ff' ? '#e5eeff' : t.color === '#82d8ff' ? '#f0faff' : '#fffbe6',
                    borderWidth: 1,
                    borderColor: `${t.color}33`,
                  }}
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.color }} />
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '600', color: '#0b1c30' }}>
                    {t.name}
                  </Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '800', color: t.color }}>
                    {t.value}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Section 4 : Patients ce mois ─────────────────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.90)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e5eeff',
            padding: 16,
          }}
        >
          <SectionTitle>Patients ce mois</SectionTitle>
          {isLoading ? (
            <SkeletonCard height={50} />
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#e5eeff',
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Manrope', fontSize: 28, fontWeight: '800', color: '#82d8ff' }}>
                  {data?.newCount ?? 0}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#82d8ff', marginTop: 2 }}>
                  Nouveaux
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  backgroundColor: '#fffbe6',
                  borderRadius: 14,
                  padding: 14,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontFamily: 'Manrope', fontSize: 28, fontWeight: '800', color: '#705d00' }}>
                  {data?.recurringCount ?? 0}
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 11, color: '#705d00', marginTop: 2 }}>
                  Récurrents
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Section 5 : Activité par jour de semaine ─────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.90)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e5eeff',
            padding: 16,
          }}
        >
          <SectionTitle>Activité par jour de semaine</SectionTitle>
          {isLoading ? (
            <SkeletonCard height={100} />
          ) : (
            <BarChartView
              data={(data?.occupancyByDay ?? []).map((d) => ({
                label: d.day,
                value: d.count,
              }))}
              barColor="#82d8ff"
              direction="horizontal"
            />
          )}
        </View>

        {/* ── Métriques barre de progression ───────────────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.90)',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#e5eeff',
            padding: 16,
          }}
        >
          <SectionTitle>Métriques agenda</SectionTitle>
          {isLoading ? (
            <SkeletonCard height={100} />
          ) : (
            <View style={{ gap: 16 }}>
              {[
                { label: 'No-show', value: data?.noShowRate ?? 0, color: '#ba1a1a' },
                { label: 'Rebooking', value: data?.rebookingRate ?? 0, color: '#1d7a3a' },
                { label: 'Occupation', value: Math.min(data?.occupancyRate ?? 0, 100), color: '#82d8ff' },
              ].map((m) => (
                <View key={m.label}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '500', color: '#0b1c30' }}>
                      {m.label}
                    </Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: 13, fontWeight: '700', color: m.color }}>
                      {m.value}%
                    </Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: '#e5eeff', borderRadius: 4, overflow: 'hidden' }}>
                    <View
                      style={{
                        width: `${m.value}%`,
                        height: '100%',
                        backgroundColor: m.color,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
