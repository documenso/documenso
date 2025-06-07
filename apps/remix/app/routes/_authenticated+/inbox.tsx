import { Trans } from '@lingui/react/macro';
import { InboxIcon } from 'lucide-react';

import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { InboxTable } from '~/components/tables/inbox-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags('Personal Inbox');
}

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <h1 className="flex flex-row items-center gap-2 text-3xl font-bold">
          <InboxIcon className="text-muted-foreground h-8 w-8" />

          <Trans>Personal Inbox</Trans>
        </h1>
        <p className="text-muted-foreground mt-1">
          <Trans>Any documents that require your signature will appear here</Trans>
        </p>

        <OrganisationInvitations className="mt-4" />
      </div>

      <InboxTable />
    </div>
  );
}
