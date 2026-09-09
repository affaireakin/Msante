import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'
import { uploadLocalFile, mimeFromUri } from '@/services/uploadFile'
import { useAuthStore } from '../store/authStore'
import type { AuthResult } from '@/types/auth'
import type { PatientOnboardingData, PractitionerOnboardingData } from '@/types/auth'

WebBrowser.maybeCompleteAuthSession()

export const authService = {
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  },

  async signUpWithEmail(
    email: string,
    password: string,
    // 'organization_pending' : compte de demandeur d'organisation, promu en
    // 'organization_admin' à la validation (cf. 20260909000001).
    role: 'patient' | 'practitioner' | 'organization_pending',
    full_name: string,
    extra?: { practitioner_type?: string; speciality?: string; phone?: string; country?: string }
  ): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role, full_name, ...extra } },
    })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  },

  async signInWithGoogle(): Promise<AuthResult> {
    const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'msante' })
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl },
    })
    if (error) return { user: null, error: error.message }
    return { user: null, error: null }
  },

  async verifyEmailOtp(email: string, token: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  },

  async resendEmailOtp(email: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) return { error: error.message }
    return { error: null }
  },

  // No redirectTo: harmonized with web to use an 8-digit OTP typed in-app
  // (verify-reset-otp screen) instead of an email link — a deep link to
  // msante://reset-password can't be tested at all in Expo Go (it only
  // understands its own exp:// scheme), and requiring a real build just to
  // test "forgot password" was an unnecessary gap versus the web flow.
  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  },

  async verifyResetOtp(email: string, token: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'recovery' })
    if (error) return { error: error.message }
    return { error: null }
  },

  async completePatientOnboarding(data: PatientOnboardingData): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('users')
      .update({
        full_name: data.full_name,
        phone: data.phone,
        country: data.country,
        date_of_birth: data.date_of_birth,
        language: data.language,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) throw error

    const profile = await fetchUserProfile(user.id)
    useAuthStore.getState().setProfile(profile)
  },

  async completePractitionerOnboarding(data: PractitionerOnboardingData, onProgress?: (current: number, total: number) => void): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const practitionerType = (user.user_metadata?.practitioner_type as string | undefined) ?? 'healthcare'

    // upsert, not insert: a first attempt can create this row and then fail
    // later (e.g. a document upload rejected by the storage bucket) — a
    // plain insert on retry hits practitioners_user_id_key (unique) and
    // leaves the user permanently stuck on "Impossible de soumettre".
    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .upsert({
        user_id: user.id,
        speciality: data.speciality,
        bio: data.bio,
        languages: data.languages,
        session_price: data.session_price,
        session_currency: data.session_currency,
        session_duration_min: data.session_duration_min,
        verification_status: 'pending',
        practitioner_type: practitionerType,
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (pErr) throw pErr

    if (data.profilePhotoUri) {
      const photoExt = data.profilePhotoUri.split('.').pop() ?? 'jpg'
      const photoPath = `${user.id}/avatar.${photoExt}`
      try {
        await uploadLocalFile('avatars', photoPath, data.profilePhotoUri, mimeFromUri(data.profilePhotoUri, 'image/jpeg'))
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(photoPath)
        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      } catch {
        // la photo est optionnelle — ne bloque pas la soumission du dossier
      }
    }

    for (let i = 0; i < data.documents.length; i++) {
      const doc = data.documents[i]
      onProgress?.(i + 1, data.documents.length)
      const fileExt = doc.name.split('.').pop() ?? 'pdf'
      const filePath = `${user.id}/${doc.document_type}.${fileExt}`
      // Bucket réel : 'documents' (privé, cf. 20260722000002_private_documents_bucket.sql)
      // — pas 'verification-documents', un bucket legacy jamais consolidé ici.
      // file_url stocke le path nu (résolu en URL signée à l'ouverture, jamais
      // getPublicUrl() qui échoue silencieusement sur un bucket privé) — même
      // convention que le flux organisation (onboarding/organization.tsx) et
      // web (lib/signedDocumentUrl.ts). C'est ce bug qui rendait tout document
      // praticien soumis par mobile invisible/inouvrable côté admin.
      await uploadLocalFile('documents', filePath, doc.uri, mimeFromUri(doc.name, 'application/pdf'))

      await supabase.from('verification_documents').insert({
        practitioner_id: practitioner.id,
        document_type: doc.document_type,
        file_url: filePath,
      })
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (updateErr) throw updateErr

    const [profile, practitionerProfile] = await Promise.all([
      fetchUserProfile(user.id),
      fetchPractitionerProfile(user.id),
    ])
    useAuthStore.getState().setProfile(profile)
    useAuthStore.getState().setPractitioner(practitionerProfile)
  },
}
