import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
})

export const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Nom requis'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

export const patientOnboardingSchema = z.object({
  full_name: z.string().min(2, 'Nom requis'),
  phone: z.string().regex(/^\+?[0-9]{8,15}$/, 'Numéro invalide'),
  country: z.enum(['SN', 'CI', 'CM', 'FR']),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)'),
  language: z.enum(['fr', 'en']),
})

export const practitionerStep1Schema = z.object({
  speciality: z.string().min(2, 'Spécialité requise'),
  bio: z.string().min(20, 'Bio trop courte (min 20 caractères)'),
  languages: z.array(z.string()).min(1, 'Au moins une langue'),
  session_price: z.number().positive('Tarif invalide'),
  session_currency: z.enum(['XOF', 'EUR', 'USD']),
  session_duration_min: z.number().refine(v => [30, 45, 60, 90].includes(v), 'Durée invalide'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type PatientOnboardingFormData = z.infer<typeof patientOnboardingSchema>
export type PractitionerStep1FormData = z.infer<typeof practitionerStep1Schema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
