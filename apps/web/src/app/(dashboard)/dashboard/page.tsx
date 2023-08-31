import Link from 'next/link';

import { Clock, File, FileCheck } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import { DocumentStatus as InternalDocumentStatus } from '@documenso/prisma/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import { StackAvatarsWithTooltip } from '~/components/(dashboard)/avatar/stack-avatars-with-tooltip';
import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';
import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

import { UploadDocument } from './upload-document';

const CARD_DATA = [
  {
    icon: FileCheck,
    title: 'Completed',
    status: InternalDocumentStatus.COMPLETED,
  },
  {
    icon: File,
    title: 'Drafts',
    status: InternalDocumentStatus.DRAFT,
  },
  {
    icon: Clock,
    title: 'Pending',
    status: InternalDocumentStatus.PENDING,
  },
];

export default async function DashboardPage() {
  const user = await getRequiredServerComponentSession();

  const [stats, results] = await Promise.all([
    getStats({
      user,
    }),
    findDocuments({
      userId: user.id,
      perPage: 10,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {CARD_DATA.map((card) => (
          <Link key={card.status} href={`/documents?status=${card.status}`}>
            <CardMetric icon={card.icon} title={card.title} value={stats[card.status]} />
          </Link>
        ))}
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
                      <StackAvatarsWithTooltip recipients={document.Recipient} />
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
