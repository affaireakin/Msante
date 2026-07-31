import { useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useResponsive } from '@/hooks/useResponsive'
import { GlassCard } from '@/components/ui/GlassCard'
import { DiagnosticAidSearch } from '@/components/DiagnosticAidSearch'
import {
  usePatientNotes,
  useCreateNote,
  type PatientNote,
  type NoteType,
} from '@/features/practitioner/hooks/usePatientNotes'

// ─── Note type config ────────────────────────────────────────────────────────

type NoteTypeConfig = {
  key: NoteType
  label: string
  color: string
  bg: string
  icon: React.ComponentProps<typeof MaterialIcons>['name']
}

const NOTE_TYPES: NoteTypeConfig[] = [
  {
    key: 'observation',
    label: 'Observation',
    color: '#82d8ff',
    bg: '#e5eeff',
    icon: 'visibility',
  },
  {
    key: 'compte_rendu',
    label: 'Compte rendu',
    color: '#1d7a3a',
    bg: '#e8f5e9',
    icon: 'description',
  },
  {
    key: 'note_suivi',
    label: 'Suivi',
    color: '#705d00',
    bg: '#fff8e1',
    icon: 'timeline',
  },
  {
    key: 'bilan',
    label: 'Bilan',
    color: '#5c5f61',
    bg: '#e0e3e5',
    icon: 'summarize',
  },
  {
    key: 'alerte',
    label: 'Alerte',
    color: '#ba1a1a',
    bg: '#ffdad6',
    icon: 'warning',
  },
  {
    key: 'prescription_note',
    label: 'Prescription',
    color: '#1d6b6e',
    bg: '#e0f7fa',
    icon: 'medication',
  },
]

function getNoteTypeConfig(key: NoteType): NoteTypeConfig {
  return NOTE_TYPES.find((t) => t.key === key) ?? NOTE_TYPES[0]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Note card ───────────────────────────────────────────────────────────────

function NoteCard({ note }: { note: PatientNote }) {
  const { fs, scale } = useResponsive()
  const cfg = getNoteTypeConfig(note.note_type)

  return (
    <GlassCard style={{ gap: scale(10) }}>
      {/* Top row: type badge + date + shared badge */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: scale(8),
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(5),
            paddingHorizontal: scale(10),
            paddingVertical: scale(4),
            borderRadius: 999,
            backgroundColor: cfg.bg,
          }}
        >
          <MaterialIcons name={cfg.icon} size={scale(12)} color={cfg.color} />
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: fs.xs,
              fontWeight: '700',
              color: cfg.color,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {cfg.label}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
          {note.is_shared_with_patient && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: scale(4),
                paddingHorizontal: scale(8),
                paddingVertical: scale(3),
                borderRadius: 999,
                backgroundColor: '#e8f5e9',
              }}
            >
              <MaterialIcons name="share" size={scale(11)} color="#1d7a3a" />
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: fs.xs,
                  fontWeight: '700',
                  color: '#1d7a3a',
                }}
              >
                Partagé
              </Text>
            </View>
          )}
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: fs.xs,
              color: '#6f787e',
            }}
          >
            {formatDate(note.created_at)}
          </Text>
        </View>
      </View>

      {/* Title */}
      {note.title ? (
        <Text
          style={{
            fontFamily: 'Manrope',
            fontSize: fs.md,
            fontWeight: '700',
            color: '#0b1c30',
          }}
        >
          {note.title}
        </Text>
      ) : null}

      {/* Content preview */}
      <Text
        style={{
          fontFamily: 'Manrope',
          fontSize: fs.md,
          color: '#3f484d',
          lineHeight: fs.md * 1.55,
        }}
        numberOfLines={2}
      >
        {note.content}
      </Text>

      {/* Tags */}
      {note.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(6) }}>
          {note.tags.map((tag) => (
            <View
              key={tag}
              style={{
                paddingHorizontal: scale(8),
                paddingVertical: scale(3),
                borderRadius: 999,
                backgroundColor: '#eff4ff',
                borderWidth: 1,
                borderColor: 'rgba(0,102,133,0.15)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: fs.xs,
                  fontWeight: '600',
                  color: '#82d8ff',
                }}
              >
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ patientName }: { patientName: string }) {
  const { fs, scale } = useResponsive()
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(80),
        gap: scale(12),
      }}
    >
      <View
        style={{
          width: scale(64),
          height: scale(64),
          borderRadius: scale(32),
          backgroundColor: '#e5eeff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MaterialIcons name="note-alt" size={scale(28)} color="#82d8ff" />
      </View>
      <Text
        style={{
          fontFamily: 'Manrope',
          fontSize: fs.lg,
          fontWeight: '700',
          color: '#0b1c30',
          textAlign: 'center',
        }}
      >
        Aucune note
      </Text>
      <Text
        style={{
          fontFamily: 'Manrope',
          fontSize: fs.md,
          color: '#6f787e',
          textAlign: 'center',
          maxWidth: 240,
        }}
      >
        Commencez à documenter le suivi de {patientName} en créant une première note.
      </Text>
    </View>
  )
}

// ─── New note modal ───────────────────────────────────────────────────────────

interface NewNoteModalProps {
  visible: boolean
  patientId: string
  onClose: () => void
}

function NewNoteModal({ visible, patientId, onClose }: NewNoteModalProps) {
  const { fs, scale, px } = useResponsive()
  const createNote = useCreateNote()

  const [selectedType, setSelectedType] = useState<NoteType>('observation')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isShared, setIsShared] = useState(false)

  const reset = useCallback(() => {
    setSelectedType('observation')
    setTitle('')
    setContent('')
    setTagInput('')
    setTags([])
    setIsShared(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim().replace(/^#/, '').toLowerCase()
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput('')
      return
    }
    setTags((prev) => [...prev, trimmed])
    setTagInput('')
  }, [tagInput, tags])

  const handleRemoveTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag))
  }, [])

  const handleSave = useCallback(async () => {
    if (!content.trim()) {
      Alert.alert('Contenu requis', 'Veuillez saisir le contenu de la note.')
      return
    }
    try {
      await createNote.mutateAsync({
        patientId,
        noteType: selectedType,
        title: title.trim() || undefined,
        content: content.trim(),
        isSharedWithPatient: isShared,
        tags,
      })
      handleClose()
    } catch {
      Alert.alert('Erreur', 'Impossible d\'enregistrer la note. Veuillez réessayer.')
    }
  }, [content, patientId, selectedType, title, isShared, tags, createNote, handleClose])

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
        activeOpacity={1}
        onPress={handleClose}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <View
          style={{
            backgroundColor: '#f8f9ff',
            borderTopLeftRadius: scale(24),
            borderTopRightRadius: scale(24),
            paddingHorizontal: px,
            paddingTop: scale(12),
            paddingBottom: Platform.OS === 'ios' ? scale(36) : scale(24),
            maxHeight: '92%',
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: scale(40),
              height: scale(4),
              borderRadius: 2,
              backgroundColor: '#bec8ce',
              alignSelf: 'center',
              marginBottom: scale(16),
            }}
          />

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: scale(20),
              }}
            >
              <Text
                style={{
                  fontFamily: 'Manrope',
                  fontSize: fs.xl,
                  fontWeight: '800',
                  color: '#0b1c30',
                }}
              >
                Nouvelle note
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={{
                  width: scale(32),
                  height: scale(32),
                  borderRadius: scale(16),
                  backgroundColor: 'rgba(111,120,126,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="close" size={scale(18)} color="#3f484d" />
              </TouchableOpacity>
            </View>

            {/* Note type selector */}
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.sm,
                fontWeight: '700',
                color: '#6f787e',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: scale(10),
              }}
            >
              Type de note
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: scale(8), paddingBottom: scale(4) }}
              style={{ marginBottom: scale(20) }}
            >
              {NOTE_TYPES.map((cfg) => {
                const active = selectedType === cfg.key
                return (
                  <TouchableOpacity
                    key={cfg.key}
                    onPress={() => setSelectedType(cfg.key)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: scale(6),
                      paddingHorizontal: scale(12),
                      paddingVertical: scale(8),
                      borderRadius: 999,
                      borderWidth: 1.5,
                      backgroundColor: active ? cfg.bg : 'rgba(255,255,255,0.70)',
                      borderColor: active ? cfg.color : 'rgba(190,200,206,0.50)',
                    }}
                  >
                    <MaterialIcons
                      name={cfg.icon}
                      size={scale(14)}
                      color={active ? cfg.color : '#6f787e'}
                    />
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: fs.sm,
                        fontWeight: active ? '700' : '500',
                        color: active ? cfg.color : '#3f484d',
                      }}
                    >
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>

            {/* Title input */}
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.sm,
                fontWeight: '700',
                color: '#6f787e',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: scale(8),
              }}
            >
              Titre{' '}
              <Text style={{ color: '#bec8ce', fontWeight: '400', textTransform: 'none' }}>
                (optionnel)
              </Text>
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex : Séance du 08/06/2026"
              placeholderTextColor="#bec8ce"
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.md,
                color: '#0b1c30',
                paddingHorizontal: scale(14),
                paddingVertical: scale(12),
                borderRadius: scale(12),
                borderWidth: 1,
                borderColor: 'rgba(190,200,206,0.60)',
                backgroundColor: 'rgba(255,255,255,0.80)',
                marginBottom: scale(20),
              }}
            />

            {/* Content textarea */}
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.sm,
                fontWeight: '700',
                color: '#6f787e',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: scale(8),
              }}
            >
              Contenu <Text style={{ color: '#ba1a1a' }}>*</Text>
            </Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Rédigez votre note clinique ici..."
              placeholderTextColor="#bec8ce"
              multiline
              textAlignVertical="top"
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.md,
                color: '#0b1c30',
                paddingHorizontal: scale(14),
                paddingVertical: scale(12),
                borderRadius: scale(12),
                borderWidth: 1,
                borderColor: 'rgba(190,200,206,0.60)',
                backgroundColor: 'rgba(255,255,255,0.80)',
                minHeight: scale(120),
                lineHeight: fs.md * 1.6,
              }}
            />
            <View style={{ marginTop: scale(10), marginBottom: scale(20) }}>
              <DiagnosticAidSearch
                patientId={patientId}
                onSelect={d => setContent(prev => `${prev}${prev ? '\n' : ''}Diagnostic évoqué : ${d.label} (${d.source.toUpperCase()} ${d.code})`)}
              />
            </View>

            {/* Tags */}
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.sm,
                fontWeight: '700',
                color: '#6f787e',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: scale(8),
              }}
            >
              Tags
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: scale(8),
                marginBottom: scale(10),
              }}
            >
              <TextInput
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                placeholder="anxiété, dépression..."
                placeholderTextColor="#bec8ce"
                returnKeyType="done"
                style={{
                  flex: 1,
                  fontFamily: 'Manrope',
                  fontSize: fs.md,
                  color: '#0b1c30',
                  paddingHorizontal: scale(14),
                  paddingVertical: scale(10),
                  borderRadius: scale(12),
                  borderWidth: 1,
                  borderColor: 'rgba(190,200,206,0.60)',
                  backgroundColor: 'rgba(255,255,255,0.80)',
                }}
              />
              <TouchableOpacity
                onPress={handleAddTag}
                style={{
                  width: scale(40),
                  height: scale(40),
                  borderRadius: scale(12),
                  backgroundColor: '#82d8ff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialIcons name="add" size={scale(20)} color="#0b1c30" />
              </TouchableOpacity>
            </View>

            {tags.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: scale(6),
                  marginBottom: scale(20),
                }}
              >
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => handleRemoveTag(tag)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: scale(4),
                      paddingHorizontal: scale(10),
                      paddingVertical: scale(5),
                      borderRadius: 999,
                      backgroundColor: '#eff4ff',
                      borderWidth: 1,
                      borderColor: 'rgba(0,102,133,0.20)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'Manrope',
                        fontSize: fs.sm,
                        fontWeight: '600',
                        color: '#82d8ff',
                      }}
                    >
                      #{tag}
                    </Text>
                    <MaterialIcons name="close" size={scale(12)} color="#82d8ff" />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Share toggle */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: scale(16),
                paddingVertical: scale(14),
                borderRadius: scale(14),
                backgroundColor: 'rgba(255,255,255,0.70)',
                borderWidth: 1,
                borderColor: 'rgba(190,200,206,0.50)',
                marginBottom: scale(24),
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(10), flex: 1 }}>
                <MaterialIcons name="share" size={scale(18)} color="#82d8ff" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: fs.md,
                      fontWeight: '700',
                      color: '#0b1c30',
                    }}
                  >
                    Partager avec le patient
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: fs.xs,
                      color: '#6f787e',
                      marginTop: 2,
                    }}
                  >
                    Le patient pourra consulter cette note
                  </Text>
                </View>
              </View>
              <Switch
                value={isShared}
                onValueChange={setIsShared}
                trackColor={{ false: '#bec8ce', true: '#82d8ff' }}
                thumbColor={isShared ? '#82d8ff' : '#f8f9ff'}
              />
            </View>

            {/* Save button */}
            <TouchableOpacity
              onPress={() => void handleSave()}
              disabled={createNote.isPending || !content.trim()}
              style={{
                paddingVertical: scale(15),
                borderRadius: 999,
                backgroundColor:
                  createNote.isPending || !content.trim() ? '#bec8ce' : '#82d8ff',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: scale(8),
                marginBottom: scale(8),
              }}
            >
              {createNote.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={scale(18)} color="#fff" />
                  <Text
                    style={{
                      fontFamily: 'Manrope',
                      fontSize: fs.md,
                      fontWeight: '800',
                      color: '#fff',
                      letterSpacing: 0.3,
                    }}
                  >
                    Enregistrer
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function PatientNotesScreen() {
  const { patientId, patientName } = useLocalSearchParams<{
    patientId: string
    patientName: string
  }>()
  const router = useRouter()
  const { fs, scale, px, cardPadding } = useResponsive()

  const safePatientId = patientId ?? ''
  const safePatientName = patientName ?? 'Patient'

  const { data: notes, isLoading } = usePatientNotes(safePatientId)
  const [modalVisible, setModalVisible] = useState(false)

  const initials = safePatientName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8f9ff' }} edges={['top']}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: scale(12),
          paddingHorizontal: px,
          paddingVertical: scale(12),
          backgroundColor: 'rgba(255,255,255,0.90)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.20)',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={{ padding: scale(4) }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={scale(22)} color="#0b1c30" />
        </TouchableOpacity>

        {/* Patient avatar */}
        <View
          style={{
            width: scale(36),
            height: scale(36),
            borderRadius: scale(10),
            backgroundColor: '#e5eeff',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: 'Manrope',
              fontWeight: '800',
              fontSize: fs.sm,
              color: '#82d8ff',
            }}
          >
            {initials}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: fs.md,
              fontWeight: '700',
              color: '#0b1c30',
            }}
            numberOfLines={1}
          >
            Notes — {safePatientName}
          </Text>
          {!isLoading && notes !== undefined && (
            <Text
              style={{
                fontFamily: 'Manrope',
                fontSize: fs.xs,
                color: '#6f787e',
              }}
            >
              {notes.length} note{notes.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={() => setModalVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(5),
            paddingHorizontal: scale(12),
            paddingVertical: scale(8),
            borderRadius: 999,
            backgroundColor: '#82d8ff',
          }}
        >
          <MaterialIcons name="add" size={scale(16)} color="#0b1c30" />
          <Text
            style={{
              fontFamily: 'Manrope',
              fontSize: fs.sm,
              fontWeight: '800',
              color: '#0b1c30',
            }}
          >
            Nouvelle note
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#82d8ff" />
        </View>
      ) : (
        <FlatList
          data={notes ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            padding: cardPadding,
            gap: scale(12),
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<EmptyState patientName={safePatientName} />}
          renderItem={({ item }) => <NoteCard note={item} />}
          ListFooterComponent={<View style={{ height: scale(16) }} />}
        />
      )}

      {/* New note modal */}
      <NewNoteModal
        visible={modalVisible}
        patientId={safePatientId}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  )
}
