import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { supabase } from '@/services/supabase'
import { useResponsive } from '@/hooks/useResponsive'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Medication {
  name: string
  dosage?: string
  frequency?: string
  duration?: string
  instructions?: string
}

interface RxData {
  diagnosis: string | null
  medications: Medication[]
  instructions: string | null
  valid_until: string | null
  created_at: string
  patient_name: string
  practitioner_name: string
  practitioner_title: string
  practitioner_speciality: string
  registration_number: string
  clinic_address: string
  practitioner_phone: string
  document_type: 'ordonnance' | 'recommandation'
  status: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TZ = { timeZone: 'Africa/Dakar' }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...TZ,
  })
}

function statusInfo(s: string): { label: string; bg: string; color: string } {
  if (s === 'signed')    return { label: 'Signée',   bg: '#e5eeff', color: '#006685' }
  if (s === 'dispensed') return { label: 'Délivrée', bg: '#dcfce7', color: '#1d7a3a' }
  return { label: 'Autre', bg: '#f1f5f9', color: '#475569' }
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  label,
  icon,
  scale,
  fs,
}: {
  label: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  scale: (n: number) => number
  fs: Record<string, number>
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        marginBottom: scale(10),
      }}
    >
      <MaterialIcons name={icon} size={scale(14)} color="#006685" />
      <Text
        style={{
          fontSize: scale(10),
          fontWeight: '700',
          color: '#6f787e',
          fontFamily: 'Manrope',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  )
}

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({
  icon,
  value,
  scale,
  fs,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name']
  value: string
  scale: (n: number) => number
  fs: Record<string, number>
}) {
  if (!value) return null
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(6),
        marginBottom: scale(3),
      }}
    >
      <MaterialIcons name={icon} size={scale(13)} color="#bec8ce" />
      <Text
        style={{
          fontSize: fs.sm,
          color: '#6f787e',
          fontFamily: 'Manrope',
        }}
      >
        {value}
      </Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { px, fs, scale } = useResponsive()

  const [data, setData] = useState<RxData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setError('Non connecté')
        setLoading(false)
        return
      }

      const { data: rx, error: rxErr } = await supabase
        .from('prescriptions')
        .select(`
          diagnosis, medications, instructions, valid_until, created_at, patient_id, document_type, status,
          patient:patient_id ( full_name ),
          practitioner:practitioner_id (
            speciality, professional_title, registration_number, clinic_address, signature_url, stamp_url,
            pract_user:user_id ( full_name, phone )
          )
        `)
        .eq('id', id)
        .eq('patient_id', user.id)
        .single()

      if (rxErr || !rx) {
        setError('Ordonnance introuvable ou accès refusé.')
        setLoading(false)
        return
      }

      const p = rx.practitioner as unknown as {
        speciality: string
        professional_title: string | null
        registration_number: string | null
        clinic_address: string | null
        signature_url: string | null
        stamp_url: string | null
        pract_user: { full_name: string; phone: string | null }
      }
      const patient = rx.patient as unknown as { full_name: string }

      setData({
        diagnosis: rx.diagnosis,
        medications: (rx.medications as Medication[]) ?? [],
        instructions: rx.instructions,
        valid_until: rx.valid_until,
        created_at: rx.created_at,
        status: rx.status,
        patient_name: patient?.full_name ?? 'Patient',
        practitioner_name: p?.pract_user?.full_name ?? 'Praticien',
        practitioner_title: p?.professional_title ?? 'Dr.',
        practitioner_speciality: p?.speciality ?? '',
        registration_number: p?.registration_number ?? '',
        clinic_address: p?.clinic_address ?? '',
        practitioner_phone: p?.pract_user?.phone ?? '',
        document_type:
          (rx.document_type as string) === 'recommandation'
            ? 'recommandation'
            : 'ordonnance',
      })
      setLoading(false)
    }
    void load()
  }, [id])

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: '#f8f9ff', alignItems: 'center', justifyContent: 'center' }}
      >
        <ActivityIndicator size="large" color="#006685" />
        <Text
          style={{
            marginTop: scale(12),
            color: '#6f787e',
            fontFamily: 'Manrope',
            fontSize: fs.sm,
          }}
        >
          Chargement…
        </Text>
      </SafeAreaView>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <SafeAreaView
        edges={['top']}
        style={{ flex: 1, backgroundColor: '#f8f9ff' }}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            margin: px,
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(6),
          }}
        >
          <MaterialIcons name="arrow-back" size={scale(20)} color="#006685" />
          <Text style={{ color: '#006685', fontFamily: 'Manrope', fontWeight: '600', fontSize: fs.md }}>
            Retour
          </Text>
        </TouchableOpacity>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: px,
          }}
        >
          <View
            style={{
              width: scale(72),
              height: scale(72),
              borderRadius: scale(36),
              backgroundColor: '#ffdad6',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: scale(16),
            }}
          >
            <MaterialIcons name="error-outline" size={scale(34)} color="#ba1a1a" />
          </View>
          <Text
            style={{
              fontSize: fs.xl,
              fontWeight: '700',
              color: '#0b1c30',
              fontFamily: 'Manrope',
              textAlign: 'center',
              marginBottom: scale(8),
            }}
          >
            Document introuvable
          </Text>
          <Text
            style={{
              fontSize: fs.md,
              color: '#6f787e',
              fontFamily: 'Manrope',
              textAlign: 'center',
            }}
          >
            {error ?? 'Ce document est inaccessible.'}
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const isReco = data.document_type === 'recommandation'
  const fullTitle = `${data.practitioner_title} ${data.practitioner_name}`.trim()
  const dateConsult = formatDate(data.created_at)
  const validStr = data.valid_until ? formatDate(data.valid_until) : null
  const { label: statusLabel, bg: statusBg, color: statusColor } = statusInfo(data.status)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f8f9ff' }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: px,
          paddingTop: scale(16),
          paddingBottom: scale(12),
          flexDirection: 'row',
          alignItems: 'center',
          gap: scale(10),
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            width: scale(38),
            height: scale(38),
            borderRadius: scale(12),
            backgroundColor: 'rgba(255,255,255,0.88)',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: '#e5eeff',
          }}
        >
          <MaterialIcons name="arrow-back" size={scale(20)} color="#0b1c30" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: fs.xl,
              fontWeight: '800',
              color: '#0b1c30',
              fontFamily: 'Manrope',
              letterSpacing: -0.5,
            }}
          >
            {isReco ? 'Recommandation' : 'Ordonnance'}
          </Text>
          <Text
            style={{
              fontSize: fs.sm,
              color: '#6f787e',
              fontFamily: 'Manrope',
              marginTop: 1,
            }}
          >
            {dateConsult}
          </Text>
        </View>

        {/* Status badge */}
        <View
          style={{
            backgroundColor: statusBg,
            borderRadius: scale(20),
            paddingHorizontal: scale(10),
            paddingVertical: scale(4),
          }}
        >
          <Text
            style={{
              fontSize: scale(10),
              fontWeight: '700',
              color: statusColor,
              fontFamily: 'Manrope',
            }}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: px, paddingBottom: 100 }}
      >
        {/* ── Left-accent card ────────────────────────────────────────────── */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            borderRadius: scale(16),
            borderWidth: 1,
            borderColor: '#e5eeff',
            marginBottom: scale(14),
            shadowColor: '#006685',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 2,
            overflow: 'hidden',
          }}
        >
          {/* Blue left accent */}
          <View
            style={{ flexDirection: 'row' }}
          >
            <View style={{ width: scale(4), backgroundColor: '#006685' }} />
            <View style={{ flex: 1, padding: scale(16) }}>

              {/* Document type centered */}
              <View style={{ alignItems: 'center', marginBottom: scale(16), paddingBottom: scale(14), borderBottomWidth: 1, borderBottomColor: '#e5eeff' }}>
                <Text
                  style={{
                    fontSize: fs.xxl,
                    fontWeight: '900',
                    color: '#0b1c30',
                    fontFamily: 'Manrope',
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    borderBottomWidth: 2,
                    borderBottomColor: '#006685',
                    paddingBottom: scale(4),
                  }}
                >
                  {isReco ? 'RECOMMANDATION' : 'ORDONNANCE'}
                </Text>
              </View>

              {/* ── Practitioner card ──────────────────────────────────────── */}
              <SectionHeader label="Praticien" icon="medical-services" scale={scale} fs={fs} />
              <View
                style={{
                  backgroundColor: '#f8f9ff',
                  borderRadius: scale(12),
                  padding: scale(12),
                  marginBottom: scale(14),
                }}
              >
                <Text
                  style={{
                    fontSize: fs.lg,
                    fontWeight: '800',
                    color: '#0b1c30',
                    fontFamily: 'Manrope',
                    marginBottom: scale(2),
                  }}
                >
                  {fullTitle}
                </Text>
                {!!data.practitioner_speciality && (
                  <Text
                    style={{
                      fontSize: fs.sm,
                      fontWeight: '600',
                      color: '#006685',
                      fontFamily: 'Manrope',
                      marginBottom: scale(6),
                    }}
                  >
                    {data.practitioner_speciality}
                  </Text>
                )}
                <InfoRow icon="badge" value={data.registration_number ? `N° Ordre : ${data.registration_number}` : ''} scale={scale} fs={fs} />
                <InfoRow icon="location-on" value={data.clinic_address} scale={scale} fs={fs} />
                <InfoRow icon="phone" value={data.practitioner_phone ? `Tél : ${data.practitioner_phone}` : ''} scale={scale} fs={fs} />
              </View>

              {/* ── Patient ────────────────────────────────────────────────── */}
              <SectionHeader label="Patient" icon="person" scale={scale} fs={fs} />
              <View
                style={{
                  backgroundColor: '#f8f9ff',
                  borderRadius: scale(12),
                  padding: scale(12),
                  marginBottom: scale(14),
                }}
              >
                <Text
                  style={{
                    fontSize: fs.md,
                    fontWeight: '700',
                    color: '#0b1c30',
                    fontFamily: 'Manrope',
                  }}
                >
                  {data.patient_name}
                </Text>
              </View>

              {/* ── Diagnosis ──────────────────────────────────────────────── */}
              {!!data.diagnosis && (
                <>
                  <SectionHeader
                    label={isReco ? 'Objectif / Contexte' : 'Diagnostic'}
                    icon={isReco ? 'flag' : 'search'}
                    scale={scale}
                    fs={fs}
                  />
                  <View
                    style={{
                      backgroundColor: '#f8f9ff',
                      borderRadius: scale(12),
                      padding: scale(12),
                      marginBottom: scale(14),
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fs.md,
                        fontWeight: '500',
                        color: '#0b1c30',
                        fontFamily: 'Manrope',
                      }}
                    >
                      {data.diagnosis}
                    </Text>
                  </View>
                </>
              )}

              {/* ── Recommandation content ─────────────────────────────────── */}
              {isReco ? (
                !!data.instructions && (
                  <>
                    <SectionHeader label="Conseils & Recommandations" icon="tips-and-updates" scale={scale} fs={fs} />
                    <View
                      style={{
                        backgroundColor: '#fef9c3',
                        borderRadius: scale(12),
                        padding: scale(14),
                        marginBottom: scale(14),
                        borderWidth: 1,
                        borderColor: '#e4c546' + '40',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fs.md,
                          color: '#0b1c30',
                          fontFamily: 'Manrope',
                          lineHeight: scale(22),
                        }}
                      >
                        {data.instructions}
                      </Text>
                    </View>
                  </>
                )
              ) : (
                <>
                  {/* ── Medications ──────────────────────────────────────── */}
                  {data.medications.length > 0 && (
                    <>
                      <SectionHeader
                        label={`Médicaments (${data.medications.length})`}
                        icon="medication"
                        scale={scale}
                        fs={fs}
                      />
                      <View style={{ marginBottom: scale(14) }}>
                        {data.medications.map((med, i) => (
                          <View key={i}>
                            <View
                              style={{
                                flexDirection: 'row',
                                gap: scale(10),
                                paddingVertical: scale(12),
                              }}
                            >
                              {/* Number */}
                              <View
                                style={{
                                  width: scale(24),
                                  height: scale(24),
                                  borderRadius: scale(12),
                                  backgroundColor: '#e5eeff',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: scale(1),
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: scale(11),
                                    fontWeight: '800',
                                    color: '#006685',
                                    fontFamily: 'Manrope',
                                  }}
                                >
                                  {i + 1}
                                </Text>
                              </View>

                              {/* Details */}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: fs.md,
                                    fontWeight: '700',
                                    color: '#0b1c30',
                                    fontFamily: 'Manrope',
                                  }}
                                >
                                  {med.name}
                                  {med.dosage ? ` ${med.dosage}` : ''}
                                </Text>
                                {!!med.frequency && (
                                  <Text
                                    style={{
                                      fontSize: fs.sm,
                                      color: '#3f484d',
                                      fontFamily: 'Manrope',
                                      marginTop: scale(2),
                                    }}
                                  >
                                    {med.frequency}
                                  </Text>
                                )}
                                {!!med.duration && (
                                  <Text
                                    style={{
                                      fontSize: fs.sm,
                                      color: '#6f787e',
                                      fontFamily: 'Manrope',
                                      marginTop: scale(1),
                                    }}
                                  >
                                    {med.duration}
                                  </Text>
                                )}
                                {!!med.instructions && (
                                  <Text
                                    style={{
                                      fontSize: fs.xs,
                                      color: '#6f787e',
                                      fontFamily: 'Manrope',
                                      fontStyle: 'italic',
                                      marginTop: scale(2),
                                    }}
                                  >
                                    {med.instructions}
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Divider between meds */}
                            {i < data.medications.length - 1 && (
                              <View
                                style={{
                                  height: 1,
                                  backgroundColor: '#e5eeff',
                                }}
                              />
                            )}
                          </View>
                        ))}
                      </View>
                    </>
                  )}

                  {/* ── General instructions ──────────────────────────────── */}
                  {!!data.instructions && (
                    <>
                      <SectionHeader label="Instructions générales" icon="info" scale={scale} fs={fs} />
                      <View
                        style={{
                          backgroundColor: '#eff4ff',
                          borderRadius: scale(12),
                          padding: scale(14),
                          marginBottom: scale(14),
                          borderWidth: 1,
                          borderColor: '#006685' + '20',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: fs.md,
                            color: '#0b1c30',
                            fontFamily: 'Manrope',
                            lineHeight: scale(22),
                          }}
                        >
                          {data.instructions}
                        </Text>
                      </View>
                    </>
                  )}
                </>
              )}

              {/* ── Validity ───────────────────────────────────────────────── */}
              {!!validStr && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: scale(6),
                    marginBottom: scale(14),
                  }}
                >
                  <MaterialIcons name="event-available" size={scale(14)} color="#6f787e" />
                  <Text
                    style={{
                      fontSize: fs.sm,
                      color: '#6f787e',
                      fontFamily: 'Manrope',
                    }}
                  >
                    Valable jusqu'au :{' '}
                    <Text style={{ fontWeight: '700', color: '#0b1c30' }}>{validStr}</Text>
                  </Text>
                </View>
              )}

              {/* ── Footer disclaimer ──────────────────────────────────────── */}
              <View
                style={{
                  paddingTop: scale(12),
                  borderTopWidth: 1,
                  borderTopColor: '#e5eeff',
                }}
              >
                <Text
                  style={{
                    fontSize: scale(10),
                    color: '#bec8ce',
                    fontFamily: 'Manrope',
                    textAlign: 'center',
                    lineHeight: scale(14),
                  }}
                >
                  Document généré via M-Santé · Ce document ne remplace pas une
                  consultation en présentiel en cas d'urgence.
                </Text>
              </View>

            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
