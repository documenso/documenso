import Link from 'next/link';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import type { PeriodSelectorValue } from '@documenso/lib/server-only/document/find-documents';
import type { GetStatsInput } from '@documenso/lib/server-only/document/get-stats';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { parseToIntegerArray } from '@documenso/lib/utils/params';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Team, TeamEmail } from '@documenso/prisma/client';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { PeriodSelector } from '~/components/(dashboard)/period-selector/period-selector';
import { isPeriodSelectorValue } from '~/components/(dashboard)/period-selector/types';
import { DocumentStatus } from '~/components/formatter/document-status';

import { DocumentsDataTable } from './data-table';
import { DataTableSenderFilter } from './data-table-sender-filter';
import { EmptyDocumentState } from './empty-state';
import { UploadDocument } from './upload-document';

export type DocumentsPageViewProps = {
  searchParams?: {
    status?: ExtendedDocumentStatus;
    period?: PeriodSelectorValue;
    page?: string;
    perPage?: string;
    senderIds?: string;
  };
  team?: Team & { teamEmail?: TeamEmail | null };
};

export const DocumentsPageView = async ({ searchParams = {}, team }: DocumentsPageViewProps) => {
  const { user } = await getRequiredServerComponentSession();

  const status = isExtendedDocumentStatus(searchParams.status) ? searchParams.status : 'ALL';
  const period = isPeriodSelectorValue(searchParams.period) ? searchParams.period : '';
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 20;
  const senderIds = parseToIntegerArray(searchParams.senderIds ?? '');
  const currentTeam = team ? { id: team.id, url: team.url } : undefined;

  const getStatOptions: GetStatsInput = {
    user,
    period,
  };

  if (team) {
    getStatOptions.team = {
      teamId: team.id,
      teamEmail: team.teamEmail?.email,
      senderIds,
    };
  }

  const stats = await getStats(getStatOptions);

  const results = await findDocuments({
    userId: user.id,
    teamId: team?.id,
    status,
    orderBy: {
      column: 'createdAt',
      direction: 'desc',
    },
    page,
    perPage,
    period,
    senderIds,
  });

  const getTabHref = (value: typeof status) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (params.has('page')) {
      params.delete('page');
    }

    return `${formatDocumentsPath(team?.url)}?${params.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <UploadDocument team={currentTeam} />

      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
        <div className="flex flex-row items-center">
          {team && (
            <Avatar className="dark:border-border mr-3 h-12 w-12 border-2 border-solid border-white">
              <AvatarFallback className="text-xs text-gray-400">
                {team.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
          )}

          <h1 className="text-4xl font-semibold">Documents</h1>
        </div>

        <div className="-m-1 flex flex-wrap gap-x-4 gap-y-6 overflow-hidden p-1">
          <Tabs value={status} className="overflow-x-auto">
            <TabsList>
              {[
                ExtendedDocumentStatus.INBOX,
                ExtendedDocumentStatus.PENDING,
                ExtendedDocumentStatus.COMPLETED,
                ExtendedDocumentStatus.DRAFT,
                ExtendedDocumentStatus.ALL,
              ].map((value) => (
                <TabsTrigger
                  key={value}
                  className="hover:text-foreground min-w-[60px]"
                  value={value}
                  asChild
                >
                  <Link href={getTabHref(value)} scroll={false}>
                    <DocumentStatus status={value} />

                    {value !== ExtendedDocumentStatus.ALL && (
                      <span className="ml-1 inline-block opacity-50">
                        {Math.min(stats[value], 99)}
                        {stats[value] > 99 && '+'}
                      </span>
                    )}
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {team && <DataTableSenderFilter teamId={team.id} />}

          <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
            <PeriodSelector />
          </div>
        </div>
      </div>

      <div className="mt-8">
        {results.count > 0 && (
          <DocumentsDataTable
            results={results}
            showSenderColumn={team !== undefined}
            team={currentTeam}
          />
        )}
        {results.count === 0 && <EmptyDocumentState status={status} />}
      </div>
    </div>
  );
};
