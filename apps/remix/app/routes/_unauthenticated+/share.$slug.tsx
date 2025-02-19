import { redirect } from 'react-router';

import { NEXT_PUBLIC_MARKETING_URL, NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';

import type { Route } from './+types/share.$slug';

// Todo: (RR7) Test meta.
export function meta({ params: { slug } }: Route.MetaArgs) {
  return [
    { title: 'Documenso - Share' },
    { description: 'I just signed a document in style with Documenso!' },
    {
      property: 'og:title',
      title: 'Documenso - Join the open source signing revolution',
    },
    {
      property: 'og:description',
      description: 'I just signed with Documenso!',
    },
    {
      property: 'og:type',
      type: 'website',
    },
    {
      property: 'og:images',
      images: `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:site',
      site: '@documenso',
    },
    {
      name: 'twitter:card',
      card: 'summary_large_image',
    },
    {
      name: 'twitter:images',
      images: `${NEXT_PUBLIC_WEBAPP_URL()}/share/${slug}/opengraph`,
    },
    {
      name: 'twitter:description',
      description: 'I just signed with Documenso!',
    },
  ];
}

export const loader = ({ request }: Route.LoaderArgs) => {
  const userAgent = request.headers.get('User-Agent') ?? '';

  if (/bot|facebookexternalhit|WhatsApp|google|bing|duckduckbot|MetaInspector/i.test(userAgent)) {
    return null;
  }

  throw redirect(NEXT_PUBLIC_MARKETING_URL());
};
