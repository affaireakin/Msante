import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/', '/cgu', '/faq', '/contact', '/pages/', '/plan-du-site'],
        disallow: ['/admin', '/patient', '/practitioner', '/organization', '/organization-member', '/secretary', '/onboarding', '/invite'],
      },
    ],
    sitemap: 'https://m-santé.com/sitemap.xml',
    host: 'https://m-santé.com',
  }
}
