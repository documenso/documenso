import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    host: 'https://docs.documenso.com',
    sitemap: 'https://docs.documenso.com/sitemap.xml',
  };
}
