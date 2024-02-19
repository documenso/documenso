'use client';

import { useMemo, useState } from 'react';

import { ArrowRightIcon, Loader } from 'lucide-react';
import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';

import { DOCUMENT_AUDIT_LOG_EMAIL_FORMAT } from '@documenso/lib/constants/document-audit-logs';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { formatDocumentAuditLogActionString } from '@documenso/lib/utils/document-audit-logs';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Avatar, AvatarFallback } from '@documenso/ui/primitives/avatar';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import { Sheet, SheetContent, SheetTrigger } from '@documenso/ui/primitives/sheet';

import { LocaleDate } from '~/components/formatter/locale-date';

import { DocumentHistorySheetChanges } from './document-history-sheet-changes';

export type DocumentHistorySheetProps = {
  documentId: number;
  userId: number;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (_value: boolean) => void;
  children?: React.ReactNode;
};

export const DocumentHistorySheet = ({
  documentId,
  userId,
  isMenuOpen,
  onMenuOpenChange,
  children,
}: DocumentHistorySheetProps) => {
  const [isUserDetailsVisible, setIsUserDetailsVisible] = useState(false);

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
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      keepPreviousData: true,
    },
  );

  const documentAuditLogs = useMemo(() => (data?.pages ?? []).flatMap((page) => page.data), [data]);

  const extractBrowser = (userAgent?: string | null) => {
    if (!userAgent) {
      return 'Unknown';
    }

    const parser = new UAParser(userAgent);

    parser.setUA(userAgent);

    const result = parser.getResult();

    return result.browser.name;
  };

  /**
   * Applies the following formatting for a given text:
   * - Uppercase first lower, lowercase rest
   * - Replace _ with spaces
   *
   * @param text The text to format
   * @returns The formatted text
   */
  const formatGenericText = (text: string) => {
    return (text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()).replaceAll('_', ' ');
  };

  return (
    <Sheet open={isMenuOpen} onOpenChange={onMenuOpenChange}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}

      <SheetContent
        sheetClass="backdrop-blur-none"
        className="flex w-full max-w-[500px] flex-col overflow-y-auto p-0"
      >
        <div className="text-foreground px-6 pt-6">
          <h1 className="text-lg font-medium">Document history</h1>
          <button
            className="text-muted-foreground text-sm"
            onClick={() => setIsUserDetailsVisible(!isUserDetailsVisible)}
          >
            {isUserDetailsVisible ? 'Hide' : 'Show'} additional information
          </button>
        </div>

        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
          </div>
        )}

        {isLoadingError && (
          <div className="flex h-full flex-col items-center justify-center">
            <p className="text-foreground/80 text-sm">Unable to load document history</p>
            <button
              onClick={async () => refetch()}
              className="text-foreground/70 hover:text-muted-foreground mt-2 text-sm"
            >
              Click here to retry
            </button>
          </div>
        )}

        {data && (
          <ul
            className={cn('divide-y border-t', {
              'mb-4 border-b': !hasNextPage,
            })}
          >
            {documentAuditLogs.map((auditLog) => (
              <li className="px-4 py-2.5" key={auditLog.id}>
                <div className="flex flex-row items-center">
                  <Avatar className="mr-2 h-9 w-9">
                    <AvatarFallback className="text-xs text-gray-400">
                      {(auditLog?.email ?? auditLog?.name ?? '?').slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <p className="text-foreground text-xs font-bold">
                      {formatDocumentAuditLogActionString(auditLog, userId)}
                    </p>
                    <p className="text-foreground/50 text-xs">
                      <LocaleDate date={auditLog.createdAt} format="d MMM, yyyy HH:MM a" />
                    </p>
                  </div>
                </div>

                {match(auditLog)
                  .with(
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT },
                    () => null,
                  )
                  .with(
                    { type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED },
                    ({ data }) => {
                      const values = [
                        {
                          key: 'Email',
                          value: data.recipientEmail,
                        },
                        {
                          key: 'Role',
                          value: formatGenericText(data.recipientRole),
                        },
                      ];

                      // Insert the name to the start of the array if available.
                      if (data.recipientName) {
                        values.unshift({
                          key: 'Name',
                          value: data.recipientName,
                        });
                      }

                      return <DocumentHistorySheetChanges values={values} />;
                    },
                  )
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED }, ({ data }) => {
                    if (data.changes.length === 0) {
                      return null;
                    }

                    return (
                      <DocumentHistorySheetChanges
                        values={data.changes.map(({ type, from, to }) => ({
                          key: formatGenericText(type),
                          value: (
                            <span className="inline-flex flex-row items-center">
                              <span>{type === 'ROLE' ? formatGenericText(from) : from}</span>
                              <ArrowRightIcon className="h-4 w-4" />
                              <span>{type === 'ROLE' ? formatGenericText(to) : to}</span>
                            </span>
                          ),
                        }))}
                      />
                    );
                  })
                  .with(
                    { type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_CREATED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_DELETED },
                    { type: DOCUMENT_AUDIT_LOG_TYPE.FIELD_UPDATED },
                    ({ data }) => (
                      <DocumentHistorySheetChanges
                        values={[
                          {
                            key: 'Field',
                            value: formatGenericText(data.fieldType),
                          },
                          {
                            key: 'Recipient',
                            value: formatGenericText(data.fieldRecipientEmail),
                          },
                        ]}
                      />
                    ),
                  )
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_META_UPDATED }, ({ data }) => {
                    if (data.changes.length === 0) {
                      return null;
                    }

                    return (
                      <DocumentHistorySheetChanges
                        values={data.changes.map((change) => ({
                          key: formatGenericText(change.type),
                          value: change.type === 'PASSWORD' ? '*********' : change.to,
                        }))}
                      />
                    );
                  })
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_TITLE_UPDATED }, ({ data }) => (
                    <DocumentHistorySheetChanges
                      values={[
                        {
                          key: 'Old',
                          value: data.from,
                        },
                        {
                          key: 'New',
                          value: data.to,
                        },
                      ]}
                    />
                  ))
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_INSERTED }, ({ data }) => (
                    <DocumentHistorySheetChanges
                      values={[
                        {
                          key: 'Field inserted',
                          value: formatGenericText(data.field.type),
                        },
                      ]}
                    />
                  ))
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED }, ({ data }) => (
                    <DocumentHistorySheetChanges
                      values={[
                        {
                          key: 'Field uninserted',
                          value: formatGenericText(data.field),
                        },
                      ]}
                    />
                  ))
                  .with({ type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT }, ({ data }) => (
                    <DocumentHistorySheetChanges
                      values={[
                        {
                          key: 'Type',
                          value: DOCUMENT_AUDIT_LOG_EMAIL_FORMAT[data.emailType].description,
                        },
                        {
                          key: 'Sent to',
                          value: data.recipientEmail,
                        },
                      ]}
                    />
                  ))
                  .exhaustive()}

                {isUserDetailsVisible && (
                  <>
                    <div className="mb-1 mt-2 flex flex-row space-x-2">
                      <Badge variant="neutral" className="text-muted-foreground">
                        IP: {auditLog.ipAddress ?? 'Unknown'}
                      </Badge>

                      <Badge variant="neutral" className="text-muted-foreground">
                        Browser: {extractBrowser(auditLog.userAgent)}
                      </Badge>
                    </div>
                  </>
                )}
              </li>
            ))}

            {hasNextPage && (
              <div className="flex items-center justify-center py-4">
                <Button
                  variant="outline"
                  loading={isFetchingNextPage}
                  onClick={async () => fetchNextPage()}
                >
                  Show more
                </Button>
              </div>
            )}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
};
