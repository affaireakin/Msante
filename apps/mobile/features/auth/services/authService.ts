import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { supabase, fetchUserProfile, fetchPractitionerProfile } from '@/services/supabase'
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
    role: 'patient' | 'practitioner',
    full_name: string,
    extra?: { practitioner_type?: string; speciality?: string }
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

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'msante://reset-password',
    })
    if (error) throw error
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

  async completePractitionerOnboarding(data: PractitionerOnboardingData): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const practitionerType = (user.user_metadata?.practitioner_type as string | undefined) ?? 'healthcare'

    const { data: practitioner, error: pErr } = await supabase
      .from('practitioners')
      .insert({
        user_id: user.id,
        speciality: data.speciality,
        bio: data.bio,
        languages: data.languages,
        session_price: data.session_price,
        session_currency: data.session_currency,
        session_duration_min: data.session_duration_min,
        verification_status: 'pending',
        practitioner_type: practitionerType,
      })
      .select()
      .single()

    if (pErr) throw pErr

    if (data.profilePhotoUri) {
      const photoExt = data.profilePhotoUri.split('.').pop() ?? 'jpg'
      const photoPath = `${user.id}/avatar.${photoExt}`
      const photoResponse = await fetch(data.profilePhotoUri)
      const photoBlob = await photoResponse.blob()
      const { error: photoUploadErr } = await supabase.storage
        .from('avatars')
        .upload(photoPath, photoBlob, { upsert: true })
      if (!photoUploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(photoPath)
        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
      }
    }

    for (const doc of data.documents) {
      const fileExt = doc.name.split('.').pop() ?? 'pdf'
      const filePath = `${user.id}/${doc.document_type}.${fileExt}`
      const response = await fetch(doc.uri)
      const blob = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, blob, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath)

      await supabase.from('verification_documents').insert({
        practitioner_id: practitioner.id,
        document_type: doc.document_type,
        file_url: publicUrl,
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
