import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useResponsive } from '@/hooks/useResponsive'
import {
  useDataPermissions,
  useUpdatePermissions,
  PERMISSION_CONFIG,
  GROUP_LABELS,
} from '@/features/patient/hooks/useDataPermissions'
import type { DataPermissions } from '@/features/patient/hooks/useDataPermissions'

type PermissionKey = keyof Omit<DataPermissions, 'id' | 'practitioner_id'>
type LocalToggles = Record<PermissionKey, boolean>

const DEFAULT_TOGGLES: LocalToggles = {
  allow_medical_history: true,
  allow_biological_analyses: true,
  allow_prescriptions: true,
  allow_consultation_reports: true,
  allow_appointment_history: true,
  allow_psychological_data: false,
  allow_gynecological_data: false,
  allow_mood_journal: false,
  allow_shared_documents: true,
}

function buildToggles(data: DataPermissions | null): LocalToggles {
  if (!data) return { ...DEFAULT_TOGGLES }
  return {
    allow_medical_history: data.allow_medical_history,
    allow_biological_analyses: data.allow_biological_analyses,
    allow_prescriptions: data.allow_prescriptions,
    allow_consultation_reports: data.allow_consultation_reports,
    allow_appointment_history: data.allow_appointment_history,
    allow_psychological_data: data.allow_psychological_data,
    allow_gynecological_data: data.allow_gynecological_data,
    allow_mood_journal: data.allow_mood_journal,
    allow_shared_documents: data.allow_shared_documents,
  }
}

export default function PermissionsScreen() {
  const { practitionerId, practitionerName } = useLocalSearchParams<{
    practitionerId: string
    practitionerName: string
  }>()
  const router = useRouter()
  const { px, cardPadding, gutter, fs, scale } = useResponsive()

  const { data, isLoading, refetch, isRefetching } = useDataPermissions(
    practitionerId ?? ''
  )
  const { mutate: updatePermissions, isPending } = useUpdatePermissions(
    practitionerId ?? ''
  )

  const [toggles, setToggles] = useState<LocalToggles>({ ...DEFAULT_TOGGLES })

  // Sync local state when DB data arrives
  useEffect(() => {
    if (!isLoading) {
      setToggles(buildToggles(data ?? null))
    }
  }, [data, isLoading])

  const handleToggle = useCallback((key: PermissionKey, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleSave = useCallback(() => {
    updatePermissions(toggles, {
      onSuccess: () => {
        Alert.alert(
          'Autorisations mises à jour',
          'Vos paramètres ont été enregistrés avec succès.',
          [{ text: 'OK', onPress: () => router.back() }]
        )
      },
      onError: (err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Une erreur est survenue.'
        Alert.alert('Erreur', message)
      },
    })
  }, [toggles, updatePermissions, router])

  const groups: Array<'medical' | 'mental' | 'documents'> = [
    'medical',
    'mental',
    'documents',
  ]

  const displayName = practitionerName ?? 'ce praticien'

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: '#f8f9ff' }]}
      edges={['top', 'bottom']}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingHorizontal: px,
            paddingVertical: scale(12),
            borderBottomColor: 'rgba(130,216,255,0.18)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialIcons name="arrow-back" size={scale(24)} color="#006685" />
        </TouchableOpacity>
        <View style={styles.headerTextBlock}>
          <Text
            style={[
              styles.headerTitle,
              { fontSize: fs.xl, color: '#0b1c30' },
            ]}
          >
            Autorisations
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { fontSize: fs.sm, color: '#6f787e' },
            ]}
            numberOfLines={1}
          >
            Ce que {displayName} peut consulter
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: px, paddingBottom: scale(120) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#006685"
            colors={['#006685']}
          />
        }
      >
        {/* Description card */}
        <View
          style={[
            styles.descriptionCard,
            {
              marginTop: gutter,
              marginBottom: scale(20),
              padding: cardPadding,
              borderRadius: scale(12),
              gap: scale(8),
            },
          ]}
        >
          <View style={styles.descriptionRow}>
            <MaterialIcons
              name="info-outline"
              size={scale(18)}
              color="#006685"
              style={{ marginTop: 1 }}
            />
            <Text
              style={[
                styles.descriptionText,
                { fontSize: fs.md, color: '#3f484d', lineHeight: fs.md * 1.55 },
              ]}
            >
              Vous contrôlez précisément les données que ce praticien peut
              consulter. Ces paramètres s'appliquent à toutes les consultations
              futures.
            </Text>
          </View>
        </View>

        {/* Permission groups */}
        {isLoading ? (
          <ActivityIndicator
            size="large"
            color="#006685"
            style={{ marginTop: scale(40) }}
          />
        ) : (
          groups.map((group) => {
            const items = PERMISSION_CONFIG.filter((p) => p.group === group)
            return (
              <View key={group} style={{ marginBottom: scale(24) }}>
                {/* Group header */}
                <Text
                  style={[
                    styles.groupHeader,
                    {
                      fontSize: fs.sm,
                      color: '#006685',
                      marginBottom: scale(10),
                      letterSpacing: 0.8,
                    },
                  ]}
                >
                  {GROUP_LABELS[group].toUpperCase()}
                </Text>

                {/* Group card */}
                <View
                  style={[
                    styles.groupCard,
                    { borderRadius: scale(12), overflow: 'hidden' },
                  ]}
                >
                  {items.map((item, index) => (
                    <View key={item.key}>
                      <View
                        style={[
                          styles.permissionRow,
                          {
                            paddingHorizontal: cardPadding,
                            paddingVertical: scale(14),
                          },
                        ]}
                      >
                        {/* Icon */}
                        <View
                          style={[
                            styles.iconContainer,
                            {
                              width: scale(40),
                              height: scale(40),
                              borderRadius: scale(10),
                              marginRight: scale(12),
                            },
                          ]}
                        >
                          <MaterialIcons
                            name={
                              item.icon as React.ComponentProps<
                                typeof MaterialIcons
                              >['name']
                            }
                            size={scale(22)}
                            color="#006685"
                          />
                        </View>

                        {/* Text */}
                        <View style={styles.permissionText}>
                          <Text
                            style={[
                              styles.permissionLabel,
                              {
                                fontSize: fs.md,
                                color: '#0b1c30',
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                          <Text
                            style={[
                              styles.permissionDescription,
                              {
                                fontSize: fs.sm,
                                color: '#6f787e',
                                marginTop: scale(2),
                              },
                            ]}
                          >
                            {item.description}
                          </Text>
                        </View>

                        {/* Switch */}
                        <Switch
                          value={toggles[item.key]}
                          onValueChange={(val) => handleToggle(item.key, val)}
                          trackColor={{
                            false: '#bec8ce',
                            true: 'rgba(0,102,133,0.35)',
                          }}
                          thumbColor={
                            toggles[item.key] ? '#006685' : '#ffffff'
                          }
                          ios_backgroundColor="#bec8ce"
                        />
                      </View>

                      {/* Divider */}
                      {index < items.length - 1 && (
                        <View
                          style={[
                            styles.divider,
                            { marginLeft: cardPadding + scale(40) + scale(12) },
                          ]}
                        />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {/* Save button */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: px,
            paddingVertical: scale(16),
            borderTopColor: 'rgba(130,216,255,0.18)',
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              height: scale(52),
              borderRadius: scale(26),
              backgroundColor: isPending ? '#82d8ff' : '#006685',
            },
          ]}
          onPress={handleSave}
          disabled={isPending}
          activeOpacity={0.85}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                { fontSize: fs.lg },
              ]}
            >
              Enregistrer les autorisations
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: 'Manrope',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontFamily: 'Manrope',
    fontWeight: '400',
    marginTop: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  descriptionCard: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    // Shadow iOS
    shadowColor: '#006685',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    // Shadow Android
    elevation: 2,
  },
  descriptionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  descriptionText: {
    flex: 1,
    fontFamily: 'Manrope',
    fontWeight: '400',
  },
  groupHeader: {
    fontFamily: 'Manrope',
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: 'rgba(255,255,255,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.80)',
    shadowColor: '#006685',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 30,
    elevation: 2,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    backgroundColor: 'rgba(0,102,133,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    flex: 1,
  },
  permissionLabel: {
    fontFamily: 'Manrope',
    fontWeight: '600',
  },
  permissionDescription: {
    fontFamily: 'Manrope',
    fontWeight: '400',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(190,200,206,0.5)',
    marginRight: 0,
  },
  footer: {
    backgroundColor: 'rgba(248,249,255,0.95)',
    borderTopWidth: 1,
  },
  saveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#006685',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonText: {
    fontFamily: 'Manrope',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
})
