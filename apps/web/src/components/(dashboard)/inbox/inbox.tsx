'use client';

import { useEffect, useState } from 'react';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Inbox as InboxIcon } from 'lucide-react';
import { z } from 'zod';

import { useUpdateSearchParams } from '@documenso/lib/client-only/hooks/use-update-search-params';
import { SigningStatus } from '@documenso/prisma/client';
import { DocumentWithRecipientAndSender } from '@documenso/prisma/types/document';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Skeleton } from '@documenso/ui/primitives/skeleton';

import { useDebouncedValue } from '~/hooks/use-debounced-value';

import InboxContent from './inbox-content';
import { updateRecipientReadStatus } from './inbox.actions';
import { formatInboxDate } from './inbox.utils';

export const ZInboxSearchParamsSchema = z.object({
  filter: z
    .union([z.literal('SIGNED'), z.literal('NOT_SIGNED'), z.undefined()])
    .catch(() => undefined),
  id: z
    .string()
    .optional()
    .catch(() => undefined),
  query: z
    .string()
    .optional()
    .catch(() => undefined),
});

export type InboxProps = {
  className?: string;
};

const numberOfSkeletons = 3;

export default function Inbox(props: InboxProps) {
  const { className } = props;

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const updateSearchParams = useUpdateSearchParams();

  const parsedSearchParams = ZInboxSearchParamsSchema.parse(Object.fromEntries(searchParams ?? []));

  const [searchQuery, setSearchQuery] = useState(() => parsedSearchParams.query || '');

  const [readStatusState, setReadStatusState] = useState<{
    [documentId: string]: 'ERROR' | 'UPDATED' | 'UPDATING';
  }>({});

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);

  const {
    data,
    error,
    fetchNextPage,
    fetchPreviousPage,
    hasNextPage,
    hasPreviousPage,
    isFetching,
    isFetchingNextPage,
    isFetchingPreviousPage,
    refetch,
  } = trpc.document.searchInboxDocuments.useInfiniteQuery(
    {
      query: parsedSearchParams.query,
      filter: parsedSearchParams.filter,
    },
    {
      getPreviousPageParam: (firstPage) =>
        firstPage.currentPage > 1 ? firstPage.currentPage - 1 : undefined,
      getNextPageParam: (lastPage) =>
        lastPage.currentPage < lastPage.totalPages ? lastPage.currentPage + 1 : undefined,
    },
  );

  /**
   * The current documents in the inbox after filters and queries have been applied.
   */
  const inboxDocuments = (data?.pages ?? []).flatMap((page) => page.data);

  /**
   * The currently selected document in the inbox.
   */
  const selectedDocument: DocumentWithRecipientAndSender | null =
    inboxDocuments.find((item) => item.id.toString() === parsedSearchParams.id) ?? null;

  /**
   * Remove the ID from the query if it is not found in the result.
   */
  useEffect(() => {
    if (!selectedDocument && parsedSearchParams.id && data) {
      updateSearchParams({
        id: null,
      });
    }
  }, [data, selectedDocument, parsedSearchParams.id]);

  /**
   * Handle debouncing the seach query.
   */
  useEffect(() => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('query', debouncedSearchQuery);

    if (debouncedSearchQuery === '') {
      params.delete('query');
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [debouncedSearchQuery]);

  useEffect(() => {
    if (!isFetching) {
      setIsInitialLoad(false);
    }
  }, [isFetching]);

  const updateReadStatusState = (documentId: number, value: (typeof readStatusState)[string]) => {
    setReadStatusState({
      ...readStatusState,
      [documentId]: value,
    });
  };

  /**
   * Handle selecting the selected document to display and updating the read status if required.
   */
  const onSelectedDocumentChange = (value: DocumentWithRecipientAndSender) => {
    if (!pathname) {
      return;
    }

    // Update the read status.
    if (
      value.recipient.readStatus === 'NOT_OPENED' &&
      readStatusState[value.id] !== 'UPDATED' &&
      readStatusState[value.id] !== 'UPDATING'
    ) {
      updateReadStatusState(value.id, 'UPDATING');

      updateRecipientReadStatus(value.recipient.id, value.id)
        .then(() => {
          updateReadStatusState(value.id, 'UPDATED');
        })
        .catch(() => {
          updateReadStatusState(value.id, 'ERROR');
        });
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('id', value.id.toString());

    router.push(`${pathname}?${params.toString()}`);
  };

  if (error) {
    return (
      <section
        className={cn('flex flex-col items-center justify-center rounded-lg border', className)}
      >
        <p className="text-neutral-500">Something went wrong while loading your inbox.</p>
        <button onClick={() => refetch()} className="text-sm text-blue-500 hover:text-blue-600">
          Click here to try again
        </button>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col rounded-lg border sm:flex-row sm:divide-x', className)}>
      <div className="w-full sm:w-1/3">
        {/* Header with search and filter options. */}
        <div className="flex h-14 flex-row items-center justify-between border-b px-2 py-2">
          <Input
            placeholder="Search"
            defaultValue={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="ml-2">
            <Select
              defaultValue={parsedSearchParams.filter}
              onValueChange={(value) =>
                updateSearchParams({
                  filter: value || null,
                })
              }
            >
              <SelectTrigger className="max-w-[200px] text-slate-500">
                <SelectValue />
              </SelectTrigger>

              <SelectContent position="popper">
                <SelectItem value="">All</SelectItem>
                <SelectItem value={SigningStatus['NOT_SIGNED']}>Pending</SelectItem>
                <SelectItem value={SigningStatus['SIGNED']}>Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-[calc(100%-3.5rem)] overflow-y-scroll">
          {/* Handle rendering no items found. */}
          {!isFetching && inboxDocuments.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <p className="-mt-32 text-center text-sm text-neutral-500">No documents found.</p>
            </div>
          )}

          {hasPreviousPage && !isFetchingPreviousPage && (
            <button
              onClick={() => fetchPreviousPage()}
              className="mx-auto w-full border-b py-2 text-center text-sm text-slate-400"
            >
              Show previous
            </button>
          )}

          <ul>
            {/* Handle rendering skeleton on first load. */}
            {isFetching &&
              isInitialLoad &&
              !data &&
              Array.from({ length: numberOfSkeletons }).map((_, i) => (
                <li
                  key={`skeleton-${i}`}
                  className="hover:bg-muted/50 flex w-full cursor-pointer flex-row items-center border-b py-3 pr-4 text-left transition-colors"
                >
                  <Skeleton className="mx-3 h-2 w-2 rounded-full" />

                  <div className="w-full">
                    <div className="flex flex-row items-center justify-between">
                      <Skeleton className="h-5 w-6/12" />
                      <Skeleton className="h-4 w-2/12" />
                    </div>

                    <Skeleton className="my-1 h-4 w-8/12" />

                    <Skeleton className="h-4 w-4/12" />
                  </div>
                </li>
              ))}

            {/* Handle rendering list of inbox documents. */}
            {inboxDocuments.map((item, i) => (
              <li key={i}>
                <button
                  onClick={() => onSelectedDocumentChange(item)}
                  className={cn(
                    'hover:bg-muted/50 flex w-full cursor-pointer flex-row items-center border-b py-3 pr-4 text-left transition-colors',
                    {
                      'bg-muted/50 dark:bg-muted': selectedDocument?.id === item.id,
                    },
                  )}
                >
                  <div
                    className={cn([
                      'mx-3 h-2 w-2 rounded-full',
                      {
                        'bg-green-300': item.recipient.signingStatus === 'SIGNED',
                        'bg-yellow-300': item.recipient.signingStatus === 'NOT_SIGNED',
                      },
                    ])}
                  ></div>

                  <div className="w-full">
                    <div className="flex flex-row items-center justify-between">
                      <p className="line-clamp-1 text-sm">{item.subject}</p>

                      {/* Todo: This needs to be updated to when the document was sent to the recipient when that value is available. */}
                      <p className="whitespace-nowrap text-xs">{formatInboxDate(item.created)}</p>
                    </div>

                    {item.description && (
                      <p
                        className={cn('my-1 text-xs text-slate-500', {
                          'line-clamp-1': selectedDocument?.id !== item.id,
                        })}
                      >
                        {item.description}
                      </p>
                    )}

                    <p className="text-xs text-slate-400">
                      {item.sender.name} <span className="">&lt;{item.sender.email}&gt;</span>
                    </p>
                  </div>
                </button>

                {/* Mobile inbox content. */}
                {selectedDocument?.id === item.id && (
                  <div
                    className={cn('w-full sm:hidden', {
                      'border-b': i !== inboxDocuments.length - 1,
                    })}
                  >
                    <InboxContent document={selectedDocument} />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {hasNextPage && !isFetchingNextPage && (
            <button
              onClick={() => fetchNextPage()}
              className="mx-auto w-full py-2 text-center text-sm text-slate-400"
            >
              Show more
            </button>
          )}
        </div>
      </div>

      {/* Desktop inbox content. */}
      <div className="hidden sm:block sm:w-2/3">
        {selectedDocument ? (
          <InboxContent document={selectedDocument} />
        ) : (
          <div className="hidden h-full items-center justify-center text-slate-300 sm:flex">
            <InboxIcon className="h-12 w-12" />
          </div>
        )}
      </div>
    </section>
  );
}
