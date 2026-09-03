import { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/features/auth/store/authStore'

// Section 4 du cahier des charges 2026-09-02 : bouton dans une section
// secondaire des paramètres (jamais une action principale), avertissement,
// confirmation explicite, puis déconnexion. Réutilise l'Edge Function
// `delete-account` existante (déjà utilisée côté web, patient/profile) —
// même comportement RGPD (verrouillage immédiat, effacement sous 30 jours),
// pas de logique dupliquée. Composant partagé entre les écrans Paramètres
// de chaque rôle plutôt que réimplémenté à chaque fois.
export function DeleteAccountSection() {
  const signOut = useAuthStore(s => s.signOut)
  const [visible, setVisible] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const close = () => { setVisible(false); setConfirmText(''); setError('') }

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') { setError('Tapez SUPPRIMER pour confirmer'); return }
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('Session expirée, reconnectez-vous.'); setLoading(false); return }
      const { error: fnError } = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (fnError) {
        setError('Une erreur est survenue. Réessayez ou contactez privacy@m-sante.com.')
        setLoading(false)
        return
      }
      close()
      await signOut()
    } catch {
      setError('Une erreur est survenue. Réessayez ou contactez privacy@m-sante.com.')
      setLoading(false)
    }
  }

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={{ paddingVertical: 14, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', textDecorationLine: 'underline' }}>
          Supprimer mon compte
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,28,48,0.45)' }}>
          <View style={{ backgroundColor: '#f8f9ff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <MaterialIcons name="delete-forever" size={22} color="#ba1a1a" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 16, fontWeight: '800', color: '#0b1c30' }}>
                  Supprimer mon compte
                </Text>
                <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#6f787e', marginTop: 4, lineHeight: 18 }}>
                  Cette action est irréversible. Votre compte sera immédiatement verrouillé et toutes vos données seront supprimées sous 30 jours, conformément au RGPD.
                </Text>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: 'Manrope', fontSize: 11, fontWeight: '700', color: '#6f787e', textTransform: 'uppercase' }}>
                Tapez SUPPRIMER pour confirmer
              </Text>
              <TextInput
                value={confirmText}
                onChangeText={t => { setConfirmText(t); setError('') }}
                placeholder="SUPPRIMER"
                placeholderTextColor="#bec8ce"
                autoCapitalize="characters"
                style={{
                  height: 48, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(186,26,26,0.4)',
                  paddingHorizontal: 16, fontFamily: 'Manrope', fontSize: 14, color: '#0b1c30',
                  backgroundColor: '#fff',
                }}
              />
            </View>

            {error ? <Text style={{ fontFamily: 'Manrope', fontSize: 12, color: '#ba1a1a' }}>{error}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={close} style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', borderWidth: 1, borderColor: '#bec8ce' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '600', color: '#3f484d' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => void handleDelete()}
                disabled={loading || confirmText !== 'SUPPRIMER'}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 999, alignItems: 'center', backgroundColor: '#ba1a1a', opacity: (loading || confirmText !== 'SUPPRIMER') ? 0.5 : 1 }}
              >
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ fontFamily: 'Manrope', fontSize: 14, fontWeight: '800', color: '#fff' }}>Supprimer définitivement</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}
