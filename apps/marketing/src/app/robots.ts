import { MetadataRoute } from 'next';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
