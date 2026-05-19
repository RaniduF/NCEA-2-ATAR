import { MetadataRoute } from 'next'

/**
 * Produce sitemap entries for all public pages.
 *
 * Resolves the base URL from the `NEXT_PUBLIC_SITE_URL` environment variable,
 * defaulting to `http://localhost:3000` when unset.
 *
 * @returns Sitemap entries for all public pages with appropriate priorities
 *          and change frequencies.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
