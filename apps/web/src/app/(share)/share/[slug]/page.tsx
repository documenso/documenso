import React from 'react';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getShareLinkBySlug } from '@documenso/lib/server-only/share/get-share-link-by-slug';

import Redirect from './redirect';

export const metadata: Metadata = {
  title: 'Documenso - Share',
};

export type SharePageProps = {
  params: {
    slug?: string;
  };
};

export default async function SharePage({ params: { slug } }: SharePageProps) {
  if (!slug) {
    return notFound();
  }

  const share = await getShareLinkBySlug({ slug }).catch(() => null);

  if (!share) {
    return notFound();
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <h1 className="my-2 text-4xl font-semibold">Share Page</h1>
      <p className="my-2 text-xl">Redirecting...</p>
      <Redirect />
    </div>
  );
}
