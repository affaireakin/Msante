import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

type PaymentStatus = 'all' | 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
type Provider = 'all' | 'wave' | 'orange_money' | 'stripe' | 'card' | 'simulated'

interface PaymentRow {
  id: string
  amount: number
  currency: string
  provider: string
  status: string
  created_at: string
  patient: { full_name: string } | null
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'En attente', bg: '#fef3c7', color: '#92400e' },
  processing: { label: 'En cours', bg: '#e0f2fe', color: '#0369a1' },
  completed: { label: 'Complété', bg: '#dcfce7', color: '#166534' },
  failed: { label: 'Échoué', bg: '#ffdad6', color: '#ba1a1a' },
  refunded: { label: 'Remboursé', bg: '#f1f5f9', color: '#475569' },
}

const PROVIDER_LABELS: Record<string, string> = {
  wave: 'Wave', orange_money: 'Orange Money', stripe: 'Stripe', card: 'Carte (PayDunya)', simulated: 'Simulation',
}

const STATUS_TABS: { value: PaymentStatus; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'pending', label: 'En attente' },
  { value: 'completed', label: 'Complétés' },
  { value: 'failed', label: 'Échoués' },
  { value: 'refunded', label: 'Remboursés' },
]

function useTotals() {
  return useQuery({
    queryKey: ['admin-payment-totals-mobile'],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const [{ data: todayData }, { count: pendingCount }, { count: failedCount }] = await Promise.all([
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', today.toISOString()),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      ])
      return {
        todayRevenue: (todayData ?? []).reduce((s, p) => s + ((p.amount as number) ?? 0), 0),
        pendingCount: pendingCount ?? 0,
        failedCount: failedCount ?? 0,
      }
    },
  })
}

function usePayments(status: PaymentStatus, provider: Provider) {
  return useQuery<PaymentRow[]>({
    queryKey: ['admin-payments-mobile', status, provider],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('id, amount, currency, provider, status, created_at, patient:users!payments_patient_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)
      if (status !== 'all') query = query.eq('status', status)
      if (provider !== 'all') query = query.eq('provider', provider)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as PaymentRow[]
    },
  })
}

function formatXOF(amount: number, currency = 'XOF') {
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export default function AdminPaymentsScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('all')

  const { data: totals } = useTotals()
  const { data: payments = [], isLoading } = usePayments(statusFilter, 'all')

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>Paiements</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: scale(10) }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#1d7a3a' }}>{formatXOF(totals?.todayRevenue ?? 0)}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Revenus aujourd&apos;hui</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#92400e' }}>{totals?.pendingCount ?? 0}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>En attente</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.md, fontWeight: '800', color: '#ba1a1a' }}>{totals?.failedCount ?? 0}</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Échoués</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: scale(8) }}>
          {STATUS_TABS.map(t => (
            <TouchableOpacity key={t.value} onPress={() => setStatusFilter(t.value)}
              style={{ paddingHorizontal: scale(14), paddingVertical: scale(8), borderRadius: 999, backgroundColor: statusFilter === t.value ? '#82d8ff' : '#e5eeff' }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: statusFilter === t.value ? '#fff' : '#82d8ff' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : payments.length === 0 ? (
          <View style={{ alignItems: 'center', gap: scale(8), paddingVertical: scale(40) }}>
            <MaterialIcons name="receipt-long" size={scale(36)} color="#bec8ce" />
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e' }}>Aucun paiement</Text>
          </View>
        ) : (
          <View style={{ gap: scale(8) }}>
            {payments.map(p => {
              const meta = STATUS_META[p.status] ?? STATUS_META.pending
              return (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(14), borderWidth: 1, borderColor: '#e5eeff', padding: scale(12) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{p.patient?.full_name ?? '—'}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>
                      {PROVIDER_LABELS[p.provider] ?? p.provider} · {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: scale(4) }}>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>{formatXOF(p.amount, p.currency)}</Text>
                    <View style={{ paddingHorizontal: scale(8), paddingVertical: scale(2), borderRadius: 999, backgroundColor: meta.bg }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: meta.color }}>{meta.label}</Text>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
