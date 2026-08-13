'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface HomepageContent {
  hero: {
    badge: string
    titleMain: string
    titleHighlight: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
    statBadgeValue: string
    statBadgeLabel: string
  }
  features: { title: string; desc: string }[]
  valueProposition: {
    heading: string
    items: { title: string; desc: string }[]
    videoLabel: string
    stat1Value: string
    stat1Label: string
    stat2Value: string
    stat2Label: string
  }
  ctaFinal: {
    heading: string
    subtitle: string
    ctaPrimary: string
    ctaSecondary: string
    disclaimer: string
  }
  trustBar: {
    label: string
    partners: { label: string }[]
  }
}

// Doit rester synchronisé avec le seed de
// supabase/migrations/20260813000001_homepage_content.sql — sert de filet
// de sécurité si la ligne site_settings n'a pas encore été peuplée.
export const DEFAULT_HOMEPAGE_CONTENT: HomepageContent = {
  hero: {
    badge: 'NOUVEAU · INNOVATION BIEN-ÊTRE',
    titleMain: 'Votre sanctuaire de santé mentale,',
    titleHighlight: 'réinventé.',
    subtitle: "Une approche holistique propulsée par l'intelligence artificielle pour des soins personnalisés et accessibles. Redécouvrez l'équilibre intérieur avec M-Santé.",
    ctaPrimary: 'Commencer mon parcours',
    ctaSecondary: 'Découvrir nos praticiens',
    statBadgeValue: '98%',
    statBadgeLabel: 'de confiance renouvelée.',
  },
  features: [
    { title: 'Compagnon Bien-être IA', desc: "Un assistant émotionnel intelligent disponible 24/7 pour vous écouter, analyser vos humeurs et proposer des exercices adaptés." },
    { title: "Réseau d'Experts", desc: 'Accédez à un panel de psychologues, psychiatres et coachs de vie certifiés, sélectionnés pour leur excellence.' },
    { title: 'Téléconsultation Sécurisée', desc: 'Des sessions vidéo chiffrées de bout en bout pour garantir une confidentialité totale. Consultez depuis chez vous.' },
    { title: 'Consultation en présentiel', desc: 'Rencontrez votre praticien dans son cabinet ou à domicile. Une présence humaine quand vous en avez besoin.' },
  ],
  valueProposition: {
    heading: "Le Futurisme Médical : L'IA au service de l'empathie.",
    items: [
      { title: 'Précision Clinique', desc: 'Algorithmes de diagnostic préventif basés sur des protocoles médicaux internationaux validés.' },
      { title: 'Sérénité Humaine', desc: "Interfaces minimalistes et apaisantes conçues pour réduire l'anxiété et favoriser la guérison mentale." },
      { title: 'Écosystème Connecté', desc: 'Synchronisation transparente entre vos appareils, vos praticiens et votre historique de santé.' },
    ],
    videoLabel: 'Découvrez notre vision (2:45)',
    stat1Value: '500+',
    stat1Label: 'Praticiens Certifiés',
    stat2Value: '24/7',
    stat2Label: 'Support IA Illimité',
  },
  ctaFinal: {
    heading: 'Prêt à transformer votre rapport à la santé mentale ?',
    subtitle: 'Rejoignez des milliers de personnes qui ont choisi une approche moderne et bienveillante pour leur bien-être.',
    ctaPrimary: 'Commencer maintenant',
    ctaSecondary: 'Consulter les tarifs',
    disclaimer: 'Essai gratuit de 7 jours sur le Compagnon IA. Sans engagement.',
  },
  trustBar: {
    label: 'NOS PARTENAIRES DE CONFIANCE',
    partners: [{ label: 'Wave' }, { label: 'Orange Money' }, { label: 'Santevie' }],
  },
}

function mergeWithDefaults(data: Partial<HomepageContent> | null): HomepageContent {
  if (!data) return DEFAULT_HOMEPAGE_CONTENT
  return {
    hero: { ...DEFAULT_HOMEPAGE_CONTENT.hero, ...data.hero },
    features: data.features?.length === 4 ? data.features : DEFAULT_HOMEPAGE_CONTENT.features,
    valueProposition: {
      ...DEFAULT_HOMEPAGE_CONTENT.valueProposition,
      ...data.valueProposition,
      items: data.valueProposition?.items?.length === 3 ? data.valueProposition.items : DEFAULT_HOMEPAGE_CONTENT.valueProposition.items,
    },
    ctaFinal: { ...DEFAULT_HOMEPAGE_CONTENT.ctaFinal, ...data.ctaFinal },
    trustBar: {
      ...DEFAULT_HOMEPAGE_CONTENT.trustBar,
      ...data.trustBar,
      partners: data.trustBar?.partners?.length === 3 ? data.trustBar.partners : DEFAULT_HOMEPAGE_CONTENT.trustBar.partners,
    },
  }
}

export function useHomepageContent() {
  return useQuery<HomepageContent>({
    queryKey: ['homepage-content'],
    queryFn: async () => {
      const { data, error } = await supabase.from('site_settings').select('homepage_content').eq('id', 1).single()
      if (error) throw error
      return mergeWithDefaults(data?.homepage_content as Partial<HomepageContent> | null)
    },
    staleTime: 5 * 60_000,
  })
}

export function useSaveHomepageContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (content: HomepageContent) => {
      const { error } = await supabase.from('site_settings').update({ homepage_content: content }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['homepage-content'] }),
  })
}
