import type { Metadata } from 'next';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import type { DocumentsPageViewProps } from './documents-page-view';
import { DocumentsPageView } from './documents-page-view';
import { PublicProfileIntro } from './username-claim/public-profile-intro';

export type DocumentsPageProps = {
  searchParams?: DocumentsPageViewProps['searchParams'];
};

export const metadata: Metadata = {
  title: 'Documents',
};

export default async function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  const { user } = await getRequiredServerComponentSession();
  return (
    <>
      <PublicProfileIntro user={user} />
      <DocumentsPageView searchParams={searchParams} />
    </>
  );
}
