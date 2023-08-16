import Link from 'next/link';

import { Plus } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { isDocumentStatus } from '@documenso/lib/types/is-document-status';
import { DocumentStatus as InternalDocumentStatus } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Tabs, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';

import { DocumentDropzone } from '~/components/(dashboard)/document-dropzone/document-dropzone';
import { PeriodSelector } from '~/components/(dashboard)/period-selector/period-selector';
import {
  PeriodSelectorValue,
  isPeriodSelectorValue,
} from '~/components/(dashboard)/period-selector/types';
import { DocumentStatus } from '~/components/formatter/document-status';

import { UploadDocument } from '../dashboard/upload-document';
import { DocumentsDataTable } from './data-table';

export type DocumentsPageProps = {
  searchParams?: {
    status?: InternalDocumentStatus | 'ALL';
    period?: PeriodSelectorValue;
    page?: string;
    perPage?: string;
  };
};

export default async function DocumentsPage({ searchParams = {} }: DocumentsPageProps) {
  const session = await getRequiredServerComponentSession();

  const stats = await getStats({
    userId: session.id,
  });

  const status = isDocumentStatus(searchParams.status) ? searchParams.status : 'ALL';
  const period = isPeriodSelectorValue(searchParams.period) ? searchParams.period : '';
  const page = Number(searchParams.page) || 1;
  const perPage = Number(searchParams.perPage) || 20;

  const results = await findDocuments({
    userId: session.id,
    status: status === 'ALL' ? undefined : status,
    orderBy: {
      column: 'created',
      direction: 'desc',
    },
    page,
    perPage,
  });

  const isNoResults = status === 'ALL' && period === '' && results.data.length === 0;

  const getTabHref = (value: typeof status) => {
    const params = new URLSearchParams(searchParams);

    params.set('status', value);

    if (params.has('page')) {
      params.delete('page');
    }

    if (value === 'ALL') {
      params.delete('status');
    }

    return `/documents?${params.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <UploadDocument />
      <h1 className="mt-12 text-4xl font-semibold">Documents</h1>
      <div className="mt-8 flex flex-wrap gap-x-4 gap-y-6">
        <Tabs defaultValue={status}>
          <TabsList>
            <TabsTrigger className="min-w-[60px]" value="ALL" asChild>
              <Link href={getTabHref('ALL')}>All</Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value={InternalDocumentStatus.DRAFT} asChild>
              <Link href={getTabHref(InternalDocumentStatus.DRAFT)}>
                <DocumentStatus status={InternalDocumentStatus.DRAFT} />

                <span className="ml-1 hidden opacity-50 md:inline-block">
                  {Math.min(stats.DRAFT, 99)}
                </span>
              </Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value={InternalDocumentStatus.PENDING} asChild>
              <Link href={getTabHref(InternalDocumentStatus.PENDING)}>
                <DocumentStatus status={InternalDocumentStatus.PENDING} />

                <span className="ml-1 hidden opacity-50 md:inline-block">
                  {Math.min(stats.PENDING, 99)}
                </span>
              </Link>
            </TabsTrigger>

            <TabsTrigger className="min-w-[60px]" value={InternalDocumentStatus.COMPLETED} asChild>
              <Link href={getTabHref(InternalDocumentStatus.COMPLETED)}>
                <DocumentStatus status={InternalDocumentStatus.COMPLETED} />

                <span className="ml-1 hidden opacity-50 md:inline-block">
                  {Math.min(stats.COMPLETED, 99)}
                </span>
              </Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-4">
          <PeriodSelector />
        </div>
      </div>

      <div className="mt-8">
        {/* If we're viewing all documents for all time and there's nuffin we should should show an add document component instead */}
        {isNoResults ? (
          <DocumentDropzone className="min-h-[60vh] md:min-h-[40vh]" />
        ) : (
          <DocumentsDataTable results={results} />
        )}
      </div>
    </div>
  );
}
