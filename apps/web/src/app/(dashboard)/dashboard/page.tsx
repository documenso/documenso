import Link from 'next/link';

import { Clock, File, FileCheck } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { Recipient } from '@documenso/prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import { StackAvatar } from '~/components/(dashboard)/avatar';
import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';
import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

import { UploadDocument } from './upload-document';

const renderStackAvatars = (recipients: Recipient[]) => {
  const zIndex = 50;
  const itemsToRender = recipients.slice(0, 5);
  const remainingItems = recipients.length - itemsToRender.length;

  return itemsToRender.map((recipient: Recipient, index: number) => {
    const first = index === 0 ? true : false;
    const initials =
      recipient.name
        ?.split(' ')
        .map((name: string) => name.slice(0, 1).toUpperCase())
        .slice(0, 2)
        .join('') ?? 'UK';

    const lastItemText =
      index === itemsToRender.length - 1 && remainingItems > 0
        ? `+${remainingItems + 1}`
        : undefined;

    const type =
      recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED'
        ? 'completed'
        : recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED'
        ? 'waiting'
        : 'unsigned';

    return (
      <StackAvatar
        key={recipient.id}
        first={first}
        zIndex={String(zIndex - index * 10)}
        type={index === 4 ? 'unsigned' : type}
        fallbackText={lastItemText ? lastItemText : initials}
      />
    );
  });
};

const renderAvatar = (recipient: Recipient) => {
  const initials =
    recipient.name
      ?.split(' ')
      .map((name: string) => name.slice(0, 1).toUpperCase())
      .slice(0, 2)
      .join('') ?? 'UK';

  const type =
    recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED'
      ? 'completed'
      : recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED'
      ? 'waiting'
      : 'unsigned';

  return <StackAvatar first={true} key={recipient.id} type={type} fallbackText={initials} />;
};

export default async function DashboardPage() {
  const session = await getRequiredServerComponentSession();

  const [stats, results] = await Promise.all([
    getStats({
      userId: session.id,
    }),
    findDocuments({
      userId: session.id,
      perPage: 10,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link href={'/documents?status=COMPLETED'} passHref>
          <CardMetric icon={FileCheck} title="Completed" value={stats.COMPLETED} />
        </Link>
        <Link href={'/documents?status=DRAFT'} passHref>
          <CardMetric icon={File} title="Drafts" value={stats.DRAFT} />
        </Link>
        <Link href={'/documents?status=PENDING'} passHref>
          <CardMetric icon={Clock} title="Pending" value={stats.PENDING} />
        </Link>
      </div>

      <div className="mt-12">
        <UploadDocument />

        <h2 className="mt-8 text-2xl font-semibold">Recent Documents</h2>

        <div className="border-border mt-8 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Reciepient</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data.map((document) => {
                const waitingRecipients = document.Recipient.filter(
                  (recipient) =>
                    recipient.sendStatus === 'SENT' && recipient.signingStatus === 'NOT_SIGNED',
                );

                const completedRecipients = document.Recipient.filter(
                  (recipient) =>
                    recipient.sendStatus === 'SENT' && recipient.signingStatus === 'SIGNED',
                );

                const uncompletedRecipients = document.Recipient.filter(
                  (recipient) =>
                    recipient.sendStatus === 'NOT_SENT' && recipient.signingStatus === 'NOT_SIGNED',
                );

                return (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">{document.id}</TableCell>
                    <TableCell>
                      <Link
                        href={`/documents/${document.id}`}
                        className="focus-visible:ring-ring ring-offset-background rounded-md font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                      >
                        {document.title}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="flex cursor-pointer">
                            {renderStackAvatars(document.Recipient)}
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="flex flex-col gap-y-5 p-1">
                              {completedRecipients.length > 0 && (
                                <div>
                                  <h1 className="text-base font-medium">Completed</h1>
                                  {completedRecipients.map((recipient: Recipient) => (
                                    <div
                                      key={recipient.id}
                                      className="my-1 flex items-center gap-2"
                                    >
                                      {renderAvatar(recipient)}
                                      <span className="text-sm text-gray-500">
                                        {recipient.email}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {waitingRecipients.length > 0 && (
                                <div>
                                  <h1 className="text-base font-medium">Waiting</h1>
                                  {waitingRecipients.map((recipient: Recipient) => (
                                    <div
                                      key={recipient.id}
                                      className="my-1 flex items-center gap-2"
                                    >
                                      {renderAvatar(recipient)}
                                      <span className="text-sm text-gray-500">
                                        {recipient.email}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {uncompletedRecipients.length > 0 && (
                                <div>
                                  <h1 className="text-base font-medium">Uncompleted</h1>
                                  {uncompletedRecipients.map((recipient: Recipient) => (
                                    <div
                                      key={recipient.id}
                                      className="my-1 flex items-center gap-2"
                                    >
                                      {renderAvatar(recipient)}
                                      <span className="text-sm text-gray-500">
                                        {recipient.email}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell>
                      <DocumentStatus status={document.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <LocaleDate date={document.created} />
                    </TableCell>
                  </TableRow>
                );
              })}
              {results.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
