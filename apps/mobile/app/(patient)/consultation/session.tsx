import { Suspense, lazy } from 'react'
import { View, Text } from 'react-native'

// QA finding: this route file used to import `@livekit/react-native` (and
// transitively `@livekit/react-native-webrtc`, a native module) at module
// scope. Expo Router eagerly requires every route file under app/ just to
// build its navigation tree — before the user ever opens this screen — so
// that import alone crashed the ENTIRE app at startup in Expo Go (LiveKit's
// native module doesn't exist there; it needs a dev-client build). Moving
// the real implementation into features/consultation/PatientConsultationRoom
// and loading it via React.lazy() defers the actual `@livekit/react-native`
// import until this screen is rendered — every other screen now loads fine
// in Expo Go. This screen itself still requires a dev-client/EAS build to
// actually work; that's an inherent LiveKit/Expo Go limitation, not
// something fixable from here.
const PatientConsultationRoom = lazy(() => import('@/features/consultation/PatientConsultationRoom'))

export default function ConsultationSessionRoute() {
  return (
    <Suspense fallback={
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#213145' }}>
        <Text style={{ color: '#fff', fontFamily: 'Manrope' }}>Chargement de la salle…</Text>
      </View>
    }>
      <PatientConsultationRoom />
    </Suspense>
  )
}
