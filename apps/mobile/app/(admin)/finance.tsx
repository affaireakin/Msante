import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface PaymentRow {
  id: string
  amount: number
  provider: string
  practitioner_id: string
  practitioner: { users: { full_name: string } } | null
}

const MONTHLY_GOAL = 5_000_000
const PROVIDER_LABELS: Record<string, string> = { wave: 'Wave', orange_money: 'Orange Money', card: 'Carte', stripe: 'Stripe', simulated: 'Simulation' }
const PROVIDER_COLORS: Record<string, string> = { wave: '#82d8ff', orange_money: '#e65c00', card: '#5c35d4', stripe: '#635bff', simulated: '#bec8ce' }

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
}

function formatXOF(n: number) {
  return `${new Intl.NumberFormat('fr-SN', { maximumFractionDigits: 0 }).format(n)} XOF`
}

function useMonthlyPayments() {
  return useQuery<PaymentRow[]>({
    queryKey: ['admin-finance-monthly-mobile'],
    queryFn: async () => {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, provider, practitioner_id, practitioner:practitioner_id(users!user_id(full_name))')
        .eq('status', 'completed')
        .gte('created_at', startOfMonth.toISOString())
      if (error) throw error
      return (data ?? []) as unknown as PaymentRow[]
    },
    staleTime: 2 * 60 * 1000,
  })
}

export default function AdminFinanceScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { data: payments = [], isLoading } = useMonthlyPayments()

  const grossRevenue = payments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const platformShare = grossRevenue * 0.2
  const practitionerShare = grossRevenue * 0.8
  const goalPct = Math.min((grossRevenue / MONTHLY_GOAL) * 100, 100)

  const providerMap: Record<string, { count: number; total: number }> = {}
  for (const p of payments) {
    if (!providerMap[p.provider]) providerMap[p.provider] = { count: 0, total: 0 }
    providerMap[p.provider].count += 1
    providerMap[p.provider].total += p.amount ?? 0
  }
  const providerBreakdown = Object.entries(providerMap)
    .map(([provider, v]) => ({ provider, ...v, pct: grossRevenue > 0 ? (v.total / grossRevenue) * 100 : 0 }))
    .sort((a, b) => b.total - a.total)

  const practitionerMap: Record<string, { full_name: string; gross: number; provider: string }> = {}
  for (const p of payments) {
    const name = p.practitioner?.users?.full_name ?? 'Inconnu'
    if (!practitionerMap[p.practitioner_id]) practitionerMap[p.practitioner_id] = { full_name: name, gross: 0, provider: p.provider }
    practitionerMap[p.practitioner_id].gross += p.amount ?? 0
  }
  const topPayouts = Object.entries(practitionerMap)
    .map(([id, v]) => ({ id, ...v, payout: v.gross * 0.8 }))
    .sort((a, b) => b.gross - a.gross)
    .slice(0, 10)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Réconciliation financière</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(40) }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(18) }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: scale(10) }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Revenu brut</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#0b1c30', marginTop: 6 }}>{formatXOF(grossRevenue)}</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', marginTop: 2 }}>Ce mois-ci</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14) }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#705d00', textTransform: 'uppercase', letterSpacing: 0.5 }}>Plateforme (20%)</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#0b1c30', marginTop: 6 }}>{formatXOF(platformShare)}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(8) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>Objectif mensuel</Text>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>{Math.round(goalPct)}%</Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: '#e5eeff', overflow: 'hidden' }}>
              <View style={{ height: '100%', borderRadius: 4, width: `${goalPct}%`, backgroundColor: '#ffde5c' }} />
            </View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{formatXOF(grossRevenue)} / {formatXOF(MONTHLY_GOAL)}</Text>
          </View>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(10) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Répartition des revenus</Text>
            <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ flex: 8, backgroundColor: '#82d8ff' }} />
              <View style={{ flex: 2, backgroundColor: '#ffde5c' }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#82d8ff' }} />
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#0b1c30' }}>Praticiens (80%) — {formatXOF(practitionerShare)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffde5c' }} />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#0b1c30' }}>Plateforme (20%) — {formatXOF(platformShare)}</Text>
            </View>
          </View>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(14), gap: scale(10) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Par provider</Text>
            {providerBreakdown.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucune donnée</Text>
            ) : providerBreakdown.map(pb => (
              <View key={pb.provider} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: PROVIDER_COLORS[pb.provider] ?? '#6f787e' }} />
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#0b1c30' }}>{PROVIDER_LABELS[pb.provider] ?? pb.provider} ({pb.count})</Text>
                </View>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>{Math.round(pb.pct)}%</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: scale(8) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>Auto-payout — Top praticiens</Text>
            {topPayouts.length === 0 ? (
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucun paiement ce mois-ci</Text>
            ) : topPayouts.map(pr => (
              <View key={pr.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(12), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
                <View style={{ width: scale(36), height: scale(36), borderRadius: scale(18), backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: 'Manrope', fontWeight: '800', fontSize: fs.xs, color: '#0b1c30' }}>{getInitials(pr.full_name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30' }}>{pr.full_name}</Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>{PROVIDER_LABELS[pr.provider] ?? pr.provider}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '800', color: '#0b1c30' }}>{formatXOF(pr.payout)}</Text>
                  <View style={{ paddingHorizontal: scale(6), paddingVertical: 2, borderRadius: 999, backgroundColor: pr.gross > 0 ? '#dcfce7' : '#fef3c7' }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: pr.gross > 0 ? '#166534' : '#92400e' }}>
                      {pr.gross > 0 ? 'Prêt' : 'En attente'}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}
