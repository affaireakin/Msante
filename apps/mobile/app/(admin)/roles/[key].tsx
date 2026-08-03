import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface ProfessionPermission {
  id: string
  profession_key: string
  profession_label: string
  can_prescribe: boolean
  can_write_observations: boolean
  can_write_reports: boolean
  can_view_full_dossier: boolean
  can_view_analyses: boolean
  can_view_imaging: boolean
  can_share_with_patient: boolean
  can_request_analyses: boolean
  can_view_notes: boolean
  can_view_prescriptions: boolean
  can_view_appreciations: boolean
  can_view_mood_journal: boolean
  can_teleconsult: boolean
  can_use_cim: boolean
  can_advanced_search_diagnostic: boolean
  can_associate_diagnosis: boolean
  can_export_diagnostic: boolean
  allowed_data_categories: string[]
  description: string | null
}

type BooleanKey = keyof Omit<ProfessionPermission, 'id' | 'profession_key' | 'profession_label' | 'allowed_data_categories' | 'description'>

const PERMISSION_GROUPS: { group: string; icon: React.ComponentProps<typeof MaterialIcons>['name']; items: { key: BooleanKey; label: string }[] }[] = [
  {
    group: 'Actes cliniques', icon: 'medical-services',
    items: [
      { key: 'can_prescribe', label: 'Prescription médicale' },
      { key: 'can_request_analyses', label: "Prescription d'analyses" },
      { key: 'can_teleconsult', label: 'Téléconsultation' },
    ],
  },
  {
    group: 'Rédaction & Documentation', icon: 'edit-note',
    items: [
      { key: 'can_write_observations', label: "Rédaction d'observations" },
      { key: 'can_write_reports', label: 'Comptes-rendus médicaux' },
      { key: 'can_share_with_patient', label: 'Partage avec le patient' },
    ],
  },
  {
    group: 'Accès aux données patient', icon: 'folder-shared',
    items: [
      { key: 'can_view_full_dossier', label: 'Dossier médical complet' },
      { key: 'can_view_analyses', label: "Résultats d'analyses" },
      { key: 'can_view_imaging', label: 'Imagerie médicale' },
      { key: 'can_view_notes', label: 'Notes cliniques' },
      { key: 'can_view_prescriptions', label: 'Ordonnances' },
      { key: 'can_view_appreciations', label: 'Appréciations patients' },
      { key: 'can_view_mood_journal', label: 'Journal mood & bien-être' },
    ],
  },
  {
    group: 'Aide au diagnostic (CIM)', icon: 'psychology-alt',
    items: [
      { key: 'can_use_cim', label: 'Accès à la CIM' },
      { key: 'can_advanced_search_diagnostic', label: 'Recherche avancée par symptômes' },
      { key: 'can_associate_diagnosis', label: 'Association au dossier patient' },
      { key: 'can_export_diagnostic', label: 'Export / impression' },
    ],
  },
]

function useProfessionPermission(key: string) {
  return useQuery<ProfessionPermission>({
    queryKey: ['profession-permission-mobile', key],
    enabled: !!key,
    queryFn: async () => {
      const { data, error } = await supabase.from('profession_permissions').select('*').eq('profession_key', key).single()
      if (error) throw error
      return data as ProfessionPermission
    },
  })
}

export default function AdminRoleDetailScreen() {
  const router = useRouter()
  const { key } = useLocalSearchParams<{ key: string }>()
  const { fs, scale } = useResponsive()
  const qc = useQueryClient()
  const { data: profession, isLoading } = useProfessionPermission(key ?? '')
  const [state, setState] = useState<Partial<ProfessionPermission>>({})
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (profession) setState(profession)
  }, [profession])

  const save = useMutation({
    mutationFn: async () => {
      const { id, profession_key, profession_label, ...rest } = state
      const { error } = await supabase.from('profession_permissions').update(rest).eq('profession_key', key!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profession-permissions-mobile'] })
      qc.invalidateQueries({ queryKey: ['profession-permission-mobile', key] })
      setIsDirty(false)
      Alert.alert('Enregistré', 'Les permissions ont été mises à jour.')
    },
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  const toggle = (k: BooleanKey) => {
    setState(prev => ({ ...prev, [k]: !prev[k] }))
    setIsDirty(true)
  }

  if (isLoading || !profession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#82d8ff" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12), paddingHorizontal: scale(20), paddingVertical: scale(14), backgroundColor: 'rgba(255,255,255,0.80)', borderBottomWidth: 1, borderBottomColor: 'rgba(229,238,255,0.6)' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <MaterialIcons name="arrow-back" size={22} color="#0b1c30" />
        </TouchableOpacity>
        <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.lg, fontWeight: '800', color: '#0b1c30' }} numberOfLines={1}>
          {profession.profession_label}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(16), paddingBottom: scale(100) }} showsVerticalScrollIndicator={false}>
        {PERMISSION_GROUPS.map(g => (
          <View key={g.group} style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: scale(16), borderWidth: 1, borderColor: '#e5eeff', padding: scale(16), gap: scale(4) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), marginBottom: scale(8) }}>
              <MaterialIcons name={g.icon} size={scale(16)} color="#82d8ff" />
              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#0b1c30', textTransform: 'uppercase', letterSpacing: 0.5 }}>{g.group}</Text>
            </View>
            {g.items.map(item => (
              <View key={item.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: scale(9) }}>
                <Text style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30' }}>{item.label}</Text>
                <Switch
                  value={!!state[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: '#e2e8f0', true: '#82d8ff' }}
                  thumbColor={state[item.key] ? '#82d8ff' : '#fff'}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      {isDirty && (
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: scale(20), backgroundColor: '#f8f9ff', borderTopWidth: 1, borderTopColor: 'rgba(226,232,240,0.5)' }}>
          <TouchableOpacity
            onPress={() => save.mutate()}
            disabled={save.isPending}
            style={{ paddingVertical: scale(14), borderRadius: 999, backgroundColor: '#82d8ff', alignItems: 'center' }}
          >
            {save.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>Enregistrer les modifications</Text>}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  )
}
