import type { Metadata } from 'next';

import { setupI18nSSR } from '@documenso/lib/client-only/providers/i18n.server';
import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';

import type { DocumentsPageViewProps } from './documents-page-view';
import { DocumentsPageView } from './documents-page-view';
import { UpcomingProfileClaimTeaser } from './upcoming-profile-claim-teaser';

export type DocumentsPageProps = {
  searchParams?: DocumentsPageViewProps['searchParams'];
};

export const metadata: Metadata = {
  title: 'Documents',
};

export default async function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  setupI18nSSR();

  const { user } = await getRequiredServerComponentSession();

  return (
    <>
      <UpcomingProfileClaimTeaser user={user} />
      <DocumentsPageView searchParams={searchParams} />
    </>
  );
}
