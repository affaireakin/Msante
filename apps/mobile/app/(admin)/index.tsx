import { useEffect } from 'react'
import { View, Text, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface AdminKpis {
  activeUsers30d: number
  revenueThisMonth: number
  pendingPractitioners: number
  pendingOrganizations: number
  noShowRate: number
}

function useAdminKpis() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('admin-kpis-realtime-mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => qc.invalidateQueries({ queryKey: ['admin-kpis-mobile'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => qc.invalidateQueries({ queryKey: ['admin-kpis-mobile'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'practitioners' }, () => qc.invalidateQueries({ queryKey: ['admin-kpis-mobile'] }))
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [qc])

  return useQuery<AdminKpis>({
    queryKey: ['admin-kpis-mobile'],
    queryFn: async () => {
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        { count: activeUsers },
        { data: revenueData },
        { count: pendingPractitioners },
        { count: pendingOrganizations },
        { count: noShowCount },
        { count: totalCount },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('updated_at', thirtyDaysAgo),
        supabase.from('payments').select('amount').eq('status', 'completed').gte('created_at', monthStart),
        supabase.from('practitioners').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('organizations').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'no_show'),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).not('status', 'in', '("pending","cancelled")'),
      ])

      const revenue = (revenueData ?? []).reduce((sum, p) => sum + (p.amount ?? 0), 0)
      const noShowRate = totalCount && totalCount > 0 ? Math.round(((noShowCount ?? 0) / totalCount) * 100) : 0

      return {
        activeUsers30d: activeUsers ?? 0,
        revenueThisMonth: revenue,
        pendingPractitioners: pendingPractitioners ?? 0,
        pendingOrganizations: pendingOrganizations ?? 0,
        noShowRate,
      }
    },
  })
}

function formatXOF(amount: number) {
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(amount)
}

export default function AdminDashboardScreen() {
  const router = useRouter()
  const { fs, scale } = useResponsive()
  const { data, isLoading } = useAdminKpis()

  const KPIS = [
    { label: 'Utilisateurs actifs (30j)', value: data?.activeUsers30d ?? 0, icon: 'group' as const, color: '#005e7a', bg: '#e5eeff' },
    { label: 'Revenus du mois', value: formatXOF(data?.revenueThisMonth ?? 0), icon: 'account-balance-wallet' as const, color: '#1d7a3a', bg: '#e8f5e9' },
    { label: 'Taux de no-show', value: `${data?.noShowRate ?? 0}%`, icon: 'event-busy' as const, color: '#705d00', bg: '#fff8e1' },
  ]

  const pendingTotal = (data?.pendingPractitioners ?? 0) + (data?.pendingOrganizations ?? 0)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16) }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xxl, fontWeight: '800', color: '#0b1c30' }}>Tableau de bord</Text>
            <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#6f787e', marginTop: 2 }}>Statistiques globales de la plateforme</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(admin)/notifications')}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.70)', borderWidth: 1, borderColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialIcons name="notifications-none" size={20} color="#0b1c30" />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#82d8ff" style={{ marginTop: scale(20) }} />
        ) : (
          <>
            {pendingTotal > 0 && (
              <TouchableOpacity
                onPress={() => router.push('/(admin)/verifications')}
                style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), backgroundColor: '#fef3c7', borderRadius: scale(16), padding: scale(16) }}
              >
                <MaterialIcons name="pending-actions" size={scale(22)} color="#92400e" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#92400e' }}>
                    {pendingTotal} vérification{pendingTotal > 1 ? 's' : ''} en attente
                  </Text>
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#92400e' }}>
                    {data?.pendingPractitioners ?? 0} praticien(s) · {data?.pendingOrganizations ?? 0} organisation(s)
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={scale(20)} color="#92400e" />
              </TouchableOpacity>
            )}

            <View style={{ gap: scale(10) }}>
              {KPIS.map(kpi => (
                <View key={kpi.label} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(14), backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16) }}>
                  <View style={{ width: scale(44), height: scale(44), borderRadius: scale(12), backgroundColor: kpi.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name={kpi.icon} size={scale(20)} color={kpi.color} />
                  </View>
                  <View>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }}>{kpi.value}</Text>
                    <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', fontWeight: '600' }}>{kpi.label}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: scale(10) }}>
              <TouchableOpacity
                onPress={() => router.push('/(admin)/payments')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingVertical: scale(14), borderRadius: 999, backgroundColor: '#82d8ff' }}
              >
                <MaterialIcons name="account-balance-wallet" size={scale(18)} color="#0b1c30" />
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Paiements</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(admin)/analytics')}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingVertical: scale(14), borderRadius: 999, backgroundColor: '#e5eeff' }}
              >
                <MaterialIcons name="insights" size={scale(18)} color="#82d8ff" />
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#82d8ff' }}>Analytiques</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(admin)/finance')}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scale(8), paddingVertical: scale(14), borderRadius: 999, borderWidth: 1, borderColor: '#e5eeff' }}
            >
              <MaterialIcons name="account-balance" size={scale(18)} color="#82d8ff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#82d8ff' }}>Réconciliation financière</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
