import Link from 'next/link';
import { redirect } from 'next/navigation';

import { ChevronLeft, DownloadIcon } from 'lucide-react';

import { getRequiredServerComponentSession } from '@documenso/lib/next-auth/get-server-component-session';
import { getDocumentById } from '@documenso/lib/server-only/document/get-document-by-id';
import { getRecipientsForDocument } from '@documenso/lib/server-only/recipient/get-recipients-for-document';
import { formatDocumentsPath } from '@documenso/lib/utils/teams';
import type { Recipient, Team } from '@documenso/prisma/client';
import { Button } from '@documenso/ui/primitives/button';
import { Card } from '@documenso/ui/primitives/card';

import { FRIENDLY_STATUS_MAP } from '~/components/formatter/document-status';

import { DocumentLogsDataTable } from './document-logs-data-table';

export type DocumentLogsPageViewProps = {
  params: {
    id: string;
  };
  team?: Team;
};

export const DocumentLogsPageView = async ({ params, team }: DocumentLogsPageViewProps) => {
  const { id } = params;

  const documentId = Number(id);

  const documentRootPath = formatDocumentsPath(team?.url);

  if (!documentId || Number.isNaN(documentId)) {
    redirect(documentRootPath);
  }

  const { user } = await getRequiredServerComponentSession();

  const [document, recipients] = await Promise.all([
    getDocumentById({
      id: documentId,
      userId: user.id,
      teamId: team?.id,
    }).catch(() => null),
    getRecipientsForDocument({
      documentId,
      userId: user.id,
      teamId: team?.id,
    }),
  ]);

  if (!document || !document.documentData) {
    redirect(documentRootPath);
  }

  const documentInformation: { description: string; value: string }[] = [
    {
      description: 'Document title',
      value: document.title,
    },
    {
      description: 'Document ID',
      value: document.id.toString(),
    },
    {
      description: 'Document status',
      value: FRIENDLY_STATUS_MAP[document.status].label,
    },
    {
      description: 'Created by',
      value: document.User.name ?? document.User.email,
    },
    {
      description: 'Date created',
      value: document.createdAt.toISOString(),
    },
    {
      description: 'Last updated',
      value: document.updatedAt.toISOString(),
    },
    {
      description: 'Time zone',
      value: document.documentMeta?.timezone ?? 'N/A',
    },
  ];

  const formatRecipientText = (recipient: Recipient) => {
    let text = recipient.email;

    if (recipient.name) {
      text = `${recipient.name} (${recipient.email})`;
    }

    return `${text} - ${recipient.role}`;
  };

  return (
    <div className="mx-auto -mt-4 w-full max-w-screen-xl px-4 md:px-8">
      <Link
        href={`${documentRootPath}/${document.id}`}
        className="flex items-center text-[#7AC455] hover:opacity-80"
      >
        <ChevronLeft className="mr-2 inline-block h-5 w-5" />
        Document
      </Link>

      <div className="flex flex-col justify-between sm:flex-row">
        <h1 className="mt-4 truncate text-2xl font-semibold md:text-3xl" title={document.title}>
          {document.title}
        </h1>

        <div className="mt-4 flex w-full flex-row sm:mt-0 sm:w-auto sm:self-end">
          <Button variant="outline" className="mr-2 w-full sm:w-auto">
            <DownloadIcon className="mr-1.5 h-4 w-4" />
            Download certificate
          </Button>

          <Button className="w-full sm:w-auto">
            <DownloadIcon className="mr-1.5 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <section className="mt-6">
        <Card className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2" degrees={45} gradient>
          {documentInformation.map((info, i) => (
            <div className="text-foreground text-sm" key={i}>
              <h3 className="font-semibold">{info.description}</h3>
              <p className="text-muted-foreground">{info.value}</p>
            </div>
          ))}

          <div className="text-foreground text-sm">
            <h3 className="font-semibold">Recipients</h3>
            <ul className="text-muted-foreground list-inside list-disc">
              {recipients.map((recipient) => (
                <li key={`recipient-${recipient.id}`}>
                  <span className="-ml-2">{formatRecipientText(recipient)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <DocumentLogsDataTable documentId={document.id} />
      </section>
    </div>
  );
};
