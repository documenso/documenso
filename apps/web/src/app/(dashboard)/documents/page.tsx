import Link from 'next/link';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { isExtendedDocumentStatus } from '@documenso/prisma/guards/is-extended-document-status';
import { ExtendedDocumentStatus } from '@documenso/prisma/types/extended-document-status';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { PeriodSelector } from '~/components/(dashboard)/period-selector/period-selector';
import {
  PeriodSelectorValue,
  isPeriodSelectorValue,
} from '~/components/(dashboard)/period-selector/types';
import { DocumentStatus } from '~/components/formatter/document-status';

import { DocumentsDataTable } from './data-table';
import { EmptyDocumentState } from './empty-state';
import { UploadDocument } from './upload-document';

export type DocumentsPageProps = {
  searchParams?: {
    status?: ExtendedDocumentStatus;
    period?: PeriodSelectorValue;
    page?: string;
    perPage?: string;
  };
};

export default async function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  const { user } = await getRequiredServerComponentSession();

  const stats = await getStats({
    user,
  });

  const status = isExtendedDocumentStatus(searchParams.status) ? searchParams.status : 'ALL';
  const period = isPeriodSelectorValue(searchParams.period) ? searchParams.period : '';
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 20;

  const results = await findDocuments({
    userId: user.id,
    status,
    orderBy: {
      column: 'createdAt',
      direction: 'desc',
    },
    page,
    perPage,
    period,
  });

  const getTabHref = (value: typeof status) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (params.has('page')) {
      params.delete('page');
    }

    return `/documents?${params.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <UploadDocument />

      <div className="mt-12 flex flex-wrap items-center justify-between gap-x-4 gap-y-8">
        <h1 className="text-4xl font-semibold">Documents</h1>

        <div className="-m-1 flex flex-wrap gap-x-4 gap-y-6 overflow-hidden p-1">
          <Tabs defaultValue={status} className="overflow-x-auto">
            <TabsList>
              {[
                ExtendedDocumentStatus.INBOX,
                ExtendedDocumentStatus.PENDING,
                ExtendedDocumentStatus.COMPLETED,
                ExtendedDocumentStatus.DRAFT,
                ExtendedDocumentStatus.ALL,
              ].map((value) => (
                <TabsTrigger key={value} className="min-w-[60px]" value={value} asChild>
                  <Link href={getTabHref(value)} scroll={false}>
                    <DocumentStatus status={value} />

                    {value !== ExtendedDocumentStatus.ALL && (
                      <span className="ml-1 hidden opacity-50 md:inline-block">
                        {Math.min(stats[value], 99)}
                        {stats[value] > 99 && '+'}
                      </span>
                    )}
                  </Link>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex w-48 flex-wrap items-center justify-between gap-x-2 gap-y-4">
            <PeriodSelector />
          </div>
        </div>
      </div>

      <div className="mt-8">
        {results.count > 0 && <DocumentsDataTable results={results} />}
        {results.count === 0 && <EmptyDocumentState status={status} />}
      </div>
    </div>
  );
}
