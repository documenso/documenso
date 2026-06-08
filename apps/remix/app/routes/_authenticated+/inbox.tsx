import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { InboxIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { DocumentSearch } from '~/components/general/document/document-search';
import { DocumentStatus } from '~/components/general/document/document-status';
import { OrganisationInvitations } from '~/components/general/organisations/organisation-invitations';
import { InboxTable } from '~/components/tables/inbox-table';
import { appMetaTags } from '~/utils/meta';

export function meta() {
  return appMetaTags(msg`Personal Inbox`);
}

const INBOX_FILTER_STATUSES = [
  ExtendedDocumentStatus.ALL,
  ExtendedDocumentStatus.PENDING,
  ExtendedDocumentStatus.COMPLETED,
] as const;

type InboxFilterStatus = (typeof INBOX_FILTER_STATUSES)[number];

const isInboxFilterStatus = (status: string | null): status is InboxFilterStatus =>
  INBOX_FILTER_STATUSES.some((filterStatus) => filterStatus === status);

export default function InboxPage() {
  const [searchParams] = useSearchParams();

  const searchParamStatus = searchParams.get('status');
  const activeStatus = isInboxFilterStatus(searchParamStatus) ? searchParamStatus : ExtendedDocumentStatus.ALL;

  const getStatusHref = (status: InboxFilterStatus) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', status);

    if (status === ExtendedDocumentStatus.ALL) {
      params.delete('status');
    }

    if (params.has('page')) {
      params.delete('page');
    }

    return params.toString() ? `/inbox?${params.toString()}` : '/inbox';
  };

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

      <div className="-m-1 mb-8 flex flex-wrap gap-x-4 gap-y-6 overflow-hidden p-1">
        <Tabs value={activeStatus} className="overflow-x-auto">
          <TabsList>
            {INBOX_FILTER_STATUSES.map((status) => (
              <TabsTrigger key={status} className="min-w-[60px] hover:text-foreground" value={status} asChild>
                <Link to={getStatusHref(status)} preventScrollReset>
                  <DocumentStatus status={status} />
                </Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
          <DocumentSearch initialValue={searchParams.get('query') ?? ''} />
        </div>
      </div>

      <InboxTable />
    </div>
  );
}
