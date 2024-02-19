'use client';

import { useMemo } from 'react';

import { CheckCheckIcon, CheckIcon, Loader, MailOpen } from 'lucide-react';
import { DateTime } from 'luxon';
import { match } from 'ts-pattern';

import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogAction } from '@documenso/lib/utils/document-audit-logs';
import { trpc } from '@documenso/trpc/react';
import { AnimateGenericFadeInOut } from '@documenso/ui/components/animate/animate-generic-fade-in-out';
import { cn } from '@documenso/ui/lib/utils';

export type DocumentPageViewRecentActivityProps = {
  documentId: number;
  userId: number;
};

export const DocumentPageViewRecentActivity = ({
  documentId,
  userId,
}: DocumentPageViewRecentActivityProps) => {
  const {
    data,
    isLoading,
    isLoadingError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.document.findDocumentAuditLogs.useInfiniteQuery(
    {
      documentId,
      filterForRecentActivity: true,
      orderBy: {
        column: 'createdAt',
        direction: 'asc',
      },
      perPage: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const documentAuditLogs = useMemo(() => (data?.pages ?? []).flatMap((page) => page.data), [data]);

  return (
    <section className="dark:bg-background border-border bg-widget flex flex-col rounded-xl border">
      <div className="flex flex-row items-center justify-between border-b px-4 py-3">
        <h1 className="text-foreground font-medium">Recent activity</h1>

        {/* Can add dropdown menu here for additional options. */}
      </div>

      {isLoading && (
        <div className="flex h-full items-center justify-center py-16">
          <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {isLoadingError && (
        <div className="flex h-full flex-col items-center justify-center py-16">
          <p className="text-foreground/80 text-sm">Unable to load document history</p>
          <button
            onClick={async () => refetch()}
            className="text-foreground/70 hover:text-muted-foreground mt-2 text-sm"
          >
            Click here to retry
          </button>
        </div>
      )}

      <AnimateGenericFadeInOut>
        {data && (
          <ul role="list" className="space-y-6 p-4">
            {hasNextPage && (
              <li className="relative flex gap-x-4">
                <div className="absolute -bottom-6 left-0 top-0 flex w-6 justify-center">
                  <div className="bg-border w-px" />
                </div>

                <div className="bg-widget relative flex h-6 w-6 flex-none items-center justify-center">
                  <div className="bg-widget h-1.5 w-1.5 rounded-full ring-1 ring-gray-300 dark:ring-neutral-600" />
                </div>

                <button
                  onClick={async () => fetchNextPage()}
                  className="text-foreground/70 hover:text-muted-foreground text-xs"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load older activity'}
                </button>
              </li>
            )}

            {documentAuditLogs.length === 0 && (
              <div className="flex items-center justify-center py-4">
                <p className="text-muted-foreground/70 text-sm">No recent activity</p>
              </div>
            )}

            {documentAuditLogs.map((auditLog, auditLogIndex) => (
              <li key={auditLog.id} className="relative flex gap-x-4">
                <div
                  className={cn(
                    auditLogIndex === documentAuditLogs.length - 1 ? 'h-6' : '-bottom-6',
                    'absolute left-0 top-0 flex w-6 justify-center',
                  )}
                >
                  <div className="bg-border w-px" />
                </div>

                <div className="bg-widget text-foreground/40 relative flex h-6 w-6 flex-none items-center justify-center">
                  {match(auditLog.type)
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED, () => (
                      <div className="bg-widget rounded-full border border-gray-300 p-1 dark:border-neutral-600">
                        <CheckCheckIcon className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED, () => (
                      <div className="bg-widget rounded-full border border-gray-300 p-1 dark:border-neutral-600">
                        <CheckIcon className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED, () => (
                      <div className="bg-widget rounded-full border border-gray-300 p-1 dark:border-neutral-600">
                        <MailOpen className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .otherwise(() => (
                      <div className="bg-widget h-1.5 w-1.5 rounded-full ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}
                </div>

                <p className="text-muted-foreground dark:text-muted-foreground/70 flex-auto py-0.5 text-xs leading-5">
                  <span className="text-foreground font-medium">
                    {formatDocumentAuditLogAction(auditLog, userId).prefix}
                  </span>{' '}
                  {formatDocumentAuditLogAction(auditLog, userId).description}
                </p>

                <time className="text-muted-foreground dark:text-muted-foreground/70 flex-none py-0.5 text-xs leading-5">
                  {DateTime.fromJSDate(auditLog.createdAt).toRelative({ style: 'short' })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </AnimateGenericFadeInOut>
    </section>
  );
};
