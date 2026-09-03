import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface PlatformData {
  totalPatients: number
  totalPractitioners: number
  newUsersThisMonth: number
  newUsersGrowth: number
  onboardingRate: number
  noShowRate: number
  pendingPractitioners: number
  totalAppointments: number
}

interface ProviderStat { name: string; amount: number; count: number; color: string }
interface RecentPayment { id: string; amount: number; currency: string; status: string; provider: string; created_at: string; patient: string }

interface FinancialData {
  totalRevenue: number
  thisMonthRevenue: number
  revenueGrowth: number
  totalPayments: number
  avgTransaction: number
  byProvider: ProviderStat[]
  recentPayments: RecentPayment[]
}

const STATUS_CFG: Record<string, { bg: string; text: string; label: string }> = {
  completed:  { bg: '#e8f5e9', text: '#1d7a3a', label: 'Succès' },
  pending:    { bg: '#fff8e1', text: '#705d00', label: 'En attente' },
  processing: { bg: '#e5eeff', text: '#005e7a', label: 'En cours' },
  failed:     { bg: '#ffdad6', text: '#ba1a1a', label: 'Échoué' },
  refunded:   { bg: '#e0e3e5', text: '#5c5f61', label: 'Remboursé' },
}

const PROVIDER_LABELS: Record<string, string> = { wave: 'Wave', orange_money: 'Orange Money', stripe: 'Stripe', card: 'Carte' }
const PROVIDER_COLORS: Record<string, string> = { wave: '#82d8ff', orange_money: '#ff6600', stripe: '#635bff', card: '#1d7a3a' }

function usePlatformAnalytics() {
  return useQuery<PlatformData>({
    queryKey: ['admin-platform-analytics-mobile'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      const [
        { count: totalPatients }, { count: totalPractitioners },
        { count: newUsersThisMonth }, { count: newUsersLastMonth },
        { count: onboardingCompleted }, { count: noShowCount },
        { count: totalAppts }, { count: pendingPractitioners },
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'patient'),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'practitioner'),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('onboarding_completed', true).eq('role', 'patient'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).not('status', 'in', '("pending","cancelled")'),
        supabase.from('practitioners').select('id', { count: 'exact', head: true }).eq('verification_status', 'pending'),
      ])

      const nm = newUsersThisMonth ?? 0
      const nl = newUsersLastMonth ?? 0
      const tp = totalPatients ?? 0
      const ta = totalAppts ?? 0

      return {
        totalPatients: tp,
        totalPractitioners: totalPractitioners ?? 0,
        newUsersThisMonth: nm,
        newUsersGrowth: nl > 0 ? Math.round(((nm - nl) / nl) * 100) : 0,
        onboardingRate: tp > 0 ? Math.round(((onboardingCompleted ?? 0) / tp) * 100) : 0,
        noShowRate: ta > 0 ? Math.round(((noShowCount ?? 0) / ta) * 100) : 0,
        pendingPractitioners: pendingPractitioners ?? 0,
        totalAppointments: ta,
      }
    },
  })
}

function useFinancialAnalytics() {
  return useQuery<FinancialData>({
    queryKey: ['admin-financial-analytics-mobile'],
    queryFn: async () => {
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      const [{ data: allPay }, { data: thisPay }, { data: lastPay }, { data: recent }] = await Promise.all([
        supabase.from('payments').select('amount, status, provider').eq('status', 'completed'),
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', monthStart),
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', lastMonthStart).lte('created_at', lastMonthEnd),
        supabase.from('payments').select('id, amount, currency, status, provider, created_at, users!patient_id(full_name)').order('created_at', { ascending: false }).limit(10),
      ])

      const all = (allPay ?? []) as { amount: number; status: string; provider: string }[]
      const total = all.reduce((s, p) => s + (p.amount ?? 0), 0)
      const thisMonth = ((thisPay ?? []) as { amount: number }[]).reduce((s, p) => s + (p.amount ?? 0), 0)
      const lastMonth = ((lastPay ?? []) as { amount: number }[]).reduce((s, p) => s + (p.amount ?? 0), 0)
      const growth = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : 0

      const providerMap: Record<string, { amount: number; count: number }> = {}
      for (const p of all) {
        if (!providerMap[p.provider]) providerMap[p.provider] = { amount: 0, count: 0 }
        providerMap[p.provider].amount += p.amount ?? 0
        providerMap[p.provider].count += 1
      }
      const byProvider = Object.entries(providerMap)
        .map(([name, v]) => ({ name, amount: v.amount, count: v.count, color: PROVIDER_COLORS[name] ?? '#6f787e' }))
        .sort((a, b) => b.amount - a.amount)

      return {
        totalRevenue: total,
        thisMonthRevenue: thisMonth,
        revenueGrowth: growth,
        totalPayments: all.length,
        avgTransaction: all.length ? Math.round(total / all.length) : 0,
        byProvider,
        recentPayments: ((recent ?? []) as unknown as { id: string; amount: number; currency: string; status: string; provider: string; created_at: string; users: { full_name: string } | null }[]).map(p => ({
          id: p.id, amount: p.amount, currency: p.currency ?? 'XOF', status: p.status, provider: p.provider,
          created_at: p.created_at, patient: p.users?.full_name ?? '—',
        })),
      }
    },
  })
}

function formatXOF(n: number) {
  return `${n.toLocaleString('fr-FR')} XOF`
}

function KpiCard({ icon, color, bg, value, label, sub }: { icon: React.ComponentProps<typeof MaterialIcons>['name']; color: string; bg: string; value: string; label: string; sub?: string }) {
  const { fs, scale } = useResponsive()
  return (
    <View style={{ flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
      <View style={{ width: scale(32), height: scale(32), borderRadius: scale(9), backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginBottom: scale(8) }}>
        <MaterialIcons name={icon} size={scale(16)} color={color} />
      </View>
      <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color }}>{value}</Text>
      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30', marginTop: 2 }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', marginTop: 1 }}>{sub}</Text> : null}
    </View>
  )
}

export default function AdminAnalyticsScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { data: p, isLoading: loadingP } = usePlatformAnalytics()
  const { data: d, isLoading: loadingD } = useFinancialAnalytics()

  const maxRevenue = Math.max(...(d?.byProvider ?? []).map(x => x.amount), 1)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Analytiques</Text>
      </View>

      {loadingP || loadingD || !p || !d ? (
        <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(40) }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(20), paddingBottom: scale(100) }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: scale(10) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Santé plateforme</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) }}>
              <KpiCard icon="group" color="#82d8ff" bg="#e5eeff" value={p.totalPatients.toLocaleString('fr-FR')} label="Patients inscrits" sub={`${p.totalPractitioners} praticiens`} />
              <KpiCard icon={p.newUsersGrowth >= 0 ? 'trending-up' : 'trending-down'} color={p.newUsersGrowth >= 0 ? '#1d7a3a' : '#ba1a1a'} bg={p.newUsersGrowth >= 0 ? '#e8f5e9' : '#ffdad6'} value={p.newUsersThisMonth.toLocaleString('fr-FR')} label="Nouveaux ce mois" sub={`${p.newUsersGrowth >= 0 ? '+' : ''}${p.newUsersGrowth}% vs mois dernier`} />
              <KpiCard icon="checklist" color={p.onboardingRate >= 70 ? '#1d7a3a' : '#705d00'} bg={p.onboardingRate >= 70 ? '#e8f5e9' : '#fff8e1'} value={`${p.onboardingRate}%`} label="Taux d'onboarding" />
              <KpiCard icon="event-busy" color={p.noShowRate > 10 ? '#ba1a1a' : '#1d7a3a'} bg={p.noShowRate > 10 ? '#ffdad6' : '#e8f5e9'} value={`${p.noShowRate}%`} label="Taux de no-show" sub={`sur ${p.totalAppointments.toLocaleString('fr-FR')} RDV`} />
            </View>
            {p.pendingPractitioners > 0 && (
              <TouchableOpacity onPress={() => router.push('/(admin)/verifications')} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: '#fff8e1', borderRadius: scale(12), padding: scale(12) }}>
                <MaterialIcons name="pending-actions" size={scale(18)} color="#705d00" />
                <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#705d00' }}>
                  {p.pendingPractitioners} praticien{p.pendingPractitioners > 1 ? 's' : ''} en attente
                </Text>
                <MaterialIcons name="chevron-right" size={18} color="#705d00" />
              </TouchableOpacity>
            )}
          </View>

          <View style={{ gap: scale(10) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Performance financière</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(10) }}>
              <KpiCard icon="payments" color="#82d8ff" bg="#e5eeff" value={formatXOF(d.totalRevenue)} label="Revenus totaux" />
              <KpiCard icon={d.revenueGrowth >= 0 ? 'trending-up' : 'trending-down'} color={d.revenueGrowth >= 0 ? '#1d7a3a' : '#ba1a1a'} bg={d.revenueGrowth >= 0 ? '#e8f5e9' : '#ffdad6'} value={formatXOF(d.thisMonthRevenue)} label="Ce mois" sub={`${d.revenueGrowth >= 0 ? '+' : ''}${d.revenueGrowth}%`} />
              <KpiCard icon="receipt-long" color="#705d00" bg="#fff8e1" value={d.totalPayments.toLocaleString('fr-FR')} label="Transactions" />
              <KpiCard icon="equalizer" color="#5c5f61" bg="#e0e3e5" value={formatXOF(d.avgTransaction)} label="Transaction moy." />
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(12) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Revenus par provider</Text>
            {d.byProvider.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucune donnée disponible</Text>
            ) : d.byProvider.map(prov => (
              <View key={prov.name} style={{ gap: scale(4) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: prov.color }} />
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>{PROVIDER_LABELS[prov.name] ?? prov.name}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>({prov.count})</Text>
                  </View>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: prov.color }}>{formatXOF(prov.amount)}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: '#e5eeff', overflow: 'hidden' }}>
                  <View style={{ height: '100%', borderRadius: 3, width: `${(prov.amount / maxRevenue) * 100}%`, backgroundColor: prov.color }} />
                </View>
              </View>
            ))}
          </View>

          <View style={{ gap: scale(10) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Transactions récentes</Text>
            {d.recentPayments.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucune transaction</Text>
            ) : d.recentPayments.map(pay => {
              const cfg = STATUS_CFG[pay.status] ?? STATUS_CFG.pending
              return (
                <View key={pay.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(12), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>{pay.patient}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                      {PROVIDER_LABELS[pay.provider] ?? pay.provider} · {new Date(pay.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: scale(3) }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>{pay.amount.toLocaleString('fr-FR')} {pay.currency}</Text>
                    <View style={{ paddingHorizontal: scale(7), paddingVertical: 2, borderRadius: 999, backgroundColor: cfg.bg }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: cfg.text }}>{cfg.label}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
