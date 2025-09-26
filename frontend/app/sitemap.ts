import { MetadataRoute } from 'next'

/**
 * Produce sitemap entries for the site's root URL.
 *
 * Resolves the base URL from the `NEXT_PUBLIC_SITE_URL` environment variable, defaulting to `http://localhost:3000` when unset, and returns a sitemap array for the root path.
 *
 * @returns An array containing a single sitemap entry for the site's root URL with `lastModified` set to the current date, `changeFrequency` set to `"weekly"`, and `priority` set to `1.0`.
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
  ]
}
