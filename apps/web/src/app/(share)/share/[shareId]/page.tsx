import React from 'react';

import { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSharingId } from '@documenso/lib/server-only/share/get-share-id';

import Redirect from './redirect';

type MetadataProps = {
  params: { shareId: string };
};

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const id = params.shareId;
  const share = await getSharingId({ shareId: id });
  const signature = share?.recipent.name || share?.recipent.email;

  return {
    title: 'Documenso - Share',
    openGraph: {
      images: [`/api/share-og?signature=${signature}`],
    },
  };
}

export type SharePageProps = {
  params: {
    shareId?: string;
  };
};

export default async function SharePage({ params: { shareId } }: SharePageProps) {
  if (!shareId) {
    return notFound();
  }

  const share = await getSharingId({ shareId });

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
