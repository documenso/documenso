import type { MetadataRoute } from 'next';

import { source } from '@/lib/source';

const BASE_URL = 'https://docs.documenso.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    ...source.getPages().map((page) => ({
      url: `${BASE_URL}${page.url}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ];
}
