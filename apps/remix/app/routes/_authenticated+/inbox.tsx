import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { InboxIcon } from 'lucide-react';

import { DocumentSearch } from '~/components/general/document/document-search';
import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { DocumentsTableStatusFilter } from '~/components/tables/documents-table-status-filter';
import { InboxTable } from '~/components/tables/inbox-table';
import { INBOX_SELECTABLE_STATUSES } from '~/utils/inbox-search-params';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Personal Inbox`);
}

export default function InboxPage() {
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <div className="mb-8">
        <h1 className="flex flex-row items-center gap-2 font-bold text-3xl">
          <InboxIcon className="h-8 w-8 text-muted-foreground" />

          <Trans>Personal Inbox</Trans>
        </h1>
        <p className="mt-1 text-muted-foreground">
          <Trans>Any documents that you have been invited to will appear here</Trans>
        </p>

        <OrganisationInvitations className="mt-4" />
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-4">
        <div className="w-56">
          <DocumentSearch />
        </div>

        <DocumentsTableStatusFilter statuses={INBOX_SELECTABLE_STATUSES} />
      </div>

      <InboxTable />
    </div>
  );
}
