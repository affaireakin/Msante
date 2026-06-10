import { useEffect } from 'react'
import * as Notifications from 'expo-notifications'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@msante/mood_reminder_id'
const DEFAULT_HOUR = 20
const DEFAULT_MINUTE = 0

async function cancelExistingReminder() {
  const id = await AsyncStorage.getItem(STORAGE_KEY)
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => null)
    await AsyncStorage.removeItem(STORAGE_KEY)
  }
}

async function scheduleMoodReminder(hour = DEFAULT_HOUR, minute = DEFAULT_MINUTE) {
  await cancelExistingReminder()

  const { status } = await Notifications.getPermissionsAsync()
  if (status !== 'granted') return

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Comment vous sentez-vous ? 💙',
      body: 'Prenez 30 secondes pour noter votre humeur du jour.',
      data: { route: '/(patient)/mental-health/mood-checkin' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  })

  await AsyncStorage.setItem(STORAGE_KEY, id)
}

export function useMoodReminder(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return
    void scheduleMoodReminder()
    return () => { void cancelExistingReminder() }
  }, [isAuthenticated])
}

export { scheduleMoodReminder, cancelExistingReminder }
