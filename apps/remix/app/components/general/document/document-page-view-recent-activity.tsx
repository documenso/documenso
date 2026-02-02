import { useMemo } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { AlertTriangle, CheckCheckIcon, CheckIcon, Loader, MailOpen } from 'lucide-react';
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
  const { _, i18n } = useLingui();

  const {
    data,
    isLoading,
    isLoadingError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = trpc.document.auditLog.find.useInfiniteQuery(
    {
      documentId,
      filterForRecentActivity: true,
      orderByColumn: 'createdAt',
      orderByDirection: 'asc',
      perPage: 10,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const documentAuditLogs = useMemo(() => (data?.pages ?? []).flatMap((page) => page.data), [data]);

  return (
    <section className="flex flex-col rounded-xl border border-border bg-widget dark:bg-background">
      <div className="flex flex-row items-center justify-between border-b px-4 py-3">
        <h1 className="font-medium text-foreground">
          <Trans>Recent activity</Trans>
        </h1>

        {/* Can add dropdown menu here for additional options. */}
      </div>

      {isLoading && (
        <div className="flex h-full items-center justify-center py-16">
          <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {isLoadingError && (
        <div className="flex h-full flex-col items-center justify-center py-16">
          <p className="text-sm text-foreground/80">
            <Trans>Unable to load document history</Trans>
          </p>
          <button
            onClick={async () => refetch()}
            className="mt-2 text-sm text-foreground/70 hover:text-muted-foreground"
          >
            <Trans>Click here to retry</Trans>
          </button>
        </div>
      )}

      <AnimateGenericFadeInOut>
        {data && (
          <ul role="list" className="space-y-6 p-4">
            {hasNextPage && (
              <li className="relative flex gap-x-4">
                <div className="absolute -bottom-6 left-0 top-0 flex w-6 justify-center">
                  <div className="w-px bg-border" />
                </div>

                <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-widget">
                  <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                </div>

                <button
                  onClick={async () => fetchNextPage()}
                  className="text-xs text-foreground/70 hover:text-muted-foreground"
                >
                  {isFetchingNextPage ? _(msg`Loading...`) : _(msg`Load older activity`)}
                </button>
              </li>
            )}

            {documentAuditLogs.length === 0 && (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm text-muted-foreground/70">
                  <Trans>No recent activity</Trans>
                </p>
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
                  <div className="w-px bg-border" />
                </div>

                <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-widget text-foreground/40">
                  {match(auditLog.type)
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED, () => (
                      <div className="rounded-full border border-gray-300 bg-widget p-1 dark:border-neutral-600">
                        <CheckCheckIcon className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED, () => (
                      <div className="rounded-full border border-gray-300 bg-widget p-1 dark:border-neutral-600">
                        <CheckIcon className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED, () => (
                      <div className="rounded-full border border-gray-300 bg-widget p-1 dark:border-neutral-600">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .with(DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED, () => (
                      <div className="rounded-full border border-gray-300 bg-widget p-1 dark:border-neutral-600">
                        <MailOpen className="h-3 w-3" aria-hidden="true" />
                      </div>
                    ))
                    .otherwise(() => (
                      <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                    ))}
                </div>

                <p
                  className="flex-auto truncate py-0.5 text-xs leading-5 text-muted-foreground dark:text-muted-foreground/70"
                  title={formatDocumentAuditLogAction(i18n, auditLog, userId).description}
                >
                  {formatDocumentAuditLogAction(i18n, auditLog, userId).description}
                </p>

                <time className="flex-none py-0.5 text-xs leading-5 text-muted-foreground dark:text-muted-foreground/70">
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
