import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, Share } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useQuery, useMutation } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

interface DiagnosticPermissions {
  can_use_dsm: boolean
  can_use_cim: boolean
  can_view_diagnostic_criteria: boolean
  can_advanced_search_diagnostic: boolean
  can_associate_diagnosis: boolean
  can_export_diagnostic: boolean
}

interface DsmEntry {
  id: string
  code: string
  label: string
  category: string
  icd_code: string | null
}

interface CimResult {
  uri: string
  code: string | null
  title: string
}

export interface SelectedDiagnosis {
  source: 'dsm' | 'cim'
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

function useDsmSearch(query: string, enabled: boolean, advanced: boolean) {
  return useQuery<DsmEntry[]>({
    queryKey: ['dsm-search-mobile', query, advanced],
    enabled: enabled && query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim()
      let request = supabase.from('dsm_entries').select('id, code, label, category, icd_code').limit(20)
      request = advanced ? request.or(`label.ilike.%${q}%,keywords.cs.{${q}}`) : request.ilike('label', `%${q}%`)
      const { data, error } = await request
      if (error) throw error
      return (data ?? []) as DsmEntry[]
    },
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
  const [tab, setTab] = useState<'dsm' | 'cim'>('dsm')
  const [dsmQuery, setDsmQuery] = useState('')
  const [cimQuery, setCimQuery] = useState('')
  const [cimResults, setCimResults] = useState<CimResult[] | null>(null)
  const [cimError, setCimError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [associated, setAssociated] = useState<Set<string>>(new Set())

  const { data: perms } = useDiagnosticPermissions()
  const { data: dsmResults = [], isLoading: dsmLoading } = useDsmSearch(dsmQuery, open && tab === 'dsm', !!perms?.can_advanced_search_diagnostic)

  const cimSearch = useMutation({
    mutationFn: async (q: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error } = await supabase.functions.invoke('icd-search', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: { query: q },
      })
      if (error) throw error
      if ((data as { error?: string })?.error) throw new Error((data as { error?: string }).error)
      return (data as { results: CimResult[] }).results
    },
    onSuccess: (results) => { setCimResults(results); setCimError('') },
    onError: (e: Error) => { setCimResults([]); setCimError(e.message) },
  })

  const associate = useMutation({
    mutationFn: async ({ source, code, label, key }: { source: 'dsm' | 'cim'; code: string; label: string; key: string }) => {
      if (!patientId) throw new Error('Aucun patient sélectionné')
      const { data: { user } } = await supabase.auth.getUser()
      const { data: practitioner } = await supabase.from('practitioners').select('id').eq('user_id', user!.id).single()
      if (!practitioner) throw new Error('Profil praticien introuvable')
      const { error } = await supabase.from('diagnosis_records').insert({
        patient_id: patientId,
        practitioner_id: practitioner.id,
        consultation_id: consultationId ?? null,
        appointment_id: appointmentId ?? null,
        source, code, label,
      })
      if (error) throw error
      return key
    },
    onSuccess: (key) => setAssociated(prev => new Set(prev).add(key)),
    onError: (e: Error) => Alert.alert('Erreur', e.message),
  })

  if (!perms || (!perms.can_use_dsm && !perms.can_use_cim)) return null

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
        <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#005e7a' }}>Aide au diagnostic (DSM/CIM)</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(20), paddingVertical: scale(16), borderBottomWidth: 1, borderBottomColor: 'rgba(226,232,240,0.5)' }}>
            <Text style={{ fontSize: fs.lg, fontWeight: '800', color: '#0b1c30', fontFamily: 'Manrope' }}>Aide au diagnostic</Text>
            <TouchableOpacity onPress={() => setOpen(false)}><MaterialIcons name="close" size={22} color="#6f787e" /></TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: scale(8), paddingHorizontal: scale(20), paddingTop: scale(14) }}>
            {perms.can_use_dsm && (
              <TouchableOpacity onPress={() => setTab('dsm')}
                style={{ paddingHorizontal: scale(16), paddingVertical: scale(9), borderRadius: 999, backgroundColor: tab === 'dsm' ? '#82d8ff' : '#e5eeff' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: tab === 'dsm' ? '#0b1c30' : '#82d8ff' }}>DSM</Text>
              </TouchableOpacity>
            )}
            {perms.can_use_cim && (
              <TouchableOpacity onPress={() => setTab('cim')}
                style={{ paddingHorizontal: scale(16), paddingVertical: scale(9), borderRadius: 999, backgroundColor: tab === 'cim' ? '#82d8ff' : '#e5eeff' }}>
                <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: tab === 'cim' ? '#0b1c30' : '#82d8ff' }}>CIM (OMS ICD-11)</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={{ padding: scale(20), gap: scale(10) }}>
            {tab === 'dsm' && perms.can_use_dsm && (
              <>
                <TextInput
                  value={dsmQuery} onChangeText={setDsmQuery}
                  placeholder={perms.can_advanced_search_diagnostic ? 'Nom, symptôme ou mot-clé...' : 'Rechercher par nom...'}
                  style={{ fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }}
                />
                {dsmLoading && <ActivityIndicator color="#82d8ff" />}
                {dsmQuery.trim().length >= 2 && !dsmLoading && dsmResults.length === 0 && (
                  <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucun résultat.</Text>
                )}
                {dsmResults.map(entry => {
                  const key = `dsm-${entry.id}`
                  return (
                    <View key={entry.id} style={{ borderWidth: 1, borderColor: '#e5eeff', borderRadius: scale(12), padding: scale(12), gap: scale(8) }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '700', color: '#0b1c30' }}>{entry.label}</Text>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>DSM {entry.code}{entry.icd_code ? ` · CIM ${entry.icd_code}` : ''}</Text>
                        </View>
                        {onSelect && (
                          <TouchableOpacity onPress={() => { onSelect({ source: 'dsm', code: entry.code, label: entry.label }); setOpen(false) }}>
                            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>Utiliser</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {perms.can_view_diagnostic_criteria && (
                        <TouchableOpacity onPress={() => setExpandedId(expandedId === key ? null : key)}>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#005e7a' }}>
                            {expandedId === key ? 'Masquer' : 'Voir'} la catégorie
                          </Text>
                        </TouchableOpacity>
                      )}
                      {expandedId === key && perms.can_view_diagnostic_criteria && (
                        <View style={{ backgroundColor: '#f8f9ff', borderRadius: scale(8), padding: scale(10), gap: scale(4) }}>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#3f484d' }}>Catégorie DSM-5 : {entry.category}</Text>
                          <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e', fontStyle: 'italic' }}>
                            Consultez le DSM-5 officiel pour les critères diagnostiques complets — non reproduits ici (droits d&apos;auteur).
                          </Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', gap: scale(10), flexWrap: 'wrap' }}>
                        {perms.can_associate_diagnosis && patientId && (
                          associated.has(key) ? (
                            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#1d7a3a' }}>✓ Associé au dossier</Text>
                          ) : (
                            <TouchableOpacity onPress={() => associate.mutate({ source: 'dsm', code: entry.code, label: entry.label, key })} disabled={associate.isPending}>
                              <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#82d8ff' }}>Associer au dossier</Text>
                            </TouchableOpacity>
                          )
                        )}
                        {perms.can_export_diagnostic && (
                          <TouchableOpacity onPress={() => exportResult(`DSM ${entry.code} — ${entry.label}`)}>
                            <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, fontWeight: '700', color: '#6f787e' }}>Partager</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )
                })}
              </>
            )}

            {tab === 'cim' && perms.can_use_cim && (
              <>
                <View style={{ flexDirection: 'row', gap: scale(8) }}>
                  <TextInput
                    value={cimQuery} onChangeText={setCimQuery}
                    placeholder="Rechercher un diagnostic ou code CIM-11..."
                    style={{ flex: 1, fontFamily: 'Manrope', fontSize: fs.sm, color: '#0b1c30', borderWidth: 1, borderColor: '#bec8ce', borderRadius: 10, padding: scale(12) }}
                  />
                  <TouchableOpacity
                    onPress={() => cimQuery.trim().length >= 2 && cimSearch.mutate(cimQuery.trim())}
                    disabled={cimSearch.isPending || cimQuery.trim().length < 2}
                    style={{ paddingHorizontal: scale(16), borderRadius: 10, backgroundColor: '#82d8ff', alignItems: 'center', justifyContent: 'center', opacity: cimQuery.trim().length < 2 ? 0.5 : 1 }}
                  >
                    {cimSearch.isPending ? <ActivityIndicator size="small" color="#0b1c30" /> : <Text style={{ fontFamily: 'Manrope', fontSize: fs.sm, fontWeight: '800', color: '#0b1c30' }}>OK</Text>}
                  </TouchableOpacity>
                </View>
                {cimError ? <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#ba1a1a' }}>{cimError}</Text> : null}
                {cimResults?.length === 0 && !cimError && <Text style={{ fontFamily: 'Manrope', fontSize: fs.xs, color: '#6f787e' }}>Aucun résultat.</Text>}
                {(cimResults ?? []).map((r, i) => {
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
                            <TouchableOpacity onPress={() => associate.mutate({ source: 'cim', code: r.code ?? '—', label: r.title, key })} disabled={associate.isPending}>
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
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}
