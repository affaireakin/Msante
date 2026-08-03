import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, Share } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface DiagnosticPermissions {
  can_use_cim: boolean
  can_advanced_search_diagnostic: boolean
  can_associate_diagnosis: boolean
  can_export_diagnostic: boolean
}

interface CimResult {
  uri: string
  code: string | null
  title: string
}

export interface SelectedDiagnosis {
  source: 'cim'
  code: string
  label: string
}

function useDiagnosticPermissions() {
  return useQuery<DiagnosticPermissions>({
    queryKey: ['my-diagnostic-permissions-mobile'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_my_diagnostic_permissions')
      if (error) throw error
      return data as DiagnosticPermissions
    },
    staleTime: 5 * 60_000,
  })
}

export function DiagnosticAidSearch({
  patientId, consultationId, appointmentId, onSelect,
}: {
  patientId?: string
  consultationId?: string
  appointmentId?: string
  onSelect?: (d: SelectedDiagnosis) => void
}) {
  const { fs, scale } = useResponsive()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CimResult[] | null>(null)
  const [error, setError] = useState('')
  const [associated, setAssociated] = useState<Set<string>>(new Set())

  const { data: perms } = useDiagnosticPermissions()

  const search = useMutation({
    mutationFn: async (q: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnError } = await supabase.functions.invoke('icd-search', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { query: q },
      })
      if (fnError) throw fnError
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
      return (data as { results: CimResult[] }).results
    },
    onSuccess: (r) => { setResults(r); setError('') },
    onError: (e: Error) => { setResults([]); setError(e.message) },
  })

  const associate = useMutation({
    mutationFn: async ({ code, label, key }: { code: string; label: string; key: string }) => {
      if (!patientId) throw new Error('Aucun patient sélectionné')
      const { data: { user } } = await supabase.auth.getUser()
      const { data: practitioner } = await supabase.from('practitioners').select('id').eq('user_id', user!.id).single()
      if (!practitioner) throw new Error('Profil praticien introuvable')
      const { error: insertError } = await supabase.from('diagnosis_records').insert({
        patient_id: patientId,
        practitioner_id: practitioner.id,
        consultation_id: consultationId ?? null,
        appointment_id: appointmentId ?? null,
        source: 'cim', code, label,
      })
      if (insertError) throw insertError
      return key
    },
    onSuccess: (key) => setAssociated(prev => new Set(prev).add(key)),
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  if (!perms?.can_use_cim) return null

  const exportResult = (text: string) => {
    void Share.share({ message: text })
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8), paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: 999, borderWidth: 1.5, borderColor: '#82d8ff', alignSelf: 'flex-start' }}
      >
        <MaterialIcons name="psychology-alt" size={scale(16)} color="#005e7a" />
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#005e7a' }}>Aide au diagnostic (CIM)</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingVertical: scale(16), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
            <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Aide au diagnostic — CIM</Text>
            <TouchableOpacity onPress={() => setOpen(false)}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(10) }}>
            <View style={{ flexDirection: 'row', gap: scale(8) }}>
              <TextInput
                value={query} onChangeText={setQuery}
                placeholder={perms.can_advanced_search_diagnostic ? 'Nom, symptôme ou code CIM-11...' : 'Rechercher un diagnostic ou code CIM-11...'}
                style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }}
              />
              <TouchableOpacity
                onPress={() => query.trim().length >= 2 && search.mutate(query.trim())}
                disabled={search.isPending || query.trim().length < 2}
                style={{ paddingHorizontal: scale(16), borderRadius: 10, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center', opacity: query.trim().length < 2 ? 0.5 : 1 }}
              >
                {search.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>OK</Text>}
              </TouchableOpacity>
            </View>
            {error ? <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#ba1a1a' }}>{error}</Text> : null}
            {results?.length === 0 && !error && <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucun résultat.</Text>}
            {(results ?? []).map((r, i) => {
              const key = `cim-${r.uri}-${i}`
              return (
                <View key={key} style={{ borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(12), padding: scale(12), gap: scale(8) }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{r.title}</Text>
                      {r.code ? <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>CIM-11 {r.code}</Text> : null}
                    </View>
                    {onSelect && (
                      <TouchableOpacity onPress={() => { onSelect({ source: 'cim', code: r.code ?? '—', label: r.title }); setOpen(false) }}>
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>Utiliser</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: scale(10), flexWrap: 'wrap' }}>
                    {perms.can_associate_diagnosis && patientId && (
                      associated.has(key) ? (
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#1d7a3a' }}>✓ Associé au dossier</Text>
                      ) : (
                        <TouchableOpacity onPress={() => associate.mutate({ code: r.code ?? '—', label: r.title, key })} disabled={associate.isPending}>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>Associer au dossier</Text>
                        </TouchableOpacity>
                      )
                    )}
                    {perms.can_export_diagnostic && (
                      <TouchableOpacity onPress={() => exportResult(`CIM-11 ${r.code ?? ''} — ${r.title}`)}>
                        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e' }}>Partager</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
