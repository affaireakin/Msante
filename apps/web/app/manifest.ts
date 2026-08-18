import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'M-Santé',
    short_name: 'M-Santé',
    description: '1ère plateforme de santé mentale africaine',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f9ff',
    theme_color: '#82d8ff',
    icons: [
      { src: '/icon.png', sizes: '256x256', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
