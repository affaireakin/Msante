import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/', '/cgu'],
        disallow: ['/admin', '/patient', '/practitioner', '/onboarding', '/invite'],
      },
    ],
    sitemap: 'https://m-santé.com/sitemap.xml',
    host: 'https://m-santé.com',
  }
}
