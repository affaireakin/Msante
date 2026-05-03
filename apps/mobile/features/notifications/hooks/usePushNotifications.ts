// apps/mobile/features/notifications/hooks/usePushNotifications.ts
import { useEffect } from 'react'
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { supabase } from '@/services/supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export function usePushNotifications(isAuthenticated: boolean) {
  const router = useRouter()

  useEffect(() => {
    if (!isAuthenticated) return

    let foregroundSub: Notifications.Subscription
    let tapSub: Notifications.Subscription

    async function register() {
      if (!Device.isDevice) return

      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') return

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
      if (!projectId) {
        console.warn('usePushNotifications: no EAS projectId in app.json')
        return
      }

      const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

      const { error } = await supabase.functions.invoke('register-push-token', {
        body: { token },
      })

      if (error) {
        console.error('usePushNotifications: failed to register token', error)
      }
    }

    void register()

    // Android 8+ requires explicit notification channel
    if (Platform.OS === 'android') {
      void Notifications.setNotificationChannelAsync('default', {
        name: 'M-Santé',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#006685',
      })
    }

    foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title, body } = notification.request.content
      console.log('Push received (foreground):', title, body)
    })

    tapSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { route?: string }
      if (data.route) {
        router.push(data.route as Parameters<typeof router.push>[0])
      }
    })

    return () => {
      foregroundSub?.remove()
      tapSub?.remove()
    }
  }, [isAuthenticated])
}
