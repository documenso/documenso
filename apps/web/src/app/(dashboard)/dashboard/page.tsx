import Link from 'next/link';

import { Clock, File, FileCheck } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-session';
import { findDocuments } from '@documenso/lib/server-only/document/find-documents';
import { getStats } from '@documenso/lib/server-only/document/get-stats';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@documenso/ui/primitives/table';

import { CardMetric } from '~/components/(dashboard)/metric-card/metric-card';
import { DocumentStatus } from '~/components/formatter/document-status';
import { LocaleDate } from '~/components/formatter/locale-date';

import { UploadDocument } from './upload-document';

export default async function DashboardPage() {
  const session = await getRequiredServerComponentSession();

  const [stats, results] = await Promise.all([
    getStats({
      userId: session.id,
    }),
    findDocuments({
      userId: session.id,
      perPage: 10,
    }).then((r) => ({ ...r, data: [] })),
  ]);

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">Dashboard</h1>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardMetric icon={FileCheck} title="Completed" value={stats.COMPLETED} />
        <CardMetric icon={File} title="Drafts" value={stats.DRAFT} />
        <CardMetric icon={Clock} title="Pending" value={stats.PENDING} />
      </div>

      <div className="mt-12">
        <UploadDocument />

        <h2 className="mt-8 text-2xl font-semibold">Recent Documents</h2>

        <div className="mt-8 overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data.map((document) => (
                <TableRow key={document.id}>
                  <TableCell className="font-medium">{document.id}</TableCell>
                  <TableCell>
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium hover:underline"
                    >
                      {document.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DocumentStatus status={document.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <LocaleDate date={document.created} />
                  </TableCell>
                </TableRow>
              ))}
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
