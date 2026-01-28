import { MetadataRoute } from 'next'

// Usar sempre app.finlybot.com no sitemap (o domínio verificado na Search Console).
// Se usares outro domínio no futuro, define NEXT_PUBLIC_SITE_URL no deploy.
const BASE_URL = 'https://app.finlybot.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${BASE_URL}${path}`
  
  return [
    {
      url: url(''),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: url('/auth/login'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: url('/auth/register'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: url('/terms'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: url('/privacy'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
