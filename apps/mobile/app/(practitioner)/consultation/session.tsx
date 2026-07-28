import { Suspense, lazy } from 'react'
import { View, Text } from 'react-native'

// See apps/mobile/app/(patient)/consultation/session.tsx for the full
// rationale: deferring the @livekit/react-native import via React.lazy()
// so Expo Router's eager route-file evaluation doesn't crash the whole app
// in Expo Go on every user's startup.
const PractitionerConsultationRoom = lazy(() => import('@/features/consultation/PractitionerConsultationRoom'))

export default function ConsultationSessionRoute() {
  return (
    <Suspense fallback={
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213145' }}>
        <Text style={{ color: '#fff', fontFamily: 'Manrope' }}>Chargement de la salle…</Text>
      </View>
    }>
      <PractitionerConsultationRoom />
    </Suspense>
  )
}
