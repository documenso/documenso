import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { InboxIcon } from 'lucide-react';

import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { InboxTable } from '~/components/tables/inbox-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Personal Inbox`);
}

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <h1 className="flex flex-row items-center gap-2 text-3xl font-bold">
          <InboxIcon className="h-8 w-8 text-muted-foreground" />

          <Trans>Personal Inbox</Trans>
        </h1>
        <p className="mt-1 text-muted-foreground">
          <Trans>Any documents that you have been invited to will appear here</Trans>
        </p>

        <OrganisationInvitations className="mt-4" />
      </div>

      <InboxTable />
    </div>
  );
}
