import { useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

interface NotificationRow {
  id: string
  type: string
  title: string
  body: string
  data: { route?: string }
  channel: string
  status: string
  read_at: string | null
  created_at: string
}

const TYPE_ICONS: Record<string, { name: React.ComponentProps<typeof MaterialIcons>['name']; color: string; bg: string }> = {
  appointment_confirm:    { name: 'event-available', color: '#1d7a3a', bg: '#d1fae5' },
  appointment_reminder:   { name: 'calendar-today',  color: '#82d8ff', bg: '#e5eeff' },
  payment_success:        { name: 'check-circle',    color: '#1d7a3a', bg: '#d1fae5' },
  payment_failed:         { name: 'error',           color: '#ba1a1a', bg: '#ffdad6' },
  consultation_starting:  { name: 'videocam',        color: '#82d8ff', bg: '#bee9ff' },
  practitioner_approved:  { name: 'verified',        color: '#705d00', bg: '#ffde5c' },
  mood_low_streak:        { name: 'favorite',        color: '#ba1a1a', bg: '#ffdad6' },
  mood_check_in:          { name: 'mood',            color: '#705d00', bg: '#fff8e1' },
}

const DEFAULT_ICON = { name: 'notifications' as const, color: '#82d8ff', bg: '#e5eeff' }

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "À l'instant"
  if (mins < 60) return `il y a ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `il y a ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { profile } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: notifications, isLoading } = useQuery<NotificationRow[]>({
    queryKey: ['notifications', profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, data, channel, status, read_at, created_at')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as NotificationRow[]
    },
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!profile?.id) return
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString(), status: 'read' })
        .eq('user_id', profile.id)
        .is('read_at', null)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications', profile?.id] })
      void queryClient.invalidateQueries({ queryKey: ['notifications-unread', profile?.id] })
    },
  })

  useEffect(() => {
    if (profile?.id) markAllRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  const handleTap = useCallback((notif: NotificationRow) => {
    const route = notif.data?.route
    if (route) router.push(route as never)
  }, [router])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        backgroundColor: 'rgba(255,255,255,0.70)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.50)',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontSize: 18, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>
          Notifications
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#82d8ff" size="large" />
        </View>
      ) : !notifications || notifications.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 40 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5eeff', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name="notifications-none" size={36} color="#82d8ff" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#0b1c30', fontFamily: 'Manrope', textAlign: 'center' }}>
            Aucune notification
          </Text>
          <Text style={{ fontSize: 13, color: '#6f787e', fontFamily: 'Manrope', textAlign: 'center', lineHeight: 20 }}>
            Vous serez notifié de vos rendez-vous, paiements et alertes bien-être.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingVertical: 8 }}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: 'rgba(226,232,240,0.5)', marginLeft: 72 }} />
          )}
          renderItem={({ item }) => {
            const isUnread = !item.read_at
            const iconConf = TYPE_ICONS[item.type] ?? DEFAULT_ICON

            return (
              <TouchableOpacity
                onPress={() => handleTap(item)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 14,
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  backgroundColor: isUnread ? 'rgba(0,102,133,0.03)' : 'transparent',
                }}
              >
                {/* Icon */}
                <View style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: iconConf.bg,
                  alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <MaterialIcons name={iconConf.name} size={22} color={iconConf.color} />
                </View>

                {/* Content */}
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{
                      fontSize: 14, fontFamily: 'Manrope',
                      fontWeight: isUnread ? '700' : '500',
                      color: '#0b1c30', flex: 1, marginRight: 8,
                    }}>
                      {item.title}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6f787e', fontFamily: 'Manrope', flexShrink: 0 }}>
                      {relativeTime(item.created_at)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 13, color: '#3f484d', fontFamily: 'Manrope', lineHeight: 19 }}>
                    {item.body}
                  </Text>
                </View>

                {/* Unread dot */}
                {isUnread && (
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#82d8ff', marginTop: 6, flexShrink: 0 }} />
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}
