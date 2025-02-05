import { redirect } from 'react-router';

import { NEXT_PUBLIC_MARKETING_URL } from '@documenso/lib/constants/app';

import type { Route } from './+types/share.$slug';

// Todo: Test meta.
export function meta({ params: { slug } }: Route.MetaArgs) {
  return [
    { title: 'Documenso - Share' },
    { description: 'I just signed a document in style with Documenso!' },
    {
      openGraph: {
        title: 'Documenso - Join the open source signing revolution',
        description: 'I just signed with Documenso!',
        type: 'website',
        images: [`/share/${slug}/opengraph`],
      },
    },
    {
      twitter: {
        site: '@documenso',
        card: 'summary_large_image',
        images: [`/share/${slug}/opengraph`],
        description: 'I just signed with Documenso!',
      },
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
