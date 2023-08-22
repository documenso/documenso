import { MetadataRoute } from 'next';

import { allBlogPosts, allGenericPages } from 'contentlayer/generated';

import { getBaseUrl } from '@documenso/lib/universal/get-base-url';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getBaseUrl();
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
    },
    ...allGenericPages.map((doc) => ({
      url: `${baseUrl}/${doc._raw.flattenedPath}`,
      lastModified,
    })),
    {
      url: `${baseUrl}/blog`,
      lastModified,
    },
    ...allBlogPosts.map((doc) => ({
      url: `${baseUrl}/${doc._raw.flattenedPath}`,
      lastModified,
    })),
    {
      url: `${baseUrl}/open`,
      lastModified,
    },
    {
      url: `${baseUrl}/oss-friends`,
      lastModified,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified,
    },
  ];
}
