import { z } from 'zod'

export const loginSchema = z.object({
  // Login must not impose a NEW minimum stricter than what was required at
  // signup time (web only ever required 6). A previously-valid 6-7 char
  // password would otherwise be silently blocked by client-side validation
  // before the request even reaches Supabase — the account owner sees no
  // useful error, just a form that won't submit. The server is the source of
  // truth for whether the password is correct; only require non-empty here.
  email: z.string().trim().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const signupSchema = z.object({
  email: z.string().trim().email('Email invalide'),
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
  // Stocké en AAAA-MM-JJ (colonne DATE) — l'écran de saisie affiche/valide
  // en JJ/MM/AAAA et convertit ; ce message ne doit donc citer que le format
  // que l'utilisateur voit réellement.
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide ou incomplète (JJ/MM/AAAA)'),
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
  email: z.string().trim().email('Email invalide'),
})

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Minimum 8 caractères')
    .regex(/[A-Z]/, 'Au moins une majuscule')
    .regex(/[0-9]/, 'Au moins un chiffre')
    .regex(/[^A-Za-z0-9]/, 'Au moins un caractère spécial'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type PatientOnboardingFormData = z.infer<typeof patientOnboardingSchema>
export type PractitionerStep1FormData = z.infer<typeof practitionerStep1Schema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
