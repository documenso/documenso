import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { APP_BASE_URL } from '@documenso/lib/constants/app';

type SharePageProps = {
  params: { slug: string };
};

export function generateMetadata({ params: { slug } }: SharePageProps) {
  return {
    title: 'Documenso - Share',
    description: 'I just signed a document with Documenso!',
    openGraph: {
      title: 'Documenso - Join the open source signing revolution',
      description: 'I just signed with Documenso!',
      type: 'website',
      images: [`${APP_BASE_URL}/share/${slug}/opengraph`],
    },
    twitter: {
      site: '@documenso',
      card: 'summary_large_image',
      images: [`${APP_BASE_URL}/share/${slug}/opengraph`],
      description: 'I just signed with Documenso!',
    },
  } satisfies Metadata;
}

export default function SharePage() {
  const userAgent = headers().get('User-Agent') ?? '';

  // https://stackoverflow.com/questions/47026171/how-to-detect-bots-for-open-graph-with-user-agent
  if (/bot|facebookexternalhit|WhatsApp|google|bing|duckduckbot|MetaInspector/i.test(userAgent)) {
    return null;
  }

  redirect(process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3001');
}
