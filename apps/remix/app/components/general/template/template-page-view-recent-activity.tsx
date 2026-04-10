import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Trans } from '@lingui/react/macro';
import { DocumentSource } from '@prisma/client';
import { Loader } from 'lucide-react';
import { DateTime } from 'luxon';
import { Link } from 'react-router';
import { match } from 'ts-pattern';

export type TemplatePageViewRecentActivityProps = {
  templateId: number;
  documentRootPath: string;
};

export const TemplatePageViewRecentActivity = ({
  templateId,
  documentRootPath,
}: TemplatePageViewRecentActivityProps) => {
  const { data, isLoading, isLoadingError, refetch } = trpc.document.find.useQuery({
    templateId,
    orderByColumn: 'createdAt',
    orderByDirection: 'asc',
    perPage: 5,
  });

  const results = data ?? {
    data: [],
    perPage: 10,
    currentPage: 1,
    totalPages: 1,
  };

  return (
    <section className="flex flex-col rounded-xl border border-border bg-widget dark:bg-background">
      <div className="flex flex-row items-center justify-between border-b px-4 py-3">
        <h1 className="font-medium text-foreground">
          <Trans>Recent documents</Trans>
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
          <p className="text-foreground/80 text-sm">
            <Trans>Unable to load documents</Trans>
          </p>
          <button
            onClick={async () => refetch()}
            className="mt-2 text-foreground/70 text-sm hover:text-muted-foreground"
          >
            <Trans>Click here to retry</Trans>
          </button>
        </div>
      )}

      {data && (
        <>
          <ul role="list" className="space-y-6 p-4">
            {data.data.length > 0 && results.totalPages > 1 && (
              <li className="relative flex gap-x-4">
                <div className="absolute top-0 -bottom-6 left-0 flex w-6 justify-center">
                  <div className="w-px bg-border" />
                </div>

                <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-widget">
                  <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                </div>

                <button
                  onClick={() => {
                    window.scrollTo({
                      top: document.getElementById('documents')?.offsetTop,
                      behavior: 'smooth',
                    });
                  }}
                  className="flex items-center text-foreground/70 text-xs hover:text-muted-foreground"
                >
                  <Trans>View more</Trans>
                </button>
              </li>
            )}

            {results.data.length === 0 && (
              <div className="flex items-center justify-center py-4">
                <p className="text-muted-foreground/70 text-sm">
                  <Trans>No recent documents</Trans>
                </p>
              </div>
            )}

            {results.data.map((document, documentIndex) => (
              <li key={document.id} className="relative flex gap-x-4">
                <div
                  className={cn(
                    documentIndex === results.data.length - 1 ? 'h-6' : '-bottom-6',
                    'absolute top-0 left-0 flex w-6 justify-center',
                  )}
                >
                  <div className="w-px bg-border" />
                </div>

                <div className="relative flex h-6 w-6 flex-none items-center justify-center bg-widget text-foreground/40">
                  <div className="h-1.5 w-1.5 rounded-full bg-widget ring-1 ring-gray-300 dark:ring-neutral-600" />
                </div>

                <Link
                  to={`${documentRootPath}/${document.envelopeId}`}
                  className="flex-auto truncate py-0.5 text-muted-foreground text-xs leading-5 dark:text-muted-foreground/70"
                >
                  {match(document.source)
                    .with(DocumentSource.DOCUMENT, DocumentSource.TEMPLATE, () => (
                      <Trans>
                        Document created by <span className="font-bold">{document.user.name}</span>
                      </Trans>
                    ))
                    .with(DocumentSource.TEMPLATE_DIRECT_LINK, () => (
                      <Trans>
                        Document created using a <span className="font-bold">direct link</span>
                      </Trans>
                    ))
                    .exhaustive()}
                </Link>

                <time className="flex-none py-0.5 text-muted-foreground text-xs leading-5 dark:text-muted-foreground/70">
                  {DateTime.fromJSDate(document.createdAt).toRelative({ style: 'short' })}
                </time>
              </li>
            ))}
          </ul>

          <Button
            className="mx-4 mb-4"
            onClick={() => {
              window.scrollTo({
                top: document.getElementById('documents')?.offsetTop,
                behavior: 'smooth',
              });
            }}
          >
            <Trans>View all related documents</Trans>
          </Button>
        </>
      )}
    </section>
  );
};
