import { useSearchParams } from 'react-router';

import { UpcomingProfileClaimTeaser } from '~/components/general/upcoming-profile-claim-teaser';
import { DocumentsPageView } from '~/documents+/_documents-page-view';

export function meta() {
  return [{ title: 'Documents' }];
}

export default function DocumentsPage() {
  const [searchParams] = useSearchParams();

  return (
    <>
      <UpcomingProfileClaimTeaser />
      <DocumentsPageView searchParams={searchParams} />
    </>
  );
}
